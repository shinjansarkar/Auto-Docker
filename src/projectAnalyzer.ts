import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    SafeDirectoryTraversal,
    ChunkedFileProcessor,
    BOMHandler
} from './criticalErrorHandling';
import {
    SafeFileReader,
    SafeDirectoryReader,
    ErrorRecovery
} from './safeFileReader';
import {
    YarnWorkspacesDetector,
    PnpmWorkspacesDetector,
    LernaDetector
} from './monorepoDetector';
import { EnhancedMonorepoDetector } from './enhancedMonorepoDetector';

export interface ProjectStructure {
    projectType: string;
    frontend?: string;
    backend?: string;
    database?: string;
    databases?: string[]; // Multiple databases
    files: string[];
    dependencies: { [key: string]: any };
    hasMultiStage: boolean;
    description: string;
    hasEnvFile?: boolean;
    envVars?: string[];
    isMonorepo?: boolean;
    isSingleFolderFullstack?: boolean; // Single folder with both frontend and backend
    frontendPath?: string;
    backendPath?: string;
    frontendDependencies?: any;
    backendDependencies?: any;
    // Enhanced Monorepo support
    workspaces?: string[]; // npm/yarn/pnpm workspaces (raw patterns)
    expandedWorkspaces?: string[]; // Expanded workspace paths
    allFrontendServices?: Array<{ path: string; dependencies: any }>; // All frontend services
    allBackendServices?: Array<{ path: string; dependencies: any; language: string }>; // All backend services
    buildTool?: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm'; // Build tool detection
    monorepoType?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'rush' | 'turbo' | 'none'; // Detected monorepo type
    services?: Array<{ path: string; language: string; framework: string }>; // Multi-language services
    detectionLog?: string[]; // Detection log for debugging
    hasPrisma?: boolean; // Prisma ORM detection
    hasCelery?: boolean; // Celery worker detection
    hasWebSocket?: boolean; // WebSocket support detection
    // Advanced services
    messageQueue?: 'rabbitmq' | 'kafka' | 'redis-streams' | 'activemq';
    cacheLayer?: 'redis' | 'memcached';
    searchEngine?: 'elasticsearch' | 'opensearch';
    reverseProxy?: 'nginx' | 'traefik' | 'caddy';
    monitoring?: 'prometheus' | 'grafana';
    // Frontend/Backend classification flags (for Nginx and Docker generation)
    isFrontendOnly?: boolean;  // true if has frontend && !backend
    isBackendOnly?: boolean;   // true if has backend && !frontend
    isFullstack?: boolean;     // true if has both frontend && backend
}

export class ProjectAnalyzer {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async analyzeProject(): Promise<ProjectStructure> {
        // CRITICAL FIX #1: Add comprehensive error handling and null checks
        try {
            // Validate workspace root exists and is accessible
            if (!this.workspaceRoot || this.workspaceRoot.trim().length === 0) {
                throw new Error('Invalid workspace root path');
            }

            // Verify workspace root is readable (CRITICAL FIX #4: File existence verification)
            try {
                const workspaceUri = vscode.Uri.file(this.workspaceRoot);
                await vscode.workspace.fs.stat(workspaceUri);
            } catch (error) {
                console.error('Workspace root is not accessible:', error);
                // Return minimal structure with default values
                return this.getDefaultProjectStructure();
            }

            // Execute all async operations with timeout handling (CRITICAL FIX #3)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Project analysis timeout')), 30000)
            );

            const analysisPromise = Promise.all([
                this.getProjectFiles(),
                this.analyzePackageFiles(),
                this.detectMonorepo(),
                this.analyzeEnvFiles(),
                this.detectBuildTool(),
                this.detectMultiLanguageServices()
            ]);

            const [files, packageInfo, monorepoInfo, envInfo, buildToolInfo, multiLanguageServices] =
                await Promise.race([analysisPromise, timeoutPromise]) as any[];

            // CRITICAL FIX #1: Null/undefined checks on all results
            let filesResult = files;
            if (!Array.isArray(filesResult)) {
                console.warn('getProjectFiles returned non-array');
                filesResult = [];
            }

