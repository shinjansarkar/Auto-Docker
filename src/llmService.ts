import * as vscode from 'vscode';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectStructure } from './projectAnalyzer';

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

        return `
Generate COMPACT, production-ready Docker files for this project:

PROJECT: ${projectStructure.projectType}${projectStructure.frontend ? ` (${projectStructure.frontend})` : ''}${projectStructure.backend ? ` + ${projectStructure.backend}` : ''}${projectStructure.database ? ` + ${projectStructure.database}` : ''}

FILES: ${projectStructure.files.slice(0, 10).join(', ')}

DEPS: ${JSON.stringify(projectStructure.dependencies?.packageJson?.dependencies || projectStructure.dependencies?.requirementsTxt?.split('\n').slice(0, 5) || {}, null, 0)}

${projectStructure.hasEnvFile ? `⚠️ .env file detected with variables: ${projectStructure.envVars?.slice(0, 10).join(', ')}` : ''}
${projectStructure.frontend?.includes('vite') ? `⚠️ CRITICAL: This is a VITE project - build output goes to ${buildDir} NOT build/` : ''}
${isFrontend ? `⚠️ CRITICAL: Frontend app - Use nginx reverse proxy on port 80 pointing to app:3000` : ''}
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
${isFrontend ? `- For Frontend: app exposes port 3000, nginx service on port 80 with reverse proxy to http://app:3000` : ''}
${isFrontend ? `- nginx.conf must include: proxy_pass http://app:3000; with proper headers` : ''}
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
        // Next.js uses '.next' and special setup
        if (projectStructure.frontend === 'nextjs') {
            return '.next';
        }
        // Default to 'dist'
        return 'dist';
    }

    private parseResponse(response: string, projectStructure: ProjectStructure): DockerFiles {
        const result: DockerFiles = {
            dockerfile: '',
            dockerCompose: '',
            dockerIgnore: '',
            nginxConf: undefined
        };

        // Extract Dockerfile
        const dockerfileMatch = response.match(/```dockerfile\n([\s\S]*?)\n```/i);
        if (dockerfileMatch) {
            result.dockerfile = dockerfileMatch[1].trim();
        }

        // Extract docker-compose.yml
        const composeMatch = response.match(/```ya?ml\n([\s\S]*?)\n```/i);
        if (composeMatch) {
            result.dockerCompose = composeMatch[1].trim();
        }

        // Extract .dockerignore
        const dockerignoreMatch = response.match(/```(?:dockerignore|text)?\n([\s\S]*?)\n```/);
        if (dockerignoreMatch) {
            result.dockerIgnore = dockerignoreMatch[1].trim();
        }

        // Extract nginx.conf if present
        const nginxMatch = response.match(/```nginx\n([\s\S]*?)\n```/i);
        if (nginxMatch) {
            result.nginxConf = nginxMatch[1].trim();
        }

        // Fallback extraction if specific markers not found
        if (!result.dockerfile || !result.dockerCompose || !result.dockerIgnore) {
            this.fallbackExtraction(response, result, projectStructure);
        }

        return result;
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
            result.nginxConf = this.generateFallbackNginx();
        }
    }

    private generateFallbackDockerfile(projectStructure: ProjectStructure): string {
        if (projectStructure.dependencies.packageJson) {
            const pkg = projectStructure.dependencies.packageJson;
            const hasReact = pkg.dependencies?.react || pkg.devDependencies?.react;
            const buildDir = this.getBuildDirectory(projectStructure);
            
            if (hasReact || projectStructure.frontend) {
                // Multi-stage build for frontend projects
                return `FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/${buildDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
            } else {
                return `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
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
        let useNginxProxy = false;
        
        if (projectStructure.frontend === 'react' || projectStructure.frontend?.includes('vite')) {
            appPort = '3000';
            useNginxProxy = true; // Use nginx as reverse proxy for frontend
        } else if (projectStructure.backend === 'flask') {
            appPort = '5000';
        } else if (projectStructure.backend === 'django' || projectStructure.backend === 'fastapi') {
            appPort = '8000';
        }
        
        const hasEnv = projectStructure.hasEnvFile;
        
        if (useNginxProxy) {
            // Frontend with nginx reverse proxy
            return `services:
  app:
    build: .
    expose:
      - "${appPort}"${hasEnv ? `
    env_file:
      - .env` : ''}${projectStructure.database ? `
    depends_on:
      - ${projectStructure.database}` : ''}

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - app${projectStructure.database ? `

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
            // Backend without nginx proxy
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

    private generateFallbackNginx(): string {
        return `server {
    listen 80;
    server_name localhost;

    # For reverse proxy to Node.js/React dev server on port 3000
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # For static assets (if using production build)
    location /static/ {
        alias /usr/share/nginx/html/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;
}`;
    }
}