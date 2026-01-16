
import * as vscode from 'vscode';
import { SessionManager } from '../services/sessionManager';
import { NoteCommentManager } from '../providers/noteCommentManager';
import { ReviewNote } from '../models/types';

// Mocks
jest.mock('vscode', () => {
    return {
        Uri: { file: jest.fn(path => ({ fsPath: path, scheme: 'file' })) },
        Range: jest.fn((l1, c1, l2, c2) => ({ start: { line: l1, character: c1 }, end: { line: l2, character: c2 }, isEqual: jest.fn(() => false) })),
        MarkdownString: jest.fn(val => ({ value: val })),
        CommentMode: { Preview: 1, Editing: 2 },
        comments: {
            createCommentController: jest.fn()
        },
        Disposable: jest.fn()
    };
});
jest.mock('../services/sessionManager');

// Helper to create mock objects
const createMockNote = (id: string): ReviewNote => ({
    id,
    filePath: '/test/file.ts',
    line: 5,
    content: 'test content',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date()
});

describe('NoteCommentManager', () => {
    let sessionManager: jest.Mocked<SessionManager>;
    let manager: NoteCommentManager;
    let mockContext: vscode.ExtensionContext;
    let mockThread: any;
    let mockController: any;

    beforeEach(() => {
        // Setup mock SessionManager behavior
        // We create a "real" object structure to hold listeners
        const listeners: Record<string, Function[]> = {};

        sessionManager = {
            on: jest.fn((event, cb) => {
                if (!listeners[event]) listeners[event] = [];
                listeners[event].push(cb);
                return sessionManager;
            }),
            off: jest.fn(),
            hasActiveSession: jest.fn().mockReturnValue(false),
            getCurrentSession: jest.fn().mockReturnValue(null),
            // Add other required properties as 'any' to satisfy type
        } as any;

        // Setup mock VS Code APIs
        mockThread = {
            dispose: jest.fn(),
            range: new vscode.Range(0, 0, 0, 0),
            comments: []
        };

        mockController = {
            createCommentThread: jest.fn().mockReturnValue(mockThread),
            dispose: jest.fn()
        };
        (vscode.comments.createCommentController as jest.Mock).mockReturnValue(mockController);

        mockContext = { subscriptions: [] } as any;

        manager = new NoteCommentManager(sessionManager, mockContext);
    });

    test('should register listeners on init', () => {
        expect(sessionManager.on).toHaveBeenCalledWith('noteAdded', expect.any(Function));
        expect(sessionManager.on).toHaveBeenCalledWith('noteUpdated', expect.any(Function));
        expect(sessionManager.on).toHaveBeenCalledWith('noteResolved', expect.any(Function));
    });

    test('addNoteThread should create a comment thread', () => {
        const note = createMockNote('n1');

        // Verify listener registration
        expect(sessionManager.on).toHaveBeenCalledWith('noteAdded', expect.any(Function));

        // Trigger manually by grabbing the callback
        const addCalls = (sessionManager.on as jest.Mock).mock.calls.filter(c => c[0] === 'noteAdded');
        const callback = addCalls[addCalls.length - 1][1];
        callback(note);

        expect(mockController.createCommentThread).toHaveBeenCalled();
        expect(mockThread.comments).toHaveLength(1);
        expect(mockThread.comments[0].body.value).toBe('test content');
    });

    test('updateNoteThread should update comments', () => {
        const note = createMockNote('n1');

        // Add first
        (manager as any).addNoteThread(note);

        // Update
        const updatedNote = { ...note, content: 'updated content' };
        const updateCalls = (sessionManager.on as jest.Mock).mock.calls.filter(c => c[0] === 'noteUpdated');
        const callback = updateCalls[updateCalls.length - 1][1];
        callback(updatedNote);

        expect(mockThread.comments[0].body.value).toBe('updated content');
    });

    test('removeNoteThread should dispose thread', () => {
        const note = createMockNote('n1');
        (manager as any).addNoteThread(note);

        const resolveCalls = (sessionManager.on as jest.Mock).mock.calls.filter(c => c[0] === 'noteResolved');
        const callback = resolveCalls[resolveCalls.length - 1][1];
        callback(note);

        expect(mockThread.dispose).toHaveBeenCalled();
    });
});
