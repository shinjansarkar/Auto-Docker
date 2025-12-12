/**
 * Smart Dockerfile Generator
 * Generates correct, minimal, multistage Dockerfiles based on accurate detection
 * Fixes Issues #7-11: Dockerfile generation errors
 */

import { DetectedFrontend, DetectedBackend } from './enhancedDetectionEngine';

export interface DockerfileOptions {
    useMultistage?: boolean;
    optimizeForProduction?: boolean;
    includeHealthCheck?: boolean;
}

/**
 * Smart Dockerfile Generator - Main Class
 */
export class SmartDockerfileGenerator {

    /**
     * Generate frontend Dockerfile
     */
    static generateFrontendDockerfile(frontend: DetectedFrontend, options?: DockerfileOptions): string {
        const {
            framework,
            variant,
            outputFolder,
            packageManager,
            installCommand,
            buildCommand
        } = frontend;

        // Special handling for SSR frameworks
        if (framework === 'nextjs' && variant === 'ssr') {
            return this.generateNextJsSSRDockerfile(frontend);
        }

        if (framework === 'nuxt') {
            return this.generateNuxtSSRDockerfile(frontend);
        }

        if (framework === 'svelte' && variant === 'kit') {
            return this.generateSvelteKitDockerfile(frontend);
        }

        // Standard multistage build for static frontends
        return this.generateStaticFrontendDockerfile(frontend);
    }

    /**
     * Generate static frontend Dockerfile (Vite, CRA, Vue, Angular, etc.)
     */
    private static generateStaticFrontendDockerfile(frontend: DetectedFrontend): string {
        const { outputFolder, packageManager, installCommand, buildCommand } = frontend;

        // Determine package files to copy
        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for production frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build application
RUN ${buildCommand}

# Production stage with nginx
FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/${outputFolder} /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;
    }

