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

    // For deleted content block (rendered at End of Line to prevent layout overlap)
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

        // 3. Deleted block decoration (Inline at end of line)
        // Note: We avoid 'display: block' because it causes layout overlap with subsequent lines
        // in VSCode's current rendering engine.
        // Instead, we use a distinct 'after' decoration that looks like a block to the side.
        this.deletedBlockDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(255, 255, 255, 0.6)',
                backgroundColor: 'rgba(200, 50, 50, 0.2)',
                margin: '0 0 0 20px', // Spacing from code
                border: '1px solid rgba(200, 50, 50, 0.4)',
                fontStyle: 'italic'
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
                    // Pure deletion: Attach "after" decoration to the previous line (if possible),
                    // or "before" if start of file.
                    this.addDeletedBlockDecoration(change, editor.document, deletedBlockRanges, deletedGutterRanges);
                    break;

                case 'modify':
                    // Modification: Deleted content shown inline (end of line)
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

    // Handles the "Red" part (deleted content)
    private addDeletedBlockDecoration(
        change: DiffChange,
        document: vscode.TextDocument,
        ranges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        if (!change.oldContent || change.oldContent.length === 0) return;

        // Target: We prefer to show it at the end of the *first added line* for modifications.
        // For pure deletions, we show it at end of *previous line* (or next line if line 0).
        let targetLineIndex = change.newLineStart - 1;

        // Safety bound
        if (targetLineIndex < 0) targetLineIndex = 0;
        if (targetLineIndex >= document.lineCount) targetLineIndex = document.lineCount - 1;

        const targetLine = document.lineAt(targetLineIndex);

        // Formatting:
        // Since we can't do multi-line blocks reliably without overlap, 
        // we truncate to single line + ellipsis. Full content in Hover.
        const maxDisplayLength = 60;
        const firstLine = change.oldContent[0];
        let displayText = `- ${firstLine.trim()}`;
        if (displayText.length > maxDisplayLength) {
            displayText = displayText.substring(0, maxDisplayLength) + '...';
        }

        if (change.oldContent.length > 1) {
            displayText += ` (+${change.oldContent.length - 1} more lines)`;
        }

        // Full content for hover (Git diff style)
        const hoverContent = new vscode.MarkdownString();
        hoverContent.appendMarkdown('**🔴 Deleted Content:**\n\n');
        hoverContent.appendCodeblock(change.oldContent.join('\n'), 'text');

        // Note: We use 'after' to append to end of line.
        // This ensures NO layout shift and NO overlap.
        // We add padding to separate it from code.
        ranges.push({
            range: new vscode.Range(targetLineIndex, targetLine.range.end.character, targetLineIndex, targetLine.range.end.character),
            renderOptions: {
                after: {
                    contentText: `  |  ${displayText}`, // Separator
                    fontWeight: 'bold',
                    color: 'rgba(255, 100, 100, 0.8)', // Brighter red text
                    backgroundColor: 'rgba(50, 0, 0, 0.2)', // Subtle background
                }
            },
            hoverMessage: hoverContent
        });

        // Add red gutter indication
        deletedGutterRanges.push({
            range: new vscode.Range(targetLineIndex, 0, targetLineIndex, 0)
        });
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
