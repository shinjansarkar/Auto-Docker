# Docker Test Projects Guide

This guide provides **10 different project combinations** with intentional Docker issues for testing your Auto Docker Extension. Each project includes the issue description, expected behavior, and solution.

---

## 🎯 Project 1: Node.js Express API with MongoDB
**Tech Stack:** Node.js, Express, MongoDB  
**Issue Type:** Missing Environment Variables

### Project Structure
```
nodejs-express-api/
├── package.json
├── server.js
├── .env.example
└── models/
    └── User.js
```

### Files to Create

**package.json**
```json
{
  "name": "nodejs-express-api",
  "version": "1.0.0",
  "description": "Express API with MongoDB",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.0.0",
    "dotenv": "^16.0.3",
    "cors": "^2.8.5",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
```

**server.js**
```javascript
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// MongoDB connection - ISSUE: Missing MONGO_URI in .env
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch(err => {
  console.error('MongoDB connection error:', err);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**.env.example**
```
PORT=3000
# MONGO_URI is missing - this will cause connection failure
NODE_ENV=production
```

### 🐛 Issue
- Missing `MONGO_URI` environment variable
- Docker container will start but fail to connect to MongoDB
- No proper service dependency configuration

### ✅ Solution
1. Add `MONGO_URI=mongodb://mongo:27017/testdb` to `.env`
2. Update `docker-compose.yml` to include MongoDB service
3. Add `depends_on` configuration for service orchestration

---

## 🎯 Project 2: Python Flask API with PostgreSQL
**Tech Stack:** Python, Flask, PostgreSQL  
**Issue Type:** Incorrect Dependency File Path

### Project Structure
```
python-flask-api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   └── requirements.txt  ← Nested in subfolder
├── config.py
└── run.py
```

### Files to Create

**app/requirements.txt**
```
Flask==2.3.0
Flask-SQLAlchemy==3.0.3
psycopg2-binary==2.9.6
python-dotenv==1.0.0
gunicorn==20.1.0
```

**app/main.py**
```python
from flask import Flask, jsonify
import os
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)

# ISSUE: DATABASE_URL not properly configured
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/db')
db = SQLAlchemy(app)

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

**run.py**
```python
from app.main import app

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0')
```

### 🐛 Issue
- `requirements.txt` is in `app/` subfolder, not root
- Generic Dockerfile will look for `COPY requirements.txt` at root
- Build will fail with "requirements.txt not found"

### ✅ Solution
1. Update Dockerfile to use correct path: `COPY app/requirements.txt /app/`
2. Or move requirements.txt to project root
3. Ensure Auto Docker Extension detects nested dependency files

---

## 🎯 Project 3: React Frontend with Nginx
**Tech Stack:** React, Nginx  
**Issue Type:** Wrong Build Output Directory

### Project Structure
```
react-frontend/
├── package.json
├── public/
│   └── index.html
└── src/
    ├── App.js
    └── index.js
```

### Files to Create

**package.json**
```json
{
  "name": "react-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

**src/App.js**
```javascript
import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>React Docker Test</h1>
      <p>Testing Auto Docker Extension</p>
    </div>
  );
}

export default App;
```

**src/index.js**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```

### 🐛 Issue
- Dockerfile copies from wrong build directory
- Should copy from `build/` but might copy from `dist/`
- Nginx configuration missing proper routing for SPA

### ✅ Solution
1. Ensure Dockerfile uses: `COPY --from=builder /app/build /usr/share/nginx/html`
2. Add proper nginx.conf with try_files for SPA routing
3. Remove any `USER nginx` directive that causes permission issues

---

## 🎯 Project 4: Next.js Application
**Tech Stack:** Next.js  
**Issue Type:** Missing Standalone Build Configuration

### Project Structure
```
nextjs-app/
├── package.json
├── next.config.js
├── pages/
│   └── index.js
└── public/
    └── favicon.ico
```

### Files to Create

**package.json**
```json
{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "13.4.0",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  }
}
```

**next.config.js**
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ISSUE: Missing output: 'standalone' for optimal Docker builds
}

module.exports = nextConfig
```

**pages/index.js**
```javascript
export default function Home() {
  return (
    <div>
      <h1>Next.js Docker Test</h1>
      <p>Testing Auto Docker Extension with Next.js</p>
    </div>
  )
}
```

