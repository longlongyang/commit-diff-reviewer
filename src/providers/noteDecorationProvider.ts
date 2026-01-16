
import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { ReviewNote } from '../models/types';
import * as path from 'path';

export class NoteDecorationProvider implements vscode.Disposable {
    private sessionManager: SessionManager;
    private noteDecoration: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager, context: vscode.ExtensionContext) {
        this.sessionManager = sessionManager;

        // Create decoration type
        this.noteDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(0, 100, 255, 0.1)',
            gutterIconPath: context.asAbsolutePath(path.join('images', 'note.svg')),
            gutterIconSize: 'contain',
            isWholeLine: true // Or false if we want selection specific
        });

        // Listen for events
        this.registerListener('notesUpdated', () => this.refreshAllEditors());
        this.registerListener('sessionRestored', () => this.refreshAllEditors());

        this.disposables.push(
            vscode.window.onDidChangeVisibleTextEditors(() => this.refreshAllEditors())
        );

        // Initial refresh
        this.refreshAllEditors();
    }

    private registerListener(event: string, callback: (...args: any[]) => void): void {
        this.sessionManager.on(event, callback);
        this.disposables.push({
            dispose: () => this.sessionManager.off(event, callback)
        });
    }

    /**
     * Refresh decorations for all visible editors
     */
    public refreshAllEditors(): void {
        vscode.window.visibleTextEditors.forEach(editor => {
            this.applyDecorations(editor);
        });
    }

    /**
     * Apply decorations to a specific editor
     */
    public applyDecorations(editor: vscode.TextEditor): void {
        if (!this.sessionManager.hasActiveSession()) {
            this.clearDecorations(editor);
            return;
        }

        const filePath = editor.document.uri.fsPath.replace(/\\/g, '/');
        const notes = this.sessionManager.getNotesForFile(filePath);

        if (notes.length === 0) {
            this.clearDecorations(editor);
            return;
        }

        const decorations: vscode.DecorationOptions[] = notes.map(note => {
            const line = note.line - 1; // 0-indexed
            const range = new vscode.Range(line, 0, line, 0);

            // Create hover message with note content
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Review Note**\n\n${note.content}`);
            markdown.isTrusted = true;

            return {
                range,
                hoverMessage: markdown
            };
        });

        editor.setDecorations(this.noteDecoration, decorations);
    }

    /**
     * Remove all decorations from an editor
     */
    public clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.noteDecoration, []);
    }

    dispose() {
        this.noteDecoration.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
