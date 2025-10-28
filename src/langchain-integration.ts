import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { LLMConfig, StackDetection, GeneratedFiles } from './types';

export class LangChainDockerGenerator {
  private model: any;

  constructor(config: LLMConfig) {
    this.initializeModel(config);
  }

  private initializeModel(config: LLMConfig) {
    const modelConfig = {
      temperature: config.temperature || 0.1,
      maxTokens: config.maxTokens || 8192,
    };

    switch (config.provider) {
      case 'gemini':
        this.model = new ChatGoogleGenerativeAI({
          model: config.model || 'gemini-2.5-flash-preview-05-20',
          apiKey: config.apiKey,
          ...modelConfig,
        });
        break;
      case 'openai':
        this.model = new ChatOpenAI({
          model: config.model || 'gpt-4o',
          apiKey: config.apiKey,
          ...modelConfig,
        });
        break;
      case 'anthropic':
        this.model = new ChatAnthropic({
          model: config.model || 'claude-3-5-sonnet-20241022',
          apiKey: config.apiKey,
          ...modelConfig,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  private createPromptTemplate(): PromptTemplate {
    return PromptTemplate.fromTemplate(`You are Auto Docker, an expert DevOps assistant specializing in containerization.

## PROJECT ANALYSIS:
**Type**: {project_type}
**Frontend**: {frontend_framework} (Port: {frontend_port})
**Backend**: {backend_framework} (Port: {backend_port})
**Database**: {database_type}
**Existing Docker Files**: {has_existing_docker}

## INCLUDED PROJECT FILES:
{included_files}

## CRITICAL REQUIREMENTS:

### 1. DOCKERFILE (Multi-stage Production Build):
- **Build Stage**: Install dependencies, build application
- **Runtime Stage**: Minimal runtime environment, non-root user
- Use alpine/slim images (node:18-alpine, python:3.11-slim)
- Include health checks and proper port exposure
- Security: non-root user, minimal attack surface

### 2. DOCKER-COMPOSE.YML (Complete Stack):
- **App Service**: Main application container
- **Database Service**: {database_type} with persistent volumes
- **Nginx Service**: Reverse proxy and load balancer
- **Networks**: Custom network for service communication
- **Volumes**: Persistent data storage
- **Environment**: .env file support with sensible defaults

### 3. NGINX.CONF (Production-Ready Reverse Proxy):
{nginx_rules}

### 4. DOCKERIGNORE (Security & Performance):
- Exclude: node_modules, .git, .env, logs, temp files, build artifacts
- Include: Only production-necessary files

### 5. SETUP NOTES:
- Quick start commands (docker-compose up -d)
- Environment variable configuration
- Port mappings and access URLs
- Development vs production deployment notes

## OUTPUT FORMAT:
{format_instructions}

Generate production-ready configurations optimized for performance, security, and maintainability.`);
  }

  private getNginxRules(projectType: string, frontendPort: string, backendPort: string): string {
    const baseRules = `
- **Upstream Blocks**: Health checks and load balancing
- **Security Headers**: X-Frame-Options, HSTS, CSP, X-Content-Type-Options
- **Gzip Compression**: Static assets and API responses
- **SSL Ready**: Certificate configuration blocks
- **Rate Limiting**: API endpoint protection`;

    const specificRules = {
      'fullstack': `
**Fullstack Routing**:
- Root (/) → Frontend static files (port ${frontendPort})
- /api/* → Backend API proxy (port ${backendPort})
- SPA routing with try_files for React/Vue/Angular
- Frontend build optimization with cache headers${baseRules}`,
      
      'frontend-only': `
**Frontend-Only Routing**:
- Root (/) → Frontend static files (port ${frontendPort})
- SPA routing with try_files
- /api/* → Placeholder for future backend integration
- Static asset caching and compression${baseRules}`,
      
      'backend-only': `
**Backend-Only Routing**:
- Root (/) → Direct API routing (port ${backendPort})
- CORS headers for cross-origin requests
- API versioning support (/v1/, /v2/)
- Health check endpoints (/health, /metrics)${baseRules}`,
      
      'api-only': `
**API-Only Routing**:
- All routes → API service (port ${backendPort})
- RESTful routing with proper HTTP methods
- API documentation endpoint (/docs, /swagger)
- Monitoring and health checks${baseRules}`
    };
    
    return specificRules[projectType as keyof typeof specificRules] || specificRules['api-only'];
  }

  async generateDockerFiles(
    detection: StackDetection,
    includedFiles: Array<{ path: string; content: string }>
  ): Promise<GeneratedFiles> {
    // Determine project type
    const hasFrontend = detection.frontend.framework !== 'unknown';
    const hasBackend = detection.backend.framework !== 'unknown';
    
    let projectType: string;
    if (hasFrontend && hasBackend) {
      projectType = 'fullstack';
    } else if (hasFrontend && !hasBackend) {
      projectType = 'frontend-only';
    } else if (!hasFrontend && hasBackend) {
      projectType = 'backend-only';
    } else {
      projectType = 'api-only';
    }

    // Create the LangChain sequence
    const prompt = this.createPromptTemplate();
    
    const chain = RunnableSequence.from([
      prompt,
      this.model,
    ]);

    // Prepare template variables
    const frontendPort = detection.frontend.port?.toString() || '3000';
    const backendPort = detection.backend.port?.toString() || '5000';
    
    const templateVars = {
      project_type: projectType,
      frontend_framework: detection.frontend.framework,
      frontend_port: frontendPort,
      backend_framework: detection.backend.framework,
      backend_port: backendPort,
      database_type: detection.database.type || 'none',
      has_existing_docker: detection.hasDockerfile || detection.hasDockerCompose ? 'Yes (will be optimized)' : 'No',
      nginx_rules: this.getNginxRules(projectType, frontendPort, backendPort),
      included_files: includedFiles
        .map(f => `**${f.path}**:\n\`\`\`\n${f.content.slice(0, 1000)}${f.content.length > 1000 ? '\n...(truncated)' : ''}\n\`\`\``)
        .join('\n\n'),
      format_instructions: 'Return your response as a JSON object with exactly these keys: dockerfile, docker_compose, nginx_conf, dockerignore, notes',
    };

    try {
      // Execute the chain with retry logic
      let result;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          const response = await chain.invoke(templateVars);
          // Parse the JSON response from LangChain
          const responseText = response.content || response;
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
            break;
          } else {
            throw new Error('No valid JSON found in response');
          }
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            throw error;
          }
          console.warn(`LangChain attempt ${attempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      // Transform the result to match the expected GeneratedFiles format
      const files = [
        { path: 'Dockerfile', content: result.dockerfile },
        { path: 'docker-compose.yml', content: result.docker_compose },
        { path: 'nginx.conf', content: result.nginx_conf },
        { path: '.dockerignore', content: result.dockerignore },
        { path: 'README-Docker.md', content: result.notes }
      ];

      const recommendations = [
        '✅ LangChain-powered generation completed',
        '🚀 Production-ready configurations generated',
        '📋 Quick start: docker-compose up -d',
        '🔧 Customize environment variables in .env file',
        '📊 Monitor with: docker-compose logs -f',
        '🔒 All configurations include security best practices'
      ];

      const warnings = [];
      
      // Validate generated content
      if (!result.dockerfile.includes('FROM')) {
        warnings.push('Dockerfile may be incomplete - please review');
      }
      if (!result.docker_compose.includes('services:')) {
        warnings.push('Docker Compose may be incomplete - please review');
      }
      if (!result.nginx_conf.includes('server {')) {
        warnings.push('Nginx configuration may be incomplete - please review');
      }

      return {
        files,
        recommendations,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      console.error('LangChain generation failed:', error);
      throw new Error(`Failed to generate Docker files with LangChain: ${error}`);
    }
  }
}

export async function generateDockerFilesWithLangChain(
  detection: StackDetection,
  includedFiles: Array<{ path: string; content: string }>,
  config: LLMConfig
): Promise<GeneratedFiles> {
  const generator = new LangChainDockerGenerator(config);
  return await generator.generateDockerFiles(detection, includedFiles);
}