import * as fs from 'fs';
import * as path from 'path';

/**
 * PRODUCTION-GRADE FILE READING UTILITY
 * Handles all subfolder reading errors with comprehensive error handling
 * 
 * Features:
 * - Automatic retry on transient errors
 * - Permission error handling
 * - Encoding detection and fallback
 * - Safe directory traversal with error recovery
 * - File access validation
 */

export interface ReadFileOptions {
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
    fallbackEncoding?: string;
    logErrors?: boolean;
}

export interface DirectoryWalkOptions {
    maxDepth?: number;
    maxFiles?: number;
    followSymlinks?: boolean;
    ignorePatterns?: string[];
    onError?: (error: Error, filePath: string) => void;
    onProgress?: (processedCount: number) => void;
}

export class SafeFileReader {
    /**
     * Read file with automatic retry and encoding fallback
     */
    static async readFileWithRetry(
        filePath: string,
        options: ReadFileOptions = {}
    ): Promise<string | null> {
        const {
            maxRetries = 3,
            retryDelay = 100,
            timeout = 5000,
            fallbackEncoding = 'latin1',
            logErrors = true
        } = options;

        let lastError: Error | null = null;

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Check if file exists and is readable
                const stats = await this.statFileAsync(filePath);
                if (!stats?.isFile()) {
                    return null;
                }

                // Try reading with UTF-8 first
                try {
                    return await this.readFileWithTimeout(filePath, 'utf-8', timeout);
                } catch (utf8Error) {
                    // If UTF-8 fails, try fallback encoding
                    if (fallbackEncoding && fallbackEncoding !== 'utf-8') {
                        try {
                            return await this.readFileWithTimeout(filePath, fallbackEncoding as any, timeout);
                        } catch (fallbackError) {
                            lastError = fallbackError as Error;
                        }
                    }
                    lastError = utf8Error as Error;
                }

                // If not last attempt, wait before retrying
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                }
            } catch (error) {
                lastError = error as Error;

                // Check if error is retryable
                const errorMsg = (error as any)?.message || '';
                const isRetryable = errorMsg.includes('EAGAIN') || 
                                   errorMsg.includes('EBUSY') ||
                                   errorMsg.includes('EMFILE');

                if (!isRetryable || attempt === maxRetries - 1) {
                    if (logErrors) {
                        console.warn(`Failed to read ${filePath} after ${attempt + 1} attempts:`, error);
                    }
                    return null;
                }

                // Wait before retry
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
                }
            }
        }

        if (logErrors && lastError) {
            console.warn(`Failed to read ${filePath}:`, lastError);
        }
        return null;
    }

    /**
     * Read file with timeout protection
     */
    private static readFileWithTimeout(
        filePath: string,
        encoding: BufferEncoding,
        timeout: number
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(
                () => reject(new Error(`Read timeout after ${timeout}ms`)),
                timeout
            );

            fs.readFile(filePath, encoding, (err, data) => {
                clearTimeout(timeoutHandle);
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    /**
     * Stat file async wrapper
     */
    private static statFileAsync(filePath: string): Promise<fs.Stats | null> {
        return new Promise((resolve) => {
            fs.stat(filePath, (err, stats) => {
                if (err) resolve(null);
                else resolve(stats);
            });
        });
    }

    /**
     * Synchronous version with error handling
     */
    static readFileSync(
        filePath: string,
        options: ReadFileOptions = {}
    ): string | null {
        const { fallbackEncoding = 'latin1', logErrors = true } = options;

        try {
            // Check if file exists
            if (!fs.existsSync(filePath)) {
                return null;
            }

            const stats = fs.statSync(filePath);
            if (!stats.isFile()) {
                return null;
            }

            // Try UTF-8 first
            try {
                return fs.readFileSync(filePath, 'utf-8');
            } catch (utf8Error) {
                // Try fallback encoding
                if (fallbackEncoding && fallbackEncoding !== 'utf-8') {
                    try {
                        return fs.readFileSync(filePath, fallbackEncoding as BufferEncoding);
                    } catch (fallbackError) {
                        if (logErrors) {
                            console.warn(`Failed to read ${filePath} with fallback encoding:`, fallbackError);
                        }
                        return null;
                    }
                }
                if (logErrors) {
                    console.warn(`Failed to read ${filePath}:`, utf8Error);
                }
                return null;
            }
        } catch (error) {
            if (logErrors) {
                console.warn(`Error reading file ${filePath}:`, error);
            }
            return null;
        }
    }

    /**
     * Check if file is readable
     */
    static isReadable(filePath: string): boolean {
        try {
            fs.accessSync(filePath, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file size safely
     */
    static getFileSize(filePath: string): number {
        try {
            const stats = fs.statSync(filePath);
            return stats.isFile() ? stats.size : 0;
        } catch {
            return 0;
        }
    }
}

export class SafeDirectoryReader {
    /**
     * Recursively read directory with comprehensive error handling
     */
    static async walkDirectoryAsync(
        dirPath: string,
        options: DirectoryWalkOptions = {}
    ): Promise<string[]> {
        const {
            maxDepth = 10,
            maxFiles = 50000,
            followSymlinks = false,
            ignorePatterns = ['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.pytest_cache'],
            onError,
            onProgress
        } = options;

        const fileList: string[] = [];
        const visitedPaths = new Set<string>();
        let processedCount = 0;

        const walk = async (currentPath: string, depth: number): Promise<void> => {
            // Stop if limits reached
            if (fileList.length >= maxFiles || depth > maxDepth) {
                return;
            }

            try {
                // Check if path is accessible
                const stats = await this.statAsync(currentPath);
                if (!stats) {
                    return;
                }

                // Handle symlinks
                let realPath: string;
                try {
                    realPath = fs.realpathSync(currentPath);
                } catch {
                    realPath = currentPath;
                }

                // Detect cycles
                if (visitedPaths.has(realPath)) {
                    return;
                }

                if (stats.isSymbolicLink() && !followSymlinks) {
                    return;
                }

                visitedPaths.add(realPath);

                if (stats.isDirectory()) {
                    // Try to read directory
                    const entries = await this.readdirAsync(currentPath);
                    if (!entries) {
                        return;
                    }

                    for (const entry of entries) {
                        // Check ignore patterns
                        if (ignorePatterns.some(pattern => entry.includes(pattern))) {
                            continue;
                        }

                        const fullPath = path.join(currentPath, entry);

                        try {
                            const entryStats = await this.statAsync(fullPath);
                            if (!entryStats) {
                                continue;
                            }

                            if (entryStats.isDirectory()) {
                                await walk(fullPath, depth + 1);
                            } else if (entryStats.isFile() && fileList.length < maxFiles) {
                                fileList.push(fullPath);
                                processedCount++;

                                if (onProgress && processedCount % 100 === 0) {
                                    onProgress(processedCount);
                                }
                            }
                        } catch (error) {
                            if (onError) {
                                onError(error as Error, fullPath);
                            }
                        }
                    }
                } else if (stats.isFile()) {
                    fileList.push(currentPath);
                    processedCount++;

                    if (onProgress && processedCount % 100 === 0) {
                        onProgress(processedCount);
                    }
                }
            } catch (error) {
                if (onError) {
                    onError(error as Error, currentPath);
                }
            }
        };

        await walk(dirPath, 0);
        return fileList;
    }

    /**
     * Synchronous directory walk (production-safe)
     */
    static walkDirectorySync(
        dirPath: string,
        options: DirectoryWalkOptions = {}
    ): string[] {
        const {
            maxDepth = 10,
            maxFiles = 50000,
            followSymlinks = false,
            ignorePatterns = ['node_modules', '.git', '.next', 'dist', 'build', '__pycache__', '.pytest_cache'],
            onError
        } = options;

        const fileList: string[] = [];
        const visitedPaths = new Set<string>();

        const walk = (currentPath: string, depth: number): void => {
            // Stop if limits reached
            if (fileList.length >= maxFiles || depth > maxDepth) {
                return;
            }

            try {
                // Check if directory exists and is readable
                if (!fs.existsSync(currentPath)) {
                    return;
                }

                const stats = fs.statSync(currentPath);

                // Handle symlinks
                let realPath: string;
                try {
                    realPath = fs.realpathSync(currentPath);
                } catch {
                    realPath = currentPath;
                }

                // Detect cycles
                if (visitedPaths.has(realPath)) {
                    return;
                }

                if (stats.isSymbolicLink() && !followSymlinks) {
                    return;
                }

                visitedPaths.add(realPath);

                if (stats.isDirectory()) {
                    // Try to read directory - handle EACCES (Permission denied)
                    let entries: string[] = [];
                    try {
                        entries = fs.readdirSync(currentPath);
                    } catch (error) {
                        const errorCode = (error as any)?.code;
                        if (errorCode === 'EACCES' || errorCode === 'EPERM') {
                            // Permission denied - skip but don't crash
                            if (onError) {
                                onError(error as Error, currentPath);
                            }
                            return;
                        }
                        throw error;
                    }

                    for (const entry of entries) {
                        // Check ignore patterns
                        if (ignorePatterns.some(pattern => entry.includes(pattern))) {
                            continue;
                        }

                        const fullPath = path.join(currentPath, entry);

                        try {
                            const entryStats = fs.statSync(fullPath);

                            if (entryStats.isDirectory()) {
                                walk(fullPath, depth + 1);
                            } else if (entryStats.isFile() && fileList.length < maxFiles) {
                                fileList.push(fullPath);
                            }
                        } catch (error) {
                            const errorCode = (error as any)?.code;
                            if (errorCode === 'EACCES' || errorCode === 'EPERM' || errorCode === 'ENOENT') {
                                // Skip inaccessible files
                                if (onError) {
                                    onError(error as Error, fullPath);
                                }
                                continue;
                            }
                            throw error;
                        }
                    }
                } else if (stats.isFile() && fileList.length < maxFiles) {
                    fileList.push(currentPath);
                }
            } catch (error) {
                if (onError) {
                    onError(error as Error, currentPath);
                }
            }
        };

        try {
            walk(dirPath, 0);
        } catch (error) {
            console.error(`Fatal error walking directory ${dirPath}:`, error);
        }

        return fileList;
    }

    /**
     * Async stat wrapper
     */
    private static statAsync(filePath: string): Promise<fs.Stats | null> {
        return new Promise((resolve) => {
            fs.stat(filePath, (err, stats) => {
                if (err) resolve(null);
                else resolve(stats);
            });
        });
    }

    /**
     * Async readdir wrapper
     */
    private static readdirAsync(dirPath: string): Promise<string[] | null> {
        return new Promise((resolve) => {
            fs.readdir(dirPath, (err, files) => {
                if (err) resolve(null);
                else resolve(files);
            });
        });
    }

    /**
     * Find specific files in directory tree
     */
    static findFilesByPattern(
        dirPath: string,
        pattern: RegExp,
        options: DirectoryWalkOptions = {}
    ): string[] {
        const allFiles = this.walkDirectorySync(dirPath, options);
        return allFiles.filter(file => pattern.test(file));
    }

    /**
     * Find first file matching pattern
     */
    static findFirstFile(
        dirPath: string,
        filename: string,
        options: DirectoryWalkOptions = {}
    ): string | null {
        const allFiles = this.walkDirectorySync(dirPath, options);
        return allFiles.find(file => file.endsWith(filename)) || null;
    }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
    /**
     * Get human-readable error message
     */
    static getErrorMessage(error: any): string {
        if (!error) return 'Unknown error';

        // Handle error code
        if (error.code) {
            switch (error.code) {
                case 'EACCES':
                    return 'Permission denied - cannot access file';
                case 'EPERM':
                    return 'Operation not permitted';
                case 'ENOENT':
                    return 'File or directory not found';
                case 'EISDIR':
                    return 'Is a directory, not a file';
                case 'ENOTDIR':
                    return 'Not a directory';
                case 'EMFILE':
                    return 'Too many open files';
                case 'EAGAIN':
                    return 'Resource temporarily unavailable';
                case 'EBUSY':
                    return 'Resource busy';
                default:
                    return `Error: ${error.code}`;
            }
        }

        return error.message || 'Unknown error';
    }

    /**
     * Determine if error is retryable
     */
    static isRetryable(error: any): boolean {
        const code = error?.code;
        return code === 'EAGAIN' || code === 'EBUSY' || code === 'EMFILE' || code === 'EACCES';
    }

    /**
     * Get suggested fix for error
     */
    static getSuggestedFix(error: any): string {
        const code = error?.code;

        switch (code) {
            case 'EACCES':
            case 'EPERM':
                return 'Check file permissions or run with appropriate privileges';
            case 'EMFILE':
                return 'Close some file handles or increase system limits';
            case 'EBUSY':
                return 'File is locked; try again later';
            case 'EAGAIN':
                return 'Retrying the operation may help';
            default:
                return 'Check file path and try again';
        }
    }
}
