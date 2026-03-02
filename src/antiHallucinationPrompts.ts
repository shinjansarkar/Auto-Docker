/**
 * Anti-Hallucination Prompts and Rules
 * Prevents AI from generating invalid or incorrect Docker configurations
 * Ensures human-like decision making and validation
 */

export const ANTI_HALLUCINATION_RULES = `
🚨 CRITICAL GENERATION RULES - MUST FOLLOW:

1. **USE ONLY DETECTED FRAMEWORKS AND VERSIONS**
   - Generate configurations ONLY for frameworks explicitly detected in the analysis
   - DO NOT assume or invent frameworks not present in the analysis data
   - Use exact version numbers provided in analysis, or use "latest" if version is unknown
   - If a framework is not detected, DO NOT include it in the Docker files

2. **GENERATE ONLY REQUIRED FILES**
   - Dockerfile: ALWAYS required
   - docker-compose.yml: Required if multiple services detected (backend + database, frontend + backend, etc.)
   - nginx.conf: ALWAYS generate (for frontend serving, backend proxy, load balancing, SSL termination)
   - .dockerignore: ALWAYS required
   - DO NOT generate files for services that don't exist

3. **USE GENERIC FALLBACKS WHEN UNCERTAIN**
   - If specific configuration is unclear, use generic but valid patterns
   - Prefer standard patterns over complex custom configurations
   - Use official base images from Docker Hub (e.g., node:18-alpine, python:3.11-slim)
   - DO NOT invent custom base images or registries

4. **VALIDATE ALL FILE PATHS**
   - ALL file paths in COPY/ADD commands must match detected project structure
   - Package files must exist (package.json, requirements.txt, etc.)
   - Build output directories must match detected build configuration
   - DO NOT use hardcoded paths like /app/dist unless verified in analysis

5. **ENSURE PORT CONSISTENCY**
   - Use detected ports from analysis
   - Common defaults: Frontend (3000, 4200, 5173), Backend (3000, 5000, 8000, 8080)
   - EXPOSE ports in Dockerfile must match ports in docker-compose.yml
   - nginx proxy_pass ports must match backend service ports

6. **VALIDATE ENVIRONMENT VARIABLES**
   - Use environment variables detected in .env files or configuration
   - DO NOT invent environment variables not present in the project
   - Use generic variables only when absolutely necessary
   - Include examples in comments for clarity

7. **BUILD TOOL CONSISTENCY**
   - Use package manager detected in analysis (npm, yarn, pnpm, pip, poetry, etc.)
   - DO NOT switch package managers without explicit detection
   - Use correct build commands for detected framework
   - Ensure build commands match package.json scripts or project configuration

8. **MULTI-STAGE BUILD VALIDATION**
   - Use multi-stage builds for production optimization
   - Build stage must match detected build tool and framework
   - Production stage must be minimal (alpine or slim variants)
   - COPY from build stage must match actual build output directory

9. **SERVICE NAMING CONVENTIONS**
   - Use descriptive service names: frontend, backend, database, redis, etc.
   - DO NOT use generic names like "app" when specific type is known
   - Service names must be DNS-compatible (lowercase, no spaces)
   - Use consistent naming across Dockerfile, docker-compose.yml, and nginx.conf

10. **STRICT SECURITY REQUIREMENTS (ZERO TOLERANCE)**
    - NEVER use :latest or untagged base images. ALWAYS pin to specific versions (e.g. node:20.11.1-alpine)
    - NEVER run containers as root. ALWAYS create and use a non-root user (e.g., USER nodejs)
    - ALWAYS ensure no hardcoded secrets or passwords exist anywhere in the generated files.
    - ALWAYS use .dockerignore to prevent sensitive data leakage.
    - NEVER use curl/wget with --insecure flags.
    - NEVER add privileged flags in docker-compose.

11. **ERROR PREVENTION**
    - Syntax must be valid YAML for docker-compose.yml
    - Syntax must be valid nginx configuration
    - All referenced services must be defined
    - All volumes and networks must be declared
    - Health checks should be included for services with dependencies

VALIDATION CHECKLIST BEFORE GENERATING:
✅ Framework matches detection result
✅ Ports match detected or standard configuration
✅ Build tool matches package manager in analysis
✅ Environment variables match detected variables or are generic
✅ File paths match detected project structure
✅ Base images are official, securely pinned with explicit versions, and appropriate for detected stack
✅ Service dependencies are correctly defined
✅ Volume mounts match actual directories
✅ Network configuration is valid and necessary
✅ nginx.conf is generated for reverse proxy, load balancing, and SSL support
✅ SECURE BY DEFAULT: non-root, pinned versions, proper health checks, dropped privileges

FORBIDDEN ACTIONS:
❌ DO NOT invent frameworks not in analysis
❌ DO NOT use non-existent file paths
❌ DO NOT assume database when none detected
❌ DO NOT use invalid YAML or nginx syntax
❌ DO NOT use outdated or insecure base images
❌ DO NOT use :latest tags
❌ DO NOT run as root
❌ DO NOT include unused services or volumes
❌ DO NOT create circular service dependencies
`;

