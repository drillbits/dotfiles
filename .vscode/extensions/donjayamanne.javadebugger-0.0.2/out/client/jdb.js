'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var path = require('path');
var os = require('os');
var child_process = require('child_process');
var vscode_debugadapter_1 = require('vscode-debugadapter');
var getport = require("get-port");
var open_1 = require('./common/open');
var events_1 = require('events');
var waitForPortToOpen_1 = require('./common/waitForPortToOpen');
var JAVA_APPLICATION_EXITED = "The application exited";
var STARTS_WITH_THREAD_NAME_REGEX = new RegExp("^\\w+.*\\[[0-9]+\\] .*");
//Some times the console prompt seems to end with the thread name twice!!! No idea why 
var IS_THREAD_NAME_REGEX = new RegExp("^(.+\\[[0-9]+\\]\s*)+ $");
(function (JdbCommandType) {
    JdbCommandType[JdbCommandType["StepUp"] = 0] = "StepUp";
    JdbCommandType[JdbCommandType["Continue"] = 1] = "Continue";
    JdbCommandType[JdbCommandType["Resume"] = 2] = "Resume";
    JdbCommandType[JdbCommandType["Run"] = 3] = "Run";
    JdbCommandType[JdbCommandType["Pause"] = 4] = "Pause";
    JdbCommandType[JdbCommandType["Step"] = 5] = "Step";
    JdbCommandType[JdbCommandType["Next"] = 6] = "Next";
    JdbCommandType[JdbCommandType["Locals"] = 7] = "Locals";
    JdbCommandType[JdbCommandType["SetBreakpoint"] = 8] = "SetBreakpoint";
    JdbCommandType[JdbCommandType["ClearBreakpoint"] = 9] = "ClearBreakpoint";
    JdbCommandType[JdbCommandType["ListThreads"] = 10] = "ListThreads";
    JdbCommandType[JdbCommandType["ListStack"] = 11] = "ListStack";
    JdbCommandType[JdbCommandType["Print"] = 12] = "Print";
    JdbCommandType[JdbCommandType["Dump"] = 13] = "Dump";
    JdbCommandType[JdbCommandType["Exit"] = 14] = "Exit";
    JdbCommandType[JdbCommandType["Suspend"] = 15] = "Suspend";
})(exports.JdbCommandType || (exports.JdbCommandType = {}));
var JdbCommandType = exports.JdbCommandType;
var CommandTypesThatConContainResponsesForBreakPoints = [JdbCommandType.Continue,
    JdbCommandType.Exit,
    JdbCommandType.ListStack,
    JdbCommandType.ListThreads,
    JdbCommandType.Next,
    JdbCommandType.Pause,
    JdbCommandType.Resume,
    JdbCommandType.Run,
    JdbCommandType.SetBreakpoint,
    JdbCommandType.Step,
    JdbCommandType.StepUp,
    JdbCommandType.Suspend];
