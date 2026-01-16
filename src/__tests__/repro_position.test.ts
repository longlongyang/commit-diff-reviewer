
import { parseDiffOutput } from '../services/diffParser';

describe('DiffParser Positioning Bug Repro', () => {

    it('should parse modification at line 64 correctly without context', () => {
        const diff = `diff --git a/file.txt b/file.txt
index 123..456 100644
--- a/file.txt
+++ b/file.txt
@@ -64,1 +64,2 @@
-old line
+new line 1
+new line 2`;

        const workspaceRoot = '/root';
        const hunks = parseDiffOutput(diff, workspaceRoot);

        expect(hunks.length).toBe(1);
        const change = hunks[0].changes[0];

        expect(change.type).toBe('modify');
        expect(change.oldLineStart).toBe(64);
        expect(change.newLineStart).toBe(64); // Should be 64
        expect(change.newLineCount).toBe(2);
    });

    it('should parse modification at line 64 correctly WITH context', () => {
        // Context starts at 62. 2 context lines. So change starts at 64.
        const diff = `diff --git a/file.txt b/file.txt
index 123..456 100644
--- a/file.txt
+++ b/file.txt
@@ -62,3 +62,4 @@
 context 62
 context 63
-old line 64
+new line 64
+new line 65`;

        const workspaceRoot = '/root';
        const hunks = parseDiffOutput(diff, workspaceRoot);

        expect(hunks.length).toBe(1);
        const change = hunks[0].changes[0]; // The modify change

        expect(change.type).toBe('modify');
        // Based on loop:
        // Start 62.
        // Line ' context 62' -> old 63, new 63.
        // Line ' context 63' -> old 64, new 64.
        // Line '-old line 64' -> deleteStartOld = 64? Wait.

        // Let's trace manual logic:
        // oldLineNum = 62. newLineNum = 62.
        // Loop 0: ' context 62' -> increments to 63, 63.
        // Loop 1: ' context 63' -> increments to 64, 64.
        // Loop 2: '-old line 64' -> deleteStartOld = 64. deleteStartNew = 64.

        expect(change.oldLineStart).toBe(64);
        expect(change.newLineStart).toBe(64);
    });
});
