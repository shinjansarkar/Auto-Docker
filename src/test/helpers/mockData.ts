/**
 * Mock data and expected outputs for consistent testing
 */

export const MOCK_PROJECTS = {
    SIMPLE_REACT: {
        name: 'simple-react-app',
        dependencies: {
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
        },
        devDependencies: {
            'vite': '^4.0.0',
            '@vitejs/plugin-react': '^3.0.0'
        }
    },

    SIMPLE_EXPRESS: {
        name: 'simple-express-api',
        dependencies: {
            'express': '^4.18.0'
        }
    },

    NEXTJS_APP: {
        name: 'nextjs-app',
        dependencies: {
            'next': '^13.0.0',
            'react': '^18.2.0',
            'react-dom': '^18.2.0'
        }
    },

    DJANGO_API: {
        requirementsTxt: 'Django==4.2.0\ngunicorn==20.1.0\npsycopg2-binary==2.9.5'
    },

    FLASK_API: {
        requirementsTxt: 'Flask==2.3.0\ngunicorn==20.1.0\nFlask-SQLAlchemy==3.0.0'
    },

    FULLSTACK_MERN: {
        root: {
            name: 'mern-fullstack',
            workspaces: ['frontend', 'backend']
        },
        frontend: {
            name: 'frontend',
            dependencies: {
                'react': '^18.2.0',
                'react-dom': '^18.2.0',
                'axios': '^1.4.0'
            }
        },
        backend: {
            name: 'backend',
            dependencies: {
                'express': '^4.18.0',
                'mongoose': '^7.0.0',
                'cors': '^2.8.5'
            }
        }
    }
};

export const EXPECTED_OUTPUTS = {
    REACT_DOCKERFILE: {
        shouldContain: [
            'FROM node',
            'WORKDIR /app',
            'COPY package*.json',
            'RUN npm',
            'COPY . .',
            'RUN npm run build',
            'FROM nginx',
            'COPY --from=',
            'EXPOSE 80'
        ],
        shouldNotContain: [
            'node_modules',
            '.git'
        ]
    },

    EXPRESS_DOCKERFILE: {
        shouldContain: [
            'FROM node',
            'WORKDIR /app',
            'COPY package*.json',
            'RUN npm ci',
            'COPY . .',
            'EXPOSE 3000',
            'CMD'
        ]
    },

    NGINX_CONFIG: {
        shouldContain: [
            'server {',
            'listen 80',
            'location /',
            'try_files',
            'index index.html',
            '}'
        ],
        withProxy: [
            'location /api/',
            'proxy_pass',
            'proxy_set_header Host',
            'proxy_set_header X-Real-IP',
            'proxy_set_header X-Forwarded-For'
        ],
        withWebSocket: [
            'proxy_http_version 1.1',
            'Upgrade $http_upgrade',
            'Connection "upgrade"'
        ]
    },

    DOCKER_COMPOSE: {
        basic: {
            shouldContain: [
                'services:',
                'build:',
                'ports:',
                'environment:'
            ]
        },
        withDatabase: {
            shouldContain: [
                'postgres:',
                'image: postgres',
                'POSTGRES_PASSWORD',
                'volumes:'
            ]
        },
        withMultipleServices: {
            shouldContain: [
                'frontend:',
                'backend:',
                'db:',
                'networks:',
                'depends_on:'
            ]
        }
    },

    DOCKERIGNORE: {
        node: [
            'node_modules',
            'npm-debug.log',
            '.git',
            '.env',
            '*.md',
            '.vscode'
        ],
        python: [
            '__pycache__',
            '*.pyc',
            '*.pyo',
            '.env',
            '.venv',
            'venv/',
            '*.db'
        ]
    }
};

export const FRAMEWORK_SIGNATURES = {
    react: {
        dependencies: ['react', 'react-dom'],
        files: ['src/App.tsx', 'src/App.jsx', 'src/index.tsx'],
        port: 3000
    },
    vue: {
        dependencies: ['vue'],
        files: ['src/App.vue', 'src/main.js'],
        port: 8080
    },
    angular: {
        dependencies: ['@angular/core', '@angular/common'],
        files: ['angular.json', 'src/app/app.component.ts'],
        port: 4200
    },
    nextjs: {
        dependencies: ['next'],
        files: ['pages/', 'app/', 'next.config.js'],
        port: 3000
    },
    svelte: {
        dependencies: ['svelte'],
        files: ['src/App.svelte'],
        port: 5000
    },
    express: {
        dependencies: ['express'],
        files: ['server.js', 'app.js', 'index.js'],
        port: 3000
    },
    fastify: {
        dependencies: ['fastify'],
        files: ['server.js', 'app.js'],
        port: 3000
    },
    nestjs: {
        dependencies: ['@nestjs/core', '@nestjs/common'],
        files: ['src/main.ts', 'nest-cli.json'],
        port: 3000
    },
    django: {
        files: ['manage.py', 'settings.py'],
        requirements: ['Django'],
        port: 8000
    },
    flask: {
        files: ['app.py', 'application.py'],
        requirements: ['Flask'],
        port: 5000
    },
    fastapi: {
        files: ['main.py', 'app.py'],
        requirements: ['fastapi', 'uvicorn'],
        port: 8000
    }
};

