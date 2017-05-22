var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const editorconfig = require("editorconfig");
const path = require("path");
const vscode_1 = require("vscode");
const Utils = require("./Utils");
const transformations_1 = require("./transformations");
/**
 * Listens to vscode document open and maintains a map
 * (Document => editor config settings)
 */
class DocumentWatcher {
    constructor() {
        const subscriptions = [];
        vscode_1.window.onDidChangeActiveTextEditor(this.onDidChangeActiveTextEditor, this, subscriptions);
        vscode_1.workspace.onDidChangeConfiguration(this.onDidChangeConfiguration, this, subscriptions);
        vscode_1.workspace.onWillSaveTextDocument(this.onWillSaveTextDocument, this, subscriptions);
        vscode_1.workspace.onDidSaveTextDocument(this.onDidSaveTextDocument, this, subscriptions);
        this.disposable = vscode_1.Disposable.from(...subscriptions);
        this.rebuildConfigMap();
        this.onDidChangeConfiguration();
    }
    dispose() {
        this.disposable.dispose();
    }
    onDidChangeActiveTextEditor(editor) {
        if (editor && editor.document) {
            this.onDidOpenDocument(editor.document);
        }
    }
    onDidOpenDocument(doc) {
        if (doc.isUntitled) {
            return Promise.resolve();
        }
        const path = doc.fileName;
        if (this.documentToConfigMap[path]) {
            this.applyEditorConfigToTextEditor();
            return Promise.resolve();
        }
        return editorconfig.parse(path)
            .then((config) => {
            if (config.indent_size === 'tab') {
                config.indent_size = config.tab_width;
            }
            this.documentToConfigMap[path] = config;
            this.applyEditorConfigToTextEditor();
        });
    }
    applyEditorConfigToTextEditor() {
        const editor = vscode_1.window.activeTextEditor;
        if (!editor) {
            // No more open editors
            return;
        }
        const doc = editor.document;
        const editorconfig = this.getSettingsForDocument(doc);
        if (!editorconfig) {
            // no configuration found for this file
            return;
        }
        const newOptions = Utils.fromEditorConfig(editorconfig, this.getDefaultSettings());
        // tslint:disable-next-line:no-any
        editor.options = newOptions;
    }
    getSettingsForDocument(document) {
        return this.documentToConfigMap[document.fileName];
    }
    getDefaultSettings() {
        return this.defaults;
    }
    onDidChangeConfiguration() {
        const workspaceConfig = vscode_1.workspace.getConfiguration('editor');
        const detectIndentation = workspaceConfig.get('detectIndentation');
        this.defaults = (detectIndentation) ? {} : {
            tabSize: workspaceConfig.get('tabSize'),
            insertSpaces: workspaceConfig.get('insertSpaces')
        };
    }
    onWillSaveTextDocument(e) {
        let selections;
        if (vscode_1.window.activeTextEditor.document === e.document) {
            selections = vscode_1.window.activeTextEditor.selections;
        }
        const transformations = this.calculatePreSaveTransformations(e.document);
        e.waitUntil(transformations);
        if (selections) {
            transformations.then(() => {
                vscode_1.window.activeTextEditor.selections = selections;
            });
        }
    }
    calculatePreSaveTransformations(textDocument) {
        return __awaiter(this, void 0, void 0, function* () {
            const editorconfig = this.getSettingsForDocument(textDocument);
            if (!editorconfig) {
                // no configuration found for this file
                return Promise.resolve();
            }
            yield transformations_1.endOfLineTransform(editorconfig, textDocument);
            return [
                ...transformations_1.insertFinalNewlineTransform(editorconfig, textDocument),
                ...transformations_1.trimTrailingWhitespaceTransform(editorconfig, textDocument)
            ];
        });
    }
    /**
     * Listen for saves to ".editorconfig" files and rebuild the map.
     */
    onDidSaveTextDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            if (path.basename(doc.fileName) === '.editorconfig') {
                yield this.rebuildConfigMap();
            }
        });
    }
    /**
     * Build the map (cover the case that documents were opened before
     * my activation)
     */
    rebuildConfigMap() {
        this.documentToConfigMap = {};
        return Promise.all(vscode_1.workspace.textDocuments.map(document => this.onDidOpenDocument(document)));
    }
}
exports.default = DocumentWatcher;
//# sourceMappingURL=DocumentWatcher.js.map