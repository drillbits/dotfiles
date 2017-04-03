/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var path = require('path');
var completionProvider_1 = require('./features/completionProvider');
var signatureHelpProvider_1 = require('./features/signatureHelpProvider');
var commandProvider_1 = require('./features/commandProvider');
var vscode = require('vscode');
var vscode_1 = require('vscode');
var vscode_languageclient_1 = require('vscode-languageclient');
function activate(context) {
    // The server is implemented in node
    var serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
    // The debug options for the server
    var debugOptions = { execArgv: ["--nolazy", "--debug=6004"] };
    // If the extension is launch in debug mode the debug server options are use
    // Otherwise the run options are used
    var serverOptions = {
        run: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc },
        debug: { module: serverModule, transport: vscode_languageclient_1.TransportKind.ipc, options: debugOptions }
    };
    // Options to control the language client
    var clientOptions = {
        documentSelector: ['pgsql'],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            configurationSection: 'languageServerExample',
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode_1.workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    // Create the language client and start the client.
    var disposable = new vscode_languageclient_1.LanguageClient('Language Server Example', serverOptions, clientOptions).start();
    // Push the disposable to the context's subscriptions so that the 
    // client can be deactivated on extension deactivation 
    var validator = new commandProvider_1.default();
    validator.activate(context.subscriptions);
    context.subscriptions.push(vscode.commands.registerCommand('postgres.executeSql', function () {
        validator.execFile();
    }));
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(['pgsql'], new completionProvider_1.default(), '.', ' '));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider('pgsql', new signatureHelpProvider_1.default(), '(', ','));
    context.subscriptions.push(disposable);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map