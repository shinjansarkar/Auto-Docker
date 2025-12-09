import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ErrorRecovery } from './safeFileReader';
import {
    YarnWorkspacesDetector,
    PnpmWorkspacesDetector,
    LernaDetector
} from './monorepoDetector';

export interface EnhancedMonorepoResult {
    isMonorepo: boolean;
    frontendPath?: string;
    backendPath?: string;
    frontendDependencies?: any;
    backendDependencies?: any;
    workspaces?: string[];
    expandedWorkspaces?: string[];
    allFrontendServices?: Array<{ path: string; dependencies: any; envPath?: string }>;
    allBackendServices?: Array<{ path: string; dependencies: any; language: string; requirementsPath?: string; envPath?: string }>;
    buildTool?: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm';
    monorepoType?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'rush' | 'turbo' | 'none';
    detectionLog?: string[];
}

/**
 * Enhanced Monorepo Detector
 * Fixes all identified issues:
 * - Integrates Yarn/pnpm/Lerna detectors
 * - Expands glob patterns
 * - Collects ALL services (no break statements)
 * - Adds comprehensive logging
 * - Supports multiple microservices
 */
export class EnhancedMonorepoDetector {

    static async detectMonorepo(workspaceRoot: string): Promise<EnhancedMonorepoResult> {
        const result: EnhancedMonorepoResult = {
            isMonorepo: false,
            expandedWorkspaces: [],
            allFrontendServices: [],
            allBackendServices: [],
            monorepoType: 'none',
            detectionLog: []
        };

        try {
            result.detectionLog!.push('🔍 Starting comprehensive monorepo detection...');

            // PHASE 1: Advanced monorepo detectors (INTEGRATION FIX)
            result.detectionLog!.push('📦 Checking for Yarn workspaces...');
            const yarnInfo = YarnWorkspacesDetector.detect(workspaceRoot);
            if (yarnInfo && yarnInfo.isMonorepo) {
                result.detectionLog!.push(`   ✅ Yarn: ${yarnInfo.workspaces.length} workspaces`);
                result.isMonorepo = true;
                result.monorepoType = 'yarn';
                result.buildTool = 'yarn';
                result.workspaces = yarnInfo.rootPackageJson?.workspaces;
                this.collectServices(yarnInfo.workspaces, workspaceRoot, result);
            }

            result.detectionLog!.push('📦 Checking for pnpm workspaces...');
            const pnpmInfo = PnpmWorkspacesDetector.detect(workspaceRoot);
            if (pnpmInfo && pnpmInfo.isMonorepo) {
                result.detectionLog!.push(`   ✅ pnpm: ${pnpmInfo.workspaces.length} workspaces`);
                result.isMonorepo = true;
                result.monorepoType = 'pnpm';
                result.buildTool = 'pnpm';
                this.collectServices(pnpmInfo.workspaces, workspaceRoot, result);
            }

            result.detectionLog!.push('📦 Checking for Lerna....');
            const lernaInfo = LernaDetector.detect(workspaceRoot);
            if (lernaInfo && lernaInfo.isMonorepo) {
                result.detectionLog!.push(`   ✅ Lerna: ${lernaInfo.workspaces.length} packages`);
                result.isMonorepo = true;
                result.monorepoType = 'lerna';
                result.buildTool = 'lerna';
                this.collectServices(lernaInfo.workspaces, workspaceRoot, result);
            }

            // PHASE 2: Build tools detection
            result.detectionLog!.push('🔧 Checking build tools...');
            if (fs.existsSync(path.join(workspaceRoot, 'turbo.json'))) {
                result.detectionLog!.push('   ✅ Turborepo detected');
                result.buildTool = 'turbo';
                if (result.monorepoType === 'none') result.monorepoType = 'turbo';
                result.isMonorepo = true;
            }
            if (fs.existsSync(path.join(workspaceRoot, 'nx.json'))) {
                result.detectionLog!.push('   ✅ Nx detected');
                result.buildTool = 'nx';
                if (result.monorepoType === 'none') result.monorepoType = 'nx';
                result.isMonorepo = true;
            }

            // PHASE 3: Manual structure scan with EXPANDED patterns (NO break statements)
            if (!result.isMonorepo || result.allFrontendServices!.length === 0) {
                result.detectionLog!.push('🔍 Scanning folder structures...');

                // EXPANDED folder list with glob patterns
                const frontendPatterns = [
                    'frontend', 'client', 'web', 'app', 'ui', 'dashboard', 'portal',
                    'apps/web', 'apps/client', 'apps/frontend', 'apps/ui', 'apps/dashboard',
                    'packages/web', 'packages/client', 'packages/frontend', 'packages/ui',
                    'services/frontend', 'services/web', 'services/ui'
                ];

                const backendPatterns = [
                    'backend', 'server', 'api', 'service', 'gateway',
                    'apps/api', 'apps/server', 'apps/backend', 'apps/service',
                    'packages/api', 'packages/server', 'packages/backend',
                    'services/api', 'services/backend', 'services/server'
                ];

                // Scan ALL frontends (removed break)
                for (const pattern of frontendPatterns) {
                    await this.checkFrontendService(workspaceRoot, pattern, result);
                }

                // Scan ALL backends (removed break)
                for (const pattern of backendPatterns) {
                    await this.checkBackendService(workspaceRoot, pattern, result);
                }


                // PHASE 4: Deep recursive directory scanning with expanded patterns
                result.detectionLog!.push('🔎 Deep scanning common monorepo directories...');
                const commonDirs = [
                    'services',     // Microservices pattern
                    'packages',     // Lerna/pnpm/Yarn workspaces
                    'apps',         // Nx/Turbo monorepo
                    'modules',      // Modular architecture
                    'workspaces',   // Custom workspaces
                    'libs',         // Shared libraries
                    'components',   // Component libraries
                    'microservices',// Explicit microservices
                    'src',          // Source folder (might contain nested apps)
                    'projects',     // Angular workspaces
                    'functions',    // Serverless functions
                    'apis'          // API services
                ];

                for (const dir of commonDirs) {
                    await this.scanDirectory(workspaceRoot, dir, result);
                }


                // Set primary services
                if (result.allFrontendServices!.length > 0) {
                    result.frontendPath = result.allFrontendServices![0].path;
                    result.frontendDependencies = result.allFrontendServices![0].dependencies;
                    result.isMonorepo = result.allFrontendServices!.length > 1 || result.allBackendServices!.length > 0;
                }
                if (result.allBackendServices!.length > 0) {
                    result.backendPath = result.allBackendServices![0].path;
                    result.backendDependencies = result.allBackendServices![0].dependencies;
                    result.isMonorepo = result.allBackendServices!.length > 1 || result.allFrontendServices!.length > 0;
                }
            } else {
                // Set from collected services
                if (result.allFrontendServices!.length > 0) {
                    result.frontendPath = result.allFrontendServices![0].path;
                    result.frontendDependencies = result.allFrontendServices![0].dependencies;
                }
                if (result.allBackendServices!.length > 0) {
                    result.backendPath = result.allBackendServices![0].path;
                    result.backendDependencies = result.allBackendServices![0].dependencies;
                }
            }

            // Summary
            result.detectionLog!.push(`📊 Complete: Monorepo=${result.isMonorepo}, Type=${result.monorepoType}, Frontend=${result.allFrontendServices!.length}, Backend=${result.allBackendServices!.length}`);

        } catch (error) {
            const msg = ErrorRecovery.getErrorMessage(error);
            result.detectionLog!.push(`❌ Error: ${msg}`);
            console.error('Monorepo detection error:', error);
        }

        return result;
    }

