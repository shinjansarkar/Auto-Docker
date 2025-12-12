/**
 * Comprehensive Codebase Analyzer
 * Recursively scans the entire workspace to build a complete analysis object
 * for accurate Dockerfile generation by Gemini AI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface ComprehensiveAnalysis {
    // Project Structure
    projectRoot: string;
    isMonorepo: boolean;
    workspaces?: string[];

    // Frontend Detection
    frontends: Array<{
        path: string;
        framework: string;
        variant?: string;
        version?: string;
        packageManager: 'npm' | 'yarn' | 'pnpm';
        buildTool?: string;
        buildCommand?: string;
        outputFolder: string;
        port?: number;
        dependencies: Record<string, string>;
        devDependencies: Record<string, string>;
        scripts: Record<string, string>;
        hasTypeScript: boolean;
        hasESLint: boolean;
        hasPrettier: boolean;
        envFiles: string[];
    }>;

    // Backend Detection
    backends: Array<{
        path: string;
        framework: string;
        language: 'node' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'ruby' | 'elixir' | 'rust';
        version?: string;
        packageManager?: string;
        dependencies: Record<string, any>;
        mainFile?: string;
        port?: number;
        hasTests: boolean;
        envFiles: string[];
    }>;

    // Database Detection
    databases: Array<{
        type: string;
        version?: string;
        configFile?: string;
        connectionString?: string;
    }>;

    // Additional Services
    services: {
        redis?: { version?: string };
        elasticsearch?: { version?: string };
        rabbitmq?: { version?: string };
        kafka?: { version?: string };
        nginx?: { configPath?: string; exists: boolean };
        pm2?: { configPath?: string; exists: boolean };
    };

    // Build Tools & Monorepo Tools
    buildTools: {
        turbo?: { configPath?: string };
        nx?: { configPath?: string };
        lerna?: { configPath?: string };
        rush?: { configPath?: string };
    };

    // Environment Variables
    environmentVariables: {
        files: string[];
        variables: Record<string, string>;
        requiredVars: string[];
    };

    // Docker Files (existing)
    existingDockerFiles: {
        dockerfile?: string;
        dockerCompose?: string;
        dockerignore?: string;
        nginxConf?: string;
    };

    // Special Configurations
    specialConfigs: {
        hasPrisma: boolean;
        hasGraphQL: boolean;
        hasWebSocket: boolean;
        hasAuth: boolean;
        hasORM: boolean;
        ormType?: string;
    };

    // File Structure
    fileStructure: {
        srcDir?: string;
        publicDir?: string;
        buildDir?: string;
        testDir?: string;
    };
}

export class ComprehensiveAnalyzer {
    private basePath: string;
    private outputChannel?: vscode.OutputChannel;

    constructor(basePath: string, outputChannel?: vscode.OutputChannel) {
        this.basePath = basePath;
        this.outputChannel = outputChannel;
    }

    /**
     * Main analysis method - scans entire workspace recursively
     */
    async analyze(): Promise<ComprehensiveAnalysis> {
        this.log('🔍 Starting comprehensive workspace analysis...');

        const analysis: ComprehensiveAnalysis = {
            projectRoot: this.basePath,
            isMonorepo: false,
            frontends: [],
            backends: [],
            databases: [],
            services: {},
            buildTools: {},
            environmentVariables: {
                files: [],
                variables: {},
                requiredVars: []
            },
            existingDockerFiles: {},
            specialConfigs: {
                hasPrisma: false,
                hasGraphQL: false,
                hasWebSocket: false,
                hasAuth: false,
                hasORM: false
            },
            fileStructure: {}
        };

        // Step 1: Detect if monorepo
        analysis.isMonorepo = await this.detectMonorepo();
        this.log(`📦 Monorepo: ${analysis.isMonorepo}`);

        // Step 2: Detect build tools
        analysis.buildTools = await this.detectBuildTools();

        // Step 3: Get all project directories (root + workspaces)
        const projectDirs = await this.getAllProjectDirectories();
        this.log(`📁 Found ${projectDirs.length} project director${projectDirs.length === 1 ? 'y' : 'ies'}`);

        // Step 4: Scan each directory for frontend/backend
        for (const dir of projectDirs) {
            await this.scanDirectory(dir, analysis);
        }

        // Step 5: Detect databases
        analysis.databases = await this.detectDatabases();

        // Step 6: Detect additional services
        analysis.services = await this.detectServices();

        // Step 7: Scan environment variables
        analysis.environmentVariables = await this.scanEnvironmentVariables();

        // Step 8: Detect existing Docker files
        analysis.existingDockerFiles = await this.detectExistingDockerFiles();

        // Step 9: Detect special configurations
        analysis.specialConfigs = await this.detectSpecialConfigs(analysis);

        // Step 10: Analyze file structure
        analysis.fileStructure = await this.analyzeFileStructure();

        this.log('✅ Comprehensive analysis complete!');
        return analysis;
    }

    /**
     * Detect if project is a monorepo
     */
    private async detectMonorepo(): Promise<boolean> {
        // Check for package.json with workspaces
        const packageJsonPath = path.join(this.basePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.workspaces) {
                return true;
            }
        }

        // Check for pnpm-workspace.yaml
        if (fs.existsSync(path.join(this.basePath, 'pnpm-workspace.yaml'))) {
            return true;
        }

        // Check for lerna.json
        if (fs.existsSync(path.join(this.basePath, 'lerna.json'))) {
            return true;
        }

        // Check for nx.json
        if (fs.existsSync(path.join(this.basePath, 'nx.json'))) {
            return true;
        }

        // Check for turbo.json
        if (fs.existsSync(path.join(this.basePath, 'turbo.json'))) {
            return true;
        }

        // Check for common monorepo folder patterns
        const monorepoFolders = ['apps', 'packages', 'services', 'projects'];
        for (const folder of monorepoFolders) {
            const folderPath = path.join(this.basePath, folder);
            if (fs.existsSync(folderPath)) {
                const entries = fs.readdirSync(folderPath);
                // If has multiple subdirectories, likely a monorepo
                const subdirs = entries.filter(e => {
                    const fullPath = path.join(folderPath, e);
                    return fs.statSync(fullPath).isDirectory();
                });
                if (subdirs.length >= 2) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Detect build tools (Turbo, Nx, Lerna, etc.)
     */
    private async detectBuildTools(): Promise<ComprehensiveAnalysis['buildTools']> {
        const tools: ComprehensiveAnalysis['buildTools'] = {};

        if (fs.existsSync(path.join(this.basePath, 'turbo.json'))) {
            tools.turbo = { configPath: 'turbo.json' };
        }

        if (fs.existsSync(path.join(this.basePath, 'nx.json'))) {
            tools.nx = { configPath: 'nx.json' };
        }

        if (fs.existsSync(path.join(this.basePath, 'lerna.json'))) {
            tools.lerna = { configPath: 'lerna.json' };
        }

        if (fs.existsSync(path.join(this.basePath, 'rush.json'))) {
            tools.rush = { configPath: 'rush.json' };
        }

        return tools;
    }

    /**
     * Get all project directories to scan (root + workspaces)
     */
    private async getAllProjectDirectories(): Promise<string[]> {
        const dirs: string[] = [];

        // Always scan root
        dirs.push(this.basePath);

        // Common monorepo patterns to scan
        const patterns = [
            'apps/*',
            'packages/*',
            'services/*',
            'projects/*',
            'modules/*',
            'workspaces/*',
            'libs/*',
            'components/*',
            'microservices/*',
            'functions/*',
            'apis/*'
        ];

        for (const pattern of patterns) {
            const [baseDir, _] = pattern.split('/');
            const baseDirPath = path.join(this.basePath, baseDir);

            if (fs.existsSync(baseDirPath) && fs.statSync(baseDirPath).isDirectory()) {
                const entries = fs.readdirSync(baseDirPath);
                for (const entry of entries) {
                    const fullPath = path.join(baseDirPath, entry);
                    if (fs.statSync(fullPath).isDirectory()) {
                        dirs.push(fullPath);

                        // Recursively scan subdirectories (up to 2 levels deep)
                        const subEntries = fs.readdirSync(fullPath);
                        for (const subEntry of subEntries) {
                            const subPath = path.join(fullPath, subEntry);
                            if (fs.statSync(subPath).isDirectory()) {
                                dirs.push(subPath);
                            }
                        }
                    }
                }
            }
        }

        return [...new Set(dirs)]; // Remove duplicates
    }

    /**
     * Scan a directory for frontend/backend indicators
     */
    private async scanDirectory(dirPath: string, analysis: ComprehensiveAnalysis): Promise<void> {
        const relativePath = path.relative(this.basePath, dirPath);

        // Check for frontend
        const frontend = await this.detectFrontendInDir(dirPath, relativePath);
        if (frontend) {
            analysis.frontends.push(frontend);
            this.log(`  ✅ Frontend detected: ${relativePath} (${frontend.framework})`);
        }

        // Check for backend
        const backend = await this.detectBackendInDir(dirPath, relativePath);
        if (backend) {
            analysis.backends.push(backend);
            this.log(`  ✅ Backend detected: ${relativePath} (${backend.framework})`);
        }
    }

    /**
     * Detect frontend framework in a directory
     */
    private async detectFrontendInDir(dirPath: string, relativePath: string): Promise<ComprehensiveAnalysis['frontends'][0] | null> {
        const packageJsonPath = path.join(dirPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            return null;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Detect frontend frameworks
        let framework: string | null = null;
        let variant: string | undefined;
        let outputFolder = 'dist';

        if (deps['next']) {
            framework = 'nextjs';
            outputFolder = '.next';
            if (packageJson.scripts?.build?.includes('export')) {
                variant = 'static';
                outputFolder = 'out';
            } else {
                variant = 'ssr';
            }
        } else if (deps['react']) {
            framework = 'react';
            if (deps['vite']) {
                variant = 'vite';
                outputFolder = 'dist';
            } else if (deps['react-scripts']) {
                variant = 'cra';
                outputFolder = 'build';
            } else {
                variant = 'custom';
            }
        } else if (deps['vue']) {
            framework = 'vue';
            outputFolder = 'dist';
        } else if (deps['@angular/core']) {
            framework = 'angular';
            outputFolder = 'dist/' + (packageJson.name || 'app');
        } else if (deps['svelte']) {
            framework = 'svelte';
            if (deps['@sveltejs/kit']) {
                variant = 'sveltekit';
                outputFolder = 'build';
            } else {
                outputFolder = 'public';
            }
        }

        if (!framework) {
            return null;
        }

        // Detect package manager
        let packageManager: 'npm' | 'yarn' | 'pnpm' = 'npm';
        if (fs.existsSync(path.join(dirPath, 'yarn.lock'))) {
            packageManager = 'yarn';
        } else if (fs.existsSync(path.join(dirPath, 'pnpm-lock.yaml'))) {
            packageManager = 'pnpm';
        }

        // Get env files
        const envFiles = this.getEnvFiles(dirPath);

        return {
            path: relativePath || '.',
            framework,
            variant,
            version: deps[framework === 'nextjs' ? 'next' : framework],
            packageManager,
            buildTool: deps['vite'] ? 'vite' : deps['webpack'] ? 'webpack' : undefined,
            buildCommand: packageJson.scripts?.build || 'npm run build',
            outputFolder,
            port: this.extractPort(packageJson),
            dependencies: packageJson.dependencies || {},
            devDependencies: packageJson.devDependencies || {},
            scripts: packageJson.scripts || {},
            hasTypeScript: !!deps['typescript'],
            hasESLint: !!deps['eslint'],
            hasPrettier: !!deps['prettier'],
            envFiles
        };
    }

    /**
     * Detect backend framework in a directory
     */
    private async detectBackendInDir(dirPath: string, relativePath: string): Promise<ComprehensiveAnalysis['backends'][0] | null> {
        // Node.js backend
        const packageJsonPath = path.join(dirPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            let framework: string | null = null;

            if (deps['express']) framework = 'express';
            else if (deps['@nestjs/core']) framework = 'nestjs';
            else if (deps['koa']) framework = 'koa';
            else if (deps['fastify']) framework = 'fastify';
            else if (deps['hapi']) framework = 'hapi';

            if (framework) {
                return {
                    path: relativePath || '.',
                    framework,
                    language: 'node',
                    version: deps[framework],
                    packageManager: fs.existsSync(path.join(dirPath, 'yarn.lock')) ? 'yarn' : 'npm',
                    dependencies: packageJson.dependencies || {},
                    mainFile: packageJson.main || 'index.js',
                    port: this.extractPort(packageJson),
                    hasTests: !!packageJson.scripts?.test,
                    envFiles: this.getEnvFiles(dirPath)
                };
            }
        }

        // Python backend
        if (fs.existsSync(path.join(dirPath, 'requirements.txt')) ||
            fs.existsSync(path.join(dirPath, 'Pipfile')) ||
            fs.existsSync(path.join(dirPath, 'pyproject.toml'))) {

            let framework = 'python';
            const reqPath = path.join(dirPath, 'requirements.txt');

            if (fs.existsSync(reqPath)) {
                const requirements = fs.readFileSync(reqPath, 'utf8');
                if (requirements.includes('fastapi')) framework = 'fastapi';
                else if (requirements.includes('django')) framework = 'django';
                else if (requirements.includes('flask')) framework = 'flask';
            }

            return {
                path: relativePath || '.',
                framework,
                language: 'python',
                dependencies: {},
                hasTests: fs.existsSync(path.join(dirPath, 'tests')),
                envFiles: this.getEnvFiles(dirPath)
            };
        }

        // Java backend
        if (fs.existsSync(path.join(dirPath, 'pom.xml')) ||
            fs.existsSync(path.join(dirPath, 'build.gradle'))) {
            return {
                path: relativePath || '.',
                framework: 'spring-boot',
                language: 'java',
                dependencies: {},
                hasTests: fs.existsSync(path.join(dirPath, 'src/test')),
                envFiles: this.getEnvFiles(dirPath)
            };
        }

        // Go backend
        if (fs.existsSync(path.join(dirPath, 'go.mod'))) {
            const goMod = fs.readFileSync(path.join(dirPath, 'go.mod'), 'utf8');
            let framework = 'go';
            if (goMod.includes('gin-gonic/gin')) framework = 'gin';
            else if (goMod.includes('gofiber/fiber')) framework = 'fiber';

            return {
                path: relativePath || '.',
                framework,
                language: 'go',
                dependencies: {},
                hasTests: true,
                envFiles: this.getEnvFiles(dirPath)
            };
        }

        return null;
    }

    /**
     * Detect databases from environment files and docker-compose
     */
    private async detectDatabases(): Promise<ComprehensiveAnalysis['databases']> {
        const databases: ComprehensiveAnalysis['databases'] = [];
        const envFiles = this.getAllEnvFiles();

        for (const envFile of envFiles) {
            const content = fs.readFileSync(envFile, 'utf8');

            if (content.match(/POSTGRES|PG_|DATABASE_URL.*postgres/i)) {
                databases.push({ type: 'postgres' });
            }
            if (content.match(/MYSQL|MARIADB/i)) {
                databases.push({ type: 'mysql' });
            }
            if (content.match(/MONGODB|MONGO_URL/i)) {
                databases.push({ type: 'mongodb' });
            }
            if (content.match(/REDIS/i)) {
                databases.push({ type: 'redis' });
            }
        }

        // Check docker-compose for database services
        const composeFiles = ['docker-compose.yml', 'docker-compose.yaml'];
        for (const file of composeFiles) {
            const composePath = path.join(this.basePath, file);
            if (fs.existsSync(composePath)) {
                const content = fs.readFileSync(composePath, 'utf8');
                if (content.includes('image: postgres')) databases.push({ type: 'postgres' });
                if (content.includes('image: mysql') || content.includes('image: mariadb')) databases.push({ type: 'mysql' });
                if (content.includes('image: mongo')) databases.push({ type: 'mongodb' });
                if (content.includes('image: redis')) databases.push({ type: 'redis' });
            }
        }

        // Remove duplicates
        return Array.from(new Set(databases.map(db => db.type)))
            .map(type => ({ type }));
    }

    /**
     * Detect additional services
     */
    private async detectServices(): Promise<ComprehensiveAnalysis['services']> {
        const services: ComprehensiveAnalysis['services'] = {};

        // Check for nginx.conf
        const nginxPaths = ['nginx.conf', 'config/nginx.conf', 'conf/nginx.conf'];
        for (const nginxPath of nginxPaths) {
            const fullPath = path.join(this.basePath, nginxPath);
            if (fs.existsSync(fullPath)) {
                services.nginx = { configPath: nginxPath, exists: true };
                break;
            }
        }

        // Check for PM2
        const pm2Paths = ['ecosystem.config.js', 'pm2.config.js', 'process.json'];
        for (const pm2Path of pm2Paths) {
            const fullPath = path.join(this.basePath, pm2Path);
            if (fs.existsSync(fullPath)) {
                services.pm2 = { configPath: pm2Path, exists: true };
                break;
            }
        }

        return services;
    }

    /**
     * Scan all environment variables
     */
    private async scanEnvironmentVariables(): Promise<ComprehensiveAnalysis['environmentVariables']> {
        const envFiles = this.getAllEnvFiles();
        const variables: Record<string, string> = {};
        const requiredVars: string[] = [];

        for (const envFile of envFiles) {
            const content = fs.readFileSync(envFile, 'utf8');
            const lines = content.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, value] = trimmed.split('=');
                    if (key) {
                        variables[key.trim()] = value?.trim() || '';
                    }
                }
            }
        }

        return {
            files: envFiles.map(f => path.relative(this.basePath, f)),
            variables,
            requiredVars
        };
    }

    /**
     * Detect existing Docker files
     */
    private async detectExistingDockerFiles(): Promise<ComprehensiveAnalysis['existingDockerFiles']> {
        const existing: ComprehensiveAnalysis['existingDockerFiles'] = {};

        if (fs.existsSync(path.join(this.basePath, 'Dockerfile'))) {
            existing.dockerfile = 'Dockerfile';
        }
        if (fs.existsSync(path.join(this.basePath, 'docker-compose.yml'))) {
            existing.dockerCompose = 'docker-compose.yml';
        } else if (fs.existsSync(path.join(this.basePath, 'docker-compose.yaml'))) {
            existing.dockerCompose = 'docker-compose.yaml';
        }
        if (fs.existsSync(path.join(this.basePath, '.dockerignore'))) {
            existing.dockerignore = '.dockerignore';
        }
        if (fs.existsSync(path.join(this.basePath, 'nginx.conf'))) {
            existing.nginxConf = 'nginx.conf';
        }

        return existing;
    }

    /**
     * Detect special configurations
     */
    private async detectSpecialConfigs(analysis: ComprehensiveAnalysis): Promise<ComprehensiveAnalysis['specialConfigs']> {
        const configs: ComprehensiveAnalysis['specialConfigs'] = {
            hasPrisma: false,
            hasGraphQL: false,
            hasWebSocket: false,
            hasAuth: false,
            hasORM: false
        };

        // Check all frontend/backend dependencies
        const allDeps = [
            ...analysis.frontends.flatMap(f => Object.keys({ ...f.dependencies, ...f.devDependencies })),
            ...analysis.backends.flatMap(b => Object.keys(b.dependencies))
        ];

        configs.hasPrisma = allDeps.includes('@prisma/client') || allDeps.includes('prisma');
        configs.hasGraphQL = allDeps.some(d => d.includes('graphql'));
        configs.hasWebSocket = allDeps.some(d => d.includes('socket.io') || d.includes('ws'));
        configs.hasAuth = allDeps.some(d => d.includes('passport') || d.includes('auth') || d.includes('jwt'));
        configs.hasORM = allDeps.some(d => d.includes('typeorm') || d.includes('sequelize') || d.includes('prisma'));

        if (configs.hasORM) {
            if (allDeps.includes('prisma')) configs.ormType = 'prisma';
            else if (allDeps.includes('typeorm')) configs.ormType = 'typeorm';
            else if (allDeps.includes('sequelize')) configs.ormType = 'sequelize';
        }

        return configs;
    }

    /**
     * Analyze file structure
     */
    private async analyzeFileStructure(): Promise<ComprehensiveAnalysis['fileStructure']> {
        const structure: ComprehensiveAnalysis['fileStructure'] = {};

        const commonDirs = ['src', 'public', 'build', 'dist', 'test', 'tests', '__tests__'];
        for (const dir of commonDirs) {
            const dirPath = path.join(this.basePath, dir);
            if (fs.existsSync(dirPath)) {
                if (dir === 'src') structure.srcDir = dir;
                else if (dir === 'public') structure.publicDir = dir;
                else if (dir === 'build' || dir === 'dist') structure.buildDir = dir;
                else if (dir.includes('test')) structure.testDir = dir;
            }
        }

        return structure;
    }

    /**
     * Helper: Get all .env files in a directory
     */
    private getEnvFiles(dirPath: string): string[] {
        const envFiles: string[] = [];
        const envPatterns = ['.env', '.env.local', '.env.development', '.env.production', '.env.example'];

        for (const pattern of envPatterns) {
            const envPath = path.join(dirPath, pattern);
            if (fs.existsSync(envPath)) {
                envFiles.push(path.relative(this.basePath, envPath));
            }
        }

        return envFiles;
    }

    /**
     * Helper: Get all .env files in entire workspace
     */
    private getAllEnvFiles(): string[] {
        const envFiles: string[] = [];
        const search = (dir: string, depth: number = 0) => {
            if (depth > 3) return; // Limit recursion depth

            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
                    search(fullPath, depth + 1);
                } else if (stat.isFile() && entry.startsWith('.env')) {
                    envFiles.push(fullPath);
                }
            }
        };

        search(this.basePath);
        return envFiles;
    }

    /**
     * Helper: Extract port from package.json scripts
     */
    private extractPort(packageJson: any): number | undefined {
        const scripts = packageJson.scripts || {};
        for (const script of Object.values(scripts) as string[]) {
            const match = script.match(/(?:--port|PORT=|:)(\d{4,5})/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return undefined;
    }

    /**
     * Helper: Log message
     */
    private log(message: string): void {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        }
        console.log(message);
    }

    /**
     * Enhanced Deep Analysis - Gemini-like code understanding
     * Analyzes project structure, dependencies, and code patterns
     * to provide accurate, context-aware Docker generation
     */
    async analyzeWithDeepIntelligence(): Promise<{
        projectType: string;
        confidence: number;
        recommendations: string[];
        detectedPatterns: string[];
    }> {
        const analysis = await this.analyze();
        
        const patterns: string[] = [];
        const recommendations: string[] = [];
        let confidence = 0.5;

        // Analyze frontend patterns
        if (analysis.frontends.length > 0) {
            const frontend = analysis.frontends[0];
            patterns.push(`Frontend: ${frontend.framework} (${frontend.variant || 'standard'})`);
            patterns.push(`Build output: ${frontend.outputFolder}`);
            patterns.push(`Package manager: ${frontend.packageManager}`);
            
            // Check if build command is custom
            if (frontend.buildCommand) {
                patterns.push(`Custom build: ${frontend.buildCommand}`);
            }
            
            // Detect SPA vs SSR
            if (['nextjs', 'nuxt', 'sveltekit'].includes(frontend.framework.toLowerCase())) {
                patterns.push('SSR Framework detected - requires Node.js runtime');
                recommendations.push('Use Node.js server (port 3000), NOT nginx for serving');
            } else {
                patterns.push('SPA Framework detected - static build output');
                recommendations.push('Use multi-stage build with nginx:stable-alpine');
                recommendations.push('Embed nginx config in Dockerfile (no external nginx.conf)');
            }
            
            confidence += 0.3;
        }

        // Analyze backend patterns
        if (analysis.backends.length > 0) {
            const backend = analysis.backends[0];
            patterns.push(`Backend: ${backend.framework} (${backend.language})`);
            
            if (backend.port) {
                patterns.push(`Detected port: ${backend.port}`);
            }
            
            // Language-specific recommendations
            switch (backend.language) {
                case 'python':
                    recommendations.push('Install production WSGI/ASGI server (gunicorn/uvicorn)');
                    recommendations.push('Use Python slim/alpine base image');
                    break;
                case 'node':
                    recommendations.push('Use multi-stage build for smaller image');
                    recommendations.push('Install only production dependencies in final stage');
                    break;
                case 'go':
                    recommendations.push('Use multi-stage build with scratch/alpine final image');
                    recommendations.push('Compile with CGO_ENABLED=0 for static binary');
                    break;
            }
            
            confidence += 0.3;
        }

        // Full-stack detection
        if (analysis.frontends.length > 0 && analysis.backends.length > 0) {
            patterns.push('Full-stack project detected');
            recommendations.push('Use nginx as reverse proxy');
            recommendations.push('Generate separate Dockerfiles for frontend and backend');
            recommendations.push('Only nginx should expose port 80 to host');
            recommendations.push('Frontend and backend communicate via internal Docker network');
            confidence = 0.9;
        } else if (analysis.frontends.length > 0) {
            patterns.push('Frontend-only project detected');
            recommendations.push('Single container architecture');
            recommendations.push('Docker Compose: one service on port 80');
            confidence = 0.85;
        } else if (analysis.backends.length > 0) {
            patterns.push('Backend-only (API) project detected');
            recommendations.push('Direct port exposure (no nginx needed)');
            recommendations.push('Include health check endpoint');
            confidence = 0.85;
        }

        // Database detection
        if (analysis.databases.length > 0) {
            patterns.push(`Databases: ${analysis.databases.map(d => d.type).join(', ')}`);
            recommendations.push('Use named volumes for database persistence');
            recommendations.push('Include depends_on in application services');
        }

        // Monorepo detection
        if (analysis.isMonorepo) {
            patterns.push('Monorepo structure detected');
            if (analysis.buildTools.turbo) {
                patterns.push('Using Turborepo for build orchestration');
            }
            if (analysis.buildTools.nx) {
                patterns.push('Using Nx for build orchestration');
            }
            recommendations.push('Generate per-service Dockerfiles');
            recommendations.push('Use Docker Compose with shared network');
            confidence = 0.95;
        }

        // Special configurations
        if (analysis.specialConfigs.hasPrisma) {
            patterns.push('Prisma ORM detected');
            recommendations.push('Run prisma generate during Docker build');
        }
        
        if (analysis.specialConfigs.hasGraphQL) {
            patterns.push('GraphQL API detected');
        }
        
        if (analysis.specialConfigs.hasWebSocket) {
            patterns.push('WebSocket support detected');
            recommendations.push('Configure nginx for WebSocket proxy (if using nginx)');
        }

        // Determine project type
        let projectType = 'unknown';
        if (analysis.frontends.length > 0 && analysis.backends.length > 0) {
            projectType = 'fullstack';
        } else if (analysis.frontends.length > 0) {
            projectType = 'frontend';
        } else if (analysis.backends.length > 0) {
            projectType = 'backend';
        }

        return {
            projectType,
            confidence: Math.min(confidence, 1.0),
            recommendations,
            detectedPatterns: patterns
        };
    }
}
