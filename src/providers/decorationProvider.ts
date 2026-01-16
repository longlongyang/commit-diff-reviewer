/**
 * Decoration Provider - Handles visual highlighting of diff changes
 * GitHub-style diff view: red for deleted, green for added
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DiffChange, ExtensionConfig } from '../models/types';

export class DecorationProvider implements vscode.Disposable {
    private sessionManager: SessionManager;

    // Decoration types for different change types
    private addedLineDecoration: vscode.TextEditorDecorationType;
    private deletedLineDecoration: vscode.TextEditorDecorationType;

    // For modifications: show new content with green background
    private modifiedNewLineDecoration: vscode.TextEditorDecorationType;

    // Ghost decoration for showing deleted content as inline annotation
    private deletedGhostDecoration: vscode.TextEditorDecorationType;

    // Gutter decorations (only green and red)
    private addedGutterDecoration: vscode.TextEditorDecorationType;
    private deletedGutterDecoration: vscode.TextEditorDecorationType;

    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;

        // Get colors from configuration
        const config = this.getConfig();

        // Create decoration types - Added lines (pure green background)
        this.addedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added,
            isWholeLine: true,
            overviewRulerColor: 'rgba(46, 160, 67, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // Deleted lines indicator (red background for the gutter area indicator)
        this.deletedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.deleted,
            isWholeLine: true,
            overviewRulerColor: 'rgba(248, 81, 73, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // Modified new content (green background - same as added)
        this.modifiedNewLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added,
            isWholeLine: true,
            overviewRulerColor: 'rgba(46, 160, 67, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // Ghost decoration - shows at end of line with deleted content indicator
        this.deletedGhostDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                color: 'rgba(248, 81, 73, 1)',
                fontStyle: 'italic'
            }
        });

        // Gutter icons - only green and red
        this.addedGutterDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIconUri('green'),
            gutterIconSize: 'contain'
        });

        this.deletedGutterDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIconUri('red'),
            gutterIconSize: 'contain'
        });

        // Listen for session events
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
                    // Debounce decoration refresh
                    setTimeout(() => this.applyDecorations(editor), 100);
                }
            })
        );
    }

    /**
     * Get extension configuration
     */
    private getConfig(): ExtensionConfig {
        const config = vscode.workspace.getConfiguration('commitDiffReviewer');
        return {
            maxCommitsInList: config.get('maxCommitsInList', 20),
            highlightColors: config.get('highlightColors', {
                added: 'rgba(46, 160, 67, 0.25)',
                deleted: 'rgba(248, 81, 73, 0.25)',
                modified: 'rgba(210, 153, 34, 0.25)'
            })
        };
    }

    /**
     * Create a data URI for gutter icon
     */
    private createGutterIconUri(color: string): vscode.Uri {
        const colorMap: Record<string, string> = {
            'green': '#2ea043',
            'red': '#f85149'
        };

        const svgColor = colorMap[color] || color;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="16">
            <rect width="6" height="16" fill="${svgColor}"/>
        </svg>`;

        return vscode.Uri.parse(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`);
    }

    /**
     * Apply decorations to an editor
     */
    applyDecorations(editor: vscode.TextEditor): void {
        if (!this.sessionManager.hasActiveSession()) {
            this.clearDecorations(editor);
            return;
        }

        const filePath = editor.document.uri.fsPath.replace(/\\/g, '/');
        const changes = this.sessionManager.getPendingChangesForFile(filePath);

        const addedRanges: vscode.DecorationOptions[] = [];
        const modifiedNewRanges: vscode.DecorationOptions[] = [];
        const ghostRanges: vscode.DecorationOptions[] = [];

        const addedGutterRanges: vscode.DecorationOptions[] = [];
        const deletedGutterRanges: vscode.DecorationOptions[] = [];

        for (const change of changes) {
            switch (change.type) {
                case 'add':
                    // Pure addition - green background
                    this.addDecorationRanges(change, editor.document, addedRanges, addedGutterRanges);
                    break;

                case 'delete':
                    // Pure deletion - show at the line where content was deleted
                    if (change.oldContent.length > 0) {
                        const deleteLine = Math.max(0, change.newLineStart - 1);
                        const safeLine = Math.min(deleteLine, editor.document.lineCount - 1);
                        const lineText = editor.document.lineAt(safeLine).text;

                        // Show deletion indicator at end of the line
                        const deletedPreview = change.oldContent.length === 1
                            ? change.oldContent[0].substring(0, 50) + (change.oldContent[0].length > 50 ? '...' : '')
                            : `${change.oldContent.length} lines`;

                        ghostRanges.push({
                            range: new vscode.Range(safeLine, lineText.length, safeLine, lineText.length),
                            renderOptions: {
                                after: {
                                    contentText: `  ⊖ deleted: ${deletedPreview}`,
                                    color: 'rgba(248, 81, 73, 0.9)',
                                    backgroundColor: 'rgba(248, 81, 73, 0.15)',
                                    fontStyle: 'italic',
                                    border: '1px solid rgba(248, 81, 73, 0.3)',
                                    margin: '0 0 0 10px'
                                }
                            },
                            hoverMessage: this.createDeletedContentHover(change.oldContent)
                        });

                        deletedGutterRanges.push({
                            range: new vscode.Range(safeLine, 0, safeLine, 0)
                        });
                    }
                    break;

                case 'modify':
                    // Modification - show new content with green + indicator for old content
                    this.addModificationDecorations(
                        change,
                        editor.document,
                        modifiedNewRanges,
                        ghostRanges,
                        addedGutterRanges,
                        deletedGutterRanges
                    );
                    break;
            }
        }

        // Apply all decorations
        editor.setDecorations(this.addedLineDecoration, addedRanges);
        editor.setDecorations(this.modifiedNewLineDecoration, modifiedNewRanges);
        editor.setDecorations(this.deletedGhostDecoration, ghostRanges);

        editor.setDecorations(this.addedGutterDecoration, addedGutterRanges);
        editor.setDecorations(this.deletedGutterDecoration, deletedGutterRanges);
    }

    /**
     * Add decoration ranges for added lines
     */
    private addDecorationRanges(
        change: DiffChange,
        document: vscode.TextDocument,
        mainRanges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        const startLine = change.newLineStart - 1;
        const endLine = startLine + change.newLineCount;

        for (let lineNum = startLine; lineNum < endLine && lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);
            mainRanges.push({
                range: line.range,
                hoverMessage: new vscode.MarkdownString('**➕ Added line**')
            });
            gutterRanges.push({
                range: new vscode.Range(lineNum, 0, lineNum, 0)
            });
        }
    }

    /**
     * Add decorations for modified lines (GitHub-style: red indicator + green for new)
     */
    private addModificationDecorations(
        change: DiffChange,
        document: vscode.TextDocument,
        newLineRanges: vscode.DecorationOptions[],
        ghostRanges: vscode.DecorationOptions[],
        addedGutterRanges: vscode.DecorationOptions[],
        deletedGutterRanges: vscode.DecorationOptions[]
    ): void {
        const startLine = change.newLineStart - 1;
        const endLine = startLine + change.newLineCount;

        // Show new content with green background
        for (let lineNum = startLine; lineNum < endLine && lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);
            const isFirstLine = lineNum === startLine;

            // For the first modified line, add the deleted content indicator at the end
            if (isFirstLine && change.oldContent.length > 0) {
                const oldPreview = change.oldContent.length === 1
                    ? change.oldContent[0].substring(0, 40) + (change.oldContent[0].length > 40 ? '...' : '')
                    : `${change.oldContent.length} lines changed`;

                ghostRanges.push({
                    range: new vscode.Range(lineNum, line.text.length, lineNum, line.text.length),
                    renderOptions: {
                        after: {
                            contentText: `  ⊖ was: ${oldPreview}`,
                            color: 'rgba(248, 81, 73, 0.9)',
                            backgroundColor: 'rgba(248, 81, 73, 0.15)',
                            fontStyle: 'italic',
                            border: '1px solid rgba(248, 81, 73, 0.3)',
                            margin: '0 0 0 10px'
                        }
                    },
                    hoverMessage: this.createModificationHover(change)
                });

                // Add red gutter for first line to indicate something was removed
                deletedGutterRanges.push({
                    range: new vscode.Range(lineNum, 0, lineNum, 0)
                });
            }

            newLineRanges.push({
                range: line.range,
                hoverMessage: this.createModificationHover(change)
            });

            // Green gutter for all lines
            addedGutterRanges.push({
                range: new vscode.Range(lineNum, 0, lineNum, 0)
            });
        }
    }

    /**
     * Create hover message showing deleted content
     */
    private createDeletedContentHover(oldContent: string[]): vscode.MarkdownString {
        const hover = new vscode.MarkdownString();
        hover.appendMarkdown('**🔴 Deleted content:**\n\n');
        hover.appendCodeblock(oldContent.join('\n'), 'text');
        return hover;
    }

    /**
     * Create hover message for modification
     */
    private createModificationHover(change: DiffChange): vscode.MarkdownString {
        const hover = new vscode.MarkdownString();
        hover.appendMarkdown('**📝 Modified**\n\n');
        hover.appendMarkdown('**Before (deleted):**\n');
        hover.appendCodeblock(change.oldContent.join('\n'), 'text');
        hover.appendMarkdown('\n**After (current):**\n');
        hover.appendCodeblock(change.newContent.join('\n'), 'text');
        return hover;
    }

    /**
     * Clear decorations from an editor
     */
    clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.addedLineDecoration, []);
        editor.setDecorations(this.deletedLineDecoration, []);
        editor.setDecorations(this.modifiedNewLineDecoration, []);
        editor.setDecorations(this.deletedGhostDecoration, []);
        editor.setDecorations(this.addedGutterDecoration, []);
        editor.setDecorations(this.deletedGutterDecoration, []);
    }

    /**
     * Clear decorations from all editors
     */
    clearAllDecorations(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.clearDecorations(editor);
        }
    }

    /**
     * Refresh decorations in all visible editors
     */
    refreshAllEditors(): void {
        for (const editor of vscode.window.visibleTextEditors) {
            this.applyDecorations(editor);
        }
    }

    /**
     * Apply decorations to all open editors with changes
     */
    async applyDecorationsToAllFiles(): Promise<void> {
        const changes = this.sessionManager.getAllChanges();
        const affectedFiles = new Set(changes.map(c => c.filePath));

        for (const filePath of affectedFiles) {
            try {
                const uri = vscode.Uri.file(filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                const editor = vscode.window.visibleTextEditors.find(
                    e => e.document === document
                );

                if (editor) {
                    this.applyDecorations(editor);
                }
            } catch {
                // File might not exist
            }
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.addedLineDecoration.dispose();
        this.deletedLineDecoration.dispose();
        this.modifiedNewLineDecoration.dispose();
        this.deletedGhostDecoration.dispose();
        this.addedGutterDecoration.dispose();
        this.deletedGutterDecoration.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
