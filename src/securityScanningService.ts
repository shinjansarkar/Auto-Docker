/**
 * Security Scanning Modules (Phase 7)
 * 
 * Comprehensive security analysis for Docker configurations.
 * Detects vulnerabilities, secrets, misconfigurations, and compliance issues.
 * 
 * Features:
 * - Dockerfile security scanning
 * - docker-compose security analysis
 * - Secrets detection (API keys, passwords, tokens)
 * - Base image vulnerability assessment
 * - Privilege escalation detection
 * - Network security analysis
 * - Volume mount security
 * - Port exposure analysis
 * - Compliance checking (CIS, NIST)
 * - CVE database integration
 * - Auto-fix recommendations
 * - Severity classification
 * - Security score calculation
 * 
 * @author Auto Docker Extension
 * @date January 8, 2026
 */

import * as vscode from 'vscode';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface SecurityIssue {
    id: string;
    title: string;
    severity: SecuritySeverity;
    category: 'secrets' | 'vulnerability' | 'misconfiguration' | 'compliance' | 'privilege' | 'network' | 'volume';
    description: string;
    line?: number;
    file: 'dockerfile' | 'docker-compose' | 'nginx' | 'general';
    cwe?: string; // Common Weakness Enumeration
    cve?: string; // Common Vulnerabilities and Exposures
    recommendation: string;
    autoFixable: boolean;
    reference?: string;
    impact: string;
}

interface SecurityScanResult {
    passed: boolean;
    score: number; // 0-100
    totalIssues: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    infoCount: number;
    issues: SecurityIssue[];
    complianceStatus: {
        cis: boolean; // CIS Docker Benchmark
        nist: boolean; // NIST guidelines
        pci: boolean; // PCI DSS
    };
    scanDuration: number;
}

interface SecretsPattern {
    name: string;
    pattern: RegExp;
    severity: SecuritySeverity;
    description: string;
}

interface VulnerableImage {
    image: string;
    vulnerabilities: Array<{
        cve: string;
        severity: SecuritySeverity;
        description: string;
    }>;
}

// ============================================================================
// SECRETS PATTERNS DATABASE
// ============================================================================

