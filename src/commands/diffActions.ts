/**
 * Diff Actions - Accept/Reject change operations
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { GitService } from '../services/gitService';
import { DecorationProvider } from '../providers/decorationProvider';
import { DiffChange } from '../models/types';

/**
 * Accept the current change (keep current code, just remove highlight)
 */
export async function acceptChange(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    const currentChange = sessionManager.getCurrentChange();
    if (!currentChange) {
        vscode.window.showWarningMessage('No current change to accept.');
        return;
    }

    await acceptChangeById(sessionManager, decorationProvider, currentChange.id);
}

/**
 * Accept a specific change by ID
 */
export async function acceptChangeById(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider,
    changeId: string
): Promise<void> {
    const change = sessionManager.getChangeById(changeId);
    if (!change) {
        vscode.window.showWarningMessage('Change not found.');
        return;
    }

    if (change.status !== 'pending') {
        vscode.window.showWarningMessage('This change has already been processed.');
        return;
    }

    // Mark as accepted (no code changes, just update status)
    sessionManager.acceptChange(changeId);

    // Refresh decorations
    decorationProvider.refreshAllEditors();

    // Auto-end session if all changes are resolved
    if (!checkAndAutoEndSession(sessionManager, decorationProvider)) {
        // Auto-navigate if enabled
        const config = vscode.workspace.getConfiguration('commitDiffReviewer');
        if (config.get<boolean>('autoNavigation', true)) {
            // Use navigation module to reveal next
            const { revealCurrentChange } = require('./navigation');
            revealCurrentChange(sessionManager, decorationProvider);
        }
    }
}

/**
 * Reject the current change (revert to original content)
 */
export async function rejectChange(
    sessionManager: SessionManager,
    gitService: GitService,
    decorationProvider: DecorationProvider
): Promise<void> {
    const currentChange = sessionManager.getCurrentChange();
    if (!currentChange) {
        vscode.window.showWarningMessage('No current change to reject.');
        return;
    }

    await rejectChangeById(sessionManager, gitService, decorationProvider, currentChange.id);
}

/**
 * Reject a specific change by ID
 */
export async function rejectChangeById(
    sessionManager: SessionManager,
    gitService: GitService,
    decorationProvider: DecorationProvider,
    changeId: string
): Promise<void> {
    const change = sessionManager.getChangeById(changeId);
    if (!change) {
        vscode.window.showWarningMessage('Change not found.');
        return;
    }

    if (change.status !== 'pending') {
        vscode.window.showWarningMessage('This change has already been processed.');
        return;
    }

    try {
        // Apply the revert operation
        await applyRevert(change, gitService);

        // Mark as rejected
        sessionManager.rejectChange(changeId);

        // Refresh decorations
        decorationProvider.refreshAllEditors();

        // Auto-end session if all changes are resolved
        if (!checkAndAutoEndSession(sessionManager, decorationProvider)) {
            // Auto-navigate if enabled
            const config = vscode.workspace.getConfiguration('commitDiffReviewer');
            if (config.get<boolean>('autoNavigation', true)) {
                // Use navigation module to reveal next
                const { revealCurrentChange } = require('./navigation');
                revealCurrentChange(sessionManager, decorationProvider);
            }
        }

    } catch (error) {
        vscode.window.showErrorMessage(`Failed to reject change: ${error}`);
    }
}

/**
 * Apply revert operation for a change
 */
async function applyRevert(change: DiffChange, _gitService: GitService): Promise<void> {
    const uri = vscode.Uri.file(change.filePath);

    // Open the document
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // Create workspace edit
    const workspaceEdit = new vscode.WorkspaceEdit();

    switch (change.type) {
        case 'add':
            // Delete the added lines
            {
                const startLine = change.newLineStart - 1; // 0-indexed
                const endLine = startLine + change.newLineCount;

                // Make sure we have valid range
                const safeEndLine = Math.min(endLine, document.lineCount);

                if (startLine < document.lineCount) {
                    const range = new vscode.Range(
                        new vscode.Position(startLine, 0),
                        new vscode.Position(safeEndLine, 0)
                    );
                    workspaceEdit.delete(uri, range);
                }
            }
            break;

        case 'delete':
            // Insert the deleted lines back
            {
                const insertLine = change.newLineStart - 1; // 0-indexed
                const position = new vscode.Position(
                    Math.min(insertLine, document.lineCount),
                    0
                );
                const contentToInsert = change.oldContent.join('\n') + '\n';
                workspaceEdit.insert(uri, position, contentToInsert);
            }
            break;

        case 'modify':
            // Replace new content with old content
            {
                const startLine = change.newLineStart - 1; // 0-indexed
                const endLine = startLine + change.newLineCount;

                // Get the range of the new content
                const safeEndLine = Math.min(endLine, document.lineCount);

                if (startLine < document.lineCount) {
                    // Delete the new content and insert old content
                    const range = new vscode.Range(
                        new vscode.Position(startLine, 0),
                        new vscode.Position(safeEndLine, 0)
                    );
                    const oldContent = change.oldContent.join('\n') + '\n';
                    workspaceEdit.replace(uri, range, oldContent);
                }
            }
            break;
    }

    // Apply the edit
    const success = await vscode.workspace.applyEdit(workspaceEdit);

    if (!success) {
        throw new Error('Failed to apply workspace edit');
    }

    // Save the document
    await document.save();
}