/*
How to start the java server
1. java -agentlib:jdwp=transport=dt_socket,server=y,address=3003 DrawCards
2. jdb -connect com.sun.jdi.SocketAttach:hostname=localhost,port=3003
*/
var JdbRunner = (function (_super) {
    __extends(JdbRunner, _super);
    function JdbRunner(args, debugSession) {
        var _this = this;
        _super.call(this);
        this.args = args;
        this.readyToAcceptBreakPointsResolved = false;
        this.outputBuffer = "";
        this.pendingCommands = [];
        this.executingCommands = [];
        this.lastThreadName = "";
        this.debugSession = debugSession;
        var ext = path.extname(args.startupClass);
        this.className = path.basename(args.startupClass, ext.toUpperCase() === ".JAVA" ? ext : "");
        this.jdbLoaded = new Promise(function (resolve, reject) {
            _this.jdbLoadedResolve = resolve;
            _this.jdbLoadedReject = reject;
        });
        this.readyToAcceptBreakPoints = new Promise(function (resolve) {
            _this.readyToAcceptBreakPointsResolve = resolve;
        });
        this.startProgramInDebugJavaMode().then(function (port) {
            _this.initProc(port);
        }).catch(this.jdbLoadedReject);
        this.Exited = new Promise(function (resolve, reject) {
            _this.exitedResolve = resolve;
        });
        this.jdbLoaded.catch(function () { return _this.killProcesses(); });
        this.Exited.then(function () { return _this.killProcesses(); });
    }
    JdbRunner.prototype.killProcesses = function () {
        try {
            this.jdbProc.kill();
            this.jdbProc = null;
        }
        catch (ex) {
        }
        try {
            this.javaProc.kill();
            this.javaProc = null;
        }
        catch (ex) {
        }
    };
    JdbRunner.prototype.sendRemoteConsoleLog = function (msg) {
        this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(msg));
    };
    JdbRunner.prototype.initProc = function (port) {
        var _this = this;
        var jdbPath = this.args.jdkPath ? path.join(this.args.jdkPath, "jdb") : "jdb";
        var args = ["-connect", ("com.sun.jdi.SocketAttach:hostname=localhost,port=" + port)];
        this.jdbProc = child_process.spawn(jdbPath, args, {
            cwd: this.args.cwd
        });
        this.jdbProc.stdout.on("data", function (data) {
            _this.onDataReceived(data);
        });
        this.jdbProc.stderr.on("data", function (data) {
            var message = data;
            if (data instanceof Error) {
                message = data.name + ": " + data.message;
            }
            if (_this.javaServerAppStarted && _this.readyToAcceptCommands) {
                _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(message, "error"));
            }
            else {
                _this.exited = true;
                _this.jdbLoadedReject("Failed to start jdb, " + message);
            }
        });
        this.jdbProc.stdout.on("close", function (data) {
            _this.onDataReceived("", true);
        });
        this.jdbProc.on("error", function (data) {
            if (_this.javaServerAppStarted && _this.readyToAcceptCommands) {
                var message = data;
                if (data instanceof Error) {
                    message = data.name + ": " + data.message;
                }
                _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent("jdb Error " + message, "error"));
            }
            else {
                _this.exited = true;
                _this.jdbLoadedReject(data);
            }
        });
    };
    JdbRunner.prototype.startProgramInDebugJavaMode = function () {
        var _this = this;
        return getport().then(function (port) {
            _this.javaLoaded = new Promise(function (resolve, reject) {
                _this.javaLoadedResolve = resolve;
                _this.javaLoadedReject = reject;
            });
            var javaPath = (!_this.args.jdkPath || _this.args.jdkPath.length === 0) ? "java" : path.join(_this.args.jdkPath, "java");
            var options = _this.args.options;
            var args = [("-agentlib:jdwp=transport=dt_socket,server=y,address=" + port)].concat(options).concat(_this.className);
            if (_this.args.externalConsole === true) {
                open_1.open({ wait: false, app: [javaPath].concat(args), cwd: _this.args.cwd }).then(function (proc) {
                    _this.javaProc = proc;
                    _this.handleJavaOutput(port);
                }, function (error) {
                    _this.onJavaErrorHandler(error);
                });
            }
            else {
                _this.javaProc = child_process.spawn(javaPath, args, {
                    cwd: _this.args.cwd
                });
                _this.handleJavaOutput(port);
            }
            return _this.javaLoaded;
        });
    };
    JdbRunner.prototype.handleJavaOutput = function (port) {
        var _this = this;
        //read the jdb output
        var accumulatedData = "";
        if (this.args.externalConsole) {
            waitForPortToOpen_1.WaitForPortToOpen(port, 5000).then(function () {
                _this.javaServerAppStarted = true;
                _this.javaLoadedResolve(port);
            })
                .catch(function (error) {
                var message = error.message ? error.message : error;
                if (_this.javaServerAppStarted && _this.readyToAcceptCommands) {
                    _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(message));
                }
                else {
                    _this.exited = true;
                    _this.javaLoadedReject("Failed to start the program, " + message);
                }
            });
            return;
        }
        this.javaProc.stdout.on("data", function (data) {
            var dataStr = new Buffer(data).toString('utf-8');
            if (_this.javaServerAppStarted && _this.readyToAcceptCommands) {
                if (!_this.args.externalConsole) {
                    _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(dataStr));
                }
            }
            else {
                accumulatedData += dataStr;
                if (accumulatedData.indexOf("Listening for transport") === 0 && accumulatedData.trim().endsWith(port.toString())) {
                    accumulatedData = "";
                    _this.javaServerAppStarted = true;
                    _this.javaLoadedResolve(port);
                }
            }
        });
        this.javaProc.stdout.on("close", function (data) {
            if (!_this.javaServerAppStarted && !_this.readyToAcceptCommands) {
                _this.exited = true;
                _this.javaLoadedReject(accumulatedData);
                _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(accumulatedData));
                return;
            }
            _this.onDataReceived("", true);
        });
        this.javaProc.stderr.on("data", function (data) {
            var message = new Buffer(data).toString('utf-8');
            if (_this.javaServerAppStarted && _this.readyToAcceptCommands) {
                _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(message, "stderr"));
            }
            else {
                _this.exited = true;
                _this.javaLoadedReject(message);
                _this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent(message));
            }
        });
        this.javaProc.on("error", function (data) {
            _this.onJavaErrorHandler(data);
        });
    };
    JdbRunner.prototype.onJavaErrorHandler = function (data) {
        var message = data;
        if (data instanceof Error) {
            message = data.name + ": " + data.message;
        }
        if (this.javaServerAppStarted && this.readyToAcceptCommands) {
            this.debugSession.sendEvent(new vscode_debugadapter_1.OutputEvent("Java Error " + message, "error"));
        }
        else {
            this.exited = true;
            this.javaLoadedReject("Failed to start the program, " + message);
        }
    };
    JdbRunner.prototype.sendCmd = function (command, type) {
        var _this = this;
        if (this.exited) {
            return Promise.resolve({ threadName: "", data: [] });
        }
        var jdbCmd = { command: command, type: type };
        jdbCmd.finalPromise = new Promise(function (resolve) {
            var promiseToUse = _this.jdbLoaded;
            if (type === JdbCommandType.SetBreakpoint || type === JdbCommandType.Run) {
                promiseToUse = _this.readyToAcceptBreakPoints;
            }
            promiseToUse.then(function () {
                jdbCmd.promise = new Promise(function (resolve) {
                    jdbCmd.promiseResolve = resolve;
                });
                jdbCmd.promise.then(resolve);
                _this.pendingCommands.push(jdbCmd);
                _this.checkAndSendCommand();
            });
        });
        return jdbCmd.finalPromise;
    };
    JdbRunner.prototype.checkAndSendCommand = function () {
        var _this = this;
        if (this.exited) {
            this.pendingCommands.forEach(function (cmd) {
                cmd.promiseResolve([]);
            });
            return;
        }
        if (this.executingCommands.length === 0) {
            if (this.pendingCommands.length > 0) {
                var jdbCmd = this.pendingCommands[0];
                this.executingCommands.push(jdbCmd);
                this.jdbProc.stdin.write(jdbCmd.command + "\n");
            }
            return;
        }
        var currentCmd = this.executingCommands[0];
        currentCmd.promise.then(function () {
            _this.checkAndSendCommand();
        });
    };
    JdbRunner.prototype.onDataReceived = function (data, exit) {
        var _this = this;
        if (exit === void 0) { exit = false; }
        this.outputBuffer = this.outputBuffer + new Buffer(data).toString('utf-8');
        var lines = this.outputBuffer.split(/(\r?\n)/g).filter(function (line) { return line !== os.EOL && line !== "\n" && line !== "\r"; });
        if (lines.length === 0) {
            return;
        }
        var lastLine = lines[lines.length - 1];
        if (this.executingCommands.length === 0 && lastLine.trim().endsWith("]") && this.outputBuffer.indexOf("VM Started") > 0 && !this.vmStarted) {
            if (IS_THREAD_NAME_REGEX.test(lastLine)) {
                this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim();
            }
            this.vmStarted = true;
            this.outputBuffer = "";
            var startedPromise = Promise.resolve(null);
            if (this.args.stopOnEntry) {
                startedPromise = this.sendCmd("stop in " + this.className + ".main\n", JdbCommandType.SetBreakpoint);
            }
            startedPromise.then(function () {
                // Let this go into the queue, then we can start the program by sending the run command (after a few milli seconds)
                _this.runCommandSent = true;
                _this.sendCmd("run", JdbCommandType.Run).then(function (resp) {
                    _this.readyToAcceptCommands = true;
                    _this.jdbLoadedResolve(resp.threadName);
                });
            });
            //Next, ensure we can accept breakpoints
            this.readyToAcceptBreakPointsResolve();
            return;
        }
        if (!this.vmStarted) {
            return;
        }
        if (this.executingCommands.length === 0 &&
            lines.some(function (line) { return line === JAVA_APPLICATION_EXITED; }) &&
            lines.filter(function (line) { return line.trim().length > 0; }).length === 1 &&
            !this.readyToAcceptCommands) {
            this.outputBuffer = "";
            this.readyToAcceptCommands = true;
            this.jdbLoadedResolve.call(this);
            this.exited = true;
            this.exitedResolve();
            return;
        }
        //If the application exits, the the last line is "the application exited" message followed by a new line
        if (exit) {
            this.exited = true;
            this.exitedResolve();
            return;
        }
        var lastCmd = this.executingCommands.length === 0 ? null : this.executingCommands[this.executingCommands.length - 1];
        if (!lastCmd) {
            //If no last command and we have some output, then this is most likely a breakpoint being initialized or a breakpoint being hit
            //If a breakpoint has been hit, then the last line MUST be the thread name
            if ((this.checkIfBreakpointWasHitLast(lines) || this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine))) {
                return;
            }
            if (this.checkIfBreakpointWillBeHit(lines)) {
                return;
            }
            if (this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
                return;
            }
        }
        var lastCmdType = lastCmd ? lastCmd.type : null;
        switch (lastCmdType) {
            case JdbCommandType.Run: {
                this.processRunCommand(lines, lastLine, lastCmd);
                return;
            }
            //If a breakpoint was hit, we'd request the threads
            //Or if no breakpoint has been hit (e.g. if we pause), then the last active thread is ">" (i.e. nothing)
            case JdbCommandType.ListThreads:
            case JdbCommandType.ListStack:
            case JdbCommandType.Locals:
            case JdbCommandType.Dump:
            case JdbCommandType.Print: {
                this.processQueryCommands(lines, lastLine, lastCmd);
                return;
            }
            case JdbCommandType.ClearBreakpoint:
            case JdbCommandType.SetBreakpoint: {
                //If we haven't yet sent the run command, that means we're still dealing with breakpoints
                if (!this.runCommandSent && lastCmd.type === JdbCommandType.SetBreakpoint) {
                    //Breakpoint could have been deferred 
                    //Find the end of the command response
                    // let endResponse = lines.findIndex(line => IS_THREAD_NAME_REGEX.test(line.trim()));
                    // let endResponse = lines.findIndex(line => line.indexOf("[") > 0 && line.trim().endsWith("]"));
                    // if (endResponse >= 0) {
                    if (IS_THREAD_NAME_REGEX.test(lastLine)) {
                        this.outputBuffer = "";
                        //Note, at this point the main thread is still the same as it was when the debugger loaded, most likely "main[1]""
                        this.sendResponseForLastCommand(lastCmd, lines);
                    }
                    return;
                }
                this.processBreakpoint(lines, lastLine, lastCmd);
                return;
            }
            case JdbCommandType.Next:
            case JdbCommandType.Step:
            case JdbCommandType.StepUp: {
                this.processCodeStepping(lines, lastLine, lastCmd);
                return;
            }
            case JdbCommandType.Continue: {
                this.processContinue(lines, lastLine, lastCmd);
                return;
            }
            case JdbCommandType.Suspend:
            case JdbCommandType.Resume: {
                this.processSuspendAndResume(lines, lastLine, lastCmd);
                return;
            }
            default:
                break;
        }
        if (this.checkIfBreakpointWasHitLast(lines)) {
            return;
        }
        if (this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine, lastCmd)) {
            this.outputBuffer = "";
            return;
        }
    };
    JdbRunner.prototype.sendResponseForLastCommand = function (lastCmd, lines) {
        this.pendingCommands.shift();
        this.executingCommands.pop();
        lastCmd.promiseResolve({ threadName: this.lastThreadName, data: lines });
    };
    JdbRunner.prototype.processQueryCommands = function (lines, lastLine, lastCmd) {
        var _this = this;
        //We're now looking for a line that starts with ">" or "main[1]" (thread name)
        // let indexOfEndOfResponse = lines.findIndex(line => line.indexOf(">") === 0 || STARTS_WITH_THREAD_NAME_REGEX.test(line));
        var reversedArray = lines.slice().reverse();
        var indexOfEndOfResponse = reversedArray.findIndex(function (line) { return line.startsWith(_this.lastThreadName + "[") || IS_THREAD_NAME_REGEX.test(line); });
        if (indexOfEndOfResponse === -1) {
            //However sometimes, we have breakpoints being hit, and the response gets mangled pause
            //We have the text "Breakpoint hit: Group System: .." (responses for multiple commands getting mixed)
            //This is to be expected as we have multiple threads (I think multiple threads) writing to the same stream (hmmm)
            //Anyways
            //Question is how on earth do we handle this situtation
            //Proper Solution - use jpda (instead of jdb) 
            return;
        }
        //Now get the proper index (remember we reversed the array to start form the bottom)
        indexOfEndOfResponse = lines.length - indexOfEndOfResponse;
        var endOfResponseLine = lines[indexOfEndOfResponse - 1];
        this.lastThreadName = endOfResponseLine.substring(0, endOfResponseLine.indexOf("[")).trim();
        var threadResponseLines = lines.slice(0, indexOfEndOfResponse - 1);
        this.sendResponseForLastCommand(lastCmd, threadResponseLines);
        if (!this.checkRestOfTheResponse(lines, lastLine, 0, indexOfEndOfResponse, lastCmd)) {
            if (this.checkIfBreakpointWillBeHit(lines) || this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
                //We could get more messages 
                //Ok, this means there's more in the message
                //I.e. we have a partial message in the response
                //Find the index of the ">" or the threadName
                var newLines = lines.slice(indexOfEndOfResponse);
                this.outputBuffer = newLines.join(os.EOL);
                return;
            }
            this.outputBuffer = "";
        }
    };
    JdbRunner.prototype.processBreakpoint = function (lines, lastLine, lastCmd) {
        if (lines.length === 1) {
            return;
        }
        var indexToStartFrom = lines.findIndex(function (line) { return line.indexOf("Set breakpoint ") >= 0 ||
            line.indexOf("Unable to set breakpoint ") >= 0 ||
            line.indexOf("Not found: ") >= 0 ||
            line.indexOf("Removed: ") >= 0 ||
            line.indexOf("Deferring breakpoint ") >= 0; });
        //-1 = Rare occasion, if a breakpoint gets hit even before a response for setting a breakpoint is received
        //Response in the Last line, this means we need to wait for more
        if (indexToStartFrom === -1) {
            return;
        }
        //Check if there was an end to the response
        var indexOfEndOfResponse = lines.slice(indexToStartFrom + 1).findIndex(function (line) { return line.indexOf(">") === 0 || STARTS_WITH_THREAD_NAME_REGEX.test(line); });
        if (indexOfEndOfResponse === -1) {
            return;
        }
        this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse + indexToStartFrom + 1));
        if (!this.checkRestOfTheResponse(lines, lastLine, 0, indexOfEndOfResponse, lastCmd)) {
            if (this.checkIfBreakpointWillBeHit(lines) || this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
                //We could get more messages 
                //Ok, this means there's more in the message
                //I.e. we have a partial message in the response
                //Find the index of the ">" or the threadName
                var newLines = lines.slice(indexOfEndOfResponse);
                this.outputBuffer = newLines.join(os.EOL);
                return;
            }
            this.outputBuffer = "";
        }
    };
    JdbRunner.prototype.processCodeStepping = function (lines, lastLine, lastCmd) {
        //if we have hit a breakpoint, then it is possible we will never get a response for the previous command (set, next step up)
        if (this.checkIfBreakpointWillBeHit(lines) || this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
            var hasNonBreakPointLines = lines.some(function (line) { return line.indexOf("Breakpoint hit:") === -1 && !IS_THREAD_NAME_REGEX.test(line) && line.trim().length > 0 && line.trim() !== ">"; });
            if (!hasNonBreakPointLines) {
                if (this.checkIfBreakpointWasHitLast(lines)) {
                    this.sendResponseForLastCommand(lastCmd, lines);
                    return;
                }
                if (this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine, lastCmd)) {
                    this.sendResponseForLastCommand(lastCmd, lines);
                    this.outputBuffer = "";
                    return;
                }
                this.sendResponseForLastCommand(lastCmd, lines);
                return;
            }
        }
        var indexToStartFrom = lines.findIndex(function (line) { return line.indexOf("Step completed: ") >= 0; });
        if (indexToStartFrom === -1) {
            return;
        }
        //No need to check if theres an end
        //If we have at least 2 lines for the response, then that's fine 
        // let indexOfEndOfResponse = indexToStartFrom + 2;
        var indexOfEndOfResponse = lines.slice(indexToStartFrom + 1).findIndex(function (line) { return line.indexOf(">") === 0 || STARTS_WITH_THREAD_NAME_REGEX.test(line); });
        if (indexOfEndOfResponse === -1) {
            return;
        }
        indexOfEndOfResponse = indexOfEndOfResponse + indexToStartFrom + 1;
        if (this.checkIfBreakpointWasHitLast(lines)) {
            this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse));
            return;
        }
        if (this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine, lastCmd)) {
            this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse));
            this.outputBuffer = "";
            return;
        }
        if (this.checkIfBreakpointWillBeHit(lines) || this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
            this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse));
            return;
        }
        this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse));
        this.outputBuffer = "";
    };
    JdbRunner.prototype.processContinue = function (lines, lastLine, lastCmd) {
        var indexToStartFrom = lines.findIndex(function (line) { return line.indexOf(">") === 0 || STARTS_WITH_THREAD_NAME_REGEX.test(line); });
        if (indexToStartFrom === -1) {
            return;
        }
        this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexToStartFrom));
        this.checkRestOfTheResponse(lines, lastLine, 0, lines.length - 1, lastCmd);
        if (!this.checkIfBreakpointWillBeHit(lines) && !this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
            this.outputBuffer = "";
        }
    };
    JdbRunner.prototype.processSuspendAndResume = function (lines, lastLine, lastCmd) {
        var textToSearchFor = lastCmd.type === JdbCommandType.Suspend ? "All threads suspended." : "All threads resumed.";
        var indexToStartFrom = lines.findIndex(function (line) { return line.indexOf(textToSearchFor) >= 0; });
        if (indexToStartFrom === -1) {
            return;
        }
        var indexOfEndOfResponse = lines.slice(indexToStartFrom + 1).findIndex(function (line) { return line.indexOf(">") === 0 || STARTS_WITH_THREAD_NAME_REGEX.test(line); });
        if (indexOfEndOfResponse === -1) {
            return;
        }
        this.sendResponseForLastCommand(lastCmd, lines.slice(indexToStartFrom, indexOfEndOfResponse + indexToStartFrom + 1));
        if (this.checkIfBreakpointWasHitLast(lines)) {
            return;
        }
        if (this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine, lastCmd)) {
            this.outputBuffer = "";
            return;
        }
        if (this.checkIfBreakpointWillBeHit(lines) || this.checkIfDebuggerWillStopDueToInvalidBreakPoints(lines)) {
            return;
        }
        this.outputBuffer = "";
    };
    JdbRunner.prototype.processRunCommand = function (lines, lastLine, lastCmd) {
        if (this.runCommandSent && !this.runCommandCompleted && lastCmd.type === JdbCommandType.Run) {
            //This is a tricky one
            //Possible results include:
            //1. The app is running and no breakpoints hit, nothing - code is running 
            //>   
            //2. The debugger has initialized the breakpoint as the code is loaded
            //> Set deferred breakpoint Threading.main
            //Breakpoint hit: "threading=main", Threading.main(), lint=27 bci=0
            //27             CompileFromSockets(101);
            //   
            //3. Breakpoints initialized and running
            //> Set deferred breakpoint MyClientThread:82
            //    
            //Either way all we need to do is wait for the ">" and we know everything is know
            if (lines.length > 0 && lines.some(function (line) { return line.indexOf(">") >= 0; })) {
                // if (this.hasDebuggerStoppedDueToInvalidBreakPoints(lines, lastLine)) {
                //     this.outputBuffer = "";
                //     this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim()
                //     //resend the run command
                //     this.jdbProc.stdin.write("run\n");
                //     return;
                // }
                this.runCommandCompleted = true;
                //Ok strip off the first line from the buffer, the other lines could contain breakpoints being hit (e.g. example 2)
                var indexOfLineBreak = this.outputBuffer.indexOf(os.EOL);
                if (indexOfLineBreak >= 0) {
                    this.outputBuffer = this.outputBuffer.substring(indexOfLineBreak);
                }
                else {
                    this.outputBuffer = "";
                }
                this.sendResponseForLastCommand(lastCmd, [lines[0]]);
                //Another problem now,
                //Now check if we hit a breakpoint
                if (!this.checkIfBreakpointWasHitLast(lines, lastCmd)) {
                    if (lastLine.indexOf("]") > lastLine.indexOf("[")) {
                        this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim();
                    }
                    else {
                        if (lines.length === 1) {
                            this.lastThreadName = "";
                        }
                    }
                }
                //Either a breakpoint wasn't hit or we don't have the complete output from the debugger
                return;
            }
        }
    };
    JdbRunner.prototype.checkIfBreakpointWillBeHit = function (lines) {
        return lines.some(function (line) { return line.indexOf("Breakpoint hit:") >= 0; });
    };
    JdbRunner.prototype.checkIfDebuggerWillStopDueToInvalidBreakPoints = function (lines) {
        return lines.some(function (line) { return line.indexOf("Unable to set deferred breakpoint ") >= 0; }) ||
            lines.some(function (line) { return line.indexOf("Stopping due to deferred breakpoint errors.") >= 0; });
    };
    JdbRunner.prototype.checkIfBreakpointWasHitLast = function (lines, afterCmd) {
        var _this = this;
        var lastLine = lines[lines.length - 1];
        if (IS_THREAD_NAME_REGEX.test(lastLine) && lines.some(function (line) { return line.indexOf("Breakpoint hit:") >= 0; })) {
            this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim();
            if (afterCmd) {
                //If a command has been passed, then raise the event after that command has been resolved
                //I.e. after the sender of the command has handled the response as well
                afterCmd.finalPromise.then(function () {
                    _this.emit("breakpointHit", _this.lastThreadName);
                });
            }
            else {
                this.emit("breakpointHit", this.lastThreadName);
            }
            this.outputBuffer = "";
            return true;
        }
        return false;
    };
    JdbRunner.prototype.checkIfBreakpointWasHit = function (threadName, data, afterCmd) {
        var _this = this;
        //Check if we have hit a breakpoint
        //Breakpoint hit:
        if (data.some(function (line) { return line.indexOf("Breakpoint hit:") >= 0; })) {
            if (afterCmd) {
                //If a command has been passed, then raise the event after that command has been resolved
                afterCmd.finalPromise.then(function () {
                    _this.emit("breakpointHit", threadName);
                });
            }
            else {
                this.emit("breakpointHit", threadName);
            }
            return true;
        }
        return false;
    };
    JdbRunner.prototype.breakIfDebuggerStoppedDueToInvalidBreapoints = function (lines, lastLine, afterCmd) {
        var _this = this;
        if (this.hasDebuggerStoppedDueToInvalidBreakPoints(lines, lastLine)) {
            this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim();
            if (afterCmd) {
                //If a command has been passed, then raise the event after that command has been resolved
                afterCmd.finalPromise.then(function () {
                    _this.emit("debuggerStopInvalidBreakPoints", _this.lastThreadName);
                });
            }
            else {
                this.emit("debuggerStopInvalidBreakPoints", this.lastThreadName);
            }
            this.outputBuffer = "";
            return true;
        }
        return false;
    };
    JdbRunner.prototype.hasDebuggerStoppedDueToInvalidBreakPoints = function (lines, lastLine) {
        var breakPointWillBeHit = this.checkIfBreakpointWillBeHit(lines);
        //if we set invalid breakpoints, then the debugger stops with the message
        //Unable to set deferred breakpoint Threading:85 : No code at line 85 in Threading
        //Stopping due to deferred breakpoint errors.
        //A number of such messages raise
        //Finally this ends with the main thread (generally "main[1]")
        //If this happens, we need to continue processing by running "run" again
        //But do this only if breakpoint has NOT been hit
        if (!breakPointWillBeHit && IS_THREAD_NAME_REGEX.test(lastLine) &&
            lines.some(function (line) { return line.indexOf("Unable to set deferred breakpoint ") >= 0; }) &&
            lines.some(function (line) { return line.indexOf("Stopping due to deferred breakpoint errors.") >= 0; })) {
            //Reset the run command message
            return true;
        }
        return false;
    };
    JdbRunner.prototype.checkRestOfTheResponse = function (lines, lastLine, startIndex, indexOfEndOfResponse, lastCmd) {
        if (this.checkIfBreakpointWasHitLast(lines)) {
            return true;
        }
        if (this.breakIfDebuggerStoppedDueToInvalidBreapoints(lines, lastLine, lastCmd)) {
            this.outputBuffer = "";
            return true;
        }
        if (indexOfEndOfResponse === lines.length - 1 && (lastLine.trim() === ">" || IS_THREAD_NAME_REGEX.test(lastLine))) {
            if (IS_THREAD_NAME_REGEX.test(lastLine)) {
                this.lastThreadName = lastLine.substring(0, lastLine.indexOf("[")).trim();
            }
            this.outputBuffer = "";
            return true;
        }
        //Ok, this means there's more in the message
        //I.e. we have a partial message in the response
        //Find the index of the ">" or the threadName
        var newLines = lines.slice(indexOfEndOfResponse);
        this.outputBuffer = newLines.join(os.EOL);
        return false;
    };
    return JdbRunner;
}(events_1.EventEmitter));
exports.JdbRunner = JdbRunner;
//# sourceMappingURL=jdb.js.map