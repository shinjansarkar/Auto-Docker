/**
 * Simple NGINX Generator
 * Generates minimal, correct NGINX configurations
 * Fixes Issues #12-15: NGINX configuration errors
 */

import * as fs from 'fs';
import * as path from 'path';

export interface NginxOptions {
    hasBackend?: boolean;
    backendUrl?: string;
    backendPort?: number;
    apiPrefix?: string;
}

/**
 * Simple NGINX Generator - Main Class
 */
export class SimpleNginxGenerator {

    /**
     * Determine if nginx.conf should be generated based on project type
     */
    static shouldGenerateNginx(projectType: string, hasFrontend: boolean, hasBackend: boolean): boolean {
        // Frontend-only: YES (serve static files)
        if (projectType === 'frontend' || projectType === 'frontend-only') {
            return true;
        }
        
        // Fullstack: YES (reverse proxy)
        if (projectType === 'fullstack' && (hasFrontend || hasBackend)) {
            return true;
        }
        
        // Backend-only: YES (reverse proxy, load balancing, SSL termination)
        if (projectType === 'backend' || projectType === 'backend-only') {
            return true;
        }
        
        // Monorepo: YES (always useful for routing)
        if (projectType === 'monorepo') {
            return true;
        }
        
        // Default: always generate nginx for production best practices
        return true;
    }

    /**
     * Check if user already has nginx.conf
     */
    static hasExistingNginxConfig(projectPath: string): boolean {
        const possiblePaths = [
            path.join(projectPath, 'nginx.conf'),
            path.join(projectPath, 'nginx', 'nginx.conf'),
            path.join(projectPath, 'config', 'nginx.conf'),
            path.join(projectPath, 'frontend', 'nginx.conf')
        ];

        return possiblePaths.some(p => fs.existsSync(p));
    }

