/**
 * Docker-Specific Validators for Guardrails AI
 * Custom validation rules for Docker configurations
 */

import * as yaml from 'js-yaml';
import { ValidationError, ValidationWarning } from './guardrailsTypes';

/**
 * Base Validator Class
 */
export abstract class DockerValidator {
    abstract name: string;
    abstract description: string;
    abstract severity: 'error' | 'warning';

    abstract validate(content: string, metadata?: any): Promise<ValidationError[]>;

    protected createError(
        field: string,
        message: string,
        line?: number,
        suggestion?: string
    ): ValidationError {
        return {
            field,
            message,
            severity: this.mapSeverity(this.severity),
            line,
            suggestion
        };
    }

    private mapSeverity(severity: 'error' | 'warning'): 'critical' | 'high' | 'medium' | 'low' {
        return severity === 'error' ? 'critical' : 'medium';
    }
}

/**
 * Validator: No Root User
 * Ensures Dockerfiles don't run containers as root
 */
export class NoRootUserValidator extends DockerValidator {
    name = 'no-root-user';
    description = 'Ensures containers do not run as root user';
    severity: 'error' | 'warning' = 'error';

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');

        let hasUserDirective = false;
        let lastFromIndex = -1;

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('FROM ')) {
                lastFromIndex = index;
            }
            
            if (trimmed.startsWith('USER ') && !trimmed.includes('USER root')) {
                hasUserDirective = true;
            }
        });

        if (!hasUserDirective && lastFromIndex >= 0) {
            errors.push(this.createError(
                'dockerfile',
                'Dockerfile should include a USER directive to run as non-root',
                lastFromIndex,
                'Add "USER nodejs" or "USER appuser" before the CMD instruction'
            ));
        }

        return errors;
    }
}

/**
 * Validator: Multi-Stage Build
 * Verifies proper use of multi-stage builds for production
 */
export class MultiStageBuildValidator extends DockerValidator {
    name = 'multi-stage-build';
    description = 'Validates multi-stage build patterns';
    severity: 'error' | 'warning' = 'warning';

    async validate(dockerfile: string, metadata?: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');

        const fromStatements = lines.filter(line => 
            line.trim().startsWith('FROM ')
        );

        // For production builds, recommend multi-stage
        if (metadata?.isProduction && fromStatements.length === 1) {
            errors.push(this.createError(
                'dockerfile',
                'Consider using multi-stage build for production optimization',
                0,
                'Use builder stage for compilation and minimal runtime image'
            ));
        }

        // Check for proper stage naming
        fromStatements.forEach((stmt, index) => {
            if (index > 0 && !stmt.includes(' AS ')) {
                const lineNum = lines.indexOf(stmt);
                errors.push(this.createError(
                    'dockerfile',
                    'Multi-stage builds should use named stages (AS <name>)',
                    lineNum,
                    `FROM image:tag AS stage${index}`
                ));
            }
        });

        return errors;
    }
}

/**
 * Validator: Valid Ports
 * Ensures exposed ports are within valid ranges
 */
export class ValidPortsValidator extends DockerValidator {
    name = 'valid-ports';
    description = 'Validates that exposed ports are within valid ranges';
    severity: 'error' | 'warning' = 'error';

    async validate(content: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('EXPOSE ')) {
                const portMatch = trimmed.match(/EXPOSE\s+(\d+)/);
                if (portMatch) {
                    const port = parseInt(portMatch[1]);
                    
                    if (port < 1 || port > 65535) {
                        errors.push(this.createError(
                            'dockerfile',
                            `Invalid port ${port}. Ports must be between 1-65535`,
                            index,
                            'Use a valid port number'
                        ));
                    }
                    
                    // Warn about privileged ports
                    if (port < 1024) {
                        errors.push(this.createError(
                            'dockerfile',
                            `Port ${port} is a privileged port (<1024). Requires root or capabilities`,
                            index,
                            'Consider using ports >= 1024 for non-root containers'
                        ));
                    }
                }
            }
        });

        return errors;
    }
}

