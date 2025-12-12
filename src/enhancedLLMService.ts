/**
 * Enhanced LLM Service with Accurate Detection
 * Combines the new detection engine with Gemini API for optimal Docker generation
 * Uses rule-based detection to provide accurate context to LLM
 */

import * as vscode from 'vscode';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { EnhancedDetectionEngine, EnhancedDetectionResult } from './enhancedDetectionEngine';
import { OutputFolderMapper } from './outputFolderMapper';
import { DockerFiles } from './llmService';
import * as fs from 'fs';
import * as path from 'path';

export class EnhancedLLMService {
    private geminiClient?: GoogleGenerativeAI;
    private detectionEngine: EnhancedDetectionEngine;

    constructor(projectPath: string) {
        this.detectionEngine = new EnhancedDetectionEngine(projectPath);
        this.initializeClient();
    }

    private initializeClient() {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const geminiKey = config.get<string>('geminiApiKey');

        if (geminiKey) {
            this.geminiClient = new GoogleGenerativeAI(geminiKey);
        }
    }

    /**
     * Main method: Detect project, send to Gemini, get perfect Docker files
     */
    async generateDockerFiles(): Promise<DockerFiles> {
        // Step 1: Use our accurate detection engine
        console.log('[EnhancedLLMService] Step 1: Analyzing codebase...');
        const detection = await this.detectionEngine.detect();

        console.log('[EnhancedLLMService] Detection complete:', {
            type: detection.projectType,
            frontend: detection.frontend?.framework,
            backend: detection.backend?.framework
        });

        // Step 2: Create enhanced prompt with accurate detection data
        const prompt = this.createEnhancedPrompt(detection);

        // Step 3: Send to Gemini
        console.log('[EnhancedLLMService] Step 2: Sending to Gemini API...');

        if (!this.geminiClient) {
            throw new Error('Gemini API key not configured. Please set it in VS Code settings.');
        }

        const model = this.geminiClient.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('[EnhancedLLMService] Step 3: Received response from Gemini');

        // Step 4: Parse response
        return this.parseResponse(text, detection);
    }