### 🐛 Issue
- Missing `output: 'standalone'` in next.config.js
- Results in larger Docker image size
- Inefficient build for production

### ✅ Solution
1. Add `output: 'standalone'` to next.config.js
2. Update Dockerfile to use standalone build
3. Copy only necessary files from .next/standalone

---

## 🎯 Project 5: Monorepo with Frontend & Backend
**Tech Stack:** Yarn Workspaces, React, Express  
**Issue Type:** Monorepo Detection Failure

### Project Structure
```
monorepo-fullstack/
├── package.json
├── packages/
│   ├── frontend/
│   │   ├── package.json
│   │   └── src/
│   └── backend/
│       ├── package.json
│       └── server.js
└── yarn.lock
```

### Files to Create

**package.json (root)**
```json
{
  "name": "monorepo-fullstack",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "yarn workspace frontend dev & yarn workspace backend dev"
  }
}
```

**packages/frontend/package.json**
```json
{
  "name": "frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "scripts": {
    "dev": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

**packages/backend/package.json**
```json
{
  "name": "backend",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node server.js"
  }
}
```

**packages/backend/server.js**
```javascript
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(4000, () => console.log('Backend on port 4000'));
```

### 🐛 Issue
- Extension might not detect monorepo structure
- Could generate single Dockerfile instead of per-service
- Missing workspace-aware dependency installation

### ✅ Solution
1. Detect `workspaces` field in root package.json
2. Generate separate Dockerfiles for each service
3. Use proper workspace commands in Dockerfile

---

## 🎯 Project 6: Java Spring Boot with Maven
**Tech Stack:** Java, Spring Boot, Maven  
**Issue Type:** Incorrect JAR Path

### Project Structure
```
java-spring-api/
├── pom.xml
└── src/
    └── main/
        └── java/
            └── com/
                └── example/
                    └── Application.java
```

### Files to Create

**pom.xml**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    
    <groupId>com.example</groupId>
    <artifactId>spring-api</artifactId>
    <version>1.0.0</version>
    
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.0.0</version>
    </parent>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
        <!-- ISSUE: finalName not specified, JAR name unpredictable -->
    </build>
</project>
```

**src/main/java/com/example/Application.java**
```java
package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@SpringBootApplication
@RestController
public class Application {
    
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
    
    @GetMapping("/health")
    public String health() {
        return "OK";
    }
}
```

### 🐛 Issue
- JAR filename includes version: `spring-api-1.0.0.jar`
- Dockerfile might hardcode wrong JAR name
- Build fails at runtime with "JAR not found"

### ✅ Solution
1. Add `<finalName>app</finalName>` to pom.xml build section
2. Use wildcard in Dockerfile: `COPY target/*.jar app.jar`
3. Or detect artifact name from pom.xml

---

## 🎯 Project 7: Go Microservice
**Tech Stack:** Go  
**Issue Type:** Missing Go Modules

### Project Structure
```
go-microservice/
├── main.go
└── go.mod
```

### Files to Create

**go.mod**
```go
module github.com/example/go-service

go 1.21

require (
    github.com/gorilla/mux v1.8.0
)
```

**main.go**
```go
package main

import (
    "encoding/json"
    "log"
    "net/http"
    "github.com/gorilla/mux"
)

type HealthResponse struct {
    Status string `json:"status"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(HealthResponse{Status: "healthy"})
}

func main() {
    r := mux.NewRouter()
    r.HandleFunc("/health", healthHandler).Methods("GET")
    
    log.Println("Server starting on :8080")
    log.Fatal(http.ListenAndServe(":8080", r))
}
```

### 🐛 Issue
- Missing `go.sum` file
- Dockerfile doesn't properly cache Go modules
- Slow rebuilds without proper layer caching

### ✅ Solution
1. Run `go mod download` to generate go.sum
2. Copy go.mod and go.sum before source code
3. Use multi-stage build with proper caching

---

## 🎯 Project 8: PHP Laravel Application
**Tech Stack:** PHP, Laravel, MySQL  
**Issue Type:** Missing Composer Dependencies

### Project Structure
```
php-laravel-app/
├── composer.json
├── artisan
└── app/
    └── Http/
        └── Controllers/
            └── Controller.php
