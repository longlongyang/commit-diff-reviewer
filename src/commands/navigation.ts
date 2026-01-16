/**
 * Navigation Commands - Next/Previous change navigation
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DecorationProvider } from '../providers/decorationProvider';
import { DiffChange } from '../models/types';

/**
 * Navigate to the next pending change
 */
export async function nextChange(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showWarningMessage('No active review session. Use "Select Commit to Review" to start.');
        return;
    }

    const change = sessionManager.nextChange();

    if (!change) {
        const stats = sessionManager.getSessionStats();
        if (stats.pending === 0) {
            vscode.window.showInformationMessage(
                'All changes have been processed!',
                'End Session'
            ).then(selection => {
                if (selection === 'End Session') {
                    vscode.commands.executeCommand('commitDiffReviewer.endSession');
                }
            });
        } else {
            vscode.window.showWarningMessage('No more changes to navigate to.');
        }
        return;
    }

    await navigateToChange(change, decorationProvider);
}

/**
 * Navigate to the previous pending change
 */
export async function prevChange(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showWarningMessage('No active review session. Use "Select Commit to Review" to start.');
        return;
    }

    const change = sessionManager.prevChange();

    if (!change) {
        const stats = sessionManager.getSessionStats();
        if (stats.pending === 0) {
            vscode.window.showInformationMessage('All changes have been processed!');
        } else {
            vscode.window.showWarningMessage('No more changes to navigate to.');
        }
        return;
    }

    await navigateToChange(change, decorationProvider);
}

/**
 * Navigate to a specific change
 */
async function navigateToChange(
    change: DiffChange,
    decorationProvider: DecorationProvider
): Promise<void> {
    try {
        // Open the file
        const uri = vscode.Uri.file(change.filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Apply decorations to this editor
        decorationProvider.applyDecorations(editor);

        // Calculate the target line
        let targetLine: number;
        if (change.type === 'delete') {
            // For deletions, go to the line before where content was deleted
            targetLine = Math.max(0, change.newLineStart - 1);
        } else {
            // For adds and modifications, go to the start of the change
            targetLine = change.newLineStart - 1; // Convert to 0-indexed
        }

        // Ensure line is within document bounds
        targetLine = Math.min(targetLine, Math.max(0, document.lineCount - 1));

        // Create position and selection
        const position = new vscode.Position(targetLine, 0);
        editor.selection = new vscode.Selection(position, position);

        // Reveal the line in center of viewport
        editor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );

        // Briefly highlight the line for visibility
        highlightLine(editor, targetLine);

    } catch (error) {
        vscode.window.showErrorMessage(
            `Cannot navigate to change: ${change.filePath} may not exist. ${error}`
        );
    }
}

/**
 * Briefly highlight a line to draw attention
 */
function highlightLine(editor: vscode.TextEditor, lineNumber: number): void {
    const highlightDecoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        isWholeLine: true
    });

    const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
    editor.setDecorations(highlightDecoration, [range]);

    // Remove highlight after 500ms
    setTimeout(() => {
        editor.setDecorations(highlightDecoration, []);
        highlightDecoration.dispose();
    }, 500);
}

/**
 * Navigate to first pending change
 */
export async function goToFirstChange(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        return;
    }

    const pending = sessionManager.getPendingChanges();
    if (pending.length > 0) {
        await navigateToChange(pending[0], decorationProvider);
    }
}

/**
 * Reveal the current pending change (without advancing index)
 * Used for auto-navigation after accepting/rejecting
 */
export async function revealCurrentChange(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        return;
    }

    const change = sessionManager.getCurrentChange();
    if (change) {
        await navigateToChange(change, decorationProvider);
    } else {
        // If no current change, we might be done or index is weird
        // Check if we have pending changes, if so, maybe index got reset to 0 by normalizeIndex
        // In that case getCurrentChange SHOULD return something
        // If it returns null, likely no pending changes left.
        const stats = sessionManager.getSessionStats();
        if (stats.pending === 0) {
            // Auto-session end will likely trigger separately, but we can do nothing here
        }
    }
}
