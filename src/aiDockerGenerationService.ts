/**
 * AI Docker Generation Service
 * Complete AI-powered Docker file generation with guardrails
 * Flow: AI Detection -> AI Generation -> Guardrails Validation -> Output
 */

import * as vscode from 'vscode';
import { AITechStackDetector, AIDetectedTechStack } from './aiTechStackDetector';
import { GuardrailsService } from './guardrailsService';
import { ValidatedDockerFiles } from './guardrailsTypes';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AIDockerGenerationResult {
    success: boolean;
    techStack: AIDetectedTechStack;
    dockerFiles: ValidatedDockerFiles;
    warnings: string[];
    errors: string[];
    generationTime: number;
}

/**
 * AI Docker Generation Service
 * Uses AI for both detection and generation, with guardrails for validation
 */
export class AIDockerGenerationService {
    private workspaceRoot: string;
    private aiDetector: AITechStackDetector;
    private guardrailsService: GuardrailsService;
    private geminiClient?: GoogleGenerativeAI;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.aiDetector = new AITechStackDetector(workspaceRoot);
        this.guardrailsService = new GuardrailsService();
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
    }

    /**
     * Main method: Complete AI-powered Docker generation pipeline
     */
    async generate(): Promise<AIDockerGenerationResult> {
        const startTime = Date.now();
        const warnings: string[] = [];
        const errors: string[] = [];

        try {
            // STEP 1: AI-Based Tech Stack Detection
            console.log('[AIDockerGenerationService] Step 1: AI Tech Stack Detection...');
            const techStack = await this.aiDetector.detectTechStack();
            
            if (techStack.confidence < 0.5) {
                warnings.push(`Low confidence detection (${(techStack.confidence * 100).toFixed(0)}%). Results may need manual review.`);
            }
            
            console.log('[AIDockerGenerationService] Tech Stack Detected:', {
                language: techStack.primaryLanguage,
                runtime: techStack.primaryRuntime,
                frameworks: techStack.frameworks,
                type: techStack.projectType,
                confidence: techStack.confidence
            });

            // STEP 2: AI-Powered Docker File Generation
            console.log('[AIDockerGenerationService] Step 2: AI Docker File Generation...');
            const rawDockerFiles = await this.generateDockerFiles(techStack);

            // STEP 3: Guardrails Validation
            console.log('[AIDockerGenerationService] Step 3: Guardrails Validation...');
            const validationResult = await this.guardrailsService.validateDockerFiles(rawDockerFiles);

            if (validationResult.validationResult && !validationResult.validationResult.valid) {
                console.warn('[AIDockerGenerationService] Validation found issues:', validationResult.validationResult.errors);
                errors.push(...validationResult.validationResult.errors.map((e: any) => e.message || String(e)));
            }

            if (validationResult.validationResult && validationResult.validationResult.warnings.length > 0) {
                warnings.push(...validationResult.validationResult.warnings.map((w: any) => w.message || String(w)));
            }

            // STEP 4: Use validated files
            let finalDockerFiles = rawDockerFiles;

            // STEP 5: Final verification
            console.log('[AIDockerGenerationService] Step 4: Final Verification...');
            const finalValidation = validationResult.validationResult;
            
            if (finalValidation && !finalValidation.valid) {
                errors.push('Final validation failed even after corrections');
                // Try regeneration with more specific instructions
                console.log('[AIDockerGenerationService] Attempting regeneration with fixes...');
                const regenerated = await this.regenerateWithFixes(techStack, finalValidation.errors);
                finalDockerFiles = regenerated;
            }

            const generationTime = Date.now() - startTime;

            console.log('[AIDockerGenerationService] ✅ Generation Complete:', {
                time: `${generationTime}ms`,
                warnings: warnings.length,
                errors: errors.length,
                validated: finalValidation?.valid || false
            });

            return {
                success: errors.length === 0,
                techStack,
                dockerFiles: finalDockerFiles,
                warnings,
                errors,
                generationTime
            };

        } catch (error) {
            const err = error as Error;
            console.error('[AIDockerGenerationService] Generation failed:', err);
            
            errors.push(`Generation failed: ${err.message}`);
            
            return {
                success: false,
                techStack: await this.aiDetector.detectTechStack().catch(() => ({} as AIDetectedTechStack)),
                dockerFiles: this.getEmptyDockerFiles(),
                warnings,
                errors,
                generationTime: Date.now() - startTime
            };
        }
    }

    /**
     * Generate Docker files using AI based on detected tech stack
     */
    private async generateDockerFiles(techStack: AIDetectedTechStack): Promise<ValidatedDockerFiles> {
        const prompt = this.createGenerationPrompt(techStack);
        
        if (!this.geminiClient) {
            throw new Error('Gemini API key is not configured. Please set your key in settings.');
        }
        const response = await this.generateWithGemini(prompt);
        return this.parseGeneratedFiles(response, techStack);
    }

    /**
     * Create generation prompt based on detected tech stack
     */
    private createGenerationPrompt(techStack: AIDetectedTechStack): string {
        return `You are an expert DevOps engineer. Generate complete, production-ready Docker configuration files.

# DETECTED TECH STACK
${JSON.stringify(techStack, null, 2)}

# GENERATION REQUIREMENTS

Generate the following files based on the detected tech stack:

1. **Dockerfile** - Multi-stage, optimized, production-ready
2. **docker-compose.yml** - Complete service orchestration with all detected services
3. **.dockerignore** - Comprehensive ignore patterns
4. **nginx.conf** - Only if frontend detected, production-ready configuration

# CRITICAL RULES

## Dockerfile Rules:
- Use multi-stage builds for optimization
- Use exact base image from detection: \`${techStack.baseImage}\`
- Copy dependency files first, then install, then copy source (layer caching)
- Use non-root user for security
- Set proper WORKDIR
- Expose correct ports: ${techStack.exposedPorts.join(', ')}
- Use HEALTHCHECK for production readiness
- Minimize layers and image size

${techStack.frontend ? `
## Frontend Dockerfile (if frontend):
- Stage 1: Build stage with full dev dependencies
- Build command: \`${techStack.frontend.buildCommand}\`
- Stage 2: Production stage with nginx
- Copy EXACT build output from: \`${techStack.frontend.buildOutputDir}\`
- Serve on port ${techStack.frontend.devPort}
` : ''}

