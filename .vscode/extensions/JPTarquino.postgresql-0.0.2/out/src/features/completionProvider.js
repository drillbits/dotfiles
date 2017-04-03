/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var globalConstants_1 = require('../globalConstants');
var vscode_1 = require('vscode');
var MyCompletionItem = (function (_super) {
    __extends(MyCompletionItem, _super);
    function MyCompletionItem(entry) {
        _super.call(this, entry.name);
        this.sortText = entry.sortText;
        this.kind = MyCompletionItem.convertKind(entry.kind);
    }
    MyCompletionItem.convertKind = function (kind) {
        return vscode_1.CompletionItemKind.Property;
    };
    return MyCompletionItem;
})(vscode_1.CompletionItem);
var PostgresqlCompletionItemProvider = (function () {
    function PostgresqlCompletionItemProvider() {
        this.triggerCharacters = ['.', ' '];
        this.excludeTokens = ['string', 'comment', 'numeric'];
        this.sortBy = [{ type: 'reference', partSeparator: '/' }];
        this.pgKeywords = [];
        var constants = globalConstants_1.default.keywords;
        for (var constIdx = 0; constIdx < constants.length; constIdx++) {
            var element = this.createKeywordCompletionItem(constants[constIdx]);
            this.pgKeywords.push(element);
        }
    }
    PostgresqlCompletionItemProvider.prototype.createKeywordCompletionItem = function (keyword) {
        var item = new vscode_1.CompletionItem(keyword);
        item.kind = vscode_1.CompletionItemKind.Keyword;
        return item;
    };
    PostgresqlCompletionItemProvider.prototype.provideCompletionItems = function (document, position, token) {
        var filepath = document.uri;
        var line = position.line + 1;
        var offset = position.character + 1;
        if (!filepath) {
            return Promise.resolve([]);
        }
        var testKeywords = this.pgKeywords;
        return Promise.resolve(testKeywords);
        ;
    };
    PostgresqlCompletionItemProvider.prototype.resolveCompletionItem = function (item, token) {
        return item;
    };
    return PostgresqlCompletionItemProvider;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostgresqlCompletionItemProvider;
//# sourceMappingURL=completionProvider.js.map