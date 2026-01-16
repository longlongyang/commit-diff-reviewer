/**
 * Unit tests for helper utility functions
 */

import {
    generateChangeId,
    formatRelativeTime,
    isTextFile,
    normalizePath,
    getShortHash,
    truncate
} from '../utils/helpers';

describe('helpers', () => {
    describe('generateChangeId', () => {
        it('should generate a unique 16-character hex string', () => {
            const id = generateChangeId();
            expect(id).toHaveLength(16);
            expect(/^[0-9a-f]+$/.test(id)).toBe(true);
        });

        it('should generate unique IDs on each call', () => {
            const id1 = generateChangeId();
            const id2 = generateChangeId();
            const id3 = generateChangeId();
            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
            expect(id1).not.toBe(id3);
        });
    });

    describe('formatRelativeTime', () => {
        it('should return "just now" for very recent times', () => {
            const now = new Date();
            expect(formatRelativeTime(now)).toBe('just now');
        });

        it('should format minutes correctly', () => {
            const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
            expect(formatRelativeTime(date)).toBe('5 minutes ago');
        });

        it('should format single minute correctly', () => {
            const date = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
            expect(formatRelativeTime(date)).toBe('1 minute ago');
        });

        it('should format hours correctly', () => {
            const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
            expect(formatRelativeTime(date)).toBe('3 hours ago');
        });

        it('should format single hour correctly', () => {
            const date = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
            expect(formatRelativeTime(date)).toBe('1 hour ago');
        });

        it('should format days correctly', () => {
            const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            expect(formatRelativeTime(date)).toBe('2 days ago');
        });

        it('should format weeks correctly', () => {
            const date = new Date(Date.now() - 2 * 7 * 24 * 60 * 60 * 1000); // 2 weeks ago
            expect(formatRelativeTime(date)).toBe('2 weeks ago');
        });

        it('should format months correctly', () => {
            const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // ~2 months ago
            expect(formatRelativeTime(date)).toBe('2 months ago');
        });
    });

    describe('isTextFile', () => {
        it('should return true for common text file extensions', () => {
            expect(isTextFile('file.ts')).toBe(true);
            expect(isTextFile('file.js')).toBe(true);
            expect(isTextFile('file.py')).toBe(true);
            expect(isTextFile('file.java')).toBe(true);
            expect(isTextFile('file.md')).toBe(true);
            expect(isTextFile('file.txt')).toBe(true);
            expect(isTextFile('file.json')).toBe(true);
            expect(isTextFile('file.html')).toBe(true);
            expect(isTextFile('file.css')).toBe(true);
        });

        it('should return false for binary file extensions', () => {
            expect(isTextFile('image.png')).toBe(false);
            expect(isTextFile('image.jpg')).toBe(false);
            expect(isTextFile('image.jpeg')).toBe(false);
            expect(isTextFile('image.gif')).toBe(false);
            expect(isTextFile('document.pdf')).toBe(false);
            expect(isTextFile('archive.zip')).toBe(false);
            expect(isTextFile('binary.exe')).toBe(false);
            expect(isTextFile('library.dll')).toBe(false);
            expect(isTextFile('video.mp4')).toBe(false);
            expect(isTextFile('audio.mp3')).toBe(false);
        });

        it('should be case insensitive', () => {
            expect(isTextFile('IMAGE.PNG')).toBe(false);
            expect(isTextFile('FILE.TS')).toBe(true);
        });
    });

    describe('normalizePath', () => {
        it('should convert backslashes to forward slashes', () => {
            expect(normalizePath('C:\\Users\\test\\file.ts')).toBe('C:/Users/test/file.ts');
        });

        it('should leave forward slashes unchanged', () => {
            expect(normalizePath('/home/user/file.ts')).toBe('/home/user/file.ts');
        });

        it('should handle mixed slashes', () => {
            expect(normalizePath('C:\\Users/test\\file.ts')).toBe('C:/Users/test/file.ts');
        });
    });

    describe('getShortHash', () => {
        it('should return first 7 characters of hash', () => {
            expect(getShortHash('abc1234567890')).toBe('abc1234');
        });

        it('should handle exact 7 character input', () => {
            expect(getShortHash('abc1234')).toBe('abc1234');
        });

        it('should handle shorter input', () => {
            expect(getShortHash('abc')).toBe('abc');
        });
    });

    describe('truncate', () => {
        it('should return original string if shorter than max length', () => {
            expect(truncate('hello', 10)).toBe('hello');
        });

        it('should truncate and add ellipsis if longer than max length', () => {
            expect(truncate('hello world', 8)).toBe('hello...');
        });

        it('should handle exact max length', () => {
            expect(truncate('hello', 5)).toBe('hello');
        });

        it('should handle very short max length', () => {
            expect(truncate('hello world', 4)).toBe('h...');
        });
    });
});
