"use strict";
const vscode_1 = require("vscode");
const child_process_1 = require("child_process");
const fs = require("fs");
const path = require("path");
let fileUrl = require("file-url");
function activate(context) {
    let provider = new RstDocumentContentProvider(context);
    let registration = vscode_1.workspace.registerTextDocumentContentProvider("restructuredtext", provider);
    let d1 = vscode_1.commands.registerCommand("restructuredtext.showPreview", showPreview);
    let d2 = vscode_1.commands.registerCommand("restructuredtext.showPreviewToSide", uri => showPreview(uri, true));
    let d3 = vscode_1.commands.registerCommand("restructuredtext.showSource", showSource);
    context.subscriptions.push(d1, d2, registration);
    vscode_1.workspace.onDidSaveTextDocument(document => {
        if (isRstFile(document)) {
            const uri = getRstUri(document.uri);
            provider.update(uri);
        }
    });
    let updateOnTextChanged = RstDocumentContentProvider.absoluteConfiguredPath("updateOnTextChanged", "true");
    if (updateOnTextChanged === 'true') {
        vscode_1.workspace.onDidChangeTextDocument(event => {
            if (isRstFile(event.document)) {
                const uri = getRstUri(event.document.uri);
                provider.update(uri);
            }
        });
    }
    vscode_1.workspace.onDidChangeConfiguration(() => {
        vscode_1.workspace.textDocuments.forEach(document => {
            if (document.uri.scheme === 'restructuredtext') {
                // update all generated md documents
                provider.update(document.uri);
            }
        });
    });
}
exports.activate = activate;
function isRstFile(document) {
    return document.languageId === 'restructuredtext'
        && document.uri.scheme !== 'restructuredtext'; // prevent processing of own documents
}
function getRstUri(uri) {
    return uri.with({ scheme: 'restructuredtext', path: uri.path + '.rendered', query: uri.toString() });
}
function showPreview(uri, sideBySide = false) {
    let resource = uri;
    if (!(resource instanceof vscode_1.Uri)) {
        if (vscode_1.window.activeTextEditor) {
            // we are relaxed and don't check for markdown files
            resource = vscode_1.window.activeTextEditor.document.uri;
        }
    }
    if (!(resource instanceof vscode_1.Uri)) {
        if (!vscode_1.window.activeTextEditor) {
            // this is most likely toggling the preview
            return vscode_1.commands.executeCommand('restructuredtext.showSource');
        }
        // nothing found that could be shown or toggled
        return;
    }
    let thenable = vscode_1.commands.executeCommand('vscode.previewHtml', getRstUri(resource), getViewColumn(sideBySide), `Preview '${path.basename(resource.fsPath)}'`);
    return thenable;
}
function getViewColumn(sideBySide) {
    const active = vscode_1.window.activeTextEditor;
    if (!active) {
        return vscode_1.ViewColumn.One;
    }
    if (!sideBySide) {
        return active.viewColumn;
    }
    switch (active.viewColumn) {
        case vscode_1.ViewColumn.One:
            return vscode_1.ViewColumn.Two;
        case vscode_1.ViewColumn.Two:
            return vscode_1.ViewColumn.Three;
    }
    return active.viewColumn;
}
function showSource(mdUri) {
    if (!mdUri) {
        return vscode_1.commands.executeCommand('workbench.action.navigateBack');
    }
    const docUri = vscode_1.Uri.parse(mdUri.query);
    for (let editor of vscode_1.window.visibleTextEditors) {
        if (editor.document.uri.toString() === docUri.toString()) {
            return vscode_1.window.showTextDocument(editor.document, editor.viewColumn);
        }
    }
    return vscode_1.workspace.openTextDocument(docUri).then(doc => {
        return vscode_1.window.showTextDocument(doc);
    });
}
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
class RstDocumentContentProvider {
    constructor(context) {
        this._onDidChange = new vscode_1.EventEmitter();
        this._context = context;
        this._waiting = false;
        this._containerPath = RstDocumentContentProvider.absoluteConfiguredPath("makefilePath", ".");
    }
    provideTextDocumentContent(uri) {
        return this.createRstSnippet();
    }
    get onDidChange() {
        return this._onDidChange.event;
    }
    update(uri) {
        if (!this._waiting) {
            this._waiting = true;
            setTimeout(() => {
                this._waiting = false;
                this._onDidChange.fire(uri);
            }, 300);
        }
    }
    createRstSnippet() {
        let editor = vscode_1.window.activeTextEditor;
        if (!(editor.document.languageId === "restructuredtext")) {
            return this.errorSnippet("Active editor doesn't show a reStructuredText document - no properties to preview.");
        }
        return this.preview(editor);
    }
    errorSnippet(error) {
        return `
                <body>
                    ${error}
                </body>`;
    }
    fixLinks(document, documentPath) {
        return document.replace(new RegExp("((?:src|href)=[\'\"])(.*?)([\'\"])", "gmi"), (subString, p1, p2, p3) => {
            return [
                p1,
                fileUrl(path.join(path.dirname(documentPath), p2)),
                p3
            ].join("");
        });
    }
    /**
     * Return absolute path for passed *configSection* driven path.
     *
     * If *configSection* value not defined then use *defaultValue instead when
     * computing absolute path.
     */
    static absoluteConfiguredPath(configSection, defaultValue) {
        let root = vscode_1.workspace.rootPath;
        return path.join(root, vscode_1.workspace.getConfiguration("restructuredtext").get(configSection, defaultValue));
    }
    relativeDocumentationPath(whole) {
        return whole.substring(this._containerPath.length);
    }
    preview(editor) {
        // Calculate full path to built html file.
        let whole = editor.document.fileName;
        let ext = whole.lastIndexOf(".");
        whole = whole.substring(0, ext) + ".html";
        let root = this._containerPath;
        let htmlFolder = RstDocumentContentProvider.absoluteConfiguredPath("builtDocumentationPath", "_build/html");
        let finalName = path.join(htmlFolder, this.relativeDocumentationPath(whole));
        // Display file.
        return new Promise((resolve, reject) => {
            let cmd = [
                "make",
                "html"
            ].join(" ");
            child_process_1.exec(cmd, { cwd: root }, (error, stdout, stderr) => {
                if (error) {
                    let errorMessage = [
                        error.name,
                        error.message,
                        error.stack,
                        "",
                        stderr.toString()
                    ].join("\n");
                    console.error(errorMessage);
                    reject(errorMessage);
                    return;
                }
                if (process.platform === "win32" && stderr) {
                    let errorMessage = stderr.toString();
                    if (errorMessage.indexOf("Exception occurred:") > -1) {
                        console.error(errorMessage);
                        reject(errorMessage);
                        return;
                    }
                }
                fs.stat(finalName, (error, stat) => {
                    if (error !== null) {
                        let errorMessage = [
                            error.name,
                            error.message,
                            error.stack
                        ].join("\n");
                        console.error(errorMessage);
                        reject(errorMessage);
                        return;
                    }
                    fs.readFile(finalName, "utf8", (err, data) => {
                        if (err === null) {
                            let fixed = this.fixLinks(data, finalName);
                            resolve(fixed);
                        }
                        else {
                            let errorMessage = [
                                err.name,
                                err.message,
                                err.stack
                            ].join("\n");
                            console.error(errorMessage);
                            reject(errorMessage);
                        }
                    });
                });
            });
        });
    }
}
//# sourceMappingURL=extension.js.map