export const DATABASE_SIGNATURES = {
    postgres: {
        dependencies: ['pg', 'psycopg2-binary', 'prisma'],
        envVars: ['DATABASE_URL', 'POSTGRES_', 'PG_'],
        image: 'postgres:15',
        port: 5432
    },
    mongodb: {
        dependencies: ['mongoose', 'mongodb', 'pymongo'],
        envVars: ['MONGO_URI', 'MONGODB_'],
        image: 'mongo:6',
        port: 27017
    },
    mysql: {
        dependencies: ['mysql2', 'mysql', 'mysqlclient'],
        envVars: ['MYSQL_'],
        image: 'mysql:8',
        port: 3306
    },
    redis: {
        dependencies: ['redis', 'ioredis'],
        envVars: ['REDIS_URL', 'REDIS_HOST'],
        image: 'redis:7',
        port: 6379
    }
};

export const ADVANCED_SERVICES = {
    rabbitmq: {
        dependencies: ['amqplib', 'amqp', 'pika'],
        image: 'rabbitmq:3-management',
        ports: [5672, 15672]
    },
    kafka: {
        dependencies: ['kafkajs', 'kafka-python', 'confluent_kafka'],
        image: 'confluentinc/cp-kafka:latest',
        port: 9092
    },
    elasticsearch: {
        dependencies: ['@elastic/elasticsearch', 'elasticsearch'],
        image: 'elasticsearch:8.9.0',
        port: 9200
    },
    opensearch: {
        dependencies: ['@opensearch-project/opensearch'],
        image: 'opensearchproject/opensearch:latest',
        port: 9200
    },
    memcached: {
        dependencies: ['memcached', 'pymemcache'],
        image: 'memcached:alpine',
        port: 11211
    }
};

export const MONOREPO_CONFIGS = {
    yarn: {
        packageJson: {
            workspaces: ['packages/*', 'apps/*']
        }
    },
    pnpm: {
        workspace: {
            packages: ['packages/*', 'apps/*']
        },
        file: 'pnpm-workspace.yaml'
    },
    lerna: {
        config: {
            version: 'independent',
            packages: ['packages/*']
        },
        file: 'lerna.json'
    },
    nx: {
        config: {
            projects: {}
        },
        file: 'nx.json'
    },
    turbo: {
        config: {
            pipeline: {}
        },
        file: 'turbo.json'
    }
};

export const MULTI_STAGE_BUILD_PATTERNS = {
    node: {
        stages: ['dependencies', 'builder', 'production'],
        baseImages: ['node:18-alpine'],
        sizeReduction: 0.6 // 60% smaller
    },
    python: {
        stages: ['builder', 'production'],
        baseImages: ['python:3.11-slim'],
        sizeReduction: 0.5
    },
    java: {
        stages: ['build', 'runtime'],
        baseImages: ['maven:3.9-eclipse-temurin-17', 'eclipse-temurin:17-jre-alpine'],
        sizeReduction: 0.7
    },
    go: {
        stages: ['build', 'production'],
        baseImages: ['golang:1.21-alpine', 'scratch'],
        sizeReduction: 0.95 // 95% smaller!
    }
};

export const SECURITY_BEST_PRACTICES = {
    nonRootUser: {
        patterns: ['USER node', 'USER app', 'USER 1000'],
        shouldNotContain: ['USER root', 'USER 0']
    },
    readOnlyRootFS: {
        patterns: ['read_only: true', 'readOnlyRootFilesystem: true']
    },
    sensitiveFiles: {
        shouldExclude: ['.env', '.env.local', '.git', 'credentials', 'secrets', '*.key', '*.pem']
    },
    securityHeaders: {
        nginx: [
            'X-Frame-Options',
            'X-Content-Type-Options',
            'X-XSS-Protection',
            'Strict-Transport-Security'
        ]
    }
};

export const PERFORMANCE_BENCHMARKS = {
    small: {
        dependencies: 10,
        expectedTime: 5000, // ms
        maxMemory: 100 // MB
    },
    medium: {
        dependencies: 500,
        expectedTime: 10000,
        maxMemory: 250
    },
    large: {
        dependencies: 2000,
        expectedTime: 30000,
        maxMemory: 500
    }
};
