/**
 * LSP (Language Server Protocol) Metadata Service
 * 
 * Purpose: Understand language behavior and detect entrypoints & frameworks
 * - Uses VS Code's built-in LSP integration
 * - Detects entry points, exports, imports
 * - Understands code structure without parsing
 * - Identifies framework patterns
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface LSPMetadata {
    entryPoints: EntryPoint[];
    frameworks: FrameworkDetection[];
    languageInfo: LanguageInfo;
    dependencies: DependencyGraph;
    exports: ExportInfo[];
    imports: ImportInfo[];
}

export interface EntryPoint {
    file: string;
    type: 'main' | 'server' | 'app' | 'script' | 'worker' | 'cli';
    confidence: number;
    language: string;
    framework?: string;
}

export interface FrameworkDetection {
    name: string;
    version?: string;
    type: 'frontend' | 'backend' | 'fullstack' | 'testing' | 'build-tool';
    confidence: number;
    indicators: string[];
}

export interface LanguageInfo {
    primary: string;
    secondary: string[];
    distribution: { [language: string]: number };
}

export interface DependencyGraph {
    direct: { [key: string]: string };
    devDependencies: { [key: string]: string };
    frameworks: string[];
    buildTools: string[];
}

export interface ExportInfo {
    file: string;
    exports: string[];
    isDefault: boolean;
}

export interface ImportInfo {
    file: string;
    imports: string[];
    source: string;
}

export class LSPMetadataService {
    private workspaceRoot: string;
    private outputChannel: vscode.OutputChannel;

    constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel;
    }

    /**
     * Main method: Extract all LSP metadata
     */
    async extractMetadata(): Promise<LSPMetadata> {
        this.outputChannel.appendLine('🔍 LSP: Extracting metadata from workspace...');

        const [
            entryPoints,
            frameworks,
            languageInfo,
            dependencies
        ] = await Promise.all([
            this.detectEntryPoints(),
            this.detectFrameworks(),
            this.analyzeLanguageDistribution(),
            this.extractDependencies()
        ]);

        const exports = await this.extractExports();
        const imports = await this.extractImports();

        this.outputChannel.appendLine(`✅ LSP: Found ${entryPoints.length} entry points, ${frameworks.length} frameworks`);

        return {
            entryPoints,
            frameworks,
            languageInfo,
            dependencies,
            exports,
            imports
        };
    }

    /**
     * Detect entry points using LSP and file analysis
     */
    private async detectEntryPoints(): Promise<EntryPoint[]> {
        const entryPoints: EntryPoint[] = [];

        // Common entry point patterns
        const patterns = [
            { pattern: '**/main.{ts,js,py,go,rs}', type: 'main' as const },
            { pattern: '**/server.{ts,js,py}', type: 'server' as const },
            { pattern: '**/app.{ts,js,py}', type: 'app' as const },
            { pattern: '**/index.{ts,js}', type: 'main' as const },
            { pattern: '**/manage.py', type: 'cli' as const },
            { pattern: '**/__main__.py', type: 'main' as const },
            { pattern: '**/Program.cs', type: 'main' as const },
            { pattern: '**/Application.java', type: 'main' as const }
        ];

        for (const { pattern, type } of patterns) {
            try {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

                for (const file of files) {
                    const relativePath = path.relative(this.workspaceRoot, file.fsPath);
                    const language = this.detectLanguageFromFile(file.fsPath);
                    const framework = await this.detectFrameworkFromFile(file.fsPath);

                    // Calculate confidence based on various factors
                    let confidence = 0.5;

                    // Higher confidence for root-level files
                    if (relativePath.split(path.sep).length <= 2) {
                        confidence += 0.2;
                    }

                    // Check if file contains typical entry point patterns
                    const content = await fs.readFile(file.fsPath, 'utf-8').catch(() => '');
                    if (this.hasEntryPointPatterns(content, language)) {
                        confidence += 0.3;
                    }

                    entryPoints.push({
                        file: relativePath,
                        type,
                        confidence: Math.min(confidence, 1.0),
                        language,
                        framework
                    });
                }
            } catch (error) {
                // Skip if pattern fails
            }
        }

        // Sort by confidence
        return entryPoints.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Check if file content has entry point patterns
     */
    private hasEntryPointPatterns(content: string, language: string): boolean {
        const patterns: { [key: string]: RegExp[] } = {
            javascript: [
                /app\.listen\(/,
                /express\(\)/,
                /fastify\(\)/,
                /createServer\(/,
                /\.listen\(\d+/
            ],
            typescript: [
                /app\.listen\(/,
                /express\(\)/,
                /NestFactory\.create/,
                /bootstrap\(\)/
            ],
            python: [
                /__name__\s*==\s*['"]__main__['"]/,
                /if\s+__name__/,
                /app\.run\(/,
                /uvicorn\.run\(/,
                /manage\.py/
            ],
            go: [
                /func main\(\)/,
                /http\.ListenAndServe/,
                /gin\.Default/
            ]
        };

        const langPatterns = patterns[language.toLowerCase()] || [];
        return langPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Detect frameworks from project files
     */
    private async detectFrameworks(): Promise<FrameworkDetection[]> {
        const frameworks: FrameworkDetection[] = [];

        // Check package.json for JavaScript/TypeScript frameworks
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            // Frontend frameworks
            if (deps['react']) {
                frameworks.push({
                    name: 'React',
                    version: deps['react'],
                    type: 'frontend',
                    confidence: 0.9,
                    indicators: ['react in dependencies']
                });
            }
            if (deps['next']) {
                frameworks.push({
                    name: 'Next.js',
                    version: deps['next'],
                    type: 'fullstack',
                    confidence: 0.95,
                    indicators: ['next in dependencies']
                });
            }
            if (deps['vue']) {
                frameworks.push({
                    name: 'Vue.js',
                    version: deps['vue'],
                    type: 'frontend',
                    confidence: 0.9,
                    indicators: ['vue in dependencies']
                });
            }
            if (deps['@angular/core']) {
                frameworks.push({
                    name: 'Angular',
                    version: deps['@angular/core'],
                    type: 'frontend',
                    confidence: 0.95,
                    indicators: ['@angular/core in dependencies']
                });
            }
            if (deps['svelte']) {
                frameworks.push({
                    name: 'Svelte',
                    version: deps['svelte'],
                    type: 'frontend',
                    confidence: 0.9,
                    indicators: ['svelte in dependencies']
                });
            }

            // Backend frameworks
            if (deps['express']) {
                frameworks.push({
                    name: 'Express',
                    version: deps['express'],
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['express in dependencies']
                });
            }
            if (deps['@nestjs/core']) {
                frameworks.push({
                    name: 'NestJS',
                    version: deps['@nestjs/core'],
                    type: 'backend',
                    confidence: 0.95,
                    indicators: ['@nestjs/core in dependencies']
                });
            }
            if (deps['fastify']) {
                frameworks.push({
                    name: 'Fastify',
                    version: deps['fastify'],
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['fastify in dependencies']
                });
            }
            if (deps['koa']) {
                frameworks.push({
                    name: 'Koa',
                    version: deps['koa'],
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['koa in dependencies']
                });
            }

            // Build tools
            if (deps['vite']) {
                frameworks.push({
                    name: 'Vite',
                    version: deps['vite'],
                    type: 'build-tool',
                    confidence: 0.85,
                    indicators: ['vite in dependencies']
                });
            }
            if (deps['webpack']) {
                frameworks.push({
                    name: 'Webpack',
                    version: deps['webpack'],
                    type: 'build-tool',
                    confidence: 0.85,
                    indicators: ['webpack in dependencies']
                });
            }
        } catch {
            // No package.json or invalid JSON
        }

        // Check requirements.txt for Python frameworks
        const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
        try {
            const requirements = await fs.readFile(requirementsPath, 'utf-8');

            if (requirements.includes('django')) {
                frameworks.push({
                    name: 'Django',
                    type: 'fullstack',
                    confidence: 0.9,
                    indicators: ['django in requirements.txt']
                });
            }
            if (requirements.includes('flask')) {
                frameworks.push({
                    name: 'Flask',
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['flask in requirements.txt']
                });
            }
            if (requirements.includes('fastapi')) {
                frameworks.push({
                    name: 'FastAPI',
                    type: 'backend',
                    confidence: 0.95,
                    indicators: ['fastapi in requirements.txt']
                });
            }
        } catch {
            // No requirements.txt
        }

        // Check for Go frameworks
        const goModPath = path.join(this.workspaceRoot, 'go.mod');
        try {
            const goMod = await fs.readFile(goModPath, 'utf-8');

            if (goMod.includes('gin-gonic/gin')) {
                frameworks.push({
                    name: 'Gin',
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['gin in go.mod']
                });
            }
            if (goMod.includes('gofiber/fiber')) {
                frameworks.push({
                    name: 'Fiber',
                    type: 'backend',
                    confidence: 0.9,
                    indicators: ['fiber in go.mod']
                });
            }
        } catch {
            // No go.mod
        }

        return frameworks.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Analyze language distribution in the project
     */
    private async analyzeLanguageDistribution(): Promise<LanguageInfo> {
        const languageCounts: { [key: string]: number } = {};

        // Get all source files
        const patterns = [
            '**/*.{js,jsx,ts,tsx}',
            '**/*.{py}',
            '**/*.{go}',
            '**/*.{rs}',
            '**/*.{java}',
            '**/*.{cs}',
            '**/*.{rb}',
            '**/*.{php}'
        ];

        for (const pattern of patterns) {
            try {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                const ext = pattern.match(/\{(.+?)\}/)?.[1].split(',')[0] || '';
                const lang = this.extensionToLanguage(ext);

                languageCounts[lang] = (languageCounts[lang] || 0) + files.length;
            } catch {
                // Skip if pattern fails
            }
        }

        // Calculate distribution
        const total = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
        const distribution: { [key: string]: number } = {};

        for (const [lang, count] of Object.entries(languageCounts)) {
            distribution[lang] = total > 0 ? (count / total) * 100 : 0;
        }

        // Find primary and secondary languages
        const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1]);
        const primary = sorted[0]?.[0] || 'Unknown';
        const secondary = sorted.slice(1, 4).map(([lang]) => lang);

        return {
            primary,
            secondary,
            distribution
        };
    }

    /**
     * Extract dependency graph
     */
    private async extractDependencies(): Promise<DependencyGraph> {
        const dependencies: DependencyGraph = {
            direct: {},
            devDependencies: {},
            frameworks: [],
            buildTools: []
        };

        // Extract from package.json
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        try {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

            dependencies.direct = packageJson.dependencies || {};
            dependencies.devDependencies = packageJson.devDependencies || {};

            // Identify frameworks
            const frameworkNames = ['react', 'vue', 'angular', 'svelte', 'express', 'fastify', 'nestjs', 'next', 'nuxt'];
            dependencies.frameworks = Object.keys(dependencies.direct).filter(dep =>
                frameworkNames.some(fw => dep.includes(fw))
            );

            // Identify build tools
            const buildToolNames = ['vite', 'webpack', 'rollup', 'esbuild', 'turbo', 'nx'];
            dependencies.buildTools = Object.keys({ ...dependencies.direct, ...dependencies.devDependencies }).filter(dep =>
                buildToolNames.some(bt => dep.includes(bt))
            );
        } catch {
            // No package.json
        }

        return dependencies;
    }

    /**
     * Extract exports from files (simplified)
     */
    private async extractExports(): Promise<ExportInfo[]> {
        // This is a simplified version - in production, you'd use VS Code's LSP symbols
        return [];
    }

    /**
     * Extract imports from files (simplified)
     */
    private async extractImports(): Promise<ImportInfo[]> {
        // This is a simplified version - in production, you'd use VS Code's LSP symbols
        return [];
    }

    /**
     * Detect language from file extension
     */
    private detectLanguageFromFile(filepath: string): string {
        const ext = path.extname(filepath).toLowerCase();
        return this.extensionToLanguage(ext);
    }

    /**
     * Map extension to language
     */
    private extensionToLanguage(ext: string): string {
        const mapping: { [key: string]: string } = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.go': 'Go',
            '.rs': 'Rust',
            '.java': 'Java',
            '.cs': 'C#',
            '.rb': 'Ruby',
            '.php': 'PHP'
        };
        return mapping[ext] || 'Unknown';
    }

    /**
     * Detect framework from file content
     */
    private async detectFrameworkFromFile(filepath: string): Promise<string | undefined> {
        try {
            const content = await fs.readFile(filepath, 'utf-8');

            // Check for framework-specific imports
            if (content.includes('from flask import') || content.includes('import flask')) {
                return 'Flask';
            }
            if (content.includes('from django') || content.includes('import django')) {
                return 'Django';
            }
            if (content.includes('from fastapi import') || content.includes('import fastapi')) {
                return 'FastAPI';
            }
            if (content.includes('from express') || content.includes('require(\'express\')')) {
                return 'Express';
            }
            if (content.includes('@nestjs')) {
                return 'NestJS';
            }

            return undefined;
        } catch {
            return undefined;
        }
    }
}
