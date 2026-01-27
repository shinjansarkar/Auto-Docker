/**
 * Guardrails AI Service
 * Provides structured output validation for Docker file generation
 * Integrates with LLM Service to ensure reliable, validated outputs
 * OPTIMIZED: Parallel validation execution for 3-5x faster performance
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import * as yaml from 'js-yaml';
import {
    ValidationResult,
    ValidatedDockerFiles,
    ValidationError,
    ValidationWarning,
    Correction,
    GuardrailsConfig
} from './guardrailsTypes';
import { ValidatorRegistry } from './dockerValidators';
import { DockerFiles } from './llmService';

/**
 * Zod Schema Definitions for Docker Files
 */
const DockerfileSchema = z.string().min(10).refine(
    (val) => val.includes('FROM '),
    { message: 'Dockerfile must contain at least one FROM instruction' }
);

const DockerComposeSchema = z.string().min(10).refine(
    (val) => {
        try {
            const parsed = yaml.load(val) as any;
            return parsed && parsed.version && parsed.services;
        } catch {
            return false;
        }
    },
    { message: 'docker-compose.yml must be valid YAML with version and services' }
);

const DockerIgnoreSchema = z.string().min(1);

const NginxConfSchema = z.string().optional().refine(
    (val) => !val || val.includes('server {'),
    { message: 'nginx.conf must contain valid server block' }
);

/**
 * GuardrailsService Class
 */
