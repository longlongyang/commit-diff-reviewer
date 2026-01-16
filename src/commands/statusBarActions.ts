
import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { GitService } from '../services/gitService';
import { DecorationProvider } from '../providers/decorationProvider';
import { acceptAll, rejectAll } from './diffActions';
import { endSession } from './endSession';

/**
 * Show the interactive status bar menu
 */
export async function showStatusMenu(
    sessionManager: SessionManager,
    gitService: GitService,
    decorationProvider: DecorationProvider
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        vscode.window.showInformationMessage('No active review session.');
        return;
    }

    const quickPick = vscode.window.createQuickPick();
    quickPick.placeholder = 'Select a file to review or perform a session action';
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;

    // 1. Get Pending Files
    const pendingChanges = sessionManager.getPendingChanges();
    const filesMap = new Map<string, number>(); // filePath -> count

    for (const change of pendingChanges) {
        const count = filesMap.get(change.filePath) || 0;
        filesMap.set(change.filePath, count + 1);
    }

    const fileItems: vscode.QuickPickItem[] = [];
    if (filesMap.size > 0) {
        fileItems.push({ label: 'FILES WITH PENDING CHANGES', kind: vscode.QuickPickItemKind.Separator });

        for (const [filePath, count] of filesMap) {
            // Get relative path for display
            const relativePath = gitService.getRelativePath(filePath);
            const fileName = relativePath.split(/[/\\]/).pop() || relativePath;

            fileItems.push({
                label: `$(file) ${fileName}`,
                description: relativePath !== fileName ? relativePath : undefined,
                detail: `${count} pending change(s)`,
                // Store filePath in a way we can retrieve it? 
                // QuickPickItem doesn't have custom data property officially in typed interface used here commonly,
                // but we can look it up by label/description or cast it.
                // Let's rely on looking up by description (relativePath) matches.
            });
        }
    } else {
        fileItems.push({ label: 'NO PENDING CHANGES', kind: vscode.QuickPickItemKind.Separator });
    }

    // 2. Session Actions
    const actionItems: vscode.QuickPickItem[] = [
        { label: 'SESSION ACTIONS', kind: vscode.QuickPickItemKind.Separator },
        {
            label: '$(check-all) Accept All Remaining',
            detail: 'Accepts all pending changes in all files'
        },
        {
            label: '$(close-all) Reject All Remaining',
            detail: 'Reverts all pending changes to original state'
        },
        {
            label: '$(stop) End Review Session',
            detail: 'Stops the review and clears all highlights'
        }
    ];

    quickPick.items = [...fileItems, ...actionItems];

    // Handle selection
    quickPick.onDidAccept(async () => {
        const selection = quickPick.selectedItems[0];
        quickPick.hide();

        if (!selection) return;

        // Check if it's an action
        if (selection.label.includes('Accept All Remaining')) {
            await acceptAll(sessionManager, decorationProvider);
        } else if (selection.label.includes('Reject All Remaining')) {
            await rejectAll(sessionManager, gitService, decorationProvider);
        } else if (selection.label.includes('End Review Session')) {
            await endSession(sessionManager, decorationProvider);
        } else {
            // It's a file selection
            const relativePath = selection.description || selection.label.replace('$(file) ', '');
            // Find the first pending change for this file
            const change = pendingChanges.find(c => c.filePath.endsWith(relativePath) || gitService.getRelativePath(c.filePath) === relativePath);

            if (change) {
                const uri = vscode.Uri.file(change.filePath);
                const doc = await vscode.workspace.openTextDocument(uri);
                const editor = await vscode.window.showTextDocument(doc);

                // Reveal the first pending change line
                // Note: newLineStart is 1-based
                const line = Math.max(0, change.newLineStart - 1);
                const range = new vscode.Range(line, 0, line, 0);

                editor.selection = new vscode.Selection(range.start, range.start);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);

                // Sync session index to this change
                sessionManager.setCurrentChange(change.id);
            }
        }
        quickPick.dispose();
    });

    quickPick.show();
}
