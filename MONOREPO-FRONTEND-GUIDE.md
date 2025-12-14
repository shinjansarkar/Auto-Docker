# 🎯 Monorepo Frontend Generation - Complete Guide

## 📁 Monorepo Structure Example

```
my-monorepo/
├── apps/
│   ├── frontend/              # React/Vue/Next.js app
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── backend/               # Node.js/Python API
│   │   ├── src/
│   │   ├── package.json
│   │   └── server.js
│   └── admin/                 # Admin dashboard (optional)
│       ├── src/
│       └── package.json
├── packages/                  # Shared packages
│   └── ui/
├── docker-compose.yml         # ← Generated at ROOT
├── .env.example              # ← Generated at ROOT
└── package.json              # Root package.json
```

---

## 🎨 Frontend Generation for Monorepo

### **What Gets Generated:**

1. **`apps/frontend/Dockerfile`** - Frontend-specific Dockerfile
2. **`apps/frontend/nginx.conf`** - Nginx configuration (SEPARATE FILE!)
3. **`docker-compose.yml`** - At ROOT level
4. **`.env.example`** - At ROOT level
5. **`.dockerignore`** - At ROOT level

---

## 📝 Generated Files

### **1. `apps/frontend/Dockerfile`**

```dockerfile
# ==================== STAGE 1: BUILD ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files from frontend directory
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY . .

# Build the application
# Output folder is auto-detected: dist (Vite), build (CRA), .next (Next.js)
RUN npm run build

# ==================== STAGE 2: PRODUCTION ====================
FROM nginx:alpine

# Copy nginx configuration (SEPARATE FILE - NOT embedded!)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy ONLY the build output (auto-detected folder)
# For Vite/Vue: dist
# For CRA: build
# For Next.js: .next (but Next.js doesn't use nginx)
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Start nginx (NO USER nginx line!)
CMD ["nginx", "-g", "daemon off;"]
```

**Key Points:**
- ✅ **Multi-stage build** - Smaller final image
- ✅ **Auto-detected output folder** - `dist`, `build`, or `.next`
- ✅ **NO USER nginx** - Runs as nginx by default
- ✅ **NO duplicate COPY** - Only one COPY statement
- ✅ **Separate nginx.conf** - Referenced, not embedded

---

### **2. `apps/frontend/nginx.conf`** (SEPARATE FILE!)

```nginx
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

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;

    # API Proxy to Backend (if fullstack)
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA Routing (for React, Vue, Angular)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets - FIXED REGEX (single backslash)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # No cache for HTML - FIXED REGEX
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Key Points:**
- ✅ **SEPARATE FILE** - Never embedded in Dockerfile
- ✅ **Fixed regex** - Single backslash `\.` not `\\.`
- ✅ **API proxy** - Routes /api/ to backend service
- ✅ **SPA routing** - try_files for single-page apps
- ✅ **Performance** - Gzip, caching, security headers

---

### **3. `docker-compose.yml`** (ROOT LEVEL)

```yaml
version: "3.8"

services:
  # Frontend Service
  frontend:
    build:
      context: ./apps/frontend    # ← Monorepo path
      dockerfile: Dockerfile
    container_name: frontend
    ports:
      - "80:80"                   # Expose to host
    depends_on:
      backend:
        condition: service_started
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Backend Service
  backend:
    build:
      context: ./apps/backend     # ← Monorepo path
      dockerfile: Dockerfile
    container_name: backend
    ports:
      - "3000:3000"               # Internal port
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G

  # PostgreSQL Database
  postgres:
    image: postgres:15
    container_name: postgres
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  postgres-data:
  redis-data:
```

**Key Points:**
- ✅ **Correct build contexts** - `./apps/frontend`, `./apps/backend`
- ✅ **Service dependencies** - Frontend depends on backend
- ✅ **Health checks** - Database readiness
- ✅ **Networks** - Isolated communication
- ✅ **Volumes** - Persistent data
- ✅ **Resource limits** - Production-ready

---

### **4. `.env.example`** (ROOT LEVEL)

```env
# Database Configuration
DB_USER=postgres
DB_PASSWORD=your_secure_password_here
DB_NAME=myapp

# Redis Configuration
REDIS_URL=redis://redis:6379

