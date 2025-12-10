import * as fs from 'fs';
import * as path from 'path';

/**
 * Test helper utilities for Auto Docker Extension tests
 */

export interface MockProjectConfig {
    type: 'react' | 'vue' | 'angular' | 'express' | 'django' | 'flask' | 'fullstack';
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

/**
 * Create a mock project structure for testing
 */
export function createMockProject(config: MockProjectConfig, projectPath: string): void {
    // Create project directory
    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
    }

    const projectName = config.name || 'test-project';

    switch (config.type) {
        case 'react':
            createReactProject(projectPath, projectName, config);
            break;
        case 'vue':
            createVueProject(projectPath, projectName, config);
            break;
        case 'angular':
            createAngularProject(projectPath, projectName, config);
            break;
        case 'express':
            createExpressProject(projectPath, projectName, config);
            break;
        case 'django':
            createDjangoProject(projectPath, projectName);
            break;
        case 'flask':
            createFlaskProject(projectPath, projectName);
            break;
        case 'fullstack':
            createFullstackProject(projectPath, projectName, config);
            break;
    }
}

function createReactProject(projectPath: string, name: string, config: MockProjectConfig): void {
    const packageJson = {
        name,
        version: '1.0.0',
        dependencies: config.dependencies || {
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
        },
        devDependencies: config.devDependencies || {
            'vite': '^4.0.0',
            '@vitejs/plugin-react': '^3.0.0'
        },
        scripts: config.scripts || {
            'dev': 'vite',
            'build': 'vite build'
        }
    };

    fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );

    // Create src directory with App component
    const srcPath = path.join(projectPath, 'src');
    fs.mkdirSync(srcPath, { recursive: true });
    fs.writeFileSync(
        path.join(srcPath, 'App.tsx'),
        'export default function App() { return <div>Hello World</div>; }'
    );
    fs.writeFileSync(
        path.join(srcPath, 'main.tsx'),
        'import React from "react";\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\n\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);'
    );

    // Create index.html
    fs.writeFileSync(
        path.join(projectPath, 'index.html'),
        '<!DOCTYPE html>\n<html><body><div id="root"></div></body></html>'
    );
}

function createVueProject(projectPath: string, name: string, config: MockProjectConfig): void {
    const packageJson = {
        name,
        version: '1.0.0',
        dependencies: config.dependencies || {
            'vue': '^3.3.0'
        },
        devDependencies: config.devDependencies || {
            '@vue/cli-service': '^5.0.0'
        }
    };

    fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );

    const srcPath = path.join(projectPath, 'src');
    fs.mkdirSync(srcPath, { recursive: true });
    fs.writeFileSync(
        path.join(srcPath, 'App.vue'),
        '<template><div>Hello World</div></template>'
    );
}

function createAngularProject(projectPath: string, name: string, config: MockProjectConfig): void {
    const packageJson = {
        name,
        version: '1.0.0',
        dependencies: config.dependencies || {
            '@angular/core': '^16.0.0',
            '@angular/common': '^16.0.0'
        }
    };

    fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );

    const srcPath = path.join(projectPath, 'src');
    fs.mkdirSync(srcPath, { recursive: true });
    fs.writeFileSync(
        path.join(srcPath, 'app.component.ts'),
        'import { Component } from "@angular/core";\n@Component({ selector: "app-root" })\nexport class AppComponent {}'
    );
}

function createExpressProject(projectPath: string, name: string, config: MockProjectConfig): void {
    const packageJson = {
        name,
        version: '1.0.0',
        dependencies: config.dependencies || {
            'express': '^4.18.0'
        },
        scripts: config.scripts || {
            'start': 'node index.js'
        }
    };

    fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );

    fs.writeFileSync(
        path.join(projectPath, 'index.js'),
        'const express = require("express");\nconst app = express();\napp.listen(3000);'
    );
}

function createDjangoProject(projectPath: string, name: string): void {
    fs.writeFileSync(
        path.join(projectPath, 'requirements.txt'),
        'Django==4.2.0\ngunicorn==20.1.0\npsycopg2-binary==2.9.5'
    );

    fs.writeFileSync(
        path.join(projectPath, 'manage.py'),
        '#!/usr/bin/env python\nimport sys\nfrom django.core.management import execute_from_command_line'
    );
}

