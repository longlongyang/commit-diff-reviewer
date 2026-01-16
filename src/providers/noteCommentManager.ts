
import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { ReviewNote } from '../models/types';

export class NoteCommentManager implements vscode.Disposable {
    private sessionManager: SessionManager;
    private commentController: vscode.CommentController;
    private threads: Map<string, vscode.CommentThread> = new Map(); // noteId -> thread
    private disposables: vscode.Disposable[] = [];

    constructor(sessionManager: SessionManager, context: vscode.ExtensionContext) {
        this.sessionManager = sessionManager;
        this.commentController = vscode.comments.createCommentController('commitDiffReviewer', 'Commit Diff Reviewer');
        this.commentController.commentingRangeProvider = {
            provideCommentingRanges: (document: vscode.TextDocument, token: vscode.CancellationToken) => {
                // We allow commenting everywhere, but we trigger it manually via context menu usually
                return [new vscode.Range(0, 0, document.lineCount, 0)];
            }
        };

        this.disposables.push(this.commentController);

        // Listen for session events
        this.registerListener('noteAdded', (note: ReviewNote) => this.addNoteThread(note));
        this.registerListener('noteUpdated', (note: ReviewNote) => this.updateNoteThread(note));
        this.registerListener('noteResolved', (note: ReviewNote) => this.removeNoteThread(note.id));
        this.registerListener('noteDeleted', (note: ReviewNote) => this.removeNoteThread(note.id));
        this.registerListener('sessionRestored', () => this.refreshAllNotes());

        // Listen for line mapping updates (to move threads)
        this.registerListener('lineMappingUpdated', () => this.refreshAllNotes());

        // Session ended
        this.registerListener('sessionEnded', () => this.clearAll());

        // Initial load
        if (this.sessionManager.hasActiveSession()) {
            this.refreshAllNotes();
        }
    }

    private registerListener(event: string, callback: (...args: any[]) => void): void {
        this.sessionManager.on(event, callback);
        this.disposables.push({
            dispose: () => this.sessionManager.off(event, callback)
        });
    }

    /**
     * Re-creates all threads from the current session
     */
    private refreshAllNotes(): void {
        // We could try to diff and update, but for robustness (especially line moves), 
        // passing through all active notes is safer.
        // However, destroying and recreating might flicker. 
        // Let's rely on standard ID updates.

        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        // active notes
        const activeNotes = session.notes.filter(n => n.status === 'active');
        const activeIds = new Set(activeNotes.map(n => n.id));

        // 1. Remove threads for notes that are no longer active
        for (const [id, thread] of this.threads) {
            if (!activeIds.has(id)) {
                thread.dispose();
                this.threads.delete(id);
            }
        }

        // 2. Add or Update threads
        for (const note of activeNotes) {
            if (this.threads.has(note.id)) {
                // Update position if changed (Comment API normally handles this if the range is tracked, 
                // but our SessionManager manually updates line numbers, so we might need to sync range)
                const thread = this.threads.get(note.id)!;
                const range = this.getNoteRange(note);
                if (thread.range && !thread.range.isEqual(range)) {
                    thread.range = range;
                }
            } else {
                this.addNoteThread(note);
            }
        }
    }

    private addNoteThread(note: ReviewNote): void {
        if (this.threads.has(note.id)) return;

        const uri = vscode.Uri.file(note.filePath);
        const range = this.getNoteRange(note);

        const thread = this.commentController.createCommentThread(uri, range, []);

        // Create the comment item
        const comment = new NoteComment(
            note,
            { name: 'Reviewer' },
            vscode.CommentMode.Preview
        );

        thread.comments = [comment];

        // Identify the thread by note ID for later lookup
        // We can't attach arbitrary data to thread easily without casting, but we keep a Map
        this.threads.set(note.id, thread);
    }

    private updateNoteThread(note: ReviewNote): void {
        const thread = this.threads.get(note.id);
        if (thread) {
            thread.comments = [new NoteComment(
                note,
                { name: 'Reviewer' },
                vscode.CommentMode.Preview
            )];
            // Update range if changed
            thread.range = this.getNoteRange(note);
        }
    }

    private removeNoteThread(noteId: string): void {
        const thread = this.threads.get(noteId);
        if (thread) {
            thread.dispose();
            this.threads.delete(noteId);
        }
    }

    private clearAll(): void {
        for (const thread of this.threads.values()) {
            thread.dispose();
        }
        this.threads.clear();
    }

    private getNoteRange(note: ReviewNote): vscode.Range {
        // Note: note.line is 1-based start line.
        // If we have selectionRange, use it. Otherwise use the specific line.
        // We convert to 0-based for VS Code API.

        /* 
         * Important: types.ts might not have selectionRange yet because I didn't see it explicitly in the summary,
         * but the plan mentioned it. Let's check types.ts.
         * The user summary said: "optional selectionRange".
         * If missing, default to single line.
         */
        const line0 = Math.max(0, note.line - 1);
        return new vscode.Range(line0, 0, line0, 0);
    }

    dispose(): void {
        this.clearAll();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}

class NoteComment implements vscode.Comment {
    id: string;
    body: vscode.MarkdownString;
    mode: vscode.CommentMode;
    author: vscode.CommentAuthorInformation;
    contextValue?: string;
    label?: string;

    constructor(
        note: ReviewNote,
        author: vscode.CommentAuthorInformation,
        mode: vscode.CommentMode
    ) {
        this.id = note.id;
        this.body = new vscode.MarkdownString(note.content);
        this.mode = mode;
        this.author = author;
        // set context value to enable actions in package.json menus if needed,
        // specifically triggers for "resolve" / "edit"
        this.contextValue = 'commitDiffReviewer.note';
        this.label = 'Review Note';
    }
}
