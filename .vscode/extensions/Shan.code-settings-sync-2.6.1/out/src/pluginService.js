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
const util = require("./util");
const path = require("path");
var fs = require('fs');
var ncp = require('ncp').ncp;
var apiPath = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
var rmdir = require('rimraf');
class ExtensionInformation {
    static fromJSON(text) {
        var obj = JSON.parse(text);
        var meta = new ExtensionMetadata(obj.meta.galleryApiUrl, obj.meta.id, obj.meta.downloadUrl, obj.meta.publisherId, obj.meta.publisherDisplayName, obj.meta.date);
        var item = new ExtensionInformation();
        item.metadata = meta;
        item.name = obj.name;
        item.publisher = obj.publisher;
        item.version = obj.version;
        return item;
    }
    static fromJSONList(text) {
        var extList = new Array();
        var list = JSON.parse(text);
        list.forEach(obj => {
            var meta = new ExtensionMetadata(obj.metadata.galleryApiUrl, obj.metadata.id, obj.metadata.downloadUrl, obj.metadata.publisherId, obj.metadata.publisherDisplayName, obj.metadata.date);
            var item = new ExtensionInformation();
            item.metadata = meta;
            item.name = obj.name;
            item.publisher = obj.publisher;
            item.version = obj.version;
            //Not to download this extension again and again.
            if (item.name != "code-settings-sync") {
                extList.push(item);
            }
        });
        return extList;
    }
}
exports.ExtensionInformation = ExtensionInformation;
class ExtensionMetadata {
    constructor(galleryApiUrl, id, downloadUrl, publisherId, publisherDisplayName, date) {
        this.galleryApiUrl = galleryApiUrl;
        this.id = id;
        this.downloadUrl = downloadUrl;
        this.publisherId = publisherId;
        this.publisherDisplayName = publisherDisplayName;
        this.date = date;
    }
}
exports.ExtensionMetadata = ExtensionMetadata;
class PluginService {
    static CopyExtension(destination, source) {
        return new Promise(function (resolve, reject) {
            ncp(source, destination, function (err) {
                if (err) {
                    reject(err);
                }
                resolve();
            });
        });
    }
    static WritePackageJson(dirName, packageJson) {
        return new Promise(function (resolve, reject) {
            fs.writeFile(dirName + "/extension/package.json", packageJson, "utf-8", function (error, text) {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        });
    }
    static GetPackageJson(dirName, item) {
        return new Promise(function (resolve, reject) {
            fs.readFile(dirName + "/extension/package.json", "utf-8", function (error, text) {
                if (error) {
                    reject(error);
                }
                var config = JSON.parse(text);
                if (config.name !== item.name) {
                    reject("name not equal");
                }
                if (config.publisher !== item.publisher) {
                    reject("publisher not equal");
                }
                if (config.version !== item.version) {
                    reject("version not equal");
                }
                resolve(config);
            });
        });
    }
    static GetMissingExtensions(remoteList) {
        var hashset = {};
        var localList = this.CreateExtensionList();
        for (var i = 0; i < localList.length; i++) {
            var ext = localList[i];
            if (hashset[ext.name] == null) {
                hashset[ext.name] = ext;
            }
        }
        var missingList = new Array();
        for (var i = 0; i < remoteList.length; i++) {
            var ext = remoteList[i];
            if (hashset[ext.name] == null) {
                missingList.push(ext);
            }
        }
        return missingList;
    }
    static GetDeletedExtensions(remoteList) {
        var localList = this.CreateExtensionList();
        var deletedList = new Array();
        // for (var i = 0; i < remoteList.length; i++) {
        //     var ext = remoteList[i];
        //     var found: boolean = false;
        //     for (var j = 0; j < localList.length; j++) {
        //         var localExt = localList[j];
        //         if (ext.name == localExt.name) {
        //             found = true;
        //             break;
        //         }
        //     }
        //     if (!found) {
        //         deletedList.push(localExt);
        //     }
        // }
        for (var i = 0; i < localList.length; i++) {
            var ext = localList[i];
            var found = false;
            if (ext.name != "code-settings-sync") {
                for (var j = 0; j < remoteList.length; j++) {
                    var localExt = remoteList[j];
                    if (ext.name == localExt.name) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    deletedList.push(ext);
                }
            }
        }
        return deletedList;
    }
    static CreateExtensionList() {
        var list = new Array();
        for (var i = 0; i < vscode.extensions.all.length; i++) {
            var ext = vscode.extensions.all[i];
            if (ext.packageJSON.isBuiltin == false) {
                if (ext.packageJSON.__metadata == null) {
                    // Not install from gallery, just skip
                    continue;
                }
                var meta = ext.packageJSON.__metadata;
                var data = new ExtensionMetadata(meta.galleryApiUrl, meta.id, meta.downloadUrl, meta.publisherId, meta.publisherDisplayName, meta.date);
                var info = new ExtensionInformation();
                info.metadata = data;
                info.name = ext.packageJSON.name;
                info.publisher = ext.packageJSON.publisher;
                info.version = ext.packageJSON.version;
                list.push(info);
            }
        }
        return list;
    }
    static DeleteExtension(item, ExtensionFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            var destination = path.join(ExtensionFolder, item.publisher + '.' + item.name + '-' + item.version);
            return new Promise((resolve, reject) => {
                rmdir(destination, function (error) {
                    if (error) {
                        console.log("Sync : " + "Error in uninstalling Extension.");
                        console.log(error);
                        reject(false);
                    }
                    resolve(true);
                });
            });
        });
    }
    static InstallExtension(item, ExtensionFolder) {
        return __awaiter(this, void 0, void 0, function* () {
            var header = {
                'Accept': 'application/json;api-version=3.0-preview.1'
            };
            var extractPath = null;
            var data = {
                'filters': [{
                        'criteria': [{
                                'filterType': 4,
                                'value': item.metadata.id
                            }]
                    }],
                flags: 133
            };
            return yield util.Util.HttpPostJson(apiPath, data, header)
                .then(function (res) {
                var targetVersion = null;
                var content = JSON.parse(res);
                // Find correct version
                for (var i = 0; i < content.results.length; i++) {
                    var result = content.results[i];
                    for (var k = 0; k < result.extensions.length; k++) {
                        var extension = result.extensions[k];
                        for (var j = 0; j < extension.versions.length; j++) {
                            var version = extension.versions[j];
                            if (version.version === item.version) {
                                targetVersion = version;
                                break;
                            }
                        }
                        if (targetVersion != null) {
                            break;
                        }
                    }
                    if (targetVersion != null) {
                        break;
                    }
                }
                if (targetVersion == null) {
                    // unable to find one
                    throw "unable to find corresponding version of extension from gallery";
                }
                // Proceed to install
                var downloadUrl = targetVersion.assetUri + '/Microsoft.VisualStudio.Services.VSIXPackage?install=true';
                return downloadUrl;
            })
                .then(function (url) {
                return util.Util.HttpGetFile(url);
            })
                .then(function (filePath) {
                return util.Util.Extract(filePath);
            })
                .then(function (dir) {
                extractPath = dir;
                return PluginService.GetPackageJson(dir, item);
            })
                .then(function (packageJson) {
                Object.assign(packageJson, {
                    __metadata: item.metadata
                });
                var text = JSON.stringify(packageJson, null, ' ');
                return PluginService.WritePackageJson(extractPath, text);
            })
                .then(function () {
                // Move the folder to correct path
                var destination = path.join(ExtensionFolder, item.publisher + '.' + item.name + '-' + item.version);
                var source = path.join(extractPath, 'extension');
                return PluginService.CopyExtension(destination, source);
            });
        });
    }
}
exports.PluginService = PluginService;
//# sourceMappingURL=pluginService.js.map