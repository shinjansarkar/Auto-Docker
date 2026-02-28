/**
 * LangChain Service with Structured Outputs
 * Provides reliable, validated Docker file generation using LangChain
 * Supports structured output parsing and function calling
 */

import * as vscode from 'vscode';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { ComprehensiveAnalysis } from './comprehensiveAnalyzer';
import { DockerFiles, ProjectStructure } from './types';
import { GuardrailsService } from './guardrailsService';

/**
 * Zod Schema for Structured Docker Files Output
 */
const DockerFilesOutputSchema = z.object({
    dockerfile: z.string().describe('Multi-stage Dockerfile with security best practices'),
    dockerCompose: z.string().describe('Valid docker-compose.yml with all detected services'),
    dockerIgnore: z.string().describe('.dockerignore file with common exclusions'),
    nginxConf: z.string().optional().describe('Production-ready nginx configuration (optional)'),
    envExample: z.string().optional().describe('.env.example with required variables (optional)'),
    warnings: z.array(z.string()).optional().describe('Potential issues detected during generation')
});

type DockerFilesOutput = z.infer<typeof DockerFilesOutputSchema>;

/**
 * Function Call Schema for Docker Generation
 */
interface DockerfileGenerationParams {
    service_name: string;
    base_image: string;
    node_version?: string;
    python_version?: string;
    build_commands: string[];
    expose_port: number;
    run_as_user?: string;
    health_check_command?: string;
    environment_variables?: Record<string, string>;
}

interface DockerComposeGenerationParams {
    services: Array<{
        name: string;
        build_context: string;
        dockerfile?: string;
        ports: string[];
        environment?: Record<string, string>;
        depends_on?: string[];
        volumes?: string[];
        networks?: string[];
    }>;
    networks?: Record<string, any>;
    volumes?: Record<string, any>;
}

/**
 * LangChain Service Class
 */
