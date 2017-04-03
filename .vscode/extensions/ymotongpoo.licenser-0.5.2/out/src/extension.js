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
// The module "vscode" contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
var vscode = require("vscode");
var notation_1 = require("./notation");
var al2_1 = require("./licenses/al2");
var bsd3_1 = require("./licenses/bsd3");
var bsd2_1 = require("./licenses/bsd2");
var gplv2_1 = require("./licenses/gplv2");
var gplv3_1 = require("./licenses/gplv3");
var lgplv3_1 = require("./licenses/lgplv3");
var agplv3_1 = require("./licenses/agplv3");
var mit_1 = require("./licenses/mit");
var mplv2_1 = require("./licenses/mplv2");
var ccby30_1 = require("./licenses/ccby30");
var ccby40_1 = require("./licenses/ccby40");
var ccbync30_1 = require("./licenses/ccbync30");
var ccbync40_1 = require("./licenses/ccbync40");
var ccbyncnd30_1 = require("./licenses/ccbyncnd30");
var ccbyncnd40_1 = require("./licenses/ccbyncnd40");
var ccbyncsa30_1 = require("./licenses/ccbyncsa30");
var ccbyncsa40_1 = require("./licenses/ccbyncsa40");
var ccbynd40_1 = require("./licenses/ccbynd40");
var ccbysa30_1 = require("./licenses/ccbysa30");
var path = require("path");
var os = require("os");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log("'licenser' is activated.");
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    var licenser = new Licenser();
    context.subscriptions.push(licenser);
}
exports.activate = activate;
// constants for default properties.
var defaultLicenseType = "AL2";
var defaultLicenseFilename = "LICENSE";
// Licenser handles LICENSE file creation and license header insertion.
var Licenser = (function () {
    function Licenser() {
        var _this = this;
        this.licenserSetting = vscode.workspace.getConfiguration("licenser");
        var licenseType = this.licenserSetting.get("license", undefined);
        if (licenseType === undefined) {
            vscode.window.showWarningMessage("set your preferred license as 'licenser.license' in configuration. Apache License version 2.0 will be used as default.");
            licenseType = defaultLicenseType;
        }
        this.licenseType = licenseType;
        this.author = this.getAuthor();
        console.log("Licenser.author: " + this.author);
        var subscriptions = [];
        vscode.commands.registerCommand("extension.createLicenseFile", function () { _this.create(); });
        vscode.commands.registerCommand("extension.insertLicenseHeader", function () { _this.insert(); });
        vscode.window.onDidChangeActiveTextEditor(this._onDidChangeActiveTextEditor, this, subscriptions);
    }
    /**
     * create generates LICENSE file and save it in opened workspace.
     */
    Licenser.prototype.create = function () {
        var root = vscode.workspace.rootPath;
        if (root === undefined) {
            vscode.window.showErrorMessage("No directory is opened.");
            return;
        }
        var license = this.getLicense(this.licenseType);
        var uri = vscode.Uri.parse("untitled:" + root + path.sep + defaultLicenseFilename);
        vscode.workspace.openTextDocument(uri).then(function (doc) {
            vscode.window.showTextDocument(doc).then(function (editor) {
                editor.edit(function (ed) {
                    ed.insert(doc.positionAt(0), license.termsAndConditions());
                }).then(function (done) {
                    if (done) {
                        doc.save().then(function (saved) {
                            vscode.window.showInformationMessage("Successfully saved: " + uri);
                        }, function (reason) {
                            console.log("saved", reason);
                        });
                    }
                }, function (reason) {
                    console.log("ed.insert", reason);
                    vscode.window.showErrorMessage(reason);
                });
            });
        }, function (reason) {
            console.log("openTextDocument", reason);
            vscode.window.showErrorMessage(reason);
        });
    };
    /**
     * insert embeds license header text into the first line of the opened file.
     */
    Licenser.prototype.insert = function () {
        var editor = vscode.window.activeTextEditor;
        var doc = editor.document;
        var langId = editor.document.languageId;
        var license = this.getLicense(this.licenseType);
        var header = this.getLicenseHeader(license, langId);
        // handle shebang
        var firstLine = doc.getText(new vscode.Range(0, 0, 1, 0));
        var position = this.findInsertionPosition(firstLine, langId);
        editor.edit(function (ed) {
            console.log("header:", header);
            ed.insert(doc.positionAt(position), header);
        }).then(function (done) {
            if (done) {
                doc.save().then(function (saved) {
                    console.log("Inserted license header");
                }, function (reason) {
                    console.log("doc.save", reason);
                });
            }
        }, function (reason) {
            console.log("editor.edit", reason);
            vscode.window.showErrorMessage(reason);
        });
    };
    /**
     * findInsertionPosition returns the position to which insert() should insert
     * @param range header text area (usually first line of the file.)
     * @param langId language ID
     */
    Licenser.prototype.findInsertionPosition = function (range, langId) {
        console.log("firstLine: " + range);
        switch (langId) {
            case "php":
                return range.startsWith("<?php") ? range.length : 0;
            default:
                return range.startsWith("#!") ? range.length : 0;
        }
    };
    Licenser.prototype._onDidChangeActiveTextEditor = function () {
        var _this = this;
        vscode.window.onDidChangeActiveTextEditor(function (e) {
            var doc = e.document;
            var contents = doc.getText();
            if (contents.length > 0) {
                return;
            }
            for (var id in notation_1.notations) {
                if (id === doc.languageId) {
                    _this.insert();
                }
            }
        });
    };
    /**
     * getLicense returns License instance with licenser.license setting.
     * @param typ License type specified in settings.json.
     */
    Licenser.prototype.getLicense = function (typ) {
        var license;
        var projectName = this.licenserSetting.get("projectName", undefined);
        console.log("Project Name from settings: " + projectName);
        if (projectName !== undefined && projectName === "") {
            var root = vscode.workspace.rootPath;
            projectName = path.basename(root);
        }
        console.log("Project Name used: " + projectName);
        switch (typ.toLowerCase()) {
            case "agplv3":
                license = new agplv3_1.AGPLv3(this.author);
                break;
            case "al2":
                license = new al2_1.AL2(this.author);
                break;
            case "bsd2":
                license = new bsd2_1.BSD2(this.author);
                break;
            case "bsd3":
                license = new bsd3_1.BSD3(this.author);
                break;
            case "gplv2":
                license = new gplv2_1.GPLv2(this.author, projectName);
                break;
            case "gplv3":
                license = new gplv3_1.GPLv3(this.author, projectName);
                break;
            case "lgplv3":
                license = new lgplv3_1.LGPLv3(this.author);
                break;
            case "mit":
                license = new mit_1.MIT(this.author);
                break;
            case "mplv2":
                license = new mplv2_1.MPLv2(this.author);
                break;
            case "cc-by-3":
                license = new ccby30_1.CCBY3(this.author, projectName);
                break;
            case "cc-by-4":
                license = new ccby40_1.CCBY4(this.author, projectName);
                break;
            case "cc-by-sa-3":
                license = new ccbysa30_1.CCBYSA3(this.author, projectName);
                break;
            case "cc-by-nd-4":
                license = new ccbynd40_1.CCBYND4(this.author, projectName);
                break;
            case "cc-by-nc-3":
                license = new ccbync30_1.CCBYNC3(this.author, projectName);
                break;
            case "cc-by-nc-4":
                license = new ccbync40_1.CCBYNC4(this.author, projectName);
                break;
            case "cc-by-nc-sa-3":
                license = new ccbyncsa30_1.CCBYNCSA3(this.author, projectName);
                break;
            case "cc-by-nc-sa-4":
                license = new ccbyncsa40_1.CCBYNCSA4(this.author, projectName);
                break;
            case "cc-by-nc-nd-3":
                license = new ccbyncnd30_1.CCBYNCND3(this.author, projectName);
                break;
            case "cc-by-nc-nd-4":
                license = new ccbyncnd40_1.CCBYNCND4(this.author, projectName);
                break;
            default:
                license = new al2_1.AL2(this.author);
                break;
        }
        return license;
    };
    /**
     * getLicenseHeader returns license header string.
     * @param license License instance initialized from lincenser.license.
     * @param langId language ID for the file working on.
     */
    Licenser.prototype.getLicenseHeader = function (license, langId) {
        var notation = notation_1.notations[langId] ? notation_1.notations[langId] : notation_1.notations["plaintext"]; // return plaintext's comment when langId is unexpected.
        var preferSingleLineStyle = this.licenserSetting.get("useSingleLineStyle", true);
        var _a = notation.multi, l = _a[0], r = _a[1];
        if (preferSingleLineStyle) {
            if (notation.hasSingle()) {
                return this.singleLineCommentHeader(license, notation.single);
            }
            else if (notation.hasMulti()) {
                return this.multiLineCommentHeader(license, l, r, notation.ornament);
            }
        }
        else {
            if (notation.hasMulti()) {
                return this.multiLineCommentHeader(license, l, r, notation.ornament);
            }
            else if (notation.hasSingle()) {
                return this.singleLineCommentHeader(license, notation.single);
            }
        }
    };
    /**
     * singleLineCommentHeader returns license header string with single line comment style.
     * @param license License instance initialzed from licenser.license.
     * @param token single line comment token.
     */
    Licenser.prototype.singleLineCommentHeader = function (license, token) {
        var original = license.header().split("\n");
        var header = "";
        for (var i in original) {
            if (original.length > 0) {
                header += token + " " + original[i] + "\n";
            }
            else {
                header += token;
            }
        }
        return header + "\n";
    };
    /**
     * multiLineCommentHeader returns license header string with multiple line comment style.
     * @param license License instance initialized from licenser.License.
     * @param start multiplie line comment start string.
     * @param end multiple line comment end string.
     * @param ornament multiple line comment ornament string.
     */
    Licenser.prototype.multiLineCommentHeader = function (license, start, end, ornament) {
        var original = license.header().split("\n");
        var header = start + "\n";
        for (var i in original) {
            if (original.length > 0) {
                header += ornament + original[i] + "\n";
            }
        }
        header += end + "\n";
        return header + "\n";
    };
    /**
     * getAuthor fetches author name string from one of the followings in this order.
     *   1. licenser.author
     *   2. OS environment.
     */
    Licenser.prototype.getAuthor = function () {
        var author = this.licenserSetting.get("author", undefined);
        console.log("Author from setting: " + author);
        if (author !== undefined && author.length !== 0) {
            return author;
        }
        vscode.window.showWarningMessage("set author name as ’licenser.author’ in configuration. OS username will be used as default.");
        switch (os.platform()) {
            case "win32":
                var userprofile = process.env.USERPROFILE;
                if (userprofile === undefined) {
                    vscode.window.showErrorMessage("Set USERPROFILE in your environment variables.");
                }
                author = userprofile.split(path.sep)[2];
                break;
            case "darwin":
                author = process.env.USER;
                break;
            case "linux":
                author = process.env.USER;
                break;
            default:
                vscode.window.showErrorMessage("Unsupported OS.");
                break;
        }
        return author;
    };
    Licenser.prototype.dispose = function () {
        this._disposable.dispose();
    };
    return Licenser;
}());
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map