
import { SessionManager } from '../services/sessionManager';
import { ExtensionContext } from 'vscode';
import { ReviewNote, ReviewSession } from '../models/types';

// Mock vscode objects
const mockContext = {
    workspaceState: {
        get: jest.fn(),
        update: jest.fn()
    }
} as unknown as ExtensionContext;

// Mock session data
const mockSession: ReviewSession = {
    commitHash: '123456',
    shortHash: '123456',
    commitMessage: 'test',
    baseCommitHash: 'parent',
    changes: [],
    notes: [],
    currentIndex: 0,
    startedAt: new Date()
};

describe('SessionManager Notes Logic', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup mock to return no session initially
        (mockContext.workspaceState.get as jest.Mock).mockReturnValue(undefined);
        sessionManager = new SessionManager(mockContext);
    });

    test('addNote should add a note to the active session', () => {
        // 1. Start session
        sessionManager.startSession('123', '123', 'msg', 'parent', []);

        // 2. Add Note
        const note: ReviewNote = {
            id: 'note1',
            filePath: '/test/file.ts',
            line: 10,
            content: 'This is a test note',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        let eventFired = false;
        sessionManager.on('noteAdded', (n) => {
            expect(n).toEqual(note);
            eventFired = true;
        });

        sessionManager.addNote(note);

        // 3. Verify state
        const notes = sessionManager.getNotesForFile('/test/file.ts');
        expect(notes).toHaveLength(1);
        expect(notes[0].content).toBe('This is a test note');
        expect(eventFired).toBe(true);

        // 4. Verify persistence
        expect(mockContext.workspaceState.update).toHaveBeenCalled();
    });

    test('updateNote should modify existing note content', () => {
        sessionManager.startSession('123', '123', 'msg', 'parent', []);

        const note: ReviewNote = {
            id: 'note1',
            filePath: '/test/file.ts',
            line: 10,
            content: 'Original content',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        sessionManager.addNote(note);

        // Update
        sessionManager.updateNote('note1', 'Updated content');

        const updatedNote = sessionManager.getNotesForFile('/test/file.ts')[0];
        expect(updatedNote.content).toBe('Updated content');
        expect(updatedNote.updatedAt.getTime()).toBeGreaterThanOrEqual(note.updatedAt.getTime());
    });

    test('resolveNote should change status to resolved', () => {
        sessionManager.startSession('123', '123', 'msg', 'parent', []);

        const note: ReviewNote = {
            id: 'note1',
            filePath: '/test/file.ts',
            line: 10,
            content: 'Note',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        sessionManager.addNote(note);

        sessionManager.resolveNote('note1');

        // Should not be returned by getNotesForFile (which returns active only)
        const activeNotes = sessionManager.getNotesForFile('/test/file.ts');
        expect(activeNotes).toHaveLength(0);

        // But should exist in unresolved check? No, resolveNote means it IS resolved.
        const unresolved = sessionManager.getUnresolvedNotes();
        expect(unresolved).toHaveLength(0);

        // Access session directly to verify property
        const session = sessionManager.getCurrentSession();
        expect(session?.notes[0].status).toBe('resolved');
    });

    test('deleteNote should remove note entirely', () => {
        sessionManager.startSession('123', '123', 'msg', 'parent', []);

        const note: ReviewNote = {
            id: 'note1',
            filePath: '/test/file.ts',
            line: 10,
            content: 'Note',
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        sessionManager.addNote(note);

        sessionManager.deleteNote('note1');

        const session = sessionManager.getCurrentSession();
        expect(session?.notes).toHaveLength(0);
    });

    test('getUnresolvedNotes should return only active notes', () => {
        sessionManager.startSession('123', '123', 'msg', 'parent', []);

        sessionManager.addNote({
            id: '1', filePath: 'a', line: 1, content: 'a', status: 'active', createdAt: new Date(), updatedAt: new Date()
        });
        sessionManager.addNote({
            id: '2', filePath: 'a', line: 2, content: 'b', status: 'resolved', createdAt: new Date(), updatedAt: new Date()
        });

        const unresolved = sessionManager.getUnresolvedNotes();
        expect(unresolved).toHaveLength(1);
        expect(unresolved[0].id).toBe('1');
    });
});
