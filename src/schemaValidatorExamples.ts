/**
 * Schema Validation Integration Guide
 * Demonstrates how to use the SchemaValidator throughout the extension
 */

import { SchemaValidator, ValidationResult } from './schemaValidator';

/**
 * Example 1: Validate package.json
 */
export async function validatePackageJsonExample(content: string) {
    const result = SchemaValidator.validatePackageJson(content);
    
    if (result.valid) {
        console.log('✅ package.json is valid');
        console.log('Name:', result.data?.name);
        console.log('Version:', result.data?.version);
        console.log('Dependencies:', result.data?.dependencies);
    } else {
        console.error('❌ package.json validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 2: Validate docker-compose.yml
 */
export async function validateDockerComposeExample(yamlContent: string) {
    const result = SchemaValidator.validateDockerCompose(yamlContent);
    
    if (result.valid) {
        console.log('✅ docker-compose.yml is valid');
        console.log('Version:', result.data?.version);
        console.log('Services:', Object.keys(result.data?.services || {}));
    } else {
        console.error('❌ docker-compose.yml validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 3: Validate Dockerfile structure
 */
export function validateDockerfileExample(dockerfileContent: string) {
    const result = SchemaValidator.validateDockerfileStructure(dockerfileContent);
    
    if (result.valid) {
        console.log('✅ Dockerfile is valid');
        console.log('Instructions found:', result.data?.instructions.length);
        result.data?.instructions.forEach(inst => {
            console.log(`  Line ${inst.lineNumber}: ${inst.instruction} ${inst.arguments}`);
        });
    } else {
        console.error('❌ Dockerfile validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 4: Validate port number
 */
export function validatePortExample(port: number | string) {
    const result = SchemaValidator.validatePort(port);
    
    if (result.valid) {
        console.log(`✅ Port ${result.data} is valid`);
    } else {
        console.error('❌ Port validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 5: Validate Docker image tag
 */
export function validateImageTagExample(tag: string) {
    const result = SchemaValidator.validateImageTag(tag);
    
    if (result.valid) {
        console.log('✅ Image tag is valid');
        console.log('Registry:', result.data?.registry || 'docker.io (default)');
        console.log('Repository:', result.data?.repository);
        console.log('Tag:', result.data?.tag);
    } else {
        console.error('❌ Image tag validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 6: Safe JSON parse
 */
export function safeJsonParseExample(jsonString: string) {
    const result = SchemaValidator.safeJsonParse(jsonString);
    
    if (result.valid) {
        console.log('✅ JSON parsed successfully');
        console.log('Data:', result.data);
    } else {
        console.error('❌ JSON parsing failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 7: Safe YAML parse
 */
export function safeYamlParseExample(yamlString: string) {
    const result = SchemaValidator.safeYamlParse(yamlString);
    
    if (result.valid) {
        console.log('✅ YAML parsed successfully');
        console.log('Data:', result.data);
    } else {
        console.error('❌ YAML parsing failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}

/**
 * Example 8: Batch validation
 */
export async function batchValidationExample() {
    const validations = [
        {
            name: 'package.json',
            content: '{"name": "my-app", "version": "1.0.0"}',
            type: 'json' as const
        },
        {
            name: 'docker-compose.yml',
            content: 'version: "3.8"\nservices:\n  app:\n    image: node:20',
            type: 'yaml' as const
        }
    ];

    const results = await SchemaValidator.validateBatch(validations);
    
    results.forEach((result, name) => {
        if (result.valid) {
            console.log(`✅ ${name} is valid`);
        } else {
            console.error(`❌ ${name} validation failed:`, result.errors);
        }
    });
}

/**
 * Example 9: Integration with file reading
 */
export async function validateFileExample(filePath: string, fileType: 'json' | 'yaml') {
    try {
        const fs = require('fs').promises;
        const content = await fs.readFile(filePath, 'utf-8');
        
        let result: ValidationResult;
        
        if (fileType === 'json') {
            result = SchemaValidator.safeJsonParse(content);
        } else {
            result = SchemaValidator.safeYamlParse(content);
        }
        
        if (result.valid) {
            console.log(`✅ ${filePath} is valid`);
            return result.data;
        } else {
            console.error(`❌ ${filePath} validation failed:`, result.errors);
            return null;
        }
    } catch (error) {
        console.error('File reading error:', error);
        return null;
    }
}

/**
 * Example 10: Environment variables validation
 */
export function validateEnvVarsExample() {
    const envVars = [
        { key: 'NODE_ENV', value: 'production', required: true, sensitive: false },
        { key: 'DATABASE_URL', value: 'postgresql://...', required: true, sensitive: true },
        { key: 'PORT', value: '3000', required: false, sensitive: false }
    ];

    const result = SchemaValidator.validateEnvVars(envVars);
    
    if (result.valid) {
        console.log('✅ Environment variables are valid');
        result.data?.forEach(env => {
            console.log(`  - ${env.key}${env.required ? ' (required)' : ''}${env.sensitive ? ' (sensitive)' : ''}`);
        });
    } else {
        console.error('❌ Environment variables validation failed:');
        result.errors?.forEach(err => console.error(`  - ${err}`));
    }
}
