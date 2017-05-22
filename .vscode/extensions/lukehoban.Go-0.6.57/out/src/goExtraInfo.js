/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const goDeclaration_1 = require("./goDeclaration");
class GoHoverProvider {
    constructor(goConfig) {
        this.goConfig = null;
        this.goConfig = goConfig;
    }
    provideHover(document, position, token) {
        return goDeclaration_1.definitionLocation(document, position, this.goConfig, true).then(definitionInfo => {
            if (definitionInfo == null)
                return null;
            let lines = definitionInfo.declarationlines
                .filter(line => !line.startsWith('\t//') && line !== '')
                .map(line => line.replace(/\t/g, '    '));
            let text;
            text = lines.join('\n').replace(/\n+$/, '');
            let hoverTexts = [];
            hoverTexts.push({ language: 'go', value: text });
            if (definitionInfo.doc != null) {
                hoverTexts.push(definitionInfo.doc);
            }
            let hover = new vscode_1.Hover(hoverTexts);
            return hover;
        }, () => {
            return null;
        });
    }
}
exports.GoHoverProvider = GoHoverProvider;
//# sourceMappingURL=goExtraInfo.js.map