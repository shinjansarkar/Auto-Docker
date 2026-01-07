/**
 * Static Analysis Service
 * Comprehensive validation and linting for Docker files
 * Includes Dockerfile linting, docker-compose validation, and nginx config testing
 */

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';
import { DockerFiles } from './llmService';
import { SchemaValidator } from './schemaValidator';

/**
 * Analysis Result Interfaces
 */
export interface LintIssue {
    code: string;
    level: 'error' | 'warning' | 'info' | 'style';
    line?: number;
    column?: number;
    message: string;
    suggestion?: string;
    autoFixable: boolean;
}

export interface LintResult {
    valid: boolean;
    errors: LintIssue[];
    warnings: LintIssue[];
    infos: LintIssue[];
    totalIssues: number;
    score: number; // 0-100
}

export interface AnalysisReport {
    dockerfile: LintResult;
    dockerCompose: LintResult;
    nginxConf?: LintResult;
    overall: {
        valid: boolean;
        score: number;
        criticalIssues: number;
        autoFixableIssues: number;
    };
}

/**
 * Dockerfile Linter
 * Analyzes Dockerfile for best practices and common issues
 */
export class DockerfileLinter {
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - Linter');
    }

    /**
     * Lint Dockerfile content
     */
    async lintDockerfile(content: string): Promise<LintResult> {
        this.log('🔍 Linting Dockerfile...');

        const issues: LintIssue[] = [];
        const lines = content.split('\n');

        // Run all lint checks
        this.checkBaseImage(lines, issues);
        this.checkUserDirective(lines, issues);
        this.checkCopyInstructions(lines, issues);
        this.checkRunInstructions(lines, issues);
        this.checkExposeDirective(lines, issues);
        this.checkHealthCheck(lines, issues);
        this.checkWorkdir(lines, issues);
        this.checkCmdEntrypoint(lines, issues);
        this.checkAptGetUsage(lines, issues);
        this.checkSecretsExposure(lines, issues);
        this.checkLayerOptimization(lines, issues);
        this.checkSecurityBestPractices(lines, issues);

        // Categorize issues
        const errors = issues.filter(i => i.level === 'error');
        const warnings = issues.filter(i => i.level === 'warning');
        const infos = issues.filter(i => i.level === 'info');

        // Calculate score
        const score = this.calculateScore(errors.length, warnings.length, infos.length);

        this.log(`✅ Lint complete: ${errors.length} errors, ${warnings.length} warnings, ${infos.length} infos`);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            infos,
            totalIssues: issues.length,
            score
        };
    }

    /**
     * Check base image usage
     */
    private checkBaseImage(lines: string[], issues: LintIssue[]): void {
        const fromLines = lines.filter(l => l.trim().toUpperCase().startsWith('FROM'));

        fromLines.forEach((line, idx) => {
            const lineNum = lines.indexOf(line) + 1;

            // DL3007: Using latest tag
            if (line.includes(':latest') || (!line.includes(':') && !line.includes('@'))) {
                issues.push({
                    code: 'DL3007',
                    level: 'warning',
                    line: lineNum,
                    message: 'Using latest tag is not recommended. Pin base image versions.',
                    suggestion: 'Use specific version like node:20-alpine or python:3.11-slim',
                    autoFixable: true
                });
            }

            // DL3006: Always tag FROM
            if (!line.includes(':') && !line.includes('@sha256:')) {
                issues.push({
                    code: 'DL3006',
                    level: 'warning',
                    line: lineNum,
                    message: 'Always tag the version of an image explicitly',
                    suggestion: 'Add version tag to base image',
                    autoFixable: false
                });
            }

            // Check for Alpine recommendation
            if (line.includes('node:') && !line.includes('alpine') && !line.includes('slim')) {
                issues.push({
                    code: 'DL3018',
                    level: 'info',
                    line: lineNum,
                    message: 'Consider using Alpine-based images for smaller size',
                    suggestion: 'Use node:20-alpine instead of node:20',
                    autoFixable: false
                });
            }
        });

        if (fromLines.length === 0) {
            issues.push({
                code: 'DL3001',
                level: 'error',
                message: 'Dockerfile must contain at least one FROM instruction',
                autoFixable: false
            });
        }
    }

    /**
     * Check USER directive
     */
    private checkUserDirective(lines: string[], issues: LintIssue[]): void {
        const hasUser = lines.some(l => l.trim().toUpperCase().startsWith('USER '));

        if (!hasUser) {
            issues.push({
                code: 'DL3002',
                level: 'warning',
                message: 'Container runs as root user. Add USER directive for security.',
                suggestion: 'Add "USER nodejs" or create non-root user before CMD/ENTRYPOINT',
                autoFixable: true
            });
        }
    }

    /**
     * Check COPY instructions
     */
    private checkCopyInstructions(lines: string[], issues: LintIssue[]): void {
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            const lineNum = idx + 1;

            if (trimmed.toUpperCase().startsWith('COPY')) {
                // DL3020: Use COPY instead of ADD
                if (trimmed.includes('--chown=')) {
                    // Good practice, no issue
                } else {
                    issues.push({
                        code: 'DL3020',
                        level: 'info',
                        line: lineNum,
                        message: 'Consider using --chown flag to avoid additional chmod',
                        suggestion: 'COPY --chown=nodejs:nodejs . .',
                        autoFixable: false
                    });
                }

                // Check for copying unnecessary files
                if (trimmed.includes('COPY . .') || trimmed.includes('COPY ./ ./')) {
                    const hasDockeriIgnore = false; // Would need to check if .dockerignore exists
                    issues.push({
                        code: 'DL3010',
                        level: 'info',
                        line: lineNum,
                        message: 'Copying entire directory. Ensure .dockerignore is properly configured.',
                        suggestion: 'Use .dockerignore to exclude node_modules, .git, etc.',
                        autoFixable: false
                    });
                }
            }

            // DL3003: Use ADD for extracting archives
            if (trimmed.toUpperCase().startsWith('ADD') && !trimmed.includes('http://') && !trimmed.includes('https://')) {
                issues.push({
                    code: 'DL3003',
                    level: 'warning',
                    line: lineNum,
                    message: 'Use COPY instead of ADD unless you need URL support or archive extraction',
                    suggestion: 'Replace ADD with COPY',
                    autoFixable: true
                });
            }
        });
    }

    /**
     * Check RUN instructions
     */
    private checkRunInstructions(lines: string[], issues: LintIssue[]): void {
        const runLines: number[] = [];

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            const lineNum = idx + 1;

            if (trimmed.toUpperCase().startsWith('RUN')) {
                runLines.push(lineNum);

                // DL3059: Multiple consecutive RUN
                if (runLines.length > 3) {
                    issues.push({
                        code: 'DL3059',
                        level: 'info',
                        line: lineNum,
                        message: 'Multiple RUN instructions. Consider combining them to reduce layers.',
                        suggestion: 'Use && to chain commands in a single RUN',
                        autoFixable: false
                    });
                }

                // DL4006: Set pipefail option
                if (trimmed.includes('|') && !trimmed.includes('set -o pipefail')) {
                    issues.push({
                        code: 'DL4006',
                        level: 'warning',
                        line: lineNum,
                        message: 'Use shell flag -o pipefail for safer pipes',
                        suggestion: 'RUN set -o pipefail && your_command | another_command',
                        autoFixable: false
                    });
                }

                // Check for apt-get without cleanup
                if (trimmed.includes('apt-get install') && !trimmed.includes('rm -rf /var/lib/apt/lists')) {
                    issues.push({
                        code: 'DL3009',
                        level: 'warning',
                        line: lineNum,
                        message: 'Delete apt-get lists after installing packages',
                        suggestion: 'Add: && rm -rf /var/lib/apt/lists/* at the end',
                        autoFixable: true
                    });
                }

                // DL3008: Pin versions in apt-get
                if (trimmed.includes('apt-get install') && !trimmed.includes('=')) {
                    issues.push({
                        code: 'DL3008',
                        level: 'warning',
                        line: lineNum,
                        message: 'Pin versions in apt-get install for reproducibility',
                        suggestion: 'apt-get install -y package=version',
                        autoFixable: false
                    });
                }

                // Check for npm install without ci
                if (trimmed.includes('npm install') && !trimmed.includes('npm ci')) {
                    issues.push({
                        code: 'DL3016',
                        level: 'info',
                        line: lineNum,
                        message: 'Use "npm ci" instead of "npm install" for production builds',
                        suggestion: 'RUN npm ci --only=production',
                        autoFixable: true
                    });
                }
            }
        });
    }

    /**
     * Check EXPOSE directive
     */
    private checkExposeDirective(lines: string[], issues: LintIssue[]): void {
        const exposeLines = lines.filter(l => l.trim().toUpperCase().startsWith('EXPOSE'));

        if (exposeLines.length === 0) {
            issues.push({
                code: 'DL3011',
                level: 'info',
                message: 'No EXPOSE directive found. Document exposed ports.',
                suggestion: 'Add EXPOSE <port> to document container ports',
                autoFixable: false
            });
        }

        exposeLines.forEach((line, idx) => {
            const lineNum = lines.indexOf(line) + 1;
            const ports = line.match(/\d+/g);

            if (ports) {
                ports.forEach(port => {
                    const portNum = parseInt(port, 10);
                    if (portNum < 1 || portNum > 65535) {
                        issues.push({
                            code: 'DL3012',
                            level: 'error',
                            line: lineNum,
                            message: `Invalid port number: ${port}. Must be 1-65535.`,
                            autoFixable: false
                        });
                    }

                    // Warning for privileged ports
                    if (portNum < 1024) {
                        issues.push({
                            code: 'DL3013',
                            level: 'warning',
                            line: lineNum,
                            message: `Exposing privileged port ${port}. Requires root privileges.`,
                            suggestion: 'Use ports >= 1024 or ensure USER directive is not set',
                            autoFixable: false
                        });
                    }
                });
            }
        });
    }

    /**
     * Check HEALTHCHECK directive
     */
    private checkHealthCheck(lines: string[], issues: LintIssue[]): void {
        const hasHealthCheck = lines.some(l => l.trim().toUpperCase().startsWith('HEALTHCHECK'));

        if (!hasHealthCheck) {
            issues.push({
                code: 'DL3014',
                level: 'info',
                message: 'No HEALTHCHECK instruction. Add health check for production containers.',
                suggestion: 'HEALTHCHECK CMD curl -f http://localhost/ || exit 1',
                autoFixable: true
            });
        }
    }

    /**
     * Check WORKDIR directive
     */
    private checkWorkdir(lines: string[], issues: LintIssue[]): void {
        const hasWorkdir = lines.some(l => l.trim().toUpperCase().startsWith('WORKDIR'));

        if (!hasWorkdir) {
            issues.push({
                code: 'DL3015',
                level: 'warning',
                message: 'No WORKDIR specified. Use WORKDIR instead of cd commands.',
                suggestion: 'Add WORKDIR /app before COPY instructions',
                autoFixable: true
            });
        }

        // Check for absolute paths
        lines.forEach((line, idx) => {
            if (line.trim().toUpperCase().startsWith('WORKDIR')) {
                const path = line.split(/\s+/)[1];
                if (path && !path.startsWith('/')) {
                    issues.push({
                        code: 'DL3016',
                        level: 'warning',
                        line: idx + 1,
                        message: 'WORKDIR should use absolute paths',
                        suggestion: 'Use WORKDIR /app instead of WORKDIR app',
                        autoFixable: false
                    });
                }
            }
        });
    }

    /**
     * Check CMD/ENTRYPOINT
     */
    private checkCmdEntrypoint(lines: string[], issues: LintIssue[]): void {
        const hasCmdOrEntrypoint = lines.some(l => {
            const upper = l.trim().toUpperCase();
            return upper.startsWith('CMD') || upper.startsWith('ENTRYPOINT');
        });

        if (!hasCmdOrEntrypoint) {
            issues.push({
                code: 'DL3017',
                level: 'warning',
                message: 'No CMD or ENTRYPOINT specified',
                suggestion: 'Add CMD or ENTRYPOINT to define container startup command',
                autoFixable: false
            });
        }

        // DL3025: Check for JSON format
        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.toUpperCase().startsWith('CMD ') || trimmed.toUpperCase().startsWith('ENTRYPOINT ')) {
                if (!trimmed.includes('[') || !trimmed.includes(']')) {
                    issues.push({
                        code: 'DL3025',
                        level: 'warning',
                        line: idx + 1,
                        message: 'Use JSON array format for CMD and ENTRYPOINT',
                        suggestion: 'CMD ["node", "server.js"] instead of CMD node server.js',
                        autoFixable: true
                    });
                }
            }
        });
    }

    /**
     * Check apt-get usage
     */
    private checkAptGetUsage(lines: string[], issues: LintIssue[]): void {
        lines.forEach((line, idx) => {
            const trimmed = line.trim();

            if (trimmed.includes('apt-get update') && !trimmed.includes('apt-get install')) {
                issues.push({
                    code: 'DL3009',
                    level: 'warning',
                    line: idx + 1,
                    message: 'apt-get update should be combined with install in same RUN',
                    suggestion: 'RUN apt-get update && apt-get install -y package',
                    autoFixable: false
                });
            }

            if (trimmed.includes('apt-get') && !trimmed.includes('-y')) {
                issues.push({
                    code: 'DL3010',
                    level: 'warning',
                    line: idx + 1,
                    message: 'Use -y flag with apt-get for non-interactive installation',
                    suggestion: 'apt-get install -y package',
                    autoFixable: true
                });
            }
        });
    }

    /**
     * Check for secrets exposure
     */
    private checkSecretsExposure(lines: string[], issues: LintIssue[]): void {
        const secretPatterns = [
            /password\s*=\s*["'].*["']/i,
            /api[_-]?key\s*=\s*["'].*["']/i,
            /secret\s*=\s*["'].*["']/i,
            /token\s*=\s*["'].*["']/i,
            /aws[_-]?access[_-]?key/i,
            /private[_-]?key/i
        ];

        lines.forEach((line, idx) => {
            secretPatterns.forEach(pattern => {
                if (pattern.test(line)) {
                    issues.push({
                        code: 'DL3030',
                        level: 'error',
                        line: idx + 1,
                        message: 'Possible secret or credential exposed in Dockerfile',
                        suggestion: 'Use ENV variables or Docker secrets instead',
                        autoFixable: false
                    });
                }
            });
        });
    }

    /**
     * Check layer optimization
     */
    private checkLayerOptimization(lines: string[], issues: LintIssue[]): void {
        const copyLines = lines.filter(l => l.trim().toUpperCase().startsWith('COPY'));

        if (copyLines.length > 5) {
            issues.push({
                code: 'DL3040',
                level: 'info',
                message: `Found ${copyLines.length} COPY instructions. Consider consolidating.`,
                suggestion: 'Combine related COPY instructions to reduce layers',
                autoFixable: false
            });
        }

        // Check for multi-stage build
        const fromCount = lines.filter(l => l.trim().toUpperCase().startsWith('FROM')).length;
        if (fromCount === 1) {
            issues.push({
                code: 'DL3041',
                level: 'info',
                message: 'Consider using multi-stage builds for smaller final images',
                suggestion: 'Use build stage for dependencies and runtime stage for production',
                autoFixable: false
            });
        }
    }

    /**
     * Check security best practices
     */
    private checkSecurityBestPractices(lines: string[], issues: LintIssue[]): void {
        const content = lines.join('\n');

        // Check for curl without verification
        if (content.includes('curl') && (content.includes('-k') || content.includes('--insecure'))) {
            issues.push({
                code: 'DL3050',
                level: 'error',
                message: 'Insecure curl usage detected (--insecure or -k flag)',
                suggestion: 'Remove -k/--insecure flag or use proper SSL verification',
                autoFixable: false
            });
        }

        // Check for running as root explicitly
        if (content.includes('USER root')) {
            issues.push({
                code: 'DL3051',
                level: 'warning',
                message: 'Explicitly running as root user',
                suggestion: 'Avoid USER root directive or ensure it\'s temporary',
                autoFixable: false
            });
        }
    }

    /**
     * Calculate lint score (0-100)
     */
    private calculateScore(errors: number, warnings: number, infos: number): number {
        let score = 100;
        score -= errors * 15;
        score -= warnings * 5;
        score -= infos * 1;
        return Math.max(0, score);
    }

    /**
     * Auto-fix common issues
     */
    async autoFix(content: string, issues: LintIssue[]): Promise<string> {
        let fixed = content;
        const lines = fixed.split('\n');

        for (const issue of issues) {
            if (!issue.autoFixable || !issue.line) continue;

            const lineIdx = issue.line - 1;
            const line = lines[lineIdx];

            switch (issue.code) {
                case 'DL3007': // Latest tag
                    lines[lineIdx] = this.fixLatestTag(line);
                    break;

                case 'DL3002': // USER directive
                    this.addUserDirective(lines);
                    break;

                case 'DL3003': // ADD vs COPY
                    lines[lineIdx] = line.replace(/^ADD\s+/, 'COPY ');
                    break;

                case 'DL3009': // apt-get cleanup
                    lines[lineIdx] = this.addAptCleanup(line);
                    break;

                case 'DL3010': // apt-get -y flag
                    lines[lineIdx] = line.replace('apt-get install', 'apt-get install -y');
                    break;

                case 'DL3016': // npm ci
                    lines[lineIdx] = line.replace('npm install', 'npm ci');
                    break;

                case 'DL3025': // CMD JSON format
                    lines[lineIdx] = this.convertToJsonFormat(line);
                    break;

                case 'DL3014': // HEALTHCHECK
                    this.addHealthCheck(lines);
                    break;

                case 'DL3015': // WORKDIR
                    this.addWorkdir(lines);
                    break;
            }
        }

        return lines.join('\n');
    }

    /**
     * Fix helpers
     */
    private fixLatestTag(line: string): string {
        if (line.includes('node:latest')) {
            return line.replace('node:latest', 'node:20-alpine');
        } else if (line.includes('python:latest')) {
            return line.replace('python:latest', 'python:3.11-slim');
        } else if (line.includes('FROM ') && !line.includes(':')) {
            const parts = line.split(' ');
            parts[1] = `${parts[1]}:latest`;
            return parts.join(' ') + ' # TODO: Pin specific version';
        }
        return line;
    }

    private addUserDirective(lines: string[]): void {
        const cmdIdx = lines.findIndex(l => l.trim().toUpperCase().startsWith('CMD'));
        if (cmdIdx > 0) {
            lines.splice(cmdIdx, 0, '', '# Run as non-root user', 'USER nodejs');
        }
    }

    private addAptCleanup(line: string): string {
        if (!line.includes('rm -rf')) {
            return `${line} && rm -rf /var/lib/apt/lists/*`;
        }
        return line;
    }

    private convertToJsonFormat(line: string): string {
        const match = line.match(/^(CMD|ENTRYPOINT)\s+(.+)$/i);
        if (match) {
            const [, instruction, command] = match;
            const parts = command.trim().split(/\s+/);
            return `${instruction} [${parts.map(p => `"${p}"`).join(', ')}]`;
        }
        return line;
    }

    private addHealthCheck(lines: string[]): void {
        const cmdIdx = lines.findIndex(l => l.trim().toUpperCase().startsWith('CMD'));
        if (cmdIdx > 0) {
            lines.splice(cmdIdx, 0, '', '# Health check', 'HEALTHCHECK CMD curl -f http://localhost/ || exit 1');
        }
    }

    private addWorkdir(lines: string[]): void {
        const fromIdx = lines.findIndex(l => l.trim().toUpperCase().startsWith('FROM'));
        if (fromIdx >= 0) {
            lines.splice(fromIdx + 1, 0, '', 'WORKDIR /app');
        }
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[Linter] ${message}`);
        console.log(`[Linter] ${message}`);
    }
}

/**
 * Docker Compose Validator
 */
export class DockerComposeValidator {
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - Validator');
    }

    /**
     * Validate docker-compose.yml
     */
    async validateCompose(content: string): Promise<LintResult> {
        this.log('🔍 Validating docker-compose.yml...');

        const issues: LintIssue[] = [];

        try {
            // Parse YAML
            const parsed = yaml.load(content) as any;

            // Schema validation (already done by SchemaValidator)
            const schemaResult = SchemaValidator.validateDockerCompose(content);
            if (!schemaResult.valid) {
                schemaResult.errors?.forEach(error => {
                    issues.push({
                        code: 'DC001',
                        level: 'error',
                        message: error,
                        autoFixable: false
                    });
                });
            }

            // Semantic validation
            if (parsed && parsed.services) {
                this.checkCircularDependencies(parsed.services, issues);
                this.checkPortConflicts(parsed.services, issues);
                this.checkNetworkUsage(parsed, issues);
                this.checkVolumeUsage(parsed, issues);
                this.checkServiceConfiguration(parsed.services, issues);
                this.checkEnvironmentVariables(parsed.services, issues);
                this.checkResourceLimits(parsed.services, issues);
            }

        } catch (error) {
            issues.push({
                code: 'DC000',
                level: 'error',
                message: `YAML parse error: ${error instanceof Error ? error.message : String(error)}`,
                autoFixable: false
            });
        }

        const errors = issues.filter(i => i.level === 'error');
        const warnings = issues.filter(i => i.level === 'warning');
        const infos = issues.filter(i => i.level === 'info');

        const score = this.calculateScore(errors.length, warnings.length, infos.length);

        this.log(`✅ Validation complete: ${errors.length} errors, ${warnings.length} warnings`);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            infos,
            totalIssues: issues.length,
            score
        };
    }

    /**
     * Check for circular dependencies
     */
    private checkCircularDependencies(services: any, issues: LintIssue[]): void {
        const graph = new Map<string, string[]>();

        // Build dependency graph
        for (const [name, service] of Object.entries(services)) {
            const deps: string[] = [];
            if ((service as any).depends_on) {
                if (Array.isArray((service as any).depends_on)) {
                    deps.push(...(service as any).depends_on);
                } else {
                    deps.push(...Object.keys((service as any).depends_on));
                }
            }
            graph.set(name, deps);
        }

        // Detect cycles
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycle = (node: string): boolean => {
            visited.add(node);
            recStack.add(node);

            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (hasCycle(neighbor)) return true;
                } else if (recStack.has(neighbor)) {
                    issues.push({
                        code: 'DC010',
                        level: 'error',
                        message: `Circular dependency detected involving service: ${node}`,
                        autoFixable: false
                    });
                    return true;
                }
            }

            recStack.delete(node);
            return false;
        };

        for (const node of graph.keys()) {
            if (!visited.has(node)) {
                hasCycle(node);
            }
        }
    }

    /**
     * Check for port conflicts
     */
    private checkPortConflicts(services: any, issues: LintIssue[]): void {
        const portMap = new Map<string, string[]>();

        for (const [name, service] of Object.entries(services)) {
            const ports = (service as any).ports || [];
            
            ports.forEach((port: string) => {
                const hostPort = port.toString().split(':')[0];
                if (!portMap.has(hostPort)) {
                    portMap.set(hostPort, []);
                }
                portMap.get(hostPort)!.push(name);
            });
        }

        portMap.forEach((serviceNames, port) => {
            if (serviceNames.length > 1) {
                issues.push({
                    code: 'DC020',
                    level: 'error',
                    message: `Port conflict: ${port} is used by multiple services: ${serviceNames.join(', ')}`,
                    autoFixable: false
                });
            }
        });
    }

    /**
     * Check network usage
     */
    private checkNetworkUsage(compose: any, issues: LintIssue[]): void {
        const declaredNetworks = new Set(Object.keys(compose.networks || {}));
        const usedNetworks = new Set<string>();

        for (const [name, service] of Object.entries(compose.services || {})) {
            const networks = (service as any).networks || [];
            const networkList = Array.isArray(networks) ? networks : Object.keys(networks);
            
            networkList.forEach((net: string) => {
                usedNetworks.add(net);
                if (net !== 'default' && !declaredNetworks.has(net)) {
                    issues.push({
                        code: 'DC030',
                        level: 'error',
                        message: `Service ${name} references undefined network: ${net}`,
                        autoFixable: false
                    });
                }
            });
        }

        // Check for unused networks
        declaredNetworks.forEach(net => {
            if (!usedNetworks.has(net)) {
                issues.push({
                    code: 'DC031',
                    level: 'warning',
                    message: `Network ${net} is declared but not used by any service`,
                    autoFixable: false
                });
            }
        });
    }

    /**
     * Check volume usage
     */
    private checkVolumeUsage(compose: any, issues: LintIssue[]): void {
        const declaredVolumes = new Set(Object.keys(compose.volumes || {}));
        const usedVolumes = new Set<string>();

        for (const [name, service] of Object.entries(compose.services || {})) {
            const volumes = (service as any).volumes || [];
            
            volumes.forEach((vol: string) => {
                const volumeName = vol.split(':')[0];
                if (!volumeName.startsWith('.') && !volumeName.startsWith('/')) {
                    usedVolumes.add(volumeName);
                    if (!declaredVolumes.has(volumeName)) {
                        issues.push({
                            code: 'DC040',
                            level: 'warning',
                            message: `Service ${name} references undeclared volume: ${volumeName}`,
                            suggestion: 'Declare volume in top-level volumes section',
                            autoFixable: false
                        });
                    }
                }
            });
        }
    }

    /**
     * Check service configuration
     */
    private checkServiceConfiguration(services: any, issues: LintIssue[]): void {
        for (const [name, service] of Object.entries(services)) {
            const svc = service as any;

            // Check for both build and image
            if (svc.build && svc.image) {
                issues.push({
                    code: 'DC050',
                    level: 'warning',
                    message: `Service ${name} has both build and image. Image will be ignored.`,
                    autoFixable: false
                });
            }

            // Check restart policy
            if (!svc.restart) {
                issues.push({
                    code: 'DC051',
                    level: 'info',
                    message: `Service ${name} has no restart policy. Consider adding restart: unless-stopped`,
                    autoFixable: true
                });
            }

            // Check for healthcheck
            if (!svc.healthcheck) {
                issues.push({
                    code: 'DC052',
                    level: 'info',
                    message: `Service ${name} has no health check configured`,
                    autoFixable: false
                });
            }
        }
    }

    /**
     * Check environment variables
     */
    private checkEnvironmentVariables(services: any, issues: LintIssue[]): void {
        for (const [name, service] of Object.entries(services)) {
            const env = (service as any).environment || {};
            
            if (typeof env === 'object' && !Array.isArray(env)) {
                Object.entries(env).forEach(([key, value]) => {
                    // Check for empty values
                    if (!value || value === '') {
                        issues.push({
                            code: 'DC060',
                            level: 'warning',
                            message: `Service ${name} has empty environment variable: ${key}`,
                            suggestion: 'Define value or use .env file',
                            autoFixable: false
                        });
                    }

                    // Check for secrets in env
                    if (/password|secret|key|token/i.test(key.toLowerCase())) {
                        issues.push({
                            code: 'DC061',
                            level: 'warning',
                            message: `Service ${name} may expose sensitive data in environment variable: ${key}`,
                            suggestion: 'Use Docker secrets or .env file',
                            autoFixable: false
                        });
                    }
                });
            }
        }
    }

    /**
     * Check resource limits
     */
    private checkResourceLimits(services: any, issues: LintIssue[]): void {
        for (const [name, service] of Object.entries(services)) {
            const deploy = (service as any).deploy;
            
            if (!deploy || !deploy.resources) {
                issues.push({
                    code: 'DC070',
                    level: 'info',
                    message: `Service ${name} has no resource limits configured`,
                    suggestion: 'Add deploy.resources.limits for production',
                    autoFixable: false
                });
            }
        }
    }

    private calculateScore(errors: number, warnings: number, infos: number): number {
        let score = 100;
        score -= errors * 15;
        score -= warnings * 5;
        score -= infos * 1;
        return Math.max(0, score);
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[Validator] ${message}`);
        console.log(`[Validator] ${message}`);
    }
}

/**
 * Nginx Config Validator
 */
export class NginxConfigValidator {
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - Nginx');
    }

    /**
     * Validate nginx configuration
     */
    async validateConfig(content: string): Promise<LintResult> {
        this.log('🔍 Validating nginx.conf...');

        const issues: LintIssue[] = [];

        // Basic syntax checks
        this.checkServerBlocks(content, issues);
        this.checkLocationBlocks(content, issues);
        this.checkSecurityHeaders(content, issues);
        this.checkSSLConfiguration(content, issues);
        this.checkProxySettings(content, issues);

        const errors = issues.filter(i => i.level === 'error');
        const warnings = issues.filter(i => i.level === 'warning');
        const infos = issues.filter(i => i.level === 'info');

        const score = this.calculateScore(errors.length, warnings.length, infos.length);

        this.log(`✅ Validation complete: ${errors.length} errors, ${warnings.length} warnings`);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            infos,
            totalIssues: issues.length,
            score
        };
    }

    private checkServerBlocks(content: string, issues: LintIssue[]): void {
        if (!content.includes('server {')) {
            issues.push({
                code: 'NG001',
                level: 'error',
                message: 'nginx.conf must contain at least one server block',
                autoFixable: false
            });
        }
    }

    private checkLocationBlocks(content: string, issues: LintIssue[]): void {
        if (!content.includes('location')) {
            issues.push({
                code: 'NG002',
                level: 'warning',
                message: 'No location blocks found in nginx configuration',
                autoFixable: false
            });
        }
    }

    private checkSecurityHeaders(content: string, issues: LintIssue[]): void {
        const securityHeaders = [
            { name: 'X-Frame-Options', code: 'NG010' },
            { name: 'X-Content-Type-Options', code: 'NG011' },
            { name: 'X-XSS-Protection', code: 'NG012' }
        ];

        securityHeaders.forEach(header => {
            if (!content.includes(header.name)) {
                issues.push({
                    code: header.code,
                    level: 'warning',
                    message: `Missing security header: ${header.name}`,
                    suggestion: `add_header ${header.name} "SAMEORIGIN";`,
                    autoFixable: true
                });
            }
        });
    }

    private checkSSLConfiguration(content: string, issues: LintIssue[]): void {
        if (content.includes('listen 443') || content.includes('ssl')) {
            if (!content.includes('ssl_protocols')) {
                issues.push({
                    code: 'NG020',
                    level: 'warning',
                    message: 'SSL enabled but no ssl_protocols specified',
                    suggestion: 'ssl_protocols TLSv1.2 TLSv1.3;',
                    autoFixable: false
                });
            }

            if (!content.includes('ssl_ciphers')) {
                issues.push({
                    code: 'NG021',
                    level: 'info',
                    message: 'Consider specifying ssl_ciphers for better security',
                    autoFixable: false
                });
            }
        }
    }

    private checkProxySettings(content: string, issues: LintIssue[]): void {
        if (content.includes('proxy_pass')) {
            if (!content.includes('proxy_set_header Host')) {
                issues.push({
                    code: 'NG030',
                    level: 'warning',
                    message: 'Using proxy_pass without proxy_set_header Host',
                    suggestion: 'proxy_set_header Host $host;',
                    autoFixable: true
                });
            }

            if (!content.includes('proxy_set_header X-Real-IP')) {
                issues.push({
                    code: 'NG031',
                    level: 'info',
                    message: 'Consider adding X-Real-IP header for proxied requests',
                    autoFixable: false
                });
            }
        }
    }

    private calculateScore(errors: number, warnings: number, infos: number): number {
        let score = 100;
        score -= errors * 15;
        score -= warnings * 5;
        score -= infos * 1;
        return Math.max(0, score);
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[Nginx] ${message}`);
        console.log(`[Nginx] ${message}`);
    }
}

/**
 * Main Static Analysis Service
 */
export class StaticAnalysisService {
    private dockerfileLinter: DockerfileLinter;
    private composeValidator: DockerComposeValidator;
    private nginxValidator: NginxConfigValidator;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel?: vscode.OutputChannel) {
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Auto Docker - Static Analysis');
        this.dockerfileLinter = new DockerfileLinter(outputChannel);
        this.composeValidator = new DockerComposeValidator(outputChannel);
        this.nginxValidator = new NginxConfigValidator(outputChannel);
    }

    /**
     * Analyze all Docker files
     */
    async analyzeAll(files: DockerFiles): Promise<AnalysisReport> {
        this.log('🔍 Starting comprehensive static analysis...');

        const [dockerfileResult, composeResult, nginxResult] = await Promise.all([
            this.dockerfileLinter.lintDockerfile(files.dockerfile),
            this.composeValidator.validateCompose(files.dockerCompose),
            files.nginxConf ? this.nginxValidator.validateConfig(files.nginxConf) : null
        ]);

        const report: AnalysisReport = {
            dockerfile: dockerfileResult,
            dockerCompose: composeResult,
            nginxConf: nginxResult || undefined,
            overall: {
                valid: dockerfileResult.valid && composeResult.valid && (nginxResult?.valid !== false),
                score: Math.round((dockerfileResult.score + composeResult.score + (nginxResult?.score || 100)) / (nginxResult ? 3 : 2)),
                criticalIssues: dockerfileResult.errors.length + composeResult.errors.length + (nginxResult?.errors.length || 0),
                autoFixableIssues: this.countAutoFixable([dockerfileResult, composeResult, nginxResult])
            }
        };

        this.log(`✅ Analysis complete. Overall score: ${report.overall.score}/100`);

        return report;
    }

    /**
     * Auto-fix issues
     */
    async autoFix(files: DockerFiles, report: AnalysisReport): Promise<DockerFiles> {
        this.log('🔧 Attempting auto-fix...');

        const fixedFiles = { ...files };

        // Fix Dockerfile issues
        if (report.dockerfile.errors.length > 0 || report.dockerfile.warnings.length > 0) {
            const allIssues = [...report.dockerfile.errors, ...report.dockerfile.warnings];
            fixedFiles.dockerfile = await this.dockerfileLinter.autoFix(files.dockerfile, allIssues);
        }

        this.log('✅ Auto-fix complete');

        return fixedFiles;
    }

    /**
     * Generate report
     */
    generateReport(report: AnalysisReport): string {
        const lines: string[] = [];

        lines.push('📊 Static Analysis Report');
        lines.push('='.repeat(60));
        lines.push('');

        // Overall summary
        lines.push(`Overall Score: ${report.overall.score}/100`);
        lines.push(`Status: ${report.overall.valid ? '✅ PASSED' : '❌ FAILED'}`);
        lines.push(`Critical Issues: ${report.overall.criticalIssues}`);
        lines.push(`Auto-fixable Issues: ${report.overall.autoFixableIssues}`);
        lines.push('');

        // Dockerfile
        lines.push('📄 Dockerfile Analysis:');
        lines.push(`  Score: ${report.dockerfile.score}/100`);
        lines.push(`  Errors: ${report.dockerfile.errors.length}`);
        lines.push(`  Warnings: ${report.dockerfile.warnings.length}`);
        lines.push(`  Info: ${report.dockerfile.infos.length}`);
        if (report.dockerfile.errors.length > 0) {
            lines.push('  Issues:');
            report.dockerfile.errors.forEach(e => {
                lines.push(`    - [${e.code}] ${e.message}${e.line ? ` (line ${e.line})` : ''}`);
            });
        }
        lines.push('');

        // Docker Compose
        lines.push('🐳 docker-compose.yml Analysis:');
        lines.push(`  Score: ${report.dockerCompose.score}/100`);
        lines.push(`  Errors: ${report.dockerCompose.errors.length}`);
        lines.push(`  Warnings: ${report.dockerCompose.warnings.length}`);
        if (report.dockerCompose.errors.length > 0) {
            lines.push('  Issues:');
            report.dockerCompose.errors.forEach(e => {
                lines.push(`    - [${e.code}] ${e.message}`);
            });
        }
        lines.push('');

        // Nginx (if present)
        if (report.nginxConf) {
            lines.push('🌐 nginx.conf Analysis:');
            lines.push(`  Score: ${report.nginxConf.score}/100`);
            lines.push(`  Errors: ${report.nginxConf.errors.length}`);
            lines.push(`  Warnings: ${report.nginxConf.warnings.length}`);
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Show analysis results to user
     */
    async showAnalysisResults(report: AnalysisReport): Promise<void> {
        const reportText = this.generateReport(report);
        this.outputChannel.show();
        this.outputChannel.appendLine(reportText);

        if (report.overall.criticalIssues > 0) {
            const action = await vscode.window.showWarningMessage(
                `Static analysis found ${report.overall.criticalIssues} critical issues. View report?`,
                'View Report',
                'Auto-fix',
                'Continue Anyway'
            );

            if (action === 'View Report') {
                this.outputChannel.show();
            }
            return;
        }

        if (report.overall.score < 80) {
            vscode.window.showInformationMessage(
                `Static analysis score: ${report.overall.score}/100. Check output for details.`,
                'View Report'
            ).then(action => {
                if (action === 'View Report') {
                    this.outputChannel.show();
                }
            });
        }
    }

    /**
     * Check if static analysis should run
     */
    static shouldRunAnalysis(): boolean {
        const config = vscode.workspace.getConfiguration('autoDocker');
        return config.get<boolean>('enableStaticAnalysis', true);
    }

    private countAutoFixable(results: (LintResult | null)[]): number {
        let count = 0;
        results.forEach(result => {
            if (result) {
                count += [...result.errors, ...result.warnings]
                    .filter(i => i.autoFixable)
                    .length;
            }
        });
        return count;
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[Static Analysis] ${message}`);
        console.log(`[Static Analysis] ${message}`);
    }
}
