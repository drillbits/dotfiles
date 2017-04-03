//    Copyright 2016, 2017 Yoshi Yamaguchi
// 
//    Licensed under the Apache License, Version 2.0 (the "License");
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
// 
//        http://www.apache.org/licenses/LICENSE-2.0
// 
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an "AS IS" BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
"use strict";
/**
 * Notation class holds comment notation information of each programming language.
 * TODO(ymotongpoo): add default recommended commenting style in Enum.
 */
var Notation = (function () {
    function Notation(id, multi, single, ornament) {
        this._languageId = id;
        this._multi = multi;
        this._single = single;
        this._ornament = ornament;
    }
    Object.defineProperty(Notation.prototype, "languageId", {
        get: function () {
            return this._languageId;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Notation.prototype, "multi", {
        get: function () {
            return this._multi;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Notation.prototype, "single", {
        get: function () {
            return this._single;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Notation.prototype, "ornament", {
        get: function () {
            return this._ornament;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * hasMulti returns if the Notation instance has multiple line comment style tokens.
     */
    Notation.prototype.hasMulti = function () {
        var _a = this._multi, l = _a[0], r = _a[1];
        return l.length > 0 && r.length > 0;
    };
    /**
     * hasSingle returns if the Notation instance has single line comment style tokens.
     */
    Notation.prototype.hasSingle = function () {
        return this._single.length > 0;
    };
    return Notation;
}());
// init (alphabetical order)
var bat = new Notation("bat", ["", ""], "rem", "");
var c = new Notation("c", ["/**", " */"], "", " * ");
var cpp = new Notation("cpp", ["/**", " */"], "//", " *");
var csharp = new Notation("csharp", ["/**", " */"], "//", " * ");
var css = new Notation("css", ["/**", " */"], "", " *");
var dockerfile = new Notation("dockerfile", ["", ""], "#", " ");
var fsharp = new Notation("fsharp", ["(**", " *)"], "//", " * ");
var go = new Notation("go", ["/**", " */"], "//", " *");
var groovy = new Notation("groovy", ["/**", " */"], "//", " * ");
var html = new Notation("html", ["<!--", "-->"], "", " ");
var ini = new Notation("ini", ["", ""], ";", "");
var java = new Notation("java", ["/**", " */"], "//", " *");
var javascript = new Notation("javascript", ["/**", " */"], "//", " * ");
var makefile = new Notation("makefile", ["", ""], "#", "");
var markdown = new Notation("markdown", ["<!---", "-->"], "", " ");
var objectivec = new Notation("objective-c", ["/**", " */"], "//", " * ");
var perl = new Notation("perl", ["=pod", "=cut"], "#", " ");
var php = new Notation("php", ["/**", " */"], "//", " * ");
var plaintext = new Notation("plaintext", ["", ""], "//", ""); // TODO(ymotongpoo): add feature to support custom single line comment style. (#15)
var powershell = new Notation("powershell", ["<##", "#>"], "#", " # ");
var python = new Notation("python", ['"""', '"""'], "#", " ");
var ruby = new Notation("ruby", ["=begin", "=end"], "#", " ");
var rust = new Notation("rust", ["/**", " */"], "//", " * ");
var typescript = new Notation("typescript", ["/**", " */"], "//", " * ");
var scss = new Notation("scss", ["/**", " */"], "//", " * ");
var shellscript = new Notation("shellscript", ["<<LICENSE", ">>"], "#", " ");
var swift = new Notation("swift", ["/**", " */"], "//", " * ");
var xml = new Notation("xml", ["<!--", "-->"], "", "");
// custom languages
var erlang = new Notation("erlang", ["", ""], "%%", "");
var haskell = new Notation("haskell", ["{--", "-}"], "--", " - ");
var lisp = new Notation("lisp", ["", ""], ";;", "");
var ocaml = new Notation("ocaml", ["(**", " *)"], "", " * ");
// map betweeen languageId and its comment notations.
// LanguageId is listed here.
// https://code.visualstudio.com/docs/languages/identifiers
exports.notations = {
    "bat": bat,
    "c": c,
    "clojure": lisp,
    "cpp": cpp,
    "csharp": csharp,
    "css": css,
    "dockerfile": dockerfile,
    "fsharp": fsharp,
    "go": go,
    "groovy": groovy,
    "html": html,
    "ini": ini,
    "java": java,
    "javascript": javascript,
    "javascriptreact": javascript,
    "makefile": makefile,
    "markdown": markdown,
    "objective-c": objectivec,
    "perl": perl,
    "php": php,
    "plaintext": plaintext,
    "powershell": powershell,
    "python": python,
    "ruby": ruby,
    "rust": rust,
    "typescript": typescript,
    "typescriptreact": typescript,
    "sass": scss,
    "scss": scss,
    "shellscript": shellscript,
    "swift": swift,
    "xml": xml,
    "erlang": erlang,
    "haskell": haskell,
    "lisp": lisp,
    "ocaml": ocaml,
};
//# sourceMappingURL=notation.js.map