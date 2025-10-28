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

        return `
Generate COMPACT, production-ready Docker files for this project:

PROJECT: ${projectStructure.projectType}${projectStructure.frontend ? ` (${projectStructure.frontend})` : ''}${projectStructure.backend ? ` + ${projectStructure.backend}` : ''}${projectStructure.database ? ` + ${projectStructure.database}` : ''}

FILES: ${projectStructure.files.slice(0, 10).join(', ')}

DEPS: ${JSON.stringify(projectStructure.dependencies?.packageJson?.dependencies || projectStructure.dependencies?.requirementsTxt?.split('\n').slice(0, 5) || {}, null, 0)}

Generate ${projectStructure.hasMultiStage ? 'multi-stage' : 'single-stage'} Dockerfile, docker-compose.yml, .dockerignore${includeNginx && projectStructure.frontend ? ', nginx.conf' : ''}.

REQUIREMENTS:
- COMPACT files, no comments except essential ones
- Use alpine/slim images for smaller size
- Only necessary ports and volumes
- Essential environment variables only
- ${projectStructure.database ? `Include ${projectStructure.database} service` : 'No database needed'}
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
            
            if (hasReact) {
                return `FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80`;
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
            return `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`;
        }

        return `FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["sh"]`;
    }

    private generateFallbackCompose(projectStructure: ProjectStructure): string {
        const port = projectStructure.frontend === 'react' ? '80' : '3000';
        return `services:
  app:
    build: .
    ports:
      - "${port}:${port}"${projectStructure.database ? `
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
.env*
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
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    gzip on;
    gzip_types text/css application/javascript application/json;
}`;
    }
}