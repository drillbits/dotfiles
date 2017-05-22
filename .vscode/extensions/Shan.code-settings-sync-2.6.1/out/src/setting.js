"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//"use strict";
const environmentPath_1 = require("./environmentPath");
class ExtensionConfig {
    constructor() {
        this.token = null;
        this.gist = null;
        this.lastUpload = null;
        this.autoDownload = false;
        this.autoUpload = false;
        this.lastDownload = null;
        this.version = null;
        this.showSummary = true;
        this.forceDownload = false;
        this.anonymousGist = false;
        this.host = null;
        this.pathPrefix = null;
        this.version = environmentPath_1.Environment.CURRENT_VERSION;
    }
}
exports.ExtensionConfig = ExtensionConfig;
class LocalConfig {
    constructor() {
        this.publicGist = false;
        this.userName = null;
        this.name = null;
        this.config = null;
        this.config = new ExtensionConfig();
    }
}
exports.LocalConfig = LocalConfig;
class CloudSetting {
    constructor() {
        this.lastUpload = null;
        this.extensionVersion = null;
        this.extensionVersion = "v" + environmentPath_1.Environment.getVersion();
    }
}
exports.CloudSetting = CloudSetting;
class CustomSettings {
    constructor() {
        this.ignoreUploadFiles = null;
        this.ignoreUploadFolders = null;
        this.replaceCodeSettings = null;
        this.ignoreUploadFiles = new Array();
        this.ignoreUploadFolders = new Array();
        this.replaceCodeSettings = new Object();
        this.ignoreUploadFolders.push("workspaceStorage");
        this.ignoreUploadFiles.push("projects.json");
        this.ignoreUploadFiles.push("projects_cache_git.json");
        //this.replaceCodeSettings.push(new NameValuePair("http.proxy",""));
    }
}
exports.CustomSettings = CustomSettings;
//# sourceMappingURL=setting.js.map