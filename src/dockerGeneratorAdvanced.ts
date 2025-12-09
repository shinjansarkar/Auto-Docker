import * as fs from 'fs';
import * as path from 'path';

/**
 * Advanced Docker Generation Module
 * Generates production-grade Dockerfiles, docker-compose.yml, and Nginx configs
 */

// ==================== DOCKERFILE GENERATOR ====================

export class DockerfileGenerator {
  /**
   * Generate production-grade Dockerfile with multi-stage builds
   */
  static generateDockerfile(framework: string, config: any): string {
    const baseDockerfile = this.getBaseDockerfile(framework);
    const healthCheck = this.generateHealthCheck(framework);
    const securityHardening = this.generateSecurityHardening();

    return `${baseDockerfile}\n${healthCheck}\n${securityHardening}`;
  }

  private static getBaseDockerfile(framework: string): string {
    switch (framework) {
      case 'Node.js':
        return this.generateNodeDockerfile();
      case 'React':
      case 'Vue':
      case 'Angular':
      case 'Next.js':
        return this.generateFrontendDockerfile();
      case 'Django':
      case 'Flask':
      case 'FastAPI':
        return this.generatePythonDockerfile(framework);
      case 'Spring Boot':
      case 'Java':
        return this.generateJavaDockerfile();
      case 'Go':
        return this.generateGoDockerfile();
      case 'PHP':
      case 'Laravel':
        return this.generatePHPDockerfile(framework);
      case '.NET':
        return this.generateDotNetDockerfile();
      default:
        return this.generateNodeDockerfile();
    }
  }

  private static generateNodeDockerfile(): string {
    return `# Multi-stage Node.js build
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./ 

# Install dependencies
RUN npm ci --only=production && \\
    npm cache clean --force

# Copy source code
COPY . .

# Build application
RUN npm run build

# Stage 2: Runtime
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S nodejs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Set environment
ENV NODE_ENV=production

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "dist/index.js"]`;
  }

  private static generateFrontendDockerfile(): string {
    return `# Multi-stage Frontend build
# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build application
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy Nginx config
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf /etc/nginx/conf.d/default.conf

# Copy built app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user
RUN addgroup -g 101 -S nginx && \\
    adduser -S nginx -u 101

USER nginx

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1`;
  }

  private static generatePythonDockerfile(framework: string): string {
    const startCommand = this.getPythonStartCommand(framework);
    
    return `# Python application
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r python && useradd -r -g python python

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements*.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY --chown=python:python . .

USER python

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

CMD ["${startCommand}"]`;
  }

  private static generateJavaDockerfile(): string {
    return `# Multi-stage Java build
# Stage 1: Build
FROM maven:3.8.1-openjdk-17 AS builder

WORKDIR /app

COPY . .

# Build with Maven
RUN mvn clean package -DskipTests

# Stage 2: Runtime
FROM openjdk:17-jdk-slim

WORKDIR /app

# Create non-root user
RUN groupadd -r java && useradd -r -g java java

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

USER java

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]`;
  }

  private static generateGoDockerfile(): string {
    return `# Multi-stage Go build
# Stage 1: Build
FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o app .

# Stage 2: Runtime
FROM alpine:latest

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S app && \\
    adduser -S app -u 1001

COPY --from=builder /app/app .

USER app

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./app"]`;
  }

  private static generatePHPDockerfile(framework: string): string {
    return `# PHP application
FROM php:8.2-fpm-alpine

WORKDIR /app

# Install extensions
RUN docker-php-ext-install pdo pdo_mysql

# Copy composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Create non-root user
RUN addgroup -g 1001 -S www && \\
    adduser -S www -u 1001

# Copy application
COPY --chown=www:www . .

# Install dependencies
RUN composer install --no-dev --optimize-autoloader

USER www

EXPOSE 9000

CMD ["php-fpm"]`;
  }