export const DOCKERFILE_GENERATION_RULES = `
DOCKERFILE GENERATION RULES:

1. **Base Image Selection**
   - Use official images: node, python, openjdk, php, ruby, golang, etc.
   - Prefer slim/alpine variants for smaller images
   - Match version to detected runtime version
   - Example: node:18-alpine, python:3.11-slim, openjdk:17-jdk-slim

2. **Multi-Stage Build Structure**
   - Stage 1 (build): Install dependencies, build application
   - Stage 2 (production): Copy built artifacts, minimal runtime
   - Use AS keyword: FROM node:18 AS build
   - COPY --from=build for artifacts

3. **Security Best Practices (MANDATORY)**
   - NEVER use the :latest tag. Always pin base images to specific versions (e.g., node:20.11.1-alpine instead of node:alpine).
   - DO NOT run as root user. This is a critical security vulnerability.
   - Create non-root user specifically for the application: RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001 -G nodejs
   - Set USER directive before running commands that don't need root, and MUST set before CMD/ENTRYPOINT: USER nodejs
   - Use COPY --chown=nodejs:nodejs for file permissions.
   - Remove unused packages and clear caches (e.g., rm -rf /var/lib/apt/lists/* or npm cache clean).

4. **Layer Optimization**
   - Copy package files first (package.json, requirements.txt)
   - Install dependencies in separate layer
   - Copy source code after dependencies
   - Enables better caching

5. **Working Directory**
   - Set WORKDIR early: WORKDIR /app
   - Use consistent working directory throughout
   - Avoid changing WORKDIR multiple times

6. **Port Exposure**
   - EXPOSE detected port or standard port
   - Document port in comment if non-standard
   - Example: EXPOSE 3000

7. **Health Checks**
   - Add HEALTHCHECK for web services
   - Use curl or wget (must install in image)
   - Example: HEALTHCHECK CMD curl --fail http://localhost:3000/health || exit 1

8. **CMD/ENTRYPOINT**
   - Use CMD for main process
   - Prefer JSON array format: CMD ["node", "server.js"]
   - DO NOT use shell form for production
`;

export const DOCKER_COMPOSE_GENERATION_RULES = `
DOCKER-COMPOSE.YML GENERATION RULES:

1. **Version and Services**
   - Use version: '3.8' (modern and widely supported)
   - Define services: {} block
   - Each detected component = one service

2. **Service Definition**
   - build: context and dockerfile path
   - ports: host:container mapping
   - environment: variables as list or object
   - depends_on: service dependencies
   - volumes: persistent data
   - networks: service communication

3. **Service Dependencies**
   - Frontend depends_on backend (if fullstack)
   - Backend depends_on database (if database exists)
   - Use depends_on correctly
   - Example: frontend depends_on backend in yaml format

4. **Port Mapping**
   - Use standard ports: "3000:3000", "8080:8080"
   - Map to detected ports from analysis
   - Frontend: typically 3000, 4200, 5173
   - Backend: typically 3000, 5000, 8000, 8080
   - Database: use standard ports (5432 postgres, 3306 mysql, 27017 mongo, 6379 redis)

5. **Environment Variables**
   - Use environment: block for each service
   - Database connection strings for backend
   - API URLs for frontend
   - Use proper format with key=value pairs

6. **Volumes**
   - Named volumes for databases
   - Bind mounts for development
   - Declare in top-level volumes: block
   - Example: postgres_data volume for persistent data

7. **Networks**
   - Optional for simple setups
   - Required for complex multi-service setups
   - Define in top-level networks: block
   - Use bridge driver for most cases

8. **Health Checks**
   - Include for services with dependencies
   - Test database connections before starting dependent services
   - Use CMD format with proper test commands
`;

