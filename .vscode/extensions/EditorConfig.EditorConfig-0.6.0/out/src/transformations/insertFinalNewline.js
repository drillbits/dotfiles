Object.defineProperty(exports, "__esModule", { value: true });
const get = require("lodash.get");
const vscode_1 = require("vscode");
const lineEndings = {
    cr: '\r',
    crlf: '\r\n',
    lf: '\n'
};
/**
 * Returns an array of `TextEdit` objects that will insert
 * a final newline.
 */
function transform(editorconfig, textDocument) {
    const lineCount = textDocument.lineCount;
    const lastLine = textDocument.lineAt(lineCount - 1);
    if (!editorconfig.insert_final_newline
        || lineCount === 0
        || lastLine.isEmptyOrWhitespace) {
        return [];
    }
    const position = new vscode_1.Position(lastLine.lineNumber, lastLine.text.length);
    return [
        vscode_1.TextEdit.insert(position, newline(editorconfig))
    ];
}
exports.transform = transform;
function newline(editorconfig) {
    return lineEndings[get(editorconfig, 'end_of_line', 'lf').toLowerCase()];
}
//# sourceMappingURL=insertFinalNewline.js.map