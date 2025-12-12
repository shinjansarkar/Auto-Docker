/**
 * Enhanced Detection Engine
 * Centralized, accurate detection of all project types and configurations
 * Fixes Issues #1-6: All codebase detection errors
 */

import * as fs from 'fs';
import * as path from 'path';
import { OutputFolderMapper, FrameworkOutputInfo } from './outputFolderMapper';

export type ProjectType =
    | 'frontend-only'
    | 'backend-only'
    | 'fullstack'
    | 'monorepo';

export interface DetectedFrontend {
    exists: boolean;
    framework: string;
    variant?: string;
    outputFolder: string;
    buildCommand: string;
    packageManager: 'npm' | 'yarn' | 'pnpm';
    installCommand: string;
    path: string; // Relative path in monorepo (or "." for single projects)
    port?: number;
}

export interface DetectedBackend {
    exists: boolean;
    framework: string;
    language: 'node' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'ruby' | 'elixir';
    packageManager?: string;
    path: string; // Relative path in monorepo (or "." for single projects)
    port?: number;
    dependencies?: any;
}

export interface DetectedDatabase {
    exists: boolean;
    type: 'postgres' | 'mysql' | 'mongodb' | 'redis' | 'sqlite' | 'mariadb' | string;
    port?: number;
    version?: string;
}

export interface MonorepoInfo {
    isMonorepo: boolean;
    tool?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'turbo' | 'rush';
    workspaces?: string[];
    frontends: DetectedFrontend[];
    backends: DetectedBackend[];
}

export interface EnhancedDetectionResult {
    projectType: ProjectType;
    frontend?: DetectedFrontend;
    backend?: DetectedBackend;
    databases: DetectedDatabase[];
    monorepo?: MonorepoInfo;
    hasDockerfile: boolean;
    hasDockerCompose: boolean;
    hasNginxConfig: boolean;
}

/**
 * Enhanced Detection Engine - Main Class
 */
export class EnhancedDetectionEngine {
    private basePath: string;

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    /**
     * Main detection method - detects everything
     */
    async detect(): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Starting detection...');

        // Check if monorepo first
        const monorepoInfo = await this.detectMonorepo();

