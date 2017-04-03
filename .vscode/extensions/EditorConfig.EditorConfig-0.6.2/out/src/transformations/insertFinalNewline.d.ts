import * as editorconfig from 'editorconfig';
import { TextEditor, TextDocument } from 'vscode';
/**
 * Transform the textdocument by inserting a final newline.
 */
export declare function transform(editorconfig: editorconfig.knownProps, editor: TextEditor, textDocument: TextDocument): Thenable<boolean | void>;