    private static collectServices(workspaces: any[], workspaceRoot: string, result: EnhancedMonorepoResult) {
        for (const ws of workspaces) {
            result.expandedWorkspaces!.push(ws.path);
            const relativePath = path.relative(workspaceRoot, ws.path);

            if (ws.type === 'frontend') {
                if (!result.allFrontendServices!.some(s => s.path === relativePath)) {
                    result.allFrontendServices!.push({
                        path: relativePath,
                        dependencies: ws.packageJson
                    });
                }
            } else if (ws.type === 'backend') {
                if (!result.allBackendServices!.some(s => s.path === relativePath)) {
                    result.allBackendServices!.push({
                        path: relativePath,
                        dependencies: ws.packageJson,
                        language: ws.language
                    });
                }
            }
        }
    }

    private static async checkFrontendService(workspaceRoot: string, pattern: string, result: EnhancedMonorepoResult) {
        const folderPath = path.join(workspaceRoot, pattern);
        const packageJsonPath = path.join(folderPath, 'package.json');

        try {
            const uri = vscode.Uri.file(packageJsonPath);
            await vscode.workspace.fs.stat(uri);
            const content = await vscode.workspace.fs.readFile(uri);
            const pkgJson = JSON.parse(content.toString());
            const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

            if (deps.react || deps.vue || deps['@angular/core'] || deps.vite || deps.next ||
                deps.nuxt || deps.svelte || deps['solid-js'] || deps.preact || deps['@sveltejs/kit']) {

                const relativePath = path.relative(workspaceRoot, folderPath);
                if (!result.allFrontendServices!.some(s => s.path === relativePath)) {
                    result.allFrontendServices!.push({ path: relativePath, dependencies: pkgJson });
                    result.detectionLog!.push(`   ✅ Frontend: ${relativePath}`);
                }
            }
        } catch (e) { /* Silent fail */ }
    }

