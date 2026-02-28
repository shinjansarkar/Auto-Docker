/**
 * AI-Based Tech Stack Detector
 * Uses Gemini AI to intelligently detect ANY tech stack
 * Provides accurate detection without hardcoded rules
 * Works with both known and unknown/emerging technologies
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIDetectedTechStack {
    // Primary information
    primaryLanguage: string;
    primaryRuntime: string;
    frameworks: string[];
    libraries: string[];
    
    // Build & Package Management
    buildTools: string[];
    packageManagers: string[];
    
    // Infrastructure
    databases: Array<{
        type: string;
        version?: string;
        port?: number;
    }>;
    cacheStores: string[];
    messageQueues: string[];
    
    // Docker recommendations
    baseImage: string;
    buildSteps: string[];
    runCommand: string;
    exposedPorts: number[];
    environmentVariables: Record<string, string>;
    
    // Project structure
    projectType: 'frontend-only' | 'backend-only' | 'fullstack' | 'monorepo' | 'library' | 'cli-tool' | 'mobile' | 'desktop';
    isMonorepo: boolean;
    workspaces?: Array<{
        path: string;
        type: string;
        framework: string;
    }>;
    
    // Frontend specific
    frontend?: {
        framework: string;
        variant?: string;
        buildOutputDir: string;
        serveCommand: string;
        buildCommand: string;
        devPort: number;
    };
    
    // Backend specific
    backend?: {
        framework: string;
        language: string;
        entryPoint: string;
        port: number;
        dependencies: string[];
    };
    
    // Confidence and reasoning
    confidence: number; // 0-1
    reasoning: string;
    detectedFiles: string[];
}

/**
 * AI Tech Stack Detector using Gemini
 */
