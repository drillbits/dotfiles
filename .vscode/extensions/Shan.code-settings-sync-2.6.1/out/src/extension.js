'use strict';
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
const pluginService_1 = require("./pluginService");
const environmentPath_1 = require("./environmentPath");
const fileManager_1 = require("./fileManager");
const commons_1 = require("./commons");
const githubService_1 = require("./githubService");
const setting_1 = require("./setting");
const enums_1 = require("./enums");
function activate(context) {
    return __awaiter(this, void 0, void 0, function* () {
        var openurl = require('open');
        var fs = require('fs');
        var en = new environmentPath_1.Environment(context);
        var common = new commons_1.Commons(en, context);
        yield common.StartMigrationProcess();
        let startUpSetting = yield common.GetSettings();
        if (startUpSetting) {
            let tokenAvailable = (startUpSetting.token != null) && (startUpSetting.token != "");
            let gistAvailable = (startUpSetting.gist != null) && (startUpSetting.gist != "");
            if (startUpSetting.autoUpload && tokenAvailable && gistAvailable) {
                common.StartWatch();
            }
            if (gistAvailable == true && startUpSetting.autoDownload == true) {
                vscode.commands.executeCommand('extension.downloadSettings');
            }
            else {
            }
        }
        var updateSettings = vscode.commands.registerCommand('extension.updateSettings', function () {
            return __awaiter(this, arguments, void 0, function* () {
                let args = arguments;
                let en = new environmentPath_1.Environment(context);
                let common = new commons_1.Commons(en, context);
                common.CloseWatch();
                let myGi = null;
                let dateNow = new Date();
                let localConfig = new setting_1.LocalConfig();
                let syncSetting = yield common.GetSettings();
                let allSettingFiles = new Array();
                let uploadedExtensions = new Array();
                let customSettings = new setting_1.CustomSettings();
                let askToken = !syncSetting.anonymousGist;
                yield common.InitializeSettings(syncSetting, askToken, false).then((resolve) => __awaiter(this, void 0, void 0, function* () {
                    localConfig.config = resolve;
                    syncSetting = localConfig.config;
                    if (args.length > 0) {
                        if (args[0] == "publicGIST") {
                            localConfig.publicGist = true;
                        }
                        else {
                            localConfig.publicGist = false;
                        }
                    }
                    myGi = new githubService_1.GithubService(syncSetting.token);
                    yield startGitProcess();
                }), (reject) => {
                    common.LogException(reject, common.ERROR_MESSAGE, true);
                    return;
                });
                function startGitProcess() {
                    return __awaiter(this, void 0, void 0, function* () {
                        vscode.window.setStatusBarMessage("Sync : Uploading / Updating Your Settings In Github.");
                        if (!syncSetting.anonymousGist) {
                            if (syncSetting.token == null && syncSetting.token == "") {
                                vscode.window.showInformationMessage("Sync : Set Github Token or set anonymousGist to true from settings.");
                                return;
                            }
                        }
                        syncSetting.lastUpload = dateNow;
                        vscode.window.setStatusBarMessage("Sync : Reading Settings and Extensions.");
                        uploadedExtensions = pluginService_1.PluginService.CreateExtensionList();
                        uploadedExtensions.sort(function (a, b) {
                            return a.name.localeCompare(b.name);
                        });
                        // var remoteList = ExtensionInformation.fromJSONList(file.content);
                        // var deletedList = PluginService.GetDeletedExtensions(uploadedExtensions);
                        let fileName = en.FILE_EXTENSION_NAME;
                        let filePath = en.FILE_EXTENSION;
                        let fileContent = JSON.stringify(uploadedExtensions, undefined, 2);
                        ;
                        let file = new fileManager_1.File(fileName, fileContent, filePath, fileName);
                        allSettingFiles.push(file);
                        let contentFiles = new Array();
                        // if (syncSetting.workspaceSync) {
                        contentFiles = yield fileManager_1.FileManager.ListFiles(en.USER_FOLDER, 0, 2);
                        // }
                        // else {
                        //     contentFiles = await FileManager.ListFiles(en.USER_FOLDER, 0, 1);
                        // }
                        let customExist = yield fileManager_1.FileManager.FileExists(en.FILE_CUSTOMIZEDSETTINGS);
                        if (customExist) {
                            customSettings = yield common.GetCustomSettings();
                            contentFiles = contentFiles.filter((file, index) => {
                                let a = file.fileName != en.FILE_CUSTOMIZEDSETTINGS_NAME;
                                return a;
                            });
                            if (customSettings.ignoreUploadFiles.length > 0) {
                                contentFiles = contentFiles.filter((file, index) => {
                                    let a = customSettings.ignoreUploadFiles.indexOf(file.fileName) == -1 && file.fileName != en.FILE_CUSTOMIZEDSETTINGS_NAME;
                                    return a;
                                });
                            }
                            if (customSettings.ignoreUploadFolders.length > 0) {
                                contentFiles = contentFiles.filter((file, index) => {
                                    let matchedFolders = customSettings.ignoreUploadFolders.filter((folder) => {
                                        return file.filePath.indexOf(folder) == -1;
                                    });
                                    return matchedFolders.length > 0;
                                });
                            }
                        }
                        else {
                            common.LogException(null, common.ERROR_MESSAGE, true);
                            return;
                        }
                        contentFiles.forEach(snippetFile => {
                            if (snippetFile.fileName != en.APP_SUMMARY_NAME && snippetFile.fileName != en.FILE_KEYBINDING_MAC) {
                                if (snippetFile.content != "") {
                                    if (snippetFile.fileName == en.FILE_KEYBINDING_NAME) {
                                        var destinationKeyBinding = "";
                                        if (en.OsType == enums_1.OsType.Mac) {
                                            destinationKeyBinding = en.FILE_KEYBINDING_MAC;
                                        }
                                        else {
                                            destinationKeyBinding = en.FILE_KEYBINDING_DEFAULT;
                                        }
                                        snippetFile.gistName = destinationKeyBinding;
                                    }
                                    allSettingFiles.push(snippetFile);
                                }
                            }
                        });
                        var extProp = new setting_1.CloudSetting();
                        extProp.lastUpload = dateNow;
                        fileName = en.FILE_CLOUDSETTINGS_NAME;
                        fileContent = JSON.stringify(extProp);
                        file = new fileManager_1.File(fileName, fileContent, "", fileName);
                        allSettingFiles.push(file);
                        let completed = false;
                        let newGIST = false;
                        if (syncSetting.anonymousGist) {
                            yield myGi.CreateAnonymousGist(localConfig.publicGist, allSettingFiles).then(function (gistID) {
                                return __awaiter(this, void 0, void 0, function* () {
                                    if (gistID) {
                                        newGIST = true;
                                        syncSetting.gist = gistID;
                                        completed = true;
                                        vscode.window.setStatusBarMessage("Sync : GIST ID: " + syncSetting.gist + " created.");
                                    }
                                    else {
                                        vscode.window.showInformationMessage("Sync : Unable to create Gist.");
                                        return;
                                    }
                                });
                            }, function (error) {
                                common.LogException(error, common.ERROR_MESSAGE, true);
                                return;
                            });
                        }
                        else {
                            if (syncSetting.gist == null || syncSetting.gist === "") {
                                newGIST = true;
                                yield myGi.CreateEmptyGIST(localConfig.publicGist).then(function (gistID) {
                                    return __awaiter(this, void 0, void 0, function* () {
                                        if (gistID) {
                                            syncSetting.gist = gistID;
                                            vscode.window.setStatusBarMessage("Sync : GIST ID: " + syncSetting.gist + " created.");
                                        }
                                        else {
                                            vscode.window.showInformationMessage("Sync : Unable to create Gist.");
                                            return;
                                        }
                                    });
                                }, function (error) {
                                    common.LogException(error, common.ERROR_MESSAGE, true);
                                    return;
                                });
                            }
                            yield myGi.ReadGist(syncSetting.gist).then(function (gistObj) {
                                return __awaiter(this, void 0, void 0, function* () {
                                    if (gistObj) {
                                        if (gistObj.data.owner != null) {
                                            if (gistObj.data.owner.login != myGi.userName) {
                                                common.LogException(null, "Sync : You cant edit GIST for user : " + gistObj.data.owner.login, true);
                                                return;
                                            }
                                        }
                                        if (gistObj.public == true) {
                                            localConfig.publicGist = true;
                                        }
                                        vscode.window.setStatusBarMessage("Sync : Uploading Files Data.");
                                        gistObj = myGi.UpdateGIST(gistObj, allSettingFiles);
                                        yield myGi.SaveGIST(gistObj.data).then(function (saved) {
                                            return __awaiter(this, void 0, void 0, function* () {
                                                if (saved) {
                                                    completed = true;
                                                }
                                                else {
                                                    vscode.window.showErrorMessage("GIST NOT SAVED");
                                                    return;
                                                }
                                            });
                                        }, function (error) {
                                            common.LogException(error, common.ERROR_MESSAGE, true);
                                            return;
                                        });
                                    }
                                    else {
                                        vscode.window.showErrorMessage("GIST ID: " + syncSetting.gist + " UNABLE TO READ.");
                                        return;
                                    }
                                });
                            }, function (gistReadError) {
                                common.LogException(gistReadError, common.ERROR_MESSAGE, true);
                                return;
                            });
                        }
                        if (completed) {
                            yield common.SaveSettings(syncSetting).then(function (added) {
                                if (added) {
                                    if (newGIST) {
                                        vscode.window.showInformationMessage("Uploaded Successfully." + " GIST ID :  " + syncSetting.gist + " . Please copy and use this ID in other machines to sync all settings.");
                                    }
                                    else {
                                        vscode.window.setStatusBarMessage("");
                                        vscode.window.setStatusBarMessage("Uploaded Successfully.", 5000);
                                    }
                                    if (localConfig.publicGist) {
                                        vscode.window.showInformationMessage("Sync : You can share the GIST ID to other users to download your settings.");
                                    }
                                    if (syncSetting.showSummary) {
                                        common.GenerateSummmaryFile(true, allSettingFiles, null, uploadedExtensions, localConfig);
                                    }
                                    if (syncSetting.autoUpload) {
                                        common.StartWatch();
                                    }
                                    vscode.window.setStatusBarMessage("");
                                }
                            }, function (err) {
                                common.LogException(err, common.ERROR_MESSAGE, true);
                                return;
                            });
                        }
                    });
                }
            });
        });
        var downloadSettings = vscode.commands.registerCommand('extension.downloadSettings', function () {
            return __awaiter(this, void 0, void 0, function* () {
                var en = new environmentPath_1.Environment(context);
                var common = new commons_1.Commons(en, context);
                common.CloseWatch();
                var myGi = null;
                var localSettings = new setting_1.LocalConfig();
                var syncSetting = yield common.GetSettings();
                let customSettings = new setting_1.CustomSettings();
                let askToken = !syncSetting.anonymousGist;
                yield common.InitializeSettings(syncSetting, false, true).then((resolve) => __awaiter(this, void 0, void 0, function* () {
                    localSettings.config = resolve;
                    syncSetting = localSettings.config;
                    customSettings = yield common.GetCustomSettings();
                    yield StartDownload();
                }));
                function StartDownload() {
                    return __awaiter(this, void 0, void 0, function* () {
                        myGi = new githubService_1.GithubService(syncSetting.token);
                        vscode.window.setStatusBarMessage("");
                        vscode.window.setStatusBarMessage("Sync : Reading Settings Online.", 2000);
                        myGi.ReadGist(syncSetting.gist).then(function (res) {
                            return __awaiter(this, void 0, void 0, function* () {
                                var addedExtensions = new Array();
                                var deletedExtensions = new Array();
                                var updatedFiles = new Array();
                                var actionList = new Array();
                                if (res) {
                                    if (res.public == true) {
                                        localSettings.publicGist = true;
                                    }
                                    var keys = Object.keys(res.data.files);
                                    if (keys.indexOf(en.FILE_CLOUDSETTINGS_NAME) > -1) {
                                        var cloudSettGist = JSON.parse(res.data.files[en.FILE_CLOUDSETTINGS_NAME].content);
                                        var cloudSett = Object.assign(new setting_1.CloudSetting(), cloudSettGist);
                                        ;
                                        let lastUploadStr = (syncSetting.lastUpload) ? syncSetting.lastUpload.toString() : "";
                                        let lastDownloadStr = (syncSetting.lastDownload) ? syncSetting.lastDownload.toString() : "";
                                        var upToDate = false;
                                        if (lastDownloadStr != "") {
                                            upToDate = new Date(lastDownloadStr).getTime() === new Date(cloudSett.lastUpload).getTime();
                                        }
                                        if (lastUploadStr != "") {
                                            upToDate = upToDate || new Date(lastUploadStr).getTime() === new Date(cloudSett.lastUpload).getTime();
                                        }
                                        if (!syncSetting.forceDownload) {
                                            if (upToDate) {
                                                vscode.window.setStatusBarMessage("");
                                                vscode.window.setStatusBarMessage("Sync : You already have latest version of saved settings.", 5000);
                                                return;
                                            }
                                        }
                                        syncSetting.lastDownload = cloudSett.lastUpload;
                                    }
                                    keys.forEach(gistName => {
                                        if (res.data.files[gistName]) {
                                            if (res.data.files[gistName].content) {
                                                if (gistName.indexOf(".") > -1) {
                                                    if (en.OsType == enums_1.OsType.Mac && gistName == en.FILE_KEYBINDING_DEFAULT) {
                                                        return;
                                                    }
                                                    if (en.OsType != enums_1.OsType.Mac && gistName == en.FILE_KEYBINDING_MAC) {
                                                        return;
                                                    }
                                                    var f = new fileManager_1.File(gistName, res.data.files[gistName].content, null, gistName);
                                                    updatedFiles.push(f);
                                                }
                                            }
                                        }
                                        else {
                                            console.log(gistName + " key in response is empty.");
                                        }
                                    });
                                    for (var index = 0; index < updatedFiles.length; index++) {
                                        var file = updatedFiles[index];
                                        var path = null;
                                        var writeFile = false;
                                        var content = file.content;
                                        if (content != "") {
                                            if (file.gistName == en.FILE_EXTENSION_NAME) {
                                                var extensionlist = pluginService_1.PluginService.CreateExtensionList();
                                                extensionlist.sort(function (a, b) {
                                                    return a.name.localeCompare(b.name);
                                                });
                                                var remoteList = pluginService_1.ExtensionInformation.fromJSONList(file.content);
                                                var deletedList = pluginService_1.PluginService.GetDeletedExtensions(remoteList);
                                                for (var deletedItemIndex = 0; deletedItemIndex < deletedList.length; deletedItemIndex++) {
                                                    var deletedExtension = deletedList[deletedItemIndex];
                                                    (function (deletedExtension, ExtensionFolder) {
                                                        return __awaiter(this, void 0, void 0, function* () {
                                                            yield actionList.push(pluginService_1.PluginService.DeleteExtension(deletedExtension, en.ExtensionFolder)
                                                                .then((res) => {
                                                                //vscode.window.showInformationMessage(deletedExtension.name + '-' + deletedExtension.version + " is removed.");
                                                                deletedExtensions.push(deletedExtension);
                                                            }, (rej) => {
                                                                common.LogException(rej, common.ERROR_MESSAGE, true);
                                                            }));
                                                        });
                                                    }(deletedExtension, en.ExtensionFolder));
                                                }
                                                var missingList = pluginService_1.PluginService.GetMissingExtensions(remoteList);
                                                if (missingList.length == 0) {
                                                    vscode.window.setStatusBarMessage("");
                                                    vscode.window.setStatusBarMessage("Sync : No Extension needs to be installed.", 2000);
                                                }
                                                else {
                                                    vscode.window.setStatusBarMessage("Sync : Installing Extensions in background.");
                                                    missingList.forEach((element) => __awaiter(this, void 0, void 0, function* () {
                                                        yield actionList.push(pluginService_1.PluginService.InstallExtension(element, en.ExtensionFolder)
                                                            .then(function () {
                                                            addedExtensions.push(element);
                                                            //var name = element.publisher + '.' + element.name + '-' + element.version;
                                                            //vscode.window.showInformationMessage("Extension " + name + " installed Successfully");
                                                        }));
                                                    }));
                                                }
                                            }
                                            else {
                                                writeFile = true;
                                                if (file.gistName == en.FILE_KEYBINDING_DEFAULT || file.gistName == en.FILE_KEYBINDING_MAC) {
                                                    let test = "";
                                                    en.OsType == enums_1.OsType.Mac ? test = en.FILE_KEYBINDING_MAC : test = en.FILE_KEYBINDING_DEFAULT;
                                                    if (file.gistName != test) {
                                                        writeFile = false;
                                                    }
                                                }
                                                if (writeFile) {
                                                    if (file.gistName == en.FILE_KEYBINDING_MAC) {
                                                        file.fileName = en.FILE_KEYBINDING_DEFAULT;
                                                    }
                                                    let filePath = yield fileManager_1.FileManager.CreateDirTree(en.USER_FOLDER, file.fileName);
                                                    yield actionList.push(fileManager_1.FileManager.WriteFile(filePath, content).then(function (added) {
                                                        //TODO : add Name attribute in File and show information message here with name , when required.
                                                    }, function (error) {
                                                        common.LogException(error, common.ERROR_MESSAGE, true);
                                                        return;
                                                    }));
                                                }
                                            }
                                        }
                                    }
                                }
                                else {
                                    common.LogException(res, "Sync : Unable to Read Gist.", true);
                                }
                                Promise.all(actionList)
                                    .then(function () {
                                    return __awaiter(this, void 0, void 0, function* () {
                                        // if (!syncSetting.showSummary) {
                                        //     if (missingList.length == 0) {
                                        //         //vscode.window.showInformationMessage("No extension need to be installed");
                                        //     }
                                        //     else {
                                        //         //extension message when summary is turned off
                                        //         vscode.window.showInformationMessage("Sync : " + missingList.length + " extensions installed Successfully, Restart Required.");
                                        //     }
                                        //     if (deletedExtensions.length > 0) {
                                        //         vscode.window.showInformationMessage("Sync : " + deletedExtensions.length + " extensions deleted Successfully, Restart Required.");
                                        //     }
                                        // }
                                        yield common.SaveSettings(syncSetting).then(function (added) {
                                            return __awaiter(this, void 0, void 0, function* () {
                                                if (added) {
                                                    if (syncSetting.showSummary) {
                                                        common.GenerateSummmaryFile(false, updatedFiles, deletedExtensions, addedExtensions, localSettings);
                                                    }
                                                    vscode.window.setStatusBarMessage("");
                                                    vscode.window.setStatusBarMessage("Sync : Download Complete.", 5000);
                                                    if (Object.keys(customSettings.replaceCodeSettings).length > 0) {
                                                        let config = vscode.workspace.getConfiguration();
                                                        let keysDefined = Object.keys(customSettings.replaceCodeSettings);
                                                        keysDefined.forEach((key, index) => {
                                                            let c = undefined;
                                                            let value = customSettings.replaceCodeSettings[key];
                                                            value == "" ? c == undefined : c = value;
                                                            config.update(key, c, true);
                                                        });
                                                    }
                                                    if (syncSetting.autoUpload) {
                                                        common.StartWatch();
                                                    }
                                                }
                                                else {
                                                    vscode.window.showErrorMessage("Sync : Unable to save extension settings file.");
                                                }
                                            });
                                        }, function (errSave) {
                                            common.LogException(errSave, common.ERROR_MESSAGE, true);
                                            return;
                                        });
                                    });
                                })
                                    .catch(function (e) {
                                    common.LogException(e, common.ERROR_MESSAGE, true);
                                });
                            });
                        }, function (err) {
                            common.LogException(err, common.ERROR_MESSAGE, true);
                            return;
                        });
                    });
                }
            });
        });
        var resetSettings = vscode.commands.registerCommand('extension.resetSettings', () => __awaiter(this, void 0, void 0, function* () {
            var en = new environmentPath_1.Environment(context);
            var fManager;
            var common = new commons_1.Commons(en, context);
            var syncSetting = yield common.GetSettings();
            yield Init();
            function Init() {
                return __awaiter(this, void 0, void 0, function* () {
                    vscode.window.setStatusBarMessage("Sync : Resetting Your Settings.", 2000);
                    try {
                        syncSetting = new setting_1.ExtensionConfig();
                        yield common.SaveSettings(syncSetting).then(function (added) {
                            if (added) {
                                context.globalState.update("syncStopped", true);
                                vscode.window.showInformationMessage("Sync : Settings Cleared.");
                            }
                        }, function (err) {
                            common.LogException(err, common.ERROR_MESSAGE, true);
                            return;
                        });
                    }
                    catch (err) {
                        common.LogException(err, "Sync : Unable to clear settings. Error Logged on console. Please open an issue.", true);
                    }
                });
            }
        }));
        var howSettings = vscode.commands.registerCommand('extension.HowSettings', () => __awaiter(this, void 0, void 0, function* () {
            openurl("http://shanalikhan.github.io/2015/12/15/Visual-Studio-Code-Sync-Settings.html");
        }));
        var otherOptions = vscode.commands.registerCommand('extension.otherOptions', () => __awaiter(this, void 0, void 0, function* () {
            var en = new environmentPath_1.Environment(context);
            var common = new commons_1.Commons(en, context);
            var setting = yield common.GetSettings();
            var localSetting = new setting_1.LocalConfig();
            var tokenAvailable = setting.token != null && setting.token != "";
            var gistAvailable = setting.gist != null && setting.gist != "";
            let customSettings = yield common.GetCustomSettings();
            let items = new Array();
            items.push("Sync : Edit Extension Local Settings");
            items.push("Sync : Share Settings with Public GIST");
            items.push("Sync : Toggle Force Download");
            items.push("Sync : Toggle Auto-Upload On Settings Change");
            items.push("Sync : Toggle Auto-Download On Startup");
            items.push("Sync : Toggle Show Summary Page On Upload / Download");
            items.push("Sync : Preserve Setting to stop overide during Download");
            items.push("Sync : Open Issue");
            items.push("Sync : Release Notes");
            var selectedItem = 0;
            var settingChanged = false;
            var teims = vscode.window.showQuickPick(items).then((resolve) => __awaiter(this, void 0, void 0, function* () {
                switch (resolve) {
                    case items[0]: {
                        //extension local settings
                        var file = vscode.Uri.file(en.FILE_CUSTOMIZEDSETTINGS);
                        fs.openSync(file.fsPath, 'r');
                        yield vscode.workspace.openTextDocument(file).then((a) => {
                            vscode.window.showTextDocument(a, vscode.ViewColumn.One, true);
                        });
                        break;
                    }
                    case items[1]: {
                        //share public gist
                        yield vscode.window.showInformationMessage("Sync : This will remove current GIST and upload settings on new public GIST. Do you want to continue ?", "Yes").then((resolve) => {
                            if (resolve == "Yes") {
                                localSetting.publicGist = true;
                                settingChanged = true;
                                setting.gist = "";
                                selectedItem = 1;
                            }
                        }, (reject) => {
                            return;
                        });
                        break;
                    }
                    case items[2]: {
                        //toggle force download
                        selectedItem = 2;
                        settingChanged = true;
                        if (setting.forceDownload) {
                            setting.forceDownload = false;
                        }
                        else {
                            setting.forceDownload = true;
                        }
                        break;
                    }
                    case items[3]: {
                        //toggle auto upload
                        selectedItem = 3;
                        settingChanged = true;
                        if (setting.autoUpload) {
                            setting.autoUpload = false;
                        }
                        else {
                            setting.autoUpload = true;
                        }
                        break;
                    }
                    case items[4]: {
                        //auto downlaod on startup
                        selectedItem = 4;
                        settingChanged = true;
                        if (!setting) {
                            vscode.commands.executeCommand('extension.HowSettings');
                            return;
                        }
                        if (!tokenAvailable || !gistAvailable) {
                            vscode.commands.executeCommand('extension.HowSettings');
                            return;
                        }
                        if (setting.autoDownload) {
                            setting.autoDownload = false;
                        }
                        else {
                            setting.autoDownload = true;
                        }
                        break;
                    }
                    case items[5]: {
                        //page summary toggle
                        selectedItem = 5;
                        settingChanged = true;
                        if (!tokenAvailable || !gistAvailable) {
                            vscode.commands.executeCommand('extension.HowSettings');
                            return;
                        }
                        if (setting.showSummary) {
                            setting.showSummary = false;
                        }
                        else {
                            setting.showSummary = true;
                        }
                        break;
                    }
                    case items[6]: {
                        //preserve
                        let options = {
                            ignoreFocusOut: true,
                            placeHolder: "Enter any Key from settings.json to preserve.",
                            prompt: "Example : Write 'http.proxy' => store this computer proxy and overwrite it , if set empty it will remove proxy."
                        };
                        vscode.window.showInputBox(options).then((res) => __awaiter(this, void 0, void 0, function* () {
                            //customSettings
                            //debugger;
                            if (res) {
                                let settingKey = res;
                                let a = vscode.workspace.getConfiguration();
                                let val = a.get(settingKey);
                                customSettings.replaceCodeSettings[res] = val;
                                let done = yield common.SetCustomSettings(customSettings);
                                if (done) {
                                    if (val == "") {
                                        vscode.window.showInformationMessage("Sync : Done. " + res + " value will be removed from settings.json after downloading.");
                                    }
                                    else {
                                        vscode.window.showInformationMessage("Sync : Done. Extension will keep " + res + " : " + val + " in setting.json after downloading.");
                                    }
                                }
                            }
                        }));
                        break;
                    }
                    case items[7]: {
                        openurl("https://github.com/shanalikhan/code-settings-sync/issues/new");
                        break;
                    }
                    case items[8]: {
                        openurl("http://shanalikhan.github.io/2016/05/14/Visual-studio-code-sync-settings-release-notes.html");
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }), (reject) => {
                common.LogException(reject, "Error", true);
                return;
            }).then((resolve) => __awaiter(this, void 0, void 0, function* () {
                if (settingChanged) {
                    if (selectedItem == 1) {
                        common.CloseWatch();
                    }
                    yield common.SaveSettings(setting).then(function (added) {
                        return __awaiter(this, void 0, void 0, function* () {
                            if (added) {
                                switch (selectedItem) {
                                    case 4: {
                                        if (setting.autoDownload) {
                                            vscode.window.showInformationMessage("Sync : Auto Download turned ON upon VSCode Startup.");
                                        }
                                        else {
                                            vscode.window.showInformationMessage("Sync : Auto Download turned OFF upon VSCode Startup.");
                                        }
                                        break;
                                    }
                                    case 5: {
                                        if (setting.showSummary) {
                                            vscode.window.showInformationMessage("Sync : Summary Will be shown upon download / upload.");
                                        }
                                        else {
                                            vscode.window.showInformationMessage("Sync : Summary Will be hidden upon download / upload.");
                                        }
                                        break;
                                    }
                                    case 2: {
                                        if (setting.forceDownload) {
                                            vscode.window.showInformationMessage("Sync : Force Download Turned On.");
                                        }
                                        else {
                                            vscode.window.showInformationMessage("Sync : Force Download Turned Off.");
                                        }
                                        break;
                                    }
                                    case 3: {
                                        if (setting.autoUpload) {
                                            vscode.window.showInformationMessage("Sync : Auto upload on Setting Change Turned On. Will be affected after restart.");
                                        }
                                        else {
                                            vscode.window.showInformationMessage("Sync : Auto upload on Setting Change Turned Off.");
                                        }
                                        break;
                                    }
                                    case 1: {
                                        yield vscode.commands.executeCommand('extension.updateSettings', "publicGIST");
                                        break;
                                    }
                                }
                            }
                            else {
                                vscode.window.showErrorMessage("Unable to Toggle.");
                            }
                        });
                    }, function (err) {
                        common.LogException(err, "Sync : Unable to toggle. Please open an issue.", true);
                        return;
                    });
                }
            }), (reject) => {
                common.LogException(reject, "Error", true);
                return;
            });
        }));
        context.subscriptions.push(updateSettings);
        context.subscriptions.push(downloadSettings);
        context.subscriptions.push(resetSettings);
        context.subscriptions.push(howSettings);
        context.subscriptions.push(otherOptions);
    });
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map