    private static async checkBackendService(workspaceRoot: string, pattern: string, result: EnhancedMonorepoResult) {
        const folderPath = path.join(workspaceRoot, pattern);

        // Node.js backend
        try {
            const pkgPath = path.join(folderPath, 'package.json');
            const uri = vscode.Uri.file(pkgPath);
            await vscode.workspace.fs.stat(uri);
            const content = await vscode.workspace.fs.readFile(uri);
            const pkgJson = JSON.parse(content.toString());
            const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

            if (deps.express || deps.fastify || deps.nestjs || deps['@nestjs/core'] || deps.koa || deps.hapi) {
                const relativePath = path.relative(workspaceRoot, folderPath);

                // Check for .env file
                let relativeEnvPath: string | undefined;
                try {
                    const envPath = path.join(folderPath, '.env');
                    await vscode.workspace.fs.stat(vscode.Uri.file(envPath));
                    relativeEnvPath = path.relative(workspaceRoot, envPath);
                } catch (e) { /* No .env file */ }

                if (!result.allBackendServices!.some(s => s.path === relativePath)) {
                    result.allBackendServices!.push({
                        path: relativePath,
                        dependencies: pkgJson,
                        language: 'nodejs',
                        envPath: relativeEnvPath
                    });
                    result.detectionLog!.push(`   ✅ Backend (Node): ${relativePath}`);
                    if (relativeEnvPath) {
                        result.detectionLog!.push(`      📄 Found .env at: ${relativeEnvPath}`);
                    }
                }
            }
        } catch (e) { /* No package.json */ }

        // Python backend
        try {
            const reqPath = path.join(folderPath, 'requirements.txt');
            const uri = vscode.Uri.file(reqPath);
            await vscode.workspace.fs.stat(uri);
            const content = await vscode.workspace.fs.readFile(uri);
            const reqStr = content.toString().toLowerCase();

            if (reqStr.includes('flask') || reqStr.includes('django') || reqStr.includes('fastapi')) {
                const relativePath = path.relative(workspaceRoot, folderPath);
                const relativeReqPath = path.relative(workspaceRoot, reqPath);

                // Check for .env file
                let relativeEnvPath: string | undefined;
                try {
                    const envPath = path.join(folderPath, '.env');
                    await vscode.workspace.fs.stat(vscode.Uri.file(envPath));
                    relativeEnvPath = path.relative(workspaceRoot, envPath);
                } catch (e) { /* No .env file */ }

                if (!result.allBackendServices!.some(s => s.path === relativePath)) {
                    result.allBackendServices!.push({
                        path: relativePath,
                        dependencies: { requirementsTxt: content.toString() },
                        language: 'python',
                        requirementsPath: relativeReqPath,
                        envPath: relativeEnvPath
                    });
                    result.detectionLog!.push(`   ✅ Backend (Python): ${relativePath}`);
                    if (relativeEnvPath) {
                        result.detectionLog!.push(`      📄 Found .env at: ${relativeEnvPath}`);
                    }
                }
            }
        } catch (e) { /* No requirements.txt */ }
    }

    /**
     * Recursively scan directories for services (DEEP SCANNING)
     * Now supports unlimited nesting levels with depth control
     */
    private static async scanDirectory(workspaceRoot: string, dirName: string, result: EnhancedMonorepoResult, currentDepth: number = 0, maxDepth: number = 5) {
        // Prevent infinite recursion and excessive scanning
        if (currentDepth >= maxDepth) {
            return;
        }

        const dirPath = path.join(workspaceRoot, dirName);

        try {
            const uri = vscode.Uri.file(dirPath);
            const entries = await vscode.workspace.fs.readDirectory(uri);

            for (const [name, type] of entries) {
                // Skip hidden folders and common ignore patterns
                if (name.startsWith('.') || name === 'node_modules' || name === 'dist' ||
                    name === 'build' || name === '__pycache__' || name === 'venv' ||
                    name === '.venv' || name === 'vendor') {
                    continue;
                }

                if (type === vscode.FileType.Directory) {
                    const subPath = `${dirName}/${name}`;

                    // Check if this directory contains a service
                    await this.checkFrontendService(workspaceRoot, subPath, result);
                    await this.checkBackendService(workspaceRoot, subPath, result);

                    // RECURSIVE CALL: Scan subdirectories
                    await this.scanDirectory(workspaceRoot, subPath, result, currentDepth + 1, maxDepth);
                }
            }
        } catch (e) {
            // Directory doesn't exist or permission denied
        }
    }
}
