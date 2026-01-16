/**
 * Type definitions for Commit Diff Reviewer
 */

/**
 * Status of a diff change in the review session
 */
export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Type of change in a diff
 */
export type ChangeType = 'add' | 'delete' | 'modify';

/**
 * Represents a single change within a file
 */
export interface DiffChange {
    /** Unique identifier for this change */
    id: string;
    /** Type of change */
    type: ChangeType;
    /** Absolute file path */
    filePath: string;
    /** Original line number (1-indexed) */
    oldLineStart: number;
    /** Number of lines in original */
    oldLineCount: number;
    /** Current line number (1-indexed) */
    newLineStart: number;
    /** Number of lines in current */
    newLineCount: number;
    /** Lines before change (for delete/modify) */
    oldContent: string[];
    /** Lines after change (for add/modify) */
    newContent: string[];
    /** Current review status */
    status: ChangeStatus;
}

/**
 * Represents a parsed diff hunk with all changes for a file
 */
export interface DiffHunk {
    /** Relative file path from repository root */
    filePath: string;
    /** Whether the file is new */
    isNew: boolean;
    /** Whether the file is deleted */
    isDeleted: boolean;
    /** Whether the file is renamed */
    isRenamed: boolean;
    /** Old file path if renamed */
    oldFilePath?: string;
    /** All changes in this file */
    changes: DiffChange[];
}

/**
 * Review session state
 */
/**
 * Represents a user note attached to a file
 */
export interface ReviewNote {
    id: string;
    filePath: string;
    line: number;           // 1-indexed line number where the note is displayed
    content: string;        // Markdown content
    status: 'active' | 'resolved';
    createdAt: Date;
    updatedAt: Date;
    selectionRange?: {      // Optional: if attached to a specific selection
        startLine: number;
        startChar: number;
        endLine: number;
        endChar: number;
    };
}

/**
 * Review session state
 */
export interface ReviewSession {
    /** Hash of the commit being reviewed */
    commitHash: string;
    /** Short hash for display */
    shortHash: string;
    /** Commit message */
    commitMessage: string;
    /** Parent commit hash */
    baseCommitHash: string;
    /** All changes across all files */
    changes: DiffChange[];
    /** User notes */
    notes: ReviewNote[];
    /** Current change index */
    currentIndex: number;
    /** Session start time */
    startedAt: Date;
}

/**
 * Commit info for Quick Pick display
 */
export interface CommitInfo {
    /** Full commit hash */
    hash: string;
    /** Short hash (7 chars) */
    shortHash: string;
    /** Commit message (first line) */
    message: string;
    /** Author name */
    author: string;
    /** Author email */
    email: string;
    /** Commit date */
    date: Date;
}

/**
 * Configuration options
 */
export interface ExtensionConfig {
    /** Maximum commits to show in selection list */
    maxCommitsInList: number;
    /** Automatically jump to next pending change */
    autoNavigation: boolean;
    /** Colors for highlighting */
    highlightColors: {
        added: string;
        deleted: string;
        modified: string;
    };
}

/**
 * Serialized session state for persistence
 */
export interface SerializedSession {
    commitHash: string;
    shortHash: string;
    commitMessage: string;
    baseCommitHash: string;
    changes: DiffChange[];
    notes: ReviewNote[];
    currentIndex: number;
    startedAt: string;
}
