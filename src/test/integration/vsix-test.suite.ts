/**
 * VSIX Integration Test Suite
 * Tests the Auto Docker extension against various project types
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
    projectName: string;
    projectPath: string;
    success: boolean;
    errors: string[];
    warnings: string[];
    filesGenerated: {
        dockerfile: boolean;
        dockerCompose: boolean;
        dockerignore: boolean;
        nginx: boolean;
    };
    validation: {
        dockerfileSyntax: boolean;
        dockerComposeSyntax: boolean;
        dockerBuildSuccess: boolean;
        securityIssues: string[];
    };
    duration: number;
}

interface ProjectTestConfig {
    name: string;
    path: string;
    expectedFiles: string[];
    shouldHaveNginx: boolean;
    expectedPorts: number[];
    buildTimeout?: number;
}

suite('Auto Docker Extension - Full Integration Tests', () => {
    const testResults: TestResult[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const testProjectsRoot = path.join(workspaceRoot, 'test-projects');
    
    // Test configurations for different project types
    const testProjects: ProjectTestConfig[] = [
        // Backend Projects
        {
            name: 'Node.js Express',
            path: 'backend/01-node-express',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [3000]
        },
        {
            name: 'FastAPI Python',
            path: 'backend/02-fastapi-python',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8000]
        },
        {
            name: 'Flask Python',
            path: 'backend/03-flask-python',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [5000]
        },
        {
            name: 'Django Python',
            path: 'backend/04-django-python',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8000]
        },
        {
            name: 'Go Gin',
            path: 'backend/05-go-gin',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8080]
        },
        {
            name: 'Spring Boot Java',
            path: 'backend/06-spring-boot-java',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8080],
            buildTimeout: 180000 // Java builds can be slow
        },
        {
            name: 'NestJS',
            path: 'backend/07-nestjs',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [3000]
        },
        {
            name: 'Ruby on Rails',
            path: 'backend/08-ruby-rails',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [3000]
        },
        {
            name: 'Rust Actix',
            path: 'backend/09-rust-actix',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8080],
            buildTimeout: 300000 // Rust builds are very slow
        },
        {
            name: 'PHP Laravel',
            path: 'backend/10-php-laravel',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [8000]
        },
        {
            name: '.NET API',
            path: 'backend/11-dotnet-api',
            expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
            shouldHaveNginx: false,
            expectedPorts: [5000]
        }
    ];

    suiteSetup(async function() {
        this.timeout(120000); // 2 minutes for suite setup
        
        console.log('\n=== Starting Auto Docker Extension Test Suite ===\n');
        
        // Verify extension is active
        const extension = vscode.extensions.getExtension('ShinjanSarkar.auto-docker-extension');
        if (!extension) {
            throw new Error('Auto Docker extension not found');
        }
        
        if (!extension.isActive) {
            await extension.activate();
            console.log('✓ Extension activated');
        }
        
        // Verify test projects exist
        if (!fs.existsSync(testProjectsRoot)) {
            throw new Error(`Test projects directory not found: ${testProjectsRoot}`);
        }
        
        console.log(`✓ Test projects root found: ${testProjectsRoot}\n`);
    });

    suiteTeardown(async function() {
        this.timeout(60000);
        
        // Generate comprehensive test report
        await generateTestReport(testResults);
        
        console.log('\n=== Test Suite Complete ===\n');
        console.log(`Total Projects Tested: ${testResults.length}`);
        console.log(`Successful: ${testResults.filter(r => r.success).length}`);
        console.log(`Failed: ${testResults.filter(r => !r.success).length}`);
    });

    // Test each project type
    testProjects.forEach(projectConfig => {
        test(`Generate Docker files for ${projectConfig.name}`, async function() {
            this.timeout(projectConfig.buildTimeout || 120000);
            
            const startTime = Date.now();
            const projectPath = path.join(testProjectsRoot, projectConfig.path);
            
            const result: TestResult = {
                projectName: projectConfig.name,
                projectPath: projectConfig.path,
                success: false,
                errors: [],
                warnings: [],
                filesGenerated: {
                    dockerfile: false,
                    dockerCompose: false,
                    dockerignore: false,
                    nginx: false
                },
                validation: {
                    dockerfileSyntax: false,
                    dockerComposeSyntax: false,
                    dockerBuildSuccess: false,
                    securityIssues: []
                },
                duration: 0
            };

            try {
                // Step 1: Verify project exists
                if (!fs.existsSync(projectPath)) {
                    result.errors.push(`Project directory not found: ${projectPath}`);
                    testResults.push(result);
                    assert.fail(`Project not found: ${projectPath}`);
                }

                // Step 2: Clean up any existing Docker files
                await cleanupDockerFiles(projectPath);

                // Step 3: Open the project folder
                const uri = vscode.Uri.file(projectPath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, false);
                
                // Wait for workspace to be ready
                await sleep(2000);

                // Step 4: Execute Auto Docker command
                console.log(`\nTesting: ${projectConfig.name}`);
                console.log(`Path: ${projectPath}`);
                
                await vscode.commands.executeCommand('autoDocker.analyzeProject');
                
                // Wait for generation to complete
                await sleep(5000);

                // Step 5: Check generated files
                result.filesGenerated.dockerfile = fs.existsSync(path.join(projectPath, 'Dockerfile'));
                result.filesGenerated.dockerCompose = fs.existsSync(path.join(projectPath, 'docker-compose.yml'));
                result.filesGenerated.dockerignore = fs.existsSync(path.join(projectPath, '.dockerignore'));
                result.filesGenerated.nginx = fs.existsSync(path.join(projectPath, 'nginx.conf'));

                // Step 6: Validate file existence
                for (const expectedFile of projectConfig.expectedFiles) {
                    const filePath = path.join(projectPath, expectedFile);
                    if (!fs.existsSync(filePath)) {
                        result.errors.push(`Expected file not generated: ${expectedFile}`);
                    }
                }

                // Step 7: Validate Dockerfile syntax
                if (result.filesGenerated.dockerfile) {
                    const dockerfilePath = path.join(projectPath, 'Dockerfile');
                    const dockerfileValidation = await validateDockerfile(dockerfilePath);
                    result.validation.dockerfileSyntax = dockerfileValidation.valid;
                    result.errors.push(...dockerfileValidation.errors);
                    result.warnings.push(...dockerfileValidation.warnings);
                }

                // Step 8: Validate docker-compose.yml syntax
                if (result.filesGenerated.dockerCompose) {
                    const composePath = path.join(projectPath, 'docker-compose.yml');
                    const composeValidation = await validateDockerCompose(composePath);
                    result.validation.dockerComposeSyntax = composeValidation.valid;
                    result.errors.push(...composeValidation.errors);
                    result.warnings.push(...composeValidation.warnings);
                }

                // Step 9: Validate ports configuration
                if (result.filesGenerated.dockerCompose) {
                    const portValidation = await validatePorts(
                        path.join(projectPath, 'docker-compose.yml'),
                        projectConfig.expectedPorts
                    );
                    if (!portValidation.valid) {
                        result.warnings.push(portValidation.message);
                    }
                }

                // Step 10: Attempt Docker build (optional, can be slow)
                if (process.env.RUN_DOCKER_BUILD === 'true' && result.filesGenerated.dockerfile) {
                    const buildResult = await attemptDockerBuild(projectPath, projectConfig.name);
                    result.validation.dockerBuildSuccess = buildResult.success;
                    if (!buildResult.success) {
                        result.errors.push(`Docker build failed: ${buildResult.error}`);
                    }
                }

                // Step 11: Check for security issues (basic validation)
                if (result.filesGenerated.dockerfile) {
                    const securityCheck = await checkDockerfileSecurity(path.join(projectPath, 'Dockerfile'));
                    result.validation.securityIssues = securityCheck.issues;
                    result.warnings.push(...securityCheck.issues);
                }

                // Determine overall success
                result.success = result.errors.length === 0;
                result.duration = Date.now() - startTime;

                testResults.push(result);

                // Assert test passed
                if (!result.success) {
                    console.error(`\n❌ Failed: ${projectConfig.name}`);
                    console.error(`Errors: ${result.errors.join(', ')}`);
                    assert.fail(`Test failed for ${projectConfig.name}: ${result.errors.join('; ')}`);
                } else {
                    console.log(`✓ Passed: ${projectConfig.name} (${result.duration}ms)`);
                }

            } catch (error) {
                result.errors.push(`Exception: ${error instanceof Error ? error.message : String(error)}`);
                result.duration = Date.now() - startTime;
                testResults.push(result);
                throw error;
            }
        });
    });

    // Additional validation tests
    test('Validate multi-stage build support', async function() {
        this.timeout(30000);
        
        // Check if generated Dockerfiles use multi-stage builds where appropriate
        const nodejsProject = path.join(testProjectsRoot, 'backend/01-node-express/Dockerfile');
        
        if (fs.existsSync(nodejsProject)) {
            const content = fs.readFileSync(nodejsProject, 'utf-8');
            const hasMultiStage = content.includes('AS builder') || content.includes('AS build');
            
            if (!hasMultiStage) {
                console.warn('⚠️  Warning: Node.js project should use multi-stage build');
            }
        }
    });

    test('Validate .dockerignore patterns', async function() {
        this.timeout(30000);
        
        const dockerignorePath = path.join(testProjectsRoot, 'backend/01-node-express/.dockerignore');
        
        if (fs.existsSync(dockerignorePath)) {
            const content = fs.readFileSync(dockerignorePath, 'utf-8');
            const requiredPatterns = ['node_modules', '.git', '*.log'];
            
            for (const pattern of requiredPatterns) {
                if (!content.includes(pattern)) {
                    console.warn(`⚠️  Warning: .dockerignore missing pattern: ${pattern}`);
                }
            }
        }
    });

    test('Validate environment variable handling', async function() {
        this.timeout(30000);
        
        const composePath = path.join(testProjectsRoot, 'backend/01-node-express/docker-compose.yml');
        
        if (fs.existsSync(composePath)) {
            const content = fs.readFileSync(composePath, 'utf-8');
            const hasEnvSection = content.includes('environment:') || content.includes('env_file:');
            
            assert.ok(hasEnvSection, 'docker-compose.yml should include environment configuration');
        }
    });
});

// Helper Functions

async function cleanupDockerFiles(projectPath: string): Promise<void> {
    const dockerFiles = ['Dockerfile', 'docker-compose.yml', '.dockerignore', 'nginx.conf'];
    
    for (const file of dockerFiles) {
        const filePath = path.join(projectPath, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

async function validateDockerfile(dockerfilePath: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
        const content = fs.readFileSync(dockerfilePath, 'utf-8');
        
        // Basic syntax checks
        if (!content.includes('FROM ')) {
            errors.push('Dockerfile missing FROM instruction');
        }
        
        // Check for best practices
        if (!content.includes('WORKDIR')) {
            warnings.push('Dockerfile should use WORKDIR instruction');
        }
        
        if (content.includes('COPY . .') && !content.includes('.dockerignore')) {
            warnings.push('Using COPY . . without .dockerignore can include unnecessary files');
        }
        
        if (!content.includes('USER ') && !content.includes('user:')) {
            warnings.push('Dockerfile should specify a non-root USER for security');
        }
        
        // Check for common issues
        if (content.includes('RUN apt-get update') && !content.includes('apt-get clean')) {
            warnings.push('apt-get update should be followed by apt-get clean');
        }
        
        return { valid: errors.length === 0, errors, warnings };
    } catch (error) {
        errors.push(`Failed to validate Dockerfile: ${error}`);
        return { valid: false, errors, warnings };
    }
}

async function validateDockerCompose(composePath: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
        const content = fs.readFileSync(composePath, 'utf-8');
        const parsed = yaml.load(content) as any;
        
        // Validate YAML structure
        if (!parsed.services) {
            errors.push('docker-compose.yml missing services section');
        }
        
        // Check version (optional in newer Docker Compose)
        if (parsed.version && !parsed.version.startsWith('3')) {
            warnings.push('Consider using Docker Compose version 3.x');
        }
        
        // Validate services
        if (parsed.services) {
            for (const [serviceName, service] of Object.entries(parsed.services)) {
                if (!service || typeof service !== 'object') {
                    errors.push(`Invalid service configuration: ${serviceName}`);
                    continue;
                }
                
                const svc = service as any;
                
                if (!svc.build && !svc.image) {
                    errors.push(`Service ${serviceName} must have either 'build' or 'image'`);
                }
                
                if (!svc.ports && !svc.expose) {
                    warnings.push(`Service ${serviceName} has no ports exposed`);
                }
            }
        }
        
        return { valid: errors.length === 0, errors, warnings };
    } catch (error) {
        errors.push(`Failed to validate docker-compose.yml: ${error}`);
        return { valid: false, errors, warnings };
    }
}

async function validatePorts(composePath: string, expectedPorts: number[]): Promise<{ valid: boolean; message: string }> {
    try {
        const content = fs.readFileSync(composePath, 'utf-8');
        const parsed = yaml.load(content) as any;
        
        if (!parsed.services) {
            return { valid: false, message: 'No services found in docker-compose.yml' };
        }
        
        const foundPorts: number[] = [];
        
        for (const service of Object.values(parsed.services)) {
            const svc = service as any;
            if (svc.ports) {
                for (const port of svc.ports) {
                    const portStr = String(port);
                    const match = portStr.match(/(\d+):/);
                    if (match) {
                        foundPorts.push(parseInt(match[1]));
                    }
                }
            }
        }
        
        const allExpectedFound = expectedPorts.every(port => foundPorts.includes(port));
        
        if (!allExpectedFound) {
            return {
                valid: false,
                message: `Expected ports ${expectedPorts.join(', ')} but found ${foundPorts.join(', ')}`
            };
        }
        
        return { valid: true, message: 'Port configuration valid' };
    } catch (error) {
        return { valid: false, message: `Failed to validate ports: ${error}` };
    }
}

async function attemptDockerBuild(projectPath: string, projectName: string): Promise<{ success: boolean; error?: string }> {
    try {
        const imageName = `auto-docker-test-${projectName.toLowerCase().replace(/\s+/g, '-')}`;
        
        console.log(`  Building Docker image: ${imageName}...`);
        
        const { stdout, stderr } = await execAsync(
            `docker build -t ${imageName} .`,
            {
                cwd: projectPath,
                timeout: 180000 // 3 minutes max
            }
        );
        
        console.log(`  ✓ Docker build successful`);
        
        // Cleanup - remove the test image
        await execAsync(`docker rmi ${imageName}`).catch(() => {});
        
        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ Docker build failed: ${errorMessage}`);
        return { success: false, error: errorMessage };
    }
}

async function checkDockerfileSecurity(dockerfilePath: string): Promise<{ issues: string[] }> {
    const issues: string[] = [];
    
    try {
        const content = fs.readFileSync(dockerfilePath, 'utf-8').toLowerCase();
        
        // Check for common security issues
        if (content.includes('run') && content.includes('curl') && content.includes('bash')) {
            issues.push('Security: Avoid piping curl to bash');
        }
        
        if (content.includes('add http://') || content.includes('add https://')) {
            issues.push('Security: Use COPY instead of ADD for URLs, or use RUN with curl/wget');
        }
        
        if (content.includes('run') && content.includes('&&') && !content.includes('\\')) {
            issues.push('Best Practice: Chain RUN commands should use line continuation (\\)');
        }
        
        if (content.includes('latest') && content.includes('from')) {
            issues.push('Best Practice: Avoid using :latest tag, specify exact versions');
        }
        
    } catch (error) {
        issues.push(`Failed to check security: ${error}`);
    }
    
    return { issues };
}

async function generateTestReport(results: TestResult[]): Promise<void> {
    const reportPath = path.join(
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
        'AUTO_DOCKER_TEST_REPORT.md'
    );
    
    let report = `# Auto Docker Extension - Test Report\n\n`;
    report += `**Date:** ${new Date().toISOString()}\n\n`;
    report += `**Total Projects:** ${results.length}\n`;
    report += `**Passed:** ${results.filter(r => r.success).length}\n`;
    report += `**Failed:** ${results.filter(r => !r.success).length}\n\n`;
    
    report += `---\n\n`;
    
    // Summary table
    report += `## Test Summary\n\n`;
    report += `| Project | Status | Duration | Issues |\n`;
    report += `|---------|--------|----------|--------|\n`;
    
    for (const result of results) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const duration = `${result.duration}ms`;
        const issues = result.errors.length + result.warnings.length;
        report += `| ${result.projectName} | ${status} | ${duration} | ${issues} |\n`;
    }
    
    report += `\n---\n\n`;
    
    // Detailed results
    report += `## Detailed Results\n\n`;
    
    for (const result of results) {
        report += `### ${result.projectName}\n\n`;
        report += `- **Path:** \`${result.projectPath}\`\n`;
        report += `- **Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `- **Duration:** ${result.duration}ms\n\n`;
        
        report += `**Files Generated:**\n`;
        report += `- Dockerfile: ${result.filesGenerated.dockerfile ? '✅' : '❌'}\n`;
        report += `- docker-compose.yml: ${result.filesGenerated.dockerCompose ? '✅' : '❌'}\n`;
        report += `- .dockerignore: ${result.filesGenerated.dockerignore ? '✅' : '❌'}\n`;
        report += `- nginx.conf: ${result.filesGenerated.nginx ? '✅' : 'N/A'}\n\n`;
        
        report += `**Validation:**\n`;
        report += `- Dockerfile Syntax: ${result.validation.dockerfileSyntax ? '✅' : '❌'}\n`;
        report += `- Docker Compose Syntax: ${result.validation.dockerComposeSyntax ? '✅' : '❌'}\n`;
        report += `- Docker Build: ${result.validation.dockerBuildSuccess ? '✅' : 'N/A'}\n\n`;
        
        if (result.errors.length > 0) {
            report += `**Errors:**\n`;
            for (const error of result.errors) {
                report += `- ❌ ${error}\n`;
            }
            report += `\n`;
        }
        
        if (result.warnings.length > 0) {
            report += `**Warnings:**\n`;
            for (const warning of result.warnings) {
                report += `- ⚠️  ${warning}\n`;
            }
            report += `\n`;
        }
        
        if (result.validation.securityIssues.length > 0) {
            report += `**Security Issues:**\n`;
            for (const issue of result.validation.securityIssues) {
                report += `- 🔒 ${issue}\n`;
            }
            report += `\n`;
        }
        
        report += `---\n\n`;
    }
    
    // Issues summary
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    const allSecurityIssues = results.flatMap(r => r.validation.securityIssues);
    
    if (allErrors.length > 0 || allWarnings.length > 0 || allSecurityIssues.length > 0) {
        report += `## Issues Summary\n\n`;
        
        if (allErrors.length > 0) {
            report += `### Critical Errors (${allErrors.length})\n\n`;
            const errorCounts = countOccurrences(allErrors);
            for (const [error, count] of Object.entries(errorCounts).sort((a, b) => b[1] - a[1])) {
                report += `- **${count}x** ${error}\n`;
            }
            report += `\n`;
        }
        
        if (allWarnings.length > 0) {
            report += `### Warnings (${allWarnings.length})\n\n`;
            const warningCounts = countOccurrences(allWarnings);
            for (const [warning, count] of Object.entries(warningCounts).sort((a, b) => b[1] - a[1])) {
                report += `- **${count}x** ${warning}\n`;
            }
            report += `\n`;
        }
        
        if (allSecurityIssues.length > 0) {
            report += `### Security Issues (${allSecurityIssues.length})\n\n`;
            const securityCounts = countOccurrences(allSecurityIssues);
            for (const [issue, count] of Object.entries(securityCounts).sort((a, b) => b[1] - a[1])) {
                report += `- **${count}x** ${issue}\n`;
            }
            report += `\n`;
        }
    }
    
    // Recommendations
    report += `## Recommendations\n\n`;
    
    const failedProjects = results.filter(r => !r.success);
    if (failedProjects.length > 0) {
        report += `### Fix Failed Projects\n\n`;
        for (const project of failedProjects) {
            report += `- **${project.projectName}**: ${project.errors[0] || 'Unknown error'}\n`;
        }
        report += `\n`;
    }
    
    if (allWarnings.length > 10) {
        report += `### Address Common Warnings\n\n`;
        report += `Multiple projects show similar warnings. Consider implementing fixes at the template level.\n\n`;
    }
    
    if (allSecurityIssues.length > 0) {
        report += `### Security Improvements\n\n`;
        report += `Review and address security best practices in generated Dockerfiles.\n\n`;
    }
    
    report += `---\n\n`;
    report += `*Generated by Auto Docker Extension Test Suite*\n`;
    
    // Write report
    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n✓ Test report generated: ${reportPath}`);
    
    // Open the report
    const doc = await vscode.workspace.openTextDocument(reportPath);
    await vscode.window.showTextDocument(doc);
}

function countOccurrences(items: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
        counts[item] = (counts[item] || 0) + 1;
    }
    return counts;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
