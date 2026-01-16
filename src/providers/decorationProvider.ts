/**
 * Decoration Provider - Handles visual highlighting of diff changes
 * GitHub-style inline diff view: red for deleted, green for added
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

    // Ghost decoration for showing deleted content above modified lines
    private deletedGhostLineDecoration: vscode.TextEditorDecorationType;

    // Gutter decorations (only green and red now)
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

        // Deleted lines (pure red background)
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

        // Ghost line showing deleted content (displayed as inline before decoration)
        this.deletedGhostLineDecoration = vscode.window.createTextEditorDecorationType({
            before: {
                color: 'rgba(248, 81, 73, 0.9)',
                fontStyle: 'normal',
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
        const deletedRanges: vscode.DecorationOptions[] = [];
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
                    // Pure deletion - show ghost text indicating what was deleted
                    if (change.oldContent.length > 0) {
                        const deleteLine = Math.max(0, change.newLineStart - 1);
                        const safeLine = Math.min(deleteLine, editor.document.lineCount - 1);

                        // Show deletion marker with content preview
                        const deletedPreview = change.oldContent.length === 1
                            ? change.oldContent[0]
                            : `${change.oldContent.length} lines deleted`;

                        ghostRanges.push({
                            range: new vscode.Range(safeLine, 0, safeLine, 0),
                            renderOptions: {
                                before: {
                                    contentText: `⊖ ${deletedPreview}`,
                                    color: 'rgba(248, 81, 73, 0.9)',
                                    backgroundColor: 'rgba(248, 81, 73, 0.15)',
                                    fontStyle: 'italic',
                                    margin: '0 0 0 0',
                                    textDecoration: 'none; display: block; width: 100%;'
                                }
                            }
                        });

                        deletedGutterRanges.push({
                            range: new vscode.Range(safeLine, 0, safeLine, 0)
                        });
                    }
                    break;

                case 'modify':
                    // Modification - show old content above (red) and new content (green)
                    this.addModificationDecorations(
                        change,
                        editor.document,
                        modifiedNewRanges,
                        ghostRanges,
                        addedGutterRanges
                    );
                    break;
            }
        }

        // Apply all decorations
        editor.setDecorations(this.addedLineDecoration, addedRanges);
        editor.setDecorations(this.deletedLineDecoration, deletedRanges);
        editor.setDecorations(this.modifiedNewLineDecoration, modifiedNewRanges);
        editor.setDecorations(this.deletedGhostLineDecoration, ghostRanges);

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
                hoverMessage: new vscode.MarkdownString('**Added line**')
            });
            gutterRanges.push({
                range: new vscode.Range(lineNum, 0, lineNum, 0)
            });
        }
    }

    /**
     * Add decorations for modified lines (GitHub-style: red for old, green for new)
     */
    private addModificationDecorations(
        change: DiffChange,
        document: vscode.TextDocument,
        newLineRanges: vscode.DecorationOptions[],
        ghostRanges: vscode.DecorationOptions[],
        gutterRanges: vscode.DecorationOptions[]
    ): void {
        const startLine = change.newLineStart - 1;
        const endLine = startLine + change.newLineCount;

        // Show old content as ghost text above the first modified line
        if (change.oldContent.length > 0 && startLine < document.lineCount) {
            const oldContentDisplay = change.oldContent.map(line => `- ${line}`).join('\\n');
            const preview = change.oldContent.length <= 3
                ? change.oldContent.join(' → ')
                : `${change.oldContent.slice(0, 2).join(' → ')} ... (${change.oldContent.length} lines)`;

            ghostRanges.push({
                range: new vscode.Range(startLine, 0, startLine, 0),
                renderOptions: {
                    before: {
                        contentText: `⊖ ${preview}`,
                        color: 'rgba(248, 81, 73, 0.95)',
                        backgroundColor: 'rgba(248, 81, 73, 0.2)',
                        fontStyle: 'italic',
                        margin: '0',
                        textDecoration: 'none; display: block;'
                    }
                },
                hoverMessage: this.createOldContentHover(change.oldContent)
            });
        }

        // Show new content with green background
        for (let lineNum = startLine; lineNum < endLine && lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);

            newLineRanges.push({
                range: line.range,
                hoverMessage: this.createModificationHover(change)
            });

            gutterRanges.push({
                range: new vscode.Range(lineNum, 0, lineNum, 0)
            });
        }
    }

    /**
     * Create hover message showing old content
     */
    private createOldContentHover(oldContent: string[]): vscode.MarkdownString {
        const hover = new vscode.MarkdownString();
        hover.appendMarkdown('**Deleted content:**\n');
        hover.appendCodeblock(oldContent.join('\n'), 'text');
        return hover;
    }

    /**
     * Create hover message for modification
     */
    private createModificationHover(change: DiffChange): vscode.MarkdownString {
        const hover = new vscode.MarkdownString();
        hover.appendMarkdown('**Modified line**\n\n');
        hover.appendMarkdown('Old:\n');
        hover.appendCodeblock(change.oldContent.join('\n'), 'text');
        hover.appendMarkdown('\nNew:\n');
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
        editor.setDecorations(this.deletedGhostLineDecoration, []);
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
        this.deletedGhostLineDecoration.dispose();
        this.addedGutterDecoration.dispose();
        this.deletedGutterDecoration.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
