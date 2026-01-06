/**
 * Schema Validation Service using Zod
 * Provides runtime type validation for all parsed configurations
 * Ensures type safety before file writing operations
 */

import { z } from 'zod';
import * as yaml from 'js-yaml';

/**
 * Validation Result Interface
 */
export interface ValidationResult<T = any> {
    valid: boolean;
    data?: T;
    errors?: string[];
}

/**
 * Package.json Schema
 */
export const PackageJsonSchema = z.object({
    name: z.string(),
    version: z.string(),
    description: z.string().optional(),
    main: z.string().optional(),
    scripts: z.record(z.string()).optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    engines: z.object({
        node: z.string().optional(),
        npm: z.string().optional()
    }).optional(),
    keywords: z.array(z.string()).optional(),
    author: z.string().optional(),
    license: z.string().optional()
});

export type PackageJson = z.infer<typeof PackageJsonSchema>;

/**
 * Requirements.txt Entry Schema (Python)
 */
export const PythonRequirementSchema = z.object({
    package: z.string(),
    version: z.string().optional(),
    extras: z.array(z.string()).optional()
});

/**
 * Docker Service Schema
 */
export const DockerServiceSchema = z.object({
    build: z.union([
        z.string(),
        z.object({
            context: z.string(),
            dockerfile: z.string().optional(),
            args: z.record(z.string()).optional(),
            target: z.string().optional()
        })
    ]).optional(),
    image: z.string().optional(),
    container_name: z.string().optional(),
    ports: z.array(z.union([z.string(), z.number()])).optional(),
    environment: z.union([
        z.record(z.string()),
        z.array(z.string())
    ]).optional(),
    env_file: z.union([z.string(), z.array(z.string())]).optional(),
    depends_on: z.union([
        z.array(z.string()),
        z.record(z.object({
            condition: z.string().optional()
        }))
    ]).optional(),
    volumes: z.array(z.string()).optional(),
    networks: z.union([z.array(z.string()), z.record(z.any())]).optional(),
    command: z.union([z.string(), z.array(z.string())]).optional(),
    restart: z.enum(['no', 'always', 'on-failure', 'unless-stopped']).optional(),
    healthcheck: z.object({
        test: z.union([z.string(), z.array(z.string())]),
        interval: z.string().optional(),
        timeout: z.string().optional(),
        retries: z.number().optional(),
        start_period: z.string().optional()
    }).optional(),
    expose: z.array(z.union([z.string(), z.number()])).optional(),
    labels: z.record(z.string()).optional()
});

export type DockerService = z.infer<typeof DockerServiceSchema>;

/**
 * Docker Compose Schema (v3.x)
 */
export const DockerComposeSchema = z.object({
    version: z.string(),
    services: z.record(DockerServiceSchema),
    networks: z.record(z.any()).optional(),
    volumes: z.record(z.any()).optional(),
    configs: z.record(z.any()).optional(),
    secrets: z.record(z.any()).optional()
});

export type DockerCompose = z.infer<typeof DockerComposeSchema>;

/**
 * Environment Variable Schema
 */
export const EnvVarSchema = z.object({
    key: z.string().regex(/^[A-Z_][A-Z0-9_]*$/, 'Invalid environment variable name'),
    value: z.string(),
    required: z.boolean().default(false),
    sensitive: z.boolean().default(false),
    description: z.string().optional()
});

export type EnvVar = z.infer<typeof EnvVarSchema>;

/**
 * Environment Configuration Schema
 */
export const EnvConfigSchema = z.array(EnvVarSchema);

export type EnvConfig = z.infer<typeof EnvConfigSchema>;

/**
 * Nginx Server Block Schema
 */
export const NginxServerSchema = z.object({
    server_name: z.string().optional(),
    listen: z.array(z.union([z.number(), z.string()])),
    root: z.string().optional(),
    index: z.array(z.string()).optional(),
    location_blocks: z.array(z.object({
        path: z.string(),
        directives: z.record(z.any())
    })).optional()
});

/**
 * Dockerfile Instruction Schema
 */
export const DockerfileInstructionSchema = z.object({
    instruction: z.enum([
        'FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV',
        'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
        'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'
    ]),
    arguments: z.string(),
    lineNumber: z.number()
});

export type DockerfileInstruction = z.infer<typeof DockerfileInstructionSchema>;

/**
 * Project Configuration Schema
 */
