/**
 * Guardrails AI Service
 * Provides structured output validation for Docker file generation
 * Integrates with LLM Service to ensure reliable, validated outputs
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
                { name: 'port-conflicts', enabled: true, severity: 'error', onFail: 'reask' }
            ]
        };
    }

    /**
     * Main validation method - validates Docker files with Guardrails
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

        this.log('🛡️ Starting Guardrails validation...');

        const validationResult: ValidationResult = {
            valid: true,
            errors: [],
            warnings: [],
            corrections_made: [],
            validation_score: 100,
            reask_count: 0
        };

        try {
            // Phase 1: Schema Validation
            await this.validateSchemas(files, validationResult);

            // Phase 2: Custom Docker Validators
            await this.runCustomValidators(files, validationResult, metadata);

            // Phase 3: Semantic Validation
            await this.validateSemantics(files, validationResult);

            // Calculate final score
            validationResult.validation_score = this.calculateScore(validationResult);
            validationResult.valid = validationResult.errors.length === 0 && 
                                     (!this.config.strictMode || validationResult.warnings.length === 0);

            if (validationResult.valid) {
                this.log('✅ Validation passed successfully');
            } else {
                this.log(`⚠️ Validation completed with ${validationResult.errors.length} errors and ${validationResult.warnings.length} warnings`);
            }

        } catch (error) {
            this.log(`❌ Validation error: ${error.message}`);
            validationResult.valid = false;
            validationResult.errors.push({
                field: 'general',
                message: `Validation exception: ${error.message}`,
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
     */
    private async validateSchemas(
        files: DockerFiles,
        result: ValidationResult
    ): Promise<void> {
        this.log('Phase 1: Schema validation...');

        // Validate Dockerfile
        try {
            DockerfileSchema.parse(files.dockerfile);
        } catch (error) {
            result.errors.push({
                field: 'dockerfile',
                message: 'Dockerfile schema validation failed',
                severity: 'critical',
                suggestion: error.message
            });
        }

        // Validate docker-compose.yml
        try {
            DockerComposeSchema.parse(files.dockerCompose);
        } catch (error) {
            result.errors.push({
                field: 'dockerCompose',
                message: 'docker-compose.yml schema validation failed',
                severity: 'critical',
                suggestion: error.message
            });
        }

        // Validate .dockerignore
        try {
            DockerIgnoreSchema.parse(files.dockerIgnore);
        } catch (error) {
            result.errors.push({
                field: 'dockerIgnore',
                message: '.dockerignore validation failed',
                severity: 'low',
                suggestion: error.message
            });
        }

        // Validate nginx.conf (if present)
        if (files.nginxConf) {
            try {
                NginxConfSchema.parse(files.nginxConf);
            } catch (error) {
                result.errors.push({
                    field: 'nginxConf',
                    message: 'nginx.conf validation failed',
                    severity: 'high',
                    suggestion: error.message
                });
            }
        }
    }

    /**
     * Phase 2: Run custom Docker validators
     */
    private async runCustomValidators(
        files: DockerFiles,
        result: ValidationResult,
        metadata?: any
    ): Promise<void> {
        this.log('Phase 2: Custom validator checks...');

        // Validate Dockerfile
        const dockerfileErrors = await this.validatorRegistry.validateDockerfile(
            files.dockerfile,
            this.getEnabledValidatorNames(['dockerfile']),
            metadata
        );
        result.errors.push(...dockerfileErrors);

        // Validate docker-compose.yml
        const composeErrors = await this.validatorRegistry.validateDockerCompose(
            files.dockerCompose,
            this.getEnabledValidatorNames(['docker-compose'])
        );
        result.errors.push(...composeErrors);

        // Convert warnings based on severity
        const warnings = result.errors.filter(e => e.severity === 'medium' || e.severity === 'low');
        result.warnings = warnings.map(e => ({
            field: e.field,
            message: e.message,
            category: this.categorizeWarning(e.message),
            suggestion: e.suggestion
        }));

        // Keep only critical/high errors
        result.errors = result.errors.filter(e => e.severity === 'critical' || e.severity === 'high');
    }

    /**
     * Phase 3: Semantic validation
     */
    private async validateSemantics(
        files: DockerFiles,
        result: ValidationResult
    ): Promise<void> {
        this.log('Phase 3: Semantic validation...');

        // Validate consistency between files
        const consistencyErrors = this.validateConsistency(files);
        result.errors.push(...consistencyErrors);

        // Validate environment variables
        const envErrors = this.validateEnvironmentVariables(files);
        result.warnings.push(...envErrors);
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
                    const environment = service.environment || {};
                    
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
                // Auto-fix: Add USER directive
                if (error.message.includes('USER directive')) {
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
