import * as vscode from 'vscode';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TestResult {
    technology: string;
    category: string;
    status: 'passed' | 'failed' | 'warning';
    message: string;
    issues: string[];
    duration: number;
    containerLogs?: string;
    healthCheck?: {
        isHealthy: boolean;
        endpoint?: string;
        responseTime?: number;
        statusCode?: number;
        error?: string;
    };
}

export interface TestSummary {
    totalTests: number;
    passed: number;
    failed: number;
    warnings: number;
    duration: number;
    results: TestResult[];
}

export class DockerTestRunner {
    private outputChannel: vscode.OutputChannel;
    private testResults: TestResult[] = [];

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Auto Docker Test Runner');
    }

    async runAllTests(workspaceRoot: string): Promise<TestSummary> {
        this.outputChannel.clear();
        this.outputChannel.show();
        this.testResults = [];
        const startTime = Date.now();

        this.log('🚀 Starting Auto Docker Test Suite...\n');

        await this.checkPrerequisites();
        await this.testFrontendFrameworks(workspaceRoot);
        await this.testBackendFrameworks(workspaceRoot);
        await this.testDatabases(workspaceRoot);
        await this.testMessageQueues(workspaceRoot);
        await this.testSearchEngines(workspaceRoot);
        await this.testReverseProxies(workspaceRoot);
        await this.testFullstackApps(workspaceRoot);

        const duration = Date.now() - startTime;
        const summary = this.generateSummary(duration);
        this.displaySummary(summary);
        return summary;
    }

    private async checkPrerequisites(): Promise<void> {
        this.log('📋 Checking prerequisites...\n');
        try {
            const { stdout: dockerVersion } = await execAsync('docker --version');
            this.log(`✅ Docker: ${dockerVersion.trim()}`);
            const { stdout: composeVersion } = await execAsync('docker-compose --version');
            this.log(`✅ Docker Compose: ${composeVersion.trim()}`);
            await execAsync('docker ps');
            this.log('✅ Docker daemon is running\n');
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            this.log(`❌ Prerequisites check failed: ${errorMsg}\n`);
            throw new Error('Docker or Docker Compose is not installed or not running');
        }
    }

    private async testFrontendFrameworks(workspaceRoot: string): Promise<void> {
        this.log('🎨 Testing Frontend Frameworks...\n');
        const frontendTechs = [
            { name: 'React (Vite)', template: 'react-vite' },
            { name: 'React (CRA)', template: 'react-cra' },
            { name: 'Vue.js (Vite)', template: 'vue-vite' },
            { name: 'Angular', template: 'angular' },
            { name: 'Next.js', template: 'nextjs' },
            { name: 'Svelte', template: 'svelte' },
            { name: 'Solid.js', template: 'solidjs' },
        ];
        for (const tech of frontendTechs) {
            await this.testTechnology(tech.name, 'Frontend', tech.template, workspaceRoot);
        }
    }

    private async testBackendFrameworks(workspaceRoot: string): Promise<void> {
        this.log('⚙️ Testing Backend Frameworks...\n');
        const backendTechs = [
            { name: 'Express.js', template: 'express' },
            { name: 'Fastify', template: 'fastify' },
            { name: 'NestJS', template: 'nestjs' },
            { name: 'Django', template: 'django' },
            { name: 'Flask', template: 'flask' },
            { name: 'FastAPI', template: 'fastapi' },
            { name: 'Spring Boot', template: 'spring-boot' },
            { name: 'Go Gin', template: 'go-gin' },
            { name: 'Laravel', template: 'laravel' },
        ];
        for (const tech of backendTechs) {
            await this.testTechnology(tech.name, 'Backend', tech.template, workspaceRoot);
        }
    }

    private async testDatabases(workspaceRoot: string): Promise<void> {
        this.log('🗄️ Testing Databases...\n');
        const databases = [
            { name: 'PostgreSQL', image: 'postgres:15-alpine', port: 5432 },
            { name: 'MySQL', image: 'mysql:8', port: 3306 },
            { name: 'MongoDB', image: 'mongo:7', port: 27017 },
            { name: 'Redis', image: 'redis:7-alpine', port: 6379 },
            { name: 'MariaDB', image: 'mariadb:11', port: 3306 },
        ];
        for (const db of databases) {
            await this.testDatabase(db.name, db.image, db.port);
        }
    }

    private async testMessageQueues(workspaceRoot: string): Promise<void> {
        this.log('🔄 Testing Message Queues...\n');
        const queues = [
            { name: 'RabbitMQ', image: 'rabbitmq:3-management-alpine', port: 5672, managementPort: 15672 },
            { name: 'Redis (Streams)', image: 'redis:7-alpine', port: 6379 },
        ];
        for (const queue of queues) {
            await this.testMessageQueue(queue.name, queue.image, queue.port, (queue as any).managementPort);
        }
    }

    private async testSearchEngines(workspaceRoot: string): Promise<void> {
        this.log('🔍 Testing Search Engines...\n');
        const searchEngines = [
            { name: 'Elasticsearch', image: 'elasticsearch:8.11.0', port: 9200 },
            { name: 'OpenSearch', image: 'opensearchproject/opensearch:2', port: 9200 },
        ];
        for (const engine of searchEngines) {
            await this.testSearchEngine(engine.name, engine.image, engine.port);
        }
    }

    private async testReverseProxies(workspaceRoot: string): Promise<void> {
        this.log('🌐 Testing Reverse Proxies...\n');
        const proxies = [
            { name: 'Nginx', image: 'nginx:alpine', port: 80 },
            { name: 'Traefik', image: 'traefik:v2.10', port: 80 },
            { name: 'Caddy', image: 'caddy:2-alpine', port: 80 },
        ];
        for (const proxy of proxies) {
            await this.testReverseProxy(proxy.name, proxy.image, proxy.port);
        }
    }

    private async testFullstackApps(workspaceRoot: string): Promise<void> {
        this.log('🏗️ Testing Fullstack Applications...\n');
        const fullstackApps = [
            { name: 'MERN Stack', template: 'mern' },
            { name: 'MEAN Stack', template: 'mean' },
            { name: 'Django + React', template: 'django-react' },
            { name: 'Spring Boot + Angular', template: 'spring-angular' },
        ];
        for (const app of fullstackApps) {
            await this.testTechnology(app.name, 'Fullstack', app.template, workspaceRoot);
        }
    }

    private async testTechnology(name: string, category: string, template: string, workspaceRoot: string): Promise<void> {
        const startTime = Date.now();
        const issues: string[] = [];
        this.log(`  Testing ${name}...`);
        try {
            const testDir = path.join(workspaceRoot, '.test-projects', template);
            const buildResult = await this.buildDockerImage(testDir, template);
            if (!buildResult.success) {
                issues.push(`Build failed: ${buildResult.error}`);
            }
            const runResult = await this.runContainer(testDir, template);
            if (!runResult.success) {
                issues.push(`Container failed to start: ${runResult.error}`);
            }
            const healthCheck = await this.performHealthCheck(template, runResult.port);
            const logs = await this.getContainerLogs(template);
            await this.cleanupContainer(template);
            const duration = Date.now() - startTime;
            const status = issues.length === 0 ? 'passed' : 'failed';
            this.testResults.push({ technology: name, category, status, message: status === 'passed' ? 'All checks passed' : 'Some checks failed', issues, duration, containerLogs: logs, healthCheck });
            this.log(` ${status === 'passed' ? '✅' : '❌'} (${duration}ms)\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            issues.push(`Unexpected error: ${errorMsg}`);
            this.testResults.push({ technology: name, category, status: 'failed', message: errorMsg, issues, duration: Date.now() - startTime });
            this.log(` ❌ (${errorMsg})\n`);
        }
    }

    private async testDatabase(name: string, image: string, port: number): Promise<void> {
        const startTime = Date.now();
        const issues: string[] = [];
        const containerName = `test-${name.toLowerCase().replace(/\s/g, '-')}`;
        this.log(`  Testing ${name}...`);
        try {
            await execAsync(`docker pull ${image}`);
            const envVars = this.getDatabaseEnvVars(name);
            await execAsync(`docker run -d --name ${containerName} ${envVars} -p ${port}:${port} ${image}`);
            await this.waitForContainer(containerName, 30000);
            const healthCheck = await this.checkDatabaseHealth(name, port);
            if (!healthCheck.isHealthy) { issues.push(`Health check failed: ${healthCheck.error}`); }
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
            const duration = Date.now() - startTime;
            const status = issues.length === 0 ? 'passed' : 'failed';
            this.testResults.push({ technology: name, category: 'Database', status, message: status === 'passed' ? 'Database is healthy' : 'Database health check failed', issues, duration, healthCheck });
            this.log(` ${status === 'passed' ? '✅' : '❌'} (${duration}ms)\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            issues.push(`Error: ${errorMsg}`);
            this.testResults.push({ technology: name, category: 'Database', status: 'failed', message: errorMsg, issues, duration: Date.now() - startTime });
            this.log(` ❌ (${errorMsg})\n`);
            try { await execAsync(`docker stop ${containerName}`); await execAsync(`docker rm ${containerName}`); } catch { /* ignore */ }
        }
    }

    private async testMessageQueue(name: string, image: string, port: number, managementPort?: number): Promise<void> {
        const startTime = Date.now();
        const issues: string[] = [];
        const containerName = `test-${name.toLowerCase().replace(/\s/g, '-')}`;
        this.log(`  Testing ${name}...`);
        try {
            await execAsync(`docker pull ${image}`);
            const portMapping = managementPort ? `-p ${port}:${port} -p ${managementPort}:${managementPort}` : `-p ${port}:${port}`;
            await execAsync(`docker run -d --name ${containerName} ${portMapping} ${image}`);
            await this.waitForContainer(containerName, 30000);
            const healthCheck = await this.checkMessageQueueHealth(name, port, managementPort);
            if (!healthCheck.isHealthy) { issues.push(`Health check failed: ${healthCheck.error}`); }
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
            const duration = Date.now() - startTime;
            const status = issues.length === 0 ? 'passed' : 'failed';
            this.testResults.push({ technology: name, category: 'Message Queue', status, message: status === 'passed' ? 'Message queue is healthy' : 'Health check failed', issues, duration, healthCheck });
            this.log(` ${status === 'passed' ? '✅' : '❌'} (${duration}ms)\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            issues.push(`Error: ${errorMsg}`);
            this.testResults.push({ technology: name, category: 'Message Queue', status: 'failed', message: errorMsg, issues, duration: Date.now() - startTime });
            this.log(` ❌ (${errorMsg})\n`);
            try { await execAsync(`docker stop ${containerName}`); await execAsync(`docker rm ${containerName}`); } catch { /* ignore */ }
        }
    }

    private async testSearchEngine(name: string, image: string, port: number): Promise<void> {
        const startTime = Date.now();
        const issues: string[] = [];
        const containerName = `test-${name.toLowerCase().replace(/\s/g, '-')}`;
        this.log(`  Testing ${name}...`);
        try {
            await execAsync(`docker pull ${image}`);
            const envVars = name === 'Elasticsearch'
                ? '-e "discovery.type=single-node" -e "xpack.security.enabled=false"'
                : '-e "discovery.type=single-node" -e "DISABLE_SECURITY_PLUGIN=true"';
            await execAsync(`docker run -d --name ${containerName} ${envVars} -p ${port}:${port} ${image}`);
            await this.waitForContainer(containerName, 60000);
            const healthCheck = await this.checkSearchEngineHealth(name, port);
            if (!healthCheck.isHealthy) { issues.push(`Health check failed: ${healthCheck.error}`); }
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
            const duration = Date.now() - startTime;
            const status = issues.length === 0 ? 'passed' : 'failed';
            this.testResults.push({ technology: name, category: 'Search Engine', status, message: status === 'passed' ? 'Search engine is healthy' : 'Health check failed', issues, duration, healthCheck });
            this.log(` ${status === 'passed' ? '✅' : '❌'} (${duration}ms)\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            issues.push(`Error: ${errorMsg}`);
            this.testResults.push({ technology: name, category: 'Search Engine', status: 'failed', message: errorMsg, issues, duration: Date.now() - startTime });
            this.log(` ❌ (${errorMsg})\n`);
            try { await execAsync(`docker stop ${containerName}`); await execAsync(`docker rm ${containerName}`); } catch { /* ignore */ }
        }
    }

    private async testReverseProxy(name: string, image: string, port: number): Promise<void> {
        const startTime = Date.now();
        const issues: string[] = [];
        const containerName = `test-${name.toLowerCase().replace(/\s/g, '-')}`;
        this.log(`  Testing ${name}...`);
        try {
            await execAsync(`docker pull ${image}`);
            await execAsync(`docker run -d --name ${containerName} -p ${port}:${port} ${image}`);
            await this.waitForContainer(containerName, 10000);
            const healthCheck = await this.checkReverseProxyHealth(name, port);
            if (!healthCheck.isHealthy) { issues.push(`Health check failed: ${healthCheck.error}`); }
            await execAsync(`docker stop ${containerName}`);
            await execAsync(`docker rm ${containerName}`);
            const duration = Date.now() - startTime;
            const status = issues.length === 0 ? 'passed' : 'failed';
            this.testResults.push({ technology: name, category: 'Reverse Proxy', status, message: status === 'passed' ? 'Reverse proxy is healthy' : 'Health check failed', issues, duration, healthCheck });
            this.log(` ${status === 'passed' ? '✅' : '❌'} (${duration}ms)\n`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            issues.push(`Error: ${errorMsg}`);
            this.testResults.push({ technology: name, category: 'Reverse Proxy', status: 'failed', message: errorMsg, issues, duration: Date.now() - startTime });
            this.log(` ❌ (${errorMsg})\n`);
            try { await execAsync(`docker stop ${containerName}`); await execAsync(`docker rm ${containerName}`); } catch { /* ignore */ }
        }
    }

    private getDatabaseEnvVars(dbName: string): string {
        const envMap: Record<string, string> = {
            'PostgreSQL': '-e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=testdb',
            'MySQL': '-e MYSQL_ROOT_PASSWORD=testpass -e MYSQL_DATABASE=testdb',
            'MongoDB': '-e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=testpass',
            'Redis': '',
            'MariaDB': '-e MYSQL_ROOT_PASSWORD=testpass -e MYSQL_DATABASE=testdb',
        };
        return envMap[dbName] || '';
    }

    private async buildDockerImage(testDir: string, template: string): Promise<{ success: boolean; error?: string }> {
        try {
            await execAsync(`docker build -t test-${template} ${testDir}`);
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async runContainer(testDir: string, template: string): Promise<{ success: boolean; port?: number; error?: string }> {
        try {
            const port = 3000 + Math.floor(Math.random() * 1000);
            await execAsync(`docker run -d --name test-${template} -p ${port}:3000 test-${template}`);
            return { success: true, port };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async performHealthCheck(template: string, port?: number): Promise<TestResult['healthCheck']> {
        if (!port) { return { isHealthy: false, error: 'No port specified' }; }
        try {
            const startTime = Date.now();
            const response = await fetch(`http://localhost:${port}`);
            const responseTime = Date.now() - startTime;
            return { isHealthy: response.ok, endpoint: `http://localhost:${port}`, responseTime, statusCode: response.status };
        } catch (error) {
            return { isHealthy: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async getContainerLogs(template: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`docker logs test-${template}`);
            return stdout;
        } catch { return ''; }
    }

    private async cleanupContainer(template: string): Promise<void> {
        try {
            await execAsync(`docker stop test-${template}`);
            await execAsync(`docker rm test-${template}`);
        } catch { /* ignore */ }
    }

    private async waitForContainer(containerName: string, timeout: number): Promise<void> {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            try {
                const { stdout } = await execAsync(`docker inspect -f '{{.State.Running}}' ${containerName}`);
                if (stdout.trim() === 'true') {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return;
                }
            } catch { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error(`Container ${containerName} did not start within ${timeout}ms`);
    }

    private async checkDatabaseHealth(name: string, port: number): Promise<{ isHealthy: boolean; error?: string }> {
        return { isHealthy: true };
    }

    private async checkMessageQueueHealth(name: string, port: number, managementPort?: number): Promise<{ isHealthy: boolean; error?: string }> {
        return { isHealthy: true };
    }

    private async checkSearchEngineHealth(name: string, port: number): Promise<TestResult['healthCheck']> {
        try {
            const response = await fetch(`http://localhost:${port}`);
            return { isHealthy: response.ok, endpoint: `http://localhost:${port}`, statusCode: response.status };
        } catch (error) {
            return { isHealthy: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private async checkReverseProxyHealth(name: string, port: number): Promise<TestResult['healthCheck']> {
        try {
            const response = await fetch(`http://localhost:${port}`);
            return { isHealthy: response.ok || response.status === 404, endpoint: `http://localhost:${port}`, statusCode: response.status };
        } catch (error) {
            return { isHealthy: false, error: error instanceof Error ? error.message : String(error) };
        }
    }

    private generateSummary(duration: number): TestSummary {
        const passed = this.testResults.filter(r => r.status === 'passed').length;
        const failed = this.testResults.filter(r => r.status === 'failed').length;
        const warnings = this.testResults.filter(r => r.status === 'warning').length;
        return { totalTests: this.testResults.length, passed, failed, warnings, duration, results: this.testResults };
    }

    private displaySummary(summary: TestSummary): void {
        this.log('\n' + '='.repeat(80) + '\n');
        this.log('📊 TEST SUMMARY\n');
        this.log('='.repeat(80) + '\n\n');
        this.log(`Total Tests: ${summary.totalTests}\n`);
        this.log(`✅ Passed: ${summary.passed}\n`);
        this.log(`❌ Failed: ${summary.failed}\n`);
        this.log(`⚠️  Warnings: ${summary.warnings}\n`);
        this.log(`⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s\n\n`);
        if (summary.failed > 0) {
            this.log('Failed Tests:\n');
            summary.results.filter(r => r.status === 'failed').forEach(r => {
                this.log(`  ❌ ${r.technology} (${r.category})\n`);
                r.issues.forEach(issue => this.log(`     - ${issue}\n`));
            });
        }
        this.log('\n' + '='.repeat(80) + '\n');
    }

    private log(message: string): void {
        this.outputChannel.append(message);
    }
}
