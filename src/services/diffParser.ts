/**
 * Diff Parser - Parses unified diff format into structured data
 */

import { DiffChange, DiffHunk } from '../models/types';
import { generateChangeId, isTextFile } from '../utils/helpers';

/**
 * Parse unified diff output into structured DiffHunk objects
 */
export function parseDiffOutput(diffOutput: string, workspaceRoot: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];

    // Split by file diff sections
    const fileDiffs = diffOutput.split(/^diff --git /m).filter(s => s.trim());

    for (const fileDiff of fileDiffs) {
        const hunk = parseFileDiff(fileDiff, workspaceRoot);
        if (hunk && hunk.changes.length > 0) {
            hunks.push(hunk);
        }
    }

    return hunks;
}

/**
 * Parse a single file's diff section
 */
function parseFileDiff(fileDiff: string, workspaceRoot: string): DiffHunk | null {
    const lines = fileDiff.split('\n');

    // Extract file paths from the first line "a/path b/path"
    const headerMatch = lines[0].match(/^a\/(.+?) b\/(.+?)$/);
    if (!headerMatch) {
        return null;
    }

    const oldPath = headerMatch[1];
    const newPath = headerMatch[2];

    // Skip binary files
    if (!isTextFile(newPath)) {
        return null;
    }

    // Check for special cases
    let isNew = false;
    let isDeleted = false;
    let isRenamed = false;

    for (const line of lines.slice(1, 10)) {
        if (line.startsWith('new file mode')) {
            isNew = true;
        } else if (line.startsWith('deleted file mode')) {
            isDeleted = true;
        } else if (line.startsWith('rename from') || line.startsWith('similarity index')) {
            isRenamed = true;
        }
    }

    // Parse hunks
    const changes: DiffChange[] = [];
    let currentHunkLines: string[] = [];
    let hunkOldStart = 0;
    let hunkOldCount = 0;
    let hunkNewStart = 0;
    let hunkNewCount = 0;
    let inHunk = false;

    const absolutePath = workspaceRoot.replace(/\\/g, '/') + '/' + newPath;

    for (const line of lines) {
        // Check for hunk header
        const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (hunkMatch) {
            // Process previous hunk if exists
            if (inHunk && currentHunkLines.length > 0) {
                const hunkChanges = parseHunkContent(
                    currentHunkLines,
                    hunkOldStart,
                    hunkNewStart,
                    absolutePath
                );
                changes.push(...hunkChanges);
            }

            // Start new hunk
            hunkOldStart = parseInt(hunkMatch[1], 10);
            hunkOldCount = parseInt(hunkMatch[2] || '1', 10);
            hunkNewStart = parseInt(hunkMatch[3], 10);
            hunkNewCount = parseInt(hunkMatch[4] || '1', 10);
            currentHunkLines = [];
            inHunk = true;
            continue;
        }

        if (inHunk) {
            // Collect hunk content lines
            if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
                currentHunkLines.push(line);
            }
        }
    }

    // Process last hunk
    if (inHunk && currentHunkLines.length > 0) {
        const hunkChanges = parseHunkContent(
            currentHunkLines,
            hunkOldStart,
            hunkNewStart,
            absolutePath
        );
        changes.push(...hunkChanges);
    }

    return {
        filePath: newPath,
        isNew,
        isDeleted,
        isRenamed,
        oldFilePath: isRenamed ? oldPath : undefined,
        changes
    };
}

/**
 * Parse hunk content lines into DiffChange objects
 * Groups consecutive add/delete operations
 */
function parseHunkContent(
    lines: string[],
    oldStart: number,
    newStart: number,
    absolutePath: string
): DiffChange[] {
    const changes: DiffChange[] = [];

    let oldLineNum = oldStart;
    let newLineNum = newStart;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith(' ')) {
            // Context line - advance both line numbers
            oldLineNum++;
            newLineNum++;
            i++;
        } else if (line.startsWith('-')) {
            // Start of deletion or modification
            const deletedLines: string[] = [];
            const deleteStartOld = oldLineNum;
            const deleteStartNew = newLineNum;

            // Collect consecutive deletions
            while (i < lines.length && lines[i].startsWith('-')) {
                deletedLines.push(lines[i].substring(1));
                oldLineNum++;
                i++;
            }

            // Check if followed by additions (modification)
            const addedLines: string[] = [];
            while (i < lines.length && lines[i].startsWith('+')) {
                addedLines.push(lines[i].substring(1));
                newLineNum++;
                i++;
            }

            if (addedLines.length > 0) {
                // This is a modification
                changes.push({
                    id: generateChangeId(),
                    type: 'modify',
                    filePath: absolutePath,
                    oldLineStart: deleteStartOld,
                    oldLineCount: deletedLines.length,
                    newLineStart: deleteStartNew,
                    newLineCount: addedLines.length,
                    oldContent: deletedLines,
                    newContent: addedLines,
                    status: 'pending'
                });
            } else {
                // Pure deletion
                changes.push({
                    id: generateChangeId(),
                    type: 'delete',
                    filePath: absolutePath,
                    oldLineStart: deleteStartOld,
                    oldLineCount: deletedLines.length,
                    newLineStart: deleteStartNew,
                    newLineCount: 0,
                    oldContent: deletedLines,
                    newContent: [],
                    status: 'pending'
                });
            }
        } else if (line.startsWith('+')) {
            // Pure addition
            const addedLines: string[] = [];
            const addStartNew = newLineNum;

            while (i < lines.length && lines[i].startsWith('+')) {
                addedLines.push(lines[i].substring(1));
                newLineNum++;
                i++;
            }

            changes.push({
                id: generateChangeId(),
                type: 'add',
                filePath: absolutePath,
                oldLineStart: oldLineNum,
                oldLineCount: 0,
                newLineStart: addStartNew,
                newLineCount: addedLines.length,
                oldContent: [],
                newContent: addedLines,
                status: 'pending'
            });
        } else {
            i++;
        }
    }

    return changes;
}

/**
 * Merge hunks from multiple files into a single array of changes
 */
export function flattenHunks(hunks: DiffHunk[]): DiffChange[] {
    const allChanges: DiffChange[] = [];
    for (const hunk of hunks) {
        allChanges.push(...hunk.changes);
    }
    return allChanges;
}

/**
 * Get unique file paths from changes
 */
export function getAffectedFiles(changes: DiffChange[]): string[] {
    const files = new Set<string>();
    for (const change of changes) {
        files.add(change.filePath);
    }
    return Array.from(files);
}
