import * as editorconfig from 'editorconfig';
import { TextDocument } from 'vscode';
import { EditorConfigProvider } from './interfaces/editorConfigProvider';
import { EditorSettings } from './interfaces/editorSettings';
/**
 * Listens to vscode document open and maintains a map
 * (Document => editor config settings)
 */
declare class DocumentWatcher implements EditorConfigProvider {
    private _documentToConfigMap;
    private _disposable;
    private _defaults;
    constructor();
    dispose(): void;
    getSettingsForDocument(document: TextDocument): editorconfig.knownProps;
    getDefaultSettings(): EditorSettings;
    private _rebuildConfigMap();
    private _onDidOpenDocument(document);
    private _onConfigChanged();
}
export default DocumentWatcher;
