/**
 * CodeLens Provider - Provides inline Accept/Reject buttons for each change
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DiffChange } from '../models/types';

export class DiffCodeLensProvider implements vscode.CodeLensProvider {
    private sessionManager: SessionManager;
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;

        // Refresh CodeLenses when changes are updated
        this.sessionManager.on('changeUpdated', () => this.refresh());
        this.sessionManager.on('sessionStarted', () => this.refresh());
        this.sessionManager.on('sessionEnded', () => this.refresh());
        this.sessionManager.on('sessionRestored', () => this.refresh());
        this.sessionManager.on('lineMappingUpdated', () => this.refresh());
    }

    /**
     * Refresh CodeLenses
     */
    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Provide CodeLenses for a document
     */
    provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        if (!this.sessionManager.hasActiveSession()) {
            return [];
        }

        const filePath = document.uri.fsPath.replace(/\\/g, '/');
        const pendingChanges = this.sessionManager.getPendingChangesForFile(filePath);

        const codeLenses: vscode.CodeLens[] = [];

        for (const change of pendingChanges) {
            const lenses = this.createCodeLensesForChange(change, document);
            codeLenses.push(...lenses);
        }

        return codeLenses;
    }

    /**
     * Create CodeLenses for a single change
     */
    private createCodeLensesForChange(
        change: DiffChange,
        document: vscode.TextDocument
    ): vscode.CodeLens[] {
        const lenses: vscode.CodeLens[] = [];

        // Determine the line to show the CodeLens on
        let targetLine: number;

        if (change.type === 'delete') {
            // For deletions, show above the line where content was deleted
            targetLine = Math.max(0, change.newLineStart - 1);
        } else {
            // For adds and modifications, show at the start of the change
            targetLine = change.newLineStart - 1; // Convert to 0-indexed
        }

        // Make sure the line is valid
        targetLine = Math.min(targetLine, Math.max(0, document.lineCount - 1));

        const range = new vscode.Range(targetLine, 0, targetLine, 0);

        // Create change type indicator
        const typeIndicator = this.getChangeTypeIndicator(change);
        const infoLens = new vscode.CodeLens(range, {
            title: typeIndicator,
            command: '',
            tooltip: this.getChangeTooltip(change)
        });
        lenses.push(infoLens);

        // Accept button
        const acceptLens = new vscode.CodeLens(range, {
            title: '✓ Accept',
            command: 'commitDiffReviewer.acceptChangeById',
            arguments: [change.id],
            tooltip: 'Keep this change (remove highlight only)'
        });
        lenses.push(acceptLens);

        // Reject button
        const rejectLens = new vscode.CodeLens(range, {
            title: '✗ Reject',
            command: 'commitDiffReviewer.rejectChangeById',
            arguments: [change.id],
            tooltip: 'Revert this change to original content'
        });
        lenses.push(rejectLens);

        return lenses;
    }

    /**
     * Get indicator text for change type
     */
    private getChangeTypeIndicator(change: DiffChange): string {
        switch (change.type) {
            case 'add':
                return `➕ Added ${change.newLineCount} line(s)`;
            case 'delete':
                return `➖ Deleted ${change.oldLineCount} line(s)`;
            case 'modify':
                return `✏️ Modified ${change.oldLineCount} → ${change.newLineCount} line(s)`;
            default:
                return '📝 Change';
        }
    }

    /**
     * Get tooltip for change
     */
    private getChangeTooltip(change: DiffChange): string {
        const parts: string[] = [];

        if (change.oldContent.length > 0) {
            parts.push('Original:');
            parts.push(change.oldContent.slice(0, 3).join('\n'));
            if (change.oldContent.length > 3) {
                parts.push('...');
            }
        }

        if (change.newContent.length > 0 && change.type !== 'add') {
            parts.push('\nNew:');
            parts.push(change.newContent.slice(0, 3).join('\n'));
            if (change.newContent.length > 3) {
                parts.push('...');
            }
        }

        return parts.join('\n') || 'No preview available';
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._onDidChangeCodeLenses.dispose();
    }
}
