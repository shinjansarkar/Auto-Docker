import * as fs from 'fs';
import * as path from 'path';

export class TestProjectGenerator {
    static async generateAllTestProjects(baseDir: string): Promise<void> {
        const testProjectsDir = path.join(baseDir, '.test-projects');
        if (!fs.existsSync(testProjectsDir)) {
            fs.mkdirSync(testProjectsDir, { recursive: true });
        }
        await this.generateReactViteProject(testProjectsDir);
        await this.generateVueProject(testProjectsDir);
        await this.generateAngularProject(testProjectsDir);
        await this.generateNextJsProject(testProjectsDir);
        await this.generateExpressProject(testProjectsDir);
        await this.generateDjangoProject(testProjectsDir);
        await this.generateFlaskProject(testProjectsDir);
        await this.generateFastAPIProject(testProjectsDir);
        await this.generateSpringBootProject(testProjectsDir);
        await this.generateMERNProject(testProjectsDir);
        await this.generateDjangoReactProject(testProjectsDir);
    }

    static async generateReactViteProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'react-vite');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'package.json': JSON.stringify({ name: 'react-vite-test', version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }, devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^4.3.9' } }, null, 2),
            'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: '0.0.0.0', port: 3000 }\n})`,
            'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>React Vite Test</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>`,
            'src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)`,
            'src/App.jsx': `import React from 'react'\nexport default function App() {\n  return (<div style={{ padding: '20px' }}><h1>🚀 React + Vite Test</h1><p>Status: ✅ Running</p></div>)\n}`
        });
    }

    static async generateExpressProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'express');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'package.json': JSON.stringify({ name: 'express-test', version: '1.0.0', main: 'index.js', scripts: { start: 'node index.js', dev: 'nodemon index.js' }, dependencies: { express: '^4.18.2', cors: '^2.8.5', dotenv: '^16.0.3' }, devDependencies: { nodemon: '^3.0.1' } }, null, 2),
            'index.js': `const express = require('express');\nconst cors = require('cors');\nrequire('dotenv').config();\nconst app = express();\nconst PORT = process.env.PORT || 3000;\napp.use(cors());\napp.use(express.json());\napp.get('/', (req, res) => res.json({ message: '🚀 Express.js Test', status: 'running' }));\napp.get('/health', (req, res) => res.json({ status: 'healthy' }));\napp.listen(PORT, '0.0.0.0', () => console.log(\`Server running on port \${PORT}\`));`,
            '.env': `PORT=3000\nNODE_ENV=development`
        });
    }

    static async generateDjangoProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'django');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'requirements.txt': `Django==4.2.0\ndjangorestframework==3.14.0\ndjango-cors-headers==4.0.0\ngunicorn==20.1.0`,
            'manage.py': `#!/usr/bin/env python\nimport os, sys\nif __name__ == '__main__':\n    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'testproject.settings')\n    from django.core.management import execute_from_command_line\n    execute_from_command_line(sys.argv)`,
            'testproject/__init__.py': '',
            'testproject/settings.py': `import os\nfrom pathlib import Path\nBASE_DIR = Path(__file__).resolve().parent.parent\nSECRET_KEY = 'django-test-secret-key'\nDEBUG = True\nALLOWED_HOSTS = ['*']\nINSTALLED_APPS = ['django.contrib.admin','django.contrib.auth','django.contrib.contenttypes','django.contrib.sessions','django.contrib.messages','django.contrib.staticfiles','rest_framework','corsheaders']\nROOT_URLCONF = 'testproject.urls'\nDATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3','NAME': BASE_DIR / 'db.sqlite3'}}\nSTATIC_URL = '/static/'`,
            'testproject/urls.py': `from django.urls import path\nfrom django.http import JsonResponse\ndef home(r): return JsonResponse({'message': '🚀 Django Test', 'status': 'running'})\ndef health(r): return JsonResponse({'status': 'healthy'})\nurlpatterns = [path('', home), path('health/', health)]`,
            'testproject/wsgi.py': `import os\nfrom django.core.wsgi import get_wsgi_application\nos.environ.setdefault('DJANGO_SETTINGS_MODULE', 'testproject.settings')\napplication = get_wsgi_application()`
        });
    }

    static async generateFlaskProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'flask');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'requirements.txt': `Flask==2.3.0\nFlask-CORS==4.0.0\ngunicorn==20.1.0`,
            'app.py': `from flask import Flask, jsonify\nfrom flask_cors import CORS\nimport os\napp = Flask(__name__)\nCORS(app)\n@app.route('/')\ndef home(): return jsonify({'message': '🚀 Flask Test', 'status': 'running'})\n@app.route('/health')\ndef health(): return jsonify({'status': 'healthy'})\nif __name__ == '__main__':\n    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))`,
            '.env': `PORT=5000`
        });
    }

    static async generateFastAPIProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'fastapi');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'requirements.txt': `fastapi==0.100.0\nuvicorn[standard]==0.23.0`,
            'main.py': `from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\nimport os\napp = FastAPI(title="FastAPI Test")\napp.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])\n@app.get("/")\nasync def root(): return {"message": "🚀 FastAPI Test", "status": "running"}\n@app.get("/health")\nasync def health(): return {"status": "healthy"}`
        });
    }

    static async generateSpringBootProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'spring-boot');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'pom.xml': `<?xml version="1.0"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>3.1.0</version></parent>\n  <groupId>com.test</groupId><artifactId>spring-boot-test</artifactId><version>1.0.0</version>\n  <dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies>\n</project>`,
            'src/main/java/com/test/Application.java': `package com.test;\nimport org.springframework.boot.SpringApplication;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\nimport org.springframework.web.bind.annotation.*;\nimport java.util.*;\n@SpringBootApplication\n@RestController\npublic class Application {\n    public static void main(String[] args) { SpringApplication.run(Application.class, args); }\n    @GetMapping("/") public Map<String,String> home() { return Map.of("message","🚀 Spring Boot Test","status","running"); }\n    @GetMapping("/health") public Map<String,String> health() { return Map.of("status","healthy"); }\n}`,
            'src/main/resources/application.properties': `server.port=8080\nserver.address=0.0.0.0`
        });
    }

    static async generateVueProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'vue-vite');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'package.json': JSON.stringify({ name: 'vue-vite-test', version: '1.0.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { vue: '^3.3.4' }, devDependencies: { '@vitejs/plugin-vue': '^4.2.3', vite: '^4.3.9' } }, null, 2),
            'vite.config.js': `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()], server: { host: '0.0.0.0', port: 3000 } })`,
            'index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>Vue Test</title></head>\n  <body><div id="app"></div><script type="module" src="/src/main.js"></script></body>\n</html>`,
            'src/main.js': `import { createApp } from 'vue'\nimport App from './App.vue'\ncreateApp(App).mount('#app')`,
            'src/App.vue': `<template><div style="padding:20px"><h1>🚀 Vue.js Test</h1><p>Status: ✅ Running</p></div></template>\n<script>\nexport default { name: 'App' }\n</script>`
        });
    }

    static async generateAngularProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'angular');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'package.json': JSON.stringify({ name: 'angular-test', version: '1.0.0', scripts: { start: 'ng serve --host 0.0.0.0', build: 'ng build' }, dependencies: { '@angular/core': '^16.0.0', '@angular/platform-browser': '^16.0.0', '@angular/platform-browser-dynamic': '^16.0.0' }, devDependencies: { '@angular/cli': '^16.0.0', '@angular/compiler-cli': '^16.0.0', typescript: '~5.0.0' } }, null, 2),
            'angular.json': JSON.stringify({ version: 1, projects: { 'angular-test': { projectType: 'application', root: '', sourceRoot: 'src' } } }, null, 2)
        });
    }

    static async generateNextJsProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'nextjs');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'package.json': JSON.stringify({ name: 'nextjs-test', version: '1.0.0', scripts: { dev: 'next dev -H 0.0.0.0', build: 'next build', start: 'next start -H 0.0.0.0' }, dependencies: { next: '^13.4.0', react: '^18.2.0', 'react-dom': '^18.2.0' } }, null, 2),
            'pages/index.js': `export default function Home() {\n  return (<div style={{ padding: '20px' }}><h1>🚀 Next.js Test</h1><p>Status: ✅ Running</p></div>)\n}`,
            'pages/api/hello.js': `export default function handler(req, res) { res.status(200).json({ message: 'Next.js API', status: 'running' }) }`
        });
    }

    static async generateMERNProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'mern');
        this.createDirectory(projectDir);
        this.writeFiles(projectDir, {
            'frontend/package.json': JSON.stringify({ name: 'mern-frontend', version: '1.0.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', axios: '^1.4.0' }, devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^4.3.9' } }, null, 2),
            'frontend/index.html': `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><title>MERN Test</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>`,
            'frontend/src/main.jsx': `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nReactDOM.createRoot(document.getElementById('root')).render(<App />)`,
            'frontend/src/App.jsx': `import React from 'react'\nexport default function App() { return (<div style={{ padding: '20px' }}><h1>🚀 MERN Stack Test</h1></div>) }`,
            'backend/package.json': JSON.stringify({ name: 'mern-backend', version: '1.0.0', main: 'index.js', scripts: { start: 'node index.js' }, dependencies: { express: '^4.18.2', mongoose: '^7.3.0', cors: '^2.8.5', dotenv: '^16.0.3' } }, null, 2),
            'backend/index.js': `const express = require('express');\nconst cors = require('cors');\nrequire('dotenv').config();\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.get('/api', (req, res) => res.json({ message: 'Express + MongoDB', status: 'running' }));\napp.get('/api/health', (req, res) => res.json({ status: 'healthy' }));\nconst PORT = process.env.PORT || 5000;\napp.listen(PORT, '0.0.0.0', () => console.log(\`Backend running on port \${PORT}\`));`,
            'backend/.env': `PORT=5000\nMONGO_URI=mongodb://mongodb:27017/testdb`
        });
    }

    static async generateDjangoReactProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'django-react');
        this.createDirectory(projectDir);
        await this.generateDjangoProject(projectDir);
        this.writeFiles(projectDir, {
            'frontend/package.json': JSON.stringify({ name: 'django-react-frontend', version: '1.0.0', scripts: { dev: 'vite', build: 'vite build' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', axios: '^1.4.0' }, devDependencies: { '@vitejs/plugin-react': '^4.0.0', vite: '^4.3.9' } }, null, 2)
        });
    }

    private static createDirectory(dir: string): void {
        if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    }

    private static writeFiles(baseDir: string, files: Record<string, string>): void {
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = path.join(baseDir, filePath);
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
            fs.writeFileSync(fullPath, content);
        }
    }
}