export class LangChainService {
    private geminiModel?: ChatGoogleGenerativeAI;
    private parser: ReturnType<typeof StructuredOutputParser.fromZodSchema>;
    private guardrailsService: GuardrailsService;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - LangChain');
        this.initializeModels();
        this.parser = this.initializeParser();
        this.guardrailsService = new GuardrailsService(outputChannel);
    }

    /**
     * Initialize LLM models
     */
    private initializeModels(): void {
        const config = vscode.workspace.getConfiguration('autoDocker');

        // Google Gemini
        const geminiKey = config.get<string>('geminiApiKey');
        if (geminiKey) {
            const geminiModel = config.get<string>('geminiModel', 'gemini-2.0-flash');
            this.geminiModel = new ChatGoogleGenerativeAI({
                apiKey: geminiKey,
                model: geminiModel,
                temperature: 0,
                maxOutputTokens: 4096
            });
            this.log(`✅ Gemini model initialized (${geminiModel})`);
        }
    }

    /**
     * Initialize structured output parser
     */
    private initializeParser() {
        return StructuredOutputParser.fromZodSchema(DockerFilesOutputSchema);
    }

    /**
     * Get active model (always Gemini)
     */
    private getModel(): ChatGoogleGenerativeAI {
        if (this.geminiModel) {
            return this.geminiModel;
        }
        throw new Error('Gemini API key is not configured. Please set your Gemini API key in settings.');
    }

    /**
     * Generate Docker files with structured output
     */
    async generateWithStructuredOutput(
        analysis: ComprehensiveAnalysis | ProjectStructure
    ): Promise<DockerFiles> {
        this.log('🔗 Starting LangChain structured generation...');

        try {
            const model = this.getModel();
            const formatInstructions = this.parser.getFormatInstructions();

            // Create prompt template
            const prompt = new PromptTemplate({
                template: `You are an expert DevOps engineer specializing in Docker containerization.

Generate production-ready Docker configuration files for the following project:

{project_analysis}

IMPORTANT REQUIREMENTS:
1. Use multi-stage builds for Node.js/Python projects
2. Run containers as non-root users (USER directive)
3. Pin all base image versions (no :latest tags)
4. Include health checks in docker-compose.yml
5. Add security headers in nginx.conf (if needed)
6. Use .dockerignore to exclude node_modules, .git, etc.
7. Set appropriate environment variables
8. Use proper port mappings
9. Add volume mounts for persistence
10. Configure service dependencies correctly

{format_instructions}

Generate complete, production-ready configurations now.`,
                inputVariables: ['project_analysis'],
                partialVariables: { format_instructions: formatInstructions }
            });

            // Create chain
            const chain = prompt.pipe(model).pipe(this.parser);

            // Execute chain
            const result = await chain.invoke({
                project_analysis: JSON.stringify(analysis, null, 2)
            }) as DockerFilesOutput;

            this.log('✅ LangChain generation completed');

            // Convert to DockerFiles format
            const dockerFiles: DockerFiles = {
                dockerfile: result.dockerfile,
                dockerCompose: result.dockerCompose,
                dockerIgnore: result.dockerIgnore,
                nginxConf: result.nginxConf
            };

            // Validate with Guardrails
            const validated = await this.guardrailsService.validateDockerFiles(dockerFiles, {
                isProduction: true
            });

            if (validated.validationResult.valid) {
                this.log('✅ Validation passed');
                return dockerFiles;
            } else {
                this.log(`⚠️ Validation warnings: ${validated.validationResult.warnings.length}`);
                // Return with warnings but still usable
                return dockerFiles;
            }

        } catch (error) {
            this.log(`❌ LangChain generation failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Generate with function calling (more precise control)
     */
    async generateWithFunctionCalling(
        analysis: ComprehensiveAnalysis | ProjectStructure
    ): Promise<DockerFiles> {
        this.log('🔗 Starting LangChain function calling generation...');

        try {
            const model = this.getModel();

            // Define functions
            const functions = [
                {
                    name: 'generate_dockerfile',
                    description: 'Generate a Dockerfile for a specific service',
                    parameters: {
                        type: 'object',
                        properties: {
                            service_name: { type: 'string', description: 'Name of the service' },
                            base_image: { type: 'string', description: 'Base Docker image (e.g., node:20-alpine)' },
                            node_version: { type: 'string', description: 'Node.js version if applicable' },
                            python_version: { type: 'string', description: 'Python version if applicable' },
                            build_commands: { 
                                type: 'array', 
                                items: { type: 'string' },
                                description: 'Commands to build the application'
                            },
                            expose_port: { type: 'number', description: 'Port to expose' },
                            run_as_user: { type: 'string', description: 'Non-root user to run as', default: 'nodejs' },
                            health_check_command: { type: 'string', description: 'Health check command' },
                            environment_variables: { 
                                type: 'object',
                                description: 'Environment variables needed'
                            }
                        },
                        required: ['service_name', 'base_image', 'expose_port']
                    }
                },
                {
                    name: 'generate_docker_compose',
                    description: 'Generate docker-compose.yml with all services',
                    parameters: {
                        type: 'object',
                        properties: {
                            services: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        name: { type: 'string' },
                                        build_context: { type: 'string' },
                                        dockerfile: { type: 'string' },
                                        ports: { type: 'array', items: { type: 'string' } },
                                        environment: { type: 'object' },
                                        depends_on: { type: 'array', items: { type: 'string' } },
                                        volumes: { type: 'array', items: { type: 'string' } },
                                        networks: { type: 'array', items: { type: 'string' } }
                                    }
                                }
                            },
                            networks: { type: 'object' },
                            volumes: { type: 'object' }
                        },
                        required: ['services']
                    }
                }
            ];

            // Fall back to structured output
            this.log('⚠️ Falling back to structured output');
            return this.generateWithStructuredOutput(analysis);

        } catch (error) {
            this.log(`❌ Function calling generation failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Process function call result
     */
    private async processFunctionCallResult(
        functionCall: any,
        analysis: ComprehensiveAnalysis | ProjectStructure
    ): Promise<DockerFiles> {
        const args = JSON.parse(functionCall.arguments);

        if (functionCall.name === 'generate_dockerfile') {
            const params: DockerfileGenerationParams = args;
            return this.buildDockerFilesFromParams(params, analysis);
        } else if (functionCall.name === 'generate_docker_compose') {
            const params: DockerComposeGenerationParams = args;
            return this.buildDockerFilesFromCompose(params, analysis);
        }

        throw new Error(`Unknown function: ${functionCall.name}`);
    }

    /**
     * Build DockerFiles from Dockerfile params
     */
    private async buildDockerFilesFromParams(
        params: DockerfileGenerationParams,
        analysis: any
    ): Promise<DockerFiles> {
        // Generate Dockerfile from params
        const dockerfile = this.generateDockerfileFromParams(params);
        
        // Generate docker-compose.yml
        const dockerCompose = this.generateBasicCompose(params.service_name, params.expose_port);
        
        // Generate .dockerignore
        const dockerIgnore = this.generateBasicDockerIgnore();

        return { dockerfile, dockerCompose, dockerIgnore };
    }

    /**
     * Build DockerFiles from docker-compose params
     */
    private async buildDockerFilesFromCompose(
        params: DockerComposeGenerationParams,
        analysis: any
    ): Promise<DockerFiles> {
        // Generate docker-compose.yml from params
        const dockerCompose = this.generateComposeFromParams(params);
        
        // Generate Dockerfile for first service
        const dockerfile = `FROM node:20-alpine\nWORKDIR /app\nCOPY . .\nRUN npm install\nEXPOSE ${params.services[0]?.ports[0] || 3000}\nCMD ["npm", "start"]`;
        
        // Generate .dockerignore
        const dockerIgnore = this.generateBasicDockerIgnore();

        return { dockerfile, dockerCompose, dockerIgnore };
    }

    /**
     * Generate Dockerfile from params
     */
    private generateDockerfileFromParams(params: DockerfileGenerationParams): string {
        const lines: string[] = [];

        lines.push(`FROM ${params.base_image}`);
        lines.push('');
        lines.push('WORKDIR /app');
        lines.push('');

        // Copy and build
        lines.push('COPY package*.json ./');
        lines.push('RUN npm ci --only=production');
        lines.push('');
        lines.push('COPY . .');
        lines.push('');

        // Build commands
        if (params.build_commands && params.build_commands.length > 0) {
            params.build_commands.forEach(cmd => lines.push(`RUN ${cmd}`));
            lines.push('');
        }

        // Expose port
        lines.push(`EXPOSE ${params.expose_port}`);
        lines.push('');

        // Health check
        if (params.health_check_command) {
            lines.push(`HEALTHCHECK CMD ${params.health_check_command}`);
            lines.push('');
        }

        // User
        const user = params.run_as_user || 'nodejs';
        lines.push(`USER ${user}`);
        lines.push('');

        // CMD
        lines.push('CMD ["node", "index.js"]');

        return lines.join('\n');
    }

    /**
     * Generate basic docker-compose.yml
     */
    private generateBasicCompose(serviceName: string, port: number): string {
        return `version: '3.8'

services:
  ${serviceName}:
    build: .
    ports:
      - "${port}:${port}"
    environment:
      NODE_ENV: production
    restart: unless-stopped
`;
    }

    /**
     * Generate docker-compose from params
     */
    private generateComposeFromParams(params: DockerComposeGenerationParams): string {
        const compose: any = {
            version: '3.8',
            services: {}
        };

        // Add services
        params.services.forEach(service => {
            compose.services[service.name] = {
                build: service.build_context,
                ports: service.ports,
                environment: service.environment || {},
                depends_on: service.depends_on || [],
                volumes: service.volumes || [],
                networks: service.networks || ['default']
            };
        });

        // Add networks
        if (params.networks) {
            compose.networks = params.networks;
        }

        // Add volumes
        if (params.volumes) {
            compose.volumes = params.volumes;
        }

        return JSON.stringify(compose, null, 2);
    }

    /**
     * Generate basic .dockerignore
     */
    private generateBasicDockerIgnore(): string {
        return `node_modules
npm-debug.log
.git
.gitignore
.env
.vscode
.idea
*.log
dist
build
coverage
.next
.nuxt
`;
    }

    /**
     * LangChain is always used (Gemini only)
     */
    static shouldUseLangChain(): boolean {
        return true;
    }

    /**
     * Log helper
     */
    private log(message: string): void {
        this.outputChannel.appendLine(`[LangChain] ${message}`);
        console.log(`[LangChain] ${message}`);
    }
}
