/**
 * Advanced Production Docker Configuration Generator
 * Enhanced prompt for Gemini/OpenAI to generate production-ready Docker files
 */

export function createAdvancedProductionPrompt(analysis: any): string {
    const hasBackend = analysis.backends.length > 0;
    const hasFrontend = analysis.frontends.length > 0;
    const isMonorepo = analysis.isMonorepo;
    const hasDatabases = analysis.databases.length > 0;
    const hasMessageQueue = analysis.services?.rabbitmq || analysis.services?.kafka;
    const hasCache = analysis.services?.redis;
    const hasWebSocket = analysis.specialConfigs?.hasWebSocket;

    return `
# 🚀 ADVANCED PRODUCTION DOCKER CONFIGURATION GENERATOR

You are an expert Docker and DevOps configuration generator. Generate production-ready Docker configurations based on the comprehensive codebase analysis below.

## 📊 CODEBASE ANALYSIS RESULTS

### PROJECT STRUCTURE
- **Root**: ${analysis.projectRoot}
- **Type**: ${isMonorepo ? '**MONOREPO**' : 'Single Repository'}
- **Workspaces**: ${analysis.workspaces?.join(', ') || 'N/A'}

---

## 🎨 FRONTEND SERVICES (${analysis.frontends.length} detected)

${hasFrontend ? analysis.frontends.map((fe: any, i: number) => `
### Frontend #${i + 1}: ${fe.framework}
- **Location**: \`${fe.path}\`
- **Framework**: **${fe.framework}** ${fe.variant ? `(${fe.variant})` : ''}
- **Build Tool**: ${fe.buildTool || 'standard'}
- **Package Manager**: ${fe.packageManager}
- **Build Output**: **\`${fe.outputFolder}\`** ⚠️ CRITICAL PATH
- **Build Command**: \`${fe.buildCommand || 'npm run build'}\`
- **Port**: ${fe.port || 3000}
- **TypeScript**: ${fe.hasTypeScript ? 'Yes' : 'No'}
- **Env Files**: ${fe.envFiles.join(', ') || 'None'}
`).join('\n') : '❌ NO FRONTEND'}

---

## ⚙️ BACKEND SERVICES (${analysis.backends.length} detected)

${hasBackend ? analysis.backends.map((be: any, i: number) => `
### Backend #${i + 1}: ${be.framework}
- **Location**: \`${be.path}\`  
- **Framework**: **${be.framework}**
- **Language**: ${be.language}
- **Port**: ${be.port || 8000}
- **Main File**: ${be.mainFile || 'auto-detect'}
- **Package Manager**: ${be.packageManager || 'N/A'}

**Runtime Instructions:**
${be.language === 'python' && be.framework.includes('fastapi') ? '- Use uvicorn: `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`' : ''}
${be.language === 'python' && be.framework.includes('django') ? '- Use gunicorn: `CMD ["gunicorn", "wsgi:application", "--bind", "0.0.0.0:8000"]`' : ''}
${be.language === 'python' && be.framework.includes('flask') ? '- Use gunicorn: `CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]`' : ''}
${be.language === 'node' ? '- Use Node.js with PM2 for process management (optional)' : ''}
${be.language === 'go' ? '- Compile to binary, use scratch or alpine image' : ''}
`).join('\n') : '❌ NO BACKEND'}

---

## 🗄️ DATABASES (${analysis.databases.length} detected)

${hasDatabases ? analysis.databases.map((db: any) => `
### ${db.type.toUpperCase()}
- Version: ${db.version || 'latest'}
- Health Check: ${db.type === 'postgres' ? 'pg_isready' : db.type === 'mongodb' ? 'mongosh ping' : db.type === 'redis' ? 'redis-cli ping' : db.type.includes('mysql') || db.type.includes('mariadb') ? 'mysqladmin ping' : 'TCP check'}
- Persistent Volume: **REQUIRED**
- Init Scripts: Check for migrations
`).join('\n') : '❌ NO DATABASE'}

