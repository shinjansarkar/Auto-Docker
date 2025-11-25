import * as fs from 'fs';
import * as path from 'path';

export interface ProjectTemplate {
    name: string;
    type: 'frontend' | 'backend' | 'fullstack';
    framework: string;
    files: { [path: string]: string };
}

export class TestProjectGenerator {
    /**
     * Generate all test projects
     */
    static async generateAllTestProjects(baseDir: string): Promise<void> {
        const testProjectsDir = path.join(baseDir, '.test-projects');

        // Create base directory
        if (!fs.existsSync(testProjectsDir)) {
            fs.mkdirSync(testProjectsDir, { recursive: true });
        }

        // Generate frontend projects
        await this.generateReactViteProject(testProjectsDir);
        await this.generateVueProject(testProjectsDir);
        await this.generateAngularProject(testProjectsDir);
        await this.generateNextJsProject(testProjectsDir);

        // Generate backend projects
        await this.generateExpressProject(testProjectsDir);
        await this.generateDjangoProject(testProjectsDir);
        await this.generateFlaskProject(testProjectsDir);
        await this.generateFastAPIProject(testProjectsDir);
        await this.generateSpringBootProject(testProjectsDir);

        // Generate fullstack projects
        await this.generateMERNProject(testProjectsDir);
        await this.generateDjangoReactProject(testProjectsDir);
    }

    /**
     * React + Vite Project
     */
    private static async generateReactViteProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'react-vite');
        this.createDirectory(projectDir);

        const files = {
            'package.json': JSON.stringify({
                name: 'react-vite-test',
                version: '1.0.0',
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'vite build',
                    preview: 'vite preview'
                },
                dependencies: {
                    react: '^18.2.0',
                    'react-dom': '^18.2.0'
                },
                devDependencies: {
                    '@vitejs/plugin-react': '^4.0.0',
                    vite: '^4.3.9'
                }
            }, null, 2),

            'vite.config.js': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})`,

            'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Vite Test</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

            'src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,

            'src/App.jsx': `import React from 'react'

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>🚀 React + Vite Test Project</h1>
      <p>This is a test project for Auto Docker Extension</p>
      <p>Status: ✅ Running</p>
    </div>
  )
}

export default App`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Express.js Project
     */
    private static async generateExpressProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'express');
        this.createDirectory(projectDir);

        const files = {
            'package.json': JSON.stringify({
                name: 'express-test',
                version: '1.0.0',
                main: 'index.js',
                scripts: {
                    start: 'node index.js',
                    dev: 'nodemon index.js'
                },
                dependencies: {
                    express: '^4.18.2',
                    cors: '^2.8.5',
                    dotenv: '^16.0.3'
                },
                devDependencies: {
                    nodemon: '^3.0.1'
                }
            }, null, 2),

            'index.js': `const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: '🚀 Express.js Test Project',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});`,

            '.env': `PORT=3000
NODE_ENV=development`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Django Project
     */
    private static async generateDjangoProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'django');
        this.createDirectory(projectDir);

        const files = {
            'requirements.txt': `Django==4.2.0
djangorestframework==3.14.0
django-cors-headers==4.0.0
gunicorn==20.1.0
python-dotenv==1.0.0`,

            'manage.py': `#!/usr/bin/env python
import os
import sys

if __name__ == '__main__':
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'testproject.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed?"
        ) from exc
    execute_from_command_line(sys.argv)`,

            'testproject/__init__.py': '',

            'testproject/settings.py': `import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SECRET_KEY = 'django-test-secret-key-change-in-production'
DEBUG = True
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'testproject.urls'
WSGI_APPLICATION = 'testproject.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

CORS_ALLOW_ALL_ORIGINS = True
STATIC_URL = '/static/'`,

            'testproject/urls.py': `from django.contrib import admin
from django.urls import path
from django.http import JsonResponse

def home(request):
    return JsonResponse({
        'message': '🚀 Django Test Project',
        'status': 'running',
        'framework': 'Django'
    })

