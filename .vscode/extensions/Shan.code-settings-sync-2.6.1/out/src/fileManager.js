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
var fs = require('fs');
var path = require('path');
class File {
    constructor(fileName, content, filePath, gistName) {
        this.fileName = fileName;
        this.content = content;
        this.filePath = filePath;
        this.gistName = gistName;
        // this.fileName = file.split('.')[0];
        //this.fileName = file;
    }
}
exports.File = File;
class FileManager {
    static ReadFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                yield fs.readFile(filePath, { encoding: 'utf8' }, function (err, data) {
                    if (err) {
                        console.error(err);
                        reject(err);
                    }
                    resolve(data);
                });
            }));
        });
    }
    static IsDirectory(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let d = yield fs.lstatSync(path);
                if (d.isDirectory()) {
                    resolve(true);
                }
                resolve(false);
            }));
        });
    }
    static GetFile(filePath, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                let fileExists = yield FileManager.FileExists(filePath);
                if (fileExists) {
                    FileManager.ReadFile(filePath).then(function (content) {
                        if (content != null) {
                            let pathFromUser = filePath.substring(filePath.lastIndexOf("User") + 5, filePath.length);
                            let arr = new Array();
                            if (pathFromUser.indexOf("/")) {
                                arr = pathFromUser.split("/");
                            }
                            else {
                                arr = pathFromUser.split(path.sep);
                            }
                            let gistName = "";
                            arr.forEach((element, index) => {
                                if (index < arr.length - 1) {
                                    gistName += element + "|";
                                }
                                else {
                                    gistName += element;
                                }
                            });
                            var file = new File(fileName, content, filePath, gistName);
                            resolve(file);
                        }
                        resolve(null);
                    });
                }
                else {
                    resolve(null);
                }
            }));
        });
    }
    static WriteFile(filePath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (data) {
                    fs.writeFile(filePath, data, (err) => {
                        if (err)
                            reject(false);
                        else
                            resolve(true);
                    });
                }
                else {
                    console.error("Unable to write file. FilePath :" + filePath + " Data :" + data);
                    reject(false);
                }
            });
        });
    }
    static ListFiles(directory, depth, fullDepth) {
        return __awaiter(this, void 0, void 0, function* () {
            var me = this;
            return new Promise((resolve, reject) => {
                fs.readdir(directory, function (err, data) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (err) {
                            console.error(err);
                            resolve(null);
                        }
                        var files = new Array();
                        for (var i = 0; i < data.length; i++) {
                            let fullPath = directory.concat(data[i]);
                            let isDir = yield FileManager.IsDirectory(fullPath);
                            if (isDir) {
                                if (depth < fullDepth) {
                                    let filews = yield FileManager.ListFiles(fullPath + "/", depth + 1, fullDepth);
                                    filews.forEach(element => {
                                        files.push(element);
                                    });
                                }
                            }
                            else {
                                if (fullPath.indexOf('json') > -1) {
                                    var file = yield FileManager.GetFile(fullPath, data[i]);
                                    files.push(file);
                                }
                            }
                        }
                        resolve(files);
                    });
                });
            });
        });
    }
    static CreateDirTree(userFolder, fileName) {
        let me = this;
        let fullPath = userFolder;
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (fileName.indexOf("|") > -1) {
                let paths = fileName.split("|");
                for (var i = 0; i < paths.length - 1; i++) {
                    var element = paths[i];
                    fullPath += element + "/";
                    let x = yield FileManager.CreateDirectory(fullPath);
                }
                console.log(fullPath + paths[paths.length - 1]);
                resolve(fullPath + paths[paths.length - 1]);
            }
            else {
                console.log(fullPath + fileName);
                resolve(fullPath + fileName);
            }
        }));
    }
    static DeleteFile(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                if (filePath) {
                    let stat = yield FileManager.FileExists(filePath);
                    if (stat) {
                        fs.unlink(filePath, err => {
                            if (err)
                                resolve(false);
                            else
                                resolve(true);
                        });
                    }
                }
                else {
                    console.error("Unable to delete file. File Path is :" + filePath);
                    resolve(false);
                }
            }));
        });
    }
    static FileExists(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                fs.access(filePath, fs.F_OK, err => {
                    if (err)
                        resolve(false);
                    else
                        resolve(true);
                });
            }));
        });
    }
    static CreateDirectory(name) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            fs.mkdir(name, err => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        })).then(() => true, err => {
            if (err.code == "EEXIST")
                return false;
            else
                throw err;
        });
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=fileManager.js.map