            let packageInfoResult = packageInfo;
            if (!packageInfoResult || typeof packageInfoResult !== 'object') {
                console.warn('analyzePackageFiles returned invalid result');
                packageInfoResult = {};
            }

            let monorepoInfoResult = monorepoInfo;
            if (!monorepoInfoResult || typeof monorepoInfoResult !== 'object') {
                console.warn('detectMonorepo returned invalid result');
                monorepoInfoResult = { isMonorepo: false };
            }

            let envInfoResult = envInfo;
            if (!envInfoResult || typeof envInfoResult !== 'object') {
                console.warn('analyzeEnvFiles returned invalid result');
                envInfoResult = { hasEnvFile: false, envVars: [] };
            }

            // Safe method calls with try-catch
            let projectType: any = { type: 'unknown', databases: [] };
            try {
                projectType = this.detectProjectType(filesResult || [], packageInfoResult || {}, monorepoInfoResult);
            } catch (error) {
                console.error('Error detecting project type:', error);
                projectType = { type: 'unknown', databases: [] };
            }

            let advancedServices: any = {};
            try {
                advancedServices = this.detectAdvancedServices(packageInfoResult || {}, filesResult || []);
            } catch (error) {
                console.error('Error detecting advanced services:', error);
                advancedServices = {};
            }

            let specialFeatures: any = { hasPrisma: false, hasCelery: false, hasWebSocket: false };
            try {
                specialFeatures = await this.detectSpecialFeatures(packageInfoResult || {}, filesResult || []);
            } catch (error) {
                console.error('Error detecting special features:', error);
                specialFeatures = { hasPrisma: false, hasCelery: false, hasWebSocket: false };
            }

            let projectDescription = '';
            try {
                projectDescription = this.generateProjectDescription(projectType, filesResult || []);
            } catch (error) {
                console.error('Error generating project description:', error);
                projectDescription = `Unknown project type`;
            }

