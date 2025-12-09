import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced Docker Generation Module - Production Grade
 * Generates optimized multi-stage Dockerfiles with best practices:
 * - Multi-stage builds for all application types
 * - Frontend: Build + Nginx serving
 * - Backend: Build + Runtime optimization
 * - Nginx: Proxy pass for static files + API
 * - Security hardening, health checks, non-root users
 */

// ==================== MULTI-STAGE DOCKERFILE GENERATOR ====================

export class DockerfileGenerator {
  /**
   * Generate production-grade multi-stage Dockerfile
   */
  static generateDockerfile(framework: string, config: any = {}): string {
    const dockerfile = this.getFrameworkDockerfile(framework, config);
    return dockerfile;
  }

  private static getFrameworkDockerfile(framework: string, config: any): string {
    // Frontend frameworks with Nginx
    if (['React', 'Vue', 'Angular', 'Next.js', 'Svelte', 'Nuxt'].includes(framework)) {
      return this.generateFrontendMultiStageDockerfile(framework, config);
    }

    // Backend frameworks
    if (['Node.js', 'Express', 'Nest.js'].includes(framework)) {
      return this.generateNodeMultiStageDockerfile(config);
    }

    if (['Django', 'Flask', 'FastAPI'].includes(framework)) {
      return this.generatePythonMultiStageDockerfile(framework, config);
    }

    if (['Spring Boot', 'Java'].includes(framework)) {
      return this.generateJavaMultiStageDockerfile(config);
    }

    if (framework === 'Go') {
      return this.generateGoMultiStageDockerfile(config);
    }

    if (['PHP', 'Laravel'].includes(framework)) {
      return this.generatePHPMultiStageDockerfile(framework, config);
    }

    if (framework === '.NET') {
      return this.generateDotNetMultiStageDockerfile(config);
    }

    // Default to Node.js
    return this.generateNodeMultiStageDockerfile(config);
  }

  // ==================== FRONTEND MULTI-STAGE BUILD ====================

  /**
   * Frontend: Build stage + Nginx serving stage
   * Optimized for static file serving with security
   */
  private static generateFrontendMultiStageDockerfile(framework: string, config: any): string {
    const buildCommand = this.getFrontendBuildCommand(framework);
    const nodeVersion = config.nodeVersion || '18';

    return `# ==================== FRONTEND MULTI-STAGE BUILD ====================
# Stage 1: Build Stage
# Purpose: Build application and dependencies (large, temporary)
FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./

# Install dependencies based on package manager
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --frozen-lockfile; \\
    else npm ci --prefer-offline --no-audit; fi

# Copy source code
COPY . .

# Set build environment
ENV NODE_ENV=production
ENV CI=true

# Build application
RUN ${buildCommand}

# ==================== STAGE 2: RUNTIME STAGE ====================
# Purpose: Serve built application with Nginx (small, optimized)
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration (optimized for SPA)
COPY nginx-frontend.conf /etc/nginx/conf.d/frontend.conf

# Create non-root user
RUN addgroup -g 101 -S nginx && \\
    adduser -S nginx -u 101 -G nginx || true

# Copy built application from builder
COPY --from=builder --chown=nginx:nginx /app/dist . 
COPY --from=builder --chown=nginx:nginx /app/build . 
COPY --from=builder --chown=nginx:nginx /app/out .

# Set proper permissions
RUN chmod -R 755 /usr/share/nginx/html && \\
    chmod -R 755 /etc/nginx

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]`;
  }

  /**
   * Frontend build commands per framework
   */
  private static getFrontendBuildCommand(framework: string): string {
    const commands: { [key: string]: string } = {
      'React': 'npm run build || yarn build || pnpm build',
      'Vue': 'npm run build || yarn build || pnpm build',
      'Angular': 'npm run build -- --configuration production || yarn build --configuration production',
      'Next.js': 'npm run build || yarn build || pnpm build',
      'Svelte': 'npm run build || yarn build || pnpm build',
      'Nuxt': 'npm run build || yarn build || pnpm build'
    };
    return commands[framework] || 'npm run build || yarn build || pnpm build';
  }

  // ==================== BACKEND MULTI-STAGE BUILD ====================