${hasMessageQueue ? `
---
## 📬 MESSAGE QUEUES
${analysis.services?.rabbitmq ? '- **RabbitMQ**: Include management UI (port 15672)' : ''}
${analysis.services?.kafka ? '- **Kafka**: Include Zookeeper + Kafka broker' : ''}
` : ''}

${hasCache ? `
---
## 💾 CACHE LAYER
- **Redis**: Detected for caching/sessions
` : ''}

${hasWebSocket ? `
---
## 🔌 WEBSOCKET SUPPORT REQUIRED
- Nginx must proxy WebSocket connections
- Include Upgrade headers in proxy configuration
` : ''}

---

## 🔐 ENVIRONMENT VARIABLES
- **Files**: ${analysis.environmentVariables?.files.join(', ') || 'None'}
- **Count**: ${Object.keys(analysis.environmentVariables?.variables || {}).length}
- **Samples**: ${Object.keys(analysis.environmentVariables?.variables || {}).slice(0, 10).join(', ')}

---

## ⚙️ SPECIAL CONFIGURATIONS
- **Prisma ORM**: ${analysis.specialConfigs?.hasPrisma ? 'Yes - Include migration commands' : 'No'}
- **GraphQL**: ${analysis.specialConfigs?.hasGraphQL ? 'Yes' : 'No'}
- **WebSocket**: ${analysis.specialConfigs?.hasWebSocket ? '⚠️ YES - Configure nginx WebSocket proxy' : 'No'}
- **Authentication**: ${analysis.specialConfigs?.hasAuth ? 'Yes - Secure sessions' : 'No'}

---

# 🎯 GENERATION INSTRUCTIONS

## ✅ OUTPUT FORMAT

Generate files in this EXACT format with clear separators:

\`\`\`
---FILE: Dockerfile---
[Content here]

---FILE: docker-compose.yml---
[Content here]

---FILE: nginx.conf---
[Content here]

---FILE: .dockerignore---
[Content here]

---FILE: .env.example---
[Content here]
\`\`\`

---

## 📝 DOCKERFILE REQUIREMENTS

### For Frontend Projects:
\`\`\`dockerfile
# ==================== STAGE 1: BUILD ====================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build (outputs to ${hasFrontend ? analysis.frontends[0]?.outputFolder || 'dist' : 'dist'})
RUN npm run build

# ==================== STAGE 2: PRODUCTION ====================
FROM nginx:alpine

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files
COPY --from=builder /app/${hasFrontend ? analysis.frontends[0]?.outputFolder || 'dist' : 'dist'} /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
\`\`\`

### For Backend Projects (Node.js example):
\`\`\`dockerfile
FROM node:20-alpine
WORKDIR /app

# Non-root user
RUN addgroup -g 1001 nodejs && adduser -S nodejs -u 1001 -G nodejs

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source
COPY . .

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD node healthcheck.js || exit 1

CMD ["node", "server.js"]
\`\`\`

---

## 📝 DOCKER-COMPOSE.YML REQUIREMENTS

Must include:
- ✅ All detected services (frontend, backend, db, cache, queue)
- ✅ Networks: bridge network for inter-service communication  
- ✅ Volumes: persistent storage for databases
- ✅ Health checks for all services
- ✅ Resource limits (CPU/Memory)
- ✅ Restart policies: unless-stopped
- ✅ Logging: json-file with rotation
- ✅ Environment variables from .env

Example structure:
\`\`\`yaml
version: "3.8"

services:
${hasFrontend ? `  frontend:
    build:
      context: ${isMonorepo ? './apps/frontend' : '.'}
    ports:
      - "80:80"
    depends_on:
      ${hasBackend ? 'backend:\n        condition: service_started' : ''}
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
` : ''}
${hasBackend ? `  backend:
    build:
      context: ${isMonorepo ? './apps/backend' : '.'}
    ports:
      - "${hasBackend && analysis.backends[0] ? analysis.backends[0].port || 3000 : 3000}:${hasBackend && analysis.backends[0] ? analysis.backends[0].port || 3000 : 3000}"
    environment:
      - NODE_ENV=production
      ${hasDatabases ? `- DATABASE_URL=\${DATABASE_URL}` : ''}
    depends_on:
      ${hasDatabases ? `db:
        condition: service_healthy` : ''}
    networks:
      - app-network
    restart: unless-stopped
