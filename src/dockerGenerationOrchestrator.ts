/**
 * Docker Generation Orchestrator
 * Integrates all components to generate complete Docker configurations
 * Orchestrates: Detection -> Generation -> Validation -> File Writing
 */

import * as fs from 'fs';
import * as path from 'path';
import { EnhancedDetectionEngine, EnhancedDetectionResult, ProjectType } from './enhancedDetectionEngine';
import { SmartDockerfileGenerator } from './smartDockerfileGenerator';
import { SimpleNginxGenerator } from './simpleNginxGenerator';
import { CleanComposeGenerator } from './cleanComposeGenerator';

export interface GeneratedDockerFiles {
    dockerfile?: string;
    dockerCompose: string;
    dockerignore: string;
    nginxConf?: string;
    frontendDockerfiles?: Array<{ path: string; content: string }>;
    backendDockerfiles?: Array<{ path: string; content: string }>;
}

export interface GenerationResult {
    success: boolean;
    files: GeneratedDockerFiles;
    detectionResult: EnhancedDetectionResult;
    warnings: string[];
    skipped: string[];
}

/**
 * Docker Generation Orchestrator
 */
export class DockerGenerationOrchestrator {
    private basePath: string;
    private detectionEngine: EnhancedDetectionEngine;

    constructor(basePath: string) {
        this.basePath = basePath;
        this.detectionEngine = new EnhancedDetectionEngine(basePath);
    }

    /**
     * Main orchestration method
     */
    async generate(): Promise<GenerationResult> {
        console.log('[DockerGenerationOrchestrator] Starting generation process...');

        const warnings: string[] = [];
        const skipped: string[] = [];

        // Step 1: Detect project structure
        console.log('[Orchestrator] Step 1: Detection');
        const detectionResult = await this.detectionEngine.detect();
        console.log(`[Orchestrator] Detected project type: ${detectionResult.projectType}`);

        // Step 2: Generate files based on detection
        console.log('[Orchestrator] Step 2: Generation');
        const files = await this.generateFiles(detectionResult, warnings, skipped);

        // Step 3: Validate generated files
        console.log('[Orchestrator] Step 3: Validation');
        this.validateGeneratedFiles(files, warnings);

        return {
            success: true,
            files,
            detectionResult,
            warnings,
            skipped
        };
    }

    /**
     * Generate all Docker files based on detection
     */
    private async generateFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        const { projectType } = detection;

