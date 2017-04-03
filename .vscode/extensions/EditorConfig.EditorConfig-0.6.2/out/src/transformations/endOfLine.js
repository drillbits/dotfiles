var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const Utils_1 = require("../Utils");
/**
 * Transform the textdocument by setting the end of line sequence
 */
function transform(editorconfig, textDocument) {
    return __awaiter(this, void 0, void 0, function* () {
        const eol = {
            lf: vscode_1.EndOfLine.LF,
            crlf: vscode_1.EndOfLine.CRLF
        }[(editorconfig.end_of_line || '').toLowerCase()];
        if (!eol) {
            return Promise.resolve(false);
        }
        return Utils_1.findEditor(textDocument).edit(edit => {
            edit.setEndOfLine(eol);
        });
    });
}
exports.transform = transform;
//# sourceMappingURL=endOfLine.js.map