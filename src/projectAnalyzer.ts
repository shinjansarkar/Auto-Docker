import * as vscode from 'vscode';
import * as path from 'path';

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
    // Workspace/Monorepo support
    workspaces?: string[]; // npm/yarn/pnpm workspaces
    buildTool?: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm'; // Build tool detection
    services?: Array<{ path: string; language: string; framework: string }>; // Multi-language services
    hasPrisma?: boolean; // Prisma ORM detection
    hasCelery?: boolean; // Celery worker detection
    hasWebSocket?: boolean; // WebSocket support detection
    // Advanced services
    messageQueue?: 'rabbitmq' | 'kafka' | 'redis-streams' | 'activemq';
    cacheLayer?: 'redis' | 'memcached';
    searchEngine?: 'elasticsearch' | 'opensearch';
    reverseProxy?: 'nginx' | 'traefik' | 'caddy';
    monitoring?: 'prometheus' | 'grafana';
}

export class ProjectAnalyzer {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async analyzeProject(): Promise<ProjectStructure> {
        const files = await this.getProjectFiles();
        const packageInfo = await this.analyzePackageFiles();
        const monorepoInfo = await this.detectMonorepo();
        const projectType = this.detectProjectType(files, packageInfo, monorepoInfo);
        const envInfo = await this.analyzeEnvFiles();
        const advancedServices = this.detectAdvancedServices(packageInfo, files);
        const buildToolInfo = await this.detectBuildTool();
        const multiLanguageServices = await this.detectMultiLanguageServices();
        const specialFeatures = await this.detectSpecialFeatures(packageInfo, files);

        return {
            projectType: projectType.type,
            frontend: projectType.frontend,
            backend: projectType.backend,
            database: projectType.database,
            databases: projectType.databases,
            files: files.slice(0, 50), // Limit files for LLM context
            dependencies: packageInfo,
            hasMultiStage: this.shouldUseMultiStage(projectType),
            description: this.generateProjectDescription(projectType, files),
            hasEnvFile: envInfo.hasEnvFile,
            envVars: envInfo.envVars,
            isMonorepo: monorepoInfo.isMonorepo,
            isSingleFolderFullstack: projectType.isSingleFolderFullstack,
            frontendPath: monorepoInfo.frontendPath,
            backendPath: monorepoInfo.backendPath,
            frontendDependencies: monorepoInfo.frontendDependencies,
            backendDependencies: monorepoInfo.backendDependencies,
            workspaces: monorepoInfo.workspaces,
            buildTool: buildToolInfo.buildTool,
            services: multiLanguageServices,
            hasPrisma: specialFeatures.hasPrisma,
            hasCelery: specialFeatures.hasCelery,
            hasWebSocket: specialFeatures.hasWebSocket,
            messageQueue: advancedServices.messageQueue,
            cacheLayer: advancedServices.cacheLayer,
            searchEngine: advancedServices.searchEngine,
            reverseProxy: advancedServices.reverseProxy,
            monitoring: advancedServices.monitoring
        };
    }

    private async getProjectFiles(): Promise<string[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const files: string[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders[0];

        try {
            // Get important files first
            const patterns = [
                '*.json',
                '*.js',
                '*.ts',
                '*.py',
                '*.md',
                '*.yml',
                '*.yaml',
                '*.txt',
                '*.lock',
                'Dockerfile*',
                'docker-compose*'
            ];

            for (const pattern of patterns) {
                const foundFiles = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(workspaceFolder, `**/${pattern}`),
                    '**/node_modules/**',
                    100
                );
                files.push(...foundFiles.map(uri =>
                    path.relative(this.workspaceRoot, uri.fsPath).replace(/\\/g, '/')
                ));
            }

            return [...new Set(files)].sort();
        } catch (error) {
            console.error('Error getting project files:', error);
            return [];
        }
    }

    private async analyzePackageFiles(): Promise<{ [key: string]: any }> {
        const packageInfo: { [key: string]: any } = {};

        try {
            // Check for package.json (Node.js)
            const packageJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'package.json'));
            try {
                const packageContent = await vscode.workspace.fs.readFile(packageJsonUri);
                packageInfo.packageJson = JSON.parse(packageContent.toString());
            } catch { }