    /**
     * Get path to existing nginx.conf
     */
    static getExistingNginxConfigPath(projectPath: string): string | null {
        const possiblePaths = [
            path.join(projectPath, 'nginx.conf'),
            path.join(projectPath, 'nginx', 'nginx.conf'),
            path.join(projectPath, 'config', 'nginx.conf'),
            path.join(projectPath, 'frontend', 'nginx.conf')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        return null;
    }

    /**
     * Generate nginx configuration
     */
    static generateNginxConfig(options?: NginxOptions): string {
        const hasBackend = options?.hasBackend || false;

        if (hasBackend) {
            return this.generateFullstackNginxConfig(options);
        } else {
            return this.generateFrontendOnlyNginxConfig();
        }
    }

    /**
     * Generate frontend-only nginx configuration (simple SPA serving)
     * RULE: Simple, minimal, correct try_files for SPAs
     */
    private static generateFrontendOnlyNginxConfig(): string {
        return `server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
`;
    }

    /**
     * Generate fullstack nginx configuration (with backend proxy)
     * RULE: Serve static files + proxy API requests to backend
     */
    private static generateFullstackNginxConfig(options?: NginxOptions): string {
        const backendUrl = options?.backendUrl || 'backend';
        const backendPort = options?.backendPort || 8000;
        const apiPrefix = options?.apiPrefix || '/api';

        return `server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ${apiPrefix}/ {
        proxy_pass http://${backendUrl}:${backendPort}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
`;
    }

    /**
     * Generate backend-only nginx configuration (reverse proxy with security)
     * RULE: Production-ready reverse proxy with rate limiting, security headers, health checks
     * Used for: Backend-only projects that benefit from nginx layer
     */
    static generateBackendOnlyNginxConfig(options?: NginxOptions): string {
        const backendUrl = options?.backendUrl || 'backend';
        const backendPort = options?.backendPort || 8000;
        const apiPrefix = options?.apiPrefix || '/api';

        return `# Backend-Only Reverse Proxy Configuration
# Production-ready nginx for backend services
# Features: Rate limiting, security headers, health checks, SSL-ready

events {
    worker_connections 1024;
}

http {
    # Rate limiting zone (10MB can store ~160k IP addresses)
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    
    # Upstream backend server
    upstream backend_upstream {
        server ${backendUrl}:${backendPort};
        keepalive 32;
    }

    server {
        listen 80;
        server_name _;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Hide nginx version
        server_tokens off;

        # Health check endpoint (no rate limiting for monitoring)
        location /health {
            access_log off;
            proxy_pass http://backend_upstream/health;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_connect_timeout 5s;
            proxy_read_timeout 5s;
        }

        # API endpoints with rate limiting
        location ${apiPrefix}/ {
            # Apply rate limiting (burst allows temporary spikes)
            limit_req zone=api_limit burst=20 nodelay;
            
            # Proxy to backend
            proxy_pass http://backend_upstream/;
            proxy_http_version 1.1;
            
            # WebSocket support
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            
            # Forward client information
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # Buffering
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
        }

        # Root endpoint (no /api prefix)
        location / {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend_upstream/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Custom error pages
        error_page 502 503 504 /50x.html;
        location = /50x.html {
            return 502 '{"error":"Backend service unavailable"}';
            add_header Content-Type application/json;
        }
    }
}
`;
    }

    /**
     * Generate nginx configuration for monorepo
     */
    static generateMonorepoNginxConfig(hasBackend: boolean): string {
        if (hasBackend) {
            return this.generateFullstackNginxConfig({
                hasBackend: true,
                backendUrl: 'backend',
                backendPort: 8000,
                apiPrefix: '/api'
            });
        } else {
            return this.generateFrontendOnlyNginxConfig();
        }
    }

    /**
     * Check if nginx config should be generated
     * RULE: Do NOT overwrite existing configs
     */
    static shouldGenerateNginxConfig(projectPath: string, hasFrontend: boolean): boolean {
        // Don't generate if no frontend exists
        if (!hasFrontend) {
            return false;
        }

        // Don't generate if user already has nginx.conf
        if (this.hasExistingNginxConfig(projectPath)) {
            console.log('[SimpleNginxGenerator] Found existing nginx.conf, skipping generation');
            return false;
        }

        return true;
    }

    /**
     * Get recommended nginx config path
     * RULE: Use /etc/nginx/conf.d/default.conf in Docker, nginx.conf in project root
     */
    static getRecommendedNginxPath(): {
        projectPath: string;
        dockerPath: string;
    } {
        return {
            projectPath: 'nginx.conf',
            dockerPath: '/etc/nginx/conf.d/default.conf'
        };
    }

    /**
     * Generate nginx config with context information
     * NOW SUPPORTS: Backend-only reverse proxy generation
     */
    static generateWithContext(
        hasFrontend: boolean,
        hasBackend: boolean,
        projectPath: string,
        backendPort?: number
    ): {
        shouldGenerate: boolean;
        config?: string;
        reason?: string;
        isBackendOnly?: boolean;
    } {
        // Check for existing nginx config
        if (this.hasExistingNginxConfig(projectPath)) {
            return {
                shouldGenerate: false,
                reason: 'Existing nginx.conf found - will not overwrite'
            };
        }

        // Backend-only: Generate reverse proxy with security features
        if (!hasFrontend && hasBackend) {
            const config = this.generateBackendOnlyNginxConfig({
                hasBackend: true,
                backendUrl: 'backend',
                backendPort: backendPort || 8000,
                apiPrefix: '/api'
            });

            return {
                shouldGenerate: true,
                config,
                isBackendOnly: true,
                reason: 'Generating reverse proxy for backend-only project'
            };
        }

        // Frontend-only or fullstack
        if (!hasFrontend) {
            return {
                shouldGenerate: false,
                reason: 'No frontend detected and no backend-only proxy needed'
            };
        }

        // Generate appropriate config for frontend/fullstack
        const config = this.generateNginxConfig({
            hasBackend,
            backendUrl: 'backend',
            backendPort: backendPort || 8000,
            apiPrefix: '/api'
        });

        return {
            shouldGenerate: true,
            config,
            isBackendOnly: false
        };
    }

    /**
     * Validate nginx configuration syntax (basic check)
     */
    static validateNginxConfig(config: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check for basic syntax
        if (!config.includes('server {')) {
            errors.push('Missing server block');
        }

        if (!config.includes('listen')) {
            errors.push('Missing listen directive');
        }

        if (!config.includes('root')) {
            errors.push('Missing root directive');
        }

        // Check for correct root path
        if (config.includes('root') && !config.includes('/usr/share/nginx/html')) {
            errors.push('Root path should be /usr/share/nginx/html for Docker containers');
        }

        // Check for correct try_files syntax (must include $uri/)
        if (config.includes('try_files') && config.includes('try_files $uri /index.html')) {
            if (!config.includes('try_files $uri $uri/ /index.html')) {
                errors.push('try_files should include $uri/ for nested routes: try_files $uri $uri/ /index.html');
            }
        }

        // Check for balanced braces
        const openBraces = (config.match(/\{/g) || []).length;
        const closeBraces = (config.match(/\}/g) || []).length;
        if (openBraces !== closeBraces) {
            errors.push('Unbalanced braces');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Show diff between existing and new nginx config
     */
    static async showConfigDiff(
        existingPath: string,
        newConfig: string
    ): Promise<{
        hasChanges: boolean;
        existingConfig: string;
        newConfig: string;
    }> {
        const existingConfig = fs.readFileSync(existingPath, 'utf-8');

        // Normalize whitespace for comparison
        const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

        const hasChanges = normalize(existingConfig) !== normalize(newConfig);

        return {
            hasChanges,
            existingConfig,
            newConfig
        };
    }

    /**
     * Generate nginx config comment header
     */
    private static generateConfigHeader(): string {
        return `# NGINX Configuration
# Generated by Auto Docker Extension
# This is a minimal, production-ready configuration
# For SPAs: serves static files with fallback to index.html
# For fullstack: also proxies API requests to backend

`;
    }

    /**
     * Add header to nginx config
     */
    static addHeaderToConfig(config: string): string {
        return this.generateConfigHeader() + config;
    }
}