/**
 * Validator: No Hardcoded Secrets
 * Detects hardcoded secrets in Dockerfiles
 */
export class NoHardcodedSecretsValidator extends DockerValidator {
    name = 'no-hardcoded-secrets';
    description = 'Detects hardcoded secrets and credentials';
    severity: 'error' | 'warning' = 'error';

    private secretPatterns = [
        { pattern: /api[_-]?key\s*=\s*["']?[\w-]{20,}["']?/gi, type: 'API Key' },
        { pattern: /secret[_-]?key\s*=\s*["']?[\w-]{20,}["']?/gi, type: 'Secret Key' },
        { pattern: /password\s*=\s*["']?[\w-]{8,}["']?/gi, type: 'Password' },
        { pattern: /token\s*=\s*["']?[\w-]{20,}["']?/gi, type: 'Token' },
        { pattern: /-----BEGIN (RSA )?PRIVATE KEY-----/i, type: 'Private Key' },
        { pattern: /aws_access_key_id\s*=\s*["']?[A-Z0-9]{20}["']?/gi, type: 'AWS Key' },
        { pattern: /aws_secret_access_key\s*=\s*["']?[\w/+=]{40}["']?/gi, type: 'AWS Secret' }
    ];

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');

        lines.forEach((line, index) => {
            this.secretPatterns.forEach(({ pattern, type }) => {
                if (pattern.test(line)) {
                    errors.push(this.createError(
                        'dockerfile',
                        `Potential ${type} detected in Dockerfile`,
                        index,
                        'Use environment variables or Docker secrets instead'
                    ));
                }
            });
        });

        return errors;
    }
}

/**
 * Validator: Health Check Presence
 * Ensures production Dockerfiles include health checks
 */
export class HealthCheckValidator extends DockerValidator {
    name = 'health-check-presence';
    description = 'Validates presence of health check in production images';
    severity: 'error' | 'warning' = 'warning';

    async validate(dockerfile: string, metadata?: any): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        if (metadata?.isProduction) {
            const hasHealthCheck = /HEALTHCHECK/i.test(dockerfile);
            
            if (!hasHealthCheck) {
                errors.push(this.createError(
                    'dockerfile',
                    'Production Dockerfiles should include a HEALTHCHECK instruction',
                    undefined,
                    'Add HEALTHCHECK --interval=30s --timeout=10s CMD <command>'
                ));
            }
        }

        return errors;
    }
}

/**
 * Validator: Version Pinning
 * Ensures base images use specific version tags
 */
export class VersionPinningValidator extends DockerValidator {
    name = 'version-pinning';
    description = 'Validates that base images use specific versions';
    severity: 'error' | 'warning' = 'warning';

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('FROM ')) {
                // Check for 'latest' tag
                if (trimmed.includes(':latest') || (!trimmed.includes(':') && !trimmed.includes(' AS '))) {
                    errors.push(this.createError(
                        'dockerfile',
                        'Avoid using "latest" tag. Pin to specific version for reproducibility',
                        index,
                        'Use FROM image:specific-version instead of FROM image:latest'
                    ));
                }
            }
        });

        return errors;
    }
}

/**
 * Validator: Docker Compose Service Dependencies
 * Validates service dependency chains don't have cycles
 */
export class ServiceDependencyValidator extends DockerValidator {
    name = 'service-dependencies';
    description = 'Validates service dependency chains';
    severity: 'error' | 'warning' = 'error';

    async validate(composeContent: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        try {
            const compose = yaml.load(composeContent) as any;
            
            if (!compose.services) {
                return errors;
            }

            // Build dependency graph
            const dependencies: Map<string, string[]> = new Map();
            
            for (const [serviceName, serviceConfig] of Object.entries(compose.services)) {
                const config = serviceConfig as any;
                const deps = config.depends_on || [];
                dependencies.set(serviceName, Array.isArray(deps) ? deps : Object.keys(deps));
            }

            // Check for circular dependencies
            const visited = new Set<string>();
            const recursionStack = new Set<string>();

            const hasCycle = (service: string): boolean => {
                visited.add(service);
                recursionStack.add(service);

                const deps = dependencies.get(service) || [];
                for (const dep of deps) {
                    if (!visited.has(dep)) {
                        if (hasCycle(dep)) {
                            return true;
                        }
                    } else if (recursionStack.has(dep)) {
                        errors.push(this.createError(
                            'docker-compose.yml',
                            `Circular dependency detected: ${service} -> ${dep}`,
                            undefined,
                            'Remove circular dependencies in service definitions'
                        ));
                        return true;
                    }
                }

                recursionStack.delete(service);
                return false;
            };

            for (const service of dependencies.keys()) {
                if (!visited.has(service)) {
                    hasCycle(service);
                }
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push(this.createError(
                'docker-compose.yml',
                `Failed to parse YAML: ${errorMessage}`,
                undefined,
                'Ensure docker-compose.yml is valid YAML'
            ));
        }

        return errors;
    }
}

/**
 * Validator: Port Conflicts
 * Detects port conflicts in docker-compose.yml
 */
export class PortConflictValidator extends DockerValidator {
    name = 'port-conflicts';
    description = 'Detects port conflicts between services';
    severity: 'error' | 'warning' = 'error';

    async validate(composeContent: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];

        try {
            const compose = yaml.load(composeContent) as any;
            
            if (!compose.services) {
                return errors;
            }

            const usedPorts = new Map<number, string[]>();

            for (const [serviceName, serviceConfig] of Object.entries(compose.services)) {
                const config = serviceConfig as any;
                const ports = config.ports || [];

                for (const portMapping of ports) {
                    const portStr = String(portMapping);
                    const match = portStr.match(/^(\d+):/);
                    
                    if (match) {
                        const hostPort = parseInt(match[1]);
                        
                        if (!usedPorts.has(hostPort)) {
                            usedPorts.set(hostPort, []);
                        }
                        usedPorts.get(hostPort)!.push(serviceName);
                    }
                }
            }

            // Check for conflicts
            for (const [port, services] of usedPorts.entries()) {
                if (services.length > 1) {
                    errors.push(this.createError(
                        'docker-compose.yml',
                        `Port ${port} is used by multiple services: ${services.join(', ')}`,
                        undefined,
                        'Assign unique host ports to each service'
                    ));
                }
            }

        } catch (error) {
            // YAML parsing error already handled by ServiceDependencyValidator
        }

        return errors;
    }
}

/**
 * Validator: No USER nginx
 * Prevents explicit USER nginx directive which causes permission issues
 */
export class NoUserNginxValidator extends DockerValidator {
    name = 'no-user-nginx';
    description = 'Prevents USER nginx directive that causes permission errors';
    severity: 'error' | 'warning' = 'error';

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Check for "USER nginx" specifically
            if (trimmed === 'USER nginx' || trimmed.startsWith('USER nginx ')) {
                errors.push(this.createError(
                    'dockerfile',
                    'Do not use "USER nginx" - nginx:alpine runs as nginx by default',
                    index,
                    'Remove USER nginx line. Set permissions with: RUN chown -R nginx:nginx /usr/share/nginx/html'
                ));
            }
        });

        return errors;
    }
}

/**
 * Validator: No Duplicate COPY Commands
 * Detects duplicate COPY --from=builder statements
 */
export class NoDuplicateCopyValidator extends DockerValidator {
    name = 'no-duplicate-copy';
    description = 'Detects duplicate COPY --from=builder statements';
    severity: 'error' | 'warning' = 'error';

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        const lines = dockerfile.split('\n');
        const copyFromCommands = new Map<string, number[]>();

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            // Match COPY --from=builder patterns
            const copyMatch = trimmed.match(/^COPY\s+--from=(\S+)\s+(\S+)\s+(\S+)/);
            if (copyMatch) {
                const [, stage, source, dest] = copyMatch;
                
                // Track copies from builder to same destination
                if (stage.toLowerCase().includes('builder') || stage.toLowerCase().includes('build')) {
                    const key = `${dest}`;
                    if (!copyFromCommands.has(key)) {
                        copyFromCommands.set(key, []);
                    }
                    copyFromCommands.get(key)!.push(index);
                }
            }
        });

        // Check for duplicates
        copyFromCommands.forEach((lineNumbers, destination) => {
            if (lineNumbers.length > 1) {
                errors.push(this.createError(
                    'dockerfile',
                    `Multiple COPY --from=builder commands to ${destination} detected`,
                    lineNumbers[1],
                    `Use only ONE COPY statement for the detected build output directory (dist, build, or out)`
                ));
            }
        });

        // Check for common problematic patterns (dist AND build)
        const hasDistCopy = lines.some(line => line.includes('COPY --from=builder') && line.includes('/app/dist'));
        const hasBuildCopy = lines.some(line => line.includes('COPY --from=builder') && line.includes('/app/build'));
        
        if (hasDistCopy && hasBuildCopy) {
            const lineNum = lines.findIndex(line => line.includes('/app/build'));
            errors.push(this.createError(
                'dockerfile',
                'Copying from both /app/dist AND /app/build - only one will exist',
                lineNum,
                'Detect the correct build output folder (Vite→dist, CRA→build) and use only that one'
            ));
        }

        return errors;
    }
}

