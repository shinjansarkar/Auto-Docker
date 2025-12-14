/**
 * RAG (Retrieval Augmented Generation) Service
 * 
 * Purpose: Send the right context to Gemini/GPT
 * - Selects the most relevant information
 * - Builds optimal context for AI generation
 * - Ensures accuracy and correctness
 * - Prevents token limit issues
 */

import * as vscode from 'vscode';
import { EmbeddingService, FileEmbedding } from './embeddingService';
import { LSPMetadataService, LSPMetadata } from './lspMetadataService';

export interface RAGContext {
    summary: string;
    criticalFiles: FileContext[];
    metadata: LSPMetadata;
    technicalStack: TechnicalStack;
    recommendations: string[];
    totalTokens: number;
}

export interface FileContext {
    path: string;
    content: string;
    relevance: number;
    category: string;
}

export interface TechnicalStack {
    languages: string[];
    frameworks: string[];
    databases: string[];
    messageQueues: string[];
    cacheServices: string[];
    buildTools: string[];
}

export class RAGService {
    private workspaceRoot: string;
    private embeddingService: EmbeddingService;
    private lspService: LSPMetadataService;
    private outputChannel: vscode.OutputChannel;

    // Token limits for different models
    private static readonly TOKEN_LIMITS = {
        'gpt-4': 8000,
        'gpt-4-turbo': 128000,
        'gpt-3.5-turbo': 4000,
        'gemini-pro': 30000,
        'gemini-1.5-pro': 1000000
    };

