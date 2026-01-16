/**
 * Status Bar Provider - Shows navigation controls and progress in the status bar
 */

import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';

export class StatusBarProvider implements vscode.Disposable {
    private sessionManager: SessionManager;

    // Status bar items
    private prevButton: vscode.StatusBarItem;
    private progressIndicator: vscode.StatusBarItem;
    private nextButton: vscode.StatusBarItem;
    private commitInfo: vscode.StatusBarItem;

    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager) {
        this.sessionManager = sessionManager;

        // Create status bar items (priority determines position, higher = more left)
        this.commitInfo = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );
        this.commitInfo.name = 'Commit Diff Reviewer - Commit';

        this.prevButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            99
        );
        this.prevButton.name = 'Commit Diff Reviewer - Previous';
        this.prevButton.text = '$(arrow-left)';
        this.prevButton.tooltip = 'Go to Previous Change (Alt+[ or F7)';
        this.prevButton.command = 'commitDiffReviewer.prevChange';

        this.progressIndicator = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            98
        );
        this.progressIndicator.name = 'Commit Diff Reviewer - Progress';

        this.nextButton = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            97
        );
        this.nextButton.name = 'Commit Diff Reviewer - Next';
        this.nextButton.text = '$(arrow-right)';
        this.nextButton.tooltip = 'Go to Next Change (Alt+] or Shift+F7)';
        this.nextButton.command = 'commitDiffReviewer.nextChange';

        // Listen for session events
        this.sessionManager.on('sessionStarted', () => this.show());
        this.sessionManager.on('sessionEnded', () => this.hide());
        this.sessionManager.on('sessionRestored', () => this.show());
        this.sessionManager.on('changeUpdated', () => this.update());
        this.sessionManager.on('currentChangeUpdated', () => this.update());

        // Initial state
        if (this.sessionManager.hasActiveSession()) {
            this.show();
        }
    }

    /**
     * Show status bar items
     */
    show(): void {
        this.update();
        this.commitInfo.show();
        this.prevButton.show();
        this.progressIndicator.show();
        this.nextButton.show();
    }

    /**
     * Hide status bar items
     */
    hide(): void {
        this.commitInfo.hide();
        this.prevButton.hide();
        this.progressIndicator.hide();
        this.nextButton.hide();
    }

    /**
     * Update status bar content
     */
    update(): void {
        const session = this.sessionManager.getCurrentSession();
        if (!session) {
            this.hide();
            return;
        }

        const stats = this.sessionManager.getSessionStats();
        const total = stats.accepted + stats.rejected + stats.pending;
        const processed = stats.accepted + stats.rejected;

        // Update commit info
        this.commitInfo.text = `$(git-commit) ${session.shortHash}`;
        this.commitInfo.tooltip = `Reviewing: ${session.commitMessage}\nClick to end session`;
        this.commitInfo.command = 'commitDiffReviewer.endSession';
        this.commitInfo.backgroundColor = new vscode.ThemeColor(
            'statusBarItem.prominentBackground'
        );

        // Update progress
        if (stats.pending === 0) {
            this.progressIndicator.text = `$(check-all) All ${total} changes processed`;
            this.progressIndicator.backgroundColor = new vscode.ThemeColor(
                'statusBarItem.prominentBackground'
            );
        } else {
            const currentIndex = this.getCurrentChangeIndex() + 1;
            this.progressIndicator.text = `$(edit) ${currentIndex}/${stats.pending} pending (${processed}/${total} done)`;
            this.progressIndicator.backgroundColor = undefined;
        }

        this.progressIndicator.tooltip =
            `Accepted: ${stats.accepted}\nRejected: ${stats.rejected}\nPending: ${stats.pending}`;

        // Update button states
        const hasPending = stats.pending > 0;
        this.prevButton.text = hasPending ? '$(arrow-left)' : '$(arrow-left)';
        this.nextButton.text = hasPending ? '$(arrow-right)' : '$(arrow-right)';
    }

    /**
     * Get current change index in pending list
     */
    private getCurrentChangeIndex(): number {
        const session = this.sessionManager.getCurrentSession();
        if (!session) {
            return 0;
        }
        return Math.max(0, Math.min(
            session.currentIndex,
            this.sessionManager.getPendingChanges().length - 1
        ));
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.commitInfo.dispose();
        this.prevButton.dispose();
        this.progressIndicator.dispose();
        this.nextButton.dispose();

        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }
}