/**
 * Validator Registry
 */
export class ValidatorRegistry {
    private validators: Map<string, DockerValidator> = new Map();

    constructor() {
        this.registerDefaultValidators();
    }

    private registerDefaultValidators() {
        const defaultValidators = [
            new NoRootUserValidator(),
            new MultiStageBuildValidator(),
            new ValidPortsValidator(),
            new NoHardcodedSecretsValidator(),
            new HealthCheckValidator(),
            new VersionPinningValidator(),
            new ServiceDependencyValidator(),
            new PortConflictValidator(),
            new NoUserNginxValidator(),         // NEW: Catch USER nginx
            new NoDuplicateCopyValidator()      // NEW: Catch duplicate COPY
        ];

        defaultValidators.forEach(validator => {
            this.validators.set(validator.name, validator);
        });
    }

    register(validator: DockerValidator) {
        this.validators.set(validator.name, validator);
    }

    get(name: string): DockerValidator | undefined {
        return this.validators.get(name);
    }

    getAll(): DockerValidator[] {
        return Array.from(this.validators.values());
    }

    async validateDockerfile(
        dockerfile: string,
        validatorNames?: string[],
        metadata?: any
    ): Promise<ValidationError[]> {
        const validators = validatorNames
            ? validatorNames.map(name => this.get(name)).filter(v => v !== undefined) as DockerValidator[]
            : this.getAll().filter(v => v.name !== 'service-dependencies' && v.name !== 'port-conflicts');

        const allErrors: ValidationError[] = [];

        for (const validator of validators) {
            const errors = await validator.validate(dockerfile, metadata);
            allErrors.push(...errors);
        }

        return allErrors;
    }

    async validateDockerCompose(
        composeContent: string,
        validatorNames?: string[]
    ): Promise<ValidationError[]> {
        const validators = validatorNames
            ? validatorNames.map(name => this.get(name)).filter(v => v !== undefined) as DockerValidator[]
            : [this.get('service-dependencies')!, this.get('port-conflicts')!];

        const allErrors: ValidationError[] = [];

        for (const validator of validators) {
            const errors = await validator.validate(composeContent);
            allErrors.push(...errors);
        }

        return allErrors;
    }
}