export const NGINX_GENERATION_RULES = `
NGINX.CONF GENERATION RULES:

1. **When to Generate nginx.conf**
   - Frontend-only projects: YES (serve static files)
   - Fullstack projects: YES (reverse proxy to backend)
   - Backend-only projects: YES (reverse proxy, load balancing, SSL termination)
   - Monorepo with frontend: YES

2. **Frontend-Only Configuration**
   - Serve static files from /usr/share/nginx/html
   - SPA routing: try_files $uri $uri/ /index.html
   - Listen on port 80
   - Simple and minimal

3. **Fullstack Configuration**
   - Serve frontend static files at /
   - Reverse proxy API requests to backend
   - Use location /api or detected API prefix
   - proxy_pass to backend service
   - Add proxy headers

4. **Backend-Only Configuration**
   - Reverse proxy to backend application
   - Load balancing if multiple instances
   - SSL/TLS termination
   - Rate limiting and security headers
   - Proxy to backend service (e.g., http://backend:8000)
   - Add timeout and buffer configurations

5. **Required Directives**
   - server { ... } block
   - listen 80;
   - root /usr/share/nginx/html; (for frontend)
   - index index.html; (for frontend)
   - location / { ... } (for routing)

5. **SPA Routing Fix**
   - Always include: try_files $uri $uri/ /index.html;
   - Prevents 404 on client-side routes
   - Essential for React, Vue, Angular   - Only for frontend projects
6. **Reverse Proxy Configuration**
   - location /api { proxy_pass http://backend:PORT; }
   - Required proxy headers: Host, X-Real-IP, X-Forwarded-For, X-Forwarded-Proto
   - Use proxy_set_header directives for all headers

7. **NO Upstream Blocks**
   - DO NOT use upstream { } blocks for simple setups
   - Use direct proxy_pass to service name
   - Docker's internal DNS resolves service names

8. **Valid Syntax**
   - Each directive ends with semicolon ;
   - Blocks use curly braces { }
   - No syntax errors (validated by Guardrails)
`;

export const DOCKERIGNORE_GENERATION_RULES = `
.dockerignore GENERATION RULES:

1. **Always Include**
   - node_modules/ (for Node.js)
   - .git/
   - .gitignore
   - README.md
   - .env (sensitive data)
   - .env.local, .env.*.local
   - npm-debug.log, yarn-error.log

2. **Build Artifacts**
   - dist/
   - build/
   - .next/
   - out/
   - coverage/
   - .cache/

3. **IDE and OS**
   - .vscode/
   - .idea/
   - .DS_Store
   - Thumbs.db
   - *.swp

4. **Python Specific**
   - __pycache__/
   - *.py[cod]
   - .venv/
   - venv/
   - .pytest_cache/

5. **Docker Files**
   - Dockerfile
   - docker-compose.yml
   - .dockerignore

6. **Documentation**
   - *.md (except necessary docs)
   - docs/
   - LICENSE

7. **Test Files**
   - test/
   - tests/
   - **/*.test.js
   - **/*.spec.ts
`;

export function getAntiHallucinationPrompt(analysisData: any): string {
    return `${ANTI_HALLUCINATION_RULES}

DETECTED PROJECT ANALYSIS DATA:
${JSON.stringify(analysisData, null, 2)}

⚠️  IMPORTANT: Generate Docker files based ONLY on this analysis data.
⚠️  DO NOT assume or invent any framework, tool, or configuration not present above.
⚠️  If you are uncertain about any detail, use generic but valid fallback patterns.

Now generate valid, production-ready Docker configuration files following ALL rules above.
`;
}

export function getFileSpecificRules(fileType: 'dockerfile' | 'dockercompose' | 'nginx' | 'dockerignore'): string {
    switch (fileType) {
        case 'dockerfile':
            return DOCKERFILE_GENERATION_RULES;
        case 'dockercompose':
            return DOCKER_COMPOSE_GENERATION_RULES;
        case 'nginx':
            return NGINX_GENERATION_RULES;
        case 'dockerignore':
            return DOCKERIGNORE_GENERATION_RULES;
        default:
            return '';
    }
}

export function validateAnalysisBeforeGeneration(analysis: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if analysis has minimum required data
    if (!analysis) {
        errors.push('No analysis data provided');
        return { valid: false, errors };
    }

    // Check for detected language/framework
    const hasFramework = 
        (analysis.frontends && analysis.frontends.length > 0) ||
        (analysis.backends && analysis.backends.length > 0) ||
        (analysis.primaryLanguage && analysis.primaryLanguage !== 'unknown');

    if (!hasFramework) {
        errors.push('No frontend, backend, or programming language detected in analysis');
    }

    // Check for project structure
    if (!analysis.projectType || analysis.projectType === 'unknown') {
        errors.push('Project type could not be determined');
    }

    // Warn about missing package manager
    if (!analysis.packageManager && !analysis.buildTool) {
        errors.push('No package manager or build tool detected - may affect Docker generation');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
