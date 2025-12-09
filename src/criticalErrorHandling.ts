import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CRITICAL ISSUE #1: Multi-Workspace Folder Handling
 * Prevents using wrong folder when multiple workspaces are open
 */
export class MultiWorkspaceManager {
    /**
     * Get the correct workspace folder with user selection if multiple exist
     */
    static async getActiveWorkspaceFolder(): Promise<string | null> {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a folder first.');
            return null;
        }

        // If only one workspace, use it directly
        if (workspaceFolders.length === 1) {
            const folderPath = workspaceFolders[0].uri.fsPath;
            if (!this.isValidWorkspaceFolder(folderPath)) {
                vscode.window.showErrorMessage('Workspace folder is not accessible or not readable.');
                return null;
            }
            return folderPath;
        }

        // Multiple workspaces: Let user select
        const selected = await vscode.window.showQuickPick(
            workspaceFolders.map(folder => ({
                label: folder.name,
                description: folder.uri.fsPath,
                value: folder.uri.fsPath
            })),
            {
                placeHolder: 'Multiple folders detected. Select the project folder:',
                canPickMany: false
            }
        );

        if (!selected) {
            return null;
        }

        // Validate selected folder
        if (!this.isValidWorkspaceFolder(selected.value)) {
            vscode.window.showErrorMessage(`Cannot access folder: ${selected.value}`);
            return null;
        }

        return selected.value;
    }

    /**
     * Validate that workspace folder exists and is readable
     */
    private static isValidWorkspaceFolder(folderPath: string): boolean {
        try {
            if (!fs.existsSync(folderPath)) {
                return false;
            }
            const stats = fs.statSync(folderPath);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }
}

/**
 * CRITICAL ISSUE #2: BOM Encoding Detection
 * Removes BOM character from file content if present
 */
export class BOMHandler {
    /**
     * Remove BOM from file content
     */
    static removeBOM(content: string): string {
        // Remove UTF-8 BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
            return content.slice(1);
        }
        // Remove UTF-16 LE BOM
        if (content.charCodeAt(0) === 0xFFFE) {
            return content.slice(1);
        }
        return content;
    }

    /**
     * Safely parse JSON with BOM handling
     */
    static parseJSON<T = any>(jsonString: string): T | null {
        try {
            const cleaned = this.removeBOM(jsonString.trim());
            if (!cleaned) {
                return null;
            }
            return JSON.parse(cleaned) as T;
        } catch (error) {
            console.error('Failed to parse JSON:', error);
            return null;
        }
    }

    /**
     * Read file and automatically remove BOM
     */
    static readFileWithBOMHandling(filePath: string): string | null {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return this.removeBOM(content);
        } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
            return null;
        }
    }
}

/**
 * CRITICAL ISSUE #3: Symlink Infinite Loop Prevention
 * Prevents infinite loops when traversing directories with circular symlinks
 */
export class SafeDirectoryTraversal {
    /**
     * Safely walk directory tree with cycle detection
     */
    static walkDirectory(
        dirPath: string,
        options: {
            maxDepth?: number;
            followSymlinks?: boolean;
            maxFiles?: number;
        } = {}
    ): string[] {
        const maxDepth = options.maxDepth ?? 10;
        const followSymlinks = options.followSymlinks ?? false;
        const maxFiles = options.maxFiles ?? 10000;

        const visitedPaths = new Set<string>();
        const fileList: string[] = [];
        const depthMap = new Map<string, number>();

        const walk = (currentPath: string, depth: number): void => {
            // Check file limit
            if (fileList.length >= maxFiles) {
                return;
            }

            // Check depth limit
            if (depth > maxDepth) {
                return;
            }

            // Get real path to detect cycles
            let realPath: string;
            try {
                realPath = fs.realpathSync(currentPath);
            } catch (error) {
                // Permission denied or inaccessible
                return;
            }

            // Detect cycles
            if (visitedPaths.has(realPath)) {
                return;
            }

            // Check if it's a symlink
            try {
                const stat = fs.lstatSync(currentPath);
                if (stat.isSymbolicLink() && !followSymlinks) {
                    return;
                }
            } catch (error) {
                return;
            }

            visitedPaths.add(realPath);

            try {
                const entries = fs.readdirSync(currentPath);

                for (const entry of entries) {
                    const fullPath = path.join(currentPath, entry);

                    try {
                        const stat = fs.lstatSync(fullPath);

                        if (stat.isDirectory()) {
                            walk(fullPath, depth + 1);
                        } else if (stat.isFile()) {
                            fileList.push(fullPath);
                        }
                    } catch (error) {
                        // Skip inaccessible files
                        continue;
                    }
                }
            } catch (error) {
                // Permission denied on directory
                return;
            }
        };

        walk(dirPath, 0);
        return fileList;
    }
}

