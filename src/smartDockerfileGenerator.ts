/**
 * Smart Dockerfile Generator
 * Generates correct, minimal, multistage Dockerfiles based on accurate detection
 * Uses DataExtractorService for extracting real data from codebase
 * NO HARDCODED ASSUMPTIONS - All data extracted from actual project
 */

import { DetectedFrontend, DetectedBackend } from './enhancedDetectionEngine';
import { DataExtractorService, ExtractedData } from './dataExtractorService';
import { UniversalLanguageDetector, GenericDockerPattern } from './universalLanguageDetector';

export interface DockerfileOptions {
    useMultistage?: boolean;
    optimizeForProduction?: boolean;
    includeHealthCheck?: boolean;
    extractedData?: ExtractedData;
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
    static generateBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        const { language, framework } = backend;

        switch (language) {
            case 'node':
                return this.generateNodeBackendDockerfile(backend, extractedData);
            case 'python':
                return this.generatePythonBackendDockerfile(backend, extractedData);
            case 'go':
                return this.generateGoBackendDockerfile(backend, extractedData);
            case 'java':
                return this.generateJavaBackendDockerfile(backend, extractedData);
            case 'php':
                return this.generatePHPBackendDockerfile(backend, extractedData);
            case 'dotnet':
                return this.generateDotNetBackendDockerfile(backend, extractedData);
            case 'ruby':
                return this.generateRubyBackendDockerfile(backend, extractedData);
            default:
                return this.generateNodeBackendDockerfile(backend, extractedData);
        }
    }

    /**
     * Generate Node.js backend Dockerfile - Uses extracted data, NO hardcoded values
     */
    private static generateNodeBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
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

        // Extract real entry point instead of hardcoded "server.js"
        let startCommand = '["node", "server.js"]'; // Fallback
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            if (entryPoint.command) {
                // Parse command to array format
                const cmdParts = entryPoint.command.split(' ');
                startCommand = JSON.stringify(cmdParts);
            } else {
                startCommand = `["node", "${entryPoint.file}"]`;
            }
        }

        // Extract real port instead of hardcoded 8000
        let exposedPort = backend.port || 8000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract real health check endpoint
        let healthCheckEndpoint = '/health';
        if (extractedData?.healthChecks && extractedData.healthChecks.length > 0) {
            healthCheckEndpoint = extractedData.healthChecks[0].endpoint;
        }

        return `# Node.js backend Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY ${packageFiles} ./

# Install production dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Expose port (extracted from source code)
EXPOSE ${exposedPort}

# Health check (extracted endpoint)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${exposedPort}${healthCheckEndpoint} || exit 1

# Start application (extracted entry point)
CMD ${startCommand}
`;
    }

    /**
     * Generate Python backend Dockerfile - Uses extracted data
     */
    private static generatePythonBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        const { framework, packageManager } = backend;

        // Extract real entry point and command
        let startCommand = 'python app.py';
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            startCommand = entryPoint.command || `python ${entryPoint.file}`;
        } else if (framework === 'python-fastapi') {
            startCommand = 'uvicorn main:app --host 0.0.0.0 --port 8000';
        } else if (framework === 'python-django') {
            startCommand = 'python manage.py runserver 0.0.0.0:8000';
        } else if (framework === 'python-flask') {
            startCommand = 'python app.py';
        }

        // Extract real port
        let exposedPort = backend.port || 8000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract ORM migration commands
        let migrationCommands = '';
        if (extractedData?.ormCommands && extractedData.ormCommands.length > 0) {
            const orm = extractedData.ormCommands[0];
            migrationCommands = `\n# Run database migrations\nRUN ${orm.migrateCommand}\n`;
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
${migrationCommands}
# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted command)
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
${migrationCommands}
# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted command)
CMD ${JSON.stringify(startCommand.split(' '))}
`;
    }

    /**
     * Generate Go backend Dockerfile - Uses extracted data
     */
    private static generateGoBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        // Extract real entry point
        let binaryName = 'main';
        let buildPath = '.';
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            if (entryPoint.file.includes('/')) {
                buildPath = entryPoint.file.substring(0, entryPoint.file.lastIndexOf('/'));
            }
        }

        // Extract real port
        let exposedPort = backend.port || 8000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        return `# Multi-stage build for Go
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build application (extracted path)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o ${binaryName} ${buildPath}

# Production stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/${binaryName} .

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application
CMD ["./${binaryName}"]
`;
    }

    /**
     * Generate Java backend Dockerfile - Uses extracted data
     */
    private static generateJavaBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        const packageManager = backend.packageManager || 'maven';

        // Extract real port
        let exposedPort = backend.port || 8080;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

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

# Expose port (extracted from source)
EXPOSE ${exposedPort}

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

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application
CMD ["java", "-jar", "app.jar"]
`;
    }

    /**
     * Generate PHP backend Dockerfile - Uses extracted data
     */
    private static generatePHPBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        // Extract real port
        let exposedPort = backend.port || 8000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract real start command
        let startCommand = `["php", "artisan", "serve", "--host=0.0.0.0", "--port=${exposedPort}"]`;
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            if (entryPoint.command) {
                startCommand = JSON.stringify(entryPoint.command.split(' '));
            }
        }

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

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start PHP server (extracted command)
CMD ${startCommand}
`;
    }

    /**
     * Generate .NET backend Dockerfile - Uses extracted data
     */
    private static generateDotNetBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        // Extract real port
        let exposedPort = backend.port || 8080;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract real DLL name from entry point
        let dllName = 'app.dll';
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            if (entryPoint.file.endsWith('.dll')) {
                dllName = entryPoint.file;
            }
        }

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

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted DLL name)
ENTRYPOINT ["dotnet", "${dllName}"]
`;
    }

    /**
     * Generate Ruby backend Dockerfile - Uses extracted data
     */
    private static generateRubyBackendDockerfile(backend: DetectedBackend, extractedData?: ExtractedData): string {
        // Extract real port
        let exposedPort = backend.port || 3000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract real start command
        let startCommand = `["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "${exposedPort}"]`;
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            if (entryPoint.command) {
                startCommand = JSON.stringify(entryPoint.command.split(' '));
            }
        }

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

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted command)
CMD ${startCommand}
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

    /**
     * Generate generic Dockerfile for ANY unknown tech stack
     * Uses UniversalLanguageDetector to create appropriate Dockerfile
     */
    static async generateGenericDockerfile(
        basePath: string,
        genericPattern: GenericDockerPattern,
        extractedData?: ExtractedData
    ): Promise<string> {
        const { language, baseImage, packageFiles, installCommand, buildCommand, runCommand, outputFolder } = genericPattern;

        // Extract real port
        let exposedPort = 8000;
        if (extractedData?.ports && extractedData.ports.length > 0) {
            exposedPort = extractedData.ports[0].port;
        }

        // Extract real entry point
        let finalRunCommand = runCommand || './app';
        if (extractedData?.entryPoints && extractedData.entryPoints.length > 0) {
            const entryPoint = extractedData.entryPoints[0];
            finalRunCommand = entryPoint.command || finalRunCommand;
        }

        // Determine if multi-stage build is needed
        const needsMultiStage = buildCommand && buildCommand !== 'echo "No build command"';

        if (needsMultiStage && outputFolder) {
            // Multi-stage build for compiled languages
            return `# Multi-stage build for ${language}
FROM ${baseImage} AS builder

WORKDIR /app

# Copy dependency files
${packageFiles.map(file => `COPY ${file} ./`).join('\n')}

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

# Build application
RUN ${buildCommand}

# Production stage
FROM ${baseImage.includes('alpine') ? 'alpine:latest' : baseImage}

WORKDIR /app

# Copy built application
COPY --from=builder /app/${outputFolder} ./

# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted command)
CMD ${JSON.stringify(finalRunCommand.split(' '))}
`;
        } else {
            // Single-stage build for interpreted languages
            return `# ${language} Dockerfile
FROM ${baseImage}

WORKDIR /app

# Copy dependency files
${packageFiles.map(file => `COPY ${file} ./`).join('\n')}

# Install dependencies
RUN ${installCommand}

# Copy source code
COPY . .

${buildCommand !== 'echo "No build command"' ? `# Build application\nRUN ${buildCommand}\n` : ''}
# Expose port (extracted from source)
EXPOSE ${exposedPort}

# Start application (extracted command)
CMD ${JSON.stringify(finalRunCommand.split(' '))}
`;
        }
    }
}
