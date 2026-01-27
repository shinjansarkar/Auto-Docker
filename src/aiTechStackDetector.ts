/**
 * AI-Based Tech Stack Detector
 * Uses AI (Claude/Gemini) to intelligently detect ANY tech stack
 * Provides accurate detection without hardcoded rules
 * Works with both known and unknown/emerging technologies
 */

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';

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
    projectType: 'frontend-only' | 'backend-only' | 'fullstack' | 'monorepo' | 'library' | 'cli-tool';
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
 * AI Tech Stack Detector using Claude or Gemini
 */
export class AITechStackDetector {
    private anthropicClient?: Anthropic;
    private geminiClient?: GoogleGenerativeAI;
    private workspaceRoot: string;
    private useProvider: 'claude' | 'gemini';

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.useProvider = 'gemini'; // Default to Gemini
        this.initializeClients();
    }

    /**
     * Initialize AI clients based on available API keys
     */
    private initializeClients() {
        const config = vscode.workspace.getConfiguration('autoDocker');
        
        const anthropicKey = config.get<string>('anthropicApiKey');
        const geminiKey = config.get<string>('geminiApiKey');
        
        if (anthropicKey) {
            this.anthropicClient = new Anthropic({ apiKey: anthropicKey });
            this.useProvider = 'claude';
        }
        
        if (geminiKey) {
            this.geminiClient = new GoogleGenerativeAI(geminiKey);
            if (!anthropicKey) {
                this.useProvider = 'gemini';
            }
        }
        
        if (!anthropicKey && !geminiKey) {
            throw new Error('No AI API key configured. Please configure Anthropic or Gemini API key in settings.');
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
        
        let aiResponse: string;
        if (this.useProvider === 'claude' && this.anthropicClient) {
            aiResponse = await this.detectWithClaude(prompt);
        } else if (this.useProvider === 'gemini' && this.geminiClient) {
            aiResponse = await this.detectWithGemini(prompt);
        } else {
            throw new Error('No AI provider available');
        }
        
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
     * Gather comprehensive codebase context for AI analysis
     */
    private async gatherCodebaseContext(): Promise<string> {
        let context = '# CODEBASE ANALYSIS\n\n';
        
        try {
            // 1. Directory structure (first 100 files)
            context += '## Directory Structure\n```\n';
            const files = await this.getFileStructure(this.workspaceRoot, 100);
            context += files.join('\n');
            context += '\n```\n\n';
            
            // 2. Package/dependency files (CRITICAL)
            context += '## Configuration Files\n\n';
            const configFiles = await this.readConfigurationFiles();
            for (const [filename, content] of Object.entries(configFiles)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            
            // 3. Sample source code files
            context += '## Sample Source Code\n\n';
            const sourceFiles = await this.readSampleSourceFiles();
            for (const [filename, content] of Object.entries(sourceFiles)) {
                context += `### ${filename}\n\`\`\`\n${content}\n\`\`\`\n\n`;
            }
            
            // 4. Build scripts
            const buildScripts = await this.extractBuildScripts(configFiles);
            if (buildScripts.length > 0) {
                context += '## Build Scripts\n';
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
            'package.json',
            'package-lock.json',
            'yarn.lock',
            'pnpm-lock.yaml',
            'requirements.txt',
            'Pipfile',
            'pyproject.toml',
            'poetry.lock',
            'pom.xml',
            'build.gradle',
            'build.gradle.kts',
            'settings.gradle',
            'go.mod',
            'go.sum',
            'Cargo.toml',
            'Cargo.lock',
            'Gemfile',
            'Gemfile.lock',
            'composer.json',
            'composer.lock',
            '*.csproj',
            '*.fsproj',
            '*.vbproj',
            'project.json',
            'pubspec.yaml',
            'mix.exs',
            'rebar.config',
            'tsconfig.json',
            'vite.config.ts',
            'vite.config.js',
            'webpack.config.js',
            'next.config.js',
            'nuxt.config.js',
            'angular.json',
            'vue.config.js',
            'svelte.config.js',
            'astro.config.mjs',
            'docker-compose.yml',
            'docker-compose.yaml',
            'Dockerfile',
            '.env.example',
            'README.md'
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
        
        const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.rb', '.php', '.cs', '.ex', '.exs'];
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
     * Extract build scripts from package.json or similar
     */
    private extractBuildScripts(configFiles: Record<string, string>): string[] {
        const scripts: string[] = [];
        
        if (configFiles['package.json']) {
            try {
                const pkg = JSON.parse(configFiles['package.json']);
                if (pkg.scripts) {
                    Object.entries(pkg.scripts).forEach(([name, cmd]) => {
                        scripts.push(`${name}: ${cmd}`);
                    });
                }
            } catch (error) {
                // Invalid JSON
            }
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
     * Create detection prompt for AI
     */
    private createDetectionPrompt(context: string): string {
        return `You are an expert DevOps engineer and software architect analyzing a codebase to detect its tech stack and recommend Docker configuration.

${context}

Based on the above codebase analysis, provide a comprehensive tech stack detection in the following JSON format:

\`\`\`json
{
  "primaryLanguage": "string (e.g., JavaScript, Python, Java, Go, etc.)",
  "primaryRuntime": "string (e.g., Node.js, Python 3.11, JVM 17, Go 1.21, etc.)",
  "frameworks": ["array of frameworks used, e.g., React, Express, Django, Spring Boot"],
  "libraries": ["key libraries/dependencies"],
  "buildTools": ["e.g., Webpack, Vite, Maven, Gradle, npm, etc."],
  "packageManagers": ["e.g., npm, yarn, pnpm, pip, poetry, etc."],
  "databases": [
    {"type": "postgres", "version": "15", "port": 5432}
  ],
  "cacheStores": ["e.g., Redis, Memcached"],
  "messageQueues": ["e.g., RabbitMQ, Kafka"],
  "baseImage": "recommended Docker base image (e.g., node:20-alpine, python:3.11-slim)",
  "buildSteps": ["array of build commands in order"],
  "runCommand": "command to start the application",
  "exposedPorts": [3000, 8080],
  "environmentVariables": {
    "NODE_ENV": "production",
    "PORT": "3000"
  },
  "projectType": "frontend-only | backend-only | fullstack | monorepo | library | cli-tool",
  "isMonorepo": false,
  "workspaces": [
    {"path": "apps/frontend", "type": "frontend", "framework": "React"}
  ],
  "frontend": {
    "framework": "React",
    "variant": "Vite",
    "buildOutputDir": "dist",
    "serveCommand": "npm start",
    "buildCommand": "npm run build",
    "devPort": 3000
  },
  "backend": {
    "framework": "Express",
    "language": "JavaScript",
    "entryPoint": "src/index.js",
    "port": 3000,
    "dependencies": ["express", "mongoose", "dotenv"]
  },
  "confidence": 0.95,
  "reasoning": "Detected React with Vite based on package.json dependencies and vite.config.ts. Build output configured to 'dist' directory.",
  "detectedFiles": ["package.json", "vite.config.ts", "tsconfig.json"]
}
\`\`\`

CRITICAL REQUIREMENTS:
1. Analyze ALL provided files and directory structure carefully
2. Identify the EXACT tech stack - don't guess, use evidence from files
3. For frontend frameworks, detect the EXACT build output directory (dist, build, out, .next, etc.)
4. Recommend optimal Docker base image and configuration
5. Provide accurate build and run commands
6. Set confidence between 0-1 based on evidence quality
7. Include reasoning explaining your detection logic
8. List all files that contributed to your detection

RESPOND ONLY WITH THE JSON OBJECT - NO OTHER TEXT.`;
    }

    /**
     * Detect using Claude API
     */
    private async detectWithClaude(prompt: string): Promise<string> {
        if (!this.anthropicClient) {
            throw new Error('Claude client not initialized');
        }
        
        console.log('[AITechStackDetector] Using Claude for detection...');
        
        const response = await this.anthropicClient.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: prompt
            }]
        });
        
        const content = response.content[0];
        if (content.type === 'text') {
            return content.text;
        }
        
        throw new Error('Unexpected response format from Claude');
    }

    /**
     * Detect using Gemini API
     */
    private async detectWithGemini(prompt: string): Promise<string> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }
        
        console.log('[AITechStackDetector] Using Gemini for detection...');
        
        const model = this.geminiClient.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
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
     * Parse AI response to extract tech stack info
     */
    private parseAIResponse(response: string): AIDetectedTechStack {
        try {
            // Extract JSON from markdown code blocks if present
            let jsonStr = response.trim();
            
            // Remove markdown code fences
            jsonStr = jsonStr.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
            
            // Parse JSON
            const parsed = JSON.parse(jsonStr);
            
            // Validate required fields
            if (!parsed.primaryLanguage || !parsed.primaryRuntime || !parsed.projectType) {
                throw new Error('Missing required fields in AI response');
            }
            
            return parsed as AIDetectedTechStack;
            
        } catch (error) {
            console.error('[AITechStackDetector] Failed to parse AI response:', error);
            console.error('Response was:', response);
            
            // Return a fallback detection
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
