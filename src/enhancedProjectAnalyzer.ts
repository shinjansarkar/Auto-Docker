/**
 * Enhanced Project Analyzer with RAG Integration
 * 
 * This analyzer integrates:
 * 1. File Embeddings - Smart file filtering and ranking
 * 2. LSP Metadata - Language server protocol for deep code understanding
 * 3. RAG - Retrieval Augmented Generation for optimal AI context
 */

import * as vscode from 'vscode';
import { ProjectAnalyzer, ProjectStructure } from './projectAnalyzer';
import { EmbeddingService, FileEmbedding } from './embeddingService';
import { LSPMetadataService, LSPMetadata } from './lspMetadataService';
import { RAGService, RAGContext } from './ragService';

export interface EnhancedProjectAnalysis {
    // Traditional analysis (backward compatible)
    projectStructure: ProjectStructure;

    // New advanced analysis
    fileEmbeddings: FileEmbedding[];
    lspMetadata: LSPMetadata;
    ragContext: RAGContext;

    // Summary and insights
    analysisSummary: string;
    codebaseInsights: CodebaseInsights;
}

export interface CodebaseInsights {
    totalFiles: number;
    criticalFiles: number;
    primaryLanguages: string[];
    detectedFrameworks: string[];
    entryPoints: string[];
    recommendedDockerStrategy: string;
    estimatedComplexity: 'simple' | 'moderate' | 'complex' | 'enterprise';
}

export class EnhancedProjectAnalyzer {
    private workspaceRoot: string;
    private outputChannel: vscode.OutputChannel;

    // Service instances
    private projectAnalyzer: ProjectAnalyzer;
    private embeddingService: EmbeddingService;
    private lspService: LSPMetadataService;
    private ragService: RAGService;

    constructor(workspaceRoot: string, outputChannel: vscode.OutputChannel) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel;

        // Initialize all services
        this.projectAnalyzer = new ProjectAnalyzer(workspaceRoot);
        this.embeddingService = new EmbeddingService(workspaceRoot);
        this.lspService = new LSPMetadataService(workspaceRoot, outputChannel);
        this.ragService = new RAGService(workspaceRoot, outputChannel);
    }

    /**
     * Main method: Perform comprehensive codebase analysis
     */
    async analyzeWithAdvancedFeatures(model: string = 'gpt-4'): Promise<EnhancedProjectAnalysis> {
        this.outputChannel.appendLine('\n🚀 Enhanced Project Analysis Started...');
        this.outputChannel.appendLine('━'.repeat(60));

        try {
            // Step 1: Traditional project analysis (existing functionality)
            this.outputChannel.appendLine('📦 Running traditional project analysis...');
            const projectStructure = await this.projectAnalyzer.analyzeProject();

            // Step 2: Generate file embeddings
            this.outputChannel.appendLine('🔍 Generating file embeddings...');
            const fileEmbeddings = await this.embeddingService.generateFileEmbeddings();
            this.outputChannel.appendLine(`   Found ${fileEmbeddings.length} files with importance scores`);

            // Step 3: Extract LSP metadata
            this.outputChannel.appendLine('🔬 Extracting LSP metadata...');
            const lspMetadata = await this.lspService.extractMetadata();
            this.outputChannel.appendLine(`   Detected ${lspMetadata.frameworks.length} frameworks`);

            // Step 4: Build RAG context
            this.outputChannel.appendLine('🧠 Building RAG context for AI...');
            const ragContext = await this.ragService.buildContext(model);
            this.outputChannel.appendLine(`   Context built: ${ragContext.criticalFiles.length} files, ~${ragContext.totalTokens} tokens`);

            // Step 5: Generate comprehensive analysis summary
            this.outputChannel.appendLine('📊 Generating analysis summary...');
            const analysisSummary = this.generateAnalysisSummary(
                projectStructure,
                fileEmbeddings,
                lspMetadata,
                ragContext
            );

            // Step 6: Extract codebase insights
            const codebaseInsights = this.extractCodebaseInsights(
                projectStructure,
                fileEmbeddings,
                lspMetadata
            );

            this.outputChannel.appendLine('━'.repeat(60));
            this.outputChannel.appendLine('✅ Enhanced Analysis Complete!\n');
            this.displayAnalysisSummary(codebaseInsights);

            return {
                projectStructure,
                fileEmbeddings,
                lspMetadata,
                ragContext,
                analysisSummary,
                codebaseInsights
            };
        } catch (error) {
            this.outputChannel.appendLine(`❌ Error during analysis: ${error}`);
            throw error;
        }
    }

    /**
     * Generate a comprehensive analysis summary
     */
    private generateAnalysisSummary(
        projectStructure: ProjectStructure,
        embeddings: FileEmbedding[],
        lspMetadata: LSPMetadata,
        ragContext: RAGContext
    ): string {
        let summary = `# Enhanced Project Analysis Report\n\n`;

        // Project Overview
        summary += `## Project Overview\n`;
        summary += `- **Type**: ${projectStructure.projectType}\n`;
        summary += `- **Primary Language**: ${lspMetadata.languageInfo.primary}\n`;
        summary += `- **Total Files Analyzed**: ${embeddings.length}\n`;
        summary += `- **Critical Files**:  ${ragContext.criticalFiles.length}\n`;
        summary += `- **Entry Points**: ${lspMetadata.entryPoints.length}\n\n`;

        // Technical Stack
        summary += `## Technical Stack\n`;
        if (projectStructure.frontend) {
            summary += `- **Frontend**: ${projectStructure.frontend}\n`;
        }
        if (projectStructure.backend) {
            summary += `- **Backend**: ${projectStructure.backend}\n`;
        }
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            summary += `- **Databases**: ${projectStructure.databases.join(', ')}\n`;
        }
        if (ragContext.technicalStack.frameworks.length > 0) {
            summary += `- **Frameworks**: ${ragContext.technicalStack.frameworks.join(', ')}\n`;
        }
        summary += `\n`;

        // Top Critical Files
        summary += `## Top Critical Files\n`;
        ragContext.criticalFiles.slice(0, 10).forEach((file, index) => {
            summary += `${index + 1}. ${file.path} (${file.category}, relevance: ${(file.relevance * 100).toFixed(0)}%)\n`;
        });
        summary += `\n`;

        // Recommendations
        if (ragContext.recommendations.length > 0) {
            summary += `## Docker Configuration Recommendations\n`;
            ragContext.recommendations.forEach((rec, index) => {
                summary += `${index + 1}. ${rec}\n`;
            });
        }

        return summary;
    }

    /**
     * Extract codebase insights for decision making
     */
    private extractCodebaseInsights(
        projectStructure: ProjectStructure,
        embeddings: FileEmbedding[],
        lspMetadata: LSPMetadata
    ): CodebaseInsights {
        const criticalFiles = embeddings.filter(e => e.relevance > 0.7).length;

        // Determine complexity
        let complexity: CodebaseInsights['estimatedComplexity'] = 'simple';
        if (projectStructure.isMonorepo || (projectStructure.services && projectStructure.services.length > 2)) {
            complexity = 'enterprise';
        } else if (embeddings.length > 100 || lspMetadata.frameworks.length > 3) {
            complexity = 'complex';
        } else if (embeddings.length > 50 || lspMetadata.frameworks.length > 1) {
            complexity = 'moderate';
        }

        // Recommended Docker strategy
        let dockerStrategy = 'Single Dockerfile';
        if (projectStructure.isMonorepo) {
            dockerStrategy = 'Multi-service docker-compose with separate Dockerfiles';
        } else if (projectStructure.hasMultiStage) {
            dockerStrategy = 'Multi-stage Dockerfile for optimized builds';
        }

        return {
            totalFiles: embeddings.length,
            criticalFiles,
            primaryLanguages: [lspMetadata.languageInfo.primary, ...lspMetadata.languageInfo.secondary],
            detectedFrameworks: lspMetadata.frameworks.map(f => f.name),
            entryPoints: lspMetadata.entryPoints.map(ep => ep.file),
            recommendedDockerStrategy: dockerStrategy,
            estimatedComplexity: complexity
        };
    }

    /**
     * Display analysis summary in output channel
     */
    private displayAnalysisSummary(insights: CodebaseInsights): void {
        this.outputChannel.appendLine('\n📊 CODEBASE INSIGHTS:');
        this.outputChannel.appendLine(`   • Total Files: ${insights.totalFiles}`);
        this.outputChannel.appendLine(`   • Critical Files: ${insights.criticalFiles}`);
        this.outputChannel.appendLine(`   • Complexity: ${insights.estimatedComplexity.toUpperCase()}`);
        this.outputChannel.appendLine(`   • Languages: ${insights.primaryLanguages.join(', ')}`);
        this.outputChannel.appendLine(`   • Frameworks: ${insights.detectedFrameworks.join(', ')}`);
        this.outputChannel.appendLine(`   • Strategy: ${insights.recommendedDockerStrategy}\n`);
    }

    /**
     * Get formatted RAG context for AI prompt
     */
    async getFormattedContextForAI(model: string = 'gpt-4'): Promise<string> {
        const ragContext = await this.ragService.buildContext(model);
        return await this.ragService.formatForAI(ragContext);
    }

    /**
     * Get just the file embeddings (for backward compatibility)
     */
    async getFileEmbeddings(): Promise<FileEmbedding[]> {
        return await this.embeddingService.generateFileEmbeddings();
    }

    /**
     * Get just the LSP metadata (for backward compatibility)
     */
    async getLSPMetadata(): Promise<LSPMetadata> {
        return await this.lspService.extractMetadata();
    }
}
