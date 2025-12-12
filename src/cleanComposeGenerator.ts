/**
 * Clean Compose Generator
 * Generates minimal, correct docker-compose.yml files
 * Fixes Issues #16-20: Docker-Compose generation errors
 */

import { DetectedFrontend, DetectedBackend, DetectedDatabase } from './enhancedDetectionEngine';

export interface ComposeService {
    name: string;
    type: 'frontend' | 'backend' | 'database';
    buildContext?: string;
    dockerfile?: string;
    image?: string;
    ports?: string[];
    environment?: Record<string, string>;
    envFile?: string;
    dependsOn?: string[];
    volumes?: string[];
}

/**
 * Clean Compose Generator - Main Class
 */
export class CleanComposeGenerator {

    /**
     * Generate docker-compose.yml for frontend-only project
     */
    static generateFrontendOnlyCompose(frontend: DetectedFrontend): string {
        const service: ComposeService = {
            name: 'frontend',
            type: 'frontend',
            buildContext: frontend.path === '.' ? '.' : frontend.path,
            dockerfile: 'Dockerfile',
            ports: ['80:80'],
            envFile: '.env'
        };

        return this.generateComposeFile([service], []);
    }

    /**
     * Generate docker-compose.yml for backend-only project
     */
    static generateBackendOnlyCompose(backend: DetectedBackend, databases?: DetectedDatabase[]): string {
        const backendService: ComposeService = {
            name: 'backend',
            type: 'backend',
            buildContext: backend.path === '.' ? '.' : backend.path,
            dockerfile: 'Dockerfile',
            ports: [`${backend.port || 8000}:${backend.port || 8000}`],
            envFile: '.env'
        };

        // Add database dependencies if they exist
        if (databases && databases.length > 0) {
            backendService.dependsOn = databases.map(db => db.type);
        }

        const services = [backendService];

        return this.generateComposeFile(services, databases || []);
    }

    /**
     * Generate docker-compose.yml for fullstack project
     */
    static generateFullstackCompose(
        frontend: DetectedFrontend,
        backend: DetectedBackend,
        databases?: DetectedDatabase[]
    ): string {
        const frontendService: ComposeService = {
            name: 'frontend',
            type: 'frontend',
            buildContext: frontend.path === '.' ? '.' : frontend.path,
            dockerfile: 'Dockerfile',
            ports: ['80:80'],
            dependsOn: ['backend']
        };

        const backendService: ComposeService = {
            name: 'backend',
            type: 'backend',
            buildContext: backend.path === '.' ? '.' : backend.path,
            dockerfile: 'Dockerfile',
            ports: [`${backend.port || 8000}:${backend.port || 8000}`],
            envFile: '.env'
        };

        // Add database dependencies if they exist
        if (databases && databases.length > 0) {
            backendService.dependsOn = databases.map(db => db.type);
        }

        const services = [frontendService, backendService];

        return this.generateComposeFile(services, databases || []);
    }

    /**
     * Generate docker-compose.yml for monorepo project
     */
    static generateMonorepoCompose(
        frontends: DetectedFrontend[],
        backends: DetectedBackend[],
        databases?: DetectedDatabase[]
    ): string {
        const services: ComposeService[] = [];

        // Add frontend services
        for (const frontend of frontends) {
            const serviceName = this.getServiceNameFromPath(frontend.path, 'frontend');
            const service: ComposeService = {
                name: serviceName,
                type: 'frontend',
                buildContext: frontend.path,
                dockerfile: 'Dockerfile',
                ports: ['80:80']
            };

            // Frontend depends on backends (if they exist)
            if (backends.length > 0) {
                service.dependsOn = backends.map(b => this.getServiceNameFromPath(b.path, 'backend'));
            }

            services.push(service);
        }

        // Add backend services
        for (const backend of backends) {
            const serviceName = this.getServiceNameFromPath(backend.path, 'backend');
            const service: ComposeService = {
                name: serviceName,
                type: 'backend',
                buildContext: backend.path,
                dockerfile: 'Dockerfile',
                ports: [`${backend.port || 8000}:${backend.port || 8000}`],
                envFile: `${backend.path}/.env`
            };

            // Backend depends on databases (if they exist)
            if (databases && databases.length > 0) {
                service.dependsOn = databases.map(db => db.type);
            }

            services.push(service);
        }

        return this.generateComposeFile(services, databases || []);
    }

    /**
     * Get service name from path
     */
    private static getServiceNameFromPath(path: string, defaultName: string): string {
        if (path === '.') {
            return defaultName;
        }

        // Extract last part of path
        const parts = path.split('/');
        const lastName = parts[parts.length - 1];

        // Return the folder name (e.g., "apps/frontend" -> "frontend")
        return lastName || defaultName;
    }

    /**
     * Generate complete docker-compose.yml file
     */
    private static generateComposeFile(services: ComposeService[], databases: DetectedDatabase[]): string {
        let compose = `version: "3.8"\n\nservices:\n`;

        // Add application services
        for (const service of services) {
            compose += this.generateServiceBlock(service);
        }

        // Add database services
        for (const database of databases) {
            compose += this.generateDatabaseService(database);
        }

        // Add volumes section if there are databases
        if (databases.length > 0) {
            compose += '\nvolumes:\n';
            for (const database of databases) {
                compose += `  ${database.type}_data:\n`;
            }
        }

        return compose;
    }

