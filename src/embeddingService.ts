/**
 * File Embeddings Service
 * 
 * Purpose: Intelligently filter and rank files based on importance for Docker configuration
 * - Prevents sending the entire project to the AI
 * - Identifies the most relevant files
 * - Calculates importance scores based on multiple factors
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface FileEmbedding {
    filepath: string;
    score: number;
    category: 'config' | 'dependency' | 'entrypoint' | 'infrastructure' | 'code';
    relevance: number;
    metadata: {
        size: number;
        extension: string;
        depth: number;
        isRootLevel: boolean;
    };
}

export class EmbeddingService {
    private workspaceRoot: string;

    // High-priority files that are critical for Docker configuration
    private static readonly CRITICAL_FILES = [
        'package.json',
        'requirements.txt',
        'Gemfile',
        'go.mod',
        'pom.xml',
        'build.gradle',
        'composer.json',
        'Cargo.toml',
        '.env',
        '.env.example',
        'docker-compose.yml',
        'docker-compose.yaml',
        '.dockerignore',
        'nginx.conf',
        'tsconfig.json',
        'next.config.js',
        'nuxt.config.js',
        'vite.config.js',
        'webpack.config.js',
        'angular.json',
        'nest-cli.json'
    ];

    // Files that indicate framework/project type
    private static readonly FRAMEWORK_INDICATORS = [
        'manage.py',          // Django
        'app.py',             // Flask
        'main.py',            // FastAPI/Generic Python
        'server.js',          // Node.js
        'index.js',           // Node.js
        'app.js',             // Express
        'main.go',            // Go
        'main.rs',            // Rust
        'Application.java',   // Spring Boot
        'Program.cs',         // .NET
        'config/application.rb' // Rails
    ];

    // Infrastructure and DevOps files
    private static readonly INFRASTRUCTURE_FILES = [
        '.gitlab-ci.yml',
        '.github/workflows',
        'Jenkinsfile',
        'kubernetes',
        'k8s',
        'terraform',
        'helm',
        'Makefile',
        'docker-compose.override.yml'
    ];

    // Directories to always ignore
    private static readonly IGNORE_DIRS = [
        'node_modules',
        '.git',
        'dist',
        'build',
        'out',
        'target',
        '__pycache__',
        '.pytest_cache',
        'venv',
        'env',
        '.venv',
        'vendor',
        'coverage',
        '.next',
        '.nuxt',
        '.output',
        'public/build',
        'logs'
    ];

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Main method: Analyze all files and return ranked embeddings
     */
    async generateFileEmbeddings(): Promise<FileEmbedding[]> {
        const allFiles = await this.getAllFiles(this.workspaceRoot);
        const embeddings: FileEmbedding[] = [];

        for (const file of allFiles) {
            const embedding = await this.calculateFileEmbedding(file);
            if (embedding) {
                embeddings.push(embedding);
            }
        }

        // Sort by score (highest first)
        return embeddings.sort((a, b) => b.score - a.score);
    }

    /**
     * Get top N most important files
     */
    async getTopNFiles(n: number = 50): Promise<FileEmbedding[]> {
        const embeddings = await this.generateFileEmbeddings();
        return embeddings.slice(0, n);
    }

    /**
     * Get files by category
     */
    async getFilesByCategory(category: FileEmbedding['category']): Promise<FileEmbedding[]> {
        const embeddings = await this.generateFileEmbeddings();
        return embeddings.filter(e => e.category === category);
    }

    /**
     * Calculate embedding for a single file
     */
    private async calculateFileEmbedding(filepath: string): Promise<FileEmbedding | null> {
        try {
            const relativePath = path.relative(this.workspaceRoot, filepath);
            const filename = path.basename(filepath);
            const ext = path.extname(filepath);
            const depth = relativePath.split(path.sep).length - 1;
            const isRootLevel = depth === 0;

            const stats = await fs.stat(filepath);

            // Skip very large files (>1MB)
            if (stats.size > 1024 * 1024) {
                return null;
            }

            // Calculate base score
            let score = 0;
            let category: FileEmbedding['category'] = 'code';

            // Critical configuration files (highest priority)
            if (EmbeddingService.CRITICAL_FILES.includes(filename)) {
                score += 100;
                category = 'config';
            }

            // Framework indicators (high priority)
            if (EmbeddingService.FRAMEWORK_INDICATORS.includes(filename)) {
                score += 80;
                category = 'entrypoint';
            }

            // Infrastructure files
            if (EmbeddingService.INFRASTRUCTURE_FILES.some(inf => relativePath.includes(inf))) {
                score += 60;
                category = 'infrastructure';
            }

            // Dependency files
            if (this.isDependencyFile(filename)) {
                score += 90;
                category = 'dependency';
            }

            // Root-level files are more important
            if (isRootLevel) {
                score += 30;
            }

            // Bonus for specific important extensions
            const importantExtensions = ['.json', '.yml', '.yaml', '.toml', '.conf', '.config'];
            if (importantExtensions.includes(ext)) {
                score += 20;
            }

            // Penalty for deep nesting
            score -= depth * 5;

            // Penalty for very small files (likely not important)
            if (stats.size < 100) {
                score -= 10;
            }

            // Calculate relevance (0-1 scale)
            const relevance = Math.min(score / 100, 1);

            return {
                filepath: relativePath,
                score: Math.max(score, 0),
                category,
                relevance,
                metadata: {
                    size: stats.size,
                    extension: ext,
                    depth,
                    isRootLevel
                }
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if file is a dependency management file
     */
    private isDependencyFile(filename: string): boolean {
        const depFiles = [
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            'requirements.txt',
            'Pipfile',
            'Pipfile.lock',
            'poetry.lock',
            'pyproject.toml',
            'Gemfile',
            'Gemfile.lock',
            'go.mod',
            'go.sum',
            'pom.xml',
            'build.gradle',
            'settings.gradle',
            'Cargo.toml',
            'Cargo.lock',
            'composer.json',
            'composer.lock'
        ];
        return depFiles.includes(filename);
    }

    /**
     * Recursively get all files in directory
     */
    private async getAllFiles(dir: string, files: string[] = []): Promise<string[]> {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Skip ignored directories
                    if (!EmbeddingService.IGNORE_DIRS.includes(entry.name)) {
                        await this.getAllFiles(fullPath, files);
                    }
                } else {
                    files.push(fullPath);
                }
            }

            return files;
        } catch (error) {
            return files;
        }
    }

    /**
     * Get file content for top files (for RAG context)
     */
    async getTopFilesWithContent(n: number = 20): Promise<Array<{ path: string; content: string; score: number }>> {
        const topFiles = await this.getTopNFiles(n);
        const filesWithContent = [];

        for (const file of topFiles) {
            try {
                const fullPath = path.join(this.workspaceRoot, file.filepath);
                const content = await fs.readFile(fullPath, 'utf-8');

                // Only include if file is not too large
                if (content.length < 50000) { // Max 50KB
                    filesWithContent.push({
                        path: file.filepath,
                        content,
                        score: file.score
                    });
                }
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        return filesWithContent;
    }

    /**
     * Generate a summary of the project based on embeddings
     */
    async generateProjectSummary(): Promise<string> {
        const embeddings = await this.generateFileEmbeddings();

        const configFiles = embeddings.filter(e => e.category === 'config').slice(0, 5);
        const entrypoints = embeddings.filter(e => e.category === 'entrypoint').slice(0, 3);
        const dependencies = embeddings.filter(e => e.category === 'dependency').slice(0, 3);

        let summary = `Project Analysis Summary:\n\n`;
        summary += `Total Files Analyzed: ${embeddings.length}\n\n`;

        summary += `Top Configuration Files:\n`;
        configFiles.forEach(f => summary += `  - ${f.filepath} (score: ${f.score.toFixed(1)})\n`);

        summary += `\nEntry Points:\n`;
        entrypoints.forEach(f => summary += `  - ${f.filepath} (score: ${f.score.toFixed(1)})\n`);

        summary += `\nDependency Files:\n`;
        dependencies.forEach(f => summary += `  - ${f.filepath} (score: ${f.score.toFixed(1)})\n`);

        return summary;
    }
}