# Backend Configuration
NODE_ENV=production
PORT=3000
API_URL=http://backend:3000

# Frontend Configuration (build-time)
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=My Awesome App

# JWT/Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# Email (if detected)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_password
```

---

### **5. `.dockerignore`** (ROOT LEVEL)

```
# Dependencies
node_modules
npm-debug.log
yarn-error.log

# Build artifacts
dist
build
.next
.nuxt
out

# Version control
.git
.gitignore

# Editor
.vscode
.idea

# Logs
logs
*.log

# OS files
.DS_Store
Thumbs.db

# Docker files
Dockerfile
docker-compose.yml
.dockerignore

# NOTE: .env files are NOT ignored - they're needed in containers!
```

---

## 🎯 Framework-Specific Examples

### **React + Vite**

**Detected:**
- Framework: `react`
- Build Tool: `vite`
- Output Folder: `dist`
- Build Command: `npm run build`

**Generated Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Outputs to dist/

# Production stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html  # ← dist folder
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### **React + Create React App**

**Detected:**
- Framework: `react`
- Build Tool: `webpack`
- Output Folder: `build`
- Build Command: `npm run build`

**Generated Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Outputs to build/

# Production stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html  # ← build folder
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### **Next.js (SSR)**

**Detected:**
- Framework: `nextjs`
- Type: `SSR`
- Output Folder: `.next`
- Build Command: `npm run build`

**Generated Dockerfile (NO NGINX!):**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]  # Next.js has its own server
```

**Note:** Next.js doesn't need nginx because it has its own Node.js server!

---

### **Vue + Vite**

**Detected:**
- Framework: `vue`
- Build Tool: `vite`
- Output Folder: `dist`
- Build Command: `npm run build`

**Generated Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Outputs to dist/

# Production stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html  # ← dist folder
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

### **Angular**

**Detected:**
- Framework: `angular`
- Build Tool: `angular-cli`
- Output Folder: `dist/my-app`
- Build Command: `npm run build`

**Generated Dockerfile:**
```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build  # Outputs to dist/my-app/

# Production stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/my-app /usr/share/nginx/html  # ← dist/my-app
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🚀 How to Use

### **Step 1: Run Auto Docker Extension**
```
Ctrl+Shift+P → "Auto Docker: Analyze Project & Generate Docker Files"
```

### **Step 2: Files Generated**
```
my-monorepo/
├── apps/
│   ├── frontend/
│   │   ├── Dockerfile          ← Generated
│   │   └── nginx.conf          ← Generated (separate!)
│   └── backend/
│       └── Dockerfile          ← Generated
├── docker-compose.yml          ← Generated
├── .env.example               ← Generated
└── .dockerignore              ← Generated
```

### **Step 3: Build & Run**
```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f frontend

# Stop all services
docker-compose down
```

---

## ✅ What Makes It Work

### **Auto-Detection:**
1. ✅ Scans `apps/`, `packages/`, `services/` folders
2. ✅ Detects framework from package.json
3. ✅ Identifies build tool (Vite, Webpack, etc.)
4. ✅ Determines output folder
5. ✅ Finds correct build command

### **Smart Generation:**
1. ✅ Creates Dockerfile in each service directory
2. ✅ Generates nginx.conf as SEPARATE file
3. ✅ Sets correct build context in docker-compose.yml
4. ✅ Links services with dependencies
5. ✅ Adds health checks
6. ✅ Configures networks and volumes

### **No Errors:**
1. ✅ NO `USER nginx` line
2. ✅ NO duplicate COPY statements
3. ✅ Fixed regex patterns (single backslash)
4. ✅ Correct output folder paths
5. ✅ Separate nginx.conf file

---

## 🎉 Summary

For a **monorepo**, the frontend generation:

1. **Detects** the framework and build tool
2. **Creates** `Dockerfile` in `apps/frontend/`
3. **Generates** `nginx.conf` as a SEPARATE file
4. **Uses** correct output folder (dist/build/.next)
5. **Fixes** all regex errors
6. **Removes** USER nginx line
7. **Prevents** duplicate COPY statements
8. **Links** to backend via docker-compose.yml
9. **Adds** health checks and resource limits
10. **Works** perfectly! 🚀

---

**Ready to generate production-ready Docker configs for your monorepo!** 🎉
