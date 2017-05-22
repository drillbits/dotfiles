"use strict";
const vscode_1 = require("vscode");
const proxy = require("./jediProxy");
const DOCSTRING_PARAM_PATTERNS = [
    "\\s*:type\\s*PARAMNAME:\\s*([^\\n, ]+)",
    "\\s*:param\\s*(\\w?)\\s*PARAMNAME:[^\\n]+",
    "\\s*@type\\s*PARAMNAME:\\s*([^\\n, ]+)" // Epydoc
];
/**
 * Extrct the documentation for parameters from a given docstring
 *
 * @param {string} paramName Name of the parameter
 * @param {string} docString The docstring for the function
 * @returns {string} Docstring for the parameter
 */
function extractParamDocString(paramName, docString) {
    let paramDocString = "";
    // In docstring the '*' is escaped with a backslash
    paramName = paramName.replace(new RegExp("\\*", "g"), "\\\\\\*");
    DOCSTRING_PARAM_PATTERNS.forEach(pattern => {
        if (paramDocString.length > 0) {
            return;
        }
        pattern = pattern.replace("PARAMNAME", paramName);
        let regExp = new RegExp(pattern);
        let matches = regExp.exec(docString);
        if (matches && matches.length > 0) {
            paramDocString = matches[0];
            if (paramDocString.indexOf(":") >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(":") + 1);
            }
            if (paramDocString.indexOf(":") >= 0) {
                paramDocString = paramDocString.substring(paramDocString.indexOf(":") + 1);
            }
        }
    });
    return paramDocString.trim();
}
class PythonSignatureProvider {
    constructor(context, jediProxy = null) {
        this.jediProxyHandler = new proxy.JediProxyHandler(context, jediProxy);
    }
    static parseData(data) {
        if (data && Array.isArray(data.definitions) && data.definitions.length > 0) {
            let signature = new vscode_1.SignatureHelp();
            signature.activeSignature = 0;
            data.definitions.forEach(def => {
                signature.activeParameter = def.paramindex;
                // Don't display the documentation, as vs code doesn't format the docmentation
                // i.e. line feeds are not respected, long content is stripped
                let sig = {
                    // documentation: def.docstring,
                    label: def.description,
                    parameters: []
                };
                sig.parameters = def.params.map(arg => {
                    if (arg.docstring.length === 0) {
                        arg.docstring = extractParamDocString(arg.name, def.docstring);
                    }
                    return {
                        documentation: arg.docstring.length > 0 ? arg.docstring : arg.description,
                        label: arg.description.length > 0 ? arg.description : arg.name
                    };
                });
                signature.signatures.push(sig);
            });
            return signature;
        }
        return new vscode_1.SignatureHelp();
    }
    provideSignatureHelp(document, position, token) {
        let cmd = {
            command: proxy.CommandType.Arguments,
            fileName: document.fileName,
            columnIndex: position.character,
            lineIndex: position.line,
            source: document.getText()
        };
        return this.jediProxyHandler.sendCommand(cmd, token).then(data => {
            return PythonSignatureProvider.parseData(data);
        });
    }
}
exports.PythonSignatureProvider = PythonSignatureProvider;
//# sourceMappingURL=signatureProvider.js.map