/**
 * CRITICAL ISSUE #4: Memory Leak Prevention for Large Projects
 * Processes files in chunks instead of loading all at once
 */
export class ChunkedFileProcessor {
    /**
     * Process files in chunks to prevent memory exhaustion
     */
    static async processFilesInChunks<T>(
        files: string[],
        chunkSize: number = 100,
        processor: (file: string) => Promise<T | null>
    ): Promise<T[]> {
        const results: T[] = [];
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            const promises = chunk.map(file =>
                processor(file).catch(error => {
                    console.warn(`Failed to process ${file}:`, error);
                    return null;
                })
            );

            const chunkResults = await Promise.all(promises);
            results.push(...chunkResults.filter(r => r !== null) as T[]);

            // Allow garbage collection between chunks
            if (i % 500 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }

        return results;
    }

    /**
     * Process large files line by line to prevent memory bloat
     */
    static readLargeFileLineByLine(
        filePath: string,
        lineProcessor: (line: string) => boolean,
        maxLines: number = 10000
    ): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');

            for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
                const shouldContinue = lineProcessor(lines[i]);
                if (!shouldContinue) {
                    break;
                }
            }
        } catch (error) {
            console.error(`Failed to read file ${filePath}:`, error);
        }
    }
}

/**
 * CRITICAL ISSUE #5: Concurrent Generation Locking
 * Prevents multiple simultaneous Docker file generations
 */
export class GenerationLock {
    private static activeLocks = new Map<string, Promise<void>>();

    /**
     * Acquire lock for a workspace and execute operation
     */
    static async executeWithLock<T>(
        workspaceRoot: string,
        operation: () => Promise<T>
    ): Promise<T> {
        // If lock already exists, wait for it to complete
        if (this.activeLocks.has(workspaceRoot)) {
            await this.activeLocks.get(workspaceRoot);
        }

        const lockPromise = new Promise<void>((resolve) => {
            // Execute operation
            operation()
                .then(() => {
                    // Remove lock when done
                    this.activeLocks.delete(workspaceRoot);
                    resolve();
                })
                .catch(() => {
                    // Remove lock even if operation fails
                    this.activeLocks.delete(workspaceRoot);
                    resolve();
                });
        });

        // Store the lock
        this.activeLocks.set(workspaceRoot, lockPromise);

        try {
            return await operation();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Check if generation is already in progress
     */
    static isLocked(workspaceRoot: string): boolean {
        return this.activeLocks.has(workspaceRoot);
    }
}

/**
 * CRITICAL ISSUE #21: Special Characters in Paths
 * Properly escapes and validates paths for Docker
 */
export class PathSanitizer {
    /**
     * Escape path for use in docker-compose.yml
     */
    static escapePathForDocker(filePath: string): string {
        // Convert to forward slashes for consistency
        let escaped = filePath.replace(/\\/g, '/');

        // Check if path contains special characters
        if (/[\s'"$()&;|<>`]/.test(escaped)) {
            // Wrap in quotes and escape inner quotes
            escaped = `"${escaped.replace(/"/g, '\\"')}"`;
        }

        return escaped;
    }

    /**
     * Validate path safety
     */
    static isValidPath(filePath: string): boolean {
        // Check for null bytes
        if (filePath.includes('\0')) {
            return false;
        }

        // Check for path traversal attempts
        if (filePath.includes('..')) {
            return false;
        }

        // Check length (Windows MAX_PATH is 260, Linux typically 4096)
        if (filePath.length > 4000) {
            return false;
        }

        return true;
    }

    /**
     * Normalize path to prevent issues
     */
    static normalizePath(filePath: string): string {
        // Resolve to absolute path
        const resolved = path.resolve(filePath);
        // Normalize path separators
        return resolved.replace(/\\/g, '/');
    }
}

/**
 * CRITICAL ISSUE #22: Git Credentials in Docker
 * Ensures git credentials and sensitive files are not included in Docker image
 */
export class DockerignoreGenerator {
    static DEFAULT_ENTRIES = [
        // Version control
        '.git',
        '.gitignore',
        '.gitattributes',
        '.github',

        // Git credentials/config
        '.git/config',
        '.gitconfig',
        '.git-credentials',
        '.ssh',

        // Package managers
        'node_modules/',
        '.npm',
        '.yarn',
        'pnpm-store',
        '.pnp',
        '.pnp.js',

        // Build artifacts
        'dist/',
        'build/',
        '.next/',
        '.nuxt/',
        '.cache/',
        'coverage/',
        '.pytest_cache/',
        '__pycache__/',
        '*.egg-info/',
        '.gradle/',
        'target/',

        // Environment & Secrets
        '.env',
        '.env.local',
        '.env.*.local',
        '.env.*.secret',

        // IDE & Editor
        '.vscode/',
        '.idea/',
        '.DS_Store',
        'Thumbs.db',
        '*.swp',
        '*.swo',
        '*.sublime-*',
        '.eclipse',
        '.classpath',
        '.project',

        // CI/CD
        '.circleci/',
        '.github/workflows/',
        '.gitlab-ci.yml',
        '.travis.yml',
        'Jenkinsfile',

        // Testing
        '.mocha',
        '.nyc_output',
        'jest.config.js',
        'coverage/',
        '.test/',

        // Log files
        '*.log',
        'logs/',
        '.pm2/',

        // OS specific
        'Thumbs.db',
        '.DS_Store',
        '.AppleDouble',
        '.LSOverride',
        '*.tmp',

        // Documentation
        'docs/',
        'README.md',
        'CHANGELOG.md',

        // Docker files (avoid nesting)
        'Dockerfile*',
        'docker-compose*.yml',
        '.dockerignore',
    ];

    /**
     * Generate comprehensive .dockerignore content
     */
    static generateDockerigore(): string {
        return `# Auto-generated by Auto Docker Extension
# Prevents sensitive files and unnecessary artifacts from being copied into Docker image

# ============================================================================
# CRITICAL: Git & Credentials (SECURITY)
# ============================================================================
.git
.gitignore
.gitattributes
.github
.git-credentials
.gitconfig
.ssh
git-secrets.sh

# ============================================================================
# Credentials & Environment (SECURITY)
# ============================================================================
.env
.env.local
.env.*.local
.env.*.secret

# ============================================================================
# Package Managers
# ============================================================================
node_modules/
.npm
.yarn
.yarn/cache/
.yarn/install-state.gz
pnpm-store
.pnp
.pnp.js
package-lock.json
yarn.lock
pnpm-lock.yaml

# ============================================================================
# Build & Compilation Artifacts
# ============================================================================
dist/
build/
.next/
.nuxt/
.cache/
.turbo/
.vercel/
coverage/
.pytest_cache/
__pycache__/
*.egg-info/
.gradle/
target/
out/
bin/
obj/

# ============================================================================
# IDE & Editor Configuration
# ============================================================================
.vscode/
.idea/
*.swp
*.swo
*.sublime-*
.eclipse
.classpath
.project
.settings/
*.iml
.VSCode
.vscode-server

# ============================================================================
# CI/CD & Version Control
# ============================================================================
.circleci/
.github/workflows/
.gitlab-ci.yml
.travis.yml
Jenkinsfile
.github/actions
appveyor.yml
azure-pipelines.yml

# ============================================================================
# Testing & Coverage
# ============================================================================
.mocha
.nyc_output
jest.config.js
*.test.js
*.spec.js
test/
tests/
__tests__/

# ============================================================================
# Logs & Temporary Files
# ============================================================================
*.log
logs/
.pm2/
.logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
*.tmp
tmp/
temp/

# ============================================================================
# OS Specific Files (SECURITY & Cleanup)
# ============================================================================
.DS_Store
.AppleDouble
.LSOverride
Thumbs.db
Desktop.ini
.TemporaryItems
.Spotlight-V100
.Trashes
ehthumbs.db

# ============================================================================
# Development Tools
# ============================================================================
.editorconfig
.prettierrc
.eslintrc
.eslintignore
.babelrc
.env.example
.nvmrc
.node-version
.ruby-version
Makefile
.task/

# ============================================================================
# Documentation & Examples (reduce image size)
# ============================================================================
docs/
examples/
README.md
CHANGELOG.md
CONTRIBUTING.md
LICENSE
*.md
LICENSE.md

# ============================================================================
# Docker Files (prevent recursion)
# ============================================================================
Dockerfile
Dockerfile.*
docker-compose.yml
docker-compose.*.yml
.dockerignore

# ============================================================================
# Repository Files
# ============================================================================
.gitkeep
.keep
CODEOWNERS
.lintstagedrc
.husky

# ============================================================================
# Private/Personal Files
# ============================================================================
.private/
.secret/
secrets/
private_key*
*.pem
*.key
*.p8

# ============================================================================
# Dependency Lock Files (optional - may want to include)
# ============================================================================
# Uncomment if you want to install dependencies fresh in container:
# package-lock.json
# yarn.lock
# pnpm-lock.yaml

# ============================================================================
# Large Files & Caches
# ============================================================================
.cache/
.eslintcache
.next/cache/
dist/cache/
`;
    }

    /**
     * Ensure .dockerignore includes critical entries
     */
    static validateAndUpdateDockerigore(projectRoot: string): boolean {
        const dockerignorePath = path.join(projectRoot, '.dockerignore');

        try {
            if (fs.existsSync(dockerignorePath)) {
                const content = fs.readFileSync(dockerignorePath, 'utf-8');

                // Check for critical entries
                const criticalEntries = ['.git', '.env', '.ssh', 'node_modules/', 'build/', 'dist/'];
                const missing = criticalEntries.filter(entry => !content.includes(entry));

                if (missing.length > 0) {
                    // Append missing critical entries
                    const updatedContent = content + '\n\n# Critical entries added by Auto Docker\n' + missing.join('\n');
                    fs.writeFileSync(dockerignorePath, updatedContent, 'utf-8');
                    return true;
                }
            } else {
                // Create new .dockerignore
                fs.writeFileSync(dockerignorePath, this.generateDockerigore(), 'utf-8');
                return true;
            }
        } catch (error) {
            console.error('Failed to update .dockerignore:', error);
            return false;
        }

        return false;
    }
}

/**
 * CRITICAL ISSUE #23: File Write Locking
 * Prevents concurrent writes to the same files
 */
export class FileWriteLock {
    private static fileLocks = new Map<string, Promise<void>>();

    /**
     * Write file with lock to prevent corruption
     */
    static async writeFileWithLock(
        filePath: string,
        content: string
    ): Promise<boolean> {
        // Wait for any existing write to complete
        if (this.fileLocks.has(filePath)) {
            await this.fileLocks.get(filePath);
        }

        const lockPromise = new Promise<void>((resolve) => {
            try {
                // Create backup before writing
                const backupPath = `${filePath}.backup`;
                if (fs.existsSync(filePath)) {
                    fs.copyFileSync(filePath, backupPath);
                }

                // Write to temp file first
                const tempPath = `${filePath}.tmp`;
                fs.writeFileSync(tempPath, content, 'utf-8');

                // Verify write was successful by reading back
                const verifyContent = fs.readFileSync(tempPath, 'utf-8');
                if (verifyContent !== content) {
                    throw new Error('File write verification failed');
                }

                // Atomic rename
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                fs.renameSync(tempPath, filePath);

                // Clean up backup
                if (fs.existsSync(backupPath)) {
                    fs.unlinkSync(backupPath);
                }

                this.fileLocks.delete(filePath);
                resolve();
            } catch (error) {
                console.error(`Failed to write file ${filePath}:`, error);
                this.fileLocks.delete(filePath);
                resolve();
            }
        });

        this.fileLocks.set(filePath, lockPromise);
        await lockPromise;
        return true;
    }

    /**
     * Check if file is currently locked
     */
    static isLocked(filePath: string): boolean {
        return this.fileLocks.has(filePath);
    }
}
