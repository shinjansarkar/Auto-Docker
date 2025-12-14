/**
 * CRITICAL DOCKER GENERATION RULES
 * These rules MUST be followed by the LLM to generate correct Docker files
 */

export const CRITICAL_DOCKER_RULES = `
🚨 CRITICAL RULES - MUST FOLLOW EXACTLY:

1. ❌ NEVER use "USER nginx" in Dockerfile
   - nginx:alpine runs as nginx user by default
   - Adding USER nginx causes permission errors

2. ❌ NEVER embed nginx.conf content inside Dockerfile
   - ALWAYS generate nginx.conf as a SEPARATE file
   - Reference it with: COPY nginx.conf /etc/nginx/conf.d/default.conf

3. ❌ NEVER use double backslash in nginx location regex
   - CORRECT: location ~* \\.(js|css|png|jpg)$
   - WRONG: location ~* \\\\.(js|css|png|jpg)$
   - Single backslash for regex patterns!

4. ❌ NEVER duplicate COPY --from=builder statements
   - Use ONLY ONE COPY statement for build output
   - CORRECT: COPY --from=builder /app/dist /usr/share/nginx/html
   - WRONG: Multiple COPY statements for same files

5. ✅ ALWAYS use exact detected build output folder
   - Vite → dist
   - CRA → build
   - Next.js → .next
   - Angular → dist/[project-name]
   - Vue → dist

6. ✅ For MONOREPO projects:
   - Use correct build context: ./apps/frontend, ./apps/backend
   - Generate Dockerfile in each service directory
   - Root-level docker-compose.yml
   - Separate nginx.conf per frontend service

7. ✅ nginx.conf MUST be production-ready:
   - Security headers (X-Frame-Options, X-Content-Type-Options, etc.)
   - Gzip compression
   - Static file caching with correct regex
   - SPA routing: try_files $uri $uri/ /index.html
   - API proxy (if backend exists)
   - Health check endpoint

8. ✅ docker-compose.yml MUST include:
   - Correct build contexts for monorepo
   - Service dependencies with health conditions
   - Networks for service communication
   - Volumes for database persistence
   - Resource limits (CPU/Memory)
   - Health checks for all services
   - Restart policies

9. ✅ Multi-stage builds for frontend:
   - Stage 1: node:20-alpine AS builder (build)
   - Stage 2: nginx:alpine (production serve)
   - NO intermediate stages unless necessary

10. ✅ Backend production commands:
    - FastAPI: uvicorn main:app --host 0.0.0.0 --port 8000
    - Django: gunicorn wsgi:application --bind 0.0.0.0:8000
    - Flask: gunicorn --bind 0.0.0.0:5000 app:app
    - Express: node server.js
    - NestJS: node dist/main.js
`;

export const MONOREPO_RULES = `
📦 MONOREPO-SPECIFIC RULES:

1. Build Context Paths:
   - Frontend: build: { context: ./apps/frontend }
   - Backend: build: { context: ./apps/backend }
   - NOT: build: { context: . }

2. Dockerfile Location:
   - Place Dockerfile IN each service directory
   - apps/frontend/Dockerfile
   - apps/backend/Dockerfile
   - NOT at root level

3. docker-compose.yml Location:
   - ALWAYS at root level
   - References service subdirectories

4. nginx.conf Location:
   - Place IN frontend service directory
   - apps/frontend/nginx.conf
   - Referenced in frontend Dockerfile

5. Shared Dependencies:
   - Handle workspace dependencies correctly
   - Copy package.json from service directory
   - NOT from root
`;

export const NGINX_TEMPLATE_RULES = `
🌐 NGINX CONFIGURATION RULES:

1. File Structure:
   server {
       listen 80;
       server_name localhost;
       root /usr/share/nginx/html;
       index index.html;

       # Security headers
       add_header X-Frame-Options "SAMEORIGIN" always;
       add_header X-Content-Type-Options "nosniff" always;

       # Gzip
       gzip on;
       gzip_types text/plain text/css application/javascript;

       # API proxy (if backend)
       location /api/ {
           proxy_pass http://backend:3000;
           proxy_set_header Host $host;
       }

       # SPA routing
       location / {
           try_files $uri $uri/ /index.html;
       }

       # Static assets - SINGLE BACKSLASH!
       location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
           expires 1y;
           add_header Cache-Control "public, immutable";
       }
   }

2. Common Mistakes to AVOID:
   - ❌ Double backslash: \\\\.(js|css)$
   - ❌ Missing proxy headers
   - ❌ No gzip compression
   - ❌ No security headers
   - ❌ Embedding in Dockerfile
`;
