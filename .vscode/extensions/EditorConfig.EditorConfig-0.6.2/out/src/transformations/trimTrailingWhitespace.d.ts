import * as editorconfig from 'editorconfig';
import { TextEditor, TextDocument } from 'vscode';
/**
 * Transform the textdocument by trimming the trailing whitespace.
 */
export declare function transform(editorconfig: editorconfig.knownProps, editor: TextEditor, textDocument: TextDocument): Thenable<void | boolean[]>;
