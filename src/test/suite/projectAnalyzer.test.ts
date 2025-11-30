import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectAnalyzer } from '../../projectAnalyzer';

suite('ProjectAnalyzer Test Suite', () => {
    let testWorkspaceRoot: string;

    setup(() => {
        // Create a temporary test workspace
        testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        // Cleanup test workspace
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    suite('Project Type Detection', () => {
        test('Should detect React frontend project', async () => {
            const packageJson = {
                name: 'test-react-app',
                dependencies: {
                    'react': '^18.0.0',
                    'react-dom': '^18.0.0'
                },
                devDependencies: {
                    'vite': '^4.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.projectType.includes('frontend') || result.frontend, true);
        });

        test('Should detect Node.js Express backend project', async () => {
            const packageJson = {
                name: 'test-express-api',
                dependencies: {
                    'express': '^4.18.0',
                    'cors': '^2.8.5'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.projectType.includes('backend') || result.backend, true);
        });

        test('Should detect Python Flask project', async () => {
            const requirementsTxt = 'Flask==2.3.0\ngunicorn==20.1.0\npython-dotenv==1.0.0';

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'requirements.txt'),
                requirementsTxt
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.projectType.includes('backend') || result.backend, true);
        });

        test('Should detect Django project', async () => {
            const requirementsTxt = 'Django==4.2.0\npsycopg2-binary==2.9.5';

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'requirements.txt'),
                requirementsTxt
            );

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'manage.py'),
                '#!/usr/bin/env python\nif __name__ == "__main__":\n    pass'
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.projectType.includes('backend') || result.backend, true);
        });

        test('Should detect fullstack MERN project', async () => {
            const packageJson = {
                name: 'mern-app',
                dependencies: {
                    'express': '^4.18.0',
                    'mongoose': '^7.0.0',
                    'react': '^18.0.0',
                    'react-dom': '^18.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.projectType.includes('fullstack') || 
                              (result.frontend && result.backend), true);
        });
    });

    suite('Database Detection', () => {
        test('Should detect PostgreSQL dependency', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'pg': '^8.11.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.database?.includes('postgres') || 
                              result.databases?.includes('postgres'), true);
        });

        test('Should detect MongoDB dependency', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'mongoose': '^7.0.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.database?.includes('mongo') || 
                              result.databases?.includes('mongodb'), true);
        });

        test('Should detect multiple databases', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'pg': '^8.11.0',
                    'mongoose': '^7.0.0',
                    'redis': '^4.6.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.databases && result.databases.length >= 2, true);
        });

        test('Should detect Redis cache layer', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'redis': '^4.6.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.cacheLayer === 'redis' || 
                              result.databases?.includes('redis'), true);
        });
    });

    suite('Monorepo Detection', () => {
        test('Should detect monorepo structure with frontend/backend folders', async () => {
            // Create frontend folder with package.json
            const frontendDir = path.join(testWorkspaceRoot, 'frontend');
            fs.mkdirSync(frontendDir, { recursive: true });

            const frontendPackage = {
                name: 'frontend',
                dependencies: {
                    'react': '^18.0.0',
                    'react-dom': '^18.0.0'
                }
            };

            fs.writeFileSync(
                path.join(frontendDir, 'package.json'),
                JSON.stringify(frontendPackage, null, 2)
            );

            // Create backend folder with package.json
            const backendDir = path.join(testWorkspaceRoot, 'backend');
            fs.mkdirSync(backendDir, { recursive: true });

            const backendPackage = {
                name: 'backend',
                dependencies: {
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(backendDir, 'package.json'),
                JSON.stringify(backendPackage, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.isMonorepo, true);
            assert.strictEqual(result.frontendPath?.includes('frontend'), true);
            assert.strictEqual(result.backendPath?.includes('backend'), true);
        });

        test('Should detect npm workspaces', async () => {
            const rootPackage = {
                name: 'root',
                workspaces: ['packages/*']
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(rootPackage, null, 2)
            );

            const packagesDir = path.join(testWorkspaceRoot, 'packages');
            fs.mkdirSync(packagesDir, { recursive: true });

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(Array.isArray(result.workspaces), true);
        });
    });

    suite('Advanced Services Detection', () => {
        test('Should detect RabbitMQ message queue', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'amqplib': '^0.10.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.messageQueue === 'rabbitmq', true);
        });

        test('Should detect Kafka message queue', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'kafkajs': '^2.0.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.messageQueue === 'kafka', true);
        });

        test('Should detect Elasticsearch', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    '@elastic/elasticsearch': '^8.0.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.searchEngine === 'elasticsearch', true);
        });
    });

    suite('Environment Files Detection', () => {
        test('Should detect .env file', async () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, '.env'),
                'DATABASE_URL=postgres://localhost:5432/db\nAPI_KEY=test123'
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.hasEnvFile, true);
        });

        test('Should extract environment variables', async () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, '.env'),
                'DATABASE_URL=postgres://localhost:5432/db\nAPI_KEY=test123\nPORT=3000'
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.envVars && result.envVars.length > 0, true);
        });
    });

    suite('Special Features Detection', () => {
        test('Should detect Prisma ORM', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    '@prisma/client': '^5.0.0'
                },
                devDependencies: {
                    'prisma': '^5.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.hasPrisma, true);
        });

        test('Should detect WebSocket support', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'socket.io': '^4.6.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            const result = await analyzer.analyzeProject();

            assert.strictEqual(result.hasWebSocket, true);
        });
    });

    suite('Performance Tests', () => {
        test('Should analyze project within acceptable time (< 5 seconds)', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'express': '^4.18.0',
                    'pg': '^8.11.0',
                    'redis': '^4.6.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            
            const startTime = Date.now();
            await analyzer.analyzeProject();
            const endTime = Date.now();
            
            const executionTime = endTime - startTime;
            assert.strictEqual(executionTime < 5000, true, 
                `Analysis took ${executionTime}ms, should be under 5000ms`);
        });

        test('Should handle large project with many files efficiently', async () => {
            // Create multiple files
            for (let i = 0; i < 50; i++) {
                fs.writeFileSync(
                    path.join(testWorkspaceRoot, `file${i}.js`),
                    `module.exports = { test: ${i} };`
                );
            }

            const packageJson = {
                name: 'large-project',
                dependencies: {
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const analyzer = new ProjectAnalyzer(testWorkspaceRoot);
            
            const startTime = Date.now();
            const result = await analyzer.analyzeProject();
            const endTime = Date.now();
            
            const executionTime = endTime - startTime;
            assert.strictEqual(executionTime < 10000, true, 
                `Large project analysis took ${executionTime}ms, should be under 10000ms`);
            assert.strictEqual(result.files.length <= 50, true, 
                'Should limit files for performance');
        });
    });
});
