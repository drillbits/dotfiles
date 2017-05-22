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
        // Listen for changes in the active text editor
        subscriptions.push(vscode_1.window.onDidChangeActiveTextEditor(textEditor => {
            if (textEditor && textEditor.document) {
                this._onDidOpenDocument(textEditor.document);
            }
        }));
        // Listen for changes in the configuration
        subscriptions.push(vscode_1.workspace.onDidChangeConfiguration(this._onConfigChanged.bind(this)));
        // Listen for saves to ".editorconfig" files and rebuild the map
        subscriptions.push(vscode_1.workspace.onDidSaveTextDocument(savedDocument => {
            if (path.basename(savedDocument.fileName) === '.editorconfig') {
                // Saved an .editorconfig file => rebuild map entirely and then
                // apply the changes to the .editorconfig file itself
                this._rebuildConfigMap();
                // TODO The transformations should be applied to the .editorconfig`
                // file as well after the config has been rebuilt
                // this._rebuildConfigMap().then(applyOnSaveTransformations.bind(
                // 	undefined,
                // 	savedDocument,
                // 	this
                // ));
                return;
            }
        }));
        subscriptions.push(vscode_1.workspace.onWillSaveTextDocument(e => {
            const edits = calculatePreSaveTransformations(e.document, this);
            e.waitUntil(Promise.resolve(edits));
        }));
        // dispose event subscriptons upon disposal
        this._disposable = vscode_1.Disposable.from.apply(this, subscriptions);
        // Build the map (cover the case that documents were opened before
        // my activation)
        this._rebuildConfigMap();
        // Load the initial workspace configuration
        this._onConfigChanged();
    }
    dispose() {
        this._disposable.dispose();
    }
    getSettingsForDocument(document) {
        return this._documentToConfigMap[document.fileName];
    }
    getDefaultSettings() {
        return this._defaults;
    }
    _rebuildConfigMap() {
        this._documentToConfigMap = {};
        return Promise.all(vscode_1.workspace.textDocuments.map(document => this._onDidOpenDocument(document)));
    }
    _onDidOpenDocument(document) {
        if (document.isUntitled) {
            // Does not have a fs path
            return Promise.resolve();
        }
        const path = document.fileName;
        if (this._documentToConfigMap[path]) {
            applyEditorConfigToTextEditor(vscode_1.window.activeTextEditor, this);
            return Promise.resolve();
        }
        return editorconfig.parse(path)
            .then((config) => {
            if (config.indent_size === 'tab') {
                config.indent_size = config.tab_width;
            }
            this._documentToConfigMap[path] = config;
            return applyEditorConfigToTextEditor(vscode_1.window.activeTextEditor, this);
        });
    }
    _onConfigChanged() {
        const workspaceConfig = vscode_1.workspace.getConfiguration('editor');
        const detectIndentation = workspaceConfig.get('detectIndentation');
        this._defaults = (detectIndentation) ? {} : {
            tabSize: workspaceConfig.get('tabSize'),
            insertSpaces: workspaceConfig.get('insertSpaces')
        };
    }
}
function calculatePreSaveTransformations(textDocument, provider) {
    const editorconfig = provider.getSettingsForDocument(textDocument);
    if (!editorconfig) {
        // no configuration found for this file
        return;
    }
    return [
        ...transformations_1.insertFinalNewlineTransform(editorconfig, textDocument),
        ...transformations_1.trimTrailingWhitespaceTransform(editorconfig, textDocument)
    ];
}
function applyEditorConfigToTextEditor(textEditor, provider) {
    if (!textEditor) {
        // No more open editors
        return Promise.resolve();
    }
    const doc = textEditor.document;
    const editorconfig = provider.getSettingsForDocument(doc);
    if (!editorconfig) {
        // no configuration found for this file
        return Promise.resolve();
    }
    const newOptions = Utils.fromEditorConfig(editorconfig, provider.getDefaultSettings());
    /* tslint:disable:no-any */
    textEditor.options = newOptions;
    /* tslint:enable */
    return transformations_1.endOfLineTransform(editorconfig, textEditor);
}
exports.default = DocumentWatcher;
//# sourceMappingURL=DocumentWatcher.js.map