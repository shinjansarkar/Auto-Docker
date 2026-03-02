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
                // Try regeneration with more specific instructions
                console.log('[AIDockerGenerationService] Attempting regeneration with fixes...');
                const regenerated = await this.regenerateWithFixes(techStack, finalValidation.errors);
                finalDockerFiles = regenerated;
                
                // Re-validate the regenerated files
                console.log('[AIDockerGenerationService] Re-validating regenerated files...');
                const revalidationResult = await this.guardrailsService.validateDockerFiles(regenerated);
                
                if (revalidationResult.validationResult && !revalidationResult.validationResult.valid) {
                    console.warn('[AIDockerGenerationService] Regeneration still has issues:', revalidationResult.validationResult.errors);
                    errors.push('Final validation failed even after corrections');
                } else {
                    console.log('[AIDockerGenerationService] ✅ Regeneration successful, validation passed');
                    // Clear previous validation errors since regeneration fixed them
                    const validationErrorMessages = finalValidation.errors.map((e: any) => e.message || String(e));
                    validationErrorMessages.forEach(msg => {
                        const index = errors.indexOf(msg);
                        if (index > -1) {
                            errors.splice(index, 1);
                        }
                    });
                }
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
4. **nginx.conf** - ALWAYS generate for frontend/fullstack projects as reverse proxy

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

${techStack.frontend ? (() => {
            const isSSR = /next\.?js|nuxt|remix|sveltekit|astro.*ssr/i.test(techStack.frontend.framework);
            if (isSSR) {
                return `
## Frontend/Fullstack Dockerfile (SSR — ${techStack.frontend.framework}):
- Stage 1 "builder": Use \`${techStack.baseImage}\`, install ALL deps (including devDependencies), build with \`${techStack.frontend.buildCommand}\`
- Stage 2 "runner": Use \`${techStack.baseImage}\` (Node.js — NOT nginx, this is SSR), copy package files, run \`npm ci --omit=dev\`, copy built output from builder
- For Next.js: copy \`.next\` dir and \`public\` dir. CMD should be \`["node_modules/.bin/next", "start"]\`
- For Nuxt: copy \`.output\` dir. CMD should be \`["node", ".output/server/index.mjs"]\`
- For Remix: copy \`build\` dir. CMD should be \`["node", "build/server/index.js"]\`
- For SvelteKit: copy \`build\` dir. CMD should be \`["node", "build/index.js"]\`
- Expose port ${techStack.frontend.devPort}
- NEVER use nginx for SSR frameworks
`;
            } else {
                return `
## Frontend Dockerfile (SPA — ${techStack.frontend.framework}):
- Stage 1 "builder": Use \`${techStack.baseImage}\`, install ALL deps, build with \`${techStack.frontend.buildCommand}\`
- Stage 2 "runner": Use \`nginx:alpine\`, copy build output from \`${techStack.frontend.buildOutputDir}\` to \`/usr/share/nginx/html\`
- Add SPA routing in nginx (try_files $uri /index.html)
- Expose port 80
`;
            }
        })() : ''}

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

