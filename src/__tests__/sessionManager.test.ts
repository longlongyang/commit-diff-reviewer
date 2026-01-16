/**
 * Unit tests for session manager
 */

// Mock vscode before importing sessionManager
jest.mock('vscode');

import { SessionManager } from '../services/sessionManager';
import { DiffChange } from '../models/types';

describe('SessionManager', () => {
    let sessionManager: SessionManager;
    let mockContext: any;

    beforeEach(() => {
        // Create a mock ExtensionContext
        mockContext = {
            workspaceState: {
                get: jest.fn().mockReturnValue(undefined),
                update: jest.fn().mockResolvedValue(undefined)
            },
            subscriptions: []
        };

        sessionManager = new SessionManager(mockContext);
    });

    afterEach(() => {
        sessionManager.removeAllListeners();
    });

    const createMockChanges = (): DiffChange[] => [
        {
            id: 'change1',
            type: 'add',
            filePath: '/mock/file1.ts',
            oldLineStart: 1,
            oldLineCount: 0,
            newLineStart: 1,
            newLineCount: 2,
            oldContent: [],
            newContent: ['line1', 'line2'],
            status: 'pending'
        },
        {
            id: 'change2',
            type: 'delete',
            filePath: '/mock/file1.ts',
            oldLineStart: 5,
            oldLineCount: 1,
            newLineStart: 5,
            newLineCount: 0,
            oldContent: ['deleted'],
            newContent: [],
            status: 'pending'
        },
        {
            id: 'change3',
            type: 'modify',
            filePath: '/mock/file2.ts',
            oldLineStart: 10,
            oldLineCount: 1,
            newLineStart: 10,
            newLineCount: 1,
            oldContent: ['old'],
            newContent: ['new'],
            status: 'pending'
        }
    ];

    describe('startSession', () => {
        it('should start a new session with given parameters', () => {
            const changes = createMockChanges();

            sessionManager.startSession(
                'abc1234567890',
                'abc1234',
                'Test commit',
                'parent123',
                changes
            );

            const session = sessionManager.getCurrentSession();
            expect(session).not.toBeNull();
            expect(session!.commitHash).toBe('abc1234567890');
            expect(session!.shortHash).toBe('abc1234');
            expect(session!.commitMessage).toBe('Test commit');
            expect(session!.baseCommitHash).toBe('parent123');
            expect(session!.changes).toHaveLength(3);
            expect(session!.currentIndex).toBe(0);
        });

        it('should emit sessionStarted event', () => {
            const changes = createMockChanges();
            const listener = jest.fn();
            sessionManager.on('sessionStarted', listener);

            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should persist session to workspace state', () => {
            const changes = createMockChanges();

            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            expect(mockContext.workspaceState.update).toHaveBeenCalled();
        });
    });

    describe('endSession', () => {
        it('should end the session and return stats', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            // Accept one change
            sessionManager.acceptChange('change1');

            const stats = sessionManager.endSession();

            expect(stats).toEqual({
                accepted: 1,
                rejected: 0,
                pending: 2
            });
            expect(sessionManager.getCurrentSession()).toBeNull();
        });

        it('should emit sessionEnded event', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const listener = jest.fn();
            sessionManager.on('sessionEnded', listener);

            sessionManager.endSession();

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should return null if no active session', () => {
            expect(sessionManager.endSession()).toBeNull();
        });
    });

    describe('hasActiveSession', () => {
        it('should return false when no session', () => {
            expect(sessionManager.hasActiveSession()).toBe(false);
        });

        it('should return true when session is active', () => {
            sessionManager.startSession('hash', 'short', 'msg', 'base', createMockChanges());
            expect(sessionManager.hasActiveSession()).toBe(true);
        });
    });

    describe('getPendingChanges', () => {
        it('should return only pending changes', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            sessionManager.acceptChange('change1');
            sessionManager.rejectChange('change2');

            const pending = sessionManager.getPendingChanges();

            expect(pending).toHaveLength(1);
            expect(pending[0].id).toBe('change3');
        });

        it('should return empty array when no session', () => {
            expect(sessionManager.getPendingChanges()).toEqual([]);
        });
    });

    describe('getChangesForFile', () => {
        it('should return changes for specific file', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const file1Changes = sessionManager.getChangesForFile('/mock/file1.ts');
            const file2Changes = sessionManager.getChangesForFile('/mock/file2.ts');

            expect(file1Changes).toHaveLength(2);
            expect(file2Changes).toHaveLength(1);
        });

        it('should return empty array for non-existent file', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const noChanges = sessionManager.getChangesForFile('/non/existent.ts');

            expect(noChanges).toEqual([]);
        });
    });

    describe('acceptChange', () => {
        it('should mark change as accepted', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const result = sessionManager.acceptChange('change1');

            expect(result).toBe(true);

            const change = sessionManager.getChangeById('change1');
            expect(change!.status).toBe('accepted');
        });

        it('should return false for non-existent change', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const result = sessionManager.acceptChange('nonexistent');

            expect(result).toBe(false);
        });

        it('should return false for already processed change', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            sessionManager.acceptChange('change1');
            const result = sessionManager.acceptChange('change1');

            expect(result).toBe(false);
        });

        it('should emit changeAccepted event', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const listener = jest.fn();
            sessionManager.on('changeAccepted', listener);

            sessionManager.acceptChange('change1');

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'change1' }));
        });
    });

    describe('rejectChange', () => {
        it('should mark change as rejected', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const result = sessionManager.rejectChange('change1');

            expect(result).toBe(true);

            const change = sessionManager.getChangeById('change1');
            expect(change!.status).toBe('rejected');
        });

        it('should emit changeRejected event', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const listener = jest.fn();
            sessionManager.on('changeRejected', listener);

            sessionManager.rejectChange('change1');

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({ id: 'change1' }));
        });
    });

    describe('navigation', () => {
        it('nextChange should cycle through pending changes', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            // Current index starts at 0
            const next1 = sessionManager.nextChange();
            expect(next1!.id).toBe('change2'); // index becomes 1

            const next2 = sessionManager.nextChange();
            expect(next2!.id).toBe('change3'); // index becomes 2

            const next3 = sessionManager.nextChange();
            expect(next3!.id).toBe('change1'); // wraps to 0
        });

        it('prevChange should cycle backwards', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const prev = sessionManager.prevChange();
            expect(prev!.id).toBe('change3'); // wraps to end
        });

        it('should return null when no pending changes', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            // Accept all changes
            sessionManager.acceptChange('change1');
            sessionManager.acceptChange('change2');
            sessionManager.acceptChange('change3');

            expect(sessionManager.nextChange()).toBeNull();
            expect(sessionManager.prevChange()).toBeNull();
        });
    });

    describe('getSessionStats', () => {
        it('should return correct statistics', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            sessionManager.acceptChange('change1');
            sessionManager.rejectChange('change2');

            const stats = sessionManager.getSessionStats();

            expect(stats).toEqual({
                accepted: 1,
                rejected: 1,
                pending: 1
            });
        });

        it('should return zeros when no session', () => {
            const stats = sessionManager.getSessionStats();

            expect(stats).toEqual({
                accepted: 0,
                rejected: 0,
                pending: 0
            });
        });
    });

    describe('getChangeById', () => {
        it('should return change by ID', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const change = sessionManager.getChangeById('change2');

            expect(change).not.toBeNull();
            expect(change!.type).toBe('delete');
        });

        it('should return null for non-existent ID', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            expect(sessionManager.getChangeById('nonexistent')).toBeNull();
        });
    });

    describe('getCurrentChange', () => {
        it('should return current pending change based on index', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            const current = sessionManager.getCurrentChange();

            expect(current).not.toBeNull();
            expect(current!.id).toBe('change1');
        });

        it('should return null when all changes processed', () => {
            const changes = createMockChanges();
            sessionManager.startSession('hash', 'short', 'msg', 'base', changes);

            sessionManager.acceptChange('change1');
            sessionManager.acceptChange('change2');
            sessionManager.acceptChange('change3');

            expect(sessionManager.getCurrentChange()).toBeNull();
        });
    });
});
