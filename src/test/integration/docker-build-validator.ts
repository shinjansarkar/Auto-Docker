/**
 * Docker Build Validator
 * Validates Docker builds and provides detailed error reporting
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BuildValidationResult {
    success: boolean;
    buildTime?: number;
    imageSize?: string;
    layers?: number;
    errors: string[];
    warnings: string[];
    logs: string;
}

export interface ComposeValidationResult {
    success: boolean;
    services: string[];
    errors: string[];
    warnings: string[];
    configValid: boolean;
}

export class DockerBuildValidator {
    
    /**
     * Validate Docker build without actually building
     */
    async validateBuildContext(projectPath: string): Promise<{ valid: boolean; issues: string[] }> {
        const issues: string[] = [];
        
        try {
            const dockerfilePath = path.join(projectPath, 'Dockerfile');
            
            if (!fs.existsSync(dockerfilePath)) {
                issues.push('Dockerfile not found');
                return { valid: false, issues };
            }
            
            const content = fs.readFileSync(dockerfilePath, 'utf-8');
            const lines = content.split('\n');
            
            // Check for common issues
            let hasFrom = false;
            let hasWorkdir = false;
            let hasCopy = false;
            
            for (const line of lines) {
                const trimmed = line.trim();
                
                if (trimmed.startsWith('FROM ')) {
                    hasFrom = true;
                }
                if (trimmed.startsWith('WORKDIR ')) {
                    hasWorkdir = true;
                }
                if (trimmed.startsWith('COPY ') || trimmed.startsWith('ADD ')) {
                    hasCopy = true;
                }
                
                // Check for problematic patterns
                if (trimmed.includes('COPY . .') && !fs.existsSync(path.join(projectPath, '.dockerignore'))) {
                    issues.push('Using COPY . . without .dockerignore can include unwanted files');
                }
                
                if (trimmed.match(/FROM.*:latest/i)) {
                    issues.push('Avoid using :latest tag for base images - specify exact versions');
                }
                
                if (trimmed.includes('RUN') && trimmed.includes('sudo')) {
                    issues.push('Avoid using sudo in RUN commands');
                }
            }
            
            if (!hasFrom) {
                issues.push('Dockerfile must start with FROM instruction');
            }
            
            if (!hasWorkdir) {
                issues.push('Dockerfile should include WORKDIR instruction');
            }
            
            return { valid: issues.length === 0, issues };
            
        } catch (error) {
            issues.push(`Build context validation failed: ${error}`);
            return { valid: false, issues };
        }
    }
    
    /**
     * Attempt to build Docker image
     */
    async attemptBuild(
        projectPath: string,
        projectName: string,
        timeout: number = 180000
    ): Promise<BuildValidationResult> {
        const result: BuildValidationResult = {
            success: false,
            errors: [],
            warnings: [],
            logs: ''
        };
        
        try {
            const imageName = `auto-docker-test-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
            const startTime = Date.now();
            
            console.log(`  Attempting Docker build for ${projectName}...`);
            
            // Run docker build
            const { stdout, stderr } = await execAsync(
                `docker build -t ${imageName}:test .`,
                {
                    cwd: projectPath,
                    timeout,
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                }
            );
            
            result.logs = stdout + stderr;
            result.buildTime = Date.now() - startTime;
            
            // Get image details
            try {
                const inspectOutput = await execAsync(`docker inspect ${imageName}:test --format='{{.Size}}'`);
                const sizeBytes = parseInt(inspectOutput.stdout.trim());
                result.imageSize = formatBytes(sizeBytes);
                
                // Get layer count
                const historyOutput = await execAsync(`docker history ${imageName}:test --no-trunc --format='{{.ID}}'`);
                result.layers = historyOutput.stdout.trim().split('\n').length;
                
            } catch (inspectError) {
                result.warnings.push('Could not inspect image details');
            }
            
            // Cleanup - remove test image
            try {
                await execAsync(`docker rmi ${imageName}:test`);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            result.success = true;
            console.log(`  ✓ Build successful (${result.buildTime}ms, ${result.imageSize})`);
            
        } catch (error) {
            result.success = false;
            
            if (error instanceof Error) {
                const errorOutput = (error as any).stderr || (error as any).stdout || error.message;
                result.logs = errorOutput;
                
                // Parse common Docker errors
                if (errorOutput.includes('no such file or directory')) {
                    result.errors.push('Build failed: Missing files referenced in Dockerfile');
                } else if (errorOutput.includes('failed to solve')) {
                    result.errors.push('Build failed: Dockerfile syntax or dependency error');
                } else if (errorOutput.includes('COPY failed')) {
                    result.errors.push('Build failed: COPY instruction failed');
                } else if (errorOutput.includes('RUN returned a non-zero code')) {
                    result.errors.push('Build failed: RUN command failed');
                } else {
                    result.errors.push(`Build failed: ${error.message}`);
                }
            } else {
                result.errors.push(`Build failed: ${String(error)}`);
            }
            
            console.error(`  ✗ Build failed: ${result.errors[0]}`);
        }
        
        return result;
    }
    
    /**
     * Validate docker-compose configuration
     */
    async validateCompose(projectPath: string): Promise<ComposeValidationResult> {
        const result: ComposeValidationResult = {
            success: false,
            services: [],
            errors: [],
            warnings: [],
            configValid: false
        };
        
        try {
            const composePath = path.join(projectPath, 'docker-compose.yml');
            
            if (!fs.existsSync(composePath)) {
                result.errors.push('docker-compose.yml not found');
                return result;
            }
            
            // Run docker-compose config to validate
            try {
                const { stdout } = await execAsync('docker-compose config --services', {
                    cwd: projectPath,
                    timeout: 30000
                });
                
                result.services = stdout.trim().split('\n').filter(s => s.length > 0);
                result.configValid = true;
                
            } catch (configError) {
                result.errors.push('docker-compose config validation failed');
                result.configValid = false;
            }
            
            // Validate compose file syntax
            const content = fs.readFileSync(composePath, 'utf-8');
            
            // Check for common issues
            if (!content.includes('services:')) {
                result.errors.push('docker-compose.yml missing services section');
            }
            
            if (content.includes('version:') && content.includes('version: "2"')) {
                result.warnings.push('Using Docker Compose v2 format - consider upgrading to v3');
            }
            
            // Check for exposed ports
            if (!content.includes('ports:') && !content.includes('expose:')) {
                result.warnings.push('No ports exposed in docker-compose.yml');
            }
            
            result.success = result.errors.length === 0;
            
        } catch (error) {
            result.errors.push(`Compose validation failed: ${error}`);
        }
        
        return result;
    }
    
    /**
     * Run hadolint for Dockerfile linting (if available)
     */
    async runHadolint(dockerfilePath: string): Promise<{ issues: string[]; warnings: string[] }> {
        const issues: string[] = [];
        const warnings: string[] = [];
        
        try {
            // Check if hadolint is installed
            await execAsync('hadolint --version');
            
            // Run hadolint
            const { stdout, stderr } = await execAsync(`hadolint ${dockerfilePath}`);
            
            const output = stdout + stderr;
            const lines = output.split('\n');
            
            for (const line of lines) {
                if (line.includes('DL')) {
                    if (line.includes('error:')) {
                        issues.push(line.trim());
                    } else if (line.includes('warning:')) {
                        warnings.push(line.trim());
                    }
                }
            }
            
        } catch (error) {
            // Hadolint not installed or returned errors
            // This is optional, so we don't fail the test
        }
        
        return { issues, warnings };
    }
    
    /**
     * Check if Docker daemon is running
     */
    async isDockerAvailable(): Promise<boolean> {
        try {
            await execAsync('docker version', { timeout: 5000 });
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Check if docker-compose is available
     */
    async isDockerComposeAvailable(): Promise<boolean> {
        try {
            await execAsync('docker-compose --version', { timeout: 5000 });
            return true;
        } catch {
            // Try docker compose (v2 syntax)
            try {
                await execAsync('docker compose version', { timeout: 5000 });
                return true;
            } catch {
                return false;
            }
        }
    }
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export const dockerValidator = new DockerBuildValidator();
