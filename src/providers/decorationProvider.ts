/**
 * Decoration Provider - Handles visual highlighting of diff changes
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DiffChange, ExtensionConfig } from '../models/types';

export class DecorationProvider implements vscode.Disposable {
    private sessionManager: SessionManager;

    // Decoration types for different change types
    private addedLineDecoration: vscode.TextEditorDecorationType;
    private deletedLineDecoration: vscode.TextEditorDecorationType;
    private modifiedLineDecoration: vscode.TextEditorDecorationType;
    private deletedGhostDecoration: vscode.TextEditorDecorationType;

    // Gutter decorations
    private addedGutterDecoration: vscode.TextEditorDecorationType;
    private deletedGutterDecoration: vscode.TextEditorDecorationType;
    private modifiedGutterDecoration: vscode.TextEditorDecorationType;

    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;

        // Get colors from configuration
        const config = this.getConfig();

        // Create decoration types
        this.addedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added,
            isWholeLine: true,
            overviewRulerColor: 'rgba(46, 160, 67, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        this.deletedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.deleted,
            isWholeLine: true,
            overviewRulerColor: 'rgba(248, 81, 73, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        this.modifiedLineDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: config.highlightColors.added, // Use green for new content in modifications
            isWholeLine: true,
            overviewRulerColor: 'rgba(210, 153, 34, 0.8)', // Yellow in overview ruler to indicate modification
            overviewRulerLane: vscode.OverviewRulerLane.Left
        });

        // Ghost text for deleted content (shown as faded inline)
        this.deletedGhostDecoration = vscode.window.createTextEditorDecorationType({
            before: {
                color: 'rgba(248, 81, 73, 0.6)',
                fontStyle: 'italic',
                textDecoration: 'line-through'
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

        this.modifiedGutterDecoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIconUri('yellow'),
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
            'red': '#f85149',
            'yellow': '#d29922'
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
        const modifiedRanges: vscode.DecorationOptions[] = [];
        const ghostRanges: vscode.DecorationOptions[] = [];

        const addedGutterRanges: vscode.DecorationOptions[] = [];
        const deletedGutterRanges: vscode.DecorationOptions[] = [];
        const modifiedGutterRanges: vscode.DecorationOptions[] = [];

        for (const change of changes) {
            const ranges = this.createRangesForChange(change, editor.document);

            switch (change.type) {
                case 'add':
                    addedRanges.push(...ranges.main);
                    addedGutterRanges.push(...ranges.gutter);
                    break;
                case 'delete':
                    // For deletions, show ghost text at the deletion point
                    if (change.oldContent.length > 0) {
                        const ghostLine = Math.max(0, change.newLineStart - 1);
                        const lineLength = editor.document.lineAt(
                            Math.min(ghostLine, editor.document.lineCount - 1)
                        ).text.length;

                        ghostRanges.push({
                            range: new vscode.Range(ghostLine, lineLength, ghostLine, lineLength),
                            renderOptions: {
                                after: {
                                    contentText: ` [${change.oldContent.length} line(s) deleted]`,
                                    color: 'rgba(248, 81, 73, 0.7)',
                                    fontStyle: 'italic'
                                }
                            }
                        });
                        deletedGutterRanges.push({
                            range: new vscode.Range(ghostLine, 0, ghostLine, 0)
                        });
                    }
                    break;
                case 'modify':
                    // For modifications: show new lines in green
                    modifiedRanges.push(...ranges.main);
                    modifiedGutterRanges.push(...ranges.gutter);

                    // Show ghost text indicating what was removed (in red)
                    if (change.oldContent.length > 0) {
                        const modifyLine = Math.max(0, change.newLineStart - 1);

                        // Show deleted content summary
                        ghostRanges.push({
                            range: new vscode.Range(modifyLine, 0, modifyLine, 0),
                            renderOptions: {
                                before: {
                                    contentText: `⊖ `,
                                    color: 'rgba(248, 81, 73, 0.8)',
                                    fontWeight: 'bold'
                                }
                            }
                        });
                    }
                    break;
            }
        }

        // Apply all decorations
        editor.setDecorations(this.addedLineDecoration, addedRanges);
        editor.setDecorations(this.deletedLineDecoration, deletedRanges);
        editor.setDecorations(this.modifiedLineDecoration, modifiedRanges);
        editor.setDecorations(this.deletedGhostDecoration, ghostRanges);

        editor.setDecorations(this.addedGutterDecoration, addedGutterRanges);
        editor.setDecorations(this.deletedGutterDecoration, deletedGutterRanges);
        editor.setDecorations(this.modifiedGutterDecoration, modifiedGutterRanges);
    }

    /**
     * Create ranges for a change
     */
    private createRangesForChange(
        change: DiffChange,
        document: vscode.TextDocument
    ): { main: vscode.DecorationOptions[]; gutter: vscode.DecorationOptions[] } {
        const main: vscode.DecorationOptions[] = [];
        const gutter: vscode.DecorationOptions[] = [];

        if (change.type === 'delete') {
            // Deletions don't have visible lines in current document
            return { main, gutter };
        }

        // For adds and modifications, highlight the affected lines
        const startLine = change.newLineStart - 1; // Convert to 0-indexed
        const endLine = startLine + change.newLineCount;

        for (let lineNum = startLine; lineNum < endLine && lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);

            // Create hover message showing old content for modifications
            let hoverMessage: vscode.MarkdownString | undefined;
            if (change.type === 'modify' && change.oldContent.length > 0) {
                const oldContentPreview = change.oldContent.slice(0, 5).join('\n');
                const truncated = change.oldContent.length > 5 ? '\n...' : '';
                hoverMessage = new vscode.MarkdownString();
                hoverMessage.appendMarkdown('**Original content:**\n');
                hoverMessage.appendCodeblock(oldContentPreview + truncated);
            }

            main.push({
                range: line.range,
                hoverMessage
            });

            gutter.push({
                range: new vscode.Range(lineNum, 0, lineNum, 0)
            });
        }

        return { main, gutter };
    }

    /**
     * Clear decorations from an editor
     */
    clearDecorations(editor: vscode.TextEditor): void {
        editor.setDecorations(this.addedLineDecoration, []);
        editor.setDecorations(this.deletedLineDecoration, []);
        editor.setDecorations(this.modifiedLineDecoration, []);
        editor.setDecorations(this.deletedGhostDecoration, []);
        editor.setDecorations(this.addedGutterDecoration, []);
        editor.setDecorations(this.deletedGutterDecoration, []);
        editor.setDecorations(this.modifiedGutterDecoration, []);
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
        this.modifiedLineDecoration.dispose();
        this.deletedGhostDecoration.dispose();
        this.addedGutterDecoration.dispose();
        this.deletedGutterDecoration.dispose();
        this.modifiedGutterDecoration.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