def health(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home),
    path('health/', health),
]`,

            'testproject/wsgi.py': `import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'testproject.settings')
application = get_wsgi_application()`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Flask Project
     */
    private static async generateFlaskProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'flask');
        this.createDirectory(projectDir);

        const files = {
            'requirements.txt': `Flask==2.3.0
Flask-CORS==4.0.0
python-dotenv==1.0.0
gunicorn==20.1.0`,

            'app.py': `from flask import Flask, jsonify
from flask_cors import CORS
from datetime import datetime
import os

app = Flask(__name__)
CORS(app)

@app.route('/')
def home():
    return jsonify({
        'message': '🚀 Flask Test Project',
        'status': 'running',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)`,

            '.env': `FLASK_APP=app.py
FLASK_ENV=development
PORT=5000`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * FastAPI Project
     */
    private static async generateFastAPIProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'fastapi');
        this.createDirectory(projectDir);

        const files = {
            'requirements.txt': `fastapi==0.100.0
uvicorn[standard]==0.23.0
python-dotenv==1.0.0`,

            'main.py': `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import os

app = FastAPI(title="FastAPI Test Project")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "🚀 FastAPI Test Project",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)`,

            '.env': `PORT=8000`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Spring Boot Project
     */
    private static async generateSpringBootProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'spring-boot');
        this.createDirectory(projectDir);

        const files = {
            'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.1.0</version>
    </parent>
    <groupId>com.test</groupId>
    <artifactId>spring-boot-test</artifactId>
    <version>1.0.0</version>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
</project>`,

            'src/main/java/com/test/Application.java': `package com.test;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.HashMap;
import java.util.Map;

@SpringBootApplication
@RestController
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }

    @GetMapping("/")
    public Map<String, String> home() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "🚀 Spring Boot Test Project");
        response.put("status", "running");
        return response;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        return response;
    }
}`,

            'src/main/resources/application.properties': `server.port=8080
server.address=0.0.0.0`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * MERN Stack Project
     */
    private static async generateMERNProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'mern');
        this.createDirectory(projectDir);

        // Frontend
        const frontendFiles = {
            'frontend/package.json': JSON.stringify({
                name: 'mern-frontend',
                version: '1.0.0',
                scripts: {
                    dev: 'vite',
                    build: 'vite build'
                },
                dependencies: {
                    react: '^18.2.0',
                    'react-dom': '^18.2.0',
                    axios: '^1.4.0'
                },
                devDependencies: {
                    '@vitejs/plugin-react': '^4.0.0',
                    vite: '^4.3.9'
                }
            }, null, 2),

            'frontend/index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MERN Test</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

            'frontend/src/main.jsx': `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(<App />)`,

            'frontend/src/App.jsx': `import React, { useState, useEffect } from 'react'
import axios from 'axios'

function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    axios.get('/api')
      .then(res => setData(res.data))
      .catch(err => console.error(err))
  }, [])

  return (
    <div style={{ padding: '20px' }}>
      <h1>🚀 MERN Stack Test</h1>
      <p>Frontend: React + Vite</p>
      <p>Backend: {data ? data.message : 'Loading...'}</p>
    </div>
  )
}

export default App`
        };

        // Backend
        const backendFiles = {
            'backend/package.json': JSON.stringify({
                name: 'mern-backend',
                version: '1.0.0',
                main: 'index.js',
                scripts: {
                    start: 'node index.js'
                },
                dependencies: {
                    express: '^4.18.2',
                    mongoose: '^7.3.0',
                    cors: '^2.8.5',
                    dotenv: '^16.0.3'
                }
            }, null, 2),

            'backend/index.js': `const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongodb:27017/testdb';
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

app.get('/api', (req, res) => {
  res.json({
    message: 'Express + MongoDB',
    status: 'running'
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Backend running on port \${PORT}\`);
});`,

            'backend/.env': `PORT=5000
MONGO_URI=mongodb://mongodb:27017/testdb`
        };

        this.writeFiles(projectDir, { ...frontendFiles, ...backendFiles });
    }

    /**
     * Vue.js Project
     */
    private static async generateVueProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'vue-vite');
        this.createDirectory(projectDir);

        const files = {
            'package.json': JSON.stringify({
                name: 'vue-vite-test',
                version: '1.0.0',
                scripts: {
                    dev: 'vite',
                    build: 'vite build'
                },
                dependencies: {
                    vue: '^3.3.4'
                },
                devDependencies: {
                    '@vitejs/plugin-vue': '^4.2.3',
                    vite: '^4.3.9'
                }
            }, null, 2),

            'vite.config.js': `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 3000
  }
})`,

            'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Vue Test</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,

            'src/main.js': `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')`,

            'src/App.vue': `<template>
  <div style="padding: 20px">
    <h1>🚀 Vue.js Test Project</h1>
    <p>Framework: Vue 3 + Vite</p>
    <p>Status: ✅ Running</p>
  </div>
</template>

<script>
export default {
  name: 'App'
}
</script>`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Angular Project (simplified)
     */
    private static async generateAngularProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'angular');
        this.createDirectory(projectDir);

        const files = {
            'package.json': JSON.stringify({
                name: 'angular-test',
                version: '1.0.0',
                scripts: {
                    start: 'ng serve --host 0.0.0.0',
                    build: 'ng build'
                },
                dependencies: {
                    '@angular/core': '^16.0.0',
                    '@angular/platform-browser': '^16.0.0',
                    '@angular/platform-browser-dynamic': '^16.0.0'
                },
                devDependencies: {
                    '@angular/cli': '^16.0.0',
                    '@angular/compiler-cli': '^16.0.0',
                    typescript: '~5.0.0'
                }
            }, null, 2),

            'angular.json': JSON.stringify({
                version: 1,
                projects: {
                    'angular-test': {
                        projectType: 'application',
                        root: '',
                        sourceRoot: 'src'
                    }
                }
            }, null, 2)
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Next.js Project
     */
    private static async generateNextJsProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'nextjs');
        this.createDirectory(projectDir);

        const files = {
            'package.json': JSON.stringify({
                name: 'nextjs-test',
                version: '1.0.0',
                scripts: {
                    dev: 'next dev -H 0.0.0.0',
                    build: 'next build',
                    start: 'next start -H 0.0.0.0'
                },
                dependencies: {
                    next: '^13.4.0',
                    react: '^18.2.0',
                    'react-dom': '^18.2.0'
                }
            }, null, 2),

            'pages/index.js': `export default function Home() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>🚀 Next.js Test Project</h1>
      <p>Framework: Next.js</p>
      <p>Status: ✅ Running</p>
    </div>
  )
}`,

            'pages/api/hello.js': `export default function handler(req, res) {
  res.status(200).json({
    message: 'Next.js API',
    status: 'running'
  })
}`
        };

        this.writeFiles(projectDir, files);
    }

    /**
     * Django + React Project
     */
    private static async generateDjangoReactProject(baseDir: string): Promise<void> {
        const projectDir = path.join(baseDir, 'django-react');
        this.createDirectory(projectDir);

        // Combine Django and React files
        const djangoFiles = await this.generateDjangoProject(projectDir);
        const reactFiles = {
            'frontend/package.json': JSON.stringify({
                name: 'django-react-frontend',
                version: '1.0.0',
                scripts: {
                    dev: 'vite',
                    build: 'vite build'
                },
                dependencies: {
                    react: '^18.2.0',
                    'react-dom': '^18.2.0',
                    axios: '^1.4.0'
                },
                devDependencies: {
                    '@vitejs/plugin-react': '^4.0.0',
                    vite: '^4.3.9'
                }
            }, null, 2)
        };

        // Files are already written by individual generators
    }

    // Helper methods
    private static createDirectory(dir: string): void {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private static writeFiles(baseDir: string, files: { [path: string]: string }): void {
        for (const [filePath, content] of Object.entries(files)) {
            const fullPath = path.join(baseDir, filePath);
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(fullPath, content);
        }
    }
}
