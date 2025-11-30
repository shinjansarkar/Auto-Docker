import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { detectStack } from '../../detector';

suite('Detector Test Suite', () => {
    let testWorkspaceRoot: string;

    setup(() => {
        testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace-detector');
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    suite('Frontend Framework Detection', () => {
        test('Should detect React with Vite', async () => {
            const packageJson = {
                name: 'react-vite-app',
                dependencies: {
                    'react': '^18.2.0',
                    'react-dom': '^18.2.0'
                },
                devDependencies: {
                    'vite': '^4.0.0',
                    '@vitejs/plugin-react': '^3.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.framework, 'react');
            assert.strictEqual(result.frontend.buildTool, 'vite');
            assert.strictEqual(result.frontend.port, 3000);
        });

        test('Should detect Vue.js', async () => {
            const packageJson = {
                name: 'vue-app',
                dependencies: {
                    'vue': '^3.3.0'
                },
                devDependencies: {
                    '@vue/cli-service': '^5.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.framework, 'vue');
        });

        test('Should detect Angular', async () => {
            const packageJson = {
                name: 'angular-app',
                dependencies: {
                    '@angular/core': '^16.0.0',
                    '@angular/common': '^16.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.framework, 'angular');
            assert.strictEqual(result.frontend.port, 4200);
        });

        test('Should detect Next.js', async () => {
            const packageJson = {
                name: 'nextjs-app',
                dependencies: {
                    'next': '^13.0.0',
                    'react': '^18.2.0',
                    'react-dom': '^18.2.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.framework, 'nextjs');
        });

        test('Should detect Svelte', async () => {
            const packageJson = {
                name: 'svelte-app',
                dependencies: {
                    'svelte': '^4.0.0'
                },
                devDependencies: {
                    'vite': '^4.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.framework, 'svelte');
        });
    });

    suite('Backend Framework Detection', () => {
        test('Should detect Express.js', async () => {
            const packageJson = {
                name: 'express-api',
                dependencies: {
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'node-express');
        });

        test('Should detect NestJS', async () => {
            const packageJson = {
                name: 'nestjs-api',
                dependencies: {
                    '@nestjs/core': '^10.0.0',
                    '@nestjs/common': '^10.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'node-nestjs');
        });

        test('Should detect Fastify', async () => {
            const packageJson = {
                name: 'fastify-api',
                dependencies: {
                    'fastify': '^4.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'node-fastify');
        });

        test('Should detect Flask (Python)', async () => {
            const requirementsTxt = 'Flask==2.3.0\ngunicorn==20.1.0';

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'requirements.txt'),
                requirementsTxt
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'python-flask');
        });

        test('Should detect Django (Python)', async () => {
            const requirementsTxt = 'Django==4.2.0\npsycopg2-binary==2.9.5';

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'requirements.txt'),
                requirementsTxt
            );

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'manage.py'),
                '#!/usr/bin/env python\n'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'python-django');
        });

        test('Should detect FastAPI (Python)', async () => {
            const requirementsTxt = 'fastapi==0.100.0\nuvicorn==0.23.0';

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'requirements.txt'),
                requirementsTxt
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'python-fastapi');
        });

        test('Should detect Spring Boot (Java)', async () => {
            const pomXml = `<?xml version="1.0" encoding="UTF-8"?>
<project>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
</project>`;

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'pom.xml'),
                pomXml
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'java-spring-boot');
        });

        test('Should detect Go Gin', async () => {
            const goMod = `module example.com/app

go 1.20

require github.com/gin-gonic/gin v1.9.0`;

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'go.mod'),
                goMod
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.backend.framework, 'go-gin');
        });
    });

    suite('Database Detection', () => {
        test('Should detect PostgreSQL from package.json', async () => {
            const packageJson = {
                name: 'app-with-pg',
                dependencies: {
                    'pg': '^8.11.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );
            
            // Create a .env file with postgres connection string to trigger detection
            fs.writeFileSync(
                path.join(testWorkspaceRoot, '.env'),
                'DATABASE_URL=postgres://user:pass@localhost:5432/mydb'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.database.type, 'postgres');
        });

        test('Should detect MongoDB from package.json', async () => {
            const packageJson = {
                name: 'app-with-mongo',
                dependencies: {
                    'mongoose': '^7.0.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.database.type, 'mongodb');
        });

        test('Should detect MySQL from package.json', async () => {
            const packageJson = {
                name: 'app-with-mysql',
                dependencies: {
                    'mysql2': '^3.0.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );
            
            // Create a .env file with mysql connection string to trigger detection
            fs.writeFileSync(
                path.join(testWorkspaceRoot, '.env'),
                'DATABASE_URL=mysql://user:pass@localhost:3306/mydb'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.database.type, 'mysql');
        });

        test('Should detect Redis', async () => {
            const packageJson = {
                name: 'app-with-redis',
                dependencies: {
                    'redis': '^4.6.0',
                    'express': '^4.18.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.database.type, 'redis');
        });
    });

    suite('Docker Files Detection', () => {
        test('Should detect existing Dockerfile', async () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'Dockerfile'),
                'FROM node:18\nWORKDIR /app'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.hasDockerfile, true);
        });

        test('Should detect existing docker-compose.yml', async () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'docker-compose.yml'),
                'version: "3.8"\nservices:\n  app:\n    build: .'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.hasDockerCompose, true);
        });

        test('Should detect existing nginx.conf', async () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'nginx.conf'),
                'server {\n  listen 80;\n}'
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.hasNginxConfig, true);
        });
    });

    suite('Evidence Collection', () => {
        test('Should collect evidence for framework detection', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'react': '^18.2.0',
                    'react-dom': '^18.2.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const result = await detectStack(testWorkspaceRoot);

            assert.strictEqual(result.frontend.evidence.length > 0, true);
            assert.strictEqual(
                result.frontend.evidence.some(e => e.toLowerCase().includes('react')),
                true
            );
        });
    });

    suite('Performance Tests', () => {
        test('Should detect stack within acceptable time (< 2 seconds)', async () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'express': '^4.18.0',
                    'react': '^18.2.0',
                    'pg': '^8.11.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const startTime = Date.now();
            await detectStack(testWorkspaceRoot);
            const endTime = Date.now();

            const executionTime = endTime - startTime;
            assert.strictEqual(executionTime < 2000, true,
                `Detection took ${executionTime}ms, should be under 2000ms`);
        });

        test('Should handle missing files gracefully', async () => {
            const startTime = Date.now();
            const result = await detectStack(testWorkspaceRoot);
            const endTime = Date.now();

            const executionTime = endTime - startTime;
            assert.strictEqual(executionTime < 1000, true);
            assert.strictEqual(result.frontend.framework, 'unknown');
            assert.strictEqual(result.backend.framework, 'unknown');
        });
    });
});