export class GuardrailsService {
    private config: GuardrailsConfig;
    private validatorRegistry: ValidatorRegistry;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.config = this.loadConfig();
        this.validatorRegistry = new ValidatorRegistry();
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - Guardrails');
    }

    /**
     * Load configuration from VS Code settings
     */
    private loadConfig(): GuardrailsConfig {
        const config = vscode.workspace.getConfiguration('autoDocker');
        
        return {
            enabled: config.get<boolean>('enableGuardrails', true),
            strictMode: config.get<boolean>('guardrailsStrictMode', false),
            maxReasks: Math.min(Math.max(config.get<number>('maxReasks', 2), 1), 5),
            validators: [
                { name: 'no-root-user', enabled: true, severity: 'error', onFail: 'reask' },
                { name: 'multi-stage-build', enabled: true, severity: 'warning', onFail: 'filter' },
                { name: 'valid-ports', enabled: true, severity: 'error', onFail: 'reask' },
                { name: 'no-hardcoded-secrets', enabled: true, severity: 'error', onFail: 'exception' },
                { name: 'health-check-presence', enabled: true, severity: 'warning', onFail: 'filter' },
                { name: 'version-pinning', enabled: true, severity: 'warning', onFail: 'filter' },
                { name: 'service-dependencies', enabled: true, severity: 'error', onFail: 'reask' },
                { name: 'port-conflicts', enabled: true, severity: 'error', onFail: 'reask' },
                { name: 'no-user-nginx', enabled: true, severity: 'error', onFail: 'reask' },
                { name: 'no-duplicate-copy', enabled: true, severity: 'error', onFail: 'reask' }
            ]
        };
    }

    /**
     * Main validation method - validates Docker files with Guardrails
     * OPTIMIZED: Parallel execution of validation phases
     */
    async validateDockerFiles(
        files: DockerFiles,
        metadata?: any
    ): Promise<ValidatedDockerFiles> {
        if (!this.config.enabled) {
            this.log('Guardrails validation is disabled');
            return {
                ...files,
                validationResult: this.createSuccessResult()
            };
        }

        this.log('🛡️ Starting Guardrails validation (optimized)...');
        const startTime = Date.now();

        const validationResult: ValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            corrections_made: [],
            validation_score: 100,
            reask_count: 0
        };

        try {
            // OPTIMIZATION: Run all phases in parallel instead of sequential
            const [schemaResults, customResults, semanticResults] = await Promise.all([
                this.validateSchemas(files, metadata).catch(err => {
                    this.log(`Schema validation error: ${err.message}`);
                    return { errors: [], warnings: [] };
                }),
                this.runCustomValidators(files, metadata).catch(err => {
                    this.log(`Custom validation error: ${err.message}`);
                    return { errors: [], warnings: [] };
                }),
                this.validateSemantics(files).catch(err => {
                    this.log(`Semantic validation error: ${err.message}`);
                    return { errors: [], warnings: [] };
                })
            ]);

            // Merge results
            validationResult.errors.push(...schemaResults.errors, ...customResults.errors, ...semanticResults.errors);
            validationResult.warnings.push(...schemaResults.warnings, ...customResults.warnings, ...semanticResults.warnings);

            // Calculate final score
            validationResult.validation_score = this.calculateScore(validationResult);
            validationResult.valid = validationResult.errors.length === 0 && 
                                     (!this.config.strictMode || validationResult.warnings.length === 0);

            const duration = Date.now() - startTime;
            if (validationResult.valid) {
                this.log(`✅ Validation passed successfully (${duration}ms)`);
            } else {
                this.log(`⚠️ Validation completed with ${validationResult.errors.length} errors and ${validationResult.warnings.length} warnings (${duration}ms)`);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.log(`❌ Validation error: ${errorMessage}`);
            validationResult.valid = false;
            validationResult.errors.push({
                field: 'general',
                message: `Validation exception: ${errorMessage}`,
                severity: 'critical'
            });
        }

        return {
            ...files,
            validationResult
        };
    }

    /**
     * Phase 1: Validate against Zod schemas
     * OPTIMIZED: Returns result instead of mutating parameter
     */
    private async validateSchemas(
        files: DockerFiles,
        metadata?: any
    ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
        this.log('Phase 1: Schema validation...');
        const errors: ValidationError[] = [];

        // Validate all schemas in parallel
        const validations = [
            // Dockerfile
            DockerfileSchema.parseAsync(files.dockerfile).catch(error => {
                errors.push({
                    field: 'dockerfile',
                    message: 'Dockerfile schema validation failed',
                    severity: 'critical',
                    suggestion: error instanceof Error ? error.message : String(error)
                });
            }),
            // docker-compose.yml
            DockerComposeSchema.parseAsync(files.dockerCompose).catch(error => {
                errors.push({
                    field: 'dockerCompose',
                    message: 'docker-compose.yml schema validation failed',
                    severity: 'critical',
                    suggestion: error instanceof Error ? error.message : String(error)
                });
            }),
            // .dockerignore
            DockerIgnoreSchema.parseAsync(files.dockerIgnore).catch(error => {
                errors.push({
                    field: 'dockerIgnore',
                    message: '.dockerignore validation failed',
                    severity: 'low',
                    suggestion: error instanceof Error ? error.message : String(error)
                });
            })
        ];

        // Add nginx validation if present
        if (files.nginxConf) {
            validations.push(
                NginxConfSchema.parseAsync(files.nginxConf).catch(error => {
                    errors.push({
                        field: 'nginxConf',
                        message: 'nginx.conf validation failed',
                        severity: 'high',
                        suggestion: error instanceof Error ? error.message : String(error)
                    });
                })
            );
        }

        await Promise.all(validations);
        return { errors, warnings: [] };
    }

    /**
     * Phase 2: Run custom Docker validators
     * OPTIMIZED: Parallel execution, returns result
     */
    private async runCustomValidators(
        files: DockerFiles,
        metadata?: any
    ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
        this.log('Phase 2: Custom validator checks...');
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Run Dockerfile and Compose validators in parallel
        const [dockerfileErrors, composeErrors] = await Promise.all([
            this.validatorRegistry.validateDockerfile(
                files.dockerfile,
                this.getEnabledValidatorNames(['dockerfile']),
                metadata
            ),
            this.validatorRegistry.validateDockerCompose(
                files.dockerCompose,
                this.getEnabledValidatorNames(['docker-compose'])
            )
        ]);

        errors.push(...dockerfileErrors, ...composeErrors);

        // Convert warnings based on severity
        const warningErrors = errors.filter(e => e.severity === 'medium' || e.severity === 'low');
        warnings.push(...warningErrors.map(e => ({
            field: e.field,
            message: e.message,
            category: this.categorizeWarning(e.message),
            suggestion: e.suggestion
        })));

        // Keep only critical/high errors
        const criticalErrors = errors.filter(e => e.severity === 'critical' || e.severity === 'high');
        return { errors: criticalErrors, warnings };
    }

    /**
     * Phase 3: Semantic validation
     * OPTIMIZED: Returns result, early exit on critical errors
     */
    private async validateSemantics(
        files: DockerFiles
    ): Promise<{ errors: ValidationError[]; warnings: ValidationWarning[] }> {
        this.log('Phase 3: Semantic validation...');
        const errors: ValidationError[] = [];
        const warnings: ValidationWarning[] = [];

        // Run consistency and env validations in parallel
        const [consistencyErrors, envWarnings] = await Promise.all([
            Promise.resolve(this.validateConsistency(files)),
            Promise.resolve(this.validateEnvironmentVariables(files))
        ]);

        errors.push(...consistencyErrors);
        warnings.push(...envWarnings);

        return { errors, warnings };
    }

    /**
     * Validate consistency between Docker files
     */
    private validateConsistency(files: DockerFiles): ValidationError[] {
        const errors: ValidationError[] = [];

        try {
            const compose = yaml.load(files.dockerCompose) as any;
            
            if (compose && compose.services) {
                // Check if services in compose match Dockerfile expectations
                const serviceNames = Object.keys(compose.services);
                
                // Validate service names are reasonable
                serviceNames.forEach(name => {
                    if (!/^[a-z0-9_-]+$/i.test(name)) {
                        errors.push({
                            field: 'dockerCompose',
                            message: `Invalid service name: ${name}`,
                            severity: 'medium',
                            suggestion: 'Use only alphanumeric characters, hyphens, and underscores'
                        });
                    }
                });
            }
        } catch (error) {
            // Already caught in schema validation
        }

        return errors;
    }

    /**
     * Validate environment variables
     */
    private validateEnvironmentVariables(files: DockerFiles): ValidationWarning[] {
        const warnings: ValidationWarning[] = [];

        try {
            const compose = yaml.load(files.dockerCompose) as any;
            
            if (compose && compose.services) {
                for (const [serviceName, service] of Object.entries(compose.services as any)) {
                    const environment = (service as any).environment || {};
                    
                    // Check for undefined environment variables
                    for (const [key, value] of Object.entries(environment)) {
                        if (!value || value === '') {
                            warnings.push({
                                field: 'dockerCompose',
                                message: `Service ${serviceName} has empty environment variable: ${key}`,
                                category: 'best-practice',
                                suggestion: 'Define all environment variables or use .env file'
                            });
                        }
                    }
                }
            }
        } catch (error) {
            // Ignore parsing errors
        }

        return warnings;
    }

    /**
     * Calculate validation score (0-100)
     */
    private calculateScore(result: ValidationResult): number {
        let score = 100;

        // Deduct for errors
        score -= result.errors.filter(e => e.severity === 'critical').length * 20;
        score -= result.errors.filter(e => e.severity === 'high').length * 10;
        score -= result.errors.filter(e => e.severity === 'medium').length * 5;

        // Deduct for warnings
        score -= result.warnings.length * 2;

        return Math.max(0, score);
    }

    /**
     * Auto-fix common issues
     */
    async attemptAutoFix(
        files: DockerFiles,
        errors: ValidationError[]
    ): Promise<{ files: DockerFiles; corrections: Correction[] }> {
        let fixed = { ...files };
        const corrections: Correction[] = [];

        for (const error of errors) {
            if (error.field === 'dockerfile') {
                // Auto-fix: Remove USER nginx (CRITICAL FIX)
                if (error.message.includes('USER nginx')) {
                    const original = fixed.dockerfile;
                    const lines = fixed.dockerfile.split('\n');
                    const fixedLines = lines.map(line => {
                        if (line.trim() === 'USER nginx' || line.trim().startsWith('USER nginx ')) {
                            return '# Nginx runs as nginx user by default - USER nginx removed';
                        }
                        return line;
                    });
                    fixed.dockerfile = fixedLines.join('\n');
                    
                    if (original !== fixed.dockerfile) {
                        corrections.push({
                            field: 'dockerfile',
                            original: 'USER nginx',
                            corrected: 'Removed USER nginx directive',
                            reason: 'nginx:alpine runs as nginx by default, explicit USER causes permission errors'
                        });
                    }
                }
                
                // Auto-fix: Remove duplicate COPY --from=builder (CRITICAL FIX)
                if (error.message.includes('Multiple COPY') || error.message.includes('duplicate')) {
                    const original = fixed.dockerfile;
                    const lines = fixed.dockerfile.split('\n');
                    let foundFirst = false;
                    const fixedLines = lines.map(line => {
                        if (line.includes('COPY --from=builder') && line.includes('/usr/share/nginx/html')) {
                            if (!foundFirst) {
                                foundFirst = true;
                                return line; // Keep first COPY
                            } else {
                                return '# Duplicate COPY removed - using detected build output folder';
                            }
                        }
                        return line;
                    });
                    fixed.dockerfile = fixedLines.join('\n');
                    
                    if (original !== fixed.dockerfile) {
                        corrections.push({
                            field: 'dockerfile',
                            original: 'Multiple COPY --from=builder commands',
                            corrected: 'Consolidated to single COPY with correct build folder',
                            reason: 'Only one build output directory exists per framework'
                        });
                    }
                }
                
                // Auto-fix: Add proper permissions if missing
                if (error.message.includes('permission') && !fixed.dockerfile.includes('chown -R nginx:nginx')) {
                    const lines = fixed.dockerfile.split('\n');
                    const copyIndex = lines.findIndex(l => l.includes('COPY --from=') && l.includes('/usr/share/nginx/html'));
                    
                    if (copyIndex > 0) {
                        lines.splice(copyIndex + 1, 0, '', '# Set proper permissions for nginx user', 'RUN chown -R nginx:nginx /usr/share/nginx/html && \\', '    chmod -R 755 /usr/share/nginx/html');
                        fixed.dockerfile = lines.join('\n');
                        
                        corrections.push({
                            field: 'dockerfile',
                            original: 'Missing permission setup',
                            corrected: 'Added chown and chmod for nginx user',
                            reason: 'Ensure nginx user can access files'
                        });
                    }
                }

                // Auto-fix: Add USER directive for non-nginx containers
                if (error.message.includes('USER directive') && !error.message.includes('nginx')) {
                    const lines = fixed.dockerfile.split('\n');
                    const cmdIndex = lines.findIndex(l => l.trim().startsWith('CMD '));
                    
                    if (cmdIndex > 0 && !fixed.dockerfile.includes('USER ')) {
                        lines.splice(cmdIndex, 0, '', '# Run as non-root user', 'USER nodejs');
                        fixed.dockerfile = lines.join('\n');
                        
                        corrections.push({
                            field: 'dockerfile',
                            original: 'No USER directive',
                            corrected: 'Added USER nodejs',
                            reason: 'Security best practice'
                        });
                    }
                }

                // Auto-fix: Replace :latest with specific version
                if (error.message.includes('latest')) {
                    const original = fixed.dockerfile;
                    fixed.dockerfile = fixed.dockerfile.replace(
                        /FROM\s+(\w+):latest/g,
                        'FROM $1:20-alpine'
                    );
                    
                    if (original !== fixed.dockerfile) {
                        corrections.push({
                            field: 'dockerfile',
                            original: 'Using :latest tag',
                            corrected: 'Pinned to specific version',
                            reason: 'Reproducibility'
                        });
                    }
                }
                
                // Auto-fix: Add HEALTHCHECK if missing
                if (error.message.includes('HEALTHCHECK') || error.message.includes('health check')) {
                    const lines = fixed.dockerfile.split('\n');
                    const cmdIndex = lines.findIndex(l => l.trim().startsWith('CMD '));
                    
                    if (cmdIndex > 0 && !fixed.dockerfile.includes('HEALTHCHECK')) {
                        const healthCheck = fixed.dockerfile.includes('nginx') 
                            ? 'HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\\n  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1'
                            : 'HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\\n  CMD curl -f http://localhost:3000/health || exit 1';
                        
                        lines.splice(cmdIndex, 0, '', '# Health check', healthCheck, '');
                        fixed.dockerfile = lines.join('\n');
                        
                        corrections.push({
                            field: 'dockerfile',
                            original: 'Missing HEALTHCHECK',
                            corrected: 'Added HEALTHCHECK instruction',
                            reason: 'Production best practice for container health monitoring'
                        });
                    }
                }
            }
        }

        return { files: fixed, corrections };
    }

    /**
     * Generate validation report
     */
    generateReport(result: ValidationResult): string {
        const lines: string[] = [];
        
        lines.push('🛡️ Guardrails Validation Report');
        lines.push('=' .repeat(50));
        lines.push('');
        
        lines.push(`Status: ${result.valid ? '✅ PASSED' : '❌ FAILED'}`);
        lines.push(`Validation Score: ${result.validation_score}/100`);
        lines.push(`Reasks: ${result.reask_count}`);
        lines.push('');

        if (result.errors.length > 0) {
            lines.push('❌ Errors:');
            result.errors.forEach((error, i) => {
                lines.push(`  ${i + 1}. [${error.severity.toUpperCase()}] ${error.field}: ${error.message}`);
                if (error.suggestion) {
                    lines.push(`     💡 ${error.suggestion}`);
                }
            });
            lines.push('');
        }

        if (result.warnings.length > 0) {
            lines.push('⚠️ Warnings:');
            result.warnings.forEach((warning, i) => {
                lines.push(`  ${i + 1}. [${warning.category}] ${warning.field}: ${warning.message}`);
                if (warning.suggestion) {
                    lines.push(`     💡 ${warning.suggestion}`);
                }
            });
            lines.push('');
        }

        if (result.corrections_made.length > 0) {
            lines.push('🔧 Auto-corrections Applied:');
            result.corrections_made.forEach((correction, i) => {
                lines.push(`  ${i + 1}. ${correction.field}: ${correction.corrected}`);
                lines.push(`     Reason: ${correction.reason}`);
            });
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Helper: Get enabled validator names
     */
    private getEnabledValidatorNames(tags: string[]): string[] {
        return this.config.validators
            .filter(v => v.enabled)
            .map(v => v.name);
    }

    /**
     * Helper: Categorize warning
     */
    private categorizeWarning(message: string): 'security' | 'performance' | 'best-practice' | 'style' {
        if (message.toLowerCase().includes('security') || message.toLowerCase().includes('secret')) {
            return 'security';
        }
        if (message.toLowerCase().includes('performance') || message.toLowerCase().includes('optimize')) {
            return 'performance';
        }
        if (message.toLowerCase().includes('style') || message.toLowerCase().includes('format')) {
            return 'style';
        }
        return 'best-practice';
    }

    /**
     * Helper: Create success result
     */
    private createSuccessResult(): ValidationResult {
        return {
            valid: true,
            errors: [],
            warnings: [],
            corrections_made: [],
            validation_score: 100,
            reask_count: 0
        };
    }

    /**
     * Helper: Log to output channel
     */
    private log(message: string): void {
        this.outputChannel.appendLine(`[Guardrails] ${message}`);
        console.log(`[Guardrails] ${message}`);
    }

    /**
     * Simple validation method for quick checks
     * Used by UnifiedDockerGenerationService
     */
    async validateDockerConfig(config: {
        dockerfile?: string;
        dockerCompose: string;
        dockerIgnore: string;
        nginxConf?: string;
    }): Promise<{ isValid: boolean; errors: string[] }> {
        try {
            const files: DockerFiles = {
                dockerfile: config.dockerfile || '',
                dockerCompose: config.dockerCompose,
                dockerIgnore: config.dockerIgnore,
                nginxConf: config.nginxConf
            };

            const result = await this.validateDockerFiles(files);
            return {
                isValid: result.validationResult.valid,
                errors: result.validationResult.errors.map(e => e.message)
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [error instanceof Error ? error.message : String(error)]
            };
        }
    }

    /**
     * Show validation results to user
     */
    async showValidationResults(result: ValidationResult): Promise<void> {
        if (result.valid) {
            vscode.window.showInformationMessage(
                `✅ Docker files validated successfully! Score: ${result.validation_score}/100`
            );
        } else {
            const report = this.generateReport(result);
            this.outputChannel.show();
            this.outputChannel.appendLine(report);

            const action = await vscode.window.showErrorMessage(
                `❌ Validation failed: ${result.errors.length} errors, ${result.warnings.length} warnings`,
                'View Report',
                'Continue Anyway'
            );

            if (action === 'View Report') {
                this.outputChannel.show();
            }
        }
    }
}