/**
 * Accept all remaining changes
 */
export async function acceptAll(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showWarningMessage('No active review session.');
        return;
    }

    const pending = sessionManager.getPendingChanges();

    if (pending.length === 0) {
        vscode.window.showInformationMessage('No pending changes to accept.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Accept all ${pending.length} remaining changes?`,
        'Accept All',
        'Cancel'
    );

    if (confirm !== 'Accept All') {
        return;
    }

    // Accept all pending changes
    for (const change of pending) {
        sessionManager.acceptChange(change.id);
    }

    decorationProvider.refreshAllEditors();
    checkAndAutoEndSession(sessionManager, decorationProvider);
}

/**
 * Reject all remaining changes
 */
export async function rejectAll(
    sessionManager: SessionManager,
    gitService: GitService,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showWarningMessage('No active review session.');
        return;
    }

    const pending = sessionManager.getPendingChanges();

    if (pending.length === 0) {
        vscode.window.showInformationMessage('No pending changes to reject.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Reject all ${pending.length} remaining changes? This will revert the code to original.`,
        'Reject All',
        'Cancel'
    );

    if (confirm !== 'Reject All') {
        return;
    }

    // Group changes by file and sort by line number (descending) to avoid line number shifts
    const changesByFile = new Map<string, DiffChange[]>();
    for (const change of pending) {
        const existing = changesByFile.get(change.filePath) || [];
        existing.push(change);
        changesByFile.set(change.filePath, existing);
    }

    let failed = 0;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Rejecting all changes...',
            cancellable: false
        },
        async (progress) => {
            const totalFiles = changesByFile.size;
            let processedFiles = 0;

            for (const [filePath, changes] of changesByFile) {
                progress.report({
                    message: `Processing ${filePath.split('/').pop()}...`,
                    increment: (100 / totalFiles)
                });

                // Sort changes by line number descending to avoid line shifts
                const sortedChanges = [...changes].sort(
                    (a, b) => b.newLineStart - a.newLineStart
                );

                for (const change of sortedChanges) {
                    try {
                        await applyRevert(change, gitService);
                        sessionManager.rejectChange(change.id);
                    } catch (error) {
                        console.error(`Failed to reject change: ${error}`);
                        failed++;
                    }
                }

                processedFiles++;
            }
        }
    );

    decorationProvider.refreshAllEditors();

    if (failed > 0) {
        vscode.window.showWarningMessage(`Rejected changes with ${failed} error(s).`);
    } else {
        checkAndAutoEndSession(sessionManager, decorationProvider);
    }
}

/**
 * Auto-end session when all changes are resolved
 */
function autoEndSession(sessionManager: SessionManager, decorationProvider: DecorationProvider): void {
    const stats = sessionManager.getSessionStats();

    // End the session
    sessionManager.endSession();

    // Clear all decorations
    decorationProvider.clearAllDecorations();

    // Show summary notification
    vscode.window.showInformationMessage(
        `Review complete! Accepted: ${stats.accepted}, Rejected: ${stats.rejected}. Session ended automatically.`
    );
}

/**
 * Check and auto-end session if all changes are resolved
 */
export function checkAndAutoEndSession(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): boolean {
    const stats = sessionManager.getSessionStats();
    if (stats.pending === 0 && sessionManager.hasActiveSession()) {
        autoEndSession(sessionManager, decorationProvider);
        return true;
    }
    return false;
}
