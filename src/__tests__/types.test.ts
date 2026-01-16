/**
 * Unit tests for type definitions
 */

import { ChangeStatus, ChangeType, DiffChange, ReviewSession, CommitInfo } from '../models/types';

describe('Types', () => {
    describe('DiffChange', () => {
        it('should allow valid DiffChange object', () => {
            const change: DiffChange = {
                id: 'test-id',
                type: 'add',
                filePath: '/path/to/file.ts',
                oldLineStart: 1,
                oldLineCount: 0,
                newLineStart: 1,
                newLineCount: 3,
                oldContent: [],
                newContent: ['line1', 'line2', 'line3'],
                status: 'pending'
            };

            expect(change.id).toBe('test-id');
            expect(change.type).toBe('add');
            expect(change.status).toBe('pending');
        });

        it('should allow all change types', () => {
            const types: ChangeType[] = ['add', 'delete', 'modify'];
            types.forEach(type => {
                const change: DiffChange = {
                    id: 'id',
                    type,
                    filePath: '/file.ts',
                    oldLineStart: 1,
                    oldLineCount: 1,
                    newLineStart: 1,
                    newLineCount: 1,
                    oldContent: ['old'],
                    newContent: ['new'],
                    status: 'pending'
                };
                expect(change.type).toBe(type);
            });
        });

        it('should allow all status types', () => {
            const statuses: ChangeStatus[] = ['pending', 'accepted', 'rejected'];
            statuses.forEach(status => {
                const change: DiffChange = {
                    id: 'id',
                    type: 'add',
                    filePath: '/file.ts',
                    oldLineStart: 1,
                    oldLineCount: 0,
                    newLineStart: 1,
                    newLineCount: 1,
                    oldContent: [],
                    newContent: ['line'],
                    status
                };
                expect(change.status).toBe(status);
            });
        });
    });

    describe('ReviewSession', () => {
        it('should allow valid ReviewSession object', () => {
            const session: ReviewSession = {
                commitHash: 'abc1234567890',
                shortHash: 'abc1234',
                commitMessage: 'Test commit message',
                baseCommitHash: 'parent123',
                changes: [],
                currentIndex: 0,
                startedAt: new Date()
            };

            expect(session.commitHash).toBe('abc1234567890');
            expect(session.changes).toHaveLength(0);
        });
    });

    describe('CommitInfo', () => {
        it('should allow valid CommitInfo object', () => {
            const commit: CommitInfo = {
                hash: 'abc1234567890',
                shortHash: 'abc1234',
                message: 'Fix bug in login',
                author: 'John Doe',
                email: 'john@example.com',
                date: new Date('2024-01-15T10:00:00Z')
            };

            expect(commit.author).toBe('John Doe');
            expect(commit.date).toBeInstanceOf(Date);
        });
    });
});