    /**
     * Create enhanced prompt with all accurate detection data
     */
    private createEnhancedPrompt(detection: EnhancedDetectionResult): string {
        const { projectType, frontend, backend, databases, monorepo } = detection;

        let prompt = `# DOCKER CONFIGURATION GENERATION REQUEST

## PROJECT ANALYSIS (100% ACCURATE)

**Project Type:** ${projectType}

`;

        // Frontend details
        if (frontend && frontend.exists) {
            prompt += `### Frontend Details
- **Framework:** ${frontend.framework}${frontend.variant ? ` (${frontend.variant})` : ''}
- **Build Output Folder:** \`${frontend.outputFolder}\` ⚠️ CRITICAL - USE THIS EXACT FOLDER
- **Package Manager:** ${frontend.packageManager}
- **Install Command:** \`${frontend.installCommand}\`
- **Build Command:** \`${frontend.buildCommand}\`
- **Path:** ${frontend.path}
- **Port:** ${frontend.port || 3000}

`;
        }

        // Backend details
        if (backend && backend.exists) {
            prompt += `### Backend Details
- **Framework:** ${backend.framework}
- **Language:** ${backend.language}
- **Package Manager:** ${backend.packageManager || 'detected from files'}
- **Path:** ${backend.path}
- **Port:** ${backend.port || 8000}

`;
        }

        // Database details
        if (databases && databases.length > 0) {
            prompt += `### Databases Detected
`;
            for (const db of databases) {
                prompt += `- **${db.type}** (Port: ${db.port})
`;
            }
            prompt += '\n';
        }

        // Monorepo details
        if (monorepo && monorepo.isMonorepo) {
            prompt += `### Monorepo Configuration
- **Tool:** ${monorepo.tool || 'detected'}
- **Frontends:** ${monorepo.frontends.length}
`;
            for (const fe of monorepo.frontends) {
                prompt += `  - ${fe.path}: ${fe.framework} → ${fe.outputFolder}
`;
            }

            prompt += `- **Backends:** ${monorepo.backends.length}
`;
            for (const be of monorepo.backends) {
                prompt += `  - ${be.path}: ${be.framework}
`;
            }
            prompt += '\n';
        }

        // Generation rules
        prompt += `## GENERATION RULES (MUST FOLLOW)

### Critical Rules:
${frontend && frontend.exists ? `
1. **Frontend Multistage Build:**
   \`\`\`
   FROM node:20-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN ${frontend.installCommand}
   COPY . .
   RUN ${frontend.buildCommand}
   
   FROM nginx:alpine
   COPY nginx.conf /etc/nginx/conf.d/default.conf
   COPY --from=builder /app/${frontend.outputFolder} /usr/share/nginx/html
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   \`\`\`

2. **CRITICAL:** Build output MUST use \`${frontend.outputFolder}\` (not dist, not build, THIS EXACT FOLDER)

3. **CRITICAL:** Package manager MUST use \`${frontend.installCommand}\` (not npm install)
` : ''}

${backend && backend.exists && backend.language === 'node' ? `
4. **Backend (Node.js):**
   \`\`\`
   FROM node:20-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE ${backend.port || 8000}
   CMD ["node", "server.js"]
   \`\`\`
` : ''}

${backend && backend.exists && backend.language === 'python' ? `
4. **Backend (Python):**
   \`\`\`
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   EXPOSE ${backend.port || 8000}
   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "${backend.port || 8000}"]
   \`\`\`
` : ''}

### NGINX Configuration Rules:

${projectType === 'frontend-only' ? `
**Frontend-Only Project - Simple SPA Serving:**
\`\`\`nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
\`\`\`
` : ''}

${projectType === 'fullstack' ? `
**Fullstack Project - Static Files + API Proxy:**
\`\`\`nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:${backend?.port || 8000}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
\`\`\`
` : ''}

${projectType === 'backend-only' ? `
**Backend-Only Project - NO NGINX NEEDED**
` : ''}

### Docker-Compose Rules:

1. **Only include services that exist:**
${projectType === 'frontend-only' ? '   - frontend service only' : ''}
${projectType === 'backend-only' ? '   - backend service only' : ''}
${projectType === 'fullstack' ? '   - frontend + backend services' : ''}

2. **Port mappings:**
${frontend && frontend.exists ? `   - Frontend: 80:80` : ''}
${backend && backend.exists ? `   - Backend: ${backend.port || 8000}:${backend.port || 8000}` : ''}

3. **NO unnecessary elements:**
   - NO volumes mounting current directory
   - NO custom networks (unless multiple services)
   - NO placeholder services

4. **Database services:** Only if detected (${databases.length > 0 ? databases.map(d => d.type).join(', ') : 'none'})

### File Generation:

Generate ONLY these files:
1. Dockerfile${projectType === 'fullstack' || projectType === 'monorepo' ? ' (one per service)' : ''}
2. docker-compose.yml
3. .dockerignore
${frontend && frontend.exists && projectType !== 'backend-only' ? '4. nginx.conf' : ''}

**DO NOT GENERATE:**
- ❌ .env.example
- ❌ Extra configuration files
- ❌ Placeholder services

## OUTPUT FORMAT

Provide the complete Docker configuration in code blocks:

\`\`\`dockerfile
# Dockerfile content here
\`\`\`

\`\`\`yaml
# docker-compose.yml content here
\`\`\`

\`\`\`
# .dockerignore content here
\`\`\`

${frontend && frontend.exists && projectType !== 'backend-only' ? `
\`\`\`nginx
# nginx.conf content here
\`\`\`
` : ''}

Generate production-ready, minimal, and correct Docker configuration NOW.
`;

        return prompt;
    }

    /**
     * Parse Gemini response
     */
    private parseResponse(response: string, detection: EnhancedDetectionResult): DockerFiles {
        const result: DockerFiles = {
            dockerfile: '',
            dockerCompose: '',
            dockerIgnore: ''
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

        // Extract nginx.conf
        const nginxMatch = response.match(/```nginx\n([\s\S]*?)\n```/i);
        if (nginxMatch) {
            result.nginxConf = nginxMatch[1].trim();
        }

        // Validate we got something
        if (!result.dockerfile || !result.dockerCompose) {
            console.warn('[EnhancedLLMService] Failed to parse response properly');
            console.log('Response:', response);
            throw new Error('Failed to parse Gemini response. Please try again.');
        }

        return result;
    }

    /**
     * Get detection results (useful for debugging)
     */
    async getDetectionResults(): Promise<EnhancedDetectionResult> {
        return await this.detectionEngine.detect();
    }
}