```

### Files to Create

**composer.json**
```json
{
    "name": "laravel/laravel",
    "type": "project",
    "require": {
        "php": "^8.1",
        "laravel/framework": "^10.0"
    },
    "autoload": {
        "psr-4": {
            "App\\": "app/"
        }
    },
    "scripts": {
        "post-autoload-dump": [
            "Illuminate\\Foundation\\ComposerScripts::postAutoloadDump"
        ]
    }
}
```

### 🐛 Issue
- Composer install runs without optimization flags
- Missing PHP extensions in Dockerfile
- No proper Laravel-specific configurations

### ✅ Solution
1. Use `composer install --optimize-autoloader --no-dev`
2. Install required PHP extensions (pdo_mysql, mbstring, etc.)
3. Set proper Laravel environment variables

---

## 🎯 Project 9: .NET Core Web API
**Tech Stack:** .NET Core, C#  
**Issue Type:** Wrong Runtime Image

### Project Structure
```
dotnet-webapi/
├── Program.cs
└── dotnet-webapi.csproj
```

### Files to Create

**dotnet-webapi.csproj**
```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

**Program.cs**
```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => new { status = "healthy" });

app.Run();
```

### 🐛 Issue
- Using SDK image for runtime (bloated image)
- Should use aspnet runtime image
- Missing proper multi-stage build

### ✅ Solution
1. Use `mcr.microsoft.com/dotnet/sdk:7.0` for build
2. Use `mcr.microsoft.com/dotnet/aspnet:7.0` for runtime
3. Implement proper multi-stage Dockerfile

---

## 🎯 Project 10: Ruby on Rails API
**Tech Stack:** Ruby, Rails, PostgreSQL  
**Issue Type:** Bundle Install Issues

### Project Structure
```
rails-api/
├── Gemfile
├── Gemfile.lock
└── config.ru
```

### Files to Create

**Gemfile**
```ruby
source 'https://rubygems.org'

ruby '3.2.0'

gem 'rails', '~> 7.0'
gem 'pg', '~> 1.4'
gem 'puma', '~> 6.0'
```

**config.ru**
```ruby
require_relative 'config/environment'
run Rails.application
```

### 🐛 Issue
- Missing `bundle config` for deployment
- No proper asset precompilation
- Missing database configuration

### ✅ Solution
1. Add `bundle config set --local deployment 'true'`
2. Add `bundle config set --local without 'development test'`
3. Ensure proper Rails environment setup

---

## 📊 Testing Matrix

| Project | Tech Stack | Primary Issue | Difficulty |
|---------|-----------|---------------|------------|
| 1 | Node.js + MongoDB | Missing Env Vars | Easy |
| 2 | Python + PostgreSQL | Nested Dependencies | Medium |
| 3 | React + Nginx | Wrong Build Dir | Medium |
| 4 | Next.js | Missing Config | Easy |
| 5 | Monorepo | Detection Failure | Hard |
| 6 | Java Spring | JAR Path | Medium |
| 7 | Go | Module Caching | Medium |
| 8 | PHP Laravel | Composer Optimization | Medium |
| 9 | .NET Core | Wrong Runtime | Easy |
| 10 | Ruby Rails | Bundle Config | Medium |

---

## 🚀 How to Use This Guide

1. **Create each project** in a separate directory
2. **Run Auto Docker Extension** on each project
3. **Identify the issues** in generated Docker files
4. **Fix the issues** using the solutions provided
5. **Test with** `docker-compose up -d`
6. **Document** what the extension got wrong and what you fixed

---

## 📝 Issue Tracking Template

For each project, track:

```markdown
### Project: [Name]
- **Generated Correctly:** [ ] Dockerfile [ ] docker-compose.yml [ ] nginx.conf
- **Issues Found:**
  1. 
  2. 
- **Fixes Applied:**
  1. 
  2. 
- **Build Success:** [ ] Yes [ ] No
- **Runtime Success:** [ ] Yes [ ] No
```

---

## 🎓 Learning Outcomes

By working through these projects, you'll learn to:
- ✅ Detect and fix environment variable issues
- ✅ Handle nested dependency files
- ✅ Configure proper build output directories
- ✅ Optimize Docker images with multi-stage builds
- ✅ Work with monorepo structures
- ✅ Handle language-specific build tools
- ✅ Implement proper service orchestration
- ✅ Debug Docker networking issues
- ✅ Optimize layer caching
- ✅ Implement security best practices

---

**Happy Testing! 🐳**