    /**
     * Generate Next.js SSR Dockerfile
     */
    private static generateNextJsSSRDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for Next.js SSR
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build Next.js application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start Next.js
CMD ["npm", "start"]
`;
    }

    /**
     * Generate Nuxt SSR Dockerfile
     */
    private static generateNuxtSSRDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for Nuxt.js
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build Nuxt application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.output ./.output

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start Nuxt
CMD ["node", ".output/server/index.mjs"]
`;
    }

    /**
     * Generate SvelteKit Dockerfile
     */
    private static generateSvelteKitDockerfile(frontend: DetectedFrontend): string {
        const { packageManager, installCommand, buildCommand } = frontend;

        let packageFiles = 'package*.json';
        if (packageManager === 'yarn') {
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Multi-stage build for SvelteKit
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build SvelteKit application
RUN ${buildCommand}

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json

# Expose port
EXPOSE 3000

# Set NODE_ENV
ENV NODE_ENV=production

# Start SvelteKit
CMD ["node", "build"]
`;
    }

    /**
     * Generate backend Dockerfile
     */
    static generateBackendDockerfile(backend: DetectedBackend): string {
        const { language, framework } = backend;

        switch (language) {
            case 'node':
                return this.generateNodeBackendDockerfile(backend);
            case 'python':
                return this.generatePythonBackendDockerfile(backend);
            case 'go':
                return this.generateGoBackendDockerfile(backend);
            case 'java':
                return this.generateJavaBackendDockerfile(backend);
            case 'php':
                return this.generatePHPBackendDockerfile(backend);
            case 'dotnet':
                return this.generateDotNetBackendDockerfile(backend);
            case 'ruby':
                return this.generateRubyBackendDockerfile(backend);
            default:
                return this.generateNodeBackendDockerfile(backend);
        }
    }

    /**
     * Generate Node.js backend Dockerfile
     */
    private static generateNodeBackendDockerfile(backend: DetectedBackend): string {
        const packageManager = backend.packageManager || 'npm';

        let installCommand = 'npm ci --only=production';
        let packageFiles = 'package*.json';

        if (packageManager === 'yarn') {
            installCommand = 'yarn install --production';
            packageFiles = 'package.json yarn.lock';
        } else if (packageManager === 'pnpm') {
            installCommand = 'pnpm install --prod';
            packageFiles = 'package.json pnpm-lock.yaml';
        }

        return `# Node.js backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY ${packageFiles} ./

# Install production dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["node", "server.js"]
`;
    }

    /**
     * Generate Python backend Dockerfile
     */
    private static generatePythonBackendDockerfile(backend: DetectedBackend): string {
        const { framework, packageManager } = backend;

        let startCommand = 'python app.py';

        if (framework === 'python-fastapi') {
            startCommand = 'uvicorn main:app --host 0.0.0.0 --port 8000';
        } else if (framework === 'python-django') {
            startCommand = 'python manage.py runserver 0.0.0.0:8000';
        } else if (framework === 'python-flask') {
            startCommand = 'python app.py';
        }

        if (packageManager === 'poetry') {
            return `# Python backend Dockerfile (Poetry)
FROM python:3.11-slim

WORKDIR /app

# Install poetry
RUN pip install poetry

# Copy poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["poetry", "run", "${startCommand}"]
`;
        }

        return `# Python backend Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ${JSON.stringify(startCommand.split(' '))}
`;
    }

    /**
     * Generate Go backend Dockerfile
     */
    private static generateGoBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for Go
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Expose port
EXPOSE 8000

# Start application
CMD ["./main"]
`;
    }

    /**
     * Generate Java backend Dockerfile
     */
    private static generateJavaBackendDockerfile(backend: DetectedBackend): string {
        const packageManager = backend.packageManager || 'maven';

        if (packageManager === 'gradle') {
            return `# Multi-stage build for Java (Gradle)
FROM gradle:8-jdk17 AS builder

WORKDIR /app

# Copy gradle files
COPY build.gradle settings.gradle ./

# Copy source code
COPY src ./src

# Build application
RUN gradle build --no-daemon

# Production stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy jar from builder
COPY --from=builder /app/build/libs/*.jar app.jar

# Expose port
EXPOSE 8080

# Start application
CMD ["java", "-jar", "app.jar"]
`;
        }

        return `# Multi-stage build for Java (Maven)
FROM maven:3-openjdk-17 AS builder

WORKDIR /app

# Copy pom.xml
COPY pom.xml .

# Download dependencies
RUN mvn dependency:go-offline

# Copy source code
COPY src ./src

# Build application
RUN mvn package

# Production stage
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copy jar from builder
COPY --from=builder /app/target/*.jar app.jar

# Expose port
EXPOSE 8080

# Start application
CMD ["java", "-jar", "app.jar"]
`;
    }

    /**
     * Generate PHP backend Dockerfile
     */
    private static generatePHPBackendDockerfile(backend: DetectedBackend): string {
        return `# PHP backend Dockerfile
FROM php:8.2-fpm-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    libpng-dev \
    libzip-dev \
    zip \
    unzip

# Install PHP extensions
RUN docker-php-ext-install pdo pdo_mysql zip

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start PHP server
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
`;
    }

    /**
     * Generate .NET backend Dockerfile
     */
    private static generateDotNetBackendDockerfile(backend: DetectedBackend): string {
        return `# Multi-stage build for .NET
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

# Copy csproj and restore
COPY *.csproj ./
RUN dotnet restore

# Copy everything else and build
COPY . ./
RUN dotnet publish -c Release -o out

# Production stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

# Copy from builder
COPY --from=builder /app/out .

# Expose port
EXPOSE 8080

# Start application
ENTRYPOINT ["dotnet", "YourApp.dll"]
`;
    }

    /**
     * Generate Ruby backend Dockerfile
     */
    private static generateRubyBackendDockerfile(backend: DetectedBackend): string {
        return `# Ruby backend Dockerfile
FROM ruby:3.2-alpine

WORKDIR /app

# Install dependencies
RUN apk add --no-cache build-base postgresql-dev

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle install --without development test

# Copy source code
COPY . .

# Expose port
EXPOSE 8000

# Start application
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
`;
    }

    /**
     * Generate .dockerignore file
     */
    static generateDockerignore(): string {
        return `# Dependencies
node_modules
npm-debug.log
yarn-error.log
pnpm-debug.log

# Testing
coverage
.nyc_output

# Environment files
.env
.env.local
.env.*.local

# Editor directories
.vscode
.idea
*.swp
*.swo

# Version control
.git
.gitignore

# OS files
.DS_Store
Thumbs.db

# Build artifacts (will be built in container)
dist
build
out
.next

# Logs
logs
*.log

# Docker files (prevent recursive copies)
Dockerfile
docker-compose.yml
.dockerignore
`;
    }
}