            // Check for requirements.txt (Python)
            const requirementsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'requirements.txt'));
            try {
                const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
                packageInfo.requirementsTxt = requirementsContent.toString();
            } catch { }

            // Check for pom.xml (Java Maven)
            const pomUri = vscode.Uri.file(path.join(this.workspaceRoot, 'pom.xml'));
            try {
                const pomContent = await vscode.workspace.fs.readFile(pomUri);
                packageInfo.pomXml = pomContent.toString();
            } catch { }

            // Check for Gemfile (Ruby)
            const gemfileUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Gemfile'));
            try {
                const gemfileContent = await vscode.workspace.fs.readFile(gemfileUri);
                packageInfo.gemfile = gemfileContent.toString();
            } catch { }

            // Check for go.mod (Go)
            const goModUri = vscode.Uri.file(path.join(this.workspaceRoot, 'go.mod'));
            try {
                const goModContent = await vscode.workspace.fs.readFile(goModUri);
                packageInfo.goMod = goModContent.toString();
            } catch { }

        } catch (error) {
            console.error('Error analyzing package files:', error);
        }

        return packageInfo;
    }

    private async analyzeEnvFiles(): Promise<{ hasEnvFile: boolean; envVars: string[] }> {
        const envInfo = {
            hasEnvFile: false,
            envVars: [] as string[]
        };

        try {
            // Check for various .env files
            const envFiles = ['.env', '.env.local', '.env.example', '.env.sample', '.env.development', '.env.production'];

            for (const envFile of envFiles) {
                const envUri = vscode.Uri.file(path.join(this.workspaceRoot, envFile));
                try {
                    const envContent = await vscode.workspace.fs.readFile(envUri);
                    const envText = envContent.toString();

                    if (envFile === '.env' || envFile === '.env.example' || envFile === '.env.sample') {
                        envInfo.hasEnvFile = true;

                        // Extract environment variable names (not values for security)
                        const lines = envText.split('\n');
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                                const varName = trimmed.split('=')[0].trim();
                                if (varName && !envInfo.envVars.includes(varName)) {
                                    envInfo.envVars.push(varName);
                                }
                            }
                        }
                    }
                } catch {
                    // File doesn't exist, continue
                }
            }
        } catch (error) {
            console.error('Error analyzing .env files:', error);
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
    }> {
        const result = {
            isMonorepo: false,
            frontendPath: undefined as string | undefined,
            backendPath: undefined as string | undefined,
            frontendDependencies: undefined as any,
            backendDependencies: undefined as any,
            workspaces: undefined as string[] | undefined
        };

        try {
            // FIX #1: Check for workspace configuration in root package.json
            const rootPackageJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'package.json'));
            try {
                const packageContent = await vscode.workspace.fs.readFile(rootPackageJsonUri);
                const packageJson = JSON.parse(packageContent.toString());

                // Detect npm/yarn/pnpm workspaces
                if (packageJson.workspaces) {
                    result.isMonorepo = true;
                    result.workspaces = Array.isArray(packageJson.workspaces)
                        ? packageJson.workspaces
                        : packageJson.workspaces.packages || [];
                    console.log('Detected workspaces:', result.workspaces);
                }
            } catch {
                // No root package.json
            }

            // Check for common monorepo folder structures
            const commonFrontendFolders = ['frontend', 'client', 'web', 'app', 'apps/web', 'apps/client'];
            const commonBackendFolders = ['backend', 'server', 'api', 'apps/api', 'apps/server'];

            // Check for frontend folder
            for (const folder of commonFrontendFolders) {
                const folderPath = path.join(this.workspaceRoot, folder);
                const packageJsonPath = path.join(folderPath, 'package.json');
                const packageUri = vscode.Uri.file(packageJsonPath);

                try {
                    const packageContent = await vscode.workspace.fs.readFile(packageUri);
                    const packageJson = JSON.parse(packageContent.toString());

                    // Check if it's a frontend project
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    if (deps.react || deps.vue || deps['@angular/core'] || deps.vite || deps.next || deps.nuxt || deps.svelte) {
                        result.frontendPath = folder;
                        result.frontendDependencies = packageJson;
                        result.isMonorepo = true;
                    }
                } catch {
                    // Folder doesn't exist or no package.json
                }
            }

            // Check for backend folder
            for (const folder of commonBackendFolders) {
                const folderPath = path.join(this.workspaceRoot, folder);
                const packageJsonPath = path.join(folderPath, 'package.json');
                const packageUri = vscode.Uri.file(packageJsonPath);

                try {
                    const packageContent = await vscode.workspace.fs.readFile(packageUri);
                    const packageJson = JSON.parse(packageContent.toString());

                    // Check if it's a backend project
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    if (deps.express || deps.fastify || deps.nestjs || deps['@nestjs/core'] || deps.koa) {
                        result.backendPath = folder;
                        result.backendDependencies = packageJson;
                        result.isMonorepo = true;
                    }
                } catch {
                    // Folder doesn't exist or no package.json
                }

                // Also check for Python backend
                const requirementsTxtPath = path.join(folderPath, 'requirements.txt');
                const requirementsUri = vscode.Uri.file(requirementsTxtPath);

                try {
                    const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
                    const requirements = requirementsContent.toString().toLowerCase();

                    if (requirements.includes('flask') || requirements.includes('django') || requirements.includes('fastapi')) {
                        result.backendPath = folder;
                        result.backendDependencies = { requirementsTxt: requirementsContent.toString() };
                        result.isMonorepo = true;
                    }
                } catch {
                    // File doesn't exist
                }
            }

        } catch (error) {
            console.error('Error detecting monorepo structure:', error);
        }

        return result;
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