${techStack.backend ? `
## Backend Dockerfile (if backend):
- Install production dependencies only
- Copy source code after dependencies
- Use CMD to start: \`${techStack.runCommand}\`
- Expose port ${techStack.backend.port}
` : ''}

## docker-compose.yml Rules:
- Version 3.8 or higher
- Include all detected services: ${techStack.projectType}
${techStack.databases.length > 0 ? `- Add database services: ${techStack.databases.map(db => db.type).join(', ')}` : ''}
${techStack.cacheStores.length > 0 ? `- Add cache services: ${techStack.cacheStores.join(', ')}` : ''}
- Use named volumes for data persistence
- Use bridge networks
- Set proper environment variables
- Add health checks for all services
- Use depends_on for service ordering

## .dockerignore Rules:
- Exclude node_modules, venv, __pycache__, etc.
- Exclude .git, .env, IDE files
- Exclude build artifacts
- Exclude test files

${techStack.frontend && techStack.projectType === 'fullstack' ? `
## nginx.conf Rules (for frontend):
- Listen on port ${techStack.frontend.devPort}
- Serve from /usr/share/nginx/html
- Configure reverse proxy to backend if fullstack
- Add gzip compression
- Set proper headers
- Configure SPA routing (try_files)
` : ''}

# OUTPUT FORMAT

Respond with ONLY the following JSON structure - NO OTHER TEXT:

\`\`\`json
{
  "dockerfile": "complete Dockerfile content as string",
  "dockerCompose": "complete docker-compose.yml content as string",
  "dockerignore": "complete .dockerignore content as string",
  "nginxConf": "nginx.conf content (or empty string if not needed)"
}
\`\`\`

Generate production-ready, secure, optimized Docker configurations NOW.`;
    }

    /**
     * Generate using Gemini
     */
    private async generateWithGemini(prompt: string): Promise<string> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }
        const config = vscode.workspace.getConfiguration('autoDocker');
        const modelName = config.get<string>('geminiModel', 'gemini-2.0-flash');
        const model = this.geminiClient.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8000,
            }
        });
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }

    /**
     * Parse generated files from AI response
     */
    private parseGeneratedFiles(response: string, techStack: AIDetectedTechStack): ValidatedDockerFiles {
        try {
            // Extract JSON from markdown code blocks
            let jsonStr = response.trim();
            jsonStr = jsonStr.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '');
            
            const parsed = JSON.parse(jsonStr);
            
            return {
                dockerfile: parsed.dockerfile || this.generateFallbackDockerfile(techStack),
                dockerCompose: parsed.dockerCompose || this.generateFallbackCompose(techStack),
                dockerIgnore: parsed.dockerignore || this.generateFallbackDockerignore(),
                nginxConf: parsed.nginxConf || undefined,
                validationResult: {
                    valid: true,
                    errors: [],
                    warnings: [],
                    corrections_made: [],
                    validation_score: 100,
                    reask_count: 0
                }
            };
            
        } catch (error) {
            console.error('[AIDockerGenerationService] Failed to parse AI response:', error);
            
            // Fallback: generate basic files based on tech stack
            return {
                dockerfile: this.generateFallbackDockerfile(techStack),
                dockerCompose: this.generateFallbackCompose(techStack),
                dockerIgnore: this.generateFallbackDockerignore(),
                nginxConf: techStack.frontend ? this.generateFallbackNginx(techStack) : undefined,
                validationResult: {
                    valid: false,
                    errors: [{ field: 'parse', message: 'Failed to parse AI response', severity: 'critical' }],
                    warnings: [],
                    corrections_made: [],
                    validation_score: 50,
                    reask_count: 0
                }
            };
        }
    }

    /**
     * Regenerate with specific fixes based on validation errors
     */
    private async regenerateWithFixes(techStack: AIDetectedTechStack, errors: any[]): Promise<ValidatedDockerFiles> {
        const errorMessages = errors.map(e => e.message || e.toString()).join('\n');
        
        const fixPrompt = `The previous Docker files had these validation errors:

${errorMessages}

Using the same tech stack:
${JSON.stringify(techStack, null, 2)}

Generate corrected Docker files that fix these issues. Output in JSON format:
{
  "dockerfile": "...",
  "dockerCompose": "...",
  "dockerignore": "...",
  "nginxConf": "..."
}`;

        const response = await this.generateWithGemini(fixPrompt);
        return this.parseGeneratedFiles(response, techStack);
    }

    /**
     * Fallback Dockerfile generation
     */
    private generateFallbackDockerfile(techStack: AIDetectedTechStack): string {
        const { baseImage, exposedPorts, buildSteps, runCommand } = techStack;
        
        return `FROM ${baseImage}

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
${buildSteps.length > 0 ? buildSteps.join('\n') : 'RUN npm install'}

# Copy source code
COPY . .

# Expose ports
${exposedPorts.map(port => `EXPOSE ${port}`).join('\n')}

# Start application
CMD ${runCommand}
`;
    }

    /**
     * Fallback docker-compose.yml generation
     */
    private generateFallbackCompose(techStack: AIDetectedTechStack): string {
        return `version: '3.8'

services:
  app:
    build: .
    ports:
      - "${techStack.exposedPorts[0] || 3000}:${techStack.exposedPorts[0] || 3000}"
    environment:
      NODE_ENV: production
    restart: unless-stopped

${techStack.databases.map(db => `  ${db.type}:
    image: ${db.type}:${db.version || 'latest'}
    ports:
      - "${db.port}:${db.port}"
    volumes:
      - ${db.type}_data:/var/lib/${db.type}/data
    restart: unless-stopped
`).join('\n')}

volumes:
${techStack.databases.map(db => `  ${db.type}_data:`).join('\n')}
`;
    }

    /**
     * Fallback .dockerignore generation
     */
    private generateFallbackDockerignore(): string {
        return `node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
*.md
.vscode
.idea
dist
build
coverage
.DS_Store
`;
    }

    /**
     * Fallback nginx.conf generation
     */
    private generateFallbackNginx(techStack: AIDetectedTechStack): string {
        const port = techStack.frontend?.devPort || 80;
        
        return `server {
    listen ${port};
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
`;
    }

    /**
     * Get empty Docker files structure
     */
    private getEmptyDockerFiles(): ValidatedDockerFiles {
        return {
            dockerfile: '',
            dockerCompose: '',
            dockerIgnore: '',
            validationResult: {
                valid: false,
                errors: [{ field: 'general', message: 'No files generated', severity: 'critical' }],
                warnings: [],
                corrections_made: [],
                validation_score: 0,
                reask_count: 0
            }
        };
    }
}