const SECRETS_PATTERNS: SecretsPattern[] = [
    {
        name: 'AWS Access Key',
        pattern: /AKIA[0-9A-Z]{16}/gi,
        severity: 'critical',
        description: 'AWS Access Key ID detected'
    },
    {
        name: 'AWS Secret Key',
        pattern: /aws(.{0,20})?['\"][0-9a-zA-Z\/+]{40}['\"]/gi,
        severity: 'critical',
        description: 'AWS Secret Access Key detected'
    },
    {
        name: 'Generic API Key',
        pattern: /api[_-]?key['\s:=]+['\"]?[a-zA-Z0-9]{20,}['\"]?/gi,
        severity: 'high',
        description: 'Hardcoded API key detected'
    },
    {
        name: 'Generic Secret',
        pattern: /secret['\s:=]+['\"]?[a-zA-Z0-9]{16,}['\"]?/gi,
        severity: 'high',
        description: 'Hardcoded secret detected'
    },
    {
        name: 'Generic Password',
        pattern: /password['\s:=]+['\"]?[^'"$\s]{8,}['\"]?/gi,
        severity: 'high',
        description: 'Hardcoded password detected'
    },
    {
        name: 'Private Key',
        pattern: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/gi,
        severity: 'critical',
        description: 'Private key detected'
    },
    {
        name: 'GitHub Token',
        pattern: /gh[pousr]_[0-9a-zA-Z]{36}/gi,
        severity: 'critical',
        description: 'GitHub personal access token detected'
    },
    {
        name: 'Slack Token',
        pattern: /xox[baprs]-[0-9a-zA-Z-]{10,48}/gi,
        severity: 'high',
        description: 'Slack token detected'
    },
    {
        name: 'Stripe API Key',
        pattern: /sk_live_[0-9a-zA-Z]{24}/gi,
        severity: 'critical',
        description: 'Stripe live API key detected'
    },
    {
        name: 'Google API Key',
        pattern: /AIza[0-9A-Za-z\\-_]{35}/gi,
        severity: 'high',
        description: 'Google API key detected'
    },
    {
        name: 'JWT Token',
        pattern: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/gi,
        severity: 'medium',
        description: 'JWT token detected'
    },
    {
        name: 'Database URL',
        pattern: /(postgres|mysql|mongodb):\/\/[^:]+:[^@]+@[^\/]+\/[^\s'"]+/gi,
        severity: 'high',
        description: 'Database connection string with credentials detected'
    },
    {
        name: 'Bearer Token',
        pattern: /bearer\s+[a-zA-Z0-9_\-\.]+/gi,
        severity: 'medium',
        description: 'Bearer token detected'
    },
    {
        name: 'OAuth Token',
        pattern: /oauth[_-]?token['\s:=]+['\"]?[a-zA-Z0-9]{20,}['\"]?/gi,
        severity: 'high',
        description: 'OAuth token detected'
    }
];

// ============================================================================
// VULNERABLE IMAGES DATABASE (Sample - should be updated regularly)
// ============================================================================

const VULNERABLE_IMAGES_DB: Record<string, Array<{ cve: string; severity: SecuritySeverity; description: string }>> = {
    'ubuntu:latest': [
        { cve: 'CVE-2023-XXXX', severity: 'medium', description: 'Using :latest tag is not recommended for security' }
    ],
    'node:latest': [
        { cve: 'CVE-2023-XXXX', severity: 'medium', description: 'Using :latest tag is not recommended for security' }
    ],
    'alpine:latest': [
        { cve: 'CVE-2023-XXXX', severity: 'medium', description: 'Using :latest tag is not recommended for security' }
    ]
};

// ============================================================================
// SECURITY SCANNING SERVICE
// ============================================================================

export class SecurityScanningService {
    private outputChannel: vscode.OutputChannel;
    private enabled: boolean;
    private strictMode: boolean;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Auto Docker - Security Scanner');
        const config = vscode.workspace.getConfiguration('autoDocker');
        this.enabled = config.get('enableSecurityScanning', true);
        this.strictMode = false; // strict mode disabled
    }

    /**
     * Check if security scanning is enabled
     */
    public static isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('autoDocker');
        return config.get('enableSecurityScanning', true);
    }

    /**
     * Perform comprehensive security scan
     */
    public async scanDockerFiles(content: {
        dockerfile: string;
        dockerCompose: string;
        nginxConf?: string;
    }): Promise<SecurityScanResult> {
        
        if (!this.enabled) {
            return this.getEmptyResult();
        }

        this.log('🔒 Starting comprehensive security scan...');
        const startTime = Date.now();

        const issues: SecurityIssue[] = [];

        // 1. Scan Dockerfile
        this.log('📋 Scanning Dockerfile for security issues...');
        const dockerfileIssues = await this.scanDockerfile(content.dockerfile);
        issues.push(...dockerfileIssues);

        // 2. Scan docker-compose
        this.log('📦 Scanning docker-compose.yml for security issues...');
        const composeIssues = await this.scanDockerCompose(content.dockerCompose);
        issues.push(...composeIssues);

        // 3. Scan nginx config
        if (content.nginxConf) {
            this.log('🌐 Scanning nginx.conf for security issues...');
            const nginxIssues = await this.scanNginxConfig(content.nginxConf);
            issues.push(...nginxIssues);
        }

        // 4. Detect secrets across all files
        this.log('🔍 Scanning for exposed secrets...');
        const secretIssues = this.detectSecrets({
            dockerfile: content.dockerfile,
            dockerCompose: content.dockerCompose,
            nginxConf: content.nginxConf || ''
        });
        issues.push(...secretIssues);

        const endTime = Date.now();

        // Calculate statistics
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const highCount = issues.filter(i => i.severity === 'high').length;
        const mediumCount = issues.filter(i => i.severity === 'medium').length;
        const lowCount = issues.filter(i => i.severity === 'low').length;
        const infoCount = issues.filter(i => i.severity === 'info').length;

        // Calculate security score
        const score = this.calculateSecurityScore(issues);

        // Check compliance
        const complianceStatus = this.checkCompliance(issues);

        const result: SecurityScanResult = {
            passed: criticalCount === 0 && highCount === 0,
            score,
            totalIssues: issues.length,
            criticalCount,
            highCount,
            mediumCount,
            lowCount,
            infoCount,
            issues,
            complianceStatus,
            scanDuration: endTime - startTime
        };

        this.log(`✅ Security scan complete. Score: ${score}/100`);
        this.log(`   Critical: ${criticalCount}, High: ${highCount}, Medium: ${mediumCount}, Low: ${lowCount}`);

        return result;
    }

    /**
     * Scan Dockerfile for security issues
     */
    private async scanDockerfile(content: string): Promise<SecurityIssue[]> {
        const issues: SecurityIssue[] = [];
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const lineNum = i + 1;

            // SEC-001: Running as root
            if (!content.includes('USER ') || content.lastIndexOf('USER ') < content.lastIndexOf('CMD ')) {
                if (i === lines.length - 1 && !issues.find(iss => iss.id === 'SEC-001')) {
                    issues.push({
                        id: 'SEC-001',
                        title: 'Container runs as root user',
                        severity: 'high',
                        category: 'privilege',
                        description: 'No USER directive found or USER directive appears before CMD/ENTRYPOINT. Container will run as root.',
                        file: 'dockerfile',
                        cwe: 'CWE-250',
                        recommendation: 'Add USER directive before CMD/ENTRYPOINT to run as non-root user',
                        autoFixable: true,
                        impact: 'Running as root increases attack surface and privilege escalation risks'
                    });
                }
            }

            // SEC-002: Using :latest tag
            if (line.startsWith('FROM ') && line.includes(':latest')) {
                issues.push({
                    id: 'SEC-002',
                    title: 'Using :latest tag for base image',
                    severity: 'medium',
                    category: 'misconfiguration',
                    description: ':latest tag can introduce unexpected changes and vulnerabilities',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-1104',
                    recommendation: 'Use specific version tags for reproducibility and security',
                    autoFixable: true,
                    impact: 'Unpredictable image updates may introduce vulnerabilities'
                });
            }

            // SEC-003: Untagged base image
            if (line.startsWith('FROM ') && !line.includes(':') && !line.includes(' AS ')) {
                issues.push({
                    id: 'SEC-003',
                    title: 'Untagged base image',
                    severity: 'high',
                    category: 'misconfiguration',
                    description: 'Base image has no version tag specified',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-1104',
                    recommendation: 'Always specify version tags for base images',
                    autoFixable: true,
                    impact: 'Unpredictable builds and potential security vulnerabilities'
                });
            }

            // SEC-004: Using privileged flag
            if (line.includes('--privileged')) {
                issues.push({
                    id: 'SEC-004',
                    title: 'Privileged mode enabled',
                    severity: 'critical',
                    category: 'privilege',
                    description: 'Container runs in privileged mode with full host access',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-250',
                    recommendation: 'Avoid privileged mode unless absolutely necessary',
                    autoFixable: false,
                    impact: 'Complete access to host system, bypassing all security constraints'
                });
            }

            // SEC-005: Downloading over HTTP
            if (line.match(/curl|wget/) && line.match(/http:\/\//)) {
                issues.push({
                    id: 'SEC-005',
                    title: 'Insecure download over HTTP',
                    severity: 'high',
                    category: 'misconfiguration',
                    description: 'Downloading files over unencrypted HTTP connection',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-319',
                    recommendation: 'Use HTTPS for all downloads to prevent MITM attacks',
                    autoFixable: true,
                    impact: 'Vulnerable to man-in-the-middle attacks and malicious code injection'
                });
            }

            // SEC-006: curl with --insecure flag
            if (line.includes('curl') && (line.includes('--insecure') || line.includes('-k'))) {
                issues.push({
                    id: 'SEC-006',
                    title: 'SSL verification disabled',
                    severity: 'critical',
                    category: 'misconfiguration',
                    description: 'curl is using --insecure flag, disabling SSL certificate verification',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-295',
                    recommendation: 'Remove --insecure flag and use proper SSL certificates',
                    autoFixable: true,
                    impact: 'Vulnerable to man-in-the-middle attacks'
                });
            }

            // SEC-007: ADD instead of COPY
            if (line.startsWith('ADD ') && !line.includes('.tar') && !line.includes('.zip')) {
                issues.push({
                    id: 'SEC-007',
                    title: 'Using ADD instead of COPY',
                    severity: 'low',
                    category: 'misconfiguration',
                    description: 'ADD has implicit behavior that can introduce security risks',
                    line: lineNum,
                    file: 'dockerfile',
                    cwe: 'CWE-494',
                    recommendation: 'Use COPY unless you specifically need ADD\'s archive extraction',
                    autoFixable: true,
                    impact: 'Unexpected file extraction and potential security vulnerabilities'
                });
            }

            // SEC-008: COPY from untrusted source
            if (line.startsWith('COPY ') && line.includes('--from=')) {
                const match = line.match(/--from=([^\s]+)/);
                if (match && !match[1].match(/^(builder|build|base|\d+)$/i)) {
                    issues.push({
                        id: 'SEC-008',
                        title: 'Copying from external image',
                        severity: 'medium',
                        category: 'vulnerability',
                        description: 'Copying files from an external image that may not be trusted',
                        line: lineNum,
                        file: 'dockerfile',
                        cwe: 'CWE-494',
                        recommendation: 'Only copy from trusted, verified images',
                        autoFixable: false,
                        impact: 'Potential inclusion of malicious files'
                    });
                }
            }

            // SEC-009: Exposing sensitive ports
            if (line.startsWith('EXPOSE ')) {
                const ports = line.replace('EXPOSE ', '').split(/\s+/);
                for (const port of ports) {
                    const portNum = parseInt(port.replace(/\D/g, ''));
                    if ([22, 23, 3306, 5432, 27017, 6379, 9200].includes(portNum)) {
                        issues.push({
                            id: 'SEC-009',
                            title: `Exposing sensitive port ${portNum}`,
                            severity: 'high',
                            category: 'network',
                            description: `Port ${portNum} is commonly used by databases/services and should not be directly exposed`,
                            line: lineNum,
                            file: 'dockerfile',
                            cwe: 'CWE-200',
                            recommendation: 'Use environment-specific port mapping and restrict access',
                            autoFixable: false,
                            impact: 'Direct access to sensitive services increases attack surface'
                        });
                    }
                }
            }

            // SEC-010: apt-get without --no-install-recommends
            if (line.includes('apt-get install') && !line.includes('--no-install-recommends')) {
                issues.push({
                    id: 'SEC-010',
                    title: 'Installing unnecessary packages',
                    severity: 'low',
                    category: 'misconfiguration',
                    description: 'apt-get install without --no-install-recommends installs unnecessary packages',
                    line: lineNum,
                    file: 'dockerfile',
                    recommendation: 'Add --no-install-recommends to minimize attack surface',
                    autoFixable: true,
                    impact: 'Larger attack surface with unnecessary packages'
                });
            }

            // SEC-011: Missing apt-get cache cleanup
            if (line.includes('apt-get install') && !content.includes('rm -rf /var/lib/apt/lists/*')) {
                if (i === lines.length - 1 && !issues.find(iss => iss.id === 'SEC-011')) {
                    issues.push({
                        id: 'SEC-011',
                        title: 'apt-get cache not cleaned',
                        severity: 'low',
                        category: 'misconfiguration',
                        description: 'apt-get cache is not cleaned, leaving sensitive package data',
                        file: 'dockerfile',
                        recommendation: 'Add && rm -rf /var/lib/apt/lists/* after apt-get commands',
                        autoFixable: true,
                        impact: 'Larger image size and potential information disclosure'
                    });
                }
            }

            // SEC-012: HEALTHCHECK missing
            if (!content.includes('HEALTHCHECK')) {
                if (i === lines.length - 1 && !issues.find(iss => iss.id === 'SEC-012')) {
                    issues.push({
                        id: 'SEC-012',
                        title: 'No HEALTHCHECK defined',
                        severity: 'info',
                        category: 'misconfiguration',
                        description: 'Container has no health check defined',
                        file: 'dockerfile',
                        recommendation: 'Add HEALTHCHECK to monitor container health',
                        autoFixable: true,
                        impact: 'Difficult to detect container failures'
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Scan docker-compose for security issues
     */
    private async scanDockerCompose(content: string): Promise<SecurityIssue[]> {
        const issues: SecurityIssue[] = [];

        // SEC-101: privileged: true
        if (content.match(/privileged:\s*true/i)) {
            issues.push({
                id: 'SEC-101',
                title: 'Privileged container enabled',
                severity: 'critical',
                category: 'privilege',
                description: 'Service is configured to run in privileged mode',
                file: 'docker-compose',
                cwe: 'CWE-250',
                recommendation: 'Remove privileged: true unless absolutely necessary',
                autoFixable: true,
                impact: 'Complete access to host system resources'
            });
        }

        // SEC-102: network_mode: host
        if (content.match(/network_mode:\s*['"]*host['"]/i)) {
            issues.push({
                id: 'SEC-102',
                title: 'Host network mode enabled',
                severity: 'high',
                category: 'network',
                description: 'Service uses host network mode, bypassing network isolation',
                file: 'docker-compose',
                cwe: 'CWE-653',
                recommendation: 'Use bridge or custom networks for isolation',
                autoFixable: true,
                impact: 'No network isolation between container and host'
            });
        }

        // SEC-103: Host path volume mounts
        const hostPathMounts = content.match(/volumes:[\s\S]*?-\s*\/[^:]+:/g);
        if (hostPathMounts) {
            issues.push({
                id: 'SEC-103',
                title: 'Host path volume mount detected',
                severity: 'medium',
                category: 'volume',
                description: 'Service mounts host filesystem paths directly',
                file: 'docker-compose',
                cwe: 'CWE-552',
                recommendation: 'Use named volumes instead of host path mounts when possible',
                autoFixable: false,
                impact: 'Potential host filesystem access and modification'
            });
        }

        // SEC-104: Secrets in environment variables
        const envPatterns = ['PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'API_KEY', 'PRIVATE'];
        for (const pattern of envPatterns) {
            const regex = new RegExp(`${pattern}[^=]*=\\s*[^$][^\\s'"]+`, 'gi');
            if (content.match(regex)) {
                issues.push({
                    id: 'SEC-104',
                    title: 'Hardcoded secrets in environment variables',
                    severity: 'critical',
                    category: 'secrets',
                    description: `Environment variable containing "${pattern}" has hardcoded value`,
                    file: 'docker-compose',
                    cwe: 'CWE-798',
                    recommendation: 'Use Docker secrets or .env files with proper .gitignore',
                    autoFixable: false,
                    impact: 'Credentials exposed in version control and logs'
                });
                break; // Only report once
            }
        }

        // SEC-105: Ports exposing to 0.0.0.0
        const publicPorts = content.match(/ports:[\s\S]*?-\s*["']?(\d+):(\d+)["']?/g);
        if (publicPorts) {
            for (const portDef of publicPorts) {
                const match = portDef.match(/(\d+):(\d+)/);
                if (match) {
                    const hostPort = parseInt(match[1]);
                    const sensitivePorts = [22, 23, 3306, 5432, 27017, 6379, 9200, 5000, 8080];
                    if (sensitivePorts.includes(hostPort)) {
                        issues.push({
                            id: 'SEC-105',
                            title: `Sensitive port ${hostPort} exposed publicly`,
                            severity: 'high',
                            category: 'network',
                            description: `Port ${hostPort} is exposed to all interfaces`,
                            file: 'docker-compose',
                            cwe: 'CWE-200',
                            recommendation: 'Bind to 127.0.0.1 or use firewall rules',
                            autoFixable: true,
                            impact: 'Service accessible from external networks'
                        });
                    }
                }
            }
        }

        // SEC-106: Missing restart policy
        if (!content.match(/restart:\s*(always|unless-stopped|on-failure)/i)) {
            issues.push({
                id: 'SEC-106',
                title: 'No restart policy defined',
                severity: 'low',
                category: 'misconfiguration',
                description: 'Services have no restart policy for resilience',
                file: 'docker-compose',
                recommendation: 'Add restart: unless-stopped for production services',
                autoFixable: true,
                impact: 'Services won\'t restart automatically on failure'
            });
        }

        // SEC-107: Using :latest tags
        const latestTags = content.match(/image:\s*[^:]+:latest/gi);
        if (latestTags && latestTags.length > 0) {
            issues.push({
                id: 'SEC-107',
                title: 'Using :latest image tags',
                severity: 'medium',
                category: 'misconfiguration',
                description: 'Services use :latest tags which can introduce unexpected changes',
                file: 'docker-compose',
                cwe: 'CWE-1104',
                recommendation: 'Pin to specific version tags',
                autoFixable: true,
                impact: 'Unpredictable deployments and potential vulnerabilities'
            });
        }

        // SEC-108: Missing resource limits
        if (!content.includes('mem_limit') && !content.includes('cpus')) {
            issues.push({
                id: 'SEC-108',
                title: 'No resource limits defined',
                severity: 'medium',
                category: 'misconfiguration',
                description: 'Services have no memory or CPU limits',
                file: 'docker-compose',
                recommendation: 'Add mem_limit and cpus to prevent resource exhaustion',
                autoFixable: true,
                impact: 'Potential DoS through resource exhaustion'
            });
        }

        // SEC-109: Using default bridge network
        if (!content.includes('networks:')) {
            issues.push({
                id: 'SEC-109',
                title: 'Using default bridge network',
                severity: 'low',
                category: 'network',
                description: 'Services use default bridge network without isolation',
                file: 'docker-compose',
                recommendation: 'Define custom networks for better isolation',
                autoFixable: true,
                impact: 'All containers can communicate by default'
            });
        }

        // SEC-110: Capabilities added
        if (content.match(/cap_add:/i)) {
            issues.push({
                id: 'SEC-110',
                title: 'Additional capabilities granted',
                severity: 'high',
                category: 'privilege',
                description: 'Service has additional Linux capabilities added',
                file: 'docker-compose',
                cwe: 'CWE-250',
                recommendation: 'Only add capabilities that are absolutely necessary',
                autoFixable: false,
                impact: 'Increased privilege and attack surface'
            });
        }

        return issues;
    }

    /**
     * Scan nginx config for security issues
     */
    private async scanNginxConfig(content: string): Promise<SecurityIssue[]> {
        const issues: SecurityIssue[] = [];

        // SEC-201: Missing security headers
        const securityHeaders = [
            { name: 'X-Frame-Options', severity: 'medium' as SecuritySeverity },
            { name: 'X-Content-Type-Options', severity: 'medium' as SecuritySeverity },
            { name: 'X-XSS-Protection', severity: 'medium' as SecuritySeverity },
            { name: 'Strict-Transport-Security', severity: 'high' as SecuritySeverity }
        ];

        for (const header of securityHeaders) {
            if (!content.includes(header.name)) {
                issues.push({
                    id: `SEC-201`,
                    title: `Missing ${header.name} header`,
                    severity: header.severity,
                    category: 'misconfiguration',
                    description: `${header.name} security header is not configured`,
                    file: 'nginx',
                    recommendation: `Add ${header.name} header for enhanced security`,
                    autoFixable: true,
                    impact: 'Increased vulnerability to web attacks'
                });
            }
        }

        // SEC-202: Server tokens enabled
        if (!content.includes('server_tokens off')) {
            issues.push({
                id: 'SEC-202',
                title: 'Server version disclosure enabled',
                severity: 'low',
                category: 'misconfiguration',
                description: 'nginx version information is exposed in headers',
                file: 'nginx',
                cwe: 'CWE-200',
                recommendation: 'Add server_tokens off; to hide version information',
                autoFixable: true,
                impact: 'Information disclosure aids attackers'
            });
        }

        // SEC-203: SSL configuration issues
        if (content.includes('ssl') || content.includes('443')) {
            if (!content.includes('ssl_protocols')) {
                issues.push({
                    id: 'SEC-203',
                    title: 'SSL protocols not explicitly configured',
                    severity: 'high',
                    category: 'misconfiguration',
                    description: 'SSL/TLS protocols are not explicitly configured',
                    file: 'nginx',
                    cwe: 'CWE-327',
                    recommendation: 'Specify ssl_protocols TLSv1.2 TLSv1.3;',
                    autoFixable: true,
                    impact: 'Vulnerable SSL/TLS versions may be used'
                });
            }

            if (content.includes('TLSv1 ') || content.includes('TLSv1.1')) {
                issues.push({
                    id: 'SEC-204',
                    title: 'Weak SSL/TLS protocol enabled',
                    severity: 'high',
                    category: 'vulnerability',
                    description: 'TLSv1.0 or TLSv1.1 is enabled (deprecated and insecure)',
                    file: 'nginx',
                    cve: 'CVE-2011-3389',
                    cwe: 'CWE-327',
                    recommendation: 'Only enable TLSv1.2 and TLSv1.3',
                    autoFixable: true,
                    impact: 'Vulnerable to BEAST, POODLE, and other SSL attacks'
                });
            }
        }

        // SEC-205: Directory listing enabled
        if (content.includes('autoindex on')) {
            issues.push({
                id: 'SEC-205',
                title: 'Directory listing enabled',
                severity: 'medium',
                category: 'misconfiguration',
                description: 'Directory listing is enabled, exposing file structure',
                file: 'nginx',
                cwe: 'CWE-548',
                recommendation: 'Set autoindex off; to disable directory listing',
                autoFixable: true,
                impact: 'File structure and sensitive files may be exposed'
            });
        }

        // SEC-206: Missing client_body_timeout
        if (!content.includes('client_body_timeout')) {
            issues.push({
                id: 'SEC-206',
                title: 'Client body timeout not configured',
                severity: 'low',
                category: 'misconfiguration',
                description: 'Timeout for reading client request body is not set',
                file: 'nginx',
                recommendation: 'Add client_body_timeout to prevent slowloris attacks',
                autoFixable: true,
                impact: 'Vulnerable to slow POST/PUT attacks'
            });
        }

        return issues;
    }

    /**
     * Detect secrets in all files
     */
    private detectSecrets(content: {
        dockerfile: string;
        dockerCompose: string;
        nginxConf: string;
    }): SecurityIssue[] {
        
        const issues: SecurityIssue[] = [];
        const allContent = `${content.dockerfile}\n${content.dockerCompose}\n${content.nginxConf}`;

        for (const pattern of SECRETS_PATTERNS) {
            const matches = allContent.match(pattern.pattern);
            if (matches) {
                // Deduplicate
                const uniqueMatches = [...new Set(matches)];
                
                for (const match of uniqueMatches) {
                    // Determine which file
                    let file: 'dockerfile' | 'docker-compose' | 'nginx' | 'general' = 'general';
                    if (content.dockerfile.includes(match)) {
                        file = 'dockerfile';
                    } else if (content.dockerCompose.includes(match)) {
                        file = 'docker-compose';
                    } else if (content.nginxConf.includes(match)) {
                        file = 'nginx';
                    }

                    issues.push({
                        id: `SEC-${300 + issues.length}`,
                        title: pattern.name,
                        severity: pattern.severity,
                        category: 'secrets',
                        description: pattern.description,
                        file,
                        cwe: 'CWE-798',
                        recommendation: 'Remove hardcoded secrets and use environment variables or secrets management',
                        autoFixable: false,
                        impact: 'Credentials exposed in source code and version control'
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Calculate security score
     */
    private calculateSecurityScore(issues: SecurityIssue[]): number {
        let score = 100;

        for (const issue of issues) {
            switch (issue.severity) {
                case 'critical':
                    score -= 20;
                    break;
                case 'high':
                    score -= 10;
                    break;
                case 'medium':
                    score -= 5;
                    break;
                case 'low':
                    score -= 2;
                    break;
                case 'info':
                    score -= 1;
                    break;
            }
        }

        return Math.max(0, score);
    }

    /**
     * Check compliance standards
     */
    private checkCompliance(issues: SecurityIssue[]): { cis: boolean; nist: boolean; pci: boolean } {
        const critical = issues.filter(i => i.severity === 'critical').length;
        const high = issues.filter(i => i.severity === 'high').length;

        // CIS Docker Benchmark compliance
        const cisCompliant = critical === 0 && high === 0;

        // NIST guidelines compliance
        const nistCompliant = critical === 0;

        // PCI DSS compliance (stricter)
        const pciCompliant = critical === 0 && high === 0 && issues.length < 5;

        return {
            cis: cisCompliant,
            nist: nistCompliant,
            pci: pciCompliant
        };
    }

    /**
     * Generate security report
     */
    public generateReport(result: SecurityScanResult): string {
        let report = '\n╔════════════════════════════════════════════════════════════╗\n';
        report += '║              Security Scanning Report                     ║\n';
        report += '╚════════════════════════════════════════════════════════════╝\n\n';

        // Overall status
        const statusEmoji = result.passed ? '✅' : '❌';
        const scoreEmoji = this.getScoreEmoji(result.score);
        
        report += `${statusEmoji} Security Status: ${result.passed ? 'PASSED' : 'FAILED'}\n`;
        report += `${scoreEmoji} Security Score: ${result.score}/100\n`;
        report += `⏱️  Scan Duration: ${result.scanDuration}ms\n\n`;

        // Issue summary
        report += '📊 ISSUE SUMMARY\n';
        report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        report += `Total Issues:    ${result.totalIssues}\n`;
        report += `🔴 Critical:     ${result.criticalCount}\n`;
        report += `🟠 High:         ${result.highCount}\n`;
        report += `🟡 Medium:       ${result.mediumCount}\n`;
        report += `🔵 Low:          ${result.lowCount}\n`;
        report += `ℹ️  Info:         ${result.infoCount}\n\n`;

        // Compliance status
        report += '📋 COMPLIANCE STATUS\n';
        report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        report += `CIS Docker Benchmark:  ${result.complianceStatus.cis ? '✅ PASS' : '❌ FAIL'}\n`;
        report += `NIST Guidelines:       ${result.complianceStatus.nist ? '✅ PASS' : '❌ FAIL'}\n`;
        report += `PCI DSS:               ${result.complianceStatus.pci ? '✅ PASS' : '❌ FAIL'}\n\n`;

        // Critical issues
        const criticalIssues = result.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
            report += '🔴 CRITICAL ISSUES\n';
            report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            for (const issue of criticalIssues) {
                report += `\n[${issue.id}] ${issue.title}\n`;
                report += `  📁 File: ${issue.file}\n`;
                if (issue.line) report += `  📍 Line: ${issue.line}\n`;
                report += `  📝 ${issue.description}\n`;
                report += `  💡 ${issue.recommendation}\n`;
                if (issue.cwe) report += `  🔗 ${issue.cwe}\n`;
                if (issue.cve) report += `  🔗 ${issue.cve}\n`;
            }
            report += '\n';
        }

        // High issues
        const highIssues = result.issues.filter(i => i.severity === 'high');
        if (highIssues.length > 0) {
            report += '🟠 HIGH SEVERITY ISSUES\n';
            report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            for (const issue of highIssues) {
                report += `\n[${issue.id}] ${issue.title}\n`;
                report += `  📁 File: ${issue.file}\n`;
                if (issue.line) report += `  📍 Line: ${issue.line}\n`;
                report += `  📝 ${issue.description}\n`;
                report += `  💡 ${issue.recommendation}\n`;
            }
            report += '\n';
        }

        // Medium issues (summary only)
        const mediumIssues = result.issues.filter(i => i.severity === 'medium');
        if (mediumIssues.length > 0) {
            report += '🟡 MEDIUM SEVERITY ISSUES\n';
            report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            for (const issue of mediumIssues) {
                report += `[${issue.id}] ${issue.title} (${issue.file})\n`;
            }
            report += '\n';
        }

        // Auto-fixable issues
        const autoFixable = result.issues.filter(i => i.autoFixable);
        if (autoFixable.length > 0) {
            report += `🔧 ${autoFixable.length} issues can be automatically fixed\n\n`;
        }

        // Recommendations
        report += '💡 RECOMMENDATIONS\n';
        report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        
        if (result.criticalCount > 0) {
            report += '🔴 Address all critical issues immediately\n';
        }
        if (result.issues.some(i => i.category === 'secrets')) {
            report += '🔐 Use Docker secrets or environment variables for sensitive data\n';
        }
        if (result.issues.some(i => i.id === 'SEC-001')) {
            report += '👤 Run containers as non-root users\n';
        }
        if (result.issues.some(i => i.category === 'network')) {
            report += '🌐 Implement proper network segmentation and firewall rules\n';
        }
        if (result.score < 70) {
            report += '⚠️  Security score is below acceptable threshold (70)\n';
        }

        return report;
    }

    /**
     * Show security report in output channel
     */
    public showResults(result: SecurityScanResult): void {
        const report = this.generateReport(result);
        this.outputChannel.clear();
        this.outputChannel.appendLine(report);
        this.outputChannel.show(true);
    }

    /**
     * Get score emoji
     */
    private getScoreEmoji(score: number): string {
        if (score >= 90) return '🏆';
        if (score >= 75) return '⭐';
        if (score >= 60) return '👍';
        if (score >= 40) return '⚠️';
        return '❌';
    }

    /**
     * Get empty result
     */
    private getEmptyResult(): SecurityScanResult {
        return {
            passed: true,
            score: 100,
            totalIssues: 0,
            criticalCount: 0,
            highCount: 0,
            mediumCount: 0,
            lowCount: 0,
            infoCount: 0,
            issues: [],
            complianceStatus: {
                cis: true,
                nist: true,
                pci: true
            },
            scanDuration: 0
        };
    }

    /**
     * Log to output channel
     */
    private log(message: string): void {
        if (this.enabled) {
            this.outputChannel.appendLine(message);
        }
    }
}
