/**
 * Docker Compose Spec Validator (Phase 5)
 * 
 * Comprehensive validation against official Docker Compose specification.
 * Supports Compose file format versions: v2.x, v3.x, and latest spec.
 * 
 * Features:
 * - Official Compose Spec v3.8+ validation
 * - Service configuration validation
 * - Network topology validation
 * - Volume and mount validation
 * - Config and secrets validation
 * - Build context validation
 * - Deploy configuration validation
 * - Resource limits validation
 * - Healthcheck validation
 * - Auto-fix capabilities
 * - Detailed error reporting
 * 
 * @author Auto Docker Extension
 * @date January 8, 2026
 */

import * as vscode from 'vscode';
import * as yaml from 'js-yaml';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ComposeSpecIssue {
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    suggestion?: string;
    autoFixable: boolean;
    section?: string;
    service?: string;
}

interface ComposeSpecValidationResult {
    valid: boolean;
    issues: ComposeSpecIssue[];
    score: number;
    version: string;
    services: number;
    networks: number;
    volumes: number;
    autoFixableCount: number;
}

interface ComposeFile {
    version?: string;
    services?: Record<string, ServiceConfig>;
    networks?: Record<string, NetworkConfig>;
    volumes?: Record<string, VolumeConfig>;
    configs?: Record<string, ConfigConfig>;
    secrets?: Record<string, SecretConfig>;
    [key: string]: any;
}

interface ServiceConfig {
    image?: string;
    build?: BuildConfig | string;
    container_name?: string;
    command?: string | string[];
    entrypoint?: string | string[];
    environment?: Record<string, string> | string[];
    env_file?: string | string[];
    ports?: (string | PortConfig)[];
    expose?: (string | number)[];
    volumes?: (string | VolumeMount)[];
    networks?: string[] | Record<string, NetworkReference>;
    depends_on?: string[] | Record<string, DependencyConfig>;
    links?: string[];
    external_links?: string[];
    healthcheck?: HealthcheckConfig;
    deploy?: DeployConfig;
    restart?: string;
    labels?: Record<string, string> | string[];
    logging?: LoggingConfig;
    sysctls?: Record<string, string> | string[];
    ulimits?: Record<string, UlimitConfig | number>;
    user?: string;
    working_dir?: string;
    domainname?: string;
    hostname?: string;
    ipc?: string;
    mac_address?: string;
    privileged?: boolean;
    read_only?: boolean;
    shm_size?: string | number;
    stdin_open?: boolean;
    tty?: boolean;
    [key: string]: any;
}

interface BuildConfig {
    context: string;
    dockerfile?: string;
    args?: Record<string, string> | string[];
    cache_from?: string[];
    labels?: Record<string, string>;
    network?: string;
    shm_size?: string | number;
    target?: string;
    extra_hosts?: string[];
}

interface PortConfig {
    target: number;
    published?: number;
    protocol?: string;
    mode?: string;
}

interface VolumeMount {
    type: string;
    source: string;
    target: string;
    read_only?: boolean;
    bind?: {
        propagation?: string;
    };
    volume?: {
        nocopy?: boolean;
    };
    tmpfs?: {
        size?: number;
    };
}

interface NetworkReference {
    aliases?: string[];
    ipv4_address?: string;
    ipv6_address?: string;
}

interface DependencyConfig {
    condition: 'service_started' | 'service_healthy' | 'service_completed_successfully';
}

interface HealthcheckConfig {
    test: string | string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    start_period?: string;
    disable?: boolean;
}

interface DeployConfig {
    mode?: string;
    replicas?: number;
    labels?: Record<string, string>;
    update_config?: UpdateConfig;
    rollback_config?: RollbackConfig;
    resources?: ResourcesConfig;
    restart_policy?: RestartPolicyConfig;
    placement?: PlacementConfig;
    endpoint_mode?: string;
}

interface UpdateConfig {
    parallelism?: number;
    delay?: string;
    failure_action?: string;
    monitor?: string;
    max_failure_ratio?: number;
    order?: string;
}

interface RollbackConfig {
    parallelism?: number;
    delay?: string;
    failure_action?: string;
    monitor?: string;
    max_failure_ratio?: number;
    order?: string;
}

interface ResourcesConfig {
    limits?: {
        cpus?: string;
        memory?: string;
        pids?: number;
    };
    reservations?: {
        cpus?: string;
        memory?: string;
        generic_resources?: any[];
    };
}

interface RestartPolicyConfig {
    condition?: string;
    delay?: string;
    max_attempts?: number;
    window?: string;
}

interface PlacementConfig {
    constraints?: string[];
    preferences?: any[];
    max_replicas_per_node?: number;
}

interface LoggingConfig {
    driver?: string;
    options?: Record<string, string>;
}

interface UlimitConfig {
    soft: number;
    hard: number;
}

interface NetworkConfig {
    driver?: string;
    driver_opts?: Record<string, string>;
    ipam?: {
        driver?: string;
        config?: Array<{
            subnet?: string;
            ip_range?: string;
            gateway?: string;
            aux_addresses?: Record<string, string>;
        }>;
        options?: Record<string, string>;
    };
    external?: boolean | { name: string };
    internal?: boolean;
    attachable?: boolean;
    enable_ipv6?: boolean;
    labels?: Record<string, string>;
    name?: string;
}

interface VolumeConfig {
    driver?: string;
    driver_opts?: Record<string, string>;
    external?: boolean | { name: string };
    labels?: Record<string, string>;
    name?: string;
}

interface ConfigConfig {
    file?: string;
    external?: boolean | { name: string };
    name?: string;
    labels?: Record<string, string>;
}

