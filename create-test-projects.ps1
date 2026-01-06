# Auto Docker Extension - Test Projects Generator
# This script creates 10 test projects with intentional Docker issues

Write-Host "🐳 Creating Docker Test Projects..." -ForegroundColor Cyan

# Create base directory
$baseDir = "C:\Home\code\devops\docker-test-projects"
if (Test-Path $baseDir) {
    Write-Host "⚠️  Directory already exists. Removing..." -ForegroundColor Yellow
    Remove-Item -Path $baseDir -Recurse -Force
}
New-Item -ItemType Directory -Path $baseDir | Out-Null

# Project 1: Node.js Express API
Write-Host "`n📦 Creating Project 1: Node.js Express API..." -ForegroundColor Green
$proj1 = "$baseDir\nodejs-express-api"
New-Item -ItemType Directory -Path $proj1 | Out-Null
New-Item -ItemType Directory -Path "$proj1\models" | Out-Null

@"
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
"@ | Out-File -FilePath "$proj1\package.json" -Encoding UTF8

@"
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ISSUE: Missing MONGO_URI in .env
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
"@ | Out-File -FilePath "$proj1\server.js" -Encoding UTF8

@"
PORT=3000
# MONGO_URI is missing - this will cause connection failure
NODE_ENV=production
"@ | Out-File -FilePath "$proj1\.env.example" -Encoding UTF8

# Project 2: Python Flask API
Write-Host "📦 Creating Project 2: Python Flask API..." -ForegroundColor Green
$proj2 = "$baseDir\python-flask-api"
New-Item -ItemType Directory -Path $proj2 | Out-Null
New-Item -ItemType Directory -Path "$proj2\app" | Out-Null

@"
Flask==2.3.0
Flask-SQLAlchemy==3.0.3
psycopg2-binary==2.9.6
python-dotenv==1.0.0
gunicorn==20.1.0
"@ | Out-File -FilePath "$proj2\app\requirements.txt" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "$proj2\app\main.py" -Encoding UTF8

@"
from app.main import app

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0')
"@ | Out-File -FilePath "$proj2\run.py" -Encoding UTF8

# Project 3: React Frontend
Write-Host "📦 Creating Project 3: React Frontend..." -ForegroundColor Green
$proj3 = "$baseDir\react-frontend"
New-Item -ItemType Directory -Path $proj3 | Out-Null
New-Item -ItemType Directory -Path "$proj3\src" | Out-Null
New-Item -ItemType Directory -Path "$proj3\public" | Out-Null

@"
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
"@ | Out-File -FilePath "$proj3\package.json" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "$proj3\src\App.js" -Encoding UTF8

@"
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
"@ | Out-File -FilePath "$proj3\src\index.js" -Encoding UTF8

@"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <title>React App</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>
"@ | Out-File -FilePath "$proj3\public\index.html" -Encoding UTF8

# Project 4: Next.js Application
Write-Host "📦 Creating Project 4: Next.js Application..." -ForegroundColor Green
$proj4 = "$baseDir\nextjs-app"
New-Item -ItemType Directory -Path $proj4 | Out-Null
New-Item -ItemType Directory -Path "$proj4\pages" | Out-Null
New-Item -ItemType Directory -Path "$proj4\public" | Out-Null

@"
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
"@ | Out-File -FilePath "$proj4\package.json" -Encoding UTF8

@"
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ISSUE: Missing output: 'standalone' for optimal Docker builds
}

module.exports = nextConfig
"@ | Out-File -FilePath "$proj4\next.config.js" -Encoding UTF8

@"
export default function Home() {
  return (
    <div>
      <h1>Next.js Docker Test</h1>
      <p>Testing Auto Docker Extension with Next.js</p>
    </div>
  )
}
"@ | Out-File -FilePath "$proj4\pages\index.js" -Encoding UTF8

# Project 5: Monorepo
Write-Host "📦 Creating Project 5: Monorepo Fullstack..." -ForegroundColor Green
$proj5 = "$baseDir\monorepo-fullstack"
New-Item -ItemType Directory -Path $proj5 | Out-Null
New-Item -ItemType Directory -Path "$proj5\packages\frontend\src" -Force | Out-Null
New-Item -ItemType Directory -Path "$proj5\packages\backend" -Force | Out-Null