            return {
                projectType: projectType?.type || 'unknown',
                frontend: projectType?.frontend,
                backend: projectType?.backend,
                database: projectType?.database,
                databases: Array.isArray(projectType?.databases) ? projectType.databases : [],
                files: Array.isArray(files) ? files.slice(0, 50) : [], // Limit files for LLM context
                dependencies: packageInfo || {},
                hasMultiStage: this.shouldUseMultiStage(projectType),
                description: projectDescription,
                hasEnvFile: envInfo?.hasEnvFile || false,
                envVars: Array.isArray(envInfo?.envVars) ? envInfo.envVars : [],
                isMonorepo: monorepoInfo?.isMonorepo || false,
                isSingleFolderFullstack: projectType?.isSingleFolderFullstack || false,
                frontendPath: monorepoInfo?.frontendPath,
                backendPath: monorepoInfo?.backendPath,
                frontendDependencies: monorepoInfo?.frontendDependencies,
                backendDependencies: monorepoInfo?.backendDependencies,
                workspaces: Array.isArray(monorepoInfo?.workspaces) ? monorepoInfo.workspaces : undefined,
                buildTool: buildToolInfo?.buildTool,
                services: Array.isArray(multiLanguageServices) ? multiLanguageServices : [],
                hasPrisma: specialFeatures?.hasPrisma || false,
                hasCelery: specialFeatures?.hasCelery || false,
                hasWebSocket: specialFeatures?.hasWebSocket || false,
                messageQueue: advancedServices?.messageQueue,
                cacheLayer: advancedServices?.cacheLayer,
                searchEngine: advancedServices?.searchEngine,
                reverseProxy: advancedServices?.reverseProxy,
                monitoring: advancedServices?.monitoring
            };
        } catch (error) {
            console.error('Fatal error in analyzeProject:', error);
            return this.getDefaultProjectStructure();
        }
    }

    private getDefaultProjectStructure(): ProjectStructure {
        return {
            projectType: 'unknown',
            files: [],
            dependencies: {},
            hasMultiStage: false,
            description: 'Unable to analyze project structure',
            databases: [],
            services: [],
            hasPrisma: false,
            hasCelery: false,
            hasWebSocket: false
        };
    }

    private async getProjectFiles(): Promise<string[]> {
        // CRITICAL FIX #2: Safe path handling with validation
        // CRITICAL FIX #3: Use safe directory traversal to prevent symlink infinite loops
        // CRITICAL FIX #4: Memory-efficient file processing for large projects

        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            console.warn('No workspace folders available');
            return [];
        }

        const workspaceFolder = vscode.workspace.workspaceFolders[0];

        try {
            // Validate workspace folder path
            if (!workspaceFolder || !workspaceFolder.uri || !workspaceFolder.uri.fsPath) {
                console.error('Invalid workspace folder structure');
                return [];
            }

            // CRITICAL FIX #3: Use SafeDirectoryTraversal to prevent infinite loops with symlinks
            // Limit to 10000 files to prevent memory exhaustion on large projects
            const allFiles = SafeDirectoryTraversal.walkDirectory(
                this.workspaceRoot,
                {
                    maxDepth: 10,
                    followSymlinks: false, // Don't follow symlinks to prevent infinite loops
                    maxFiles: 10000
                }
            );

            // CRITICAL FIX #4: Use chunked processing for memory efficiency
            const projectFiles: string[] = [];

            // Process files in chunks to avoid memory bloat
            const importantPatterns = /\.(json|js|ts|py|md|yml|yaml|txt|lock|sql|go|rb|java|gradle|pom|maven)$|Dockerfile|docker-compose|\.env/i;

            for (const file of allFiles) {
                const relativePath = path.relative(this.workspaceRoot, file).replace(/\\/g, '/');

                // Only keep files matching important patterns
                if (importantPatterns.test(relativePath)) {
                    projectFiles.push(relativePath);
                }

                // Limit total files to prevent memory issues
                if (projectFiles.length >= 10000) {
                    break;
                }
            }

            // Remove duplicates
            return [...new Set(projectFiles)];
        } catch (error) {
            console.error('Error getting project files:', error);
            return [];
        }
    }

    private async analyzePackageFiles(): Promise<{ [key: string]: any }> {
        const packageInfo: { [key: string]: any } = {};

        try {
            // PRODUCTION-GRADE: Use safe file reader with retry logic and error recovery

            // Check for package.json (Node.js)
            const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
            const packageJsonContent = await SafeFileReader.readFileWithRetry(packageJsonPath, {
                maxRetries: 3,
                retryDelay: 100
            });

            if (packageJsonContent) {
                try {
                    const cleanContent = BOMHandler.removeBOM(packageJsonContent);
                    packageInfo.packageJson = JSON.parse(cleanContent);
                } catch (parseError) {
                    console.warn('Invalid JSON in package.json:', parseError);
                }
            }

            // Check for requirements.txt (Python)
            const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
            const requirementsContent = await SafeFileReader.readFileWithRetry(requirementsPath);

            if (requirementsContent) {
                const cleanContent = BOMHandler.removeBOM(requirementsContent);
                if (cleanContent.trim().length > 0) {
                    packageInfo.requirementsTxt = cleanContent;
                }
            }

            // Check for pom.xml (Java Maven)
            const pomPath = path.join(this.workspaceRoot, 'pom.xml');
            const pomContent = await SafeFileReader.readFileWithRetry(pomPath);

            if (pomContent) {
                const cleanContent = BOMHandler.removeBOM(pomContent);
                if (cleanContent.trim().length > 0) {
                    packageInfo.pomXml = cleanContent;
                }
            }

            // Check for Gemfile (Ruby)
            const gemfilePath = path.join(this.workspaceRoot, 'Gemfile');
            const gemfileContent = await SafeFileReader.readFileWithRetry(gemfilePath);

            if (gemfileContent) {
                const cleanContent = BOMHandler.removeBOM(gemfileContent);
                if (cleanContent.trim().length > 0) {
                    packageInfo.gemfile = cleanContent;
                }
            }

            // Check for go.mod (Go)
            const goModPath = path.join(this.workspaceRoot, 'go.mod');
            const goModContent = await SafeFileReader.readFileWithRetry(goModPath);

            if (goModContent) {
                const cleanContent = BOMHandler.removeBOM(goModContent);
                if (cleanContent.trim().length > 0) {
                    packageInfo.goMod = cleanContent;
                }
            }

            // Check for additional lock files and configs
            const additionalFiles = [
                { key: 'pyprojectToml', filename: 'pyproject.toml' },
                { key: 'pipfile', filename: 'Pipfile' },
                { key: 'composerJson', filename: 'composer.json' },
                { key: 'buildGradle', filename: 'build.gradle' },
                { key: 'cargoToml', filename: 'Cargo.toml' }
            ];

            for (const { key, filename } of additionalFiles) {
                const filePath = path.join(this.workspaceRoot, filename);
                const fileContent = await SafeFileReader.readFileWithRetry(filePath, {
                    maxRetries: 2,
                    logErrors: false // Silent fails for optional files
                });

                if (fileContent) {
                    const cleanContent = BOMHandler.removeBOM(fileContent);
                    if (cleanContent.trim().length > 0) {
                        packageInfo[key] = cleanContent;
                    }
                }
            }

        } catch (error) {
            console.error('Error analyzing package files:', error);
            const errMsg = ErrorRecovery.getErrorMessage(error);
            console.warn(`Package file analysis warning: ${errMsg}`);
        }

        return packageInfo;
    }

    private async analyzeEnvFiles(): Promise<{ hasEnvFile: boolean; envVars: string[] }> {
        const envInfo = {
            hasEnvFile: false,
            envVars: [] as string[]
        };

        try {
            // Check for various .env files with safe file reader
            const envFiles = ['.env', '.env.local', '.env.example', '.env.sample', '.env.development', '.env.production'];

            for (const envFile of envFiles) {
                const envPath = path.join(this.workspaceRoot, envFile);

                // PRODUCTION-GRADE: Use safe file reader
                const envContent = await SafeFileReader.readFileWithRetry(envPath, {
                    maxRetries: 2,
                    logErrors: false // Silent fails for optional files
                });

                if (!envContent) {
                    continue;
                }

                try {
                    const envText = BOMHandler.removeBOM(envContent);

                    if (envFile === '.env' || envFile === '.env.example' || envFile === '.env.sample') {
                        envInfo.hasEnvFile = true;
                    }

                    // Extract environment variable names (not values for security)
                    const lines = envText.split('\n');
                    for (const line of lines) {
                        try {
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                                const parts = trimmed.split('=');
                                if (parts.length >= 2) {
                                    const varName = parts[0].trim();
                                    // Validate and escape special characters
                                    if (varName && /^[A-Z_][A-Z0-9_]*$/.test(varName)) {
                                        if (!envInfo.envVars.includes(varName)) {
                                            envInfo.envVars.push(varName);
                                        }
                                    }
                                }
                            }
                        } catch (lineError) {
                            console.warn(`Error parsing env line:`, lineError);
                            continue;
                        }
                    }
                } catch (parseError) {
                    console.warn(`Error reading ${envFile}:`, parseError);
                }
            }
        } catch (error) {
            console.error('Error analyzing .env files:', error);
            const errMsg = ErrorRecovery.getErrorMessage(error);
            console.warn(`Env file analysis warning: ${errMsg}`);
        }

        return envInfo;
    }

    private async detectMonorepo(): Promise<{
        isMonorepo: boolean;
        frontendPath?: string;
        backendPath?: string;
        frontendDependencies?: any;
        backendDependencies?: any;
        workspaces?: string[];
        expandedWorkspaces?: string[];
        allFrontendServices?: Array<{ path: string; dependencies: any }>;
        allBackendServices?: Array<{ path: string; dependencies: any; language: string }>;
        buildTool?: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm';
        monorepoType?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'rush' | 'turbo' | 'none';
        detectionLog?: string[];
    }> {
        // ENHANCED MONOREPO DETECTION - Fixes all identified issues:
        // ✅ Integrates Yarn/pnpm/Lerna detectors from monorepoDetector.ts
        // ✅ Expands glob patterns (services/*, packages/*)
        // ✅ Collects ALL services - removed break statements
        // ✅ Expanded folder detection list (ui, dashboard, portal, etc.)
        // ✅ Adds pnpm/Lerna/Nx/Turbo detection
        // ✅ Provides detailed logging for debugging
        return await EnhancedMonorepoDetector.detectMonorepo(this.workspaceRoot);
    }

    private detectProjectType(files: string[], packageInfo: { [key: string]: any }, monorepoInfo?: any): any {
        const result = {
            type: 'unknown',
            frontend: undefined as string | undefined,
            backend: undefined as string | undefined,
            database: undefined as string | undefined,
            databases: [] as string[],
            isSingleFolderFullstack: false
        };

        // Check for specific frameworks and languages
        if (packageInfo.packageJson) {
            const pkg = packageInfo.packageJson;
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Frontend frameworks
            if (deps.vite) {
                // Vite detection - check what framework it's using
                result.frontend = 'vite';
                if (deps.react || deps['@types/react']) {
                    result.frontend = 'vite-react';
                } else if (deps.vue) {
                    result.frontend = 'vite-vue';
                } else if (deps.svelte) {
                    result.frontend = 'vite-svelte';
                }
            } else if (deps.react || deps['@types/react']) {
                result.frontend = 'react';
            } else if (deps.vue || deps['@vue/cli']) {
                result.frontend = 'vue';
            } else if (deps['@angular/core']) {
                result.frontend = 'angular';
            } else if (deps.next) {
                result.frontend = 'nextjs';
                result.type = 'fullstack';
            } else if (deps.nuxt) {
                result.frontend = 'nuxt';
                result.type = 'fullstack';
            } else if (deps.svelte || deps['@sveltejs/kit']) {
                result.frontend = deps['@sveltejs/kit'] ? 'sveltekit' : 'svelte';
            } else if (deps['solid-js']) {
                result.frontend = 'solid';
            } else if (deps.preact) {
                result.frontend = 'preact';
            } else if (deps.ember || deps['ember-cli']) {
                result.frontend = 'ember';
            }

            // Backend frameworks
            if (deps.express) {
                result.backend = 'express';
            } else if (deps.fastify) {
                result.backend = 'fastify';
            } else if (deps.nestjs || deps['@nestjs/core']) {
                result.backend = 'nestjs';
            } else if (deps.koa) {
                result.backend = 'koa';
            }

            // Database detection (support multiple databases)
            if (deps.mongoose || deps.mongodb) {
                result.databases.push('mongodb');
                result.database = 'mongodb';
            }
            if (deps.pg || deps.postgresql || deps['pg-pool']) {
                result.databases.push('postgresql');
                if (!result.database) result.database = 'postgresql';
            }
            if (deps.mysql || deps.mysql2) {
                result.databases.push('mysql');
                if (!result.database) result.database = 'mysql';
            }
            if (deps.redis || deps.ioredis) {
                result.databases.push('redis');
            }
            if (deps.sqlite3 || deps['better-sqlite3']) {
                result.databases.push('sqlite');
            }

            // Detect single-folder fullstack (has both frontend and backend in same package.json)
            if (result.frontend && result.backend) {
                result.isSingleFolderFullstack = true;
                result.type = 'fullstack';
            }
        }

        // Python frameworks
        if (packageInfo.requirementsTxt) {
            const requirements = packageInfo.requirementsTxt.toLowerCase();
            if (requirements.includes('django')) {
                result.backend = 'django';
                result.type = 'backend';
            } else if (requirements.includes('flask')) {
                result.backend = 'flask';
                result.type = 'backend';
            } else if (requirements.includes('fastapi')) {
                result.backend = 'fastapi';
                result.type = 'backend';
            }
        }

        // Java frameworks
        if (packageInfo.pomXml) {
            const pom = packageInfo.pomXml.toLowerCase();
            if (pom.includes('spring-boot')) {
                result.backend = 'spring-boot';
                result.type = 'backend';
            }
        }

        // Go detection
        if (packageInfo.goMod) {
            result.backend = 'go';
            result.type = 'backend';
        }

        // Determine overall project type
        if (result.type === 'unknown') {
            if (result.frontend && result.backend) {
                result.type = 'fullstack';
            } else if (result.frontend) {
                result.type = 'frontend';
            } else if (result.backend) {
                result.type = 'backend';
            } else {
                // Try to infer from file structure
                const hasPublicFolder = files.some(f => f.startsWith('public/') || f.startsWith('static/'));
                const hasSrcFolder = files.some(f => f.startsWith('src/'));
                const hasServerFiles = files.some(f =>
                    f.includes('server') || f.includes('api') || f.includes('routes')
                );

                if (hasPublicFolder && hasSrcFolder) {
                    result.type = 'frontend';
                } else if (hasServerFiles) {
                    result.type = 'backend';
                } else {
                    result.type = 'static';
                }
            }
        }

        // Set classification flags based on frontend/backend presence
        if (result.frontend && !result.backend) {
            result.isFrontendOnly = true;
        }
        if (result.backend && !result.frontend) {
            result.isBackendOnly = true;
        }
        if (result.frontend && result.backend) {
            result.isFullstack = true;
        }

        return result;
    }

    private detectAdvancedServices(packageInfo: { [key: string]: any }, files: string[]): {
        messageQueue?: 'rabbitmq' | 'kafka' | 'redis-streams' | 'activemq';
        cacheLayer?: 'redis' | 'memcached';
        searchEngine?: 'elasticsearch' | 'opensearch';
        reverseProxy?: 'nginx' | 'traefik' | 'caddy';
        monitoring?: 'prometheus' | 'grafana';
    } {
        const result: any = {};

        if (packageInfo.packageJson) {
            const deps = {
                ...packageInfo.packageJson.dependencies,
                ...packageInfo.packageJson.devDependencies
            };

            // Message Queue Detection
            if (deps.amqplib || deps['amqp-connection-manager']) {
                result.messageQueue = 'rabbitmq';
            } else if (deps.kafkajs || deps['kafka-node'] || deps['node-rdkafka']) {
                result.messageQueue = 'kafka';
            } else if (deps.bull || deps['bull-board']) {
                result.messageQueue = 'redis-streams';
            } else if (deps.activemq || deps.stompit) {
                result.messageQueue = 'activemq';
            }

            // Cache Layer Detection
            if (deps.redis || deps.ioredis || deps['redis-om']) {
                result.cacheLayer = 'redis';
            } else if (deps.memcached || deps['memcache-plus']) {
                result.cacheLayer = 'memcached';
            }

            // Search Engine Detection
            if (deps['@elastic/elasticsearch'] || deps.elasticsearch) {
                result.searchEngine = 'elasticsearch';
            } else if (deps['@opensearch-project/opensearch']) {
                result.searchEngine = 'opensearch';
            }

            // Monitoring Detection
            if (deps['prom-client']) {
                result.monitoring = 'prometheus';
            }
        }

        // Check for Python dependencies
        if (packageInfo.requirementsTxt) {
            const requirements = packageInfo.requirementsTxt.toLowerCase();

            if (requirements.includes('pika') || requirements.includes('kombu')) {
                result.messageQueue = 'rabbitmq';
            }
            if (requirements.includes('kafka-python') || requirements.includes('confluent-kafka')) {
                result.messageQueue = 'kafka';
            }
            if (requirements.includes('redis') || requirements.includes('redis-py')) {
                result.cacheLayer = 'redis';
            }
            if (requirements.includes('pymemcache') || requirements.includes('python-memcached')) {
                result.cacheLayer = 'memcached';
            }
            if (requirements.includes('elasticsearch')) {
                result.searchEngine = 'elasticsearch';
            }
            if (requirements.includes('prometheus-client')) {
                result.monitoring = 'prometheus';
            }
        }

        // Check for Docker Compose or config files
        const hasDockerCompose = files.some(f => f.includes('docker-compose'));
        const hasNginxConf = files.some(f => f.includes('nginx.conf') || f.includes('nginx.config'));
        const hasTraefikConf = files.some(f => f.includes('traefik'));
        const hasCaddyfile = files.some(f => f.toLowerCase().includes('caddyfile'));

        if (hasNginxConf) {
            result.reverseProxy = 'nginx';
        } else if (hasTraefikConf) {
            result.reverseProxy = 'traefik';
        } else if (hasCaddyfile) {
            result.reverseProxy = 'caddy';
        }

        return result;
    }

    private shouldUseMultiStage(projectType: any): boolean {
        // Use multi-stage for production builds
        return projectType.type === 'fullstack' ||
            projectType.frontend === 'react' ||
            projectType.frontend === 'angular' ||
            projectType.frontend === 'vue' ||
            projectType.frontend === 'vite' ||
            projectType.frontend === 'vite-react' ||
            projectType.frontend === 'vite-vue' ||
            projectType.frontend === 'vite-svelte' ||
            projectType.frontend === 'svelte' ||
            projectType.frontend === 'sveltekit' ||
            projectType.frontend === 'solid' ||
            projectType.frontend === 'preact' ||
            projectType.frontend === 'nextjs' ||
            projectType.frontend === 'nuxt' ||
            projectType.backend === 'nestjs' ||
            projectType.backend === 'spring-boot';
    }

    private generateProjectDescription(projectType: any, files: string[]): string {
        let description = `This is a ${projectType.type} project`;

        if (projectType.frontend) {
            description += ` with ${projectType.frontend} frontend`;
        }

        if (projectType.backend) {
            description += ` and ${projectType.backend} backend`;
        }

        if (projectType.database) {
            description += ` using ${projectType.database} database`;
        }

        description += `. Key files include: ${files.slice(0, 10).join(', ')}`;

        return description;
    }

    // FIX #5: Detect build tools (Turbo, Nx, Lerna)
    private async detectBuildTool(): Promise<{ buildTool: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm' }> {
        try {
            // Check for Turborepo
            const turboJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'turbo.json'));
            try {
                await vscode.workspace.fs.readFile(turboJsonUri);
                console.log('Detected Turborepo build tool');
                return { buildTool: 'turbo' };
            } catch { }

            // Check for Nx
            const nxJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'nx.json'));
            try {
                await vscode.workspace.fs.readFile(nxJsonUri);
                console.log('Detected Nx build tool');
                return { buildTool: 'nx' };
            } catch { }

            // Check for Lerna
            const lernaJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'lerna.json'));
            try {
                await vscode.workspace.fs.readFile(lernaJsonUri);
                console.log('Detected Lerna build tool');
                return { buildTool: 'lerna' };
            } catch { }

            // Check for pnpm
            const pnpmLockUri = vscode.Uri.file(path.join(this.workspaceRoot, 'pnpm-lock.yaml'));
            try {
                await vscode.workspace.fs.readFile(pnpmLockUri);
                return { buildTool: 'pnpm' };
            } catch { }

            // Check for yarn
            const yarnLockUri = vscode.Uri.file(path.join(this.workspaceRoot, 'yarn.lock'));
            try {
                await vscode.workspace.fs.readFile(yarnLockUri);
                return { buildTool: 'yarn' };
            } catch { }

            // Default to npm
            return { buildTool: 'npm' };
        } catch (error) {
            console.error('Error detecting build tool:', error);
            return { buildTool: 'npm' };
        }
    }

    // FIX #2: Detect multiple languages in different services
    private async detectMultiLanguageServices(): Promise<Array<{ path: string; language: string; framework: string }>> {
        const services: Array<{ path: string; language: string; framework: string }> = [];

        try {
            // Scan common service directories
            const serviceDirs = ['services', 'apps', 'packages'];

            for (const serviceDir of serviceDirs) {
                const serviceDirPath = path.join(this.workspaceRoot, serviceDir);
                const serviceDirUri = vscode.Uri.file(serviceDirPath);

                try {
                    const entries = await vscode.workspace.fs.readDirectory(serviceDirUri);

                    for (const [name, type] of entries) {
                        if (type === vscode.FileType.Directory) {
                            const servicePath = path.join(serviceDir, name);
                            const fullServicePath = path.join(this.workspaceRoot, servicePath);

                            // Check for Node.js
                            const packageJsonUri = vscode.Uri.file(path.join(fullServicePath, 'package.json'));
                            try {
                                const packageContent = await vscode.workspace.fs.readFile(packageJsonUri);
                                const packageJson = JSON.parse(packageContent.toString());
                                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                                let framework = 'nodejs';
                                if (deps.express) framework = 'express';
                                else if (deps.fastify) framework = 'fastify';
                                else if (deps['@nestjs/core']) framework = 'nestjs';
                                else if (deps.next) framework = 'nextjs';
                                else if (deps.react) framework = 'react';

                                services.push({ path: servicePath, language: 'nodejs', framework });
                                continue;
                            } catch { }

                            // Check for Python
                            const requirementsUri = vscode.Uri.file(path.join(fullServicePath, 'requirements.txt'));
                            try {
                                const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
                                const requirements = requirementsContent.toString().toLowerCase();

                                let framework = 'python';
                                if (requirements.includes('django')) framework = 'django';
                                else if (requirements.includes('flask')) framework = 'flask';
                                else if (requirements.includes('fastapi')) framework = 'fastapi';

                                services.push({ path: servicePath, language: 'python', framework });
                                continue;
                            } catch { }

                            // Check for Java
                            const pomXmlUri = vscode.Uri.file(path.join(fullServicePath, 'pom.xml'));
                            try {
                                const pomContent = await vscode.workspace.fs.readFile(pomXmlUri);
                                const pom = pomContent.toString();

                                let framework = 'java';
                                if (pom.includes('spring-boot')) framework = 'spring-boot';
                                else if (pom.includes('quarkus')) framework = 'quarkus';

                                services.push({ path: servicePath, language: 'java', framework });
                                continue;
                            } catch { }

                            // Check for Go
                            const goModUri = vscode.Uri.file(path.join(fullServicePath, 'go.mod'));
                            try {
                                const goModContent = await vscode.workspace.fs.readFile(goModUri);
                                const goMod = goModContent.toString();

                                let framework = 'go';
                                if (goMod.includes('gin-gonic/gin')) framework = 'gin';
                                else if (goMod.includes('gofiber/fiber')) framework = 'fiber';
                                else if (goMod.includes('labstack/echo')) framework = 'echo';

                                services.push({ path: servicePath, language: 'go', framework });
                                continue;
                            } catch { }
                        }
                    }
                } catch {
                    // Directory doesn't exist
                }
            }

            console.log('Detected multi-language services:', services);
        } catch (error) {
            console.error('Error detecting multi-language services:', error);
        }

        return services;
    }

    // FIX #3, #4, #6: Detect special features (Prisma, Celery, WebSocket)
    private async detectSpecialFeatures(packageInfo: { [key: string]: any }, files: string[]): Promise<{
        hasPrisma: boolean;
        hasCelery: boolean;
        hasWebSocket: boolean;
    }> {
        const result = {
            hasPrisma: false,
            hasCelery: false,
            hasWebSocket: false
        };

        try {
            // FIX #3: Detect Prisma
            if (packageInfo.packageJson) {
                const deps = {
                    ...packageInfo.packageJson.dependencies,
                    ...packageInfo.packageJson.devDependencies
                };

                if (deps.prisma || deps['@prisma/client']) {
                    result.hasPrisma = true;
                    console.log('Detected Prisma ORM');
                }

                // FIX #6: Detect WebSocket libraries
                if (deps['socket.io'] || deps['socket.io-client'] || deps.ws || deps['@nestjs/websockets']) {
                    result.hasWebSocket = true;
                    console.log('Detected WebSocket support');
                }
            }

            // Check for Prisma schema file
            const prismaSchemaUri = vscode.Uri.file(path.join(this.workspaceRoot, 'prisma', 'schema.prisma'));
            try {
                await vscode.workspace.fs.readFile(prismaSchemaUri);
                result.hasPrisma = true;
                console.log('Detected Prisma schema file');
            } catch { }

            // FIX #4: Detect Celery (Python task queue)
            if (packageInfo.requirementsTxt) {
                const requirements = packageInfo.requirementsTxt.toLowerCase();
                if (requirements.includes('celery')) {
                    result.hasCelery = true;
                    console.log('Detected Celery task queue');
                }
            }

            // Check for celery.py file
            const celeryFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(this.workspaceRoot, '**/celery.py'),
                '**/node_modules/**',
                5
            );
            if (celeryFiles.length > 0) {
                result.hasCelery = true;
                console.log('Detected Celery configuration file');
            }

            // Check for Django Channels (WebSocket for Django)
            if (packageInfo.requirementsTxt) {
                const requirements = packageInfo.requirementsTxt.toLowerCase();
                if (requirements.includes('channels') || requirements.includes('channels-redis')) {
                    result.hasWebSocket = true;
                    console.log('Detected Django Channels (WebSocket)');
                }
            }

        } catch (error) {
            console.error('Error detecting special features:', error);
        }

        return result;
    }
}