  /**
   * Node.js Backend: Multi-stage build
   * Stage 1: Build + Install dependencies
   * Stage 2: Runtime (minimal dependencies)
   */
  private static generateNodeMultiStageDockerfile(config: any): string {
    const nodeVersion = config.nodeVersion || '18';
    const buildCommand = config.buildCommand || 'npm run build || echo "No build script"';
    const startCommand = config.startCommand || 'node dist/index.js';

    return `# ==================== NODE.JS BACKEND MULTI-STAGE BUILD ====================
# Stage 1: Dependencies and Build Stage
# Purpose: Install all dependencies and build application
FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy package files first (leverage layer caching)
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./
COPY .npmrc* ./

# Install all dependencies (including dev)
RUN if [ -f yarn.lock ]; then yarn install; \\
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; \\
    else npm ci --prefer-offline --no-audit; fi

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=production

# Build application (TypeScript compilation, etc.)
RUN ${buildCommand}

# ==================== STAGE 2: DEPENDENCIES LAYER ====================
# Purpose: Install only production dependencies (smaller layer)
FROM node:${nodeVersion}-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./
COPY pnpm-lock.yaml* ./
COPY .npmrc* ./

# Install production dependencies only
RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install --prod --frozen-lockfile; \\
    else npm ci --prefer-offline --no-audit --only=production; fi

# ==================== STAGE 3: RUNTIME STAGE ====================
# Purpose: Final optimized image for production
FROM node:${nodeVersion}-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001 -G nodejs

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy package files
COPY --chown=nodejs:nodejs package*.json ./

# Copy built application from builder stage
COPY --chown=nodejs:nodejs --from=builder /app/dist ./dist
COPY --chown=nodejs:nodejs --from=builder /app/build ./build
COPY --chown=nodejs:nodejs --from=builder /app/src ./src

# Set environment
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Switch to non-root user
USER nodejs

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["${startCommand}"]`;
  }

  // ==================== PYTHON BACKEND MULTI-STAGE BUILD ====================

  /**
   * Python Backend: Multi-stage build
   * Stage 1: Build dependencies
   * Stage 2: Runtime
   */
  private static generatePythonMultiStageDockerfile(framework: string, config: any): string {
    const pythonVersion = config.pythonVersion || '3.11';
    const startCommand = this.getPythonStartCommand(framework);

    return `# ==================== PYTHON BACKEND MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
# Purpose: Install dependencies and build wheels
FROM python:${pythonVersion}-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    build-essential \\
    libpq-dev \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements*.txt ./

# Create wheels directory
RUN mkdir -p /wheels

# Install dependencies and create wheels
RUN pip install --user --no-cache-dir wheel && \\
    pip wheel --user --no-cache-dir --no-deps --wheel-dir /wheels -r requirements.txt

# ==================== STAGE 2: RUNTIME STAGE ====================
# Purpose: Minimal production image
FROM python:${pythonVersion}-slim

WORKDIR /app

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    libpq5 \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Copy wheels from builder
COPY --from=builder /wheels /wheels

# Copy requirements
COPY requirements*.txt ./

# Install wheels (production dependencies)
RUN pip install --no-cache-dir /wheels/* && \\
    rm -rf /wheels

# Copy application code
COPY --chown=python:python . .

# Set Python environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Switch to non-root user
USER python

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["${startCommand}"]`;
  }

  private static getPythonStartCommand(framework: string): string {
    const commands: { [key: string]: string } = {
      'Django': 'gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --worker-class sync',
      'Flask': 'gunicorn app:app --bind 0.0.0.0:8000 --workers 4 --worker-class sync',
      'FastAPI': 'uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4'
    };
    return commands[framework] || 'python app.py';
  }

  // ==================== JAVA BACKEND MULTI-STAGE BUILD ====================

  /**
   * Java/Spring Boot: Multi-stage build
   * Stage 1: Build with Maven/Gradle
   * Stage 2: Runtime with JRE
   */
  private static generateJavaMultiStageDockerfile(config: any): string {
    const javaVersion = config.javaVersion || '17';
    const buildTool = config.buildTool || 'maven';

    if (buildTool.toLowerCase() === 'gradle') {
      return this.generateJavaGradleDockerfile(javaVersion);
    }

    return `# ==================== JAVA MULTI-STAGE BUILD ====================
# Stage 1: Build Stage
# Purpose: Compile and package application
FROM maven:3.9-eclipse-temurin-${javaVersion} AS builder

WORKDIR /app

# Copy Maven configuration
COPY pom.xml mvnw* mvnw.cmd* ./

# Copy source code
COPY . .

# Build application (skip tests for speed)
RUN mvn clean package -DskipTests -q

# ==================== STAGE 2: RUNTIME STAGE ====================
# Purpose: Minimal Java runtime
FROM eclipse-temurin:${javaVersion}-jre-alpine

WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S java && \\
    adduser -S java -u 1001 -G java

# Copy built JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Extract layers for faster startup (optional, only for Spring Boot 2.3+)
RUN jar xf app.jar BOOT-INF/lib && \\
    mkdir -p app && \\
    (cd app && jar xf ../app.jar)

# Set environment
ENV JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=35.0"

# Switch to non-root user
USER java

# Expose application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \\
  CMD curl -f http://localhost:8080/actuator/health || exit 1

# Start application
ENTRYPOINT ["java", "-jar", "app.jar"]`;
  }

