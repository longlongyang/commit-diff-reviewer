
import { SessionManager } from '../services/sessionManager';
import { ExtensionContext } from 'vscode';
import { DiffChange, ReviewSession } from '../models/types';

// Mock context
const mockContext = {
    workspaceState: {
        get: jest.fn(),
        update: jest.fn()
    }
} as unknown as ExtensionContext;

// Mock session factory
function createSession(changes: DiffChange[]): ReviewSession {
    return {
        commitHash: '123',
        shortHash: '123',
        commitMessage: 'msg',
        baseCommitHash: 'base',
        changes,
        notes: [],
        currentIndex: 0,
        startedAt: new Date()
    };
}

// Helper to create change
const mkChange = (id: string, file: string, status: 'pending' | 'accepted' | 'rejected' = 'pending'): DiffChange => ({
    id, filePath: file, originalLineStart: 1, originalLineCount: 1, newLineStart: 1, newLineCount: 1, type: 'add', content: 'foo', status
} as any);

describe('Navigation Priority Logic', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
        jest.clearAllMocks();
        (mockContext.workspaceState.get as jest.Mock).mockReturnValue(undefined);
        sessionManager = new SessionManager(mockContext);
        sessionManager.startSession('123', '123', 'msg', 'base', []);
    });

    /**
     * Scenario:
     * List: [A1, A2, B1, B2]
     * User jumps to B1 (Index 2).
     * User accepts B1.
     * Expected: Auto-nav should go to B2 (next in same file), NOT A1 (start of list).
     */
    test('should stay in same file after resolving out-of-order change', () => {
        const changes = [
            mkChange('a1', 'fileA'),
            mkChange('a2', 'fileA'),
            mkChange('b1', 'fileB'),
            mkChange('b2', 'fileB')
        ];

        // Manually inject session
        (sessionManager as any).session.changes = changes;

        // 1. Simulate User jumping to B1
        // We need a method to set current index by ID
        sessionManager.setCurrentChange('b1');
        expect(sessionManager.getCurrentSession()?.currentIndex).toBe(2);

        // 2. Resolve B1
        sessionManager.acceptChange('b1');

        // Post-resolution state:
        // B1 is accepted. Pending list effectively: [A1, A2, B2]
        // If index was 2, it should now point to the item at index 2 in the *new* pending list?
        // Wait, SessionManager.changes includes ALL changes (accepted/rejected too).
        // getPendingChanges() filters them.

        // Let's look at nextChange logic.
        // nextChange increments index.

        // If we simply increment index from 2 -> 3.
        // changes[3] is B2.
        // Is B2 pending? Yes.
        // So nextChange() should return B2.

        const next = sessionManager.getCurrentChange();
        expect(next?.id).toBe('b2');
    });

    test('should wrap to start if end of file reached', () => {
        const changes = [
            mkChange('a1', 'fileA'),
            mkChange('b1', 'fileB')
        ];
        (sessionManager as any).session.changes = changes;

        // Jump to B1
        sessionManager.setCurrentChange('b1');

        // Resolve B1
        sessionManager.acceptChange('b1');

        // Next change should wrap to A1
        const next = sessionManager.getCurrentChange();
        expect(next?.id).toBe('a1');
    });
});