export class AITechStackDetector {
    private geminiClient?: GoogleGenerativeAI;
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.initializeClients();
    }

    /**
     * Initialize AI clients (Gemini only)
     */
    private initializeClients() {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const geminiKey = config.get<string>('geminiApiKey');
        if (geminiKey) {
            this.geminiClient = new GoogleGenerativeAI(geminiKey);
        }
        if (!geminiKey) {
            throw new Error('No Gemini API key configured. Please set your Gemini API key in settings.');
        }
    }

    /**
     * Main method: Detect tech stack using AI
     */
    async detectTechStack(): Promise<AIDetectedTechStack> {
        console.log('[AITechStackDetector] Starting AI-based detection...');
        
        // Step 1: Gather codebase context
        const context = await this.gatherCodebaseContext();
        
        // Step 2: Send to AI for analysis
        const prompt = this.createDetectionPrompt(context);
        const aiResponse = await this.detectWithGemini(prompt);
        
        // Step 3: Parse AI response
        const detected = this.parseAIResponse(aiResponse);
        
        console.log('[AITechStackDetector] Detection complete:', {
            primaryLanguage: detected.primaryLanguage,
            framework: detected.frameworks[0],
            confidence: detected.confidence
        });
        
        return detected;
    }

    /**
     * Gather comprehensive codebase context for AI analysis.
     * This is the "eye" - it collects ALL evidence so AI can identify ANY tech stack.
     */
    private async gatherCodebaseContext(): Promise<string> {
        let context = '# CODEBASE ANALYSIS\n\n';
        
        try {
            // 1. Full directory structure - AI uses this to identify project patterns
            //    e.g. lib/main.dart = Flutter, app/controllers = Rails/AdonisJS
            context += '## Directory Structure\n```\n';
            const files = await this.getFileStructure(this.workspaceRoot, 150);
            context += files.join('\n');
            context += '\n```\n\n';
            
            // 2. All config/dependency files - AI uses these as primary evidence
            //    e.g. pubspec.yaml = Flutter, Gemfile with 'rails' = Rails,
            //         package.json with '@adonisjs/core' = AdonisJS
            context += '## Configuration & Dependency Files\n\n';
            const configFiles = await this.readConfigurationFiles();
            for (const [filename, content] of Object.entries(configFiles)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            
            // 3. Entry point files - AI uses these to confirm the framework
            //    e.g. lib/main.dart with runApp() = Flutter,
            //         server.js with HttpContext = AdonisJS,
            //         app/controllers/application_controller.rb = Rails
            context += '## Entry Point & Key Source Files\n\n';
            const entryPoints = await this.readEntryPointFiles();
            for (const [filename, content] of Object.entries(entryPoints)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }

            // 4. Additional sample source files for deeper pattern recognition
            context += '## Additional Source Code Samples\n\n';
            const sourceFiles = await this.readSampleSourceFiles();
            for (const [filename, content] of Object.entries(sourceFiles)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            
            // 5. Build scripts from ALL package managers
            //    e.g. "node ace serve" = AdonisJS, "bundle exec rails" = Rails,
            //         "flutter build web" = Flutter
            const buildScripts = await this.extractBuildScripts(configFiles);
            if (buildScripts.length > 0) {
                context += '## Build & Run Scripts\n';
                buildScripts.forEach(script => {
                    context += `- ${script}\n`;
                });
                context += '\n';
            }
            
        } catch (error) {
            console.error('[AITechStackDetector] Error gathering context:', error);
            context += `\nError gathering some context: ${error}\n`;
        }
        
        return context;
    }

    /**
     * Read known entry-point files so AI gets the most revealing code patterns.
     * These files contain framework-specific imports and class patterns that
     * are the strongest signals for AI to identify any tech stack.
     */
    private async readEntryPointFiles(): Promise<Record<string, string>> {
        const entryPoints: Record<string, string> = {};

        // Candidate entry-point paths across ALL frameworks/languages.
        // AI does NOT need these to be framework-specific - it reads the content
        // and recognises patterns from its training data.
        const candidates = [
            // JavaScript / TypeScript
            'index.js', 'index.ts', 'index.mjs',
            'server.js', 'server.ts',
            'app.js', 'app.ts',
            'main.js', 'main.ts',
            'src/index.js', 'src/index.ts',
            'src/server.js', 'src/server.ts',
            'src/app.js', 'src/app.ts',
            'src/main.js', 'src/main.ts',
            // AdonisJS specific
            'start/routes.ts', 'start/routes.js',
            'start/kernel.ts',
            '.adonisrc.json',
            'ace',
            // Python
            'main.py', 'app.py', 'server.py',
            'manage.py',           // Django
            'wsgi.py', 'asgi.py',  // Django/FastAPI
            'run.py',
            'src/main.py', 'src/app.py',
            // Ruby
            'config/application.rb',   // Rails
            'config/routes.rb',        // Rails
            'app/controllers/application_controller.rb',
            'config.ru',               // Rack apps
            'Rakefile',
            // Java / Kotlin
            'src/main/java/Application.java',
            'src/main/kotlin/Application.kt',
            'src/main/resources/application.properties',
            'src/main/resources/application.yml',
            // Go
            'main.go',
            'cmd/main.go',
            'cmd/server/main.go',
            // Rust
            'src/main.rs',
            'src/lib.rs',
            // PHP
            'index.php',
            'artisan',          // Laravel
            'public/index.php', // Laravel
            'config/app.php',   // Laravel
            // Dart / Flutter
            'lib/main.dart',
            'pubspec.yaml',
            // Elixir
            'lib/router.ex',
            'lib/endpoint.ex',
            'config/config.exs',
            // .NET
            'Program.cs',
            'Startup.cs',
            'appsettings.json',
            // C / C++
            'main.c', 'main.cpp',
            'CMakeLists.txt',
        ];

        for (const candidate of candidates) {
            const fullPath = path.join(this.workspaceRoot, candidate);
            const content = await this.readFileSafe(fullPath);
            if (content && content.trim().length > 0) {
                entryPoints[candidate] = content.substring(0, 2000);
            }
        }

        return entryPoints;
    }

    /**
     * Get file structure recursively
     */
    private async getFileStructure(dir: string, maxFiles: number, currentCount = 0): Promise<string[]> {
        const files: string[] = [];
        
        if (currentCount >= maxFiles) {
            return files;
        }
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (files.length + currentCount >= maxFiles) break;
                
                // Skip common ignore patterns
                if (this.shouldIgnoreFile(entry.name)) continue;
                
                const relativePath = path.relative(this.workspaceRoot, path.join(dir, entry.name));
                
                if (entry.isDirectory()) {
                    files.push(`${relativePath}/`);
                    const subFiles = await this.getFileStructure(
                        path.join(dir, entry.name),
                        maxFiles,
                        currentCount + files.length
                    );
                    files.push(...subFiles);
                } else {
                    files.push(relativePath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
        
        return files;
    }

    /**
     * Read all critical configuration files
     */
    private async readConfigurationFiles(): Promise<Record<string, string>> {
        const configFiles: Record<string, string> = {};
        
        const importantFiles = [
            // JavaScript/TypeScript/Node
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            'bun.lockb',
            'tsconfig.json',
            'jsconfig.json',
            
            // Build tools & Bundlers
            'vite.config.ts',
            'vite.config.js',
            'webpack.config.js',
            'webpack.config.ts',
            'rollup.config.js',
            'esbuild.config.js',
            'turbo.json',
            
            // Framework configs
            'next.config.js',
            'next.config.mjs',
            'nuxt.config.js',
            'nuxt.config.ts',
            'astro.config.mjs',
            'astro.config.ts',
            'svelte.config.js',
            'angular.json',
            'vue.config.js',
            'remix.config.js',
            
            // Python
            'requirements.txt',
            'Pipfile',
            'pyproject.toml',
            'poetry.lock',
            'setup.py',
            'setup.cfg',
            
            // Java/Kotlin
            'pom.xml',
            'build.gradle',
            'build.gradle.kts',
            'settings.gradle',
            'settings.gradle.kts',
            'gradle.properties',
            
            // Go
            'go.mod',
            'go.sum',
            
            // Rust
            'Cargo.toml',
            'Cargo.lock',
            
            // Ruby
            'Gemfile',
            'Gemfile.lock',
            'config/application.rb',
            
            // PHP
            'composer.json',
            'composer.lock',
            
            // .NET
            '*.csproj',
            '*.fsproj',
            '*.vbproj',
            'project.json',
            
            // Dart/Flutter
            'pubspec.yaml',
            'pubspec.lock',
            
            // Elixir
            'mix.exs',
            'mix.lock',
            
            // Erlang
            'rebar.config',
            'rebar.lock',
            
            // Deno
            'deno.json',
            'deno.jsonc',
            'import_map.json',
            
            // Database & ORM
            'prisma/schema.prisma',
            'drizzle.config.ts',
            
            // Docker
            'docker-compose.yml',
            'docker-compose.yaml',
            'Dockerfile',
            
            // Environment
            '.env.example',
            '.env.sample',
            
            // Documentation
            'README.md',
            'README.txt'
        ];
        
        for (const pattern of importantFiles) {
            try {
                if (pattern.includes('*')) {
                    // Handle glob patterns
                    const files = await fs.readdir(this.workspaceRoot);
                    const ext = pattern.replace('*', '');
                    const matches = files.filter(f => f.endsWith(ext));
                    
                    for (const match of matches.slice(0, 3)) { // Limit to 3 matches
                        const content = await this.readFileSafe(path.join(this.workspaceRoot, match));
                        if (content) {
                            configFiles[match] = content.substring(0, 5000); // Limit size
                        }
                    }
                } else if (pattern.includes('/')) {
                    // Handle nested paths (like prisma/schema.prisma)
                    const filePath = path.join(this.workspaceRoot, pattern);
                    const content = await this.readFileSafe(filePath);
                    if (content) {
                        configFiles[pattern] = content.substring(0, 5000); // Limit size
                    }
                } else {
                    const filePath = path.join(this.workspaceRoot, pattern);
                    const content = await this.readFileSafe(filePath);
                    if (content) {
                        configFiles[pattern] = content.substring(0, 5000); // Limit size
                    }
                }
            } catch (error) {
                // File doesn't exist, continue
            }
        }
        
        return configFiles;
    }

    /**
     * Read sample source code files
     */
    private async readSampleSourceFiles(): Promise<Record<string, string>> {
        const sourceFiles: Record<string, string> = {};
        
        // Expanded to include more languages
        const extensions = [
            // JavaScript/TypeScript ecosystem
            '.ts', '.js', '.tsx', '.jsx', '.mjs', '.cjs',
            // Python
            '.py', '.pyi',
            // Java/Kotlin/Scala
            '.java', '.kt', '.kts', '.scala',
            // Go
            '.go',
            // Rust
            '.rs',
            // Ruby
            '.rb',
            // PHP
            '.php',
            // C#/F#
            '.cs', '.fs',
            // Elixir
            '.ex', '.exs',
            // Dart
            '.dart',
            // Swift
            '.swift',
            // C/C++
            '.c', '.cpp', '.h', '.hpp',
            // Shell scripts
            '.sh', '.bash',
            // Configuration as code
            '.toml', '.yaml', '.yml'
        ];
        const maxFiles = 5;
        let count = 0;
        
        try {
            const files = await this.findSourceFiles(this.workspaceRoot, extensions);
            
            for (const file of files) {
                if (count >= maxFiles) break;
                
                const content = await this.readFileSafe(file);
                if (content && content.length > 100) {
                    const relativePath = path.relative(this.workspaceRoot, file);
                    sourceFiles[relativePath] = content.substring(0, 1000); // First 1000 chars
                    count++;
                }
            }
        } catch (error) {
            console.error('[AITechStackDetector] Error reading source files:', error);
        }
        
        return sourceFiles;
    }

    /**
     * Find source files recursively
     */
    private async findSourceFiles(dir: string, extensions: string[], maxDepth = 3, currentDepth = 0): Promise<string[]> {
        const files: string[] = [];
        
        if (currentDepth >= maxDepth) return files;
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                if (this.shouldIgnoreFile(entry.name)) continue;
                
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    const subFiles = await this.findSourceFiles(fullPath, extensions, maxDepth, currentDepth + 1);
                    files.push(...subFiles);
                } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories we can't read
        }
        
        return files;
    }

    /**
     * Extract build/run scripts from ALL package managers.
     * AI uses these commands as strong signals:
     *   "node ace serve"        → AdonisJS
     *   "bundle exec rails s"   → Ruby on Rails
     *   "flutter build web"     → Flutter
     *   "uvicorn main:app"      → FastAPI
     *   "mix phx.server"        → Phoenix (Elixir)
     */
    private extractBuildScripts(configFiles: Record<string, string>): string[] {
        const scripts: string[] = [];

        // npm / yarn / pnpm / bun (package.json scripts)
        if (configFiles['package.json']) {
            try {
                const pkg = JSON.parse(configFiles['package.json']);
                if (pkg.scripts) {
                    Object.entries(pkg.scripts).forEach(([name, cmd]) => {
                        scripts.push(`[npm] ${name}: ${cmd}`);
                    });
                }
                // Also capture main/bin fields - signals CLI tool or entry point
                if (pkg.main)  scripts.push(`[npm] main: ${pkg.main}`);
                if (pkg.bin)   scripts.push(`[npm] bin: ${JSON.stringify(pkg.bin)}`);
                if (pkg.type)  scripts.push(`[npm] type: ${pkg.type}`);
            } catch { /* Invalid JSON */ }
        }

        // Ruby Gemfile - extract gem versions as signals
        if (configFiles['Gemfile']) {
            const gemLines = configFiles['Gemfile']
                .split('\n')
                .filter(l => l.trim().startsWith('gem '))
                .slice(0, 20);
            gemLines.forEach(l => scripts.push(`[Gemfile] ${l.trim()}`));
        }

        // Rakefile - shows Rails task structure
        const rakefile = configFiles['Rakefile'];
        if (rakefile) {
            scripts.push(`[Rakefile] exists - likely Rails or Ruby project`);
        }

        // Elixir mix.exs - extract project name and deps
        if (configFiles['mix.exs']) {
            const mixLines = configFiles['mix.exs']
                .split('\n')
                .filter(l => l.includes('def ') || l.includes('{:'))
                .slice(0, 15);
            mixLines.forEach(l => scripts.push(`[mix.exs] ${l.trim()}`));
        }

        // Dart/Flutter pubspec.yaml - extract dependencies section
        if (configFiles['pubspec.yaml']) {
            const pubLines = configFiles['pubspec.yaml']
                .split('\n')
                .filter(l => l.trim().length > 0)
                .slice(0, 30);
            pubLines.forEach(l => scripts.push(`[pubspec] ${l}`))
        }

        // Python pyproject.toml - extract tool.poetry or project section
        if (configFiles['pyproject.toml']) {
            const pyLines = configFiles['pyproject.toml']
                .split('\n')
                .filter(l => l.trim().length > 0)
                .slice(0, 20);
            pyLines.forEach(l => scripts.push(`[pyproject] ${l}`));
        }

        // Go mod - module name and Go version
        if (configFiles['go.mod']) {
            const goLines = configFiles['go.mod']
                .split('\n')
                .slice(0, 10);
            goLines.forEach(l => scripts.push(`[go.mod] ${l}`));
        }

        // Rust Cargo.toml - package name and dependencies
        if (configFiles['Cargo.toml']) {
            const cargoLines = configFiles['Cargo.toml']
                .split('\n')
                .filter(l => l.trim().length > 0)
                .slice(0, 20);
            cargoLines.forEach(l => scripts.push(`[Cargo.toml] ${l}`));
        }

        // PHP composer.json - require section
        if (configFiles['composer.json']) {
            try {
                const composer = JSON.parse(configFiles['composer.json']);
                if (composer.require) {
                    Object.entries(composer.require).forEach(([pkg, ver]) => {
                        scripts.push(`[composer] require: ${pkg}@${ver}`);
                    });
                }
                if (composer.scripts) {
                    Object.entries(composer.scripts).forEach(([name, cmd]) => {
                        scripts.push(`[composer] script ${name}: ${JSON.stringify(cmd)}`);
                    });
                }
            } catch { /* Invalid JSON */ }
        }

        // Java pom.xml - extract parent/dependencies snippet
        if (configFiles['pom.xml']) {
            const pomSnippet = configFiles['pom.xml']
                .split('\n')
                .filter(l => l.includes('<groupId>') || l.includes('<artifactId>') || l.includes('<version>'))
                .slice(0, 15);
            pomSnippet.forEach(l => scripts.push(`[pom.xml] ${l.trim()}`));
        }

        return scripts;
    }

    /**
     * Read file safely with error handling
     */
    private async readFileSafe(filePath: string): Promise<string | null> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            return null;
        }
    }

    /**
     * Check if file should be ignored
     */
    private shouldIgnoreFile(name: string): boolean {
        const ignorePatterns = [
            'node_modules',
            '.git',
            'dist',
            'build',
            'out',
            'target',
            'bin',
            'obj',
            '.next',
            '.nuxt',
            '.output',
            'coverage',
            '__pycache__',
            '.pytest_cache',
            '.venv',
            'venv',
            'env',
            '.idea',
            '.vscode',
            '.DS_Store'
        ];
        
        return ignorePatterns.includes(name) || name.startsWith('.');
    }

    /**
     * Create the AI detection prompt.
     * IMPORTANT: This prompt deliberately contains NO hardcoded framework names.
     * The AI identifies the tech stack purely from the codebase evidence provided.
     * This is what makes detection work for ANY framework - known, new, or custom.
     *
     * How the AI works internally:
     *   - It was trained on millions of repos across every ecosystem
     *   - It learned to map patterns → framework names
     *   - e.g. `@adonisjs/core` in deps  → knows = AdonisJS
     *   - e.g. `gem 'rails'` in Gemfile  → knows = Ruby on Rails
     *   - e.g. `flutter: sdk: flutter`   → knows = Flutter
     *   - e.g. `runApp()` in .dart file  → confirms Flutter
     *   - e.g. `node ace serve` script   → confirms AdonisJS
     * We just feed it the evidence; it does the identification.
     */
    private createDetectionPrompt(context: string): string {
        return `You are an expert software architect and DevOps engineer with deep knowledge of every programming language, framework, runtime, and tech stack that exists - including bleeding-edge, niche, legacy, and custom technologies.

Your task: Examine the codebase evidence below and identify the COMPLETE tech stack with full accuracy.
Do NOT rely on any predefined list of frameworks. Identify everything purely from the evidence provided.

${context}

Your analysis approach:
1. READ the directory structure - folder patterns reveal the framework (e.g. app/controllers, lib/main.dart, cmd/main.go)
2. READ config/dependency files - these are the strongest signals (pubspec.yaml, Gemfile, package.json, Cargo.toml, pom.xml, mix.exs, etc.)
3. READ entry-point source files - class names, imports, and function signatures confirm the framework
4. READ build scripts - the run commands confirm the exact runtime and framework
5. COMBINE all signals to reach a high-confidence conclusion

INFERENCE RULES (do not list frameworks, just apply these logical rules):
- If dependency files or imports reference a framework package → that framework is used
- If directory structure matches an MVC convention → identify the framework by its specific file naming
- If entry-point file has framework-specific base classes or function calls → that confirms the framework
- If build script uses a framework-specific CLI command → that confirms the framework
- If BOTH a UI build system AND a server entry-point exist → projectType is "fullstack"
- If ONLY a UI build system exists with no server → projectType is "frontend-only"
- If ONLY a server entry-point exists → projectType is "backend-only"
- If android/ or ios/ directories exist alongside a mobile framework → projectType is "mobile"
- If platform-specific desktop files exist → projectType is "desktop"
- If multiple independently-runnable sub-projects exist → projectType is "monorepo"
- If only devDependencies and no runnable entry point → projectType is "library"
- If a bin/CLI entry point exists with no UI or server → projectType is "cli-tool"

Respond with ONLY this JSON object and nothing else:

\`\`\`json
{
  "primaryLanguage": "The main programming language detected from source files",
  "primaryRuntime": "The runtime environment detected (e.g. the version and platform)",
  "frameworks": ["Every framework and significant library detected from evidence"],
  "libraries": ["Key libraries detected from dependency files"],
  "buildTools": ["Every build tool, bundler, or task runner detected"],
  "packageManagers": ["Every package manager detected from lock files or manifests"],
  "databases": [
    {"type": "database name detected from deps/env/config", "version": "if detectable", "port": 5432}
  ],
  "cacheStores": ["Cache stores detected from deps or env variables"],
  "messageQueues": ["Message brokers detected from deps or config"],
  "baseImage": "The most appropriate official Docker base image for this exact stack and version",
  "buildSteps": ["Exact ordered build commands for this specific framework and version"],
  "runCommand": "The exact command to start this application in production",
  "exposedPorts": [8080],
  "environmentVariables": {
    "KEY": "typical production value for this framework"
  },
  "projectType": "frontend-only | backend-only | fullstack | monorepo | library | cli-tool | mobile | desktop",
  "isMonorepo": false,
  "workspaces": [
    {"path": "relative path", "type": "frontend|backend|mobile|library", "framework": "detected framework"}
  ],
  "frontend": {
    "framework": "Exact frontend framework name detected",
    "variant": "Build tool or variant detected",
    "buildOutputDir": "Exact build output directory for this framework",
    "serveCommand": "Command to serve in production",
    "buildCommand": "Command to build for production",
    "devPort": 3000
  },
  "backend": {
    "framework": "Exact backend framework name detected",
    "language": "Backend language detected",
    "entryPoint": "Main entry file detected from directory structure",
    "port": 3000,
    "dependencies": ["Key runtime dependencies detected"]
  },
  "confidence": 0.95,
  "reasoning": "Explain exactly which files and patterns led to each conclusion",
  "detectedFiles": ["List every file that contributed to detection"]
}
\`\`\`

RESPOND ONLY WITH THE JSON OBJECT - NO OTHER TEXT.`;
    }

    /**
     * Detect using Gemini API
     */
    private async detectWithGemini(prompt: string): Promise<string> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }
        
        console.log('[AITechStackDetector] Using Gemini for detection...');
        const config = vscode.workspace.getConfiguration('autoDocker');
        const modelName = config.get<string>('geminiModel', 'gemini-2.0-flash');
        
        const model = this.geminiClient.getGenerativeModel({ 
            model: modelName,
            generationConfig: {
                temperature: 0.1, // Low temperature for factual detection
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 4000,
            }
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    /**
     * Parse the AI response into a typed AIDetectedTechStack.
     * Handles all common AI output formats:
     *   - Raw JSON
     *   - JSON wrapped in ```json ... ``` fences
     *   - JSON wrapped in ``` ... ``` fences
     *   - JSON buried inside prose text
     */
    private parseAIResponse(response: string): AIDetectedTechStack {
        try {
            let jsonStr = response.trim();

            // Strategy 1: extract from ```json ... ``` or ``` ... ``` fences
            const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (fenceMatch && fenceMatch[1]) {
                jsonStr = fenceMatch[1].trim();
            } else {
                // Strategy 2: find the outermost { ... } block in the response
                const start = jsonStr.indexOf('{');
                const end   = jsonStr.lastIndexOf('}');
                if (start !== -1 && end !== -1 && end > start) {
                    jsonStr = jsonStr.substring(start, end + 1);
                }
            }

            const parsed = JSON.parse(jsonStr);

            // Validate the essential fields that drive Docker generation
            if (!parsed.primaryLanguage || !parsed.primaryRuntime || !parsed.projectType) {
                throw new Error(
                    `AI response missing required fields. Got: primaryLanguage=${parsed.primaryLanguage}, ` +
                    `primaryRuntime=${parsed.primaryRuntime}, projectType=${parsed.projectType}`
                );
            }

            // Ensure array fields are always arrays (AI sometimes returns a string)
            const toArray = (v: any): any[] => {
                if (Array.isArray(v)) { return v; }
                if (typeof v === 'string' && v.trim()) { return [v]; }
                return [];
            };

            return {
                ...parsed,
                frameworks:      toArray(parsed.frameworks),
                libraries:       toArray(parsed.libraries),
                buildTools:      toArray(parsed.buildTools),
                packageManagers: toArray(parsed.packageManagers),
                databases:       toArray(parsed.databases),
                cacheStores:     toArray(parsed.cacheStores),
                messageQueues:   toArray(parsed.messageQueues),
                exposedPorts:    toArray(parsed.exposedPorts),
                detectedFiles:   toArray(parsed.detectedFiles),
                confidence:      typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
            } as AIDetectedTechStack;

        } catch (error) {
            console.error('[AITechStackDetector] Failed to parse AI response:', error);
            console.error('[AITechStackDetector] Raw response was:', response.substring(0, 500));
            return this.createFallbackDetection();
        }
    }

    /**
     * Create fallback detection when AI parsing fails
     */
    private createFallbackDetection(): AIDetectedTechStack {
        return {
            primaryLanguage: 'Unknown',
            primaryRuntime: 'Unknown',
            frameworks: [],
            libraries: [],
            buildTools: [],
            packageManagers: [],
            databases: [],
            cacheStores: [],
            messageQueues: [],
            baseImage: 'ubuntu:22.04',
            buildSteps: [],
            runCommand: 'echo "Please configure manually"',
            exposedPorts: [8080],
            environmentVariables: {},
            projectType: 'backend-only',
            isMonorepo: false,
            confidence: 0.1,
            reasoning: 'Failed to detect tech stack automatically. Manual configuration required.',
            detectedFiles: []
        };
    }
}
