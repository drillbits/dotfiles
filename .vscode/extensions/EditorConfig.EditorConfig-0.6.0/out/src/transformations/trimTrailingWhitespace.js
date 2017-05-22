Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
/**
 * Returns an array of `TextEdit` objects that will trim the
 * trailing whitespace of each line.
 */
function transform(editorconfig, textDocument) {
    const editorTrimsWhitespace = vscode_1.workspace
        .getConfiguration('files')
        .get('trimTrailingWhitespace', false);
    if (editorTrimsWhitespace) {
        if (editorconfig.trim_trailing_whitespace === false) {
            vscode_1.window.showWarningMessage([
                'The trimTrailingWhitespace workspace or user setting is',
                'overriding the EditorConfig setting for this file.'
            ].join(' '));
        }
        return [];
    }
    if (!editorconfig.trim_trailing_whitespace) {
        return [];
    }
    const trimmingOperations = [];
    for (let i = 0; i < textDocument.lineCount; i++) {
        const edit = trimLineTrailingWhitespace(textDocument.lineAt(i));
        if (edit) {
            trimmingOperations.push(edit);
        }
    }
    return trimmingOperations;
}
exports.transform = transform;
function trimLineTrailingWhitespace(line) {
    const trimmedLine = trimTrailingWhitespace(line.text);
    if (trimmedLine === line.text) {
        return;
    }
    const whitespaceBegin = new vscode_1.Position(line.lineNumber, trimmedLine.length);
    const whitespaceEnd = new vscode_1.Position(line.lineNumber, line.text.length);
    const whitespace = new vscode_1.Range(whitespaceBegin, whitespaceEnd);
    return vscode_1.TextEdit.delete(whitespace);
}
function trimTrailingWhitespace(input) {
    return input.replace(/[\s\uFEFF\xA0]+$/g, '');
}
//# sourceMappingURL=trimTrailingWhitespace.js.map