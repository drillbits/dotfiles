'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var VSCode = require("vscode");
var Path = require("path");
var FS = require("fs");
var PortFinder = require("portfinder");
var Net = require("net");
var ChildProcess = require("child_process");
var vscode_languageclient_1 = require("vscode-languageclient");
/** Called when extension is activated */
function activate(context) {
    var javaExecutablePath = findJavaExecutable('java');
    if (javaExecutablePath == null) {
        VSCode.window.showErrorMessage("Couldn't locate java in $JAVA_HOME or $PATH");
        return;
    }
    isJava8(javaExecutablePath).then(function (eight) {
        if (!eight) {
            VSCode.window.showErrorMessage('Java language support requires Java 8 (using ' + javaExecutablePath + ')');
            return;
        }
        // Options to control the language client
        var clientOptions = {
            // Register the server for java documents
            documentSelector: ['java'],
            synchronize: {
                // Synchronize the setting section 'java' to the server
                // NOTE: this currently doesn't do anything
                configurationSection: 'java',
                // Notify the server about file changes to 'javaconfig.json' files contain in the workspace
                fileEvents: [
                    VSCode.workspace.createFileSystemWatcher('**/javaconfig.json'),
                    VSCode.workspace.createFileSystemWatcher('**/*.java')
                ]
            },
            outputChannelName: 'Java',
            revealOutputChannelOn: 3
        };
        function createServer() {
            return new Promise(function (resolve, reject) {
                PortFinder.getPort({ port: 55282 }, function (err, port) {
                    var fatJar = Path.resolve(context.extensionPath, "out", "fat-jar.jar");
                    var args = [
                        '-cp', fatJar,
                        '-Djavacs.port=' + port,
                        'org.javacs.Main'
                    ];
                    console.log(javaExecutablePath + ' ' + args.join(' '));
                    Net.createServer(function (socket) {
                        console.log('Child process connected on port ' + port);
                        resolve({
                            reader: socket,
                            writer: socket
                        });
                    }).listen(port, function () {
                        var options = { stdio: 'inherit', cwd: VSCode.workspace.rootPath };
                        // Start the child java process
                        ChildProcess.execFile(javaExecutablePath, args, options);
                    });
                });
            });
        }
        // Create the language client and start the client.
        var client = new vscode_languageclient_1.LanguageClient('Language Server Example', createServer, clientOptions);
        var disposable = client.start();
        // Push the disposable to the context's subscriptions so that the 
        // client can be deactivated on extension deactivation
        context.subscriptions.push(disposable);
        // Set indentation rules
        VSCode.languages.setLanguageConfiguration('java', {
            indentationRules: {
                // ^(.*\*/)?\s*\}.*$
                decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
                // ^.*\{[^}"']*$
                increaseIndentPattern: /^.*\{[^}"']*$/
            },
            wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
            comments: {
                lineComment: '//',
                blockComment: ['/*', '*/']
            },
            brackets: [
                ['{', '}'],
                ['[', ']'],
                ['(', ')'],
            ],
            onEnterRules: [
                {
                    // e.g. /** | */
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    afterText: /^\s*\*\/$/,
                    action: { indentAction: VSCode.IndentAction.IndentOutdent, appendText: ' * ' }
                },
                {
                    // e.g. /** ...|
                    beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                    action: { indentAction: VSCode.IndentAction.None, appendText: ' * ' }
                },
                {
                    // e.g.  * ...|
                    beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                    action: { indentAction: VSCode.IndentAction.None, appendText: '* ' }
                },
                {
                    // e.g.  */|
                    beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                    action: { indentAction: VSCode.IndentAction.None, removeText: 1 }
                }
            ],
        });
    });
}
exports.activate = activate;
function isJava8(javaExecutablePath) {
    return new Promise(function (resolve, reject) {
        var result = ChildProcess.execFile(javaExecutablePath, ['-version'], {}, function (error, stdout, stderr) {
            var eight = stderr.indexOf('1.8') >= 0;
            resolve(eight);
        });
    });
}
function findJavaExecutable(binname) {
    binname = correctBinname(binname);
    // First search each JAVA_HOME bin folder
    if (process.env['JAVA_HOME']) {
        var workspaces = process.env['JAVA_HOME'].split(Path.delimiter);
        for (var i = 0; i < workspaces.length; i++) {
            var binpath = Path.join(workspaces[i], 'bin', binname);
            if (FS.existsSync(binpath)) {
                return binpath;
            }
        }
    }
    // Then search PATH parts
    if (process.env['PATH']) {
        var pathparts = process.env['PATH'].split(Path.delimiter);
        for (var i = 0; i < pathparts.length; i++) {
            var binpath = Path.join(pathparts[i], binname);
            if (FS.existsSync(binpath)) {
                return binpath;
            }
        }
    }
    // Else return the binary name directly (this will likely always fail downstream) 
    return null;
}
function correctBinname(binname) {
    if (process.platform === 'win32')
        return binname + '.exe';
    else
        return binname;
}
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=Main.js.map