        switch (projectType) {
            case 'frontend-only':
                return this.generateFrontendOnlyFiles(detection, warnings, skipped);

            case 'backend-only':
                return this.generateBackendOnlyFiles(detection, warnings, skipped);

            case 'fullstack':
                return this.generateFullstackFiles(detection, warnings, skipped);

            case 'monorepo':
                return this.generateMonorepoFiles(detection, warnings, skipped);

            default:
                throw new Error(`Unknown project type: ${projectType}`);
        }
    }

    /**
     * Generate files for frontend-only project
     */
    private async generateFrontendOnlyFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating frontend-only files');

        const { frontend } = detection;
        if (!frontend) {
            throw new Error('Frontend detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: ''
        };

        // Generate Dockerfile
        files.dockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);

        // Generate nginx.conf (check if should generate)
        const nginxGeneration = SimpleNginxGenerator.generateWithContext(true, false, this.basePath);
        if (nginxGeneration.shouldGenerate) {
            files.nginxConf = nginxGeneration.config!;
        } else {
            skipped.push('nginx.conf: ' + nginxGeneration.reason);
        }

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateFrontendOnlyCompose(frontend);

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Generate files for backend-only project
     */
    private async generateBackendOnlyFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating backend-only files');

        const { backend, databases } = detection;
        if (!backend) {
            throw new Error('Backend detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: ''
        };

        // Generate Dockerfile
        files.dockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);

        // NO nginx.conf for backend-only
        skipped.push('nginx.conf: Backend-only project does not need nginx');

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateBackendOnlyCompose(backend, databases);

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Generate files for fullstack project
     */
    private async generateFullstackFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating fullstack files');

        const { frontend, backend, databases } = detection;
        if (!frontend || !backend) {
            throw new Error('Fullstack detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: '',
            frontendDockerfiles: [],
            backendDockerfiles: []
        };

        // Generate frontend Dockerfile
        const frontendDockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);
        files.frontendDockerfiles = [{
            path: 'frontend/Dockerfile',
            content: frontendDockerfile
        }];

        // Generate backend Dockerfile
        const backendDockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);
        files.backendDockerfiles = [{
            path: 'backend/Dockerfile',
            content: backendDockerfile
        }];

        // Generate nginx.conf with proxy
        const nginxGeneration = SimpleNginxGenerator.generateWithContext(true, true, this.basePath);
        if (nginxGeneration.shouldGenerate) {
            files.nginxConf = nginxGeneration.config!;
        } else {
            skipped.push('nginx.conf: ' + nginxGeneration.reason);
        }

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateFullstackCompose(frontend, backend, databases);

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Generate files for monorepo project
     */
    private async generateMonorepoFiles(
        detection: EnhancedDetectionResult,
        warnings: string[],
        skipped: string[]
    ): Promise<GeneratedDockerFiles> {
        console.log('[Orchestrator] Generating monorepo files');

        const { monorepo, databases } = detection;
        if (!monorepo) {
            throw new Error('Monorepo detection failed');
        }

        const files: GeneratedDockerFiles = {
            dockerCompose: '',
            dockerignore: '',
            frontendDockerfiles: [],
            backendDockerfiles: []
        };

        // Generate frontend Dockerfiles
        for (const frontend of monorepo.frontends) {
            const dockerfile = SmartDockerfileGenerator.generateFrontendDockerfile(frontend);
            files.frontendDockerfiles!.push({
                path: `${frontend.path}/Dockerfile`,
                content: dockerfile
            });
        }

        // Generate backend Dockerfiles
        for (const backend of monorepo.backends) {
            const dockerfile = SmartDockerfileGenerator.generateBackendDockerfile(backend);
            files.backendDockerfiles!.push({
                path: `${backend.path}/Dockerfile`,
                content: dockerfile
            });
        }

        // Generate nginx.conf
        const hasFrontend = monorepo.frontends.length > 0;
        const hasBackend = monorepo.backends.length > 0;

        if (hasFrontend) {
            const nginxGeneration = SimpleNginxGenerator.generateWithContext(
                hasFrontend,
                hasBackend,
                this.basePath
            );

            if (nginxGeneration.shouldGenerate) {
                files.nginxConf = nginxGeneration.config!;
            } else {
                skipped.push('nginx.conf: ' + nginxGeneration.reason);
            }
        }

        // Generate docker-compose.yml
        files.dockerCompose = CleanComposeGenerator.generateMonorepoCompose(
            monorepo.frontends,
            monorepo.backends,
            databases
        );

        // Generate .dockerignore
        files.dockerignore = SmartDockerfileGenerator.generateDockerignore();

        return files;
    }

    /**
     * Validate generated files
     */
    private validateGeneratedFiles(files: GeneratedDockerFiles, warnings: string[]): void {
        console.log('[Orchestrator] Validating generated files');

        // Validate docker-compose.yml
        const composeValidation = CleanComposeGenerator.validateCompose(files.dockerCompose);
        if (!composeValidation.isValid) {
            warnings.push(...composeValidation.errors.map(e => `docker-compose.yml: ${e}`));
        }

        // Check for unnecessary elements in compose
        const composeChecks = CleanComposeGenerator.checkForUnnecessaryElements(files.dockerCompose);
        if (composeChecks.warnings.length > 0) {
            warnings.push(...composeChecks.warnings.map(w => `docker-compose.yml: ${w}`));
        }

        // Validate nginx.conf if it exists
        if (files.nginxConf) {
            const nginxValidation = SimpleNginxGenerator.validateNginxConfig(files.nginxConf);
            if (!nginxValidation.isValid) {
                warnings.push(...nginxValidation.errors.map(e => `nginx.conf: ${e}`));
            }
        }
    }

    /**
     * Get user-friendly summary
     */
    static generateSummary(result: GenerationResult): string {
        const { detectionResult, files, warnings, skipped } = result;

        let summary = `## Docker Configuration Generated\n\n`;
        summary += `**Project Type:** ${detectionResult.projectType}\n\n`;

        // Detection details
        if (detectionResult.frontend) {
            summary += `### Frontend Detected\n`;
            summary += `- Framework: ${detectionResult.frontend.framework}`;
            if (detectionResult.frontend.variant) {
                summary += ` (${detectionResult.frontend.variant})`;
            }
            summary += `\n`;
            summary += `- Build Output: \`${detectionResult.frontend.outputFolder}\`\n`;
            summary += `- Package Manager: ${detectionResult.frontend.packageManager}\n`;
            summary += `\n`;
        }

        if (detectionResult.backend) {
            summary += `### Backend Detected\n`;
            summary += `- Framework: ${detectionResult.backend.framework}\n`;
            summary += `- Language: ${detectionResult.backend.language}\n`;
            summary += `\n`;
        }

        if (detectionResult.databases && detectionResult.databases.length > 0) {
            summary += `### Databases Detected\n`;
            for (const db of detectionResult.databases) {
                summary += `- ${db.type}\n`;
            }
            summary += `\n`;
        }

        // Generated files
        summary += `### Generated Files\n`;

        if (files.dockerfile) {
            summary += `- ✅ Dockerfile\n`;
        }
        if (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
            for (const f of files.frontendDockerfiles) {
                summary += `- ✅ ${f.path}\n`;
            }
        }
        if (files.backendDockerfiles && files.backendDockerfiles.length > 0) {
            for (const f of files.backendDockerfiles) {
                summary += `- ✅ ${f.path}\n`;
            }
        }
        summary += `- ✅ docker-compose.yml\n`;
        summary += `- ✅ .dockerignore\n`;

        if (files.nginxConf) {
            summary += `- ✅ nginx.conf\n`;
        }

        // Skipped files
        if (skipped.length > 0) {
            summary += `\n### Skipped Files\n`;
            for (const skip of skipped) {
                summary += `- ⏭️ ${skip}\n`;
            }
        }

        // Warnings
        if (warnings.length > 0) {
            summary += `\n### Warnings\n`;
            for (const warning of warnings) {
                summary += `- ⚠️ ${warning}\n`;
            }
        }

        return summary;
    }

    /**
     * Check for existing files and determine conflicts
     */
    async checkForConflicts(): Promise<{
        hasConflicts: boolean;
        conflicts: Array<{
            file: string;
            exists: boolean;
            path: string;
        }>;
    }> {
        const conflicts: Array<{ file: string; exists: boolean; path: string }> = [];

        const filesToCheck = [
            'Dockerfile',
            'docker-compose.yml',
            'nginx.conf',
            '.dockerignore',
            'frontend/Dockerfile',
            'backend/Dockerfile'
        ];

        for (const file of filesToCheck) {
            const filePath = path.join(this.basePath, file);
            const exists = fs.existsSync(filePath);

            if (exists) {
                conflicts.push({
                    file,
                    exists: true,
                    path: filePath
                });
            }
        }

        return {
            hasConflicts: conflicts.length > 0,
            conflicts
        };
    }
}