        if (monorepoInfo.isMonorepo) {
            return this.detectMonorepoProject(monorepoInfo);
        } else {
            return this.detectSingleProject();
        }
    }

    /**
     * Detect monorepo structure
     */
    private async detectMonorepo(): Promise<MonorepoInfo> {
        const packageJsonPath = path.join(this.basePath, 'package.json');

        // Check for workspace indicators
        const hasYarnWorkspaces = fs.existsSync(packageJsonPath) &&
            this.checkYarnWorkspaces(packageJsonPath);
        const hasPnpmWorkspaces = fs.existsSync(path.join(this.basePath, 'pnpm-workspace.yaml'));
        const hasLerna = fs.existsSync(path.join(this.basePath, 'lerna.json'));
        const hasNx = fs.existsSync(path.join(this.basePath, 'nx.json'));
        const hasTurbo = fs.existsSync(path.join(this.basePath, 'turbo.json'));
        const hasRush = fs.existsSync(path.join(this.basePath, 'rush.json'));

        const isMonorepo = hasYarnWorkspaces || hasPnpmWorkspaces || hasLerna || hasNx || hasTurbo || hasRush;

        if (!isMonorepo) {
            // Also check for common monorepo folder structures
            const hasAppsFolder = fs.existsSync(path.join(this.basePath, 'apps'));
            const hasPackagesFolder = fs.existsSync(path.join(this.basePath, 'packages'));

            if (hasAppsFolder || hasPackagesFolder) {
                return {
                    isMonorepo: true,
                    tool: 'yarn',
                    frontends: [],
                    backends: []
                };
            }

            return {
                isMonorepo: false,
                frontends: [],
                backends: []
            };
        }

        // Determine tool
        let tool: MonorepoInfo['tool'] = 'yarn';
        if (hasPnpmWorkspaces) tool = 'pnpm';
        if (hasLerna) tool = 'lerna';
        if (hasNx) tool = 'nx';
        if (hasTurbo) tool = 'turbo';
        if (hasRush) tool = 'rush';

        // Get workspaces
        const workspaces = await this.getWorkspaces(tool);

        return {
            isMonorepo: true,
            tool,
            workspaces,
            frontends: [],
            backends: []
        };
    }

    /**
     * Check if package.json has yarn workspaces
     */
    private checkYarnWorkspaces(packageJsonPath: string): boolean {
        try {
            const content = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            return !!content.workspaces;
        } catch {
            return false;
        }
    }

    /**
     * Get workspaces for monorepo
     */
    private async getWorkspaces(tool?: MonorepoInfo['tool']): Promise<string[]> {
        const workspaces: string[] = [];

        // Common workspace folders
        const commonFolders = [
            'apps', 'packages', 'services', 'modules', 'libs',
            'microservices', 'functions', 'projects', 'workspaces'
        ];

        for (const folder of commonFolders) {
            const folderPath = path.join(this.basePath, folder);
            if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                const subDirs = fs.readdirSync(folderPath)
                    .filter(item => {
                        const itemPath = path.join(folderPath, item);
                        return fs.statSync(itemPath).isDirectory();
                    })
                    .map(item => `${folder}/${item}`);

                workspaces.push(...subDirs);
            }
        }

        return workspaces;
    }

    /**
     * Detect monorepo project structure
     */
    private async detectMonorepoProject(monorepoInfo: MonorepoInfo): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Detecting monorepo structure...');

        const frontends: DetectedFrontend[] = [];
        const backends: DetectedBackend[] = [];

        // Scan each workspace
        for (const workspace of monorepoInfo.workspaces || []) {
            const workspacePath = path.join(this.basePath, workspace);

            // Detect frontend
            const frontend = await this.detectFrontend(workspacePath, workspace);
            if (frontend.exists) {
                frontends.push(frontend);
            }

            // Detect backend
            const backend = await this.detectBackend(workspacePath, workspace);
            if (backend.exists) {
                backends.push(backend);
            }
        }

        monorepoInfo.frontends = frontends;
        monorepoInfo.backends = backends;

        // Detect databases
        const databases = await this.detectDatabases();

        return {
            projectType: 'monorepo',
            monorepo: monorepoInfo,
            databases,
            hasDockerfile: this.checkFileExists('Dockerfile'),
            hasDockerCompose: this.checkFileExists('docker-compose.yml') || this.checkFileExists('docker-compose.yaml'),
            hasNginxConfig: this.checkFileExists('nginx.conf')
        };
    }

    /**
     * Detect single project (non-monorepo)
     */
    private async detectSingleProject(): Promise<EnhancedDetectionResult> {
        console.log('[EnhancedDetectionEngine] Detecting single project...');

        const frontend = await this.detectFrontend(this.basePath, '.');
        const backend = await this.detectBackend(this.basePath, '.');
        const databases = await this.detectDatabases();

        // Determine project type
        let projectType: ProjectType;
        if (frontend.exists && backend.exists) {
            projectType = 'fullstack';
        } else if (frontend.exists) {
            projectType = 'frontend-only';
        } else if (backend.exists) {
            projectType = 'backend-only';
        } else {
            projectType = 'backend-only'; // Default
        }

        return {
            projectType,
            frontend: frontend.exists ? frontend : undefined,
            backend: backend.exists ? backend : undefined,
            databases,
            hasDockerfile: this.checkFileExists('Dockerfile'),
            hasDockerCompose: this.checkFileExists('docker-compose.yml') || this.checkFileExists('docker-compose.yaml'),
            hasNginxConfig: this.checkFileExists('nginx.conf')
        };
    }

    /**
     * Detect frontend framework
     */
    private async detectFrontend(basePath: string, relativePath: string): Promise<DetectedFrontend> {
        const packageJsonPath = path.join(basePath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
            return {
                exists: false,
                framework: 'unknown',
                outputFolder: 'dist',
                buildCommand: 'npm run build',
                packageManager: 'npm',
                installCommand: 'npm ci',
                path: relativePath
            };
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Detect framework
        let framework = 'unknown';
        if (dependencies['next']) framework = 'nextjs';
        else if (dependencies['react']) framework = 'react';
        else if (dependencies['vue']) framework = 'vue';
        else if (dependencies['nuxt']) framework = 'nuxt';
        else if (dependencies['@angular/core']) framework = 'angular';
        else if (dependencies['svelte']) framework = 'svelte';
        else if (dependencies['@sveltejs/kit']) framework = 'svelte';
        else if (dependencies['gatsby']) framework = 'gatsby';
        else if (dependencies['ember-cli']) framework = 'ember';
        else if (dependencies['solid-js']) framework = 'solid';

        // If no frontend framework detected, return not exists
        if (framework === 'unknown') {
            return {
                exists: false,
                framework: 'unknown',
                outputFolder: 'dist',
                buildCommand: 'npm run build',
                packageManager: 'npm',
                installCommand: 'npm ci',
                path: relativePath
            };
        }

        // Detect config files
        const hasViteConfig = fs.existsSync(path.join(basePath, 'vite.config.js')) ||
            fs.existsSync(path.join(basePath, 'vite.config.ts'));
        const hasCRAConfig = !!dependencies['react-scripts'];
        const hasNextConfig = fs.existsSync(path.join(basePath, 'next.config.js')) ||
            fs.existsSync(path.join(basePath, 'next.config.mjs'));
        const hasAngularJson = fs.existsSync(path.join(basePath, 'angular.json'));
        const hasSvelteKitConfig = fs.existsSync(path.join(basePath, 'svelte.config.js'));

        // Read config content if needed
        let nextConfigContent: any = {};
        let angularJsonContent: any = {};

        if (hasNextConfig) {
            // Try to read next config (might need parsing for actual values)
            try {
                const nextConfigPath = fs.existsSync(path.join(basePath, 'next.config.js'))
                    ? path.join(basePath, 'next.config.js')
                    : path.join(basePath, 'next.config.mjs');
                const configText = fs.readFileSync(nextConfigPath, 'utf-8');
                // Simple check for output: 'export'
                if (configText.includes("output: 'export'")) {
                    nextConfigContent.output = 'export';
                }
            } catch (err) {
                console.log('[EnhancedDetectionEngine] Could not read next.config.js');
            }
        }

        if (hasAngularJson) {
            angularJsonContent = JSON.parse(fs.readFileSync(path.join(basePath, 'angular.json'), 'utf-8'));
        }

        // Get output folder info
        const outputInfo = OutputFolderMapper.getCompleteFrameworkInfo(
            framework,
            basePath,
            packageJson,
            {
                hasViteConfig,
                hasCRAConfig,
                hasNextConfig,
                nextConfigContent,
                hasAngularJson,
                angularJsonContent,
                hasSvelteKitConfig
            }
        );

        return {
            exists: true,
            framework: outputInfo.framework,
            variant: outputInfo.variant,
            outputFolder: outputInfo.outputFolder,
            buildCommand: outputInfo.buildCommand,
            packageManager: outputInfo.packageManager,
            installCommand: outputInfo.installCommand,
            path: relativePath,
            port: 3000
        };
    }

    /**
     * Detect backend framework
     */
    private async detectBackend(basePath: string, relativePath: string): Promise<DetectedBackend> {
        // Check for Node.js backend
        const packageJsonPath = path.join(basePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

            // Check if it's a backend (not frontend)
            const isBackend = !!(
                dependencies['express'] ||
                dependencies['koa'] ||
                dependencies['fastify'] ||
                dependencies['@nestjs/core'] ||
                dependencies['hapi']
            );

            if (isBackend) {
                let framework = 'node-express';
                if (dependencies['@nestjs/core']) framework = 'node-nestjs';
                else if (dependencies['koa']) framework = 'node-koa';
                else if (dependencies['fastify']) framework = 'node-fastify';
                else if (dependencies['hapi']) framework = 'node-hapi';

                const packageManager = OutputFolderMapper.detectPackageManager(basePath);

                return {
                    exists: true,
                    framework,
                    language: 'node',
                    packageManager,
                    path: relativePath,
                    port: 8000,
                    dependencies: packageJson.dependencies
                };
            }
        }

        // Check for Python backend
        const requirementsPath = path.join(basePath, 'requirements.txt');
        const pyprojectPath = path.join(basePath, 'pyproject.toml');

        if (fs.existsSync(requirementsPath) || fs.existsSync(pyprojectPath)) {
            let framework = 'python-flask';
            let packageManager = 'pip';

            if (fs.existsSync(requirementsPath)) {
                const requirements = fs.readFileSync(requirementsPath, 'utf-8');
                if (requirements.includes('fastapi')) framework = 'python-fastapi';
                else if (requirements.includes('django')) framework = 'python-django';
                else if (requirements.includes('flask')) framework = 'python-flask';
            }

            if (fs.existsSync(pyprojectPath)) {
                const pyproject = fs.readFileSync(pyprojectPath, 'utf-8');
                if (pyproject.includes('poetry')) packageManager = 'poetry';
                else if (pyproject.includes('pipenv')) packageManager = 'pipenv';
            }

            return {
                exists: true,
                framework,
                language: 'python',
                packageManager,
                path: relativePath,
                port: 8000
            };
        }

        // Check for Go backend
        const goModPath = path.join(basePath, 'go.mod');
        if (fs.existsSync(goModPath)) {
            const goMod = fs.readFileSync(goModPath, 'utf-8');
            let framework = 'go-gin';

            if (goMod.includes('github.com/gin-gonic/gin')) framework = 'go-gin';
            else if (goMod.includes('github.com/gofiber/fiber')) framework = 'go-fiber';
            else if (goMod.includes('github.com/labstack/echo')) framework = 'go-echo';

            return {
                exists: true,
                framework,
                language: 'go',
                path: relativePath,
                port: 8000
            };
        }

        // Check for Java backend
        const pomPath = path.join(basePath, 'pom.xml');
        const gradlePath = path.join(basePath, 'build.gradle');

        if (fs.existsSync(pomPath) || fs.existsSync(gradlePath)) {
            return {
                exists: true,
                framework: 'java-spring-boot',
                language: 'java',
                packageManager: fs.existsSync(pomPath) ? 'maven' : 'gradle',
                path: relativePath,
                port: 8080
            };
        }

        // Check for PHP backend
        const composerPath = path.join(basePath, 'composer.json');
        if (fs.existsSync(composerPath)) {
            const composer = JSON.parse(fs.readFileSync(composerPath, 'utf-8'));
            let framework = 'php-laravel';

            if (composer.require && composer.require['laravel/framework']) framework = 'php-laravel';
            else if (composer.require && composer.require['symfony/symfony']) framework = 'php-symfony';

            return {
                exists: true,
                framework,
                language: 'php',
                packageManager: 'composer',
                path: relativePath,
                port: 8000
            };
        }

        // No backend detected
        return {
            exists: false,
            framework: 'unknown',
            language: 'node',
            path: relativePath
        };
    }

    /**
     * Detect databases from environment files and docker-compose
     */
    private async detectDatabases(): Promise<DetectedDatabase[]> {
        const databases: DetectedDatabase[] = [];

        // Check for docker-compose.yml
        const composePaths = [
            path.join(this.basePath, 'docker-compose.yml'),
            path.join(this.basePath, 'docker-compose.yaml')
        ];

        for (const composePath of composePaths) {
            if (fs.existsSync(composePath)) {
                const composeContent = fs.readFileSync(composePath, 'utf-8');

                if (composeContent.includes('image: postgres')) {
                    databases.push({ exists: true, type: 'postgres', port: 5432 });
                }
                if (composeContent.includes('image: mysql')) {
                    databases.push({ exists: true, type: 'mysql', port: 3306 });
                }
                if (composeContent.includes('image: mongo')) {
                    databases.push({ exists: true, type: 'mongodb', port: 27017 });
                }
                if (composeContent.includes('image: redis')) {
                    databases.push({ exists: true, type: 'redis', port: 6379 });
                }
            }
        }

        // Check for .env files
        const envPath = path.join(this.basePath, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf-8');

            if (envContent.includes('POSTGRES') && databases.every(db => db.type !== 'postgres')) {
                databases.push({ exists: true, type: 'postgres', port: 5432 });
            }
            if (envContent.includes('MYSQL') && databases.every(db => db.type !== 'mysql')) {
                databases.push({ exists: true, type: 'mysql', port: 3306 });
            }
            if (envContent.includes('MONGO') && databases.every(db => db.type !== 'mongodb')) {
                databases.push({ exists: true, type: 'mongodb', port: 27017 });
            }
            if (envContent.includes('REDIS') && databases.every(db => db.type !== 'redis')) {
                databases.push({ exists: true, type: 'redis', port: 6379 });
            }
        }

        return databases;
    }

    /**
     * Check if file exists
     */
    private checkFileExists(filename: string): boolean {
        return fs.existsSync(path.join(this.basePath, filename));
    }
}