  private static generateDotNetDockerfile(): string {
    return `# Multi-stage .NET build
# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:7.0 AS builder

WORKDIR /app

COPY . .

RUN dotnet restore && \\
    dotnet publish -c Release -o out

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:7.0

WORKDIR /app

COPY --from=builder /app/out .

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD curl -f http://localhost/health || exit 1

ENTRYPOINT ["dotnet", "app.dll"]`;
  }

  private static generateHealthCheck(framework: string): string {
    // Already included in framework-specific generators
    return '';
  }

  private static generateSecurityHardening(): string {
    return `
# Security best practices
# - Non-root user (handled above)
# - Read-only filesystem where possible
# - Resource limits (handle via docker-compose)
# - No package managers in production image`;
  }

  private static getPythonStartCommand(framework: string): string {
    switch (framework) {
      case 'Django':
        return 'gunicorn config.wsgi --bind 0.0.0.0:8000';
      case 'Flask':
        return 'gunicorn app:app --bind 0.0.0.0:8000';
      case 'FastAPI':
        return 'uvicorn main:app --host 0.0.0.0 --port 8000';
      default:
        return 'python app.py';
    }
  }
}

// ==================== DOCKER-COMPOSE GENERATOR ====================

export class DockerComposeGenerator {
  static generateDockerCompose(services: any[], databases: any[], queues: any[], cacheLayer: any): string {
    const compose = {
      version: '3.9',
      services: this.generateServices(services, databases, queues, cacheLayer),
      networks: this.generateNetworks(),
      volumes: this.generateVolumes(databases),
      configs: this.generateConfigs()
    };

    return this.formatYaml(compose);
  }

  private static generateServices(services: any[], databases: any[], queues: any[], cache: any): any {
    const servicesObj: any = {};

    // Add application services
    for (const service of services) {
      servicesObj[service.name] = {
        build: {
          context: service.context || '.',
          dockerfile: 'Dockerfile'
        },
        container_name: `app_${service.name}`,
        ports: [`${service.port}:${service.port}`],
        environment: this.generateEnvironment(service),
        depends_on: this.generateDependsOn(databases, queues, cache),
        networks: ['app-network'],
        healthcheck: {
          test: ['CMD', 'curl', '-f', `http://localhost:${service.port}/health`],
          interval: '30s',
          timeout: '10s',
          retries: 3,
          start_period: '10s'
        },
        restart: 'unless-stopped',
        volumes: this.generateServiceVolumes(service),
        resources: {
          limits: {
            cpus: '1.0',
            memory: '512M'
          }
        }
      };
    }

    // Add database services
    for (const db of databases) {
      servicesObj[db.name || db.type.toLowerCase()] = this.generateDatabaseService(db);
    }

    // Add queue services
    for (const queue of queues) {
      servicesObj[queue.name || queue.type.toLowerCase()] = this.generateQueueService(queue);
    }

    // Add cache service
    if (cache) {
      servicesObj.redis = this.generateCacheService(cache);
    }

    return servicesObj;
  }

