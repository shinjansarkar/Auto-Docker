import * as vscode from 'vscode';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectStructure } from './projectAnalyzer';
import { BOMHandler } from './criticalErrorHandling';
import { ComprehensiveAnalysis } from './comprehensiveAnalyzer';
import { createAdvancedProductionPrompt } from './advancedProductionPrompt';

export interface DockerFiles {
    dockerfile: string;
    dockerCompose: string;
    dockerIgnore: string;
    nginxConf?: string;
}

export class LLMService {
    private openaiClient?: OpenAI;
    private geminiClient?: GoogleGenerativeAI;

    constructor() {
        this.initializeClients();
    }

    private initializeClients() {
        const config = vscode.workspace.getConfiguration('autoDocker');

        const openaiKey = config.get<string>('openaiApiKey');
        if (openaiKey) {
            this.openaiClient = new OpenAI({
                apiKey: openaiKey
            });
        }

        const geminiKey = config.get<string>('geminiApiKey');
        if (geminiKey) {
            this.geminiClient = new GoogleGenerativeAI(geminiKey);
        }
    }

    async generateDockerFiles(projectStructure: ProjectStructure): Promise<DockerFiles> {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const preferredProvider = config.get<string>('apiProvider', 'openai');
        const prompt = this.createPrompt(projectStructure);

        // Try providers in order: preferred first, then fallback to others
        const providers: Array<{ name: string; fn: () => Promise<string> }> = [];

        // Add preferred provider first
        if (preferredProvider === 'openai' && this.openaiClient) {
            providers.push({ name: 'OpenAI', fn: () => this.callOpenAIWithRetry(prompt) });
        } else if (preferredProvider === 'gemini' && this.geminiClient) {
            providers.push({ name: 'Gemini', fn: () => this.callGeminiWithRetry(prompt) });
        } else if (preferredProvider === 'anthropic') {
            providers.push({ name: 'Anthropic Claude', fn: () => this.callAnthropicWithRetry(prompt) });
        }

        // Add fallback providers
        if (preferredProvider !== 'openai' && this.openaiClient) {
            providers.push({ name: 'OpenAI', fn: () => this.callOpenAIWithRetry(prompt) });
        }
        if (preferredProvider !== 'gemini' && this.geminiClient) {
            providers.push({ name: 'Gemini', fn: () => this.callGeminiWithRetry(prompt) });
        }
        if (preferredProvider !== 'anthropic') {
            providers.push({ name: 'Anthropic Claude', fn: () => this.callAnthropicWithRetry(prompt) });
        }

        let lastError: Error | null = null;

        // Try each provider
        for (const provider of providers) {
            try {
                console.log(`🔄 Attempting ${provider.name}...`);
                vscode.window.showInformationMessage(`🔄 Generating with ${provider.name}...`);

                const response = await provider.fn();
                vscode.window.showInformationMessage(`✅ Successfully generated with ${provider.name}!`);
                return this.parseResponse(response, projectStructure);
            } catch (error: any) {
                lastError = error;
                const errorMsg = error instanceof Error ? error.message : String(error);
                console.error(`❌ ${provider.name} failed:`, errorMsg);

                // Check if it's a quota/rate limit error
                if (this.isQuotaError(error)) {
                    vscode.window.showWarningMessage(
                        `⚠️ ${provider.name} quota exceeded. Trying next provider...`
                    );
                } else if (this.isAuthError(error)) {
                    vscode.window.showWarningMessage(
                        `⚠️ ${provider.name} authentication failed. Trying next provider...`
                    );
                } else {
                    vscode.window.showWarningMessage(
                        `⚠️ ${provider.name} error: ${errorMsg}. Trying next provider...`
                    );
                }

                // Continue to next provider
                continue;
            }
        }

        // All providers failed, use fallback templates
        console.log('⚠️ All API providers failed. Using fallback templates.');
        vscode.window.showWarningMessage(
            '⚠️ All APIs temporarily unavailable. Using built-in templates. Some customization may be reduced.'
        );

        return this.generateFallbackDockerFiles(projectStructure);
    }

    /**
     * Generate Docker files from comprehensive codebase analysis
     * Sends complete structured analysis to AI for maximum accuracy
     */
    async generateFromComprehensiveAnalysis(analysis: ComprehensiveAnalysis): Promise<DockerFiles> {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const preferredProvider = config.get<string>('apiProvider', 'gemini'); // Default to Gemini for structured data

        // Create structured prompt with comprehensive analysis (Advanced Production Generator)
        const prompt = createAdvancedProductionPrompt(analysis);

        // Try providers in order
        const providers: Array<{ name: string; fn: () => Promise<string> }> = [];

        if (preferredProvider === 'gemini' && this.geminiClient) {
            providers.push({ name: 'Gemini', fn: () => this.callGeminiWithRetry(prompt) });
        } else if (preferredProvider === 'openai' && this.openaiClient) {
            providers.push({ name: 'OpenAI', fn: () => this.callOpenAIWithRetry(prompt) });
        }

        // Add fallback providers
        if (preferredProvider !== 'gemini' && this.geminiClient) {
            providers.push({ name: 'Gemini', fn: () => this.callGeminiWithRetry(prompt) });
        }
        if (preferredProvider !== 'openai' && this.openaiClient) {
            providers.push({ name: 'OpenAI', fn: () => this.callOpenAIWithRetry(prompt) });
        }

        let lastError: Error | null = null;

        for (const provider of providers) {
            try {
                console.log(`🔄 Generating with ${provider.name} using comprehensive analysis...`);
                const response = await provider.fn();
                console.log(`✅ Successfully generated with ${provider.name}!`);

                // Convert analysis to ProjectStructure for parsing compatibility
                const projectStructure = this.convertAnalysisToProjectStructure(analysis);
                return this.parseResponse(response, projectStructure);
            } catch (error: any) {
                lastError = error;
                console.error(`❌ ${provider.name} failed:`, error);
                continue;
            }
        }

        // Fallback
        console.log('⚠️ All AI providers failed. Using fallback templates.');
        const projectStructure = this.convertAnalysisToProjectStructure(analysis);
        return this.generateFallbackDockerFiles(projectStructure);
    }

