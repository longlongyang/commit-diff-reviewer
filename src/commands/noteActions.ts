
import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { NoteCommentManager } from '../providers/noteCommentManager';
import { NoteInputPanel } from '../ui/noteInputPanel';
import { ReviewNote } from '../models/types';
import * as path from 'path';
// NoteCommentManager imported above

/**
 * Add a new note at current cursor position
 */
export async function addNote(
    context: vscode.ExtensionContext,
    sessionManager: SessionManager,
    noteCommentManager: NoteCommentManager
): Promise<void> {
    if (!sessionManager.hasActiveSession()) {
        const result = await vscode.window.showWarningMessage(
            'No active review session. Start one?',
            'Start Session', 'Cancel'
        );
        if (result === 'Start Session') {
            vscode.commands.executeCommand('commitDiffReviewer.selectCommit');
        }
        return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }

    const filePath = editor.document.uri.fsPath.replace(/\\/g, '/');
    const position = editor.selection.active;
    const selection = editor.selection;

    // Open Input Panel
    NoteInputPanel.createOrShow(
        context.extensionUri,
        '',
        `Add Note at line ${position.line + 1}`,
        (content) => {
            if (!content.trim()) return;

            const newNote: ReviewNote = {
                id: generateId(),
                filePath,
                line: position.line + 1,
                content,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                selectionRange: !selection.isEmpty ? {
                    startLine: selection.start.line,
                    startChar: selection.start.character,
                    endLine: selection.end.line,
                    endChar: selection.end.character
                } : undefined
            };

            sessionManager.addNote(newNote);
            sessionManager.addNote(newNote);
            // noteCommentManager listens to 'noteAdded' event automatically
            vscode.window.showInformationMessage('Note added');
        }
    );
}

/**
 * Edit an existing note
 */
export async function editNote(
    context: vscode.ExtensionContext,
    sessionManager: SessionManager,
    note: ReviewNote,
    noteCommentManager: NoteCommentManager
): Promise<void> {
    NoteInputPanel.createOrShow(
        context.extensionUri,
        note.content,
        `Edit Note at line ${note.line}`,
        (content) => {
            if (!content.trim()) return;
            sessionManager.updateNote(note.id, content);
            sessionManager.updateNote(note.id, content);
            // noteCommentManager listens to 'noteUpdated' event
            vscode.window.showInformationMessage('Note updated');
        }
    );
}

/**
 * Resolve a note
 */
export async function resolveNote(
    sessionManager: SessionManager,
    note: ReviewNote,
    noteCommentManager: NoteCommentManager
): Promise<void> {
    const config = vscode.workspace.getConfiguration('commitDiffReviewer');
    const deleteOnResolve = config.get<boolean>('deleteNoteOnResolve', true);

    if (deleteOnResolve) {
        const confirm = await vscode.window.showInformationMessage(
            'Resolve and delete this note?',
            'Yes', 'No'
        );
        if (confirm !== 'Yes') return;

        sessionManager.deleteNote(note.id);
        vscode.window.showInformationMessage('Note resolved and deleted');
    } else {
        sessionManager.resolveNote(note.id);
        vscode.window.showInformationMessage('Note resolved');
    }
}

/**
 * Helper to find note at current cursor position
 */
export function getNoteAtCursor(sessionManager: SessionManager): ReviewNote | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return undefined;

    const filePath = editor.document.uri.fsPath.replace(/\\/g, '/');
    const line = editor.selection.active.line + 1;
    const notes = sessionManager.getNotesForFile(filePath);

    // Find note on this line
    return notes.find(n => n.line === line);
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 15);
}
