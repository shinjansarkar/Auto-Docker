/**
 * Orchestrator Adapter
 * Bridges between the new DockerGenerationOrchestrator and existing LLMService interface
 * Converts new generation results to legacy DockerFiles format for FileManager compatibility
 */

import { DockerFiles } from './llmService';
import { GenerationResult, GeneratedDockerFiles } from './dockerGenerationOrchestrator';

/**
 * Adapter Class
 */
export class OrchestratorAdapter {

    /**
     * Convert new GenerationResult to legacy DockerFiles format
     */
    static convertToDockerFiles(result: GenerationResult): DockerFiles {
        const { files } = result;

        return {
            dockerfile: this.getDockerfileContent(files),
            dockerCompose: files.dockerCompose,
            dockerIgnore: files.dockerignore,
            nginxConf: files.nginxConf
        };
    }

    /**
     * Get Dockerfile content based on project type
     */
    private static getDockerfileContent(files: GeneratedDockerFiles): string {
        // For single project (frontend-only or backend-only)
        if (files.dockerfile) {
            return files.dockerfile;
        }

        // For fullstack or monorepo, return a helpful message
        if (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) {
            // Return a comment explaining where the Dockerfiles are
            let content = '# This is a multi-service project\n';
            content += '# Dockerfiles have been generated in the following locations:\n\n';

            if (files.frontendDockerfiles) {
                for (const df of files.frontendDockerfiles) {
                    content += `# Frontend: ${df.path}\n`;
                }
            }

            if (files.backendDockerfiles) {
                for (const df of files.backendDockerfiles) {
                    content += `# Backend: ${df.path}\n`;
                }
            }

            content += '\n# Please use docker-compose to build and run all services.\n';

            return content;
        }

        return '# No Dockerfile needed for this project type\n';
    }

    /**
     * Get separate Dockerfiles for multi-service projects
     */
    static getMultiServiceDockerfiles(files: GeneratedDockerFiles): Array<{ path: string; content: string }> {
        const dockerfiles: Array<{ path: string; content: string }> = [];

        if (files.frontendDockerfiles) {
            dockerfiles.push(...files.frontendDockerfiles);
        }

        if (files.backendDockerfiles) {
            dockerfiles.push(...files.backendDockerfiles);
        }

        return dockerfiles;
    }

    /**
     * Check if project is multi-service (fullstack or monorepo)
     */
    static isMultiService(files: GeneratedDockerFiles): boolean {
        return !!(
            (files.frontendDockerfiles && files.frontendDockerfiles.length > 0) ||
            (files.backendDockerfiles && files.backendDockerfiles.length > 0)
        );
    }

    /**
     * Get appropriate file write strategy
     */
    static getFileWriteStrategy(result: GenerationResult): 'single' | 'multi' {
        return this.isMultiService(result.files) ? 'multi' : 'single';
    }

    /**
     * Create user-friendly message about generated files
     */
    static createGenerationMessage(result: GenerationResult): string {
        const { detectionResult, files, warnings, skipped } = result;

        let message = `✅ Docker configuration generated for ${detectionResult.projectType} project\n\n`;

        // List files
        message += 'Generated files:\n';

        if (files.dockerfile) {
            message += '  ✓ Dockerfile\n';
        }

        if (files.frontendDockerfiles) {
            for (const df of files.frontendDockerfiles) {
                message += `  ✓ ${df.path}\n`;
            }
        }

        if (files.backendDockerfiles) {
            for (const df of files.backendDockerfiles) {
                message += `  ✓ ${df.path}\n`;
            }
        }

        message += '  ✓ docker-compose.yml\n';
        message += '  ✓ .dockerignore\n';

        if (files.nginxConf) {
            message += '  ✓ nginx.conf\n';
        }

        // Show skipped
        if (skipped.length > 0) {
            message += '\nSkipped:\n';
            for (const skip of skipped) {
                message += `  ⏭️  ${skip}\n`;
            }
        }

        // Show warnings
        if (warnings.length > 0) {
            message += '\nWarnings:\n';
            for (const warning of warnings) {
                message += `  ⚠️  ${warning}\n`;
            }
        }

        return message;
    }

