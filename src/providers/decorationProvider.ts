/**
 * Decoration Provider - Handles visual highlighting of diff changes
 * Git-style diff view: red blocks for deleted lines, green blocks for added lines
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DiffChange, ExtensionConfig } from '../models/types';

export class DecorationProvider implements vscode.Disposable {
    private sessionManager: SessionManager;

    // Decoration types for different change types
    private addedLineDecoration: vscode.TextEditorDecorationType;

    // For modifications: show new content with green background
    private modifiedNewLineDecoration: vscode.TextEditorDecorationType;

    // For deleted content block (rendered above the change)
    private deletedBlockDecoration: vscode.TextEditorDecorationType;

    // Gutter decorations
    private addedGutterDecoration: vscode.TextEditorDecorationType;
    private deletedGutterDecoration: vscode.TextEditorDecorationType;

    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;

        // Get colors from configuration
        const config = this.getConfig();

        // Create decoration types
        // 1. Added lines (pure green background)
        this.addedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added,
            isWholeLine: true,
            overviewRulerColor: 'rgba(46, 160, 67, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // 2. Modified new content (green background - same as added)
        this.modifiedNewLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added,
            isWholeLine: true,
            overviewRulerColor: 'rgba(46, 160, 67, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // 3. Deleted block decoration
        // This attaches to the START of the change block and renders the deleted content
        // as a block element ABOVE the current line.
        // We use 'before' with formatted content string.
        this.deletedBlockDecoration = vscode.window.createTextEditorDecorationType({
            isWholeLine: true,
            before: {
                backgroundColor: config.highlightColors.deleted,
                color: 'rgba(200, 200, 200, 0.7)', // Faded text for deleted content

                // Important: rendering properties to make it look like code block
                fontStyle: 'normal',
                fontWeight: 'normal',
                textDecoration: 'none',

                // ensure it takes full width if possible (though limited by VSCode API)
            }
        });

        // Gutter icons
        this.addedGutterDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIconUri('green'),
            gutterIconSize: 'contain'
        });

        this.deletedGutterDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIconUri('red'),
            gutterIconSize: 'contain'
        });

        // Listen for events
        this.sessionManager.on('changeUpdated', () => this.refreshAllEditors());
        this.sessionManager.on('sessionEnded', () => this.clearAllDecorations());
        this.sessionManager.on('sessionRestored', () => this.refreshAllEditors());

        // Listen for editor changes
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.applyDecorations(editor);
                }
            })
        );

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document === event.document
                );
                if (editor) {
                    setTimeout(() => this.applyDecorations(editor), 100);
                }
            })
        );
    }

    private getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration('commitDiffReviewer');
        return {
            maxCommitsInList: config.get('maxCommitsInList', 20),
            highlightColors: config.get('highlightColors', {
                added: 'rgba(46, 160, 67, 0.2)',
                deleted: 'rgba(248, 81, 73, 0.2)', // Red background
                modified: 'rgba(210, 153, 34, 0.2)'
            })
        };
    }

    private createGutterIconUri(color: string): vscode.Uri {
        const colorMap: Record<string, string> = { 'green': '#2ea043', 'red': '#f85149' };
        const svgColor = colorMap[color] || color;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="16"><rect width="6" height="16" fill="${svgColor}"/></svg>`;
        return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    }

    applyDecorations(editor: vscode.TextEditor): void {
        if (!this.sessionManager.hasActiveSession()) {
            this.clearDecorations(editor);
            return;
        }

        const filePath = editor.document.uri.fsPath.replace(/\\/g, '/');
        const changes = this.sessionManager.getPendingChangesForFile(filePath);

        const addedRanges: vscode.DecorationOptions[] = [];
        const modifiedNewRanges: vscode.DecorationOptions[] = [];
        const deletedBlockRanges: vscode.DecorationOptions[] = [];
        const addedGutterRanges: vscode.DecorationOptions[] = [];
        const deletedGutterRanges: vscode.DecorationOptions[] = [];

        for (const change of changes) {
            switch (change.type) {
                case 'add':
                    this.addDecorationRanges(change, editor.document, addedRanges, addedGutterRanges);
                    break;

                case 'delete':
                    // Pure deletion: Attach "before" decoration to the line WHERE it should have been.
                    // If at end of file, attach to last line.
                    this.addDeletedBlockDecoration(change, editor.document, deletedBlockRanges, deletedGutterRanges);
                    break;

                case 'modify':
                    // Modification: Deleted block ABOVE, New content usage existing lines.
                    this.addDeletedBlockDecoration(change, editor.document, deletedBlockRanges, deletedGutterRanges);
                    this.addModificationNewRanges(change, editor.document, modifiedNewRanges, addedGutterRanges);
                    break;
            }
        }

        editor.setDecorations(this.addedLineDecoration, addedRanges);
        editor.setDecorations(this.modifiedNewLineDecoration, modifiedNewRanges);
        editor.setDecorations(this.deletedBlockDecoration, deletedBlockRanges);
        editor.setDecorations(this.addedGutterDecoration, addedGutterRanges);
        editor.setDecorations(this.deletedGutterDecoration, deletedGutterRanges);
    }

    private addDecorationRanges(
        change: DiffChange,
        document: vscode.TextDocument,
        ranges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        const startLine = change.newLineStart - 1;
        const endLine = startLine + change.newLineCount;

        for (let i = startLine; i < endLine && i < document.lineCount; i++) {
            const range = document.lineAt(i).range;
            ranges.push({ range });
            gutterRanges.push({ range: new vscode.Range(i, 0, i, 0) });
        }
    }

    // Handles the "Green" part of a modification
    private addModificationNewRanges(
        change: DiffChange,
        document: vscode.TextDocument,
        ranges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        const startLine = change.newLineStart - 1;
        const endLine = startLine + change.newLineCount;

        for (let i = startLine; i < endLine && i < document.lineCount; i++) {
            const range = document.lineAt(i).range;
            ranges.push({ range });
            gutterRanges.push({ range: new vscode.Range(i, 0, i, 0) });
        }
    }

    // Handles the "Red" part (deleted content) by injecting a block visual
    private addDeletedBlockDecoration(
        change: DiffChange,
        document: vscode.TextDocument,
        ranges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        if (!change.oldContent || change.oldContent.length === 0) return;

        // Target line to attach the "before" decoration
        let targetLineIndex = change.newLineStart - 1;

        // Safety check boundaries
        if (targetLineIndex < 0) targetLineIndex = 0;
        if (targetLineIndex >= document.lineCount) targetLineIndex = document.lineCount - 1;

        const targetLine = document.lineAt(targetLineIndex);

        // Format old content: Prefix with '-' to mimic git diff
        const deletedText = change.oldContent.map(line => `- ${line}`).join('\n') + '\n';
        const lineCount = change.oldContent.length;

        // Create the decoration option
        ranges.push({
            range: new vscode.Range(targetLineIndex, 0, targetLineIndex, 0), // Start of the line
            renderOptions: {
                before: {
                    contentText: deletedText,
                    // Use CSS hacks via textDecoration to force block display and pre-formatting
                    // 'none' closes the text-decoration property, allowing injection of other properties
                    textDecoration: 'none; display: block; white-space: pre; width: 100%; box-sizing: border-box;',

                    color: 'rgba(255, 255, 255, 0.5)', // Distinct text color
                    backgroundColor: 'rgba(200, 50, 50, 0.3)', // Red background for the block
                    margin: '0 0 0 0', // Reset margin
                    fontStyle: 'normal'
                }
            }
        });

        // Add red gutter indication
        // Since we can't easily expand gutter height for virtual lines, 
        // we attach the red gutter to the same anchor line, potentially overlapping or side-by-side.
        // Or we prioritize the green gutter if it's a modification.
        // Let's rely on the red block background for visibility.
    }

    clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.addedLineDecoration, []);
        editor.setDecorations(this.modifiedNewLineDecoration, []);
        editor.setDecorations(this.deletedBlockDecoration, []);
        editor.setDecorations(this.addedGutterDecoration, []);
        editor.setDecorations(this.deletedGutterDecoration, []);
    }

    clearAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.clearDecorations(editor);
        }
    }

    refreshAllEditors(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.applyDecorations(editor);
        }
    }

    dispose(): void {
        this.addedLineDecoration.dispose();

        this.modifiedNewLineDecoration.dispose();
        this.deletedBlockDecoration.dispose();
        this.addedGutterDecoration.dispose();
        this.deletedGutterDecoration.dispose();
        for (const d of this.disposables) d.dispose();
    }
}