    /**
     * Generate service block for application service
     */
    private static generateServiceBlock(service: ComposeService): string {
        let block = `  ${service.name}:\n`;

        // Build configuration
        if (service.buildContext) {
            block += `    build:\n`;
            block += `      context: ${service.buildContext}\n`;
            block += `      dockerfile: ${service.dockerfile || 'Dockerfile'}\n`;
        } else if (service.image) {
            block += `    image: ${service.image}\n`;
        }

        // Ports
        if (service.ports && service.ports.length > 0) {
            block += `    ports:\n`;
            for (const port of service.ports) {
                block += `      - "${port}"\n`;
            }
        }

        // Environment file
        if (service.envFile) {
            block += `    env_file:\n`;
            block += `      - ${service.envFile}\n`;
        }

        // Environment variables
        if (service.environment) {
            block += `    environment:\n`;
            for (const [key, value] of Object.entries(service.environment)) {
                block += `      ${key}: ${value}\n`;
            }
        }

        // Dependencies
        if (service.dependsOn && service.dependsOn.length > 0) {
            block += `    depends_on:\n`;
            for (const dep of service.dependsOn) {
                block += `      - ${dep}\n`;
            }
        }

        // Volumes (only for databases)
        if (service.volumes && service.volumes.length > 0) {
            block += `    volumes:\n`;
            for (const vol of service.volumes) {
                block += `      - ${vol}\n`;
            }
        }

        // Restart policy
        block += `    restart: unless-stopped\n`;

        block += '\n';

        return block;
    }

    /**
     * Generate database service block
     */
    private static generateDatabaseService(database: DetectedDatabase): string {
        const { type, port, version } = database;

        let serviceName = type;
        let image = this.getDatabaseImage(type, version);
        let environment: Record<string, string> = {};
        let volumes: string[] = [];

        switch (type) {
            case 'postgres':
                serviceName = 'postgres';
                environment = {
                    'POSTGRES_USER': '${DB_USER:-postgres}',
                    'POSTGRES_PASSWORD': '${DB_PASSWORD:-postgres}',
                    'POSTGRES_DB': '${DB_NAME:-myapp}'
                };
                volumes = [`${type}_data:/var/lib/postgresql/data`];
                break;

            case 'mysql':
            case 'mariadb':
                serviceName = type;
                environment = {
                    'MYSQL_ROOT_PASSWORD': '${DB_ROOT_PASSWORD:-root}',
                    'MYSQL_DATABASE': '${DB_NAME:-myapp}',
                    'MYSQL_USER': '${DB_USER:-user}',
                    'MYSQL_PASSWORD': '${DB_PASSWORD:-password}'
                };
                volumes = [`${type}_data:/var/lib/mysql`];
                break;

            case 'mongodb':
                serviceName = 'mongodb';
                environment = {
                    'MONGO_INITDB_ROOT_USERNAME': '${DB_USER:-admin}',
                    'MONGO_INITDB_ROOT_PASSWORD': '${DB_PASSWORD:-password}',
                    'MONGO_INITDB_DATABASE': '${DB_NAME:-myapp}'
                };
                volumes = [`${type}_data:/data/db`];
                break;

            case 'redis':
                serviceName = 'redis';
                environment = {};
                volumes = [`${type}_data:/data`];
                break;
        }

        const service: ComposeService = {
            name: serviceName,
            type: 'database',
            image,
            ports: port ? [`${port}:${port}`] : undefined,
            environment,
            volumes
        };

        return this.generateServiceBlock(service);
    }

    /**
     * Get database Docker image
     */
    private static getDatabaseImage(type: string, version?: string): string {
        const defaultVersions: Record<string, string> = {
            'postgres': '15-alpine',
            'mysql': '8-oracle',
            'mariadb': '11',
            'mongodb': '7',
            'redis': '7-alpine'
        };

        const ver = version || defaultVersions[type] || 'latest';
        return `${type}:${ver}`;
    }

    /**
     * Validate docker-compose.yml syntax
     */
    static validateCompose(composeContent: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check for version
        if (!composeContent.includes('version:')) {
            errors.push('Missing version field');
        }

        // Check for services
        if (!composeContent.includes('services:')) {
            errors.push('Missing services field');
        }

        // Check for proper YAML indentation (basic check)
        const lines = composeContent.split('\n');
        let inServices = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim() === 'services:') {
                inServices = true;
            }

            if (inServices && line.startsWith('  ') && !line.startsWith('    ')) {
                // This is likely a service name - check next line has more indentation
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (nextLine.trim() && !nextLine.startsWith('    ')) {
                        errors.push(`Service definition at line ${i + 1} has incorrect indentation`);
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Check if unnecessary elements exist
     */
    static checkForUnnecessaryElements(composeContent: string): {
        hasUnnecessaryVolumes: boolean;
        hasUnnecessaryNetworks: boolean;
        hasPlaceholderServices: boolean;
        warnings: string[];
    } {
        const warnings: string[] = [];

        // Check for unnecessary volumes (volumes mounting current directory)
        const hasCodeVolumeMount = composeContent.includes('- .:/app') ||
            composeContent.includes('- ./:/app');

        if (hasCodeVolumeMount) {
            warnings.push('Found volume mounting current directory (.:/app) - this will overwrite built files');
        }

        // Check for unnecessary networks
        const hasNetworks = composeContent.includes('networks:');
        const serviceCount = (composeContent.match(/^  \w+:/gm) || []).length - 1; // -1 for services: line

        if (hasNetworks && serviceCount <= 2) {
            warnings.push('Custom networks defined but only 1-2 services - default bridge network is sufficient');
        }

        // Check for placeholder/commented services
        const hasPlaceholders = composeContent.includes('# backend:') ||
            composeContent.includes('# database:');

        if (hasPlaceholders) {
            warnings.push('Found commented/placeholder services - remove if not needed');
        }

        return {
            hasUnnecessaryVolumes: hasCodeVolumeMount,
            hasUnnecessaryNetworks: hasNetworks && serviceCount <= 2,
            hasPlaceholderServices: hasPlaceholders,
            warnings
        };
    }
}
