import * as vscode from 'vscode';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectStructure } from './projectAnalyzer';
import { BOMHandler } from './criticalErrorHandling';

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
        const provider = config.get<string>('apiProvider', 'openai');

        const prompt = this.createPrompt(projectStructure);

        try {
            let response: string;

            if (provider === 'openai' && this.openaiClient) {
                response = await this.callOpenAI(prompt);
            } else if (provider === 'gemini' && this.geminiClient) {
                response = await this.callGemini(prompt);
            } else {
                throw new Error(`${provider} API is not configured. Please set up API keys in settings.`);
            }

            return this.parseResponse(response, projectStructure);
        } catch (error) {
            console.error('LLM API Error:', error);
            throw new Error(`Failed to generate Docker files: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
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
Generate COMPACT, production-ready Docker files for this project:

PROJECT: ${projectStructure.projectType}${projectStructure.frontend ? ` (${projectStructure.frontend})` : ''}${projectStructure.backend ? ` + ${projectStructure.backend}` : ''}${projectStructure.database ? ` + ${projectStructure.database}` : ''}

FILES: ${projectStructure.files.slice(0, 10).join(', ')}

DEPS: ${JSON.stringify(projectStructure.dependencies?.packageJson?.dependencies || projectStructure.dependencies?.requirementsTxt?.split('\n').slice(0, 5) || {}, null, 0)}

${projectStructure.hasEnvFile ? `⚠️ .env file detected with variables: ${projectStructure.envVars?.slice(0, 10).join(', ')}` : ''}
${projectStructure.frontend?.includes('vite') ? `⚠️ CRITICAL: This is a VITE project - build output goes to ${buildDir} NOT build/` : ''}
${isFrontend ? `⚠️ CRITICAL: Frontend app - Use nginx reverse proxy on port 80 pointing to app:3000` : ''}
${isNextJs ? `⚠️ CRITICAL: Next.js - Use standalone output with node server.js, NOT nginx` : ''}
${isNuxt ? `⚠️ CRITICAL: Nuxt - Use .output directory with node .output/server/index.mjs` : ''}
${isSvelteKit ? `⚠️ CRITICAL: SvelteKit - Use node adapter with node build` : ''}
${isPython && pythonFramework === 'flask' ? `⚠️ CRITICAL: Flask app - MUST install gunicorn and use CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]` : ''}
${isPython && pythonFramework === 'django' ? `⚠️ CRITICAL: Django app - MUST install gunicorn and use CMD ["gunicorn", "wsgi:application"]` : ''}
${isPython && pythonFramework === 'fastapi' ? `⚠️ CRITICAL: FastAPI app - MUST install uvicorn and use CMD ["uvicorn", "main:app"]` : ''}

Generate ${projectStructure.hasMultiStage ? 'multi-stage' : 'single-stage'} Dockerfile, docker-compose.yml, .dockerignore${includeNginx && projectStructure.frontend ? ', nginx.conf' : ''}.

REQUIREMENTS:
- COMPACT files, no comments except essential ones
- Use alpine/slim images for smaller size
- Only necessary ports and volumes
- Essential environment variables only
- ${projectStructure.database ? `Include ${projectStructure.database} service` : 'No database needed'}
${projectStructure.frontend?.includes('vite') ? `- MUST use ${buildDir} directory (Vite builds to ${buildDir})` : ''}
${projectStructure.hasEnvFile ? `- Add env_file: .env in docker-compose.yml for app service` : ''}
${isPython ? `- For Python: install production server (gunicorn/uvicorn) separately in Dockerfile` : ''}
${isFrontend && !isNextJs && !isNuxt && !isSvelteKit ? `- For Static SPAs: Single nginx service with try_files for routing` : ''}
${isFrontend && !isNextJs && !isNuxt && !isSvelteKit ? `- nginx.conf MUST include: try_files $uri $uri/ /index.html for SPA routing` : ''}
- ALWAYS use fallback: if [ -f package-lock.json ]; npm ci; elif [ -f yarn.lock ]; yarn install; elif [ -f pnpm-lock.yaml ]; pnpm install; else npm install; fi
- For static frontends: Single service (web or app) exposing port 80 with nginx
- For SSR (Next.js/Nuxt/SvelteKit): Expose Node.js app on port 3000
- Production-optimized, secure

FORMAT (NO extra text, only code blocks):

\`\`\`dockerfile
# Minimal Dockerfile here
\`\`\`

\`\`\`yaml
# Minimal docker-compose.yml here
\`\`\`

\`\`\`
# Essential .dockerignore here
\`\`\`

${includeNginx && projectStructure.frontend ? `
\`\`\`nginx
# Minimal nginx.conf here
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
            // Use reverse proxy mode for development or when configured
            const useReverseProxy = this.shouldUseReverseProxy(projectStructure);
            result.nginxConf = useReverseProxy 
                ? this.generateNginxReverseProxy() 
                : this.generateFallbackNginx();
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
                return `FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with fallback
RUN if [ -f package-lock.json ]; then npm ci --only=production --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --prod --frozen-lockfile; \\
    else npm install --production; fi

# Copy application
COPY . .

EXPOSE 3000
CMD ["npm", "start"]`;
            }
        } else if (projectStructure.dependencies.requirementsTxt) {
            // Detect Flask/Django/FastAPI
            const requirements = projectStructure.dependencies.requirementsTxt.toLowerCase();
            const isFlask = requirements.includes('flask');
            const isDjango = requirements.includes('django');
            const isFastAPI = requirements.includes('fastapi');
            
            if (isFlask) {
                return `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \\
    && pip install --no-cache-dir gunicorn

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser \\
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# Use gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]`;
            } else if (isDjango) {
                return `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    postgresql-client \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \\
    && pip install --no-cache-dir gunicorn

# Copy application code
COPY . .

# Run migrations and collect static files
RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "wsgi:application"]`;
            } else if (isFastAPI) {
                return `FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \\
    && pip install --no-cache-dir uvicorn[standard]

# Copy application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`;
            } else {
                return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`;
            }
        }

        return `FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE 8080
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
        
        // Reverse proxy mode: separate app and nginx services
        if (useReverseProxy && projectStructure.frontend) {
            return `services:
  app:
    build: .
    ports:
      - "${appPort}:${appPort}"${hasEnv ? `
    env_file:
      - .env` : ''}${projectStructure.database ? `
    depends_on:
      - ${projectStructure.database}` : ''}
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    networks:
      - app-network${projectStructure.database ? `

  ${projectStructure.database}:
    image: ${this.getDatabaseImage(projectStructure.database)}
    environment:
      POSTGRES_DB: app
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - db:/var/lib/postgresql/data
    networks:
      - app-network` : ''}

networks:
  app-network:
    driver: bridge${projectStructure.database ? `

volumes:
  db:` : ''}`;
        }
        
        // For static frontends (React, Vue, Vite, Angular) - single nginx service
        if (projectStructure.frontend && !isSsr && !projectStructure.backend) {
            return `services:
  web:
    build: .
    ports:
      - "80:80"${hasEnv ? `
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
        return `FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with fallback
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

# Copy all source files
COPY . .

# Expose port for dev server
EXPOSE 3000

# Run development server
# This will work for most frameworks: Vite, CRA, Vue CLI, Angular, etc.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]`;
    }

    private generateFallbackNginx(): string {
        return `# ============================================================================
# Production-Ready Nginx Configuration for Static Frontend (React/Vue/Angular)
# ============================================================================

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

# Upstream backend service (for API proxying)
upstream backend_service {
    server backend:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    charset utf-8;
    
    # Security: Hide server tokens
    server_tokens off;
    
    # Root directory for static files
    root /usr/share/nginx/html;
    index index.html index.htm;
    
    # ========================================================================
    # LOGGING CONFIGURATION
    # ========================================================================
    access_log /var/log/nginx/access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/error.log warn;
    
    # ========================================================================
    # REQUEST LIMITS & TIMEOUTS
    # ========================================================================
    client_max_body_size 100m;
    client_body_timeout 30s;
    client_header_timeout 30s;
    keepalive_timeout 65s;
    send_timeout 30s;
    
    # ========================================================================
    # GZIP COMPRESSION
    # ========================================================================
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        text/x-component 
        text/x-cross-domain-policy 
        application/javascript 
        application/json 
        application/xml+rss 
        application/atom+xml 
        image/svg+xml 
        font/truetype 
        font/opentype 
        application/vnd.ms-fontobject 
        application/font-woff2;
    gzip_disable "MSIE [1-6]\\.(?!.*SV1)";
    
    # ========================================================================
    # GLOBAL SECURITY HEADERS - Applied to all responses
    # ========================================================================
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
    
    # Content Security Policy - Prevents XSS attacks
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'self';" always;
    
    # ========================================================================
    # RATE LIMITING
    # ========================================================================
    limit_req zone=general burst=100 nodelay;
    limit_req_status 429;
    
    # ========================================================================
    # SPA ROUTING - Client-side routing with try_files
    # ========================================================================
    location / {
        # Rate limit this location
        limit_req zone=general burst=100 nodelay;
        
        # SPA Routing: try file, then directory, then fallback to index.html
        try_files $uri $uri/ /index.html;
        
        # Cache control for HTML (never cache)
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }
    
    # ========================================================================
    # STATIC ASSETS WITH HASH IN FILENAME - Cache for 1 year
    # ========================================================================
    location ~* ^/(?:assets|static)/.+\\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header ETag "W/\\"123456\\"";
        access_log off;
    }
    
    # ========================================================================
    # PUBLIC ASSETS - Cache for 30 days
    # ========================================================================
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|webp|webm|mp4)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        add_header Vary "Accept-Encoding";
        access_log off;
    }
    
    # ========================================================================
    # API PROXY - For backend services
    # ========================================================================
    location /api/ {
        # Stricter rate limiting for API
        limit_req zone=api burst=200 nodelay;
        
        proxy_pass http://backend_service;
        proxy_http_version 1.1;
        
        # Connection settings
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Cache control
        proxy_cache_bypass $http_upgrade;
    }
    
    # ========================================================================
    # WEBSOCKET SUPPORT - For real-time features
    # ========================================================================
    location /socket.io/ {
        proxy_pass http://backend_service/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket upgrade headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        
        # Extended timeouts for long-lived connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
    
    # ========================================================================
    # DENY ACCESS TO SENSITIVE FILES
    # ========================================================================
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # ========================================================================
    # HEALTH CHECK ENDPOINT
    # ========================================================================
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
    
    # ========================================================================
    # ERROR PAGES
    # ========================================================================
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /usr/share/nginx/html;
        access_log off;
    }
}`;
    }

    private generateNginxReverseProxy(): string {
        return `# ============================================================================
# Production-Ready Nginx Reverse Proxy Configuration
# Frontend + Backend API Routing with Security & Performance
# ============================================================================

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

# Upstream servers with health monitoring
upstream frontend_service {
    server app:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream backend_service {
    server backend:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    charset utf-8;
    
    # Security: Hide nginx version
    server_tokens off;
    
    # ========================================================================
    # LOGGING CONFIGURATION
    # ========================================================================
    access_log /var/log/nginx/access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/error.log warn;
    
    # ========================================================================
    # REQUEST LIMITS & TIMEOUTS
    # ========================================================================
    client_max_body_size 100m;
    client_body_timeout 30s;
    client_header_timeout 30s;
    keepalive_timeout 65s;
    send_timeout 30s;
    
    # ========================================================================
    # GZIP COMPRESSION - For proxied responses
    # ========================================================================
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types 
        text/plain 
        text/css 
        text/xml 
        text/javascript 
        application/javascript 
        application/json 
        application/xml+rss 
        application/atom+xml 
        image/svg+xml 
        font/truetype 
        font/opentype 
        application/vnd.ms-fontobject 
        application/font-woff2;
    
    # ========================================================================
    # GLOBAL SECURITY HEADERS - Applied to all responses
    # ========================================================================
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
    
    # Content Security Policy - Prevents XSS and injection attacks
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'self';" always;
    
    # ========================================================================
    # RATE LIMITING - Global configuration
    # ========================================================================
    limit_req zone=general burst=100 nodelay;
    limit_req_status 429;

    # ========================================================================
    # FRONTEND APPLICATION PROXY (React/Vue/Angular)
    # ========================================================================
    location / {
        # Apply rate limiting
        limit_req zone=general burst=100 nodelay;
        
        # Proxy to frontend development/production server
        proxy_pass http://frontend_service;
        proxy_http_version 1.1;
        
        # Connection upgrade for WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        
        # Pass original client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        
        # Timeouts for frontend
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering configuration
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # ========================================================================
    # BACKEND API PROXY (Express/FastAPI/Django)
    # ========================================================================
    location /api/ {
        # Apply stricter rate limiting for API endpoints
        limit_req zone=api burst=200 nodelay;
        
        proxy_pass http://backend_service/api/;
        proxy_http_version 1.1;
        
        # Keep connections alive to backend
        proxy_set_header Connection "";
        
        # Pass client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $server_name;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts for API (longer than frontend)
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering for API responses
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # ========================================================================
    # WEBSOCKET SUPPORT - Real-time applications (Socket.io)
    # ========================================================================
    location /socket.io/ {
        proxy_pass http://backend_service/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket specific headers for connection upgrade
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        
        # Pass client information
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for WebSocket (bidirectional communication)
        proxy_buffering off;
        
        # Extended timeouts for long-lived WebSocket connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_connect_timeout 30s;
    }

    # ========================================================================
    # DENY ACCESS TO SENSITIVE FILES & DIRECTORIES
    # ========================================================================
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    # ========================================================================
    # HEALTH CHECK ENDPOINT - For monitoring & orchestration
    # ========================================================================
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }

    # ========================================================================
    # ERROR PAGES
    # ========================================================================
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
        access_log off;
    }
}`;
    }
}