/**
 * Session Manager - Manages review session state and persistence
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { DiffChange, ReviewSession, SerializedSession, ReviewNote } from '../models/types';

const SESSION_STORAGE_KEY = 'commitDiffReviewer.session';

export class SessionManager extends EventEmitter {
    private session: ReviewSession | null = null;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        this.restoreSession();
    }

    /**
     * Start a new review session
     */
    startSession(
        commitHash: string,
        shortHash: string,
        commitMessage: string,
        baseCommitHash: string,
        changes: DiffChange[]
    ): void {
        this.session = {
            commitHash,
            shortHash,
            commitMessage,
            baseCommitHash,
            changes,
            notes: [],
            currentIndex: 0,
            startedAt: new Date()
        };

        this.persistSession();
        this.emit('sessionStarted', this.session);

        // Set context for keybindings
        vscode.commands.executeCommand('setContext', 'commitDiffReviewer.inSession', true);
    }

    /**
     * End the current review session
     */
    endSession(): { accepted: number; rejected: number; pending: number } | null {
        if (!this.session) {
            return null;
        }

        const stats = this.getSessionStats();

        this.session = null;
        this.context.workspaceState.update(SESSION_STORAGE_KEY, undefined);
        this.emit('sessionEnded');

        // Clear context for keybindings
        vscode.commands.executeCommand('setContext', 'commitDiffReviewer.inSession', false);

        return stats;
    }

    /**
     * Get current session
     */
    getCurrentSession(): ReviewSession | null {
        return this.session;
    }

    /**
     * Check if a session is active
     */
    hasActiveSession(): boolean {
        return this.session !== null;
    }

    /**
     * Get all changes
     */
    getAllChanges(): DiffChange[] {
        return this.session?.changes || [];
    }

    /**
     * Get pending changes
     */
    getPendingChanges(): DiffChange[] {
        return this.session?.changes.filter(c => c.status === 'pending') || [];
    }

    /**
     * Get changes for a specific file
     */
    getChangesForFile(filePath: string): DiffChange[] {
        return this.session?.changes.filter(c => c.filePath === filePath) || [];
    }

    /**
     * Get pending changes for a specific file
     */
    getPendingChangesForFile(filePath: string): DiffChange[] {
        return this.session?.changes.filter(
            c => c.filePath === filePath && c.status === 'pending'
        ) || [];
    }

    /**
     * Get current change
     */
    getCurrentChange(): DiffChange | null {
        if (!this.session || this.session.currentIndex < 0) {
            return null;
        }
        const pending = this.getPendingChanges();
        if (this.session.currentIndex >= pending.length) {
            return null;
        }
        return pending[this.session.currentIndex];
    }

    /**
     * Get change by ID
     */
    getChangeById(changeId: string): DiffChange | null {
        return this.session?.changes.find(c => c.id === changeId) || null;
    }

    /**
     * Accept a change
     */
    acceptChange(changeId: string): boolean {
        const change = this.getChangeById(changeId);
        if (!change || change.status !== 'pending') {
            return false;
        }

        change.status = 'accepted';
        this.persistSession();
        this.normalizeIndex();
        this.emit('changeAccepted', change);
        this.emit('changeUpdated', change);

        return true;
    }

    /**
     * Reject a change
     */
    rejectChange(changeId: string): boolean {
        const change = this.getChangeById(changeId);
        if (!change || change.status !== 'pending') {
            return false;
        }

        change.status = 'rejected';
        this.persistSession();
        this.normalizeIndex();
        this.emit('changeRejected', change);
        this.emit('changeUpdated', change);

        return true;
    }

    /**
     * Navigate to next pending change
     */
    nextChange(): DiffChange | null {
        if (!this.session) {
            return null;
        }

        const pending = this.getPendingChanges();
        if (pending.length === 0) {
            return null;
        }

        this.session.currentIndex = (this.session.currentIndex + 1) % pending.length;
        this.persistSession();

        const change = pending[this.session.currentIndex];
        this.emit('currentChangeUpdated', change);
        return change;
    }

    /**
     * Navigate to previous pending change
     */
    prevChange(): DiffChange | null {
        if (!this.session) {
            return null;
        }

        const pending = this.getPendingChanges();
        if (pending.length === 0) {
            return null;
        }

        this.session.currentIndex = this.session.currentIndex - 1;
        if (this.session.currentIndex < 0) {
            this.session.currentIndex = pending.length - 1;
        }
        this.persistSession();

        const change = pending[this.session.currentIndex];
        this.emit('currentChangeUpdated', change);
        return change;
    }

    /**
     * Get session statistics
     */
    getSessionStats(): { accepted: number; rejected: number; pending: number } {
        if (!this.session) {
            return { accepted: 0, rejected: 0, pending: 0 };
        }

        return {
            accepted: this.session.changes.filter(c => c.status === 'accepted').length,
            rejected: this.session.changes.filter(c => c.status === 'rejected').length,
            pending: this.session.changes.filter(c => c.status === 'pending').length
        };
    }

    /**
     * Add a new note
     */
    addNote(note: ReviewNote): void {
        if (!this.session) return;
        this.session.notes.push(note);
        this.persistSession();
        this.emit('noteAdded', note);
        this.emit('notesUpdated');
    }

    /**
     * Update an existing note
     */
    updateNote(noteId: string, content: string): void {
        if (!this.session) return;
        const note = this.session.notes.find(n => n.id === noteId);
        if (note) {
            note.content = content;
            note.updatedAt = new Date();
            this.persistSession();
            this.emit('noteUpdated', note);
            this.emit('notesUpdated');
        }
    }

    /**
     * Resolve a note
     */
    resolveNote(noteId: string): void {
        if (!this.session) return;
        const note = this.session.notes.find(n => n.id === noteId);
        if (note) {
            note.status = 'resolved';
            this.persistSession();
            this.emit('noteResolved', note);
            this.emit('notesUpdated');
        }
    }

    /**
     * Delete a note
     */
    deleteNote(noteId: string): void {
        if (!this.session) return;
        const index = this.session.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            const deleted = this.session.notes[index];
            this.session.notes.splice(index, 1);
            this.persistSession();
            this.emit('noteDeleted', deleted);
            this.emit('notesUpdated');
        }
    }

    /**
     * Get all active notes for a file
     */
    getNotesForFile(filePath: string): ReviewNote[] {
        return this.session?.notes.filter(
            n => n.filePath === filePath && n.status === 'active'
        ) || [];
    }

    /**
     * Get all unresolved notes
     */
    getUnresolvedNotes(): ReviewNote[] {
        return this.session?.notes.filter(n => n.status === 'active') || [];
    }

    /**
     * Update line numbers after document edit
     */
    updateLineMapping(
        uri: vscode.Uri,
        contentChanges: readonly vscode.TextDocumentContentChangeEvent[]
    ): void {
        if (!this.session) {
            return;
        }

        const filePath = uri.fsPath.replace(/\\/g, '/');
        const fileChanges = this.session.changes.filter(c => c.filePath === filePath);
        const fileNotes = this.session.notes.filter(n => n.filePath === filePath && n.status === 'active');

        if (fileChanges.length === 0 && fileNotes.length === 0) {
            return;
        }

        let changesUpdated = false;
        let notesUpdated = false;

        for (const change of contentChanges) {
            const editStartLine = change.range.start.line + 1; // Convert to 1-indexed
            const editEndLine = change.range.end.line + 1;
            const linesRemoved = editEndLine - editStartLine + 1;
            const linesAdded = change.text.split('\n').length;
            const lineDelta = linesAdded - linesRemoved;

            // Update Changes
            for (const fileChange of fileChanges) {
                if (fileChange.status !== 'pending') continue;
                if (fileChange.newLineStart > editEndLine) {
                    fileChange.newLineStart += lineDelta;
                    changesUpdated = true;
                }
            }

            // Update Notes
            for (const note of fileNotes) {
                if (note.line > editEndLine) {
                    note.line += lineDelta;
                    notesUpdated = true;
                }
            }
        }

        if (changesUpdated || notesUpdated) {
            this.persistSession();
            if (changesUpdated) this.emit('lineMappingUpdated');
            if (notesUpdated) this.emit('notesUpdated');
        }
    }

    /**
     * Persist session to workspace state
     */
    private persistSession(): void {
        if (!this.session) {
            return;
        }

        const serialized: SerializedSession = {
            commitHash: this.session.commitHash,
            shortHash: this.session.shortHash,
            commitMessage: this.session.commitMessage,
            baseCommitHash: this.session.baseCommitHash,
            changes: this.session.changes,
            notes: this.session.notes,
            currentIndex: this.session.currentIndex,
            startedAt: this.session.startedAt.toISOString()
        };

        this.context.workspaceState.update(SESSION_STORAGE_KEY, serialized);
    }

    /**
     * Restore session from workspace state
     */
    private restoreSession(): void {
        const serialized = this.context.workspaceState.get<SerializedSession>(SESSION_STORAGE_KEY);

        if (!serialized) {
            return;
        }

        this.session = {
            commitHash: serialized.commitHash,
            shortHash: serialized.shortHash,
            commitMessage: serialized.commitMessage,
            baseCommitHash: serialized.baseCommitHash,
            changes: serialized.changes,
            notes: serialized.notes || [], // Backward compatibility
            currentIndex: serialized.currentIndex,
            startedAt: new Date(serialized.startedAt)
        };

        // Restore context for keybindings
        vscode.commands.executeCommand('setContext', 'commitDiffReviewer.inSession', true);
        this.emit('sessionRestored', this.session);
    }

    /**
     * Normalize current index to ensure it is within bounds
     * Call this after accepting/rejecting a change
     */
    private normalizeIndex(): void {
        if (!this.session) return;

        const pending = this.getPendingChanges();
        if (pending.length === 0) {
            return;
        }

        if (this.session.currentIndex >= pending.length) {
            // Wrap to start if we fell off the end
            this.session.currentIndex = 0;
        }
    }
}
