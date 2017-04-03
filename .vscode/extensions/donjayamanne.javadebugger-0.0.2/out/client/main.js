'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var vscode_debugadapter_1 = require('vscode-debugadapter');
var path = require('path');
var fs = require('fs');
var jdb_1 = require('./jdb');
var contracts_1 = require('./common/contracts');
var LineByLineReader = require('line-by-line');
var namedRegexp = require('named-js-regexp');
var ARRAY_ELEMENT_REGEX = new RegExp("^\\w+.*\\[[0-9]+\\]$");
var JavaDebugSession = (function (_super) {
    __extends(JavaDebugSession, _super);
    function JavaDebugSession(debuggerLinesStartAt1, isServer) {
        _super.call(this, debuggerLinesStartAt1, isServer === true);
        this.commands = [];
        this.fileMapping = new Map();
        this.refreshStackInfo = true;
        this.variableHandles = new vscode_debugadapter_1.Handles();
        this.registeredBreakpointsByFileName = new Map();
    }
    JavaDebugSession.prototype.initializeRequest = function (response, args) {
        this.sendResponse(response);
        // now we are ready to accept breakpoints -> fire the initialized event to give UI a chance to set breakpoints
        this.sendEvent(new vscode_debugadapter_1.InitializedEvent());
    };
    JavaDebugSession.prototype.parseWhere = function (data) {
        if (data.indexOf("[") === -1) {
            return null;
        }
        var currentStack = {};
        var indexOfColon = data.lastIndexOf(":");
        var fileName = "";
        var line = "0";
        var fullFileName = "";
        var functionName = data.substring(data.indexOf("]") + 1, data.lastIndexOf("(")).trim();
        if (indexOfColon > 0 && functionName.indexOf("java.") !== 0) {
            fileName = data.substring(data.lastIndexOf("(") + 1, data.lastIndexOf(":"));
            line = data.substring(data.lastIndexOf(":") + 1, data.lastIndexOf(")"));
            fullFileName = fileName;
            if (this.fileMapping.has(fileName)) {
                fullFileName = this.fileMapping.get(fileName);
            }
            else {
                fullFileName = path.join(this.rootDir, fileName);
                if (fs.existsSync(fullFileName)) {
                    this.fileMapping.set(fileName, fullFileName);
                }
                else {
                    fullFileName = fileName === "null" ? "" : fileName;
                    this.fileMapping.set(fileName, fullFileName);
                    //it is possibly a package
                    var index = functionName.lastIndexOf(".");
                    if (index > 0 && functionName.indexOf(".") < index) {
                        var packageName = functionName.substring(0, index);
                        packageName = path.basename(packageName, path.extname(packageName));
                        var packagePath = packageName.split(".").reduce(function (previousValue, currentValue) { return path.join(previousValue, currentValue); }, "");
                        var packageFileName = path.join(this.rootDir, packagePath, fileName);
                        if (fs.existsSync(packageFileName)) {
                            this.fileMapping.set(fileName, packageFileName);
                            fullFileName = packageFileName;
                        }
                    }
                }
            }
        }
        currentStack.fileName = fullFileName;
        currentStack.lineNumber = parseInt(line);
        currentStack["function"] = functionName;
        currentStack.source = data;
        return currentStack;
    };
    JavaDebugSession.prototype.getThreadId = function (name) {
        var _this = this;
        if (this.threads && this.threads.length > 0) {
            var thread = this.threads.filter(function (t) { return t.Name === name; });
            if (thread.length > 0) {
                return Promise.resolve(thread[0].Id);
            }
        }
        return this.getThreads().then(function (threads) {
            _this.threads = threads;
            var thread = _this.threads.filter(function (t) { return t.Name === name; });
            if (thread.length > 0) {
                return thread[0].Id;
            }
            var thread = _this.threads.filter(function (t) { return t.Name.indexOf(name) === 0; });
            if (thread.length > 0) {
                return thread[0].Id;
            }
            //Error
            return 0;
        });
    };
    JavaDebugSession.prototype.findThread = function (name, threads) {
        if (threads === void 0) { threads = this.threads; }
        var thread = threads.filter(function (t) { return t.Name === name; });
        if (thread.length > 0) {
            return thread[0];
        }
        var thread = this.threads.filter(function (t) { return t.Name.indexOf(name) === 0; });
        if (thread.length > 0) {
            return thread[0];
        }
        return null;
    };
    JavaDebugSession.prototype.launchRequest = function (response, args) {
        var _this = this;
        this.launchResponse = response;
        this.rootDir = args.cwd;
        this.jdbRunner = new jdb_1.JdbRunner(args, this);
        this.jdbRunner.jdbLoaded.then(function () {
            //Ok, now get the thread id for this
            _this.sendResponse(_this.launchResponse);
            // this.sendEvent(new StoppedEvent("entry"));
        }).catch(function (error) {
            var message = { id: -1, format: "", showUser: true };
            if (error instanceof Error) {
                message.format = error.name + ":" + error.message;
            }
            else {
                message.format = error + "";
            }
            _this.sendErrorResponse(response, message);
        });
        this.jdbRunner.Exited.then(function () {
            _this.sendEvent(new vscode_debugadapter_1.TerminatedEvent());
        });
        this.jdbRunner.addListener("breakpointHit", function (threadName) {
            _this.handleBreakPointHit(threadName);
        });
        this.jdbRunner.addListener("debuggerStopInvalidBreakPoints", function (threadName) {
            _this.handleBreakPointHit(threadName, "invalidBreakPoint");
        });
    };
    JavaDebugSession.prototype.getThreads = function () {
        return this.jdbRunner.sendCmd("threads", jdb_1.JdbCommandType.ListThreads).then(function (data) {
            var threads = data.data;
            return threads.map(function (info) {
                info = info.trim();
                if (info.endsWith(":") && info.indexOf("[") === -1) {
                    return null;
                }
                var REGEX = '(?<crap>(\.*))(?<id>0x[0-9A-Fa-f]*)\s*(?<name>.*)';
                var namedRegexp = require('named-js-regexp');
                var rawMatch = namedRegexp(REGEX, "g").exec(info);
                if (rawMatch === null) {
                    return null;
                }
                else {
                    var groups = rawMatch.groups();
                    var name = groups.name.trim();
                    var items = name.split(" ").filter(function (value) { return value.trim().length > 0; });
                    var status = items[items.length - 1];
                    if (name.indexOf("cond. waiting") === name.length - "cond. waiting".length) {
                        name = name.substring(0, name.length - "cond. waiting".length).trim();
                        status = "waiting";
                    }
                    else {
                        if (name.indexOf("running (at breakpoint)") === name.length - "running (at breakpoint)".length) {
                            name = name.substring(0, name.length - "running (at breakpoint)".length).trim();
                            status = "running";
                        }
                        else {
                            name = name.substring(0, name.length - status.length).trim();
                        }
                    }
                    var t = { Frames: [], Id: parseInt(groups.id), HexId: groups.id, Name: name };
                    return t;
                }
            }).filter(function (t) { return t !== null; });
        });
    };
    JavaDebugSession.prototype.getClasseNames = function (filePath, maxLineNumber) {
        return new Promise(function (resolve, reject) {
            fs.exists(filePath, function (exists) {
                if (exists) {
                    resolve();
                }
                else {
                    reject();
                }
            });
        }).then(function () {
            return new Promise(function (resolve, reject) {
                var lr = new LineByLineReader(filePath);
                var shebangLines = [];
                var classNames = [];
                var lineNumber = 0;
                lr.on('error', function (err) {
                    resolve(classNames);
                });
                lr.on('line', function (line) {
                    lineNumber++;
                    if (lineNumber > maxLineNumber) {
                        lr.close();
                        return false;
                    }
                    var REGEX = '.*(?<class>(class))\\s*(?<name>\\w*)\\s*.*';
                    var rawMatch = namedRegexp(REGEX, "g").exec(line);
                    if (rawMatch) {
                        var name = rawMatch.groups().name.trim();
                        if (name.length > 0) {
                            classNames.push(name);
                        }
                    }
                });
                lr.on('end', function () {
                    resolve(classNames);
                });
            });
        }).catch(function () {
            return [];
        });
    };
    JavaDebugSession.prototype.setBreakPoint = function (classNames, line) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            if (classNames.length === 0) {
                return reject();
            }
            var className = classNames.pop();
            _this.jdbRunner.sendCmd("stop at " + className + ":" + line, jdb_1.JdbCommandType.SetBreakpoint).then(function (resp) {
                if (resp.data.length > 0 && resp.data[resp.data.length - 1].indexOf("Unable to set breakpoint") >= 0) {
                    return _this.setBreakPoint(classNames, line);
                }
                else {
                    var verified = resp.data.some(function (value) { return value.indexOf("Set breakpoint") >= 0; });
                    resolve({ className: className, verified: verified });
                }
            });
        });
    };
    JavaDebugSession.prototype.setBreakPointsRequest = function (response, args) {
        var _this = this;
        this.jdbRunner.readyToAcceptBreakPoints.then(function () {
            if (!_this.registeredBreakpointsByFileName.has(args.source.path)) {
                _this.registeredBreakpointsByFileName.set(args.source.path, []);
            }
            var linesWithBreakPointsForFile = _this.registeredBreakpointsByFileName.get(args.source.path);
            var className = path.basename(args.source.path);
            className = className.substring(0, className.length - path.extname(className).length);
            //Add breakpoints for lines that are new
            var newBreakpoints = args.breakpoints.filter(function (bk) { return !linesWithBreakPointsForFile.some(function (item) { return item.line === bk.line; }); });
            var addBreakpoints = newBreakpoints.map(function (bk) {
                return new Promise(function (resolve) {
                    _this.jdbRunner.sendCmd("stop at " + className + ":" + bk.line, jdb_1.JdbCommandType.SetBreakpoint).then(function (resp) {
                        if (resp.data.length > 0 && resp.data.some(function (value) { return value.indexOf("Unable to set breakpoint") >= 0; })) {
                            _this.getClasseNames(args.source.path, bk.line).then(function (classNames) {
                                _this.setBreakPoint(classNames, bk.line)
                                    .then(function (bkResp) {
                                    //Keep track of this valid breakpoint
                                    linesWithBreakPointsForFile.push({ className: bkResp.className, line: bk.line });
                                    resolve({ threadName: resp.threadName, line: bk.line, verified: bkResp.verified });
                                })
                                    .catch(function () { return resolve({ threadName: resp.threadName, line: bk.line, verified: false }); });
                            });
                        }
                        else {
                            var verified = resp.data.some(function (value) { return value.indexOf("Set breakpoint") >= 0; });
                            //Keep track of this valid breakpoint
                            linesWithBreakPointsForFile.push({ className: className, line: bk.line });
                            resolve({ threadName: resp.threadName, line: bk.line, verified: verified });
                        }
                    });
                });
            });
            //Add breakpoints for lines that are new
            var redundantBreakpoints = linesWithBreakPointsForFile.filter(function (bk) { return args.lines.indexOf(bk.line) === -1; });
            var removeBreakpoints = redundantBreakpoints.map(function (bk) {
                return _this.jdbRunner.sendCmd("clear " + bk.className + ":" + bk.line, jdb_1.JdbCommandType.ClearBreakpoint).then(function () { return null; });
            });
            Promise.all(addBreakpoints.concat(removeBreakpoints)).then(function (values) {
                // send back the actual breakpoints
                response.body = {
                    breakpoints: []
                };
                //Re-build the list of valid breakpoints
                //remove the invalid list of breakpoints
                linesWithBreakPointsForFile = linesWithBreakPointsForFile.filter(function (bk) { return !redundantBreakpoints.some(function (rbk) { return rbk.line === bk.line; }); });
                _this.registeredBreakpointsByFileName.set(args.source.path, linesWithBreakPointsForFile);
                //Return the breakpoints
                var unVerifiedBreakpoints = args.breakpoints.filter(function (bk) { return !linesWithBreakPointsForFile.some(function (verifiedBk) { return verifiedBk.line === bk.line; }); });
                unVerifiedBreakpoints.forEach(function (bk) {
                    response.body.breakpoints.push({ verified: false, line: bk.line });
                });
                linesWithBreakPointsForFile.forEach(function (line) {
                    response.body.breakpoints.push({ verified: true, line: line.line });
                });
                _this.sendResponse(response);
            });
        });
    };
    JavaDebugSession.prototype.threadsRequest = function (response) {
        var _this = this;
        var threads = [];
        response.body = {
            threads: threads
        };
        if (!this.jdbRunner.readyToAcceptCommands) {
            this.sendResponse(response);
            return;
        }
        this.jdbRunner.jdbLoaded.then(function () {
            _this.getThreads().then(function (javaThreads) {
                javaThreads.forEach(function (t) {
                    threads.push(new vscode_debugadapter_1.Thread(t.Id, t.Name));
                });
                _this.sendResponse(response);
            });
        });
    };
    JavaDebugSession.prototype.parseStackTrace = function (data) {
        var _this = this;
        var stackInfo = [];
        data.forEach(function (line) {
            if (line.trim().length > 0 && line.indexOf(":") > 0 && line.indexOf("(") > 0) {
                var stack = _this.parseWhere(line);
                if (stack) {
                    stackInfo.push(stack);
                }
            }
        });
        return stackInfo;
    };
    JavaDebugSession.prototype.stackTraceRequest = function (response, args) {
        var _this = this;
        if (!this.jdbRunner.readyToAcceptCommands) {
            return;
        }
        this.determineWhereAll().then(function (threads) {
            response.body = {
                stackFrames: []
            };
            //Find the threadName
            var filteredThreads = threads.filter(function (t) { return t.Id === args.threadId; });
            if (filteredThreads.length === 1) {
                response.body.stackFrames = filteredThreads[0].Frames;
            }
            _this.sendResponse(response);
        });
    };
    JavaDebugSession.prototype.determineWhereAll = function () {
        var _this = this;
        return this.jdbRunner.jdbLoaded.then(function () {
            var whereAllPromise = _this.jdbRunner.sendCmd("where all", jdb_1.JdbCommandType.ListStack).then(function (resp) {
                var whereAll = resp.data;
                var currentThread = null;
                //check if we have any stacks for threads that we don't know about
                var missingThreadCount = whereAll.filter(function (where) {
                    where = where.trim();
                    if (!where.startsWith("[") && where.endsWith(":")) {
                        var threadName = where.substring(0, where.length - 1);
                        currentThread = _this.findThread(threadName);
                        return currentThread === null;
                    }
                    return false;
                }).length;
                var getThreadsPromise = Promise.resolve(_this.threads);
                if (missingThreadCount > 0) {
                    getThreadsPromise = _this.getThreads();
                }
                return getThreadsPromise.then(function (threads) {
                    //Clear all of the previous stacks if there are any
                    threads.forEach(function (t) { return t.Frames = []; });
                    whereAll.forEach(function (where) {
                        where = where.trim();
                        if (!where.startsWith("[") && where.endsWith(":")) {
                            var threadName = where.substring(0, where.length - 1);
                            currentThread = _this.findThread(threadName, threads);
                            return;
                        }
                        if (currentThread === null) {
                            return;
                        }
                        var stackInfo = _this.parseWhere(where);
                        if (stackInfo === null) {
                            return;
                        }
                        var i = currentThread.Frames.length;
                        var name = stackInfo.function;
                        currentThread.Frames.push(new vscode_debugadapter_1.StackFrame(i, name + "(" + i + ")", new vscode_debugadapter_1.Source(stackInfo.fileName, stackInfo.fileName.length === 0 ? "" : _this.convertDebuggerPathToClient(stackInfo.fileName)), stackInfo.lineNumber === 0 ? 0 : _this.convertDebuggerLineToClient(stackInfo.lineNumber - 1), 0));
                    });
                    return threads;
                });
            });
            return whereAllPromise;
        });
    };
    JavaDebugSession.prototype.getVariableValue = function (variableName) {
        var printedPromise = this.jdbRunner.sendCmd("print " + variableName, jdb_1.JdbCommandType.Print).then(function (resp) {
            var data = resp.data;
            if (data.length === 0 || data[0].length === 0) {
                throw "Invalid";
            }
            if (data.length === 2 && !data[0].startsWith(variableName) && data[0].indexOf("Exception: ") >= 0) {
                throw data[0];
            }
            var variablePrintedValue = data.join("");
            return variablePrintedValue.substring(variablePrintedValue.indexOf(" " + variableName + " = ") + (" " + variableName + " = ").length);
        });
        var dumpPromise = this.jdbRunner.sendCmd("dump " + variableName, jdb_1.JdbCommandType.Dump).then(function (resp) {
            var data = resp.data;
            if (data.length === 0 || data[0].length === 0) {
                throw "Invalid";
            }
            if (data.length === 2 && !data[0].startsWith(variableName) && data[0].indexOf("Exception: ") >= 0) {
                throw data[0];
            }
            data[0] = data[0].substring(data[0].indexOf(" " + variableName + " = ") + (" " + variableName + " = ").length);
            return [data.join(""), data];
        });
        return Promise.all([printedPromise, dumpPromise]).then(function (values) {
            var stringValues = values;
            return { printedValue: stringValues[0], dumpValue: stringValues[1][0], dumpLines: values[1][1] };
        });
    };
    JavaDebugSession.prototype.isComplexObject = function (value) {
        value = value.trim();
        return (value.startsWith("{") && value.endsWith("}")) ||
            (value.startsWith("instance of ") && value.indexOf("]") > value.indexOf("["));
    };
    JavaDebugSession.prototype.isArray = function (printValue, value) {
        if ((value.startsWith("{") && value.endsWith("}")) &&
            (printValue.trim().startsWith("instance of ") && printValue.indexOf("]") > printValue.indexOf("["))) {
            return printValue.substring(printValue.lastIndexOf("]") + 1).trim().startsWith("(");
        }
        return false;
    };
    JavaDebugSession.prototype.addScopeAndVariables = function (scopes, scopeName, values) {
        var _this = this;
        var variables = { evaluateChildren: false, variables: [] };
        var promises = values.map(function (argAndValue) {
            if (argAndValue.indexOf(" = ") === -1) {
                return Promise.resolve();
            }
            var variableName = argAndValue.substring(0, argAndValue.indexOf("=")).trim();
            return _this.getVariableValue(variableName).then(function (value) {
                var isComplex = _this.isComplexObject(value.printedValue) || _this.isComplexObject(value.dumpValue);
                variables.variables.push({
                    StringRepr: value.printedValue,
                    ChildName: "",
                    ExceptionText: "",
                    Expression: variableName,
                    Flags: isComplex ? contracts_1.JavaEvaluationResultFlags.Expandable : contracts_1.JavaEvaluationResultFlags.Raw,
                    Frame: null,
                    IsExpandable: isComplex,
                    Length: 0,
                    TypeName: "string",
                    DumpRepr: value.dumpValue,
                    DumpLines: value.dumpLines
                });
            }).catch(function (ex) {
                //swallow exception
                variables.variables.push({
                    StringRepr: ex,
                    ChildName: "",
                    ExceptionText: "",
                    Expression: variableName,
                    Flags: contracts_1.JavaEvaluationResultFlags.Raw,
                    Frame: null,
                    IsExpandable: false,
                    Length: 0,
                    TypeName: "string",
                    DumpRepr: ex,
                    DumpLines: [ex]
                });
            });
        });
        return Promise.all(promises).then(function () {
            scopes.push(new vscode_debugadapter_1.Scope(scopeName, _this.variableHandles.create(variables), false));
        });
    };
    JavaDebugSession.prototype.scopesRequest = function (response, args) {
        var _this = this;
        this.jdbRunner.jdbLoaded.then(function () {
            var scopes = [];
            response.body = { scopes: scopes };
            _this.jdbRunner.sendCmd("locals", jdb_1.JdbCommandType.Locals).then(function (resp) {
                var data = resp.data;
                if (data.length === 0 || data.length === 1) {
                    _this.sendResponse(response);
                    return;
                }
                //Parse the variables
                var startIndexOfMethodArgs = data.findIndex(function (line) { return line.endsWith("Method arguments:"); });
                var startIndexOfLocalVariables = data.findIndex(function (line) { return line.endsWith("Local variables:"); });
                var argsPromise = Promise.resolve();
                if (startIndexOfMethodArgs >= 0) {
                    var args = data.filter(function (line, index) { return index >= startIndexOfMethodArgs && index < startIndexOfLocalVariables; });
                    argsPromise = _this.addScopeAndVariables(scopes, "Arguments", args);
                }
                var varsPromise = Promise.resolve();
                if (startIndexOfLocalVariables >= 0) {
                    var args = data.filter(function (line, index) { return index >= startIndexOfLocalVariables; });
                    varsPromise = _this.addScopeAndVariables(scopes, "Locals", args);
                }
                Promise.all([argsPromise, varsPromise]).then(function () { return _this.sendResponse(response); });
            });
        });
    };
    JavaDebugSession.prototype.getArrayValues = function (dumpRepr, parentExpression) {
        var _this = this;
        //Split by commas
        var value = dumpRepr.trim().substring(1);
        value = value.substring(0, value.length - 1);
        return value.split(", ").map(function (item, index) {
            var variable = {
                StringRepr: item,
                ChildName: "[" + index + "]",
                ExceptionText: "",
                Expression: parentExpression + "[" + index + "]",
                Flags: _this.isComplexObject(item) ? contracts_1.JavaEvaluationResultFlags.Expandable : contracts_1.JavaEvaluationResultFlags.Raw,
                Frame: null,
                IsExpandable: _this.isComplexObject(item),
                Length: 0,
                TypeName: "string",
                DumpRepr: item,
                DumpLines: []
            };
            var variablesReference = 0;
            //If this value can be expanded, then create a vars ref for user to expand it
            if (variable.IsExpandable) {
                var parentVariable = {
                    variables: [variable],
                    evaluateChildren: true
                };
                variablesReference = _this.variableHandles.create(parentVariable);
            }
            return {
                name: variable.ChildName,
                value: variable.StringRepr,
                variablesReference: variablesReference
            };
        });
    };
    JavaDebugSession.prototype.variablesRequest = function (response, args) {
        var _this = this;
        if (this.paused === true) {
            response.body = {
                variables: []
            };
            this.sendResponse(response);
            return;
        }
        var varRef = this.variableHandles.get(args.variablesReference);
        if (varRef.evaluateChildren === true) {
            var parentVariable = varRef.variables[0];
            if (this.isArray(parentVariable.StringRepr, parentVariable.DumpRepr)) {
                var variables = this.getArrayValues(parentVariable.DumpRepr, parentVariable.Expression);
                response.body = {
                    variables: variables
                };
                this.sendResponse(response);
            }
            else {
                if (!ARRAY_ELEMENT_REGEX.test(parentVariable.Expression)) {
                    //this.isComplexObject(parentVariable.DumpRepr) && parentVariable.StringRepr.indexOf("@") > 0) {
                    var variables_1 = [];
                    var promises = parentVariable.DumpLines.map(function (propertyLine) {
                        if (propertyLine.trim().length === 1) {
                            return Promise.resolve();
                        }
                        var propertyName = propertyLine.substring(0, propertyLine.indexOf(":")).trim();
                        propertyName = propertyName.substring(propertyName.lastIndexOf(".") + 1).trim();
                        var value = propertyLine.substring(propertyLine.indexOf(":") + 2);
                        var expr = parentVariable.Expression + "." + propertyName;
                        return _this.getVariableValue(expr).then(function (values) {
                            var isComplex = _this.isComplexObject(values.printedValue) || _this.isComplexObject(values.dumpValue);
                            var variable = {
                                StringRepr: values.printedValue,
                                ChildName: propertyName,
                                ExceptionText: "",
                                Expression: expr,
                                Flags: isComplex ? contracts_1.JavaEvaluationResultFlags.Expandable : contracts_1.JavaEvaluationResultFlags.Raw,
                                Frame: null,
                                IsExpandable: isComplex,
                                Length: 0,
                                TypeName: "string",
                                DumpRepr: values.dumpValue,
                                DumpLines: values.dumpLines
                            };
                            var variablesReference = 0;
                            //If this value can be expanded, then create a vars ref for user to expand it
                            if (variable.IsExpandable) {
                                var parentVariable_1 = {
                                    variables: [variable],
                                    evaluateChildren: true
                                };
                                variablesReference = _this.variableHandles.create(parentVariable_1);
                            }
                            variables_1.push({
                                name: variable.ChildName,
                                value: variable.StringRepr,
                                variablesReference: variablesReference
                            });
                        }).catch(function (ex) {
                            var variable = {
                                StringRepr: ex,
                                ChildName: propertyName,
                                ExceptionText: "",
                                Expression: expr,
                                Flags: contracts_1.JavaEvaluationResultFlags.Raw,
                                Frame: null,
                                IsExpandable: false,
                                Length: 0,
                                TypeName: "string",
                                DumpRepr: ex,
                                DumpLines: [ex]
                            };
                            var variablesReference = 0;
                            //If this value can be expanded, then create a vars ref for user to expand it
                            if (variable.IsExpandable) {
                                var parentVariable_2 = {
                                    variables: [variable],
                                    evaluateChildren: false
                                };
                                variablesReference = _this.variableHandles.create(parentVariable_2);
                            }
                            variables_1.push({
                                name: variable.ChildName,
                                value: variable.StringRepr,
                                variablesReference: variablesReference
                            });
                        });
                    });
                    Promise.all(promises).then(function () {
                        response.body = {
                            variables: variables_1
                        };
                        _this.sendResponse(response);
                    });
                    return;
                }
                else {
                    var variables_2 = [];
                    this.getVariableValue(parentVariable.Expression).then(function (values) {
                        if (_this.isArray(values.printedValue, values.dumpValue)) {
                            variables_2 = _this.getArrayValues(values.dumpValue, parentVariable.Expression);
                            return;
                        }
                        //TODO: Certain this is wrong and will need clean up (leaving for later due to lack of time)
                        //Worst case user will have to expan again (yuck, but works, till then TODO)
                        var isComplex = _this.isComplexObject(values.printedValue) || _this.isComplexObject(values.dumpValue);
                        var variable = {
                            StringRepr: values.printedValue,
                            ChildName: parentVariable.Expression,
                            ExceptionText: "",
                            Expression: parentVariable.Expression,
                            Flags: isComplex ? contracts_1.JavaEvaluationResultFlags.Expandable : contracts_1.JavaEvaluationResultFlags.Raw,
                            Frame: null,
                            IsExpandable: isComplex,
                            Length: 0,
                            TypeName: "string",
                            DumpRepr: values.dumpValue,
                            DumpLines: values.dumpLines
                        };
                        var variablesReference = 0;
                        //If this value can be expanded, then create a vars ref for user to expand it
                        if (variable.IsExpandable) {
                            var parentVariable_3 = {
                                variables: [variable],
                                evaluateChildren: true
                            };
                            variablesReference = _this.variableHandles.create(parentVariable_3);
                        }
                        variables_2.push({
                            name: variable.ChildName,
                            value: variable.StringRepr,
                            variablesReference: variablesReference
                        });
                    }).catch(function (ex) {
                        //TODO: DRY
                        var variable = {
                            StringRepr: ex,
                            ChildName: parentVariable.Expression,
                            ExceptionText: "",
                            Expression: parentVariable.Expression,
                            Flags: contracts_1.JavaEvaluationResultFlags.Raw,
                            Frame: null,
                            IsExpandable: false,
                            Length: 0,
                            TypeName: "string",
                            DumpRepr: ex,
                            DumpLines: [ex]
                        };
                        var variablesReference = 0;
                        //If this value can be expanded, then create a vars ref for user to expand it
                        if (variable.IsExpandable) {
                            var parentVariable_4 = {
                                variables: [variable],
                                evaluateChildren: false
                            };
                            variablesReference = _this.variableHandles.create(parentVariable_4);
                        }
                        variables_2.push({
                            name: variable.ChildName,
                            value: variable.StringRepr,
                            variablesReference: variablesReference
                        });
                    }).then(function () {
                        response.body = {
                            variables: variables_2
                        };
                        _this.sendResponse(response);
                    });
                    return;
                }
            }
        }
        else {
            var variables_3 = [];
            varRef.variables.forEach(function (variable) {
                var variablesReference = 0;
                //If this value can be expanded, then create a vars ref for user to expand it
                if (variable.IsExpandable) {
                    var parentVariable_5 = {
                        variables: [variable],
                        evaluateChildren: true
                    };
                    variablesReference = _this.variableHandles.create(parentVariable_5);
                }
                variables_3.push({
                    name: variable.Expression,
                    value: variable.StringRepr,
                    variablesReference: variablesReference
                });
            });
            response.body = {
                variables: variables_3
            };
            return this.sendResponse(response);
        }
    };
    JavaDebugSession.prototype.stepInRequest = function (response) {
        var _this = this;
        if (!this.jdbRunner.readyToAcceptCommands) {
            return;
        }
        if (this.paused === true) {
            this.sendErrorResponse(response, 2000, "Command unsupported while threads have been suspended/paused");
            return;
        }
        this.sendResponse(response);
        this.jdbRunner.sendCmd("step", jdb_1.JdbCommandType.Step).then(function (resp) {
            _this.getThreadId(resp.threadName).then(function (id) {
                _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("step", id));
            });
        });
    };
    JavaDebugSession.prototype.stepOutRequest = function (response) {
        var _this = this;
        if (this.paused === true) {
            this.sendErrorResponse(response, 2000, "Command unsupported while threads have been suspended/paused");
            return;
        }
        this.sendResponse(response);
        this.jdbRunner.sendCmd("step up", jdb_1.JdbCommandType.StepUp).then(function (resp) {
            _this.getThreadId(resp.threadName).then(function (id) {
                _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("step up", id));
            });
        });
    };
    JavaDebugSession.prototype.handleBreakPointHit = function (threadName, eventName) {
        var _this = this;
        if (eventName === void 0) { eventName = "breakpoint"; }
        this.getThreadId(threadName).then(function (id) {
            _this.sendEvent(new vscode_debugadapter_1.StoppedEvent(eventName, id));
        });
    };
    JavaDebugSession.prototype.disconnectRequest = function (response, args) {
        this.sendResponse(response);
        this.jdbRunner.sendCmd("exit", jdb_1.JdbCommandType.Exit);
    };
    JavaDebugSession.prototype.continueRequest = function (response, args) {
        var _this = this;
        this.sendResponse(response);
        var cmd = "";
        var cmdType;
        if (this.paused) {
            cmd = "resume";
            cmdType = jdb_1.JdbCommandType.Resume;
        }
        else {
            cmd = "cont";
            cmdType = jdb_1.JdbCommandType.Continue;
        }
        this.jdbRunner.sendCmd(cmd, cmdType).then(function () {
            _this.paused = false;
        });
        ;
    };
    JavaDebugSession.prototype.nextRequest = function (response, args) {
        var _this = this;
        if (this.paused === true) {
            this.sendErrorResponse(response, 2000, "Command unsupported while threads have been suspended/paused");
            return;
        }
        this.sendResponse(response);
        this.jdbRunner.sendCmd("next", jdb_1.JdbCommandType.Next).then(function (resp) {
            _this.getThreadId(resp.threadName).then(function (id) {
                _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("next", id));
            });
        });
    };
    JavaDebugSession.prototype.evaluateRequest = function (response, args) {
        var _this = this;
        this.jdbRunner.jdbLoaded.then(function () {
            _this.getVariableValue(args.expression).then(function (value) {
                var isComplex = _this.isComplexObject(value.printedValue) || _this.isComplexObject(value.dumpValue);
                var variables = { evaluateChildren: true, variables: [] };
                variables.variables.push({
                    StringRepr: value.printedValue,
                    ChildName: "",
                    ExceptionText: "",
                    Expression: args.expression,
                    Flags: isComplex ? contracts_1.JavaEvaluationResultFlags.Expandable : contracts_1.JavaEvaluationResultFlags.Raw,
                    Frame: null,
                    IsExpandable: isComplex,
                    Length: 0,
                    TypeName: "string",
                    DumpRepr: value.dumpValue,
                    DumpLines: value.dumpLines
                });
                response.body = {
                    result: value.printedValue,
                    variablesReference: isComplex ? _this.variableHandles.create(variables) : 0
                };
                _this.sendResponse(response);
            }).catch(function (error) {
                _this.sendErrorResponse(response, 2000, error);
            });
        });
    };
    JavaDebugSession.prototype.pauseRequest = function (response) {
        var _this = this;
        this.sendResponse(response);
        this.jdbRunner.sendCmd("suspend", jdb_1.JdbCommandType.Suspend).then(function (resp) {
            _this.paused = true;
            _this.getThreadId(resp.threadName).then(function (id) {
                _this.sendEvent(new vscode_debugadapter_1.StoppedEvent("suspend", id));
            });
        });
    };
    JavaDebugSession.prototype.setExceptionBreakPointsRequest = function (response, args) {
        // console.error('Not yet implemented: setExceptionBreakPointsRequest');
        this.sendErrorResponse(response, 2000, "ExceptionBreakPointsRequest is not yet supported");
    };
    return JavaDebugSession;
}(vscode_debugadapter_1.DebugSession));
vscode_debugadapter_1.DebugSession.run(JavaDebugSession);
//# sourceMappingURL=main.js.map