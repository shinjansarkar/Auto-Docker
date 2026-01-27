import * as vscode from 'vscode';

/**
 * Prompt Engineering Service
 * 
 * Advanced prompt optimization and management system for Docker generation.
 * Implements dynamic optimization, chain-of-thought reasoning, few-shot learning,
 * and RAG-enhanced prompting.
 * 
 * @version 2.7.0
 * @since Phase 9
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface PromptTemplate {
    id: string;
    name: string;
    version: string;
    category: 'dockerfile' | 'compose' | 'analysis' | 'security' | 'optimization';
    template: string;
    variables: string[];
    tokenCount: number;
    priority: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface PromptContext {
    projectType: string;
    framework?: string;
    language?: string;
    dependencies?: string[];
    projectSize: 'small' | 'medium' | 'large' | 'enterprise';
    complexity: 'simple' | 'moderate' | 'complex';
    requirements?: string[];
    constraints?: string[];
    previousAttempts?: number;
    errorHistory?: string[];
}

export interface OptimizationStrategy {
    name: string;
    description: string;
    apply: (prompt: string, context: PromptContext) => string;
    weight: number;
}

export interface FewShotExample {
    id: string;
    input: string;
    output: string;
    context: PromptContext;
    quality: number; // 0-100 quality score
    usage: number; // Times used
    successRate: number; // 0-100
}

export interface ChainOfThoughtStep {
    step: number;
    description: string;
    reasoning: string;
    output: string;
}

export interface PromptMetrics {
    promptId: string;
    tokenCount: number;
    executionTime: number;
    quality: number;
    successRate: number;
    costEstimate: number;
    timestamp: Date;
}

export interface OptimizedPrompt {
    original: string;
    optimized: string;
    strategy: string;
    improvements: string[];
    tokenReduction: number;
    qualityScore: number;
    chainOfThought?: ChainOfThoughtStep[];
    fewShotExamples?: FewShotExample[];
    ragContext?: string;
}

// ============================================================================
// PROMPT ENGINEERING SERVICE
// ============================================================================

export class PromptEngineeringService {
    private templates: Map<string, PromptTemplate> = new Map();
    private fewShotExamples: Map<string, FewShotExample[]> = new Map();
    private metrics: PromptMetrics[] = [];
    // RAG service disabled - not needed for core functionality
    // private ragService?: RAGService;
    private config: vscode.WorkspaceConfiguration;
    private optimizationStrategies: OptimizationStrategy[] = [];

    // Template versions for A/B testing
    private templateVersions: Map<string, PromptTemplate[]> = new Map();
    private activeExperiments: Map<string, string> = new Map();

    constructor() {
        this.config = vscode.workspace.getConfiguration('autoDocker');
        this.initializeTemplates();
        this.initializeOptimizationStrategies();
        this.initializeFewShotExamples();
        
        // RAG Service will be initialized when needed
        // RAG integration disabled temporarily due to API changes
    }

    // ========================================================================
    // TEMPLATE MANAGEMENT
    // ========================================================================

    private initializeTemplates(): void {
        // Dockerfile Generation Templates
        this.addTemplate({
            id: 'dockerfile-basic-v1',
            name: 'Basic Dockerfile Generation',
            version: '1.0.0',
            category: 'dockerfile',
            template: `You are an expert Docker engineer specializing in creating optimized Dockerfiles.

PROJECT CONTEXT:
- Project Type: {{projectType}}
- Language: {{language}}
- Framework: {{framework}}
- Dependencies: {{dependencies}}

REQUIREMENTS:
{{requirements}}

INSTRUCTIONS:
1. Analyze the project structure and dependencies
2. Create a multi-stage Dockerfile optimized for {{projectSize}} projects
3. Implement security best practices
4. Optimize for build speed and image size
5. Include health checks and proper signal handling

Generate a production-ready Dockerfile following Docker best practices.`,
            variables: ['projectType', 'language', 'framework', 'dependencies', 'requirements', 'projectSize'],
            tokenCount: 150,
            priority: 1,
            tags: ['dockerfile', 'basic', 'production'],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        this.addTemplate({
            id: 'dockerfile-advanced-v1',
            name: 'Advanced Dockerfile with Chain-of-Thought',
            version: '1.0.0',
            category: 'dockerfile',
            template: `You are an expert Docker engineer. Let's think through this step by step.

PROJECT ANALYSIS:
- Project Type: {{projectType}}
- Language: {{language}}
- Framework: {{framework}}
- Complexity: {{complexity}}
- Size: {{projectSize}}

STEP 1: ANALYZE REQUIREMENTS
First, let's identify the key requirements:
{{requirements}}

STEP 2: PLAN BUILD STRATEGY
Consider:
- What base image is most appropriate?
- What build stages are needed?
- How can we optimize layer caching?
- What security measures are essential?

STEP 3: DESIGN MULTI-STAGE BUILD
Think about:
- Dependencies installation
- Build artifacts
- Runtime requirements
- Image size optimization

STEP 4: IMPLEMENT SECURITY
Consider:
- Non-root user
- Minimal attack surface
- Secret management
- Vulnerability scanning

STEP 5: GENERATE DOCKERFILE
Now, based on this analysis, create an optimized Dockerfile.`,
            variables: ['projectType', 'language', 'framework', 'complexity', 'projectSize', 'requirements'],
            tokenCount: 250,
            priority: 2,
            tags: ['dockerfile', 'advanced', 'chain-of-thought'],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Docker Compose Templates
        this.addTemplate({
            id: 'compose-basic-v1',
            name: 'Basic Docker Compose Generation',
            version: '1.0.0',
            category: 'compose',
            template: `You are an expert in Docker Compose orchestration.

PROJECT CONTEXT:
- Services: {{services}}
- Dependencies: {{dependencies}}
- Network Requirements: {{networkRequirements}}

TASK:
Create a docker-compose.yml file that:
1. Defines all required services
2. Sets up proper networking
3. Configures volumes for data persistence
4. Implements health checks
5. Manages environment variables securely

Generate a production-ready docker-compose.yml file.`,
            variables: ['services', 'dependencies', 'networkRequirements'],
            tokenCount: 120,
            priority: 1,
            tags: ['compose', 'basic', 'orchestration'],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Analysis Templates
        this.addTemplate({
            id: 'analysis-comprehensive-v1',
            name: 'Comprehensive Project Analysis',
            version: '1.0.0',
            category: 'analysis',
            template: `You are an expert code analyst specializing in containerization assessment.

PROJECT TO ANALYZE:
{{projectPath}}

ANALYSIS OBJECTIVES:
1. Identify all runtime dependencies
2. Detect frameworks and build tools
3. Assess security requirements
4. Evaluate scalability needs
5. Determine optimal containerization strategy

CONTEXT:
{{context}}

Provide a detailed analysis report with actionable recommendations.`,
            variables: ['projectPath', 'context'],
            tokenCount: 130,
            priority: 1,
            tags: ['analysis', 'comprehensive'],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Security Templates
        this.addTemplate({
            id: 'security-audit-v1',
            name: 'Security Audit Prompt',
            version: '1.0.0',
            category: 'security',
            template: `You are a security expert specializing in container security.

AUDIT TARGET:
{{target}}

SECURITY CHECKLIST:
1. Base image vulnerabilities
2. Exposed secrets and credentials
3. Privilege escalation risks
4. Network exposure
5. Data persistence security
6. Supply chain integrity

PREVIOUS ISSUES:
{{errorHistory}}

Conduct a thorough security audit and provide remediation steps.`,
            variables: ['target', 'errorHistory'],
            tokenCount: 110,
            priority: 3,
            tags: ['security', 'audit'],
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Optimization Templates
        this.addTemplate({
            id: 'optimization-performance-v1',
            name: 'Performance Optimization',
            version: '1.0.0',
            category: 'optimization',
            template: `You are a Docker optimization specialist.

CURRENT CONFIGURATION:
{{currentConfig}}

PERFORMANCE METRICS:
- Build Time: {{buildTime}}
- Image Size: {{imageSize}}
- Startup Time: {{startupTime}}

OPTIMIZATION GOALS:
{{goals}}

Analyze and provide specific optimization recommendations to improve performance.`,
            variables: ['currentConfig', 'buildTime', 'imageSize', 'startupTime', 'goals'],
            tokenCount: 100,
            priority: 2,
            tags: ['optimization', 'performance'],
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    private addTemplate(template: PromptTemplate): void {
        this.templates.set(template.id, template);
        
        // Add to version tracking
        if (!this.templateVersions.has(template.id)) {
            this.templateVersions.set(template.id, []);
        }
        this.templateVersions.get(template.id)!.push(template);
    }

    // ========================================================================
    // OPTIMIZATION STRATEGIES
    // ========================================================================

    private initializeOptimizationStrategies(): void {
        this.optimizationStrategies = [
            {
                name: 'Token Reduction',
                description: 'Reduce prompt tokens while maintaining quality',
                weight: 0.3,
                apply: (prompt: string, context: PromptContext) => {
                    // Remove redundant whitespace
                    let optimized = prompt.replace(/\s+/g, ' ').trim();
                    
                    // Remove verbose instructions for simple projects
                    if (context.complexity === 'simple') {
                        optimized = optimized.replace(/Let's think through this step by step\./g, '');
                        optimized = optimized.replace(/Consider:[\s\S]*?(?=\n\n|\n[A-Z]|$)/g, '');
                    }
                    
                    return optimized;
                }
            },
            {
                name: 'Context Injection',
                description: 'Add relevant context based on project analysis',
                weight: 0.4,
                apply: (prompt: string, context: PromptContext) => {
                    let enhanced = prompt;
                    
                    // Add framework-specific context
                    if (context.framework) {
                        const frameworkContext = this.getFrameworkContext(context.framework);
                        enhanced = enhanced.replace(
                            '{{framework}}',
                            `${context.framework}\n\nFRAMEWORK NOTES:\n${frameworkContext}`
                        );
                    }
                    
                    // Add error-based context
                    if (context.errorHistory && context.errorHistory.length > 0) {
                        const errorContext = `\n\nPREVIOUS ERRORS TO AVOID:\n${context.errorHistory.slice(0, 3).join('\n')}`;
                        enhanced += errorContext;
                    }
                    
                    return enhanced;
                }
            },
            {
                name: 'Few-Shot Enhancement',
                description: 'Add relevant examples to improve output quality',
                weight: 0.5,
                apply: (prompt: string, context: PromptContext) => {
                    const examples = this.getFewShotExamples(context, 2);
                    if (examples.length === 0) return prompt;
                    
                    let examplesText = '\n\nEXAMPLES FOR REFERENCE:\n\n';
                    examples.forEach((ex, idx) => {
                        examplesText += `Example ${idx + 1}:\nInput: ${ex.input}\nOutput: ${ex.output}\n\n`;
                    });
                    
                    return prompt + examplesText;
                }
            },
            {
                name: 'Chain-of-Thought',
                description: 'Add structured reasoning steps for complex tasks',
                weight: 0.6,
                apply: (prompt: string, context: PromptContext) => {
                    if (context.complexity !== 'complex') return prompt;
                    
                    const cotPrefix = `Let's approach this systematically:\n\n`;
                    const cotSteps = `
REASONING STEPS:
1. Analyze the requirements and constraints
2. Identify potential challenges and solutions
3. Design the optimal approach
4. Consider edge cases and error handling
5. Implement with best practices

Now, let's proceed:\n\n`;
                    
                    return cotPrefix + cotSteps + prompt;
                }
            },
            {
                name: 'RAG Enhancement',
                description: 'Enhance with relevant documentation and examples',
                weight: 0.7,
                apply: (prompt: string, context: PromptContext) => {
                    if (!this.ragService) return prompt;
                    
                    // RAG context will be added asynchronously
                    // This is a placeholder for the synchronous strategy
                    return prompt + '\n\n[RAG context will be injected here]';
                }
            },
            {
                name: 'Constraint Specification',
                description: 'Add explicit constraints and requirements',
                weight: 0.5,
                apply: (prompt: string, context: PromptContext) => {
                    if (!context.constraints || context.constraints.length === 0) return prompt;
                    
                    const constraintsText = `\n\nCONSTRAINTS:\n${context.constraints.map(c => `- ${c}`).join('\n')}`;
                    return prompt + constraintsText;
                }
            }
        ];
    }

    // ========================================================================
    // FEW-SHOT LEARNING
    // ========================================================================

    private initializeFewShotExamples(): void {
        // Node.js Express Example
        this.addFewShotExample({
            id: 'nodejs-express-1',
            input: 'Node.js Express API with MongoDB',
            output: `FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
USER node
CMD ["node", "server.js"]`,
            context: {
                projectType: 'nodejs',
                framework: 'express',
                language: 'javascript',
                projectSize: 'medium',
                complexity: 'moderate'
            },
            quality: 95,
            usage: 0,
            successRate: 98
        });

        // Python FastAPI Example
        this.addFewShotExample({
            id: 'python-fastapi-1',
            input: 'Python FastAPI with PostgreSQL',
            output: `FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`,
            context: {
                projectType: 'python',
                framework: 'fastapi',
                language: 'python',
                projectSize: 'medium',
                complexity: 'moderate'
            },
            quality: 92,
            usage: 0,
            successRate: 95
        });

        // React Frontend Example
        this.addFewShotExample({
            id: 'react-frontend-1',
            input: 'React SPA with Nginx',
            output: `FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 755 /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
            context: {
                projectType: 'frontend',
                framework: 'react',
                language: 'javascript',
                projectSize: 'medium',
                complexity: 'simple'
            },
            quality: 93,
            usage: 0,
            successRate: 97
        });

        // Microservices Example
        this.addFewShotExample({
            id: 'microservices-1',
            input: 'Microservices with Docker Compose',
            output: `version: '3.8'
services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=db
    depends_on:
      - db
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_PASSWORD=secret
    volumes:
      - db-data:/var/lib/postgresql/data
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - api

volumes:
  db-data:`,
            context: {
                projectType: 'microservices',
                framework: 'multi',
                language: 'multi',
                projectSize: 'large',
                complexity: 'complex'
            },
            quality: 90,
            usage: 0,
            successRate: 93
        });
    }

    private addFewShotExample(example: FewShotExample): void {
        const key = `${example.context.projectType}-${example.context.framework || 'default'}`;
        if (!this.fewShotExamples.has(key)) {
            this.fewShotExamples.set(key, []);
        }
        this.fewShotExamples.get(key)!.push(example);
    }

    private getFewShotExamples(context: PromptContext, count: number): FewShotExample[] {
        const key = `${context.projectType}-${context.framework || 'default'}`;
        const examples = this.fewShotExamples.get(key) || [];
        
        // Sort by quality and success rate
        const sorted = examples.sort((a, b) => {
            const scoreA = (a.quality * 0.6) + (a.successRate * 0.4);
            const scoreB = (b.quality * 0.6) + (b.successRate * 0.4);
            return scoreB - scoreA;
        });
        
        return sorted.slice(0, count);
    }

    // ========================================================================
    // PROMPT OPTIMIZATION
    // ========================================================================

    public async optimizePrompt(
        templateId: string,
        context: PromptContext,
        options?: {
            enableChainOfThought?: boolean;
            enableFewShot?: boolean;
            enableRAG?: boolean;
            maxTokens?: number;
        }
    ): Promise<OptimizedPrompt> {
        const startTime = Date.now();
        const template = this.templates.get(templateId);
        
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Start with the base template
        let prompt = this.interpolateTemplate(template.template, context);
        const original = prompt;

        // Apply optimization strategies
        const enabledStrategies = this.optimizationStrategies
            .sort((a, b) => b.weight - a.weight);

        const improvements: string[] = [];
        
        for (const strategy of enabledStrategies) {
            const before = this.estimateTokens(prompt);
            prompt = strategy.apply(prompt, context);
            const after = this.estimateTokens(prompt);
            
            if (before !== after) {
                improvements.push(`${strategy.name}: ${before - after} tokens saved`);
            }
        }

        // Add chain-of-thought if enabled
        let chainOfThought: ChainOfThoughtStep[] | undefined;
        if (options?.enableChainOfThought && context.complexity === 'complex') {
            const cot = this.generateChainOfThought(context);
            chainOfThought = cot;
            prompt = this.injectChainOfThought(prompt, cot);
        }

        // Add few-shot examples if enabled
        let fewShotExamples: FewShotExample[] | undefined;
        if (options?.enableFewShot) {
            const examples = this.getFewShotExamples(context, 2);
            if (examples.length > 0) {
                fewShotExamples = examples;
                prompt = this.injectFewShotExamples(prompt, examples);
            }
        }

        // Add RAG context if enabled
        let ragContext: string | undefined;
        if (options?.enableRAG && this.ragService) {
            ragContext = await this.enhanceWithRAG(prompt, context);
            prompt = this.injectRAGContext(prompt, ragContext);
        }

        // Token limit check
        const finalTokens = this.estimateTokens(prompt);
        if (options?.maxTokens && finalTokens > options.maxTokens) {
            prompt = this.truncateToTokenLimit(prompt, options.maxTokens);
            improvements.push(`Truncated to ${options.maxTokens} tokens`);
        }

        // Calculate metrics
        const tokenReduction = this.estimateTokens(original) - this.estimateTokens(prompt);
        const qualityScore = this.calculatePromptQuality(prompt, context);

        // Record metrics
        this.recordMetrics({
            promptId: templateId,
            tokenCount: this.estimateTokens(prompt),
            executionTime: Date.now() - startTime,
            quality: qualityScore,
            successRate: 0, // Will be updated after execution
            costEstimate: this.estimateCost(prompt),
            timestamp: new Date()
        });

        return {
            original,
            optimized: prompt,
            strategy: enabledStrategies.map(s => s.name).join(', '),
            improvements,
            tokenReduction,
            qualityScore,
            chainOfThought,
            fewShotExamples,
            ragContext
        };
    }

    // ========================================================================
    // CHAIN-OF-THOUGHT REASONING
    // ========================================================================

    private generateChainOfThought(context: PromptContext): ChainOfThoughtStep[] {
        const steps: ChainOfThoughtStep[] = [];

        // Step 1: Requirement Analysis
        steps.push({
            step: 1,
            description: 'Analyze Project Requirements',
            reasoning: `Examining ${context.projectType} project with ${context.complexity} complexity`,
            output: `Key requirements identified: ${context.requirements?.join(', ') || 'standard deployment'}`
        });

        // Step 2: Technology Assessment
        steps.push({
            step: 2,
            description: 'Assess Technology Stack',
            reasoning: `Language: ${context.language}, Framework: ${context.framework || 'none'}`,
            output: `Technology stack requires: ${this.getTechRequirements(context)}`
        });

        // Step 3: Architecture Planning
        steps.push({
            step: 3,
            description: 'Plan Container Architecture',
            reasoning: `Project size (${context.projectSize}) suggests ${this.getArchitectureRecommendation(context)}`,
            output: `Architecture: ${this.getArchitectureRecommendation(context)}`
        });

        // Step 4: Security Considerations
        steps.push({
            step: 4,
            description: 'Evaluate Security Requirements',
            reasoning: 'Applying security best practices',
            output: 'Security measures: non-root user, minimal base image, secret management'
        });

        // Step 5: Optimization Strategy
        steps.push({
            step: 5,
            description: 'Determine Optimization Strategy',
            reasoning: `Optimizing for ${context.projectSize} project`,
            output: 'Focus on: build cache, layer optimization, multi-stage builds'
        });

        return steps;
    }

    private injectChainOfThought(prompt: string, steps: ChainOfThoughtStep[]): string {
        let cot = '\n\nREASONING PROCESS:\n';
        steps.forEach(step => {
            cot += `\nStep ${step.step}: ${step.description}\n`;
            cot += `Reasoning: ${step.reasoning}\n`;
            cot += `Output: ${step.output}\n`;
        });
        cot += '\nBased on this analysis, proceed with generation:\n';
        
        return cot + prompt;
    }

    // ========================================================================
    // RAG ENHANCEMENT
    // ========================================================================

    private async enhanceWithRAG(prompt: string, context: PromptContext): Promise<string> {
        if (!this.ragService) {
            return '';
        }

        try {
            // Query RAG for relevant documentation
            const query = `${context.projectType} ${context.framework} Docker best practices`;
            // RAG integration temporarily disabled
            // const ragResults = await this.ragService.query(query, 3);
            const ragResults: any[] = [];
            
            if (!ragResults || ragResults.length === 0) {
                return '';
            }

            let ragContext = 'RELEVANT DOCUMENTATION:\n\n';
            ragResults.forEach((result: any, idx: number) => {
                ragContext += `${idx + 1}. ${result.content}\n`;
                ragContext += `   Source: ${result.metadata.source}\n\n`;
            });

            return ragContext;
        } catch (error) {
            console.error('RAG enhancement failed:', error);
            return '';
        }
    }

    private injectRAGContext(prompt: string, ragContext: string): string {
        if (!ragContext) return prompt;
        
        // Insert RAG context after the main instructions
        const sections = prompt.split('\n\n');
        sections.splice(2, 0, ragContext);
        return sections.join('\n\n');
    }

    // ========================================================================
    // FEW-SHOT INJECTION
    // ========================================================================

    private injectFewShotExamples(prompt: string, examples: FewShotExample[]): string {
        if (examples.length === 0) return prompt;

        let examplesSection = '\n\nREFERENCE EXAMPLES:\n\n';
        examples.forEach((example, idx) => {
            examplesSection += `Example ${idx + 1} (Quality: ${example.quality}/100, Success Rate: ${example.successRate}%):\n`;
            examplesSection += `Input: ${example.input}\n`;
            examplesSection += `Output:\n${example.output}\n\n`;
            
            // Update usage statistics
            example.usage++;
        });

        examplesSection += 'Using these examples as reference, generate appropriate output:\n';
        
        return examplesSection + prompt;
    }

    // ========================================================================
    // TEMPLATE UTILITIES
    // ========================================================================

    private interpolateTemplate(template: string, context: PromptContext): string {
        let result = template;
        
        // Replace standard variables
        result = result.replace(/\{\{projectType\}\}/g, context.projectType || 'unknown');
        result = result.replace(/\{\{language\}\}/g, context.language || 'unknown');
        result = result.replace(/\{\{framework\}\}/g, context.framework || 'none');
        result = result.replace(/\{\{complexity\}\}/g, context.complexity || 'moderate');
        result = result.replace(/\{\{projectSize\}\}/g, context.projectSize || 'medium');
        
        // Replace array variables
        result = result.replace(/\{\{dependencies\}\}/g, 
            context.dependencies?.join(', ') || 'none specified');
        result = result.replace(/\{\{requirements\}\}/g,
            context.requirements?.map(r => `- ${r}`).join('\n') || 'No specific requirements');
        result = result.replace(/\{\{errorHistory\}\}/g,
            context.errorHistory?.join('\n') || 'No previous errors');
        
        return result;
    }

    private getFrameworkContext(framework: string): string {
        const contexts: Record<string, string> = {
            'express': 'Express.js requires Node.js runtime. Use npm ci for production. Port 3000 is standard.',
            'fastapi': 'FastAPI requires Python 3.7+. Use uvicorn as ASGI server. Port 8000 is standard.',
            'react': 'React apps are static builds. Use nginx for serving. Build with npm run build.',
            'nextjs': 'Next.js supports SSR and SSG. Port 3000 is standard. Use standalone build for optimization.',
            'django': 'Django requires Python 3.8+. Use gunicorn for production. Port 8000 is standard.',
            'flask': 'Flask requires Python 3.7+. Use gunicorn for production. Port 5000 is standard.',
            'springboot': 'Spring Boot requires Java 11+. Port 8080 is standard. Use layered JARs.',
            'dotnet': '.NET 6+ recommended. Use aspnet runtime. Port 80/443 standard.'
        };
        
        return contexts[framework.toLowerCase()] || `${framework} framework detected`;
    }

    private getTechRequirements(context: PromptContext): string {
        const reqs: string[] = [];
        
        if (context.language === 'javascript' || context.language === 'typescript') {
            reqs.push('Node.js runtime');
        } else if (context.language === 'python') {
            reqs.push('Python interpreter');
        } else if (context.language === 'java') {
            reqs.push('JRE/JDK');
        }
        
        if (context.framework) {
            reqs.push(`${context.framework} framework`);
        }
        
        if (context.dependencies && context.dependencies.length > 0) {
            reqs.push(`${context.dependencies.length} dependencies`);
        }
        
        return reqs.join(', ');
    }

    private getArchitectureRecommendation(context: PromptContext): string {
        if (context.projectSize === 'small') {
            return 'Single-stage build with minimal layers';
        } else if (context.projectSize === 'medium') {
            return 'Multi-stage build for optimization';
        } else if (context.projectSize === 'large') {
            return 'Multi-stage build with advanced caching';
        } else {
            return 'Distributed multi-container architecture';
        }
    }

    // ========================================================================
    // TOKEN MANAGEMENT
    // ========================================================================

    private estimateTokens(text: string): number {
        // Rough estimation: 1 token ≈ 4 characters for English text
        // This is a simplified version; real tokenization is more complex
        return Math.ceil(text.length / 4);
    }

    private truncateToTokenLimit(prompt: string, maxTokens: number): string {
        const currentTokens = this.estimateTokens(prompt);
        if (currentTokens <= maxTokens) return prompt;
        
        const ratio = maxTokens / currentTokens;
        const targetLength = Math.floor(prompt.length * ratio * 0.95); // 95% to be safe
        
        return prompt.substring(0, targetLength) + '\n\n[Truncated to fit token limit]';
    }

    private estimateCost(prompt: string): number {
        const tokens = this.estimateTokens(prompt);
        // Rough cost estimation (adjust based on actual model pricing)
        // Example: $0.002 per 1K tokens for input
        return (tokens / 1000) * 0.002;
    }

    // ========================================================================
    // QUALITY ASSESSMENT
    // ========================================================================

    private calculatePromptQuality(prompt: string, context: PromptContext): number {
        let score = 100;
        
        // Deduct for missing context
        if (!prompt.includes(context.projectType)) score -= 10;
        if (context.framework && !prompt.includes(context.framework)) score -= 5;
        
        // Deduct for excessive length
        const tokens = this.estimateTokens(prompt);
        if (tokens > 1000) score -= Math.min((tokens - 1000) / 100, 20);
        
        // Add for best practices mentions
        if (prompt.includes('security')) score += 5;
        if (prompt.includes('optimization')) score += 5;
        if (prompt.includes('best practices')) score += 5;
        
        // Add for structured approach
        if (prompt.includes('STEP') || prompt.includes('Step')) score += 10;
        
        return Math.max(0, Math.min(100, score));
    }

    // ========================================================================
    // METRICS AND ANALYTICS
    // ========================================================================

    private recordMetrics(metrics: PromptMetrics): void {
        this.metrics.push(metrics);
        
        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }
    }

    public getMetrics(templateId?: string): PromptMetrics[] {
        if (templateId) {
            return this.metrics.filter(m => m.promptId === templateId);
        }
        return this.metrics;
    }

    public getAverageQuality(templateId?: string): number {
        const relevantMetrics = this.getMetrics(templateId);
        if (relevantMetrics.length === 0) return 0;
        
        const sum = relevantMetrics.reduce((acc, m) => acc + m.quality, 0);
        return sum / relevantMetrics.length;
    }

    public getTotalCost(): number {
        return this.metrics.reduce((acc, m) => acc + m.costEstimate, 0);
    }

    // ========================================================================
    // A/B TESTING
    // ========================================================================

    public startExperiment(templateId: string, variantId: string): void {
        this.activeExperiments.set(templateId, variantId);
    }

    public getActiveVariant(templateId: string): PromptTemplate | undefined {
        const variantId = this.activeExperiments.get(templateId);
        if (!variantId) {
            return this.templates.get(templateId);
        }
        
        return this.templates.get(variantId);
    }

    public compareVariants(templateIdA: string, templateIdB: string): {
        templateA: string;
        templateB: string;
        qualityA: number;
        qualityB: number;
        winner: string;
    } {
        const qualityA = this.getAverageQuality(templateIdA);
        const qualityB = this.getAverageQuality(templateIdB);
        
        return {
            templateA: templateIdA,
            templateB: templateIdB,
            qualityA,
            qualityB,
            winner: qualityA > qualityB ? templateIdA : templateIdB
        };
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    public async generateOptimizedPrompt(
        category: 'dockerfile' | 'compose' | 'analysis' | 'security' | 'optimization',
        context: PromptContext
    ): Promise<OptimizedPrompt> {
        // Select best template for category
        const templates = Array.from(this.templates.values())
            .filter(t => t.category === category)
            .sort((a, b) => b.priority - a.priority);
        
        if (templates.length === 0) {
            throw new Error(`No templates found for category: ${category}`);
        }
        
        const template = templates[0];
        
        // Optimize with all enhancements
        return this.optimizePrompt(template.id, context, {
            enableChainOfThought: context.complexity === 'complex',
            enableFewShot: true,
            enableRAG: this.config.get<boolean>('enableRAGEnhancedPrompts', true),
            maxTokens: this.config.get<number>('maxPromptTokens', 2000)
        });
    }

    public getTemplate(id: string): PromptTemplate | undefined {
        return this.templates.get(id);
    }

    public getAllTemplates(): PromptTemplate[] {
        return Array.from(this.templates.values());
    }

    public updateTemplate(id: string, updates: Partial<PromptTemplate>): void {
        const template = this.templates.get(id);
        if (!template) {
            throw new Error(`Template not found: ${id}`);
        }
        
        const updated = { ...template, ...updates, updatedAt: new Date() };
        this.templates.set(id, updated);
    }

    public getStats(): {
        totalTemplates: number;
        totalExamples: number;
        totalMetrics: number;
        averageQuality: number;
        totalCost: number;
    } {
        return {
            totalTemplates: this.templates.size,
            totalExamples: Array.from(this.fewShotExamples.values()).flat().length,
            totalMetrics: this.metrics.length,
            averageQuality: this.getAverageQuality(),
            totalCost: this.getTotalCost()
        };
    }
}