function createFlaskProject(projectPath: string, name: string): void {
    fs.writeFileSync(
        path.join(projectPath, 'requirements.txt'),
        'Flask==2.3.0\ngunicorn==20.1.0'
    );

    fs.writeFileSync(
        path.join(projectPath, 'app.py'),
        'from flask import Flask\napp = Flask(__name__)\nif __name__ == "__main__":\n    app.run()'
    );
}

function createFullstackProject(projectPath: string, name: string, config: MockProjectConfig): void {
    // Create frontend
    const frontendPath = path.join(projectPath, 'frontend');
    createReactProject(frontendPath, `${name}-frontend`, config);

    // Create backend
    const backendPath = path.join(projectPath, 'backend');
    createExpressProject(backendPath, `${name}-backend`, config);

    // Create root package.json for monorepo
    const rootPackageJson = {
        name,
        version: '1.0.0',
        private: true,
        workspaces: ['frontend', 'backend']
    };

    fs.writeFileSync(
        path.join(projectPath, 'package.json'),
        JSON.stringify(rootPackageJson, null, 2)
    );
}

/**
 * Create a monorepo project structure
 */
export function createMonorepoProject(workspaces: string[], projectPath: string, type: 'yarn' | 'pnpm' | 'lerna' = 'yarn'): void {
    if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
    }

    // Create workspaces
    workspaces.forEach(workspace => {
        const workspacePath = path.join(projectPath, workspace);
        createMockProject({ type: 'express' }, workspacePath);
    });

    // Create root configuration based on type
    if (type === 'yarn' || type === 'pnpm') {
        const packageJson = {
            name: 'monorepo-test',
            version: '1.0.0',
            private: true,
            workspaces
        };

        fs.writeFileSync(
            path.join(projectPath, 'package.json'),
            JSON.stringify(packageJson, null, 2)
        );

        if (type === 'pnpm') {
            fs.writeFileSync(
                path.join(projectPath, 'pnpm-workspace.yaml'),
                `packages:\n${workspaces.map(w => `  - '${w}'`).join('\n')}`
            );
        }
    } else if (type === 'lerna') {
        const lernaJson = {
            version: '1.0.0',
            packages: workspaces
        };

        fs.writeFileSync(
            path.join(projectPath, 'lerna.json'),
            JSON.stringify(lernaJson, null, 2)
        );
    }
}

/**
 * Verify Dockerfile syntax is valid
 */
export function verifyDockerfileSyntax(content: string): boolean {
    // Basic Dockerfile syntax validation
    const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    
    // Must have at least one FROM instruction
    if (!content.includes('FROM ')) {
        return false;
    }

    // Check for common instructions
    const validInstructions = ['FROM', 'RUN', 'COPY', 'ADD', 'WORKDIR', 'ENV', 'EXPOSE', 'CMD', 'ENTRYPOINT', 'ARG', 'VOLUME', 'USER', 'LABEL', 'HEALTHCHECK'];
    
    for (const line of lines) {
        const instruction = line.trim().split(' ')[0].toUpperCase();
        if (!validInstructions.includes(instruction) && !line.includes('=')) {
            // Allow for continuation lines and variable assignments
            if (!line.startsWith(' ') && !line.startsWith('\t')) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Verify docker-compose.yml syntax is valid
 */
export function verifyDockerComposeSyntax(content: string): boolean {
    // Basic YAML validation
    try {
        // Check for required fields
        const hasVersion = content.includes('version:') || content.includes('services:');
        const hasServices = content.includes('services:');
        
        return hasVersion && hasServices;
    } catch {
        return false;
    }
}

/**
 * Verify nginx.conf syntax is valid
 */
export function verifyNginxSyntax(content: string): boolean {
    // Basic nginx.conf validation
    const hasServer = content.includes('server {') || content.includes('server{');
    const hasListen = content.includes('listen ');
    const hasLocation = content.includes('location ');
    
    // Check for balanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    
    return hasServer && hasListen && hasLocation && openBraces === closeBraces;
}

/**
 * Clean up test workspace directory
 */
export function cleanupTestWorkspace(workspacePath: string): void {
    if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
    }
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(condition: () => boolean, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (!condition()) {
        if (Date.now() - startTime > timeout) {
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return true;
}

/**
 * Create a mock .env file
 */
export function createMockEnvFile(projectPath: string, vars: Record<string, string>): void {
    const content = Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    
    fs.writeFileSync(path.join(projectPath, '.env'), content);
}