    /**
     * Convert detection result to human-readable summary
     */
    static createDetectionSummary(result: GenerationResult): string {
        const { detectionResult } = result;

        let summary = 'Project Analysis:\n\n';

        summary += `Type: ${detectionResult.projectType}\n\n`;

        if (detectionResult.frontend) {
            summary += 'Frontend:\n';
            summary += `  Framework: ${detectionResult.frontend.framework}`;
            if (detectionResult.frontend.variant) {
                summary += ` (${detectionResult.frontend.variant})`;
            }
            summary += '\n';
            summary += `  Output: ${detectionResult.frontend.outputFolder}\n`;
            summary += `  Package Manager: ${detectionResult.frontend.packageManager}\n`;
            summary += '\n';
        }

        if (detectionResult.backend) {
            summary += 'Backend:\n';
            summary += `  Framework: ${detectionResult.backend.framework}\n`;
            summary += `  Language: ${detectionResult.backend.language}\n`;
            summary += `  Port: ${detectionResult.backend.port || 8000}\n`;
            summary += '\n';
        }

        if (detectionResult.databases && detectionResult.databases.length > 0) {
            summary += 'Databases:\n';
            for (const db of detectionResult.databases) {
                summary += `  - ${db.type}\n`;
            }
            summary += '\n';
        }

        if (detectionResult.monorepo) {
            summary += 'Monorepo:\n';
            summary += `  Tool: ${detectionResult.monorepo.tool || 'detected'}\n`;
            summary += `  Frontends: ${detectionResult.monorepo.frontends.length}\n`;
            summary += `  Backends: ${detectionResult.monorepo.backends.length}\n`;
        }

        return summary;
    }

    /**
     * Check if LLM fallback is needed
     * Return true if detection failed or if complex scenario needs LLM
     */
    static shouldUseLLMFallback(result: GenerationResult): boolean {
        const { detectionResult } = result;

        // Check if detection was successful
        if (detectionResult.projectType === 'backend-only' && !detectionResult.backend?.exists) {
            return true; // Detection failed, use LLM
        }

        if (detectionResult.projectType === 'frontend-only' && !detectionResult.frontend?.exists) {
            return true; // Detection failed, use LLM
        }

        // Complex scenarios that might benefit from LLM (optional)
        // For now, we trust our detection system
        return false;
    }

    /**
     * Merge LLM result with orchestrator result (for hybrid approach)
     */
    static mergWithLLMResult(
        orchestratorResult: GenerationResult,
        llmResult: DockerFiles
    ): DockerFiles {
        const { files } = orchestratorResult;

        // Prefer orchestrator results, fallback to LLM if needed
        return {
            dockerfile: files.dockerfile || llmResult.dockerfile,
            dockerCompose: files.dockerCompose || llmResult.dockerCompose,
            dockerIgnore: files.dockerignore || llmResult.dockerIgnore,
            nginxConf: files.nginxConf || llmResult.nginxConf
        };
    }

    /**
     * Get build instructions for user
     */
    static getBuildInstructions(result: GenerationResult): string {
        const { detectionResult } = result;

        let instructions = '🚀 To build and run your containers:\n\n';

        if (detectionResult.projectType === 'frontend-only') {
            instructions += '1. Build the image:\n';
            instructions += '   docker build -t myapp-frontend .\n\n';
            instructions += '2. Run with docker-compose:\n';
            instructions += '   docker-compose up -d\n\n';
            instructions += '3. Access your application:\n';
            instructions += '   http://localhost:80\n';
        } else if (detectionResult.projectType === 'backend-only') {
            instructions += '1. Build and run with docker-compose:\n';
            instructions += '   docker-compose up -d\n\n';
            instructions += '2. Access your API:\n';
            instructions += `   http://localhost:${detectionResult.backend?.port || 8000}\n`;
        } else if (detectionResult.projectType === 'fullstack') {
            instructions += '1. Build and run all services:\n';
            instructions += '   docker-compose up -d\n\n';
            instructions += '2. Access your application:\n';
            instructions += '   Frontend: http://localhost:80\n';
            instructions += `   Backend: http://localhost:${detectionResult.backend?.port || 8000}\n`;
        } else if (detectionResult.projectType === 'monorepo') {
            instructions += '1. Build and run all services:\n';
            instructions += '   docker-compose up -d\n\n';
            instructions += '2. Services will be available at:\n';

            if (detectionResult.monorepo?.frontends) {
                for (const frontend of detectionResult.monorepo.frontends) {
                    instructions += `   - ${frontend.path}: http://localhost:${frontend.port || 3000}\n`;
                }
            }

            if (detectionResult.monorepo?.backends) {
                for (const backend of detectionResult.monorepo.backends) {
                    instructions += `   - ${backend.path}: http://localhost:${backend.port || 8000}\n`;
                }
            }
        }

        instructions += '\n💡 Tip: Use "docker-compose logs -f" to view logs\n';

        return instructions;
    }
}