    /**
     * Create comprehensive prompt with full structured analysis
     */
    private createComprehensivePrompt(analysis: ComprehensiveAnalysis): string {
        const hasBackend = analysis.backends.length > 0;
        const hasFrontend = analysis.frontends.length > 0;
        const isMonorepo = analysis.isMonorepo;

        return `
# COMPREHENSIVE CODEBASE ANALYSIS FOR DOCKER GENERATION

## PROJECT STRUCTURE
- **Project Root**: ${analysis.projectRoot}
- **Is Monorepo**: ${isMonorepo}
- **Workspaces**: ${analysis.workspaces?.join(', ') || 'N/A'}

## FRONTEND DETECTION
${hasFrontend ? analysis.frontends.map((fe, i) => `
### Frontend #${i + 1}
- **Path**: ${fe.path}
- **Framework**: ${fe.framework}${fe.variant ? ` (${fe.variant})` : ''}
- **Version**: ${fe.version || 'latest'}
- **Package Manager**: ${fe.packageManager}
- **Build Tool**: ${fe.buildTool || 'N/A'}
- **Build Command**: ${fe.buildCommand || 'npm run build'}
- **Output Folder**: **${fe.outputFolder}** ⚠️ CRITICAL - USE THIS EXACT FOLDER
- **Port**: ${fe.port || 3000}
- **TypeScript**: ${fe.hasTypeScript}
- **Environment Files**: ${fe.envFiles.join(', ') || 'None'}
- **Dependencies**: ${Object.keys(fe.dependencies).slice(0, 10).join(', ')}
`).join('\n') : '❌ NO FRONTEND DETECTED'}

## BACKEND DETECTION
${hasBackend ? analysis.backends.map((be, i) => `
### Backend #${i + 1}
- **Path**: ${be.path}
- **Framework**: ${be.framework}
- **Language**: ${be.language}
- **Version**: ${be.version || 'latest'}
- **Package Manager**: ${be.packageManager || 'N/A'}
- **Main File**: ${be.mainFile || 'N/A'}
- **Port**: ${be.port || 8000}
- **Has Tests**: ${be.hasTests}
- **Environment Files**: ${be.envFiles.join(', ') || 'None'}
`).join('\n') : '❌ NO BACKEND DETECTED'}

## DATABASE DETECTION
${analysis.databases.length > 0 ? analysis.databases.map(db => `- **${db.type}**${db.version ? ` (${db.version})` : ''}`).join('\n') : '❌ NO DATABASE DETECTED'}

## ADDITIONAL SERVICES
${Object.keys(analysis.services).length > 0 ? Object.entries(analysis.services).map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`).join('\n') : 'None'}