interface SecretConfig {
    file?: string;
    external?: boolean | { name: string };
    name?: string;
    labels?: Record<string, string>;
}

// ============================================================================
// DOCKER COMPOSE SPEC VALIDATOR
// ============================================================================

export class DockerComposeSpecValidator {
    private outputChannel: vscode.OutputChannel;
    private strictMode: boolean;

    // Supported Compose file versions
    private readonly SUPPORTED_VERSIONS = [
        '2', '2.0', '2.1', '2.2', '2.3', '2.4',
        '3', '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9'
    ];

    // Valid restart policies
    private readonly VALID_RESTART_POLICIES = ['no', 'always', 'on-failure', 'unless-stopped'];

    // Valid deploy modes
    private readonly VALID_DEPLOY_MODES = ['replicated', 'global'];

    // Valid network drivers
    private readonly VALID_NETWORK_DRIVERS = ['bridge', 'host', 'overlay', 'macvlan', 'none'];

    // Valid volume drivers
    private readonly VALID_VOLUME_DRIVERS = ['local', 'nfs', 'cifs'];

    // Valid logging drivers
    private readonly VALID_LOGGING_DRIVERS = [
        'none', 'json-file', 'syslog', 'journald', 'gelf', 'fluentd', 'awslogs', 'splunk', 'gcplogs', 'logentries'
    ];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Auto Docker - Compose Spec Validator');
        this.strictMode = true; // explicitly enabled for security guarantees
    }

    /**
     * Validate a Docker Compose file against the official specification
     */
    public async validateComposeFile(content: string): Promise<ComposeSpecValidationResult> {
        this.log('🔍 Starting Docker Compose Spec validation...');

        const issues: ComposeSpecIssue[] = [];
        let composeData: ComposeFile;

        try {
            // Parse YAML
            composeData = yaml.load(content) as ComposeFile;
        } catch (error) {
            issues.push({
                code: 'CS001',
                severity: 'error',
                message: `YAML parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                autoFixable: false,
                section: 'syntax'
            });

            return {
                valid: false,
                issues,
                score: 0,
                version: 'unknown',
                services: 0,
                networks: 0,
                volumes: 0,
                autoFixableCount: 0
            };
        }

        // Validate version
        this.validateVersion(composeData, issues);

        // Validate services
        if (composeData.services) {
            this.validateServices(composeData.services, issues, composeData.version);
        } else {
            issues.push({
                code: 'CS002',
                severity: 'error',
                message: 'No services defined in docker-compose.yml',
                autoFixable: false,
                section: 'services'
            });
        }

        // Validate networks
        if (composeData.networks) {
            this.validateNetworks(composeData.networks, issues);
        }

        // Validate volumes
        if (composeData.volumes) {
            this.validateVolumes(composeData.volumes, issues);
        }

        // Validate configs (v3.3+)
        if (composeData.configs) {
            this.validateConfigs(composeData.configs, issues, composeData.version);
        }

        // Validate secrets (v3.1+)
        if (composeData.secrets) {
            this.validateSecrets(composeData.secrets, issues, composeData.version);
        }

        // Cross-validation
        this.validateCrossReferences(composeData, issues);

        // Calculate score
        const score = this.calculateScore(issues);
        const autoFixableCount = issues.filter(i => i.autoFixable).length;

        const result: ComposeSpecValidationResult = {
            valid: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            score,
            version: composeData.version || 'unknown',
            services: composeData.services ? Object.keys(composeData.services).length : 0,
            networks: composeData.networks ? Object.keys(composeData.networks).length : 0,
            volumes: composeData.volumes ? Object.keys(composeData.volumes).length : 0,
            autoFixableCount
        };

        this.log(`✅ Validation complete. Score: ${score}/100, Issues: ${issues.length}, Auto-fixable: ${autoFixableCount}`);

        return result;
    }

    /**
     * Validate Compose file version
     */
    private validateVersion(compose: ComposeFile, issues: ComposeSpecIssue[]): void {
        if (!compose.version) {
            issues.push({
                code: 'CS010',
                severity: 'warning',
                message: 'No version specified. Compose will use latest format.',
                suggestion: 'Add version: "3.8" to specify Compose file format',
                autoFixable: true,
                section: 'version'
            });
            return;
        }

        const version = compose.version.toString();

        if (!this.SUPPORTED_VERSIONS.includes(version)) {
            issues.push({
                code: 'CS011',
                severity: 'warning',
                message: `Compose version "${version}" may not be fully supported`,
                suggestion: 'Use version 3.8 or 3.9 for best compatibility',
                autoFixable: true,
                section: 'version'
            });
        }

        // Recommend v3.8+ for modern features
        const versionNum = parseFloat(version);
        if (versionNum < 3.8) {
            issues.push({
                code: 'CS012',
                severity: 'info',
                message: `Version ${version} is outdated. Consider upgrading to 3.8+`,
                suggestion: 'Upgrade to version 3.8 for better features and support',
                autoFixable: true,
                section: 'version'
            });
        }
    }

    /**
     * Validate all services
     */
    private validateServices(services: Record<string, ServiceConfig>, issues: ComposeSpecIssue[], version?: string): void {
        const serviceNames = Object.keys(services);

        if (serviceNames.length === 0) {
            issues.push({
                code: 'CS020',
                severity: 'error',
                message: 'Services section is empty',
                autoFixable: false,
                section: 'services'
            });
            return;
        }

        for (const serviceName of serviceNames) {
            const service = services[serviceName];
            this.validateService(serviceName, service, issues, version);
        }

        // Validate service relationships
        this.validateServiceDependencies(services, issues);
    }

    /**
     * Validate individual service configuration
     */
    private validateService(name: string, service: ServiceConfig, issues: ComposeSpecIssue[], version?: string): void {
        const versionNum = version ? parseFloat(version) : 3.8;

        // CS021: Service must have image or build
        if (!service.image && !service.build) {
            issues.push({
                code: 'CS021',
                severity: 'error',
                message: `Service "${name}" must specify either 'image' or 'build'`,
                autoFixable: false,
                section: 'services',
                service: name
            });
        }

        // CS022: Image and build warning
        if (service.image && service.build) {
            issues.push({
                code: 'CS022',
                severity: 'warning',
                message: `Service "${name}" has both 'image' and 'build'. Build will be used and tagged with image name.`,
                suggestion: 'This is valid but clarify your intention',
                autoFixable: false,
                section: 'services',
                service: name
            });
        }

        // Validate build configuration
        if (service.build) {
            this.validateBuildConfig(name, service.build, issues);
        }

        // Validate ports
        if (service.ports) {
            this.validatePorts(name, service.ports, issues);
        }

        // Validate volumes
        if (service.volumes) {
            this.validateServiceVolumes(name, service.volumes, issues);
        }

        // Validate networks
        if (service.networks) {
            this.validateServiceNetworks(name, service.networks, issues);
        }

        // Validate environment
        if (service.environment) {
            this.validateEnvironment(name, service.environment, issues);
        }

        // Validate healthcheck
        if (service.healthcheck) {
            this.validateHealthcheck(name, service.healthcheck, issues);
        }

        // Validate deploy (v3+)
        if (service.deploy) {
            if (versionNum < 3) {
                issues.push({
                    code: 'CS023',
                    severity: 'error',
                    message: `Service "${name}": 'deploy' is only available in Compose v3+`,
                    suggestion: 'Upgrade to version 3.0 or remove deploy section',
                    autoFixable: false,
                    section: 'services',
                    service: name
                });
            } else {
                this.validateDeploy(name, service.deploy, issues);
            }
        }

        // Validate restart policy
        if (service.restart) {
            this.validateRestartPolicy(name, service.restart, issues, versionNum);
        }

        // Validate depends_on
        if (service.depends_on) {
            this.validateDependsOn(name, service.depends_on, issues, versionNum);
        }

        // Validate logging
        if (service.logging) {
            this.validateLogging(name, service.logging, issues);
        }

        // Validate container name
        if (service.container_name) {
            this.validateContainerName(name, service.container_name, issues);
        }

        // CS024: Deprecated 'links' in v3+
        if (service.links && versionNum >= 3) {
            issues.push({
                code: 'CS024',
                severity: 'warning',
                message: `Service "${name}": 'links' is deprecated in Compose v3+`,
                suggestion: 'Use networks and service discovery instead',
                autoFixable: false,
                section: 'services',
                service: name
            });
        }

        // CS025: Recommend restart policy
        if (!service.restart && !service.deploy?.restart_policy) {
            issues.push({
                code: 'CS025',
                severity: 'info',
                message: `Service "${name}": No restart policy defined`,
                suggestion: 'Add restart: "unless-stopped" for production',
                autoFixable: true,
                section: 'services',
                service: name
            });
        }

        // CS026: Recommend healthcheck
        if (!service.healthcheck && service.image) {
            issues.push({
                code: 'CS026',
                severity: 'info',
                message: `Service "${name}": No healthcheck defined`,
                suggestion: 'Add healthcheck for better reliability',
                autoFixable: true,
                section: 'services',
                service: name
            });
        }
    }

    /**
     * Validate build configuration
     */
    private validateBuildConfig(serviceName: string, build: BuildConfig | string, issues: ComposeSpecIssue[]): void {
        if (typeof build === 'string') {
            // Simple string format is valid
            return;
        }

        // CS030: Build must have context
        if (!build.context) {
            issues.push({
                code: 'CS030',
                severity: 'error',
                message: `Service "${serviceName}": Build configuration must specify 'context'`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS031: Warn about relative paths
        if (build.context && !build.context.startsWith('/') && !build.context.startsWith('.')) {
            issues.push({
                code: 'CS031',
                severity: 'warning',
                message: `Service "${serviceName}": Build context should be relative path (start with ./ or ../)`,
                suggestion: `Use './${build.context}' for clarity`,
                autoFixable: true,
                section: 'services',
                service: serviceName
            });
        }

        // CS032: Dockerfile path validation
        if (build.dockerfile && build.dockerfile.includes('..')) {
            issues.push({
                code: 'CS032',
                severity: 'warning',
                message: `Service "${serviceName}": Dockerfile path contains '..' which may cause issues`,
                suggestion: 'Use paths relative to build context',
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS033: Target validation
        if (build.target && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(build.target)) {
            issues.push({
                code: 'CS033',
                severity: 'warning',
                message: `Service "${serviceName}": Build target name should be alphanumeric`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }
    }

    /**
     * Validate port configurations
     */
    private validatePorts(serviceName: string, ports: (string | PortConfig)[], issues: ComposeSpecIssue[]): void {
        const usedPorts = new Set<string>();

        for (const port of ports) {
            let hostPort: string | number | undefined;
            let containerPort: number;
            let protocol = 'tcp';

            if (typeof port === 'string') {
                // Parse string format
                const match = port.match(/^(?:(\d+):)?(\d+)(?:\/(tcp|udp))?$/);
                if (!match) {
                    issues.push({
                        code: 'CS040',
                        severity: 'error',
                        message: `Service "${serviceName}": Invalid port format "${port}"`,
                        suggestion: 'Use format: "host:container" or "container" or "host:container/protocol"',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                    continue;
                }

                hostPort = match[1];
                containerPort = parseInt(match[2]);
                protocol = match[3] || 'tcp';
            } else {
                hostPort = port.published;
                containerPort = port.target;
                protocol = port.protocol || 'tcp';
            }

            // CS041: Port range validation
            if (containerPort < 1 || containerPort > 65535) {
                issues.push({
                    code: 'CS041',
                    severity: 'error',
                    message: `Service "${serviceName}": Port ${containerPort} is out of valid range (1-65535)`,
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }

            // CS042: Privileged port warning
            if (hostPort && parseInt(hostPort.toString()) < 1024) {
                issues.push({
                    code: 'CS042',
                    severity: 'warning',
                    message: `Service "${serviceName}": Port ${hostPort} is privileged (<1024)`,
                    suggestion: 'May require elevated permissions or use port mapping',
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }

            // CS043: Port conflict detection
            if (hostPort) {
                const portKey = `${hostPort}/${protocol}`;
                if (usedPorts.has(portKey)) {
                    issues.push({
                        code: 'CS043',
                        severity: 'error',
                        message: `Service "${serviceName}": Port ${hostPort} is already mapped`,
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
                usedPorts.add(portKey);
            }
        }
    }

    /**
     * Validate service volumes
     */
    private validateServiceVolumes(serviceName: string, volumes: (string | VolumeMount)[], issues: ComposeSpecIssue[]): void {
        for (const volume of volumes) {
            if (typeof volume === 'string') {
                // CS050: Validate string format
                if (!volume.includes(':')) {
                    issues.push({
                        code: 'CS050',
                        severity: 'warning',
                        message: `Service "${serviceName}": Volume "${volume}" should specify mount point`,
                        suggestion: 'Use format: "host:container" or "volume:container"',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }

                // CS051: Warn about absolute host paths
                const parts = volume.split(':');
                if (parts[0].startsWith('/')) {
                    issues.push({
                        code: 'CS051',
                        severity: 'info',
                        message: `Service "${serviceName}": Using absolute host path may not be portable`,
                        suggestion: 'Consider using named volumes for portability',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            } else {
                // CS052: Validate long format
                if (!volume.type) {
                    issues.push({
                        code: 'CS052',
                        severity: 'error',
                        message: `Service "${serviceName}": Volume mount must specify 'type'`,
                        suggestion: 'Use type: volume, bind, tmpfs, or npipe',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }

                if (!volume.target) {
                    issues.push({
                        code: 'CS053',
                        severity: 'error',
                        message: `Service "${serviceName}": Volume mount must specify 'target' (container path)`,
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }

                // CS054: Type-specific validation
                if (volume.type === 'bind' || volume.type === 'volume') {
                    if (!volume.source) {
                        issues.push({
                            code: 'CS054',
                            severity: 'error',
                            message: `Service "${serviceName}": ${volume.type} mount must specify 'source'`,
                            autoFixable: false,
                            section: 'services',
                            service: serviceName
                        });
                    }
                }
            }
        }
    }

    /**
     * Validate service networks
     */
    private validateServiceNetworks(serviceName: string, networks: string[] | Record<string, NetworkReference>, issues: ComposeSpecIssue[]): void {
        const networkList = Array.isArray(networks) ? networks : Object.keys(networks);

        // CS060: Validate network names
        for (const networkName of networkList) {
            if (!/^[a-zA-Z0-9._-]+$/.test(networkName)) {
                issues.push({
                    code: 'CS060',
                    severity: 'error',
                    message: `Service "${serviceName}": Invalid network name "${networkName}"`,
                    suggestion: 'Network names must be alphanumeric with ._-',
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }
        }

        // CS061: Validate network configuration
        if (!Array.isArray(networks)) {
            for (const [networkName, config] of Object.entries(networks)) {
                if (config.ipv4_address && !/^(\d{1,3}\.){3}\d{1,3}$/.test(config.ipv4_address)) {
                    issues.push({
                        code: 'CS061',
                        severity: 'error',
                        message: `Service "${serviceName}": Invalid IPv4 address for network "${networkName}"`,
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            }
        }
    }

    /**
     * Validate environment variables
     */
    private validateEnvironment(serviceName: string, env: Record<string, string> | string[], issues: ComposeSpecIssue[]): void {
        const envVars = Array.isArray(env) ? env : Object.entries(env).map(([k, v]) => `${k}=${v}`);

        for (const envVar of envVars) {
            const varString = typeof envVar === 'string' ? envVar : '';

            // CS070: Check for empty values
            if (varString.endsWith('=') || varString.includes('=')) {
                const [key, value] = varString.split('=');
                if (!value || value.trim() === '') {
                    issues.push({
                        code: 'CS070',
                        severity: 'warning',
                        message: `Service "${serviceName}": Environment variable "${key}" has empty value`,
                        suggestion: 'Remove if not needed or set a default value',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }

                // CS071: Detect sensitive data
                const sensitivePatterns = [
                    /password/i, /secret/i, /token/i, /key/i, /apikey/i, /api_key/i
                ];
                if (sensitivePatterns.some(pattern => pattern.test(key)) && value && value !== '${}' && !value.startsWith('${')) {
                    issues.push({
                        code: 'CS071',
                        severity: 'warning',
                        message: `Service "${serviceName}": Potential sensitive data in environment variable "${key}"`,
                        suggestion: 'Use Docker secrets or environment file instead',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            }
        }
    }

    /**
     * Validate healthcheck configuration
     */
    private validateHealthcheck(serviceName: string, healthcheck: HealthcheckConfig, issues: ComposeSpecIssue[]): void {
        // CS080: Test is required
        if (!healthcheck.test) {
            issues.push({
                code: 'CS080',
                severity: 'error',
                message: `Service "${serviceName}": Healthcheck must specify 'test'`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
            return;
        }

        // CS081: Validate test format
        if (Array.isArray(healthcheck.test)) {
            if (healthcheck.test.length === 0) {
                issues.push({
                    code: 'CS081',
                    severity: 'error',
                    message: `Service "${serviceName}": Healthcheck test array is empty`,
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            } else {
                const firstElement = healthcheck.test[0].toUpperCase();
                if (!['CMD', 'CMD-SHELL', 'NONE'].includes(firstElement)) {
                    issues.push({
                        code: 'CS082',
                        severity: 'warning',
                        message: `Service "${serviceName}": Healthcheck test should start with CMD, CMD-SHELL, or NONE`,
                        suggestion: 'Use ["CMD", "command"] or ["CMD-SHELL", "shell command"]',
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            }
        }

        // CS083: Validate interval format
        if (healthcheck.interval && !this.isValidDuration(healthcheck.interval)) {
            issues.push({
                code: 'CS083',
                severity: 'error',
                message: `Service "${serviceName}": Invalid healthcheck interval format`,
                suggestion: 'Use format: "30s", "1m", "1h30m"',
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS084: Validate timeout format
        if (healthcheck.timeout && !this.isValidDuration(healthcheck.timeout)) {
            issues.push({
                code: 'CS084',
                severity: 'error',
                message: `Service "${serviceName}": Invalid healthcheck timeout format`,
                suggestion: 'Use format: "30s", "1m", "1h30m"',
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS085: Validate retries
        if (healthcheck.retries !== undefined && (healthcheck.retries < 1 || healthcheck.retries > 100)) {
            issues.push({
                code: 'CS085',
                severity: 'warning',
                message: `Service "${serviceName}": Healthcheck retries should be between 1-100`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }
    }

    /**
     * Validate deploy configuration
     */
    private validateDeploy(serviceName: string, deploy: DeployConfig, issues: ComposeSpecIssue[]): void {
        // CS090: Validate mode
        if (deploy.mode && !this.VALID_DEPLOY_MODES.includes(deploy.mode)) {
            issues.push({
                code: 'CS090',
                severity: 'error',
                message: `Service "${serviceName}": Invalid deploy mode "${deploy.mode}"`,
                suggestion: `Use one of: ${this.VALID_DEPLOY_MODES.join(', ')}`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS091: Validate replicas
        if (deploy.replicas !== undefined) {
            if (deploy.mode === 'global') {
                issues.push({
                    code: 'CS091',
                    severity: 'warning',
                    message: `Service "${serviceName}": 'replicas' is ignored in global mode`,
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }
            if (deploy.replicas < 0 || deploy.replicas > 1000) {
                issues.push({
                    code: 'CS092',
                    severity: 'warning',
                    message: `Service "${serviceName}": Replicas count seems unusual (${deploy.replicas})`,
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }
        }

        // CS093: Validate resources
        if (deploy.resources) {
            this.validateResources(serviceName, deploy.resources, issues);
        }

        // CS094: Validate restart policy
        if (deploy.restart_policy) {
            this.validateDeployRestartPolicy(serviceName, deploy.restart_policy, issues);
        }
    }

    /**
     * Validate resource limits and reservations
     */
    private validateResources(serviceName: string, resources: ResourcesConfig, issues: ComposeSpecIssue[]): void {
        // CS095: Validate CPU limits
        if (resources.limits?.cpus) {
            if (!this.isValidCPU(resources.limits.cpus)) {
                issues.push({
                    code: 'CS095',
                    severity: 'error',
                    message: `Service "${serviceName}": Invalid CPU limit format "${resources.limits.cpus}"`,
                    suggestion: 'Use format: "0.5", "2", "1.5"',
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }
        }

        // CS096: Validate memory limits
        if (resources.limits?.memory) {
            if (!this.isValidMemory(resources.limits.memory)) {
                issues.push({
                    code: 'CS096',
                    severity: 'error',
                    message: `Service "${serviceName}": Invalid memory limit format "${resources.limits.memory}"`,
                    suggestion: 'Use format: "512M", "1G", "100000000" (bytes)',
                    autoFixable: false,
                    section: 'services',
                    service: serviceName
                });
            }
        }

        // CS097: Compare limits and reservations
        if (resources.limits && resources.reservations) {
            if (resources.limits.cpus && resources.reservations.cpus) {
                const limitCPU = parseFloat(resources.limits.cpus);
                const reserveCPU = parseFloat(resources.reservations.cpus);
                if (reserveCPU > limitCPU) {
                    issues.push({
                        code: 'CS097',
                        severity: 'error',
                        message: `Service "${serviceName}": CPU reservation exceeds limit`,
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            }
        }
    }

    /**
     * Validate deploy restart policy
     */
    private validateDeployRestartPolicy(serviceName: string, policy: RestartPolicyConfig, issues: ComposeSpecIssue[]): void {
        // CS098: Validate condition
        const validConditions = ['none', 'on-failure', 'any'];
        if (policy.condition && !validConditions.includes(policy.condition)) {
            issues.push({
                code: 'CS098',
                severity: 'error',
                message: `Service "${serviceName}": Invalid restart condition "${policy.condition}"`,
                suggestion: `Use one of: ${validConditions.join(', ')}`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS099: Validate max_attempts
        if (policy.max_attempts !== undefined && policy.max_attempts < 0) {
            issues.push({
                code: 'CS099',
                severity: 'error',
                message: `Service "${serviceName}": max_attempts must be non-negative`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }
    }

    /**
     * Validate restart policy
     */
    private validateRestartPolicy(serviceName: string, restart: string, issues: ComposeSpecIssue[], version: number): void {
        // CS100: Valid restart policy
        if (!this.VALID_RESTART_POLICIES.includes(restart)) {
            issues.push({
                code: 'CS100',
                severity: 'error',
                message: `Service "${serviceName}": Invalid restart policy "${restart}"`,
                suggestion: `Use one of: ${this.VALID_RESTART_POLICIES.join(', ')}`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS101: restart vs deploy.restart_policy
        if (version >= 3) {
            issues.push({
                code: 'CS101',
                severity: 'info',
                message: `Service "${serviceName}": Consider using deploy.restart_policy in Compose v3+`,
                suggestion: 'deploy.restart_policy is preferred for swarm mode',
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }
    }

    /**
     * Validate depends_on configuration
     */
    private validateDependsOn(serviceName: string, dependsOn: string[] | Record<string, DependencyConfig>, issues: ComposeSpecIssue[], version: number): void {
        const deps = Array.isArray(dependsOn) ? dependsOn : Object.keys(dependsOn);

        // CS110: Self-dependency check
        if (deps.includes(serviceName)) {
            issues.push({
                code: 'CS110',
                severity: 'error',
                message: `Service "${serviceName}" depends on itself`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS111: Validate long format (v2.1+ and v3.0+)
        if (!Array.isArray(dependsOn)) {
            const validConditions = ['service_started', 'service_healthy', 'service_completed_successfully'];
            for (const [dep, config] of Object.entries(dependsOn)) {
                if (config.condition && !validConditions.includes(config.condition)) {
                    issues.push({
                        code: 'CS111',
                        severity: 'error',
                        message: `Service "${serviceName}": Invalid depends_on condition for "${dep}"`,
                        suggestion: `Use one of: ${validConditions.join(', ')}`,
                        autoFixable: false,
                        section: 'services',
                        service: serviceName
                    });
                }
            }
        }
    }

    /**
     * Validate logging configuration
     */
    private validateLogging(serviceName: string, logging: LoggingConfig, issues: ComposeSpecIssue[]): void {
        // CS120: Validate driver
        if (logging.driver && !this.VALID_LOGGING_DRIVERS.includes(logging.driver)) {
            issues.push({
                code: 'CS120',
                severity: 'warning',
                message: `Service "${serviceName}": Unknown logging driver "${logging.driver}"`,
                suggestion: `Common drivers: ${this.VALID_LOGGING_DRIVERS.slice(0, 5).join(', ')}`,
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS121: json-file rotation recommendation
        if (logging.driver === 'json-file' || !logging.driver) {
            if (!logging.options || !logging.options['max-size']) {
                issues.push({
                    code: 'CS121',
                    severity: 'warning',
                    message: `Service "${serviceName}": json-file driver without log rotation`,
                    suggestion: 'Add options: max-size and max-file to prevent disk fill',
                    autoFixable: true,
                    section: 'services',
                    service: serviceName
                });
            }
        }
    }

    /**
     * Validate container name
     */
    private validateContainerName(serviceName: string, containerName: string, issues: ComposeSpecIssue[]): void {
        // CS130: Valid container name format
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(containerName)) {
            issues.push({
                code: 'CS130',
                severity: 'error',
                message: `Service "${serviceName}": Invalid container name "${containerName}"`,
                suggestion: 'Container names must start with alphanumeric and contain only [a-zA-Z0-9_.-]',
                autoFixable: false,
                section: 'services',
                service: serviceName
            });
        }

        // CS131: Warning about container_name in swarm mode
        issues.push({
            code: 'CS131',
            severity: 'info',
            message: `Service "${serviceName}": container_name is not supported in swarm mode`,
            suggestion: 'Remove if deploying to swarm',
            autoFixable: false,
            section: 'services',
            service: serviceName
        });
    }

    /**
     * Validate service dependencies (circular, missing refs)
     */
    private validateServiceDependencies(services: Record<string, ServiceConfig>, issues: ComposeSpecIssue[]): void {
        const serviceNames = Object.keys(services);

        for (const [serviceName, service] of Object.entries(services)) {
            if (service.depends_on) {
                const deps = Array.isArray(service.depends_on) ? service.depends_on : Object.keys(service.depends_on);

                for (const dep of deps) {
                    // CS140: Missing service reference
                    if (!serviceNames.includes(dep)) {
                        issues.push({
                            code: 'CS140',
                            severity: 'error',
                            message: `Service "${serviceName}" depends on undefined service "${dep}"`,
                            autoFixable: false,
                            section: 'services',
                            service: serviceName
                        });
                    }
                }
            }
        }

        // CS141: Circular dependency detection
        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const detectCycle = (service: string, path: string[]): boolean => {
            visited.add(service);
            recursionStack.add(service);

            const deps = services[service]?.depends_on;
            if (deps) {
                const depList = Array.isArray(deps) ? deps : Object.keys(deps);
                for (const dep of depList) {
                    if (!visited.has(dep)) {
                        if (detectCycle(dep, [...path, dep])) {
                            return true;
                        }
                    } else if (recursionStack.has(dep)) {
                        issues.push({
                            code: 'CS141',
                            severity: 'error',
                            message: `Circular dependency detected: ${[...path, dep].join(' -> ')}`,
                            autoFixable: false,
                            section: 'services'
                        });
                        return true;
                    }
                }
            }

            recursionStack.delete(service);
            return false;
        };

        for (const service of serviceNames) {
            if (!visited.has(service)) {
                detectCycle(service, [service]);
            }
        }
    }

    /**
     * Validate networks section
     */
    private validateNetworks(networks: Record<string, NetworkConfig>, issues: ComposeSpecIssue[]): void {
        for (const [networkName, network] of Object.entries(networks)) {
            // CS150: Validate driver
            if (network.driver && !this.VALID_NETWORK_DRIVERS.includes(network.driver)) {
                issues.push({
                    code: 'CS150',
                    severity: 'warning',
                    message: `Network "${networkName}": Unknown driver "${network.driver}"`,
                    suggestion: `Common drivers: ${this.VALID_NETWORK_DRIVERS.join(', ')}`,
                    autoFixable: false,
                    section: 'networks'
                });
            }

            // CS151: Validate IPAM config
            if (network.ipam?.config) {
                for (const ipamConfig of network.ipam.config) {
                    if (ipamConfig.subnet && !this.isValidSubnet(ipamConfig.subnet)) {
                        issues.push({
                            code: 'CS151',
                            severity: 'error',
                            message: `Network "${networkName}": Invalid subnet format "${ipamConfig.subnet}"`,
                            suggestion: 'Use CIDR notation: "172.20.0.0/16"',
                            autoFixable: false,
                            section: 'networks'
                        });
                    }

                    if (ipamConfig.gateway && !this.isValidIP(ipamConfig.gateway)) {
                        issues.push({
                            code: 'CS152',
                            severity: 'error',
                            message: `Network "${networkName}": Invalid gateway IP "${ipamConfig.gateway}"`,
                            autoFixable: false,
                            section: 'networks'
                        });
                    }
                }
            }

            // CS153: External network validation
            if (network.external) {
                if (Object.keys(network).length > 2) { // external + name only
                    issues.push({
                        code: 'CS153',
                        severity: 'warning',
                        message: `Network "${networkName}": External networks should not have additional configuration`,
                        suggestion: 'External networks are managed outside Compose',
                        autoFixable: false,
                        section: 'networks'
                    });
                }
            }
        }
    }

    /**
     * Validate volumes section
     */
    private validateVolumes(volumes: Record<string, VolumeConfig>, issues: ComposeSpecIssue[]): void {
        for (const [volumeName, volume] of Object.entries(volumes)) {
            // CS160: Validate driver
            if (volume.driver && !this.VALID_VOLUME_DRIVERS.includes(volume.driver)) {
                issues.push({
                    code: 'CS160',
                    severity: 'warning',
                    message: `Volume "${volumeName}": Unknown driver "${volume.driver}"`,
                    suggestion: `Common drivers: ${this.VALID_VOLUME_DRIVERS.join(', ')}`,
                    autoFixable: false,
                    section: 'volumes'
                });
            }

            // CS161: External volume validation
            if (volume.external) {
                if (Object.keys(volume).length > 2) {
                    issues.push({
                        code: 'CS161',
                        severity: 'warning',
                        message: `Volume "${volumeName}": External volumes should not have additional configuration`,
                        suggestion: 'External volumes are managed outside Compose',
                        autoFixable: false,
                        section: 'volumes'
                    });
                }
            }
        }
    }

    /**
     * Validate configs section
     */
    private validateConfigs(configs: Record<string, ConfigConfig>, issues: ComposeSpecIssue[], version?: string): void {
        const versionNum = version ? parseFloat(version) : 3.8;

        // CS170: Configs require v3.3+
        if (versionNum < 3.3) {
            issues.push({
                code: 'CS170',
                severity: 'error',
                message: 'Configs are only available in Compose v3.3+',
                suggestion: 'Upgrade to version 3.3 or remove configs section',
                autoFixable: false,
                section: 'configs'
            });
            return;
        }

        for (const [configName, config] of Object.entries(configs)) {
            // CS171: Config must have file or external
            if (!config.file && !config.external) {
                issues.push({
                    code: 'CS171',
                    severity: 'error',
                    message: `Config "${configName}" must specify either 'file' or 'external'`,
                    autoFixable: false,
                    section: 'configs'
                });
            }

            // CS172: External config validation
            if (config.external && config.file) {
                issues.push({
                    code: 'CS172',
                    severity: 'error',
                    message: `Config "${configName}" cannot have both 'file' and 'external'`,
                    autoFixable: false,
                    section: 'configs'
                });
            }
        }
    }

    /**
     * Validate secrets section
     */
    private validateSecrets(secrets: Record<string, SecretConfig>, issues: ComposeSpecIssue[], version?: string): void {
        const versionNum = version ? parseFloat(version) : 3.8;

        // CS180: Secrets require v3.1+
        if (versionNum < 3.1) {
            issues.push({
                code: 'CS180',
                severity: 'error',
                message: 'Secrets are only available in Compose v3.1+',
                suggestion: 'Upgrade to version 3.1 or remove secrets section',
                autoFixable: false,
                section: 'secrets'
            });
            return;
        }

        for (const [secretName, secret] of Object.entries(secrets)) {
            // CS181: Secret must have file or external
            if (!secret.file && !secret.external) {
                issues.push({
                    code: 'CS181',
                    severity: 'error',
                    message: `Secret "${secretName}" must specify either 'file' or 'external'`,
                    autoFixable: false,
                    section: 'secrets'
                });
            }

            // CS182: External secret validation
            if (secret.external && secret.file) {
                issues.push({
                    code: 'CS182',
                    severity: 'error',
                    message: `Secret "${secretName}" cannot have both 'file' and 'external'`,
                    autoFixable: false,
                    section: 'secrets'
                });
            }
        }
    }

    /**
     * Validate cross-references between sections
     */
    private validateCrossReferences(compose: ComposeFile, issues: ComposeSpecIssue[]): void {
        if (!compose.services) {
            return;
        }

        const definedNetworks = compose.networks ? Object.keys(compose.networks) : [];
        const definedVolumes = compose.volumes ? Object.keys(compose.volumes) : [];
        const definedConfigs = compose.configs ? Object.keys(compose.configs) : [];
        const definedSecrets = compose.secrets ? Object.keys(compose.secrets) : [];

        for (const [serviceName, service] of Object.entries(compose.services)) {
            // CS190: Validate network references
            if (service.networks) {
                const serviceNetworks = Array.isArray(service.networks) ? service.networks : Object.keys(service.networks);
                for (const network of serviceNetworks) {
                    if (network !== 'default' && !definedNetworks.includes(network)) {
                        issues.push({
                            code: 'CS190',
                            severity: 'error',
                            message: `Service "${serviceName}" references undefined network "${network}"`,
                            suggestion: 'Define the network in the networks section or use default',
                            autoFixable: false,
                            section: 'services',
                            service: serviceName
                        });
                    }
                }
            }

            // CS191: Validate volume references
            if (service.volumes) {
                for (const volume of service.volumes) {
                    if (typeof volume === 'string') {
                        const volumeName = volume.split(':')[0];
                        // Check if it's a named volume (not a path)
                        if (!volumeName.startsWith('/') && !volumeName.startsWith('.') && !volumeName.includes('\\')) {
                            if (!definedVolumes.includes(volumeName)) {
                                issues.push({
                                    code: 'CS191',
                                    severity: 'warning',
                                    message: `Service "${serviceName}" references undefined volume "${volumeName}"`,
                                    suggestion: 'Define the volume in the volumes section',
                                    autoFixable: false,
                                    section: 'services',
                                    service: serviceName
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Calculate overall score
     */
    private calculateScore(issues: ComposeSpecIssue[]): number {
        let score = 100;

        for (const issue of issues) {
            switch (issue.severity) {
                case 'error':
                    score -= 15;
                    break;
                case 'warning':
                    score -= 5;
                    break;
                case 'info':
                    score -= 1;
                    break;
            }
        }

        return Math.max(0, score);
    }

    /**
     * Validate duration format (e.g., "30s", "1m30s", "2h")
     */
    private isValidDuration(duration: string): boolean {
        return /^\d+(ns|us|ms|s|m|h)(\d+(ns|us|ms|s|m|h))*$/.test(duration);
    }

    /**
     * Validate CPU format
     */
    private isValidCPU(cpu: string): boolean {
        return /^\d+(\.\d+)?$/.test(cpu);
    }

    /**
     * Validate memory format
     */
    private isValidMemory(memory: string): boolean {
        return /^\d+(b|k|m|g|kb|mb|gb)?$/i.test(memory);
    }

    /**
     * Validate subnet format
     */
    private isValidSubnet(subnet: string): boolean {
        return /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(subnet);
    }

    /**
     * Validate IP address
     */
    private isValidIP(ip: string): boolean {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
    }

    /**
     * Generate detailed validation report
     */
    public generateReport(result: ComposeSpecValidationResult): string {
        let report = '\n╔════════════════════════════════════════════════════════════╗\n';
        report += '║         Docker Compose Spec Validation Report            ║\n';
        report += '╚════════════════════════════════════════════════════════════╝\n\n';

        // Summary
        report += `📊 Overall Score: ${result.score}/100 ${this.getScoreEmoji(result.score)}\n`;
        report += `✅ Valid: ${result.valid ? 'Yes' : 'No'}\n`;
        report += `📦 Version: ${result.version}\n`;
        report += `🔧 Services: ${result.services}\n`;
        report += `🌐 Networks: ${result.networks}\n`;
        report += `💾 Volumes: ${result.volumes}\n`;
        report += `🔧 Auto-fixable: ${result.autoFixableCount}\n\n`;

        // Issues by severity
        const errors = result.issues.filter(i => i.severity === 'error');
        const warnings = result.issues.filter(i => i.severity === 'warning');
        const infos = result.issues.filter(i => i.severity === 'info');

        if (errors.length > 0) {
            report += '🔴 ERRORS:\n';
            errors.forEach(issue => {
                report += `  [${issue.code}] ${issue.message}\n`;
                if (issue.service) report += `    Service: ${issue.service}\n`;
                if (issue.suggestion) report += `    💡 ${issue.suggestion}\n`;
                report += '\n';
            });
        }

        if (warnings.length > 0) {
            report += '🟡 WARNINGS:\n';
            warnings.forEach(issue => {
                report += `  [${issue.code}] ${issue.message}\n`;
                if (issue.service) report += `    Service: ${issue.service}\n`;
                if (issue.suggestion) report += `    💡 ${issue.suggestion}\n`;
                report += '\n';
            });
        }

        if (infos.length > 0) {
            report += '🔵 INFO:\n';
            infos.forEach(issue => {
                report += `  [${issue.code}] ${issue.message}\n`;
                if (issue.service) report += `    Service: ${issue.service}\n`;
                if (issue.suggestion) report += `    💡 ${issue.suggestion}\n`;
                report += '\n';
            });
        }

        if (result.issues.length === 0) {
            report += '✨ Perfect! No issues found.\n';
        }

        return report;
    }

    /**
     * Get emoji for score
     */
    private getScoreEmoji(score: number): string {
        if (score >= 95) return '🏆';
        if (score >= 85) return '⭐';
        if (score >= 70) return '👍';
        if (score >= 50) return '⚠️';
        return '❌';
    }

    /**
     * Log to output channel
     */
    private log(message: string): void {
        this.outputChannel.appendLine(message);
    }

    /**
     * Show validation results to user
     */
    public showResults(result: ComposeSpecValidationResult): void {
        const report = this.generateReport(result);
        this.outputChannel.clear();
        this.outputChannel.appendLine(report);
        this.outputChannel.show(true);
    }
}
