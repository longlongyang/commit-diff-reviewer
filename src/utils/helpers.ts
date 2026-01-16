/**
 * Utility helper functions
 */

import * as crypto from 'crypto';

/**
 * Generate a unique ID for a change
 */
export function generateChangeId(): string {
    return crypto.randomBytes(8).toString('hex');
}

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffWeeks < 4) {
        return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    } else {
        return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    }
}

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: unknown[]) => void>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | undefined;
    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Check if a file is likely a text file based on extension
 */
export function isTextFile(filePath: string): boolean {
    const binaryExtensions = [
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.7z', '.tar', '.gz',
        '.exe', '.dll', '.so', '.dylib',
        '.mp3', '.mp4', '.avi', '.mov', '.wav',
        '.ttf', '.otf', '.woff', '.woff2',
        '.bin', '.dat', '.db', '.sqlite'
    ];

    const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    return !binaryExtensions.includes(ext);
}

/**
 * Normalize file path for cross-platform compatibility
 */
export function normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

/**
 * Get short hash from full commit hash
 */
export function getShortHash(hash: string): string {
    return hash.substring(0, 7);
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