    constructor(
        workspaceRoot: string,
        outputChannel: vscode.OutputChannel
    ) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel;
        this.embeddingService = new EmbeddingService(workspaceRoot);
        this.lspService = new LSPMetadataService(workspaceRoot, outputChannel);
    }

    /**
     * Main method: Build optimal RAG context for AI generation
     */
    async buildContext(model: string = 'gpt-4'): Promise<RAGContext> {

        // Step 1: Get file embeddings
        const embeddings = await this.embeddingService.generateFileEmbeddings();

        // Step 2: Get LSP metadata
        const metadata = await this.lspService.extractMetadata();

        // Step 3: Select critical files based on token budget
        const tokenLimit = this.getTokenLimit(model);
        const criticalFiles = await this.selectCriticalFiles(embeddings, tokenLimit * 0.6); // Use 60% of limit for files

        // Step 4: Extract technical stack
        const technicalStack = this.extractTechnicalStack(metadata, criticalFiles);

        // Step 5: Generate summary
        const summary = this.generateContextSummary(embeddings, metadata, technicalStack);

        // Step 6: Generate recommendations
        const recommendations = this.generateRecommendations(metadata, technicalStack, criticalFiles);

        // Step 7: Calculate total tokens
        const totalTokens = this.estimateTokens(summary, criticalFiles, metadata);



        return {
            summary,
            criticalFiles,
            metadata,
            technicalStack,
            recommendations,
            totalTokens
        };
    }

    /**
     * Select critical files within token budget
     */
    private async selectCriticalFiles(
        embeddings: FileEmbedding[],
        tokenBudget: number
    ): Promise<FileContext[]> {
        const criticalFiles: FileContext[] = [];
        let currentTokens = 0;

        // Sort by score (already sorted from embedding service)
        for (const embedding of embeddings) {
            // Only include config, dependency, and entrypoint files
            if (!['config', 'dependency', 'entrypoint'].includes(embedding.category)) {
                continue;
            }

            try {
                const fullPath = require('path').join(this.workspaceRoot, embedding.filepath);
                const content = await require('fs').promises.readFile(fullPath, 'utf-8');

                // Skip binary or very large files
                if (content.length > 100000) {
                    continue;
                }

                const estimatedTokens = this.estimateFileTokens(content);

                // Check if adding this file exceeds budget
                if (currentTokens + estimatedTokens > tokenBudget) {
                    break;
                }

                criticalFiles.push({
                    path: embedding.filepath,
                    content,
                    relevance: embedding.relevance,
                    category: embedding.category
                });

                currentTokens += estimatedTokens;

                // Limit to maximum 25 files
                if (criticalFiles.length >= 25) {
                    break;
                }
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        return criticalFiles;
    }

    /**
     * Extract technical stack from metadata and files
     */
    private extractTechnicalStack(
        metadata: LSPMetadata,
        criticalFiles: FileContext[]
    ): TechnicalStack {
        const stack: TechnicalStack = {
            languages: [],
            frameworks: [],
            databases: [],
            messageQueues: [],
            cacheServices: [],
            buildTools: []
        };

        // Extract from LSP metadata
        stack.languages = [metadata.languageInfo.primary, ...metadata.languageInfo.secondary];
        stack.frameworks = metadata.frameworks.map(f => f.name);
        stack.buildTools = metadata.dependencies.buildTools;

        // Extract from file contents
        for (const file of criticalFiles) {
            // Detect databases
            if (this.containsDatabase(file.content)) {
                const dbs = this.detectDatabases(file.content);
                stack.databases.push(...dbs.filter(db => !stack.databases.includes(db)));
            }

            // Detect message queues
            if (this.containsMessageQueue(file.content)) {
                const mqs = this.detectMessageQueues(file.content);
                stack.messageQueues.push(...mqs.filter(mq => !stack.messageQueues.includes(mq)));
            }

            // Detect cache services
            if (this.containsCache(file.content)) {
                const caches = this.detectCacheServices(file.content);
                stack.cacheServices.push(...caches.filter(c => !stack.cacheServices.includes(c)));
            }
        }

        return stack;
    }

    /**
     * Generate context summary
     */
    private generateContextSummary(
        embeddings: FileEmbedding[],
        metadata: LSPMetadata,
        stack: TechnicalStack
    ): string {
        let summary = `# Project Context for Docker Configuration\n\n`;

        // Project overview
        summary += `## Project Overview\n`;
        summary += `- Total files analyzed: ${embeddings.length}\n`;
        summary += `- Primary language: ${metadata.languageInfo.primary}\n`;
        summary += `- Entry points detected: ${metadata.entryPoints.length}\n`;
        summary += `- Frameworks detected: ${metadata.frameworks.length}\n\n`;

        // Technical stack
        summary += `## Technical Stack\n`;
        summary += `**Languages**: ${stack.languages.join(', ')}\n`;
        if (stack.frameworks.length > 0) {
            summary += `**Frameworks**: ${stack.frameworks.join(', ')}\n`;
        }
        if (stack.databases.length > 0) {
            summary += `**Databases**: ${stack.databases.join(', ')}\n`;
        }
        if (stack.messageQueues.length > 0) {
            summary += `**Message Queues**: ${stack.messageQueues.join(', ')}\n`;
        }
        if (stack.cacheServices.length > 0) {
            summary += `**Cache Services**: ${stack.cacheServices.join(', ')}\n`;
        }
        if (stack.buildTools.length > 0) {
            summary += `**Build Tools**: ${stack.buildTools.join(', ')}\n`;
        }
        summary += `\n`;

        // Entry points
        if (metadata.entryPoints.length > 0) {
            summary += `## Entry Points\n`;
            metadata.entryPoints.slice(0, 5).forEach(ep => {
                summary += `- ${ep.file} (${ep.type}, confidence: ${(ep.confidence * 100).toFixed(0)}%)\n`;
            });
            summary += `\n`;
        }

        // Frameworks
        if (metadata.frameworks.length > 0) {
            summary += `## Detected Frameworks\n`;
            metadata.frameworks.forEach(fw => {
                summary += `- ${fw.name} ${fw.version || ''} (${fw.type})\n`;
            });
            summary += `\n`;
        }

        return summary;
    }

    /**
     * Generate Docker-specific recommendations
     */
    private generateRecommendations(
        metadata: LSPMetadata,
        stack: TechnicalStack,
        criticalFiles: FileContext[]
    ): string[] {
        const recommendations: string[] = [];

        // Multi-stage builds
        if (stack.frameworks.some(f => ['React', 'Vue.js', 'Angular', 'Next.js'].includes(f))) {
            recommendations.push('Use multi-stage Dockerfile for frontend optimization');
        }

        // Health checks
        if (metadata.entryPoints.some(ep => ep.type === 'server')) {
            recommendations.push('Include health check endpoints in docker-compose.yml');
        }

        // Database persistence
        if (stack.databases.length > 0) {
            recommendations.push('Configure persistent volumes for database containers');
        }

        // Message queue configuration
        if (stack.messageQueues.length > 0) {
            recommendations.push('Set up message queue with proper retry and dead-letter configuration');
        }

        // Cache configuration
        if (stack.cacheServices.includes('Redis')) {
            recommendations.push('Enable Redis AOF persistence for data durability');
        }

        // Environment variables
        const hasEnvFile = criticalFiles.some(f => f.path.includes('.env'));
        if (!hasEnvFile) {
            recommendations.push('Create .env.example with all required environment variables');
        }

        // Nginx for frontend
        if (stack.frameworks.some(f => ['React', 'Vue.js', 'Angular'].includes(f))) {
            recommendations.push('Use Nginx as reverse proxy for production builds');
        }

        // WebSocket support
        const hasWebSocket = criticalFiles.some(f =>
            f.content.includes('socket.io') || f.content.includes('ws') || f.content.includes('WebSocket')
        );
        if (hasWebSocket) {
            recommendations.push('Configure Nginx for WebSocket support (ws:// protocol)');
        }

        // Monorepo detection
        const hasMonorepo = criticalFiles.some(f =>
            f.path.includes('frontend/') || f.path.includes('backend/')
        );
        if (hasMonorepo) {
            recommendations.push('Create separate Dockerfiles for frontend and backend services');
            recommendations.push('Use docker-compose to orchestrate all services');
        }

        return recommendations;
    }

    /**
     * Estimate tokens for content
     */
    private estimateFileTokens(content: string): number {
        // Rough estimation: 1 token ≈ 4 characters
        return Math.ceil(content.length / 4);
    }

    /**
     * Estimate total tokens for context
     */
    private estimateTokens(
        summary: string,
        files: FileContext[],
        metadata: LSPMetadata
    ): number {
        let total = this.estimateFileTokens(summary);

        for (const file of files) {
            total += this.estimateFileTokens(file.content);
        }

        // Add metadata tokens
        total += 500; // Rough estimate for metadata

        return total;
    }

    /**
     * Get token limit for model
     */
    private getTokenLimit(model: string): number {
        return RAGService.TOKEN_LIMITS[model as keyof typeof RAGService.TOKEN_LIMITS] || 8000;
    }

    /**
     * Check if content contains database references
     */
    private containsDatabase(content: string): boolean {
        const dbKeywords = ['mongodb', 'postgres', 'mysql', 'redis', 'sqlite', 'mssql', 'mariadb'];
        return dbKeywords.some(kw => content.toLowerCase().includes(kw));
    }

    /**
     * Detect databases from content
     */
    private detectDatabases(content: string): string[] {
        const databases: string[] = [];
        const contentLower = content.toLowerCase();

        if (contentLower.includes('mongodb') || contentLower.includes('mongoose')) {
            databases.push('MongoDB');
        }
        if (contentLower.includes('postgres') || contentLower.includes('pg')) {
            databases.push('PostgreSQL');
        }
        if (contentLower.includes('mysql')) {
            databases.push('MySQL');
        }
        if (contentLower.includes('redis')) {
            databases.push('Redis');
        }
        if (contentLower.includes('sqlite')) {
            databases.push('SQLite');
        }
        if (contentLower.includes('mariadb')) {
            databases.push('MariaDB');
        }

        return databases;
    }

    /**
     * Check if content contains message queue references
     */
    private containsMessageQueue(content: string): boolean {
        const mqKeywords = ['rabbitmq', 'kafka', 'amqp', 'redis-streams', 'activemq'];
        return mqKeywords.some(kw => content.toLowerCase().includes(kw));
    }

    /**
     * Detect message queues from content
     */
    private detectMessageQueues(content: string): string[] {
        const queues: string[] = [];
        const contentLower = content.toLowerCase();

        if (contentLower.includes('rabbitmq') || contentLower.includes('amqp')) {
            queues.push('RabbitMQ');
        }
        if (contentLower.includes('kafka')) {
            queues.push('Kafka');
        }
        if (contentLower.includes('redis') && contentLower.includes('stream')) {
            queues.push('Redis Streams');
        }
        if (contentLower.includes('activemq')) {
            queues.push('ActiveMQ');
        }

        return queues;
    }

    /**
     * Check if content contains cache references
     */
    private containsCache(content: string): boolean {
        const cacheKeywords = ['redis', 'memcached', 'cache'];
        return cacheKeywords.some(kw => content.toLowerCase().includes(kw));
    }

    /**
     * Detect cache services from content
     */
    private detectCacheServices(content: string): string[] {
        const caches: string[] = [];
        const contentLower = content.toLowerCase();

        if (contentLower.includes('redis')) {
            caches.push('Redis');
        }
        if (contentLower.includes('memcached')) {
            caches.push('Memcached');
        }

        return caches;
    }

    /**
     * Format context for AI prompt
     */
    async formatForAI(context: RAGContext): Promise<string> {
        let prompt = `${context.summary}\n`;

        prompt += `## Critical Files\n\n`;
        context.criticalFiles.forEach(file => {
            prompt += `### ${file.path} (relevance: ${(file.relevance * 100).toFixed(0)}%)\n`;
            prompt += `\`\`\`\n${file.content}\n\`\`\`\n\n`;
        });

        if (context.recommendations.length > 0) {
            prompt += `## Docker Configuration Recommendations\n`;
            context.recommendations.forEach((rec, index) => {
                prompt += `${index + 1}. ${rec}\n`;
            });
            prompt += `\n`;
        }

        prompt += `## Task\n`;
        prompt += `Based on the above context, generate production-ready Docker configuration files:\n`;
        prompt += `1. Dockerfile(s) with multi-stage builds where appropriate\n`;
        prompt += `2. docker-compose.yml with all detected services\n`;
        prompt += `3. nginx.conf if frontend framework detected\n`;
        prompt += `4. .dockerignore for optimization\n`;
        prompt += `5. .env.example with all required environment variables\n\n`;

        prompt += `Ensure all configurations follow best practices for security, performance, and maintainability.\n`;

        return prompt;
    }
}