${(techStack.frontend || techStack.projectType === 'fullstack') ? `
## nginx.conf Rules:
${techStack.projectType === 'fullstack' || techStack.frameworks.some((f: string) => /next|nuxt|remix|sveltekit/i.test(f)) ? `### For SSR/Fullstack (Reverse Proxy):
- Listen on port 80
- Proxy requests to backend application at localhost:${techStack.exposedPorts[0] || 3000}
- Add proper proxy headers (X-Real-IP, X-Forwarded-For, X-Forwarded-Proto)
- Enable WebSocket support (Upgrade, Connection headers)
- Configure client_max_body_size for uploads
- Add gzip compression for performance
- Set security headers (X-Frame-Options, X-Content-Type-Options)
- Cache static assets (_next/static with long expiry)` : `### For Static Frontend:
- Listen on port ${techStack.frontend?.devPort || 80}
- Serve from /usr/share/nginx/html
- Configure SPA routing (try_files $uri /index.html)
- Add gzip compression
- Set proper security headers`}
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
                nginxConf: (techStack.frontend || techStack.projectType === 'fullstack') ? this.generateFallbackNginx(techStack) : undefined,
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
     * Fallback Dockerfile generation — produces valid, framework-aware Dockerfiles
     * even when the AI generation pipeline fails.
     */
    private generateFallbackDockerfile(techStack: AIDetectedTechStack): string {
        const { baseImage, exposedPorts, buildSteps, runCommand } = techStack;

        // ── Next.js: multi-stage optimised build ──────────────────────────────
        if (techStack.frameworks.some(f => /next\.?js/i.test(f))) {
            const nodeImage = baseImage.startsWith('node:') ? baseImage : 'node:20-alpine';
            const port = exposedPorts[0] || 3000;
            const buildCmd = techStack.frontend?.buildCommand || 'npm run build';
            return `# Stage 1 — Install all deps & build
FROM ${nodeImage} AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ${buildCmd}

# Stage 2 — Production runner (leaner image, no devDependencies)
FROM ${nodeImage} AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 nextjs

# Copy package files and install production deps only
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Copy built artefacts
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Switch to non-root user
USER nextjs

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
  CMD wget -qO- http://localhost:${port}/ || exit 1

CMD ["node_modules/.bin/next", "start"]
`;
        }

        // ── Vite / CRA / Angular — static build served by nginx ───────────────
        if (techStack.projectType === 'frontend-only' &&
            techStack.frameworks.some(f => /react|vue|angular|svelte|astro|vite/i.test(f))) {
            const nodeImage = baseImage.startsWith('node:') ? baseImage : 'node:20-alpine';
            const buildDir = techStack.frontend?.buildOutputDir || 'dist';
            const port = exposedPorts[0] || 80;
            const buildCmd = techStack.frontend?.buildCommand || 'npm run build';
            return `# Stage 1 — Build
FROM ${nodeImage} AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ${buildCmd}

# Stage 2 — Serve with nginx
FROM nginx:alpine AS runner

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx-app && \\
    adduser -u 1001 -S nginx-app -G nginx-app

COPY --from=builder --chown=nginx-app:nginx-app /app/${buildDir} /usr/share/nginx/html

# Switch to non-root user
USER nginx-app

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget -qO- http://localhost:${port}/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
        }

        // ── Generic Node.js server ─────────────────────────────────────────────
        if (baseImage.startsWith('node:') || techStack.primaryRuntime.toLowerCase().includes('node')) {
            const nodeImage = baseImage.startsWith('node:') ? baseImage : 'node:20-alpine';
            const port = exposedPorts[0] || 3000;
            const installSteps = buildSteps.length > 0
                ? buildSteps.join('\n')
                : 'RUN npm ci --omit=dev';
            const cmdStr = runCommand.startsWith('[') ? runCommand : `["sh", "-c", "${runCommand}"]`;
            return `FROM ${nodeImage}

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 appuser

COPY package*.json ./
${installSteps}

COPY --chown=appuser:nodejs . .

# Switch to non-root user
USER appuser

EXPOSE ${port}

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
  CMD wget -qO- http://localhost:${port}/ || exit 1

CMD ${cmdStr}
`;
        }

        // ── Generic fallback (non-Node) ───────────────────────────────────────
        return `FROM ${baseImage}

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \\
    adduser --system --uid 1001 appuser

# Copy dependency files
COPY package*.json ./

# Install dependencies
${buildSteps.length > 0 ? buildSteps.join('\n') : 'RUN npm install'}

# Copy source code
COPY --chown=appuser:appgroup . .

# Switch to non-root user
USER appuser

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
        const port = techStack.exposedPorts[0] || 3000;
        const isNextJs = techStack.frameworks.some(f => /next\.?js/i.test(f));
        const nodeEnvVar = isNextJs ? 'NODE_ENV' : 'NODE_ENV';

        const dbServices = techStack.databases.map(db => `  ${db.type.toLowerCase()}:
    image: ${db.type.toLowerCase()}:${db.version || 'latest'}
    ports:
      - "${db.port}:${db.port}"
    volumes:
      - ${db.type.toLowerCase()}_data:/var/lib/${db.type.toLowerCase()}/data
    restart: unless-stopped`).join('\n\n');

        const dbVolumes = techStack.databases.map(db => `  ${db.type.toLowerCase()}_data:`).join('\n');

        return `services:
  app:
    build: .
    ports:
      - "${port}:${port}"
    environment:
      ${nodeEnvVar}: production
      PORT: "${port}"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:${port}/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
${dbServices ? `\n${dbServices}` : ''}
${dbVolumes ? `\nvolumes:\n${dbVolumes}` : ''}
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
     * Generates reverse proxy config for fullstack/SSR or static serving for frontend-only
     */
    private generateFallbackNginx(techStack: AIDetectedTechStack): string {
        const isSSRorFullstack = techStack.projectType === 'fullstack' || 
                                 techStack.frameworks.some(f => /next|nuxt|remix|sveltekit/i.test(f));
        
        if (isSSRorFullstack) {
            // Reverse proxy configuration for SSR/fullstack apps
            const backendPort = techStack.exposedPorts[0] || 3000;
            return `# Nginx reverse proxy configuration for ${techStack.frameworks.join(', ')}

upstream backend {
    server app:${backendPort};
}

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Max upload size
    client_max_body_size 10M;

    # Proxy to backend application
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Cache static assets (Next.js, etc.)
    location /_next/static {
        proxy_pass http://backend;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Image optimization
    location /_next/image {
        proxy_pass http://backend;
        proxy_cache_valid 200 7d;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
`;
        } else {
            // Static file serving for frontend-only projects
            const port = techStack.frontend?.devPort || 80;
            return `# Nginx configuration for static frontend serving

server {
    listen ${port};
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
`;
        }
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
