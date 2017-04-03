var vscode = require('vscode');
var cp = require('child_process');
var lineDecoder_1 = require('./lineDecoder');
var PostgresqlCommandProvider = (function () {
    function PostgresqlCommandProvider() {
    }
    PostgresqlCommandProvider.prototype.activate = function (subscriptions) {
        this.executable = "psql";
        vscode.workspace.onDidChangeConfiguration(this.loadConfiguration, this, subscriptions);
        //vscode.workspace.onDidOpenTextDocument(this.changeCurrFile, this, subscriptions);
        this.loadConfiguration();
    };
    PostgresqlCommandProvider.prototype.changeCurrFile = function (newDoc) {
        //this.currPath = newDoc.fileName;
    };
    PostgresqlCommandProvider.prototype.loadConfiguration = function () {
        var section = vscode.workspace.getConfiguration('postgreSql');
        if (section) {
            this.hostName = section.get('hostName', null);
            this.username = section.get('username', null);
            this.dbName = section.get('dbName', null);
        }
    };
    PostgresqlCommandProvider.prototype.execFile = function () {
        var _this = this;
        if (this.hostName != null
            && this.username != null
            && this.dbName != null) {
            var editor = vscode.window.activeTextEditor;
            if (!editor) {
                return; // No open text editor
            }
            var currDocPath = editor.document.fileName;
            var args = ["-d", this.dbName, "-U", this.username, "-h", this.hostName, "-f", currDocPath];
            var childProcess = cp.spawn(this.executable, args);
            childProcess.on('error', function (error) {
                var message = null;
                if (error.code === 'ENOENT') {
                    message = "Cannot run the pgsql file. The psql program was not found. Please ensure the psql program is in yourt Path";
                }
                else {
                    message = error.message ? error.message : "Failed to run psql using path: " + _this.executable + ". Reason is unknown.";
                }
                vscode.window.showInformationMessage(message);
            });
            if (childProcess.pid) {
                var outChannel = vscode.window.createOutputChannel("psqlOutput");
                var decoder = new lineDecoder_1.default();
                outChannel.show(vscode.ViewColumn.Two);
                childProcess.stdout.on('data', function (data) {
                    decoder.write(data).forEach(function (line) {
                        outChannel.appendLine(line);
                    });
                });
                childProcess.stdout.on('end', function () {
                    outChannel.appendLine('psql finished running');
                });
            }
            else {
            }
        }
    };
    return PostgresqlCommandProvider;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PostgresqlCommandProvider;
//# sourceMappingURL=commandProvider.js.map