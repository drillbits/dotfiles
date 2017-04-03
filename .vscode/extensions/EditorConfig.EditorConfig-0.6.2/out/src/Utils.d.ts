import * as editorconfig from 'editorconfig';
import { EditorSettings } from './interfaces/editorSettings';
import { TextDocument, TextEditor } from 'vscode';
/**
 * Convert .editorconfig values to vscode editor options
 */
export declare function fromEditorConfig(config: editorconfig.knownProps, defaults: EditorSettings): EditorSettings;
/**
 * Convert vscode editor options to .editorconfig values
 */
export declare function toEditorConfig(options: EditorSettings): editorconfig.knownProps;
/**
 * Convert vscode tabSize option into numeric value
 */
export declare function resolveTabSize(tabSize: number | string): number;
/**
 * Retrieve the current active text editor.
 */
export declare function findEditor(textDocument: TextDocument): TextEditor;