` : ''}
${hasDatabases ? `  db:
    image: ${analysis.databases[0]?.type || 'postgres'}:${analysis.databases[0]?.version || 'latest'}
    environment:
      ${analysis.databases[0]?.type === 'postgres' ? '- POSTGRES_PASSWORD=${DB_PASSWORD}' : ''}
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
` : ''}
networks:
  app-network:
    driver: bridge

volumes:
  ${hasDatabases ? 'db-data:' : '# No volumes needed'}
\`\`\`

---

## 📝 NGINX.CONF REQUIREMENTS

⚠️ **CRITICAL**: nginx.conf Must be a SEPARATE FILE, NEVER embedded in Dockerfile!

Must include:
1. **Server block** on port 80
2. **SPA routing** (if frontend-only): try_files $uri /index.html
3. **API proxy** (if backend exists): proxy_pass to backend service
4. **WebSocket support** (if needed)
5. **Security headers**
6. **Performance optimizations** (gzip, caching)

Example:
\`\`\`nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

    ${hasBackend ? `# API Proxy
    location /api/ {
        proxy_pass http://backend:${hasBackend && analysis.backends[0] ? analysis.backends[0].port || 3000 : 3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }` : ''}

    ${hasWebSocket ? `# WebSocket Support
    location /ws {
        proxy_pass http://backend:${hasBackend && analysis.backends[0] ? analysis.backends[0].port || 3000 : 3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }` : ''}

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML
    location ~* \\.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    # Health check
    location /health {
        access_log off;
        return 200 "healthy\\n";
        add_header Content-Type text/plain;
    }
}
\`\`\`

---

## 🚨 CRITICAL RULES

1. ✅ **nginx.conf MUST be SEPARATE** - Never embed in Dockerfile
2. ✅ **Use EXACT output folder**: \`${hasFrontend ? analysis.frontends[0]?.outputFolder || 'dist' : 'dist'}\`
3. ✅ **Multi-stage builds** for frontend
4. ✅ **Health checks** for all services
5. ✅ **Non-root users** in containers
6. ✅ **Environment variables** via .env
7. ✅ **Persistent volumes** for databases
8. ✅ **Security headers** in nginx
9. ✅ **Resource limits** in docker-compose
10. ✅ **Proper service dependencies** with health condition checks

---

## 🎯 SPECIAL CASES

${!hasBackend && hasFrontend ? `
### FRONTEND-ONLY PROJECT
- Single nginx service
- NO backend proxy
- SPA routing only
- Static file serving
` : ''}

${hasBackend && !hasFrontend ? `
### BACKEND-ONLY PROJECT  
- NO nginx
- Direct port exposure
- Health check endpoint
- Process manager for Node.js
` : ''}

${hasBackend && hasFrontend ? `
### FULLSTACK PROJECT
- Nginx reverse proxy
- Frontend static files via nginx
- Backend API via proxy_pass /api/
- WebSocket support if detected
` : ''}

${isMonorepo ? `
### MONOREPO DETECTED
- Root docker-compose.yml
- Separate Dockerfile per service in their directories
- Correct build context paths
- Shared dependencies handling
` : ''}

---

# 🚀 NOW GENERATE

Generate ALL files following the exact format:

\`\`\`
---FILE: Dockerfile---
[Multi-stage production Dockerfile]

---FILE: docker-compose.yml---
[Complete service orchestration]

---FILE: nginx.conf---
[Production nginx config - SEPARATE FILE!]

---FILE: .dockerignore---
[Build context optimization]

---FILE: .env.example---
[Environment variables template]
\`\`\`

**Output ONLY the files with proper separators. No additional text.**
`;
}