  private static generateJavaGradleDockerfile(javaVersion: string): string {
    return `# ==================== JAVA GRADLE MULTI-STAGE BUILD ====================
# Stage 1: Build Stage
FROM eclipse-temurin:${javaVersion}-jdk-alpine AS builder

WORKDIR /app

# Install gradle
RUN apk add --no-cache gradle

# Copy gradle configuration
COPY gradlew* build.gradle settings.gradle* ./
COPY gradle ./gradle

# Copy source code
COPY . .

# Build application
RUN gradle build -x test --no-daemon

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM eclipse-temurin:${javaVersion}-jre-alpine

WORKDIR /app

RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S java && \\
    adduser -S java -u 1001 -G java

# Copy built JAR
COPY --from=builder /app/build/libs/*.jar app.jar

USER java

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \\
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]`;
  }

  // ==================== GO BACKEND MULTI-STAGE BUILD ====================

  /**
   * Go: Ultra-minimal multi-stage build
   * Stage 1: Build with full Go toolchain
   * Stage 2: Runtime with scratch or Alpine
   */
  private static generateGoMultiStageDockerfile(config: any): string {
    const goVersion = config.goVersion || '1.21';

    return `# ==================== GO MULTI-STAGE BUILD ====================
# Stage 1: Build Stage
# Purpose: Compile Go binary
FROM golang:${goVersion}-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git make

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download -x

# Copy source code
COPY . .

# Build application
# CGO_ENABLED=0 creates a static binary that works in scratch container
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \\
    go build -ldflags="-w -s" -o app .

# ==================== STAGE 2: SCRATCH RUNTIME ====================
# Purpose: Ultra-minimal final image (no OS, no shell)
FROM scratch

WORKDIR /app

# Copy only the binary from builder (no other files)
COPY --from=builder /app/app .

# Expose port
EXPOSE 8080

# Start application
ENTRYPOINT ["./app"]`;
  }

  // ==================== PHP MULTI-STAGE BUILD ====================

  /**
   * PHP: Multi-stage with PHP-FPM and Composer
   */
  private static generatePHPMultiStageDockerfile(framework: string, config: any): string {
    const phpVersion = config.phpVersion || '8.2';

    return `# ==================== PHP MULTI-STAGE BUILD ====================
# Stage 1: Builder Stage
# Purpose: Install dependencies with Composer
FROM php:${phpVersion}-fpm-alpine AS builder

WORKDIR /app

# Install required extensions
RUN docker-php-ext-install pdo pdo_mysql opcache

# Install composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy composer files
COPY composer.json composer.lock* ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM php:${phpVersion}-fpm-alpine

WORKDIR /app

# Install production extensions
RUN docker-php-ext-install pdo pdo_mysql opcache

# Install runtime dependencies
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S www && \\
    adduser -S www -u 1001 -G www

# Copy dependencies from builder
COPY --from=builder /app/vendor ./vendor

# Copy application code
COPY --chown=www:www . .

# Configure PHP
COPY php.ini /usr/local/etc/php/
RUN sed -i 's/www-data/www/g' /usr/local/etc/php-fpm.conf

# Switch to non-root user
USER www

# Expose FPM port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:9000/health || exit 1

CMD ["php-fpm"]`;
  }

  // ==================== .NET MULTI-STAGE BUILD ====================

  /**
   * .NET: Multi-stage build with SDK and Runtime
   */
  private static generateDotNetMultiStageDockerfile(config: any): string {
    const dotnetVersion = config.dotnetVersion || '7.0';

    return `# ==================== .NET MULTI-STAGE BUILD ====================
# Stage 1: Build Stage
# Purpose: Build and publish application
FROM mcr.microsoft.com/dotnet/sdk:${dotnetVersion} AS builder

WORKDIR /app

# Copy project files
COPY . .

# Restore dependencies
RUN dotnet restore -q

# Build and publish
RUN dotnet publish -c Release -o /publish --no-restore -q

# ==================== STAGE 2: RUNTIME STAGE ====================
FROM mcr.microsoft.com/dotnet/aspnet:${dotnetVersion}

WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r dotnet && useradd -r -g dotnet dotnet

# Copy published application from builder
COPY --from=builder --chown=dotnet:dotnet /publish .

# Switch to non-root user
USER dotnet

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \\
  CMD curl -f http://localhost/health || exit 1

# Start application
ENTRYPOINT ["dotnet", "app.dll"]`;
  }
}

