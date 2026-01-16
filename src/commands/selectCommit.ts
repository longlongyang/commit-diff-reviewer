/**
 * Select Commit Command - Handles commit selection via Quick Pick
 */

import * as vscode from 'vscode';
import { GitService } from '../services/gitService';
import { SessionManager } from '../services/sessionManager';
import { DecorationProvider } from '../providers/decorationProvider';
import { parseDiffOutput, flattenHunks } from '../services/diffParser';
import { CommitInfo } from '../models/types';
import { formatRelativeTime, truncate } from '../utils/helpers';

/**
 * Execute the select commit command
 */
export async function selectCommit(
    gitService: GitService,
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider
): Promise<void> {
    // Check if we're in a git repository
    const isGitRepo = await gitService.isGitRepository();
    if (!isGitRepo) {
        vscode.window.showErrorMessage('Not a Git repository. Please open a folder with a Git repository.');
        return;
    }

    // Check if there's an active session
    if (sessionManager.hasActiveSession()) {
        const choice = await vscode.window.showWarningMessage(
            'A review session is already active. Do you want to end it and start a new one?',
            'End Current Session',
            'Cancel'
        );

        if (choice !== 'End Current Session') {
            return;
        }

        sessionManager.endSession();
    }

    // Get configuration
    const config = vscode.workspace.getConfiguration('commitDiffReviewer');
    const maxCommits = config.get<number>('maxCommitsInList', 20);

    // Show loading indicator
    const commits = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Loading commits...',
            cancellable: false
        },
        async () => {
            return await gitService.getRecentCommits(maxCommits);
        }
    );

    if (commits.length === 0) {
        vscode.window.showWarningMessage('No commits found in this repository.');
        return;
    }

    // Create Quick Pick items
    const items: vscode.QuickPickItem[] = commits.map(commit => ({
        label: `$(git-commit) ${commit.shortHash}`,
        description: truncate(commit.message, 60),
        detail: `${commit.author} • ${formatRelativeTime(commit.date)}`,
        commit
    } as vscode.QuickPickItem & { commit: CommitInfo }));

    // Add option for custom hash input
    items.push({
        label: '$(edit) Enter commit hash manually...',
        description: 'Type a full or partial commit hash',
        alwaysShow: true
    });

    // Show Quick Pick
    const selected = await vscode.window.showQuickPick(items, {
        title: 'Select a Commit to Review',
        placeHolder: 'Choose a commit or enter a hash',
        matchOnDescription: true,
        matchOnDetail: true
    }) as (vscode.QuickPickItem & { commit?: CommitInfo }) | undefined;

    if (!selected) {
        return;
    }

    let commitInfo: CommitInfo;

    if (selected.commit) {
        commitInfo = selected.commit;
    } else {
        // Manual hash input
        const hashInput = await vscode.window.showInputBox({
            title: 'Enter Commit Hash',
            placeHolder: 'e.g., abc1234 or full hash',
            validateInput: async (value) => {
                if (!value || value.trim().length < 4) {
                    return 'Please enter at least 4 characters';
                }
                return null;
            }
        });

        if (!hashInput) {
            return;
        }

        try {
            const isValid = await gitService.isValidCommit(hashInput.trim());
            if (!isValid) {
                vscode.window.showErrorMessage(`Invalid commit hash: ${hashInput}`);
                return;
            }
            commitInfo = await gitService.getCommitInfo(hashInput.trim());
        } catch (error) {
            vscode.window.showErrorMessage(`Error validating commit: ${error}`);
            return;
        }
    }

    // Start the review session
    await startReviewSession(gitService, sessionManager, decorationProvider, commitInfo);
}

/**
 * Start a review session for a commit
 */
async function startReviewSession(
    gitService: GitService,
    sessionManager: SessionManager,
    decorationProvider: DecorationProvider,
    commitInfo: CommitInfo
): Promise<void> {
    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Loading diff for ${commitInfo.shortHash}...`,
            cancellable: false
        },
        async (progress) => {
            try {
                progress.report({ message: 'Getting diff from commit...' });

                // Get the diff
                const diffOutput = await gitService.getDiff(commitInfo.hash);

                if (!diffOutput || diffOutput.trim().length === 0) {
                    vscode.window.showWarningMessage(
                        'This commit has no detectable changes (might be a merge commit or only binary files).'
                    );
                    return;
                }

                progress.report({ message: 'Parsing changes...' });

                // Parse the diff
                const workspaceRoot = gitService.getWorkspaceRoot()!;
                const hunks = parseDiffOutput(diffOutput, workspaceRoot);
                const changes = flattenHunks(hunks);

                if (changes.length === 0) {
                    vscode.window.showWarningMessage(
                        'No reviewable changes found (binary files are skipped).'
                    );
                    return;
                }

                progress.report({ message: 'Starting review session...' });

                // Get parent commit
                let baseCommitHash: string;
                try {
                    baseCommitHash = await gitService.getParentCommit(commitInfo.hash);
                } catch {
                    baseCommitHash = commitInfo.hash + '^';
                }

                // Start the session
                sessionManager.startSession(
                    commitInfo.hash,
                    commitInfo.shortHash,
                    commitInfo.message,
                    baseCommitHash,
                    changes
                );

                progress.report({ message: 'Applying decorations...' });

                // Open files with changes and apply decorations
                const affectedFiles = [...new Set(changes.map(c => c.filePath))];

                // Open the first file with changes
                if (affectedFiles.length > 0) {
                    try {
                        const firstFile = vscode.Uri.file(affectedFiles[0]);
                        const document = await vscode.workspace.openTextDocument(firstFile);
                        const editor = await vscode.window.showTextDocument(document);

                        // Apply decorations
                        decorationProvider.applyDecorations(editor);

                        // Jump to first change
                        const firstChange = changes.find(c => c.filePath === affectedFiles[0]);
                        if (firstChange) {
                            const line = firstChange.type === 'delete'
                                ? Math.max(0, firstChange.newLineStart - 1)
                                : firstChange.newLineStart - 1;

                            const position = new vscode.Position(line, 0);
                            editor.selection = new vscode.Selection(position, position);
                            editor.revealRange(
                                new vscode.Range(position, position),
                                vscode.TextEditorRevealType.InCenterIfOutsideViewport
                            );
                        }
                    } catch (error) {
                        // File might not exist in current state
                        console.error('Error opening first file:', error);
                    }
                }

                // Show summary
                vscode.window.showInformationMessage(
                    `Review started: ${changes.length} change(s) across ${affectedFiles.length} file(s)`,
                    'Show All Files'
                ).then(async selection => {
                    if (selection === 'Show All Files') {
                        // Show a quick pick of affected files
                        const fileItems = affectedFiles.map(f => ({
                            label: f.split('/').pop() || f,
                            description: f,
                            filePath: f
                        }));

                        const selectedFile = await vscode.window.showQuickPick(fileItems, {
                            title: 'Files with Changes',
                            placeHolder: 'Select a file to open'
                        });

                        if (selectedFile) {
                            const uri = vscode.Uri.file(selectedFile.filePath);
                            const doc = await vscode.workspace.openTextDocument(uri);
                            await vscode.window.showTextDocument(doc);
                        }
                    }
                });

            } catch (error) {
                vscode.window.showErrorMessage(`Error starting review: ${error}`);
            }
        }
    );
}
