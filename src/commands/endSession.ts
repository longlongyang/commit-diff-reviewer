/**
 * End Session Command - Cleanup and session termination
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { DecorationProvider } from '../providers/decorationProvider';

/**
 * End the current review session
 */
export async function endSession(
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showWarningMessage('No active review session to end.');
        return;
    }

    const stats = sessionManager.getSessionStats();

    // Confirm if there are pending changes
    if (stats.pending > 0) {
        const choice = await vscode.window.showWarningMessage(
            `There are ${stats.pending} pending change(s) that haven't been reviewed. End session anyway?`,
            'End Session',
            'Accept All & End',
            'Reject All & End',
            'Cancel'
        );

        switch (choice) {
            case 'Cancel':
                return;

            case 'Accept All & End':
                // Accept all remaining
                const pending = sessionManager.getPendingChanges();
                for (const change of pending) {
                    sessionManager.acceptChange(change.id);
                }
                break;

            case 'Reject All & End':
                // Just mark as rejected without reverting (to avoid complexity)
                vscode.window.showWarningMessage(
                    'Use "Reject All Changes" command first to revert code, then end session.',
                    'OK'
                );
                return;

            case 'End Session':
                // Continue to end session
                break;

            default:
                return;
        }
    }

    // End the session
    const finalStats = sessionManager.endSession();

    // Clear all decorations
    decorationProvider.clearAllDecorations();

    // Show summary
    if (finalStats) {
        const total = finalStats.accepted + finalStats.rejected + finalStats.pending;
        vscode.window.showInformationMessage(
            `Session ended. Summary: ${finalStats.accepted} accepted, ${finalStats.rejected} rejected, ${finalStats.pending} skipped (Total: ${total})`
        );
    } else {
        vscode.window.showInformationMessage('Review session ended.');
    }
}