// ==================== DOCKER-COMPOSE GENERATOR ====================

export class DockerComposeGenerator {
  /**
   * Generate production-grade docker-compose.yml
   */
  static generateDockerCompose(services: any[] = [], databases: any[] = [], queues: any[] = []): string {
    return `version: '3.9'

services:
  # ==================== FRONTEND SERVICE ====================
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: app_frontend
    ports:
      - "3000:80"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=http://localhost/api
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # ==================== BACKEND SERVICE ====================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: app_backend
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - PORT=8000
      - DATABASE_URL=postgresql://user:password@postgres:5432/app_db
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # ==================== NGINX REVERSE PROXY ====================
  nginx:
    image: nginx:alpine
    container_name: app_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - nginx_cache:/var/cache/nginx
    depends_on:
      - frontend
      - backend
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ==================== POSTGRESQL DATABASE ====================
  postgres:
    image: postgres:15-alpine
    container_name: app_postgres
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ==================== REDIS CACHE ====================
  redis:
    image: redis:7-alpine
    container_name: app_redis
    command: redis-server --appendonly yes
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - app-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  nginx_cache:
    driver: local`;
  }
}

// ==================== NGINX REVERSE PROXY GENERATOR ====================

export class NginxConfigGenerator {
  /**
   * Generate Nginx configuration for:
   * 1. Serving static frontend files
   * 2. Proxying backend API requests
   * 3. Security headers
   * 4. Caching strategies
   * 5. Gzip compression
   */
  static generateNginxConfig(frontendPort: number = 3000, backendPort: number = 8000, staticPath: string = '/dist'): string {
    return `server {
    listen 80;

    # Serve frontend build
    location / {
        try_files $uri $uri/ /index.html;
        root /usr/share/nginx/html;
    }

    # Backend reverse proxy
    location /api/ {
        proxy_pass http://backend:${backendPort}/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}`;
  }

  /**
   * Generate Nginx frontend-only configuration (SPA serving)
   */
  static generateNginxFrontendConfig(): string {
    return `# ==================== NGINX SPA CONFIGURATION ====================
# Optimized for Single Page Applications (React, Vue, Angular)

upstream frontend {
  server frontend:3000;
}

# Cache paths
proxy_cache_path /var/cache/nginx/static levels=1:2 keys_zone=static_cache:10m max_size=1g inactive=30d use_temp_path=off;
proxy_cache_path /var/cache/nginx/assets levels=1:2 keys_zone=assets_cache:10m max_size=500m inactive=7d use_temp_path=off;

# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript 
           application/x-javascript application/xml+rss 
           application/javascript application/json;

server {
  listen 80 default_server;
  listen [::]:80 default_server;
  
  server_name _;
  client_max_body_size 100M;

  # ==================== SECURITY HEADERS ====================
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'" always;

  # ==================== SPA ROUTING ====================
  location / {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    
    # For SPA: Try file, then fall back to index.html
    error_page 404 =200 /index.html;
  }

  # ==================== ASSET CACHING ====================
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    proxy_pass http://frontend;
    proxy_cache assets_cache;
    proxy_cache_valid 200 30d;
    add_header Cache-Control "public, immutable, max-age=31536000";
    add_header X-Cache-Status $upstream_cache_status;
  }

  # ==================== HEALTH CHECK ====================
  location /health {
    access_log off;
    return 200 "healthy\\n";
    add_header Content-Type text/plain;
  }
}`;
  }
}

// ==================== MAIN EXPORT ====================

export class DockerGenerator {
  static generateDockerfile(framework: string, config: any = {}): string {
    return DockerfileGenerator.generateDockerfile(framework, config);
  }

  static generateNginxConfig(frontendPort: number = 3000, backendPort: number = 8000): string {
    return NginxConfigGenerator.generateNginxConfig(frontendPort, backendPort);
  }

  static generateDockerCompose(services: any[] = [], databases: any[] = [], queues: any[] = []): string {
    return DockerComposeGenerator.generateDockerCompose(services, databases, queues);
  }
}

export default DockerGenerator;