## BUILD TOOLS & MONOREPO
${Object.keys(analysis.buildTools).length > 0 ? Object.entries(analysis.buildTools).map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`).join('\n') : 'None'}

## ENVIRONMENT VARIABLES
- **Files Found**: ${analysis.environmentVariables.files.join(', ') || 'None'}
- **Variables Count**: ${Object.keys(analysis.environmentVariables.variables).length}
- **Sample Variables**: ${Object.keys(analysis.environmentVariables.variables).slice(0, 10).join(', ')}

## EXISTING DOCKER FILES
${Object.entries(analysis.existingDockerFiles).map(([key, value]) => `- **${key}**: ${value || 'Not found'}`).join('\n')}

## SPECIAL CONFIGURATIONS
- **Prisma**: ${analysis.specialConfigs.hasPrisma}
- **GraphQL**: ${analysis.specialConfigs.hasGraphQL}
- **WebSocket**: ${analysis.specialConfigs.hasWebSocket}
- **Authentication**: ${analysis.specialConfigs.hasAuth}
- **ORM**: ${analysis.specialConfigs.hasORM}${analysis.specialConfigs.ormType ? ` (${analysis.specialConfigs.ormType})` : ''}

## FILE STRUCTURE
- **Source Dir**: ${analysis.fileStructure.srcDir || 'N/A'}
- **Public Dir**: ${analysis.fileStructure.publicDir || 'N/A'}
- **Build Dir**: ${analysis.fileStructure.buildDir || 'N/A'}
- **Test Dir**: ${analysis.fileStructure.testDir || 'N/A'}

---

# 🚨 CRITICAL RULES FOR DOCKER FILE GENERATION

## RULE #1: NGINX CONFIGURATION MUST BE A SEPARATE FILE
❌ **NEVER** put nginx.conf content inside the Dockerfile
✅ **ALWAYS** generate nginx.conf as a SEPARATE file
✅ Reference it in Dockerfile with: COPY nginx.conf /etc/nginx/conf.d/default.conf

## RULE #2: USE EXACT OUTPUT FOLDERS DETECTED
${hasFrontend ? analysis.frontends.map(fe => `- For **${fe.framework}** at **${fe.path}**: Use **${fe.outputFolder}** directory`).join('\n') : ''}

## RULE #3: FRONTEND-ONLY vs FULLSTACK NGINX
${!hasBackend ? `
🔴 **FRONTEND-ONLY PROJECT**
- Generate nginx.conf with ONLY static file serving
- Include try_files for SPA routing
- **NO** proxy_pass or backend proxy configuration
- **NO** backend service in docker-compose.yml
` : `
🟢 **FULLSTACK PROJECT**
- Generate nginx.conf with static serving + API proxy
- Add proxy_pass for /api/ routes to backend
- Include both frontend and backend services in docker-compose.yml
`}

## RULE #4: MONOREPO HANDLING
${isMonorepo ? `
🟠 **MONOREPO DETECTED**
- Generate separate Dockerfiles for each service
- Place Dockerfile in each service directory
- Generate root-level docker-compose.yml with all services
- Use correct context paths for each service
` : ''}

## RULE #5: PACKAGE MANAGER DETECTION
${hasFrontend ? analysis.frontends.map(fe => `- **${fe.path}**: Use **${fe.packageManager}** with appropriate install command`).join('\n') : ''}

## RULE #6: DO NOT GENERATE .env.example
❌ **NEVER** generate .env.example file
✅ Reference existing .env files in docker-compose.yml if detected

## RULE #7: MULTI-STAGE BUILDS
- Use multi-stage builds for ALL frontend projects
- Stage 1: node:20-alpine AS builder (build process)
- Stage 2: nginx:alpine (production serve)

## RULE #8: BACKEND FRAMEWORKS
${hasBackend ? analysis.backends.map(be => {
            if (be.language === 'python') {
                if (be.framework.includes('fastapi')) {
                    return `- **FastAPI**: Install uvicorn, use CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`;
                } else if (be.framework.includes('django')) {
                    return `- **Django**: Install gunicorn, use CMD ["gunicorn", "wsgi:application", "--bind", "0.0.0.0:8000"]`;
                } else if (be.framework.includes('flask')) {
                    return `- **Flask**: Install gunicorn, use CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]`;
                }
            }
            return `- **${be.framework}**: Standard ${be.language} setup`;
        }).join('\n') : 'N/A'}
    }

---

# 📦 REQUIRED OUTPUT

Generate the following files:

1. ** Dockerfile ** (or multiple if monorepo)
    2. ** docker - compose.yml **
        3. **.dockerignore **
        4. ** nginx.conf ** (if frontend exists and NOT SSR framework like Next.js / Nuxt / SvelteKit)

** FORMAT **: Use code blocks with appropriate language tags
    - dockerfile
    - yaml
    - text(for .dockerignore)
    - nginx(for nginx.conf)

** IMPORTANT **: Return ONLY the code blocks, no explanatory text before or after.
`;
    }

    /**
     * Convert ComprehensiveAnalysis to ProjectStructure for compatibility
     */
    private convertAnalysisToProjectStructure(analysis: ComprehensiveAnalysis): ProjectStructure {
        const hasFrontend = analysis.frontends.length > 0;
        const hasBackend = analysis.backends.length > 0;

        let projectType = 'unknown';
        if (hasFrontend && hasBackend) {
            projectType = 'fullstack';
        } else if (hasFrontend) {
            projectType = 'frontend';
        } else if (hasBackend) {
            projectType = 'backend';
        }

        return {
            projectType,
            frontend: hasFrontend ? analysis.frontends[0].framework : undefined,
            backend: hasBackend ? analysis.backends[0].framework : undefined,
            database: analysis.databases.length > 0 ? analysis.databases[0].type : undefined,
            databases: analysis.databases.map(db => db.type),
            files: [],
            dependencies: hasFrontend ? {
                packageJson: {
                    dependencies: analysis.frontends[0].dependencies,
                    devDependencies: analysis.frontends[0].devDependencies
                }
            } : {},
            hasMultiStage: hasFrontend,
            description: `${projectType} application`,
            hasEnvFile: analysis.environmentVariables.files.length > 0,
            envVars: Object.keys(analysis.environmentVariables.variables),
            packageManager: hasFrontend ? analysis.frontends[0].packageManager : undefined,
            buildCommand: hasFrontend ? analysis.frontends[0].buildCommand : undefined,
            outputDirectory: hasFrontend ? analysis.frontends[0].outputFolder : undefined,
            isFrontendOnly: hasFrontend && !hasBackend,
            isBackendOnly: !hasFrontend && hasBackend,
            isFullstack: hasFrontend && hasBackend
        } as ProjectStructure;
    }

    private isQuotaError(error: any): boolean {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes('429') ||
            message.includes('quota') ||
            message.includes('Too Many Requests') ||
            message.includes('rate limit');
    }

    private isAuthError(error: any): boolean {
        const message = error instanceof Error ? error.message : String(error);
        return message.includes('401') ||
            message.includes('403') ||
            message.includes('Unauthorized') ||
            message.includes('invalid') ||
            message.includes('not configured');
    }

    private async callOpenAI(prompt: string): Promise<string> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const config = vscode.workspace.getConfiguration('autoDocker');
        const model = config.get<string>('model', 'gpt-4');

        const response = await this.openaiClient.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert DevOps engineer specializing in Docker containerization. Generate production-ready Docker configuration files based on project analysis.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4000,
            temperature: 0.3
        });

        return response.choices[0]?.message?.content || '';
    }

    private async callGemini(prompt: string): Promise<string> {
        if (!this.geminiClient) {
            throw new Error('Gemini client not initialized');
        }

        const config = vscode.workspace.getConfiguration('autoDocker');
        const model = config.get<string>('model', 'gemini-pro');

        const generativeModel = this.geminiClient.getGenerativeModel({ model });
        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;

        return response.text();
    }

    private async callAnthropic(prompt: string): Promise<string> {
        throw new Error('Anthropic API not yet configured in this build');
    }

    private async callOpenAIWithRetry(prompt: string, maxAttempts: number = 2): Promise<string> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.callOpenAI(prompt);
            } catch (error: any) {
                // Don't retry quota errors - go to next provider instead
                if (this.isQuotaError(error)) {
                    throw error;
                }

                // Retry transient errors with exponential backoff
                if (attempt < maxAttempts) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    console.log(`🔄 OpenAI retry attempt ${attempt}/${maxAttempts} in ${delayMs}ms...`);
                    await this.delay(delayMs);
                } else {
                    throw error;
                }
            }
        }
        throw new Error('OpenAI call failed after retries');
    }

    private async callGeminiWithRetry(prompt: string, maxAttempts: number = 2): Promise<string> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.callGemini(prompt);
            } catch (error: any) {
                // Don't retry quota errors - go to next provider instead
                if (this.isQuotaError(error)) {
                    throw error;
                }

                // Retry transient errors with exponential backoff
                if (attempt < maxAttempts) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    console.log(`🔄 Gemini retry attempt ${attempt}/${maxAttempts} in ${delayMs}ms...`);
                    await this.delay(delayMs);
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Gemini call failed after retries');
    }

    private async callAnthropicWithRetry(prompt: string, maxAttempts: number = 2): Promise<string> {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await this.callAnthropic(prompt);
            } catch (error: any) {
                // Don't retry quota errors - go to next provider instead
                if (this.isQuotaError(error)) {
                    throw error;
                }

                // Retry transient errors with exponential backoff
                if (attempt < maxAttempts) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000;
                    console.log(`🔄 Anthropic retry attempt ${attempt}/${maxAttempts} in ${delayMs}ms...`);
                    await this.delay(delayMs);
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Anthropic call failed after retries');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private createPrompt(projectStructure: ProjectStructure): string {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const includeNginx = config.get<boolean>('includeNginx', true);

        // Detect build output directory
        const buildDir = this.getBuildDirectory(projectStructure);

        // Detect Python framework
        const isPython = projectStructure.backend === 'flask' || projectStructure.backend === 'django' || projectStructure.backend === 'fastapi';
        const pythonFramework = projectStructure.backend;
        const isFrontend = projectStructure.frontend && (projectStructure.frontend === 'react' || projectStructure.frontend.includes('vite') || projectStructure.frontend === 'vue' || projectStructure.frontend === 'angular');
        const isNextJs = projectStructure.frontend === 'nextjs';
        const isNuxt = projectStructure.frontend === 'nuxt';
        const isSvelteKit = projectStructure.frontend === 'sveltekit';

        return `
Generate PRODUCTION-READY Docker files following AutoDocker Policy:

PROJECT: ${projectStructure.projectType}${projectStructure.frontend ? ` (${projectStructure.frontend})` : ''}${projectStructure.backend ? ` + ${projectStructure.backend}` : ''}${projectStructure.database ? ` + ${projectStructure.database}` : ''}

FILES: ${projectStructure.files.slice(0, 10).join(', ')}

DEPS: ${JSON.stringify(projectStructure.dependencies?.packageJson?.dependencies || projectStructure.dependencies?.requirementsTxt?.split('\n').slice(0, 5) || {}, null, 0)}

${projectStructure.hasEnvFile ? `⚠️ .env file detected with variables: ${projectStructure.envVars?.slice(0, 10).join(', ')}` : ''}
${projectStructure.frontend?.includes('vite') ? `⚠️ CRITICAL: This is a VITE project - build output goes to ${buildDir} NOT build/` : ''}

🔴 POLICY RULES (MUST FOLLOW):

${isFrontend && !projectStructure.backend ? `
=== FRONTEND-ONLY PROJECT ===
- Use multi-stage Dockerfile: Stage 1 (node builder) -> Stage 2 (nginx:stable-alpine)
- Generate SEPARATE nginx.conf file with production config
- Dockerfile: COPY nginx.conf /etc/nginx/conf.d/default.conf
- nginx.conf MUST include: try_files $uri $uri/ /index.html for SPA routing
- docker-compose.yml: SINGLE service "web" on port 80 (NO separate nginx service)
- NO /api/ proxy (no backend exists)
` : ''}

${projectStructure.backend && projectStructure.frontend ? `
=== FULL-STACK PROJECT ===
- Generate separate Dockerfiles for frontend and backend
- docker-compose.yml: THREE services (frontend, backend, nginx)
- nginx acts as reverse proxy: serves frontend static + proxies /api/ to backend
- ONLY nginx exposes port 80 to host
- Frontend and backend use internal networks (NO direct port exposure to host)
- nginx.conf: location / -> frontend static, location /api/ -> proxy_pass http://backend:${projectStructure.backend === 'flask' ? '5000' : projectStructure.backend === 'django' || projectStructure.backend === 'fastapi' ? '8000' : '3000'}
` : ''}

${projectStructure.backend && !projectStructure.frontend ? `
=== BACKEND-ONLY PROJECT ===
- Single Dockerfile for backend
- docker-compose.yml: ONE service "app" exposing backend port directly
- NO nginx.conf needed (API-only)
${isPython && pythonFramework === 'flask' ? `- Flask: MUST install gunicorn, CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]` : ''}
${isPython && pythonFramework === 'django' ? `- Django: MUST install gunicorn, CMD ["gunicorn", "wsgi:application", "--bind", "0.0.0.0:8000"]` : ''}
${isPython && pythonFramework === 'fastapi' ? `- FastAPI: MUST install uvicorn, CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]` : ''}
` : ''}

${isNextJs ? `⚠️ Next.js: Use standalone output, CMD ["node", "server.js"], port 3000 (NOT nginx)` : ''}
${isNuxt ? `⚠️ Nuxt: Use .output directory, CMD ["node", ".output/server/index.mjs"], port 3000` : ''}
${isSvelteKit ? `⚠️ SvelteKit: Use node adapter, CMD ["node", "build"], port 3000` : ''}

PRODUCTION REQUIREMENTS:
- Multi-stage builds for smaller images
- Use alpine/slim base images
- Non-root user when feasible
- Healthchecks in docker-compose.yml
- restart: unless-stopped
- Security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
${projectStructure.hasEnvFile ? `- Include env_file: .env in docker-compose.yml` : ''}
${projectStructure.database ? `- Include ${projectStructure.database} service with named volumes` : ''}

FORMAT (NO extra text, only code blocks):

\`\`\`dockerfile
# Production-ready multi-stage Dockerfile here
\`\`\`

\`\`\`yaml
# Production docker-compose.yml here
\`\`\`

\`\`\`
# Essential .dockerignore here
\`\`\`

${isFrontend || (projectStructure.backend && projectStructure.frontend) ? `
\`\`\`nginx
# nginx.conf (for frontend or reverse proxy)
\`\`\`
` : ''}`;
    }

    private getBuildDirectory(projectStructure: ProjectStructure): string {
        // Vite uses 'dist' by default
        if (projectStructure.frontend?.includes('vite')) {
            return 'dist';
        }
        // Create React App uses 'build'
        if (projectStructure.frontend === 'react') {
            return 'build';
        }
        // Angular uses 'dist'
        if (projectStructure.frontend === 'angular') {
            return 'dist';
        }
        // Vue CLI uses 'dist'
        if (projectStructure.frontend === 'vue') {
            return 'dist';
        }
        // Svelte uses 'public/build' or 'build'
        if (projectStructure.frontend === 'svelte' || projectStructure.frontend === 'sveltekit') {
            return 'build';
        }
        // Solid.js uses 'dist'
        if (projectStructure.frontend === 'solid') {
            return 'dist';
        }
        // Preact uses 'build'
        if (projectStructure.frontend === 'preact') {
            return 'build';
        }
        // Next.js uses '.next' and special setup
        if (projectStructure.frontend === 'nextjs') {
            return '.next';
        }
        // Nuxt uses '.nuxt' and '.output'
        if (projectStructure.frontend === 'nuxt') {
            return '.output';
        }
        // Default to 'dist'
        return 'dist';
    }

    private parseResponse(response: string, projectStructure: ProjectStructure): DockerFiles {
        // CRITICAL FIX for Parsing Errors: Add comprehensive YAML/JSON validation
        const result: DockerFiles = {
            dockerfile: '',
            dockerCompose: '',
            dockerIgnore: '',
            nginxConf: undefined
        };

        try {
            // Extract Dockerfile
            const dockerfileMatch = response.match(/```dockerfile\n([\s\S]*?)\n```/i);
            if (dockerfileMatch) {
                try {
                    const dockerfile = dockerfileMatch[1].trim();
                    // Basic validation of Dockerfile syntax
                    if (this.validateDockerfileSyntax(dockerfile)) {
                        result.dockerfile = dockerfile;
                    } else {
                        console.warn('Dockerfile validation failed, using fallback');
                    }
                } catch (error) {
                    console.warn('Error processing Dockerfile:', error);
                }
            }

            // Extract docker-compose.yml with YAML validation
            const composeMatch = response.match(/```ya?ml\n([\s\S]*?)\n```/i);
            if (composeMatch) {
                try {
                    const compose = composeMatch[1].trim();
                    // CRITICAL FIX: Validate YAML/JSON structure
                    if (this.validateYAMLStructure(compose)) {
                        result.dockerCompose = compose;
                    } else {
                        console.warn('Docker Compose validation failed, using fallback');
                    }
                } catch (error) {
                    console.warn('Error processing docker-compose:', error);
                }
            }

            // Extract .dockerignore
            const dockerignoreMatch = response.match(/```(?:dockerignore|text)?\n([\s\S]*?)\n```/);
            if (dockerignoreMatch) {
                try {
                    const dockerignore = dockerignoreMatch[1].trim();
                    if (dockerignore.length > 0) {
                        result.dockerIgnore = dockerignore;
                    }
                } catch (error) {
                    console.warn('Error processing .dockerignore:', error);
                }
            }

            // Extract nginx.conf if present
            const nginxMatch = response.match(/```nginx\n([\s\S]*?)\n```/i);
            if (nginxMatch) {
                try {
                    const nginx = nginxMatch[1].trim();
                    // CRITICAL FIX: Validate nginx configuration syntax
                    if (this.validateNginxSyntax(nginx)) {
                        result.nginxConf = nginx;
                    } else {
                        console.warn('Nginx config validation failed');
                    }
                } catch (error) {
                    console.warn('Error processing nginx config:', error);
                }
            }

            // Fallback extraction if specific markers not found
            if (!result.dockerfile || !result.dockerCompose || !result.dockerIgnore) {
                this.fallbackExtraction(response, result, projectStructure);
            }
        } catch (error) {
            console.error('Fatal error in parseResponse:', error);
            this.fallbackExtraction(response, result, projectStructure);
        }

        return result;
    }

    // CRITICAL FIX: Add validation methods for YAML, Dockerfile, and nginx syntax
    private validateYAMLStructure(yaml: string): boolean {
        try {
            // Check for basic YAML structure validity
            if (!yaml || yaml.trim().length === 0) {
                return false;
            }

            // Check for required docker-compose keys
            const hasServices = yaml.includes('services:');
            if (!hasServices) {
                console.warn('YAML missing "services:" key');
                return false;
            }

            // Basic indentation check
            const lines = yaml.split('\n');
            let previousIndent = 0;
            for (const line of lines) {
                if (line.trim().length === 0) continue;

                const indent = line.search(/\S/);
                // Allow flexibility but ensure minimal structure
                if (indent < 0) return false;
            }

            return true;
        } catch (error) {
            console.error('YAML validation error:', error);
            return false;
        }
    }

    private validateDockerfileSyntax(dockerfile: string): boolean {
        try {
            if (!dockerfile || dockerfile.trim().length === 0) {
                return false;
            }

            // Check for required Dockerfile instructions
            const upperDockerfile = dockerfile.toUpperCase();
            const hasFrom = upperDockerfile.includes('FROM');

            if (!hasFrom) {
                console.warn('Dockerfile missing FROM instruction');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Dockerfile validation error:', error);
            return false;
        }
    }

    private validateNginxSyntax(nginx: string): boolean {
        try {
            if (!nginx || nginx.trim().length === 0) {
                return false;
            }

            // Basic nginx syntax check
            const hasServerBlock = /\s*server\s*\{/.test(nginx);
            const properlyFormatted = (nginx.match(/\{/g) || []).length === (nginx.match(/\}/g) || []).length;

            if (!properlyFormatted) {
                console.warn('Nginx config has unbalanced braces');
                return false;
            }

            return true;
        } catch (error) {
            console.error('Nginx validation error:', error);
            return false;
        }
    }

    private fallbackExtraction(response: string, result: DockerFiles, projectStructure: ProjectStructure) {
        // Simple fallback templates if LLM response parsing fails
        if (!result.dockerfile) {
            result.dockerfile = this.generateFallbackDockerfile(projectStructure);
        }

        if (!result.dockerCompose) {
            result.dockerCompose = this.generateFallbackCompose(projectStructure);
        }

        if (!result.dockerIgnore) {
            result.dockerIgnore = this.generateFallbackDockerignore();
        }

        if (!result.nginxConf && projectStructure.frontend) {
            // For frontend-only apps, always use fallback (conditional logic built-in)
            // For fullstack (frontend + backend), use reverse proxy
            if (projectStructure.backend) {
                result.nginxConf = this.generateNginxReverseProxy(projectStructure);
            } else {
                result.nginxConf = this.generateFallbackNginx(projectStructure);
            }
        }
    }

    private shouldUseReverseProxy(projectStructure: ProjectStructure): boolean {
        // Check user configuration first
        const config = vscode.workspace.getConfiguration('autoDocker');
        const userPreference = config.get<boolean>('useReverseProxy', true);

        // If user disabled reverse proxy, always use static serving
        if (!userPreference) {
            return false;
        }

        // ALWAYS use reverse proxy for ANY frontend application detected
        // This includes: React, Vue, Angular, Vite, Svelte, Solid, Preact, Ember
        // Excludes: SSR frameworks (Next.js, Nuxt, SvelteKit) - they run their own Node server
        if (projectStructure.frontend) {
            const ssrFrameworks = ['nextjs', 'nuxt', 'sveltekit'];
            const isSSR = ssrFrameworks.includes(projectStructure.frontend);

            // Use reverse proxy for all non-SSR frontends
            return !isSSR;
        }

        return false;
    }

    private generateFallbackDockerFiles(projectStructure: ProjectStructure): DockerFiles {
        console.log('📋 Generating Docker files using built-in templates...');

        return {
            dockerfile: this.generateFallbackDockerfile(projectStructure),
            dockerCompose: this.generateFallbackCompose(projectStructure),
            dockerIgnore: this.generateFallbackDockerignore(),
            nginxConf: this.generateFallbackNginx(projectStructure)
        };
    }

    private generateFallbackDockerfile(projectStructure: ProjectStructure): string {
        if (projectStructure.dependencies.packageJson) {
            const pkg = projectStructure.dependencies.packageJson;
            const buildDir = this.getBuildDirectory(projectStructure);

            // Check if it's a frontend project that needs build
            if (projectStructure.frontend) {
                // Framework-specific Dockerfiles
                if (projectStructure.frontend === 'nextjs') {
                    return this.generateNextJsDockerfile();
                }

                if (projectStructure.frontend === 'nuxt') {
                    return this.generateNuxtDockerfile();
                }

                if (projectStructure.frontend === 'sveltekit') {
                    return this.generateSvelteKitDockerfile();
                }

                // Check if using reverse proxy mode
                const useReverseProxy = this.shouldUseReverseProxy(projectStructure);
                if (useReverseProxy) {
                    return this.generateFrontendDevDockerfile();
                }

                // Generic frontend build (React, Vue, Vite, Svelte, Solid, Preact, etc.)
                return `FROM node:18-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with fallback
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

