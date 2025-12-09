import * as vscode from 'vscode';
import * as path from 'path';
import { SafeFileReader, ErrorRecovery } from './safeFileReader';

/**
 * Deep File Scanner - Finds dependency files anywhere in project structure
 * This utility scans the entire project tree for dependency files,
 * not just the root directory.
 */
export class DeepFileScanner {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Find a specific file anywhere in the project structure
     * Excludes common ignore patterns (node_modules, .git, etc.)
     */
    async findFile(filename: string): Promise<string | null> {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return null;
            }

            // Use VS Code's file search with exclusions
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(workspaceFolder, `**/${filename}`),
                '**/node_modules/**,**/.git/**,**/venv/**,**/__pycache__/**,**/dist/**,**/build/**,**/.next/**,**/.nuxt/**',
                1 // Only find the first match
            );

            if (files.length > 0) {
                const relativePath = path.relative(this.workspaceRoot, files[0].fsPath).replace(/\\/g, '/');
                console.log(`✅ Found ${filename} at: ${relativePath}`);
                return files[0].fsPath;
            }

            return null;
        } catch (error) {
            console.error(`Error finding ${filename}:`, error);
            return null;
        }
    }

    /**
     * Read file content from absolute path with safe error handling
     */
    async readFile(filePath: string): Promise<string | null> {
        try {
            // PRODUCTION-GRADE: Use safe file reader with retry logic
            const content = await SafeFileReader.readFileWithRetry(filePath, {
                maxRetries: 3,
                retryDelay: 100,
                timeout: 5000,
                logErrors: true
            });

            if (!content) {
                console.warn(`Could not read file ${filePath}`);
                return null;
            }

            return content;
        } catch (error) {
            const errMsg = ErrorRecovery.getErrorMessage(error);
            console.error(`Error reading file ${filePath}: ${errMsg}`, error);
            return null;
        }
    }

    /**
     * Get relative path from workspace root
     */
    getRelativePath(absolutePath: string): string {
        return path.relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/');
    }

    /**
     * Scan for all dependency files in project
     * Returns a map of file type to {content, path}
     */
    async scanAllDependencyFiles(): Promise<Map<string, { content: string; path: string }>> {
        const results = new Map<string, { content: string; path: string }>();

        const filesToFind = [
            'requirements.txt',
            'pyproject.toml',
            'Pipfile',
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            'pom.xml',
            'build.gradle',
            'build.gradle.kts',
            'go.mod',
            'go.sum',
            'Gemfile',
            'Gemfile.lock',
            'composer.json',
            'composer.lock'
        ];

        for (const filename of filesToFind) {
            const filePath = await this.findFile(filename);
            if (filePath) {
                const content = await this.readFile(filePath);
                if (content) {
                    results.set(filename, {
                        content,
                        path: this.getRelativePath(filePath)
                    });
                }
            }
        }

        return results;
    }
}
