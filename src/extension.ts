/**
 * Commit Diff Reviewer - Extension Entry Point
 * 
 * This extension provides interactive review of Git commit differences
 * with accept/reject functionality for each change.
 */

import * as vscode from 'vscode';

// Services
import { GitService } from './services/gitService';
import { SessionManager } from './services/sessionManager';

// Providers
import { DecorationProvider } from './providers/decorationProvider';
import { DiffCodeLensProvider } from './providers/codeLensProvider';
import { StatusBarProvider } from './providers/statusBarProvider';

// Commands
import { selectCommit } from './commands/selectCommit';
import { nextChange, prevChange } from './commands/navigation';
import {
    acceptChange,
    acceptChangeById,
    rejectChange,
    rejectChangeById,
    acceptAll,
    rejectAll
} from './commands/diffActions';
import { endSession } from './commands/endSession';
import { showStatusMenu } from './commands/statusBarActions';
import { NoteDecorationProvider } from './providers/noteDecorationProvider';
import { addNote, editNote, getNoteAtCursor, resolveNote } from './commands/noteActions';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('Commit Diff Reviewer is now active');

    // Initialize services
    const gitService = new GitService();
    const sessionManager = new SessionManager(context);

    // Initialize providers
    const decorationProvider = new DecorationProvider(sessionManager);
    const statusBarProvider = new StatusBarProvider(sessionManager);
    const noteDecorationProvider = new NoteDecorationProvider(sessionManager, context);

    // Check for session recovery
    if (sessionManager.hasActiveSession()) {
        vscode.window.showInformationMessage(
            'A review session was in progress. Resume?',
            'Yes', 'No'
        ).then(selection => {
            if (selection === 'No') {
                sessionManager.endSession(); // Clear it
            }
            // If Yes, it's already loaded by SessionManager constructor
        });
    }

    // Register CodeLens provider
    const codeLensProvider = new DiffCodeLensProvider(sessionManager);
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider)
    );

    // Register commands
    context.subscriptions.push(
        // Main command - Select commit to review
        vscode.commands.registerCommand('commitDiffReviewer.selectCommit',
            () => selectCommit(gitService, sessionManager, decorationProvider)),

        // Navigation commands
        vscode.commands.registerCommand('commitDiffReviewer.nextChange',
            () => nextChange(sessionManager, decorationProvider)),

        vscode.commands.registerCommand('commitDiffReviewer.prevChange',
            () => prevChange(sessionManager, decorationProvider)),

        // Accept/Reject commands (for current change, or by ID if provided)
        vscode.commands.registerCommand('commitDiffReviewer.acceptChange',
            (changeId?: string) => {
                if (changeId) {
                    acceptChangeById(sessionManager, decorationProvider, changeId);
                } else {
                    acceptChange(sessionManager, decorationProvider);
                }
            }),

        vscode.commands.registerCommand('commitDiffReviewer.rejectChange',
            (changeId?: string) => {
                if (changeId) {
                    rejectChangeById(sessionManager, gitService, decorationProvider, changeId);
                } else {
                    rejectChange(sessionManager, gitService, decorationProvider);
                }
            }),

        // Batch operations
        vscode.commands.registerCommand('commitDiffReviewer.acceptAll',
            () => acceptAll(sessionManager, decorationProvider)),

        vscode.commands.registerCommand('commitDiffReviewer.rejectAll',
            () => rejectAll(sessionManager, gitService, decorationProvider)),

        // Note Commands
        vscode.commands.registerCommand('commitDiffReviewer.addNote', () =>
            addNote(context, sessionManager, noteDecorationProvider)),

        vscode.commands.registerCommand('commitDiffReviewer.editNote', () => {
            const note = getNoteAtCursor(sessionManager);
            if (note) editNote(context, sessionManager, note, noteDecorationProvider);
        }),

        vscode.commands.registerCommand('commitDiffReviewer.resolveNote', () => {
            const note = getNoteAtCursor(sessionManager);
            if (note) resolveNote(sessionManager, note, noteDecorationProvider);
        }),

        // Accept/Reject by ID (for CodeLens buttons) - these are the original explicit ones
        vscode.commands.registerCommand(
            'commitDiffReviewer.acceptChangeById',
            (changeId: string) => acceptChangeById(sessionManager, decorationProvider, changeId)
        ),
        vscode.commands.registerCommand(
            'commitDiffReviewer.rejectChangeById',
            (changeId: string) => rejectChangeById(sessionManager, gitService, decorationProvider, changeId)
        ),

        // Batch operations
        vscode.commands.registerCommand(
            'commitDiffReviewer.acceptAll',
            () => acceptAll(sessionManager, decorationProvider)
        ),
        vscode.commands.registerCommand(
            'commitDiffReviewer.rejectAll',
            () => rejectAll(sessionManager, gitService, decorationProvider)
        ),

        // End session
        vscode.commands.registerCommand(
            'commitDiffReviewer.endSession',
            () => endSession(sessionManager, decorationProvider)
        ),

        // Status Bar interactive menu
        vscode.commands.registerCommand(
            'commitDiffReviewer.showStatusMenu',
            () => showStatusMenu(sessionManager, gitService, decorationProvider)
        )
    );

    // Listen for document changes to update line mappings
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (sessionManager.hasActiveSession()) {
                sessionManager.updateLineMapping(
                    event.document.uri,
                    event.contentChanges
                );
            }
        })
    );

    // Set initial context for keybindings
    vscode.commands.executeCommand(
        'setContext',
        'commitDiffReviewer.inSession',
        sessionManager.hasActiveSession()
    );

    // Register disposables
    context.subscriptions.push(decorationProvider);
    context.subscriptions.push(codeLensProvider);
    context.subscriptions.push(statusBarProvider);

    // If there's a restored session, apply decorations
    if (sessionManager.hasActiveSession()) {
        // Wait a bit for editors to be ready, then apply decorations
        setTimeout(() => {
            decorationProvider.refreshAllEditors();
        }, 500);
    }
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    console.log('Commit Diff Reviewer is now deactivated');
}