# Copy source and build
COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss image/svg+xml;

    # SPA fallback
    location / {
        try_files \\$uri \\$uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Copy built files
COPY --from=build /app/${buildDir} /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
            } else {
                // Backend Node.js application
                return `# ==================== NODE.JS MULTI-STAGE BUILD ====================
# Stage 1: Dependencies and Build Stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install; \\
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; \\
    else npm ci --prefer-offline --no-audit; fi

# Copy source code
COPY . .

# Build application if build script exists
RUN npm run build 2>/dev/null || echo "No build script"

# ==================== STAGE 2: DEPENDENCIES LAYER ====================
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./

# Install production dependencies only
RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --prod --frozen-lockfile; \\
    else npm ci --prefer-offline --no-audit --only=production; fi

# ==================== STAGE 3: RUNTIME STAGE ====================
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 -G nodejs

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./

# Copy built application
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/build ./build
COPY --chown=nodejs:nodejs --from=builder /app/src ./src

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]`;
            }
        } else if (projectStructure.dependencies.requirementsTxt) {
            // Detect Flask/Django/FastAPI
            const requirements = projectStructure.dependencies.requirementsTxt.toLowerCase();
            const isFlask = requirements.includes('flask');
            const isDjango = requirements.includes('django');
            const isFastAPI = requirements.includes('fastapi');

            if (isFlask) {
                return `# ==================== FLASK MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Create wheels directory
RUN mkdir -p /wheels

# Install dependencies and create wheels
RUN pip install --user --no-cache-dir wheel && \\
    pip wheel --user --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM python:3.11-slim

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Copy wheels from builder
COPY --from=builder /wheels /wheels
COPY requirements.txt ./

# Install wheels
RUN pip install --no-cache-dir /wheels/* && \\
    rm -rf /wheels && \\
    pip install --no-cache-dir gunicorn

# Copy application code
COPY --chown=python:python . .

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER python

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]`;
            } else if (isDjango) {
                return `# ==================== DJANGO MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Create wheels directory
RUN mkdir -p /wheels

# Install dependencies and create wheels
RUN pip install --user --no-cache-dir wheel && \\
    pip wheel --user --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 \\
    postgresql-client \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Copy wheels from builder
COPY --from=builder /wheels /wheels
COPY requirements.txt ./

# Install wheels
RUN pip install --no-cache-dir /wheels/* && \\
    rm -rf /wheels && \\
    pip install --no-cache-dir gunicorn

# Copy application code
COPY --chown=python:python . .

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Run migrations and collect static files
RUN python manage.py collectstatic --noinput || true

USER python

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "wsgi:application"]`;
            } else if (isFastAPI) {
                return `# ==================== FASTAPI MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Create wheels directory
RUN mkdir -p /wheels

# Install dependencies and create wheels
RUN pip install --user --no-cache-dir wheel && \\
    pip wheel --user --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Copy wheels from builder
COPY --from=builder /wheels /wheels
COPY requirements.txt ./

# Install wheels and uvicorn
RUN pip install --no-cache-dir /wheels/* && \\
    rm -rf /wheels && \\
    pip install --no-cache-dir uvicorn[standard]

# Copy application code
COPY --chown=python:python . .

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

USER python

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`;
            } else {
                // Generic Python multi-stage build
                return `# ==================== PYTHON MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Create wheels directory
RUN mkdir -p /wheels

# Install dependencies and create wheels
RUN pip install --user --no-cache-dir wheel && \\
    pip wheel --user --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Copy wheels from builder
COPY --from=builder /wheels /wheels
COPY requirements.txt ./

# Install wheels
RUN pip install --no-cache-dir /wheels/* && \\
    rm -rf /wheels

# Copy application code
COPY --chown=python:python . .

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

USER python

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "app.py"]`;
            }
        }

        return `# ==================== GENERIC ALPINE BUILD ====================
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S app && \\
    adduser -S app -u 1001 -G app

# Copy application code
COPY --chown=app:app . .

# Switch to non-root user
USER app

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["sh"]`;
    }

    private generateFallbackCompose(projectStructure: ProjectStructure): string {
        // Determine correct port based on framework
        let appPort = '3000';
        let isSsr = false; // Server-side rendering frameworks
        const useReverseProxy = this.shouldUseReverseProxy(projectStructure);

        // SSR frameworks that need their own server
        if (projectStructure.frontend === 'nextjs' ||
            projectStructure.frontend === 'nuxt' ||
            projectStructure.frontend === 'sveltekit') {
            isSsr = true;
            appPort = '3000';
        } else if (projectStructure.frontend === 'react' ||
            projectStructure.frontend?.includes('vite') ||
            projectStructure.frontend === 'vue' ||
            projectStructure.frontend === 'angular' ||
            projectStructure.frontend === 'svelte' ||
            projectStructure.frontend === 'solid' ||
            projectStructure.frontend === 'preact') {
            // Static build frontends
            appPort = useReverseProxy ? '3000' : '80'; // Use 3000 for reverse proxy, 80 for direct nginx
        } else if (projectStructure.backend === 'flask') {
            appPort = '5000';
        } else if (projectStructure.backend === 'django' || projectStructure.backend === 'fastapi') {
            appPort = '8000';
        }

        const hasEnv = projectStructure.hasEnvFile;

        // FRONTEND-ONLY: Single container with embedded nginx (multi-stage Dockerfile handles everything)
        // Policy: For frontend-only projects, nginx is already in Dockerfile's final stage
        if (projectStructure.frontend && !isSsr && !projectStructure.backend) {
            return `services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ${projectStructure.frontend || 'frontend'}
    ports:
      - "80:80"
    restart: unless-stopped${hasEnv ? `
    env_file:
      - .env` : ''}${projectStructure.database ? `
    depends_on:
      - ${projectStructure.database}
    networks:
      - app-network` : ''}
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 5s
      retries: 3${projectStructure.database ? `

  ${projectStructure.database}:
    image: ${this.getDatabaseImage(projectStructure.database)}
    container_name: ${projectStructure.database}
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped` : ''}${projectStructure.database ? `

networks:
  app-network:
    driver: bridge

volumes:
  db_data:` : ''}`;
        }

        // FULL-STACK/MONOREPO: Separate containers with nginx as reverse proxy
        // Policy: nginx serves frontend static + proxies /api/ to backend
        if (projectStructure.frontend && projectStructure.backend) {
            return `services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: frontend
    networks:
      - app-network
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: backend
    networks:
      - app-network
    restart: unless-stopped${hasEnv ? `
    env_file:
      - .env` : ''}${projectStructure.database ? `
    depends_on:
      - ${projectStructure.database}` : ''}

  nginx:
    image: nginx:stable-alpine
    container_name: nginx-gateway
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - frontend
      - backend
    networks:
      - app-network
    restart: unless-stopped${projectStructure.database ? `

  ${projectStructure.database}:
    image: ${this.getDatabaseImage(projectStructure.database)}
    container_name: ${projectStructure.database}
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped` : ''}

networks:
  app-network:
    driver: bridge${projectStructure.database ? `

volumes:
  db_data:` : ''}`;
        } else {
            // SSR frameworks or backend - expose app port directly
            return `services:
  app:
    build: .
    ports:
      - "${appPort}:${appPort}"${hasEnv ? `
    env_file:
      - .env` : ''}${projectStructure.database ? `
    depends_on:
      - ${projectStructure.database}` : ''}${projectStructure.database ? `

  ${projectStructure.database}:
    image: ${this.getDatabaseImage(projectStructure.database)}
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - db:/var/lib/postgresql/data` : ''}${projectStructure.database ? `

volumes:
  db:` : ''}`;
        }
    }

    private getDatabaseImage(database: string): string {
        switch (database) {
            case 'postgresql': return 'postgres:15-alpine';
            case 'mysql': return 'mysql:8.0';
            case 'mongodb': return 'mongo:6.0';
            default: return 'postgres:15-alpine';
        }
    }

    private generateFallbackDockerignore(): string {
        return `node_modules
.git
*.log
.vscode
.DS_Store
__pycache__
*.pyc
venv
.pytest_cache
coverage
dist
build
README.md`;
    }

    private generateNextJsDockerfile(): string {
        return `FROM node:18-alpine AS deps
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    else npm install; fi

FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js app
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create system user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]`;
    }

    private generateNuxtDockerfile(): string {
        return `FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/.output /app/.output

EXPOSE 3000
ENV PORT 3000
ENV HOST 0.0.0.0

CMD ["node", ".output/server/index.mjs"]`;
    }

    private generateSvelteKitDockerfile(): string {
        return `FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000
ENV PORT 3000

CMD ["node", "build"]`;
    }

    private generateFrontendDevDockerfile(): string {
        return `# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock* pnpm-lock.yaml* ./

# Install dependencies with fallback
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install; fi

# Copy all source files
COPY . .

# Build for production
RUN npm run build

# Stage 2: Nginx Runtime
FROM nginx:alpine

# Copy custom nginx config (EXTERNAL FILE)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Run as non-root user
USER nginx

CMD ["nginx", "-g", "daemon off;"]`;
    }

    private generateFallbackNginx(projectStructure?: ProjectStructure): string {
        const hasBackend = projectStructure?.backend ? true : false;

        // Frontend-only: Simple SPA configuration
        if (!hasBackend && projectStructure?.frontend) {
            return `server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}`;
        }

        const backendPort = projectStructure?.backend === 'flask' ? '5000' : 
                           (projectStructure?.backend === 'django' || projectStructure?.backend === 'fastapi') ? '8000' : '3000';

        return `# Production Nginx Reverse Proxy Configuration
# Serves frontend static files + proxies /api/ to backend

server {
    listen 80;
    listen [::]:80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://backend:${backendPort}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}`;
    }

    private generateNginxReverseProxy(projectStructure?: ProjectStructure): string {
        const hasBackend = projectStructure?.backend ? true : false;

        const basicConfig = `server {
    listen 80;

    # Serve frontend build
    location / {
        try_files $uri $uri/ /index.html;
        root /usr/share/nginx/html;
    }`;

        const backendProxy = `

    # Backend reverse proxy
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }`;

        const closing = `
}`;

        return basicConfig + (hasBackend ? backendProxy : '') + closing;
    }
}