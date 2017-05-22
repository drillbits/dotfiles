"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
var proxyURL = vscode.workspace.getConfiguration("http")["proxy"] || process.env["http_proxy"];
var host = vscode.workspace.getConfiguration("sync")["host"];
var pathPrefix = vscode.workspace.getConfiguration("sync")["pathPrefix"];
if (!host || host === "") {
    host = "api.github.com";
    pathPrefix = "";
}
var GitHubApi = require("github");
var github = new GitHubApi({
    proxy: proxyURL,
    version: "3.0.0",
    host: host,
    pathPrefix: pathPrefix
});
class GithubService {
    constructor(TOKEN) {
        this.TOKEN = TOKEN;
        this.GIST_JSON_EMPTY = {
            "description": "Visual Studio Code Sync Settings Gist",
            "public": false,
            "files": {
                "settings.json": {
                    "content": "// Empty"
                },
                "launch.json": {
                    "content": "// Empty"
                },
                "keybindings.json": {
                    "content": "// Empty"
                },
                "extensions.json": {
                    "content": "// Empty"
                },
                "locale.json": {
                    "content": "// Empty"
                },
                "keybindingsMac.json": {
                    "content": "// Empty"
                },
                "cloudSettings": {
                    "content": "// Empty"
                }
            }
        };
        this.userName = null;
        this.name = null;
        this.GIST_JSON = null;
        if (TOKEN != null && TOKEN != '') {
            var self = this;
            github.authenticate({
                type: "oauth",
                token: TOKEN
            });
            github.users.get({}, function (err, res) {
                if (err) {
                    console.log(err);
                }
                else {
                    self.userName = res.data.login;
                    self.name = res.data.name;
                }
            });
        }
    }
    AddFile(list, GIST_JSON_b) {
        for (var i = 0; i < list.length; i++) {
            var file = list[i];
            if (file.content != '') {
                GIST_JSON_b.files[file.gistName] = {};
                GIST_JSON_b.files[file.gistName].content = file.content;
            }
        }
        return GIST_JSON_b;
    }
    CreateEmptyGIST(publicGist) {
        var me = this;
        if (publicGist) {
            me.GIST_JSON_EMPTY.public = true;
        }
        else {
            me.GIST_JSON_EMPTY.public = false;
        }
        return new Promise((resolve, reject) => {
            github.getGistsApi().create(me.GIST_JSON_EMPTY, function (err, res) {
                if (err) {
                    console.error(err);
                    reject(false);
                }
                if (res.data.id) {
                    resolve(res.data.id);
                }
                else {
                    console.error("ID is null");
                    console.log("Sync : " + "Response from GitHub is: ");
                    console.log(res);
                }
            });
        });
    }
    CreateAnonymousGist(publicGist, files) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            if (publicGist) {
                me.GIST_JSON_EMPTY.public = true;
            }
            else {
                me.GIST_JSON_EMPTY.public = false;
            }
            let gist = me.AddFile(files, me.GIST_JSON_EMPTY);
            return new Promise((resolve, reject) => {
                github.getGistsApi().create(gist, function (err, res) {
                    if (err) {
                        console.error(err);
                        reject(false);
                    }
                    if (res.data.id) {
                        resolve(res.data.id);
                    }
                    else {
                        console.error("ID is null");
                        console.log("Sync : " + "Response from GitHub is: ");
                        console.log(res);
                    }
                });
            });
        });
    }
    ReadGist(GIST) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                yield github.getGistsApi().get({ id: GIST }, function (er, res) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (er) {
                            console.error(er);
                            reject(er);
                        }
                        resolve(res);
                    });
                });
            }));
        });
    }
    UpdateGIST(gistObject, files) {
        var me = this;
        var allFiles = Object.keys(gistObject.data.files);
        for (var fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
            var fileName = allFiles[fileIndex];
            var exists = false;
            files.forEach((settingFile) => {
                if (settingFile.gistName == fileName) {
                    exists = true;
                }
            });
            if (!exists && !fileName.startsWith("keybindings")) {
                gistObject.data.files[fileName] = null;
            }
        }
        gistObject.data = me.AddFile(files, gistObject.data);
        return gistObject;
    }
    SaveGIST(gistObject) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            //TODO : turn diagnostic mode on for console.
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                yield github.getGistsApi().edit(gistObject, function (ere, ress) {
                    if (ere) {
                        console.error(ere);
                        reject(false);
                    }
                    resolve(true);
                });
            }));
        });
    }
}
exports.GithubService = GithubService;
//# sourceMappingURL=githubService.js.map