export const ProjectConfigSchema = z.object({
    name: z.string(),
    type: z.enum(['nodejs', 'python', 'frontend', 'fullstack', 'monorepo', 'other']),
    version: z.string().optional(),
    frameworks: z.array(z.string()).optional(),
    packageManager: z.string().optional(),
    buildCommand: z.string().optional(),
    startCommand: z.string().optional(),
    port: z.number().optional(),
    hasDatabase: z.boolean().default(false),
    databaseType: z.string().optional()
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

/**
 * Schema Validator Class
 */
export class SchemaValidator {
    
    /**
     * Validate package.json content
     */
    static validatePackageJson(content: string): ValidationResult<PackageJson> {
        try {
            const parsed = JSON.parse(content);
            const validated = PackageJsonSchema.parse(parsed);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate docker-compose.yml content
     */
    static validateDockerCompose(content: string): ValidationResult<DockerCompose> {
        try {
            const parsed = yaml.load(content);
            const validated = DockerComposeSchema.parse(parsed);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate environment variables
     */
    static validateEnvVars(vars: any[]): ValidationResult<EnvConfig> {
        try {
            const validated = EnvConfigSchema.parse(vars);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate Docker service configuration
     */
    static validateDockerService(service: any): ValidationResult<DockerService> {
        try {
            const validated = DockerServiceSchema.parse(service);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate project configuration
     */
    static validateProjectConfig(config: any): ValidationResult<ProjectConfig> {
        try {
            const validated = ProjectConfigSchema.parse(config);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate JSON string against any schema
     */
    static validateJson<T>(content: string, schema: z.ZodSchema<T>): ValidationResult<T> {
        try {
            const parsed = JSON.parse(content);
            const validated = schema.parse(parsed);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Validate YAML string against any schema
     */
    static validateYaml<T>(content: string, schema: z.ZodSchema<T>): ValidationResult<T> {
        try {
            const parsed = yaml.load(content);
            const validated = schema.parse(parsed);
            return { valid: true, data: validated };
        } catch (error) {
            return { 
                valid: false, 
                errors: this.formatZodErrors(error) 
            };
        }
    }

    /**
     * Parse Dockerfile into structured instructions
     */
    static parseDockerfile(content: string): DockerfileInstruction[] {
        const instructions: DockerfileInstruction[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Skip comments and empty lines
            if (!trimmed || trimmed.startsWith('#')) {
                return;
            }

            // Match Dockerfile instruction
            const match = trimmed.match(/^([A-Z]+)\s+(.+)$/);
            if (match) {
                const [, instruction, args] = match;
                try {
                    const validated = DockerfileInstructionSchema.parse({
                        instruction,
                        arguments: args,
                        lineNumber: index + 1
                    });
                    instructions.push(validated);
                } catch {
                    // Invalid instruction, skip
                }
            }
        });

        return instructions;
    }

    /**
     * Validate Dockerfile has required instructions
     */
    static validateDockerfileStructure(content: string): ValidationResult<{ instructions: DockerfileInstruction[] }> {
        try {
            const instructions = this.parseDockerfile(content);
            
            // Check for required instructions
            const hasFrom = instructions.some(i => i.instruction === 'FROM');
            const hasCmdOrEntrypoint = instructions.some(i => 
                i.instruction === 'CMD' || i.instruction === 'ENTRYPOINT'
            );

            const errors: string[] = [];
            if (!hasFrom) {
                errors.push('Dockerfile must contain at least one FROM instruction');
            }
            if (!hasCmdOrEntrypoint) {
                errors.push('Dockerfile should contain CMD or ENTRYPOINT instruction');
            }

            if (errors.length > 0) {
                return { valid: false, errors };
            }

            return { valid: true, data: { instructions } };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error instanceof Error ? error.message : String(error)] 
            };
        }
    }

    /**
     * Validate port numbers
     */
    static validatePort(port: number | string): ValidationResult<number> {
        try {
            const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
            
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                return { 
                    valid: false, 
                    errors: [`Invalid port: ${port}. Must be between 1 and 65535`] 
                };
            }

            return { valid: true, data: portNum };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error instanceof Error ? error.message : String(error)] 
            };
        }
    }

    /**
     * Validate Docker image tag format
     */
    static validateImageTag(tag: string): ValidationResult<{ registry?: string; repository: string; tag: string }> {
        try {
            // Format: [registry/]repository[:tag]
            const match = tag.match(/^(?:([^\/]+)\/)?([^:]+)(?::(.+))?$/);
            
            if (!match) {
                return { 
                    valid: false, 
                    errors: [`Invalid image tag format: ${tag}`] 
                };
            }

            const [, registry, repository, imageTag] = match;
            
            return { 
                valid: true, 
                data: { 
                    registry: registry || undefined, 
                    repository, 
                    tag: imageTag || 'latest' 
                } 
            };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error instanceof Error ? error.message : String(error)] 
            };
        }
    }

    /**
     * Format Zod validation errors into readable messages
     */
    private static formatZodErrors(error: any): string[] {
        if (error.name === 'ZodError') {
            return error.errors.map((e: any) => {
                const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
                return `${path}${e.message}`;
            });
        }
        
        return [error instanceof Error ? error.message : String(error)];
    }

    /**
     * Safe JSON parse with validation
     */
    static safeJsonParse<T>(content: string, schema?: z.ZodSchema<T>): ValidationResult<T> {
        try {
            const parsed = JSON.parse(content);
            
            if (schema) {
                const validated = schema.parse(parsed);
                return { valid: true, data: validated };
            }
            
            return { valid: true, data: parsed };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error instanceof Error ? error.message : String(error)] 
            };
        }
    }

    /**
     * Safe YAML parse with validation
     */
    static safeYamlParse<T>(content: string, schema?: z.ZodSchema<T>): ValidationResult<T> {
        try {
            const parsed = yaml.load(content);
            
            if (schema) {
                const validated = schema.parse(parsed);
                return { valid: true, data: validated };
            }
            
            return { valid: true, data: parsed as T };
        } catch (error) {
            return { 
                valid: false, 
                errors: [error instanceof Error ? error.message : String(error)] 
            };
        }
    }

    /**
     * Batch validate multiple files
     */
    static async validateBatch(validations: Array<{
        name: string;
        content: string;
        type: 'json' | 'yaml';
        schema?: z.ZodSchema;
    }>): Promise<Map<string, ValidationResult>> {
        const results = new Map<string, ValidationResult>();

        for (const validation of validations) {
            const result = validation.type === 'json'
                ? this.safeJsonParse(validation.content, validation.schema)
                : this.safeYamlParse(validation.content, validation.schema);
            
            results.set(validation.name, result);
        }

        return results;
    }
}
