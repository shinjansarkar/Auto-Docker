/**
 * Types and Interfaces for Guardrails AI Integration
 * Defines validation structures for Docker file generation
 */

export interface ValidationResult {
    valid: boolean;
    validated_output?: any;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    corrections_made: Correction[];
    validation_score: number;
    reask_count: number;
}

export interface ValidationError {
    field: string;
    message: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    line?: number;
    suggestion?: string;
}

export interface ValidationWarning {
    field: string;
    message: string;
    category: 'security' | 'performance' | 'best-practice' | 'style';
    suggestion?: string;
}

export interface Correction {
    field: string;
    original: string;
    corrected: string;
    reason: string;
}

export interface ValidatedDockerFiles {
    dockerfile: string;
    dockerCompose: string;
    dockerIgnore: string;
    nginxConf?: string;
    envExample?: string;
    validationResult: ValidationResult;
}

export interface DockerValidationSchema {
    dockerfile: {
        required: boolean;
        validators: string[];
    };
    dockerCompose: {
        required: boolean;
        validators: string[];
    };
    dockerIgnore: {
        required: boolean;
        validators: string[];
    };
    nginxConf?: {
        required: boolean;
        validators: string[];
    };
}

export interface ValidatorConfig {
    name: string;
    enabled: boolean;
    severity: 'error' | 'warning';
    onFail: 'reask' | 'fix' | 'exception' | 'filter';
}

export interface GuardrailsConfig {
    enabled: boolean;
    strictMode: boolean;
    maxReasks: number;
    validators: ValidatorConfig[];
}
