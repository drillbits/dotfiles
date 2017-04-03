"use strict";
var vscode = require('vscode');
var xmlFormatter = require('./xmlFormatter');
function activate(context) {
    // whole document formatting
    context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider({ language: 'xml' }, {
        provideDocumentFormattingEdits: function (document, options) {
            return xmlFormatter.XmlFormatter.format(document, undefined, options);
        }
    }));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map