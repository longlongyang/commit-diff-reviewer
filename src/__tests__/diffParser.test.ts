/**
 * Unit tests for diff parser
 */

import { parseDiffOutput, flattenHunks, getAffectedFiles } from '../services/diffParser';

describe('diffParser', () => {
    const workspaceRoot = '/mock/workspace';

    describe('parseDiffOutput', () => {
        it('should parse a simple addition diff', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
 line2
+new line
 line3
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].filePath).toBe('file.ts');
            expect(hunks[0].changes).toHaveLength(1);
            expect(hunks[0].changes[0].type).toBe('add');
            expect(hunks[0].changes[0].newContent).toEqual(['new line']);
        });

        it('should parse a simple deletion diff', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,4 +1,3 @@
 line1
 line2
-deleted line
 line3
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].changes).toHaveLength(1);
            expect(hunks[0].changes[0].type).toBe('delete');
            expect(hunks[0].changes[0].oldContent).toEqual(['deleted line']);
        });

        it('should parse a modification diff', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old content
+new content
 line3
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].changes).toHaveLength(1);
            expect(hunks[0].changes[0].type).toBe('modify');
            expect(hunks[0].changes[0].oldContent).toEqual(['old content']);
            expect(hunks[0].changes[0].newContent).toEqual(['new content']);
        });

        it('should parse multiple hunks in one file', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,4 @@
 line1
+added at top
 line2
 line3
@@ -10,3 +11,4 @@
 line10
 line11
+added at bottom
 line12
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].changes).toHaveLength(2);
            expect(hunks[0].changes[0].type).toBe('add');
            expect(hunks[0].changes[1].type).toBe('add');
        });

        it('should parse multiple files', () => {
            const diffOutput = `diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,2 +1,3 @@
 content1
+new in file1
 end1
diff --git a/file2.ts b/file2.ts
index 1234567..abcdefg 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,2 +1,3 @@
 content2
+new in file2
 end2
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(2);
            expect(hunks[0].filePath).toBe('file1.ts');
            expect(hunks[1].filePath).toBe('file2.ts');
        });

        it('should detect new files', () => {
            const diffOutput = `diff --git a/newfile.ts b/newfile.ts
new file mode 100644
index 0000000..abcdefg
--- /dev/null
+++ b/newfile.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].isNew).toBe(true);
            expect(hunks[0].changes).toHaveLength(1);
            expect(hunks[0].changes[0].type).toBe('add');
            expect(hunks[0].changes[0].newLineCount).toBe(3);
        });

        it('should detect deleted files', () => {
            const diffOutput = `diff --git a/deleted.ts b/deleted.ts
deleted file mode 100644
index abcdefg..0000000
--- a/deleted.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(1);
            expect(hunks[0].isDeleted).toBe(true);
        });

        it('should skip binary files', () => {
            const diffOutput = `diff --git a/image.png b/image.png
index 1234567..abcdefg 100644
Binary files a/image.png and b/image.png differ
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks).toHaveLength(0);
        });

        it('should handle empty diff output', () => {
            const hunks = parseDiffOutput('', workspaceRoot);
            expect(hunks).toHaveLength(0);
        });

        it('should parse multi-line additions correctly', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,5 @@
 existing
+new line 1
+new line 2
+new line 3
 end
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            expect(hunks[0].changes).toHaveLength(1);
            expect(hunks[0].changes[0].newLineCount).toBe(3);
            expect(hunks[0].changes[0].newContent).toEqual([
                'new line 1',
                'new line 2',
                'new line 3'
            ]);
        });

        it('should handle line numbers correctly', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -5,3 +5,4 @@
 line5
 line6
+inserted after line 6
 line7
`;
            const hunks = parseDiffOutput(diffOutput, workspaceRoot);

            const change = hunks[0].changes[0];
            expect(change.newLineStart).toBe(7); // Line 7 in new file (after line6)
        });
    });

    describe('flattenHunks', () => {
        it('should flatten hunks from multiple files', () => {
            const hunks = [
                {
                    filePath: 'file1.ts',
                    isNew: false,
                    isDeleted: false,
                    isRenamed: false,
                    changes: [
                        { id: '1', type: 'add' as const, filePath: 'file1.ts', oldLineStart: 1, oldLineCount: 0, newLineStart: 1, newLineCount: 1, oldContent: [], newContent: ['a'], status: 'pending' as const },
                        { id: '2', type: 'add' as const, filePath: 'file1.ts', oldLineStart: 5, oldLineCount: 0, newLineStart: 6, newLineCount: 1, oldContent: [], newContent: ['b'], status: 'pending' as const }
                    ]
                },
                {
                    filePath: 'file2.ts',
                    isNew: false,
                    isDeleted: false,
                    isRenamed: false,
                    changes: [
                        { id: '3', type: 'delete' as const, filePath: 'file2.ts', oldLineStart: 1, oldLineCount: 1, newLineStart: 1, newLineCount: 0, oldContent: ['c'], newContent: [], status: 'pending' as const }
                    ]
                }
            ];

            const allChanges = flattenHunks(hunks);

            expect(allChanges).toHaveLength(3);
            expect(allChanges[0].id).toBe('1');
            expect(allChanges[1].id).toBe('2');
            expect(allChanges[2].id).toBe('3');
        });

        it('should return empty array for empty input', () => {
            expect(flattenHunks([])).toEqual([]);
        });
    });

    describe('getAffectedFiles', () => {
        it('should return unique file paths', () => {
            const changes = [
                { id: '1', type: 'add' as const, filePath: '/file1.ts', oldLineStart: 1, oldLineCount: 0, newLineStart: 1, newLineCount: 1, oldContent: [], newContent: ['a'], status: 'pending' as const },
                { id: '2', type: 'add' as const, filePath: '/file1.ts', oldLineStart: 5, oldLineCount: 0, newLineStart: 6, newLineCount: 1, oldContent: [], newContent: ['b'], status: 'pending' as const },
                { id: '3', type: 'delete' as const, filePath: '/file2.ts', oldLineStart: 1, oldLineCount: 1, newLineStart: 1, newLineCount: 0, oldContent: ['c'], newContent: [], status: 'pending' as const }
            ];

            const files = getAffectedFiles(changes);

            expect(files).toHaveLength(2);
            expect(files).toContain('/file1.ts');
            expect(files).toContain('/file2.ts');
        });

        it('should return empty array for no changes', () => {
            expect(getAffectedFiles([])).toEqual([]);
        });
    });

    describe('modification highlighting support', () => {
        it('should preserve both old and new content for modifications', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,3 @@
 line1
-old content
+new content
 line3
`;
            const hunks = parseDiffOutput(diffOutput, '/workspace');

            const change = hunks[0].changes[0];
            expect(change.type).toBe('modify');
            // Verify both old (for red display) and new (for green display) content are preserved
            expect(change.oldContent).toEqual(['old content']);
            expect(change.newContent).toEqual(['new content']);
            expect(change.oldLineCount).toBe(1);
            expect(change.newLineCount).toBe(1);
        });

        it('should handle multi-line modifications correctly', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,4 +1,4 @@
 line1
-old line 1
-old line 2
+new line 1
+new line 2
 line4
`;
            const hunks = parseDiffOutput(diffOutput, '/workspace');

            const change = hunks[0].changes[0];
            expect(change.type).toBe('modify');
            // Multi-line modifications should preserve all old and new lines
            expect(change.oldContent).toEqual(['old line 1', 'old line 2']);
            expect(change.newContent).toEqual(['new line 1', 'new line 2']);
            expect(change.oldLineCount).toBe(2);
            expect(change.newLineCount).toBe(2);
        });

        it('should handle modification with different line counts', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,5 +1,3 @@
 line1
-old line 1
-old line 2
-old line 3
+new single line
 end
`;
            const hunks = parseDiffOutput(diffOutput, '/workspace');

            const change = hunks[0].changes[0];
            expect(change.type).toBe('modify');
            expect(change.oldContent).toEqual(['old line 1', 'old line 2', 'old line 3']);
            expect(change.newContent).toEqual(['new single line']);
            expect(change.oldLineCount).toBe(3);
            expect(change.newLineCount).toBe(1);
        });

        it('should correctly identify type for add (no old content)', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,2 +1,3 @@
 existing
+added line
 end
`;
            const hunks = parseDiffOutput(diffOutput, '/workspace');

            const change = hunks[0].changes[0];
            expect(change.type).toBe('add');
            expect(change.oldContent).toEqual([]);
            expect(change.newContent).toEqual(['added line']);
        });

        it('should correctly identify type for delete (no new content)', () => {
            const diffOutput = `diff --git a/file.ts b/file.ts
index 1234567..abcdefg 100644
--- a/file.ts
+++ b/file.ts
@@ -1,3 +1,2 @@
 existing
-deleted line
 end
`;
            const hunks = parseDiffOutput(diffOutput, '/workspace');

            const change = hunks[0].changes[0];
            expect(change.type).toBe('delete');
            expect(change.oldContent).toEqual(['deleted line']);
            expect(change.newContent).toEqual([]);
        });
    });
});