@"
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
"@ | Out-File -FilePath "$proj5\package.json" -Encoding UTF8

@"
{
  "name": "frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "dev": "react-scripts start",
    "build": "react-scripts build"
  }
}
"@ | Out-File -FilePath "$proj5\packages\frontend\package.json" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "$proj5\packages\backend\package.json" -Encoding UTF8

@"
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(4000, () => console.log('Backend on port 4000'));
"@ | Out-File -FilePath "$proj5\packages\backend\server.js" -Encoding UTF8

# Project 6: Go Microservice
Write-Host "📦 Creating Project 6: Go Microservice..." -ForegroundColor Green
$proj6 = "$baseDir\go-microservice"
New-Item -ItemType Directory -Path $proj6 | Out-Null

@"
module github.com/example/go-service

go 1.21

require (
    github.com/gorilla/mux v1.8.0
)
"@ | Out-File -FilePath "$proj6\go.mod" -Encoding UTF8

@"
package main

import (
    "encoding/json"
    "log"
    "net/http"
    "github.com/gorilla/mux"
)

type HealthResponse struct {
    Status string ``json:"status"``
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
"@ | Out-File -FilePath "$proj6\main.go" -Encoding UTF8

# Project 7: Java Spring Boot
Write-Host "📦 Creating Project 7: Java Spring Boot..." -ForegroundColor Green
$proj7 = "$baseDir\java-spring-api"
New-Item -ItemType Directory -Path "$proj7\src\main\java\com\example" -Force | Out-Null

@"
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
    </build>
</project>
"@ | Out-File -FilePath "$proj7\pom.xml" -Encoding UTF8

@"
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
"@ | Out-File -FilePath "$proj7\src\main\java\com\example\Application.java" -Encoding UTF8

# Project 8: .NET Core
Write-Host "📦 Creating Project 8: .NET Core Web API..." -ForegroundColor Green
$proj8 = "$baseDir\dotnet-webapi"
New-Item -ItemType Directory -Path $proj8 | Out-Null

@"
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
"@ | Out-File -FilePath "$proj8\dotnet-webapi.csproj" -Encoding UTF8

@"
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => new { status = "healthy" });

app.Run();
"@ | Out-File -FilePath "$proj8\Program.cs" -Encoding UTF8

# Project 9: Ruby on Rails
Write-Host "📦 Creating Project 9: Ruby on Rails API..." -ForegroundColor Green
$proj9 = "$baseDir\rails-api"
New-Item -ItemType Directory -Path $proj9 | Out-Null

@"
source 'https://rubygems.org'

ruby '3.2.0'

gem 'rails', '~> 7.0'
gem 'pg', '~> 1.4'
gem 'puma', '~> 6.0'
"@ | Out-File -FilePath "$proj9\Gemfile" -Encoding UTF8

@"
require_relative 'config/environment'
run Rails.application
"@ | Out-File -FilePath "$proj9\config.ru" -Encoding UTF8

# Project 10: PHP Laravel
Write-Host "📦 Creating Project 10: PHP Laravel..." -ForegroundColor Green
$proj10 = "$baseDir\php-laravel-app"
New-Item -ItemType Directory -Path "$proj10\app\Http\Controllers" -Force | Out-Null

@"
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
    }
}
"@ | Out-File -FilePath "$proj10\composer.json" -Encoding UTF8

Write-Host "`n✅ All 10 test projects created successfully!" -ForegroundColor Green
Write-Host "`n📍 Location: $baseDir" -ForegroundColor Cyan
Write-Host "`n📖 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Open each project in VS Code" -ForegroundColor White
Write-Host "   2. Run Auto Docker Extension" -ForegroundColor White
Write-Host "   3. Identify and fix the issues" -ForegroundColor White
Write-Host "   4. Test with 'docker-compose up -d'" -ForegroundColor White
Write-Host "`n📚 Refer to DOCKER-TEST-PROJECTS-GUIDE.md for detailed issue descriptions and solutions`n" -ForegroundColor Magenta