  private static generateDatabaseService(db: any): any {
    const services: any = {
      postgres: {
        image: 'postgres:15-alpine',
        container_name: 'app_postgres',
        environment: {
          POSTGRES_USER: 'postgres',
          POSTGRES_PASSWORD: 'postgres',
          POSTGRES_DB: 'app_db'
        },
        ports: ['5432:5432'],
        volumes: ['postgres_data:/var/lib/postgresql/data'],
        networks: ['app-network'],
        healthcheck: {
          test: ['CMD-SHELL', 'pg_isready -U postgres'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      },
      mysql: {
        image: 'mysql:8.0',
        container_name: 'app_mysql',
        environment: {
          MYSQL_ROOT_PASSWORD: 'root',
          MYSQL_DATABASE: 'app_db'
        },
        ports: ['3306:3306'],
        volumes: ['mysql_data:/var/lib/mysql'],
        networks: ['app-network'],
        healthcheck: {
          test: ['CMD', 'mysqladmin', 'ping', '-h', 'localhost'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      },
      mongodb: {
        image: 'mongo:6.0',
        container_name: 'app_mongo',
        environment: {
          MONGO_INITDB_ROOT_USERNAME: 'root',
          MONGO_INITDB_ROOT_PASSWORD: 'root'
        },
        ports: ['27017:27017'],
        volumes: ['mongodb_data:/data/db'],
        networks: ['app-network'],
        healthcheck: {
          test: ['CMD', 'mongo', '--eval', 'db.adminCommand("ping")'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      }
    };

    return services[db.type.toLowerCase()] || services.postgres;
  }

  private static generateQueueService(queue: any): any {
    const services: any = {
      rabbitmq: {
        image: 'rabbitmq:3.12-management-alpine',
        container_name: 'app_rabbitmq',
        environment: {
          RABBITMQ_DEFAULT_USER: 'guest',
          RABBITMQ_DEFAULT_PASS: 'guest'
        },
        ports: ['5672:5672', '15672:15672'],
        volumes: ['rabbitmq_data:/var/lib/rabbitmq'],
        networks: ['app-network'],
        healthcheck: {
          test: ['CMD', 'rabbitmq-diagnostics', 'ping'],
          interval: '10s',
          timeout: '5s',
          retries: 5
        }
      },
      kafka: {
        image: 'confluentinc/cp-kafka:7.0.0',
        container_name: 'app_kafka',
        environment: {
          KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181',
          KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://kafka:9092',
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
        },
        ports: ['9092:9092'],
        networks: ['app-network']
      }
    };

    return services[queue.type.toLowerCase()] || services.rabbitmq;
  }

  private static generateCacheService(cache: any): any {
    return {
      image: 'redis:7-alpine',
      container_name: 'app_redis',
      ports: ['6379:6379'],
      volumes: ['redis_data:/data'],
      networks: ['app-network'],
      healthcheck: {
        test: ['CMD', 'redis-cli', 'ping'],
        interval: '10s',
        timeout: '5s',
        retries: 5
      },
      command: 'redis-server --appendonly yes'
    };
  }

  private static generateEnvironment(service: any): any {
    return {
      NODE_ENV: 'production',
      PORT: service.port,
      LOG_LEVEL: 'info'
    };
  }

  private static generateDependsOn(databases: any[], queues: any[], cache: any): any {
    const depends: any = {};

    for (const db of databases) {
      const dbName = db.name || db.type.toLowerCase();
      depends[dbName] = {
        condition: 'service_healthy'
      };
    }

    return depends;
  }

  private static generateServiceVolumes(service: any): string[] {
    return [];
  }

  private static generateNetworks(): any {
    return {
      'app-network': {
        driver: 'bridge'
      }
    };
  }

  private static generateVolumes(databases: any[]): any {
    const volumes: any = {};

    for (const db of databases) {
      const dbName = db.name || db.type.toLowerCase();
      volumes[`${dbName}_data`] = {
        driver: 'local'
      };
    }

    volumes.redis_data = { driver: 'local' };
    volumes.rabbitmq_data = { driver: 'local' };

    return volumes;
  }

  private static generateConfigs(): any {
    return {};
  }

  private static formatYaml(obj: any): string {
    let yaml = 'version: \'3.9\'\n\n';

    yaml += 'services:\n';
    for (const [name, service] of Object.entries(obj.services)) {
      yaml += this.formatServiceYaml(name, service as any);
    }

    yaml += '\nnetworks:\n';
    for (const [name, network] of Object.entries(obj.networks)) {
      yaml += `  ${name}:\n`;
      yaml += `    driver: ${(network as any).driver}\n`;
    }

    yaml += '\nvolumes:\n';
    for (const name of Object.keys(obj.volumes)) {
      yaml += `  ${name}:\n`;
      yaml += `    driver: local\n`;
    }

    return yaml;
  }

  private static formatServiceYaml(name: string, service: any): string {
    let yaml = `  ${name}:\n`;
    yaml += `    image: ${service.image || 'node:18'}\n`;
    yaml += `    container_name: ${service.container_name}\n`;

    if (service.build) {
      yaml += `    build:\n`;
      yaml += `      context: ${service.build.context}\n`;
      yaml += `      dockerfile: ${service.build.dockerfile}\n`;
    }

    if (service.ports && service.ports.length > 0) {
      yaml += `    ports:\n`;
      for (const port of service.ports) {
        yaml += `      - "${port}"\n`;
      }
    }

    if (service.environment) {
      yaml += `    environment:\n`;
      for (const [key, value] of Object.entries(service.environment)) {
        yaml += `      ${key}: ${value}\n`;
      }
    }

    if (service.volumes && service.volumes.length > 0) {
      yaml += `    volumes:\n`;
      for (const volume of service.volumes) {
        yaml += `      - ${volume}\n`;
      }
    }

    yaml += `    networks:\n`;
    for (const net of service.networks || []) {
      yaml += `      - ${net}\n`;
    }

    yaml += `    healthcheck:\n`;
    yaml += `      test: ${JSON.stringify(service.healthcheck.test)}\n`;
    yaml += `      interval: ${service.healthcheck.interval}\n`;
    yaml += `      timeout: ${service.healthcheck.timeout}\n`;
    yaml += `      retries: ${service.healthcheck.retries}\n`;
    yaml += `      start_period: ${service.healthcheck.start_period}\n`;

    yaml += `    restart: ${service.restart}\n`;

    if (service.depends_on && Object.keys(service.depends_on).length > 0) {
      yaml += `    depends_on:\n`;
      for (const [dep, config] of Object.entries(service.depends_on)) {
        yaml += `      ${dep}:\n`;
        yaml += `        condition: ${(config as any).condition}\n`;
      }
    }

    return yaml;
  }
}

// ==================== NGINX CONFIGURATION GENERATOR ====================

export class NginxConfigGenerator {
  static generateNginxConfig(services: any[], reverseProxy: any): string {
    return `upstream frontend {
  server ${services[0]?.name || 'frontend'}:${services[0]?.port || 3000};
}

upstream backend {
  server ${services[1]?.name || 'backend'}:${services[1]?.port || 8000};
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=web_limit:10m rate=30r/s;

server {
  listen 80;
  server_name _;
  client_max_body_size 100M;

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

  # Frontend
  location / {
    limit_req zone=web_limit burst=20 nodelay;
    
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    
    # CORS
    add_header 'Access-Control-Allow-Origin' '$http_origin' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
    
    if ($request_method = 'OPTIONS') {
      return 204;
    }
  }

  # Backend API
  location /api/ {
    limit_req zone=api_limit burst=10 nodelay;
    
    proxy_pass http://backend/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
  }

  # Health check
  location /health {
    access_log off;
    return 200 "healthy\\n";
    add_header Content-Type text/plain;
  }

  # Gzip compression
  gzip on;
  gzip_vary on;
  gzip_min_length 1000;
  gzip_types text/plain text/css text/xml text/javascript 
             application/x-javascript application/xml+rss 
             application/javascript application/json;
}`;
  }
}

// ==================== MAIN GENERATOR CLASS ====================

export class DockerGeneratorFinal {
  static async generateAll(projectPath: string, config: any): Promise<any> {
    return {
      dockerfile: DockerfileGenerator.generateDockerfile(config.framework, config),
      dockerCompose: DockerComposeGenerator.generateDockerCompose(
        config.services || [],
        config.databases || [],
        config.messageQueues || [],
        config.cacheLayer
      ),
      nginx: NginxConfigGenerator.generateNginxConfig(config.services, config.reverseProxy)
    };
  }
}

export default DockerGeneratorFinal;
