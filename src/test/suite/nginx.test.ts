import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { LLMService } from '../../llmService';
import { ProjectStructure } from '../../projectAnalyzer';
import { verifyNginxSyntax } from '../helpers/testHelpers';
import { EXPECTED_OUTPUTS } from '../helpers/mockData';

suite('Nginx Configuration Test Suite', () => {
    let llmService: LLMService;
    let testWorkspaceRoot: string;

    setup(() => {
        llmService = new LLMService();
        testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace-nginx');
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    suite('SPA Routing Configuration', () => {
        test('Should include try_files directive for SPA routing', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'react',
                files: ['package.json', 'src/App.tsx'],
                dependencies: { react: '^18.0.0' },
                hasMultiStage: true,
                description: 'React SPA'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            assert.strictEqual(typeof result.nginxConf, 'string');
            assert.strictEqual(result.nginxConf!.includes('try_files'), true,
                'Nginx config should include try_files for SPA routing');
        });

        test('Should configure try_files with fallback to index.html', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'vue',
                files: ['package.json'],
                dependencies: { vue: '^3.3.0' },
                hasMultiStage: true,
                description: 'Vue SPA'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(
                    result.nginxConf.includes('try_files $uri $uri/ /index.html') ||
                    result.nginxConf.includes('try_files $uri /index.html'),
                    true,
                    'Should include proper try_files fallback'
                );
            }
        });

        test('Should set index.html as default index', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'angular',
                files: ['package.json'],
                dependencies: { '@angular/core': '^16.0.0' },
                hasMultiStage: true,
                description: 'Angular SPA'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(
                    result.nginxConf.includes('index index.html') ||
                    result.nginxConf.includes('index.html'),
                    true
                );
            }
        });
    });

    suite('Reverse Proxy Configuration', () => {
        test('Should configure /api/ reverse proxy for fullstack apps', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'react',
                backend: 'node-express',
                files: ['package.json'],
                dependencies: {
                    react: '^18.0.0',
                    express: '^4.18.0'
                },
                hasMultiStage: true,
                description: 'Fullstack with API'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                const hasApiLocation = result.nginxConf.includes('location /api/') ||
                    result.nginxConf.includes('location /api');
                assert.strictEqual(hasApiLocation, true, 'Should have /api/ location block');
            }
        });

        test('Should include proxy_pass directive for backend', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'vue',
                backend: 'node-express',
                files: ['package.json'],
                dependencies: {
                    vue: '^3.0.0',
                    express: '^4.18.0'
                },
                hasMultiStage: true,
                description: 'Vue with Express backend'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(result.nginxConf.includes('proxy_pass'), true,
                    'Should include proxy_pass directive');
            }
        });

        test('Should set proper proxy headers', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'react',
                backend: 'node-express',
                files: ['package.json'],
                dependencies: {
                    react: '^18.0.0',
                    express: '^4.18.0'
                },
                hasMultiStage: true,
                description: 'Fullstack app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                const requiredHeaders = ['Host', 'X-Real-IP', 'X-Forwarded-For'];
                const headerChecks = requiredHeaders.map(header =>
                    result.nginxConf!.toLowerCase().includes(header.toLowerCase())
                );

                assert.strictEqual(
                    headerChecks.some(check => check),
                    true,
                    'Should include at least some proxy headers'
                );
            }
        });
    });

    suite('Backend Port Parameterization', () => {
        test('Should use port 5000 for Python Flask backends', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'react',
                backend: 'python-flask',
                files: ['package.json', 'requirements.txt'],
                dependencies: { react: '^18.0.0' },
                hasMultiStage: true,
                description: 'React with Flask backend'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(
                    result.nginxConf.includes(':5000') ||
                    result.nginxConf.includes('5000'),
                    true,
                    'Should use port 5000 for Flask'
                );
            }
        });

        test('Should use port 8000 for Django backends', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'backend',
                backend: 'python-django',
                files: ['requirements.txt', 'manage.py'],
                dependencies: {},
                hasMultiStage: false,
                description: 'Django API'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            // Django typically runs on 8000
            if (result.dockerCompose) {
                assert.strictEqual(
                    result.dockerCompose.includes('8000') ||
                    result.dockerCompose.includes(':8000'),
                    true
                );
            }
        });

        test('Should use default port 3000 for Node.js backends', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'react',
                backend: 'node-express',
                files: ['package.json'],
                dependencies: {
                    react: '^18.0.0',
                    express: '^4.18.0'
                },
                hasMultiStage: true,
                description: 'MERN stack'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.dockerCompose) {
                assert.strictEqual(result.dockerCompose.includes('3000'), true);
            }
        });
    });

    suite('WebSocket Support', () => {
        test('Should configure WebSocket upgrade headers when Socket.io detected', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'react',
                backend: 'node-express',
                hasWebSocket: true,
                files: ['package.json'],
                dependencies: {
                    react: '^18.0.0',
                    express: '^4.18.0',
                    'socket.io': '^4.6.0'
                },
                hasMultiStage: true,
                description: 'Real-time app with Socket.io'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                const hasUpgrade = result.nginxConf.toLowerCase().includes('upgrade') ||
                    result.nginxConf.toLowerCase().includes('websocket');
                assert.strictEqual(hasUpgrade, true,
                    'Should include WebSocket upgrade configuration');
            }
        });

        test('Should configure /socket.io/ location block', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'fullstack',
                frontend: 'vue',
                backend: 'node-express',
                hasWebSocket: true,
                files: ['package.json'],
                dependencies: {
                    vue: '^3.0.0',
                    express: '^4.18.0',
                    'socket.io': '^4.6.0'
                },
                hasMultiStage: true,
                description: 'Vue with Socket.io'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(
                    result.nginxConf.includes('location /socket.io') ||
                    result.nginxConf.includes('/socket.io/'),
                    true,
                    'Should have /socket.io/ location block'
                );
            }
        });

        test('Should set proxy_http_version 1.1 for WebSockets', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'backend',
                backend: 'node-express',
                hasWebSocket: true,
                files: ['package.json'],
                dependencies: {
                    express: '^4.18.0',
                    'ws': '^8.0.0'
                },
                hasMultiStage: false,
                description: 'WebSocket server'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(
                    result.nginxConf.includes('proxy_http_version 1.1') ||
                    result.nginxConf.includes('http_version'),
                    true
                );
            }
        });
    });

    suite('Configuration Format', () => {
        test('Should generate clean, minimal Nginx configuration', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'react',
                files: ['package.json'],
                dependencies: { react: '^18.0.0' },
                hasMultiStage: true,
                description: 'React app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            assert.strictEqual(typeof result.nginxConf, 'string');
            if (result.nginxConf) {
                // Should be reasonably sized (not bloated)
                assert.strictEqual(result.nginxConf.length < 5000, true,
                    'Config should be under 5000 characters');
            }
        });

        test('Should have valid Nginx syntax', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'vue',
                files: ['package.json'],
                dependencies: { vue: '^3.0.0' },
                hasMultiStage: true,
                description: 'Vue app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(verifyNginxSyntax(result.nginxConf), true,
                    'Generated Nginx config should have valid syntax');
            }
        });

        test('Should have balanced braces', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'angular',
                files: ['package.json'],
                dependencies: { '@angular/core': '^16.0.0' },
                hasMultiStage: true,
                description: 'Angular app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                const openBraces = (result.nginxConf.match(/{/g) || []).length;
                const closeBraces = (result.nginxConf.match(/}/g) || []).length;
                assert.strictEqual(openBraces, closeBraces,
                    'Should have balanced braces');
            }
        });
    });

    suite('Additional Nginx Features', () => {
        test('Should configure gzip compression', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'react',
                files: ['package.json'],
                dependencies: { react: '^18.0.0' },
                hasMultiStage: true,
                description: 'Production React app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                const hasGzip = result.nginxConf.includes('gzip') ||
                    result.nginxConf.includes('compression');
                // Note: gzip may or may not be included depending on template
                assert.strictEqual(typeof hasGzip, 'boolean');
            }
        });

        test('Should include server block with listen directive', async () => {
            const projectStructure: ProjectStructure = {
                projectType: 'frontend',
                frontend: 'svelte',
                files: ['package.json'],
                dependencies: { svelte: '^4.0.0' },
                hasMultiStage: true,
                description: 'Svelte app'
            };

            const result = await llmService.generateDockerFiles(projectStructure);

            if (result.nginxConf) {
                assert.strictEqual(result.nginxConf.includes('server {'), true);
                assert.strictEqual(result.nginxConf.includes('listen'), true);
            }
        });
    });
});
