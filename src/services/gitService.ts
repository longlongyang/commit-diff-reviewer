/**
 * Git Service - Handles all Git operations
 */

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { CommitInfo } from '../models/types';
import { getShortHash } from '../utils/helpers';

const execAsync = promisify(exec);

export class GitService {
    private workspaceRoot: string | undefined;

    constructor() {
        this.workspaceRoot = this.getWorkspaceRoot();
    }

    /**
     * Get the workspace root directory
     */
    getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            return workspaceFolders[0].uri.fsPath;
        }
        return undefined;
    }

    /**
     * Execute a git command in the workspace
     */
    private async execGit(command: string): Promise<string> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        try {
            const { stdout } = await execAsync(`git ${command}`, {
                cwd: this.workspaceRoot,
                maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large diffs
            });
            return stdout;
        } catch (error: unknown) {
            const err = error as { stderr?: string; message?: string };
            throw new Error(`Git command failed: ${err.stderr || err.message}`);
        }
    }

    /**
     * Check if the workspace is a git repository
     */
    async isGitRepository(): Promise<boolean> {
        try {
            await this.execGit('rev-parse --is-inside-work-tree');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get recent commits for the Quick Pick list
     */
    async getRecentCommits(count: number): Promise<CommitInfo[]> {
        const format = '%H%n%s%n%an%n%ae%n%aI';
        const output = await this.execGit(
            `log -n ${count} --format="${format}" --no-merges`
        );

        const lines = output.trim().split('\n');
        const commits: CommitInfo[] = [];

        for (let i = 0; i < lines.length; i += 5) {
            if (i + 4 >= lines.length) break;

            const hash = lines[i];
            const message = lines[i + 1];
            const author = lines[i + 2];
            const email = lines[i + 3];
            const dateStr = lines[i + 4];

            commits.push({
                hash,
                shortHash: getShortHash(hash),
                message,
                author,
                email,
                date: new Date(dateStr)
            });
        }

        return commits;
    }

    /**
     * Validate if a commit hash exists
     */
    async isValidCommit(hash: string): Promise<boolean> {
        try {
            await this.execGit(`rev-parse --verify ${hash}^{commit}`);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the full commit hash from a partial hash
     */
    async getFullCommitHash(partialHash: string): Promise<string> {
        const output = await this.execGit(`rev-parse ${partialHash}`);
        return output.trim();
    }

    /**
     * Get commit info for a specific hash
     */
    async getCommitInfo(hash: string): Promise<CommitInfo> {
        const format = '%H%n%s%n%an%n%ae%n%aI';
        const output = await this.execGit(`log -n 1 --format="${format}" ${hash}`);
        const lines = output.trim().split('\n');

        return {
            hash: lines[0],
            shortHash: getShortHash(lines[0]),
            message: lines[1],
            author: lines[2],
            email: lines[3],
            date: new Date(lines[4])
        };
    }

    /**
     * Get the diff between a commit and its parent
     */
    async getDiff(commitHash: string): Promise<string> {
        // Get diff from parent to this commit (what this commit introduced)
        return await this.execGit(`diff ${commitHash}^..${commitHash}`);
    }

    /**
     * Get the diff between HEAD and a specific commit
     * This shows what has changed since that commit
     */
    async getDiffFromCommit(commitHash: string): Promise<string> {
        // Diff against working tree to ensure line numbers match editor content
        return await this.execGit(`diff ${commitHash}`);
    }

    /**
     * Get file content at a specific commit
     */
    async getFileAtCommit(filePath: string, commitHash: string): Promise<string> {
        try {
            // Normalize path to use forward slashes for git
            const normalizedPath = filePath.replace(/\\/g, '/');
            return await this.execGit(`show ${commitHash}:"${normalizedPath}"`);
        } catch {
            // File might not exist at this commit
            return '';
        }
    }

    /**
     * Get the parent commit hash
     */
    async getParentCommit(commitHash: string): Promise<string> {
        const output = await this.execGit(`rev-parse ${commitHash}^`);
        return output.trim();
    }

    /**
     * Get list of files changed in a commit
     */
    async getChangedFiles(commitHash: string): Promise<string[]> {
        const output = await this.execGit(
            `diff-tree --no-commit-id --name-only -r ${commitHash}`
        );
        return output.trim().split('\n').filter(f => f.length > 0);
    }

    /**
     * Get absolute path for a file relative to workspace root
     */
    getAbsolutePath(relativePath: string): string {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder open');
        }
        return path.join(this.workspaceRoot, relativePath);
    }

    /**
     * Get relative path from absolute path
     */
    getRelativePath(absolutePath: string): string {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder open');
        }
        return path.relative(this.workspaceRoot, absolutePath);
    }
}
