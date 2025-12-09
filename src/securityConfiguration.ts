import * as fs from 'fs';
import * as path from 'path';

/**
 * Security Configuration Module
 * Handles security headers, CORS, container security, secret management, and SSL/TLS
 * 
 * Errors Fixed:
 * - Error #36: Security headers (HTTP security)
 * - Error #37: CORS configuration (cross-origin requests)
 * - Error #38: Container security (hardening)
 * - Error #39: Secret management (credentials)
 * - Error #40: SSL/TLS support (encryption)
 */

// ==================== INTERFACES ====================

export interface SecurityHeaders {
  'Strict-Transport-Security'?: string;
  'X-Content-Type-Options'?: string;
  'X-Frame-Options'?: string;
  'X-XSS-Protection'?: string;
  'Content-Security-Policy'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
}

export interface CORSConfig {
  origin: string | string[] | RegExp;
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
}

export interface ContainerSecurityConfig {
  readOnly: boolean;
  runAsNonRoot: boolean;
  runAsUser?: number;
  capabilities?: {
    add: string[];
    drop: string[];
  };
  securityContext?: {
    privileged: boolean;
    allowPrivilegeEscalation: boolean;
  };
}

export interface SecretConfig {
  name: string;
  value: string;
  encrypted: boolean;
  rotationPolicy?: {
    interval: number; // days
    algorithm?: string;
  };
}

export interface SSLTLSConfig {
  enabled: boolean;
  protocol: 'tls' | 'ssl';
  version: '1.0' | '1.1' | '1.2' | '1.3';
  certificateFormat: 'pem' | 'der' | 'p12';
  certificatePath?: string;
  keyPath?: string;
  cipherSuites?: string[];
  hsts?: boolean;
  hstsMaxAge?: number;
}

// ==================== SECURITY HEADERS GENERATOR (Error #36) ====================

export class SecurityHeadersGenerator {
  /**
   * Error #36: Generate security headers
   */
  static generateSecurityHeaders(appType: 'web' | 'api' | 'spa' = 'api'): SecurityHeaders {
    return {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': this.generateCSP(appType),
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': this.generatePermissionsPolicy()
    };
  }

  private static generateCSP(appType: string): string {
    const policies: { [key: string]: string } = {
      'web': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none'",
      'api': "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'; connect-src 'none'; frame-ancestors 'none'",
      'spa': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.*; frame-ancestors 'none'"
    };

    return policies[appType] || policies['api'];
  }

  private static generatePermissionsPolicy(): string {
    return `
      accelerometer=(),
      ambient-light-sensor=(),
      autoplay=(self),
      battery=(),
      camera=(),
      display-capture=(),
      document-domain=(),
      encrypted-media=(),
      fullscreen=(self),
      geolocation=(),
      gyroscope=(),
      magnetometer=(),
      microphone=(),
      midi=(),
      payment=(),
      usb=(),
      xr-spatial-tracking=()
    `.trim();
  }

  /**
   * Generate Nginx security headers configuration
   */
  static generateNginxSecurityHeaders(headers: SecurityHeaders): string {
    let config = '';

    for (const [header, value] of Object.entries(headers)) {
      if (value) {
        config += `    add_header ${header} "${value}" always;\n`;
      }
    }

    return config;
  }

  /**
   * Generate Express.js security headers middleware
   */
  static generateExpressSecurityHeaders(headers: SecurityHeaders): string {
    const headerCode = Object.entries(headers)
      .map(([key, value]) => `      res.setHeader('${key}', '${value}');`)
      .join('\n');

    return `// Security headers middleware
app.use((req, res, next) => {
${headerCode}
  next();
});`;
  }
}

// ==================== CORS CONFIGURATOR (Error #37) ====================

export class CORSConfigurator {
  /**
   * Error #37: Configure CORS
   */
  static generateCORSConfig(allowedOrigins: string[] = ['http://localhost:3000']): CORSConfig {
    return {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Accept-Language'
      ],
      exposedHeaders: [
        'Content-Length',
        'X-Request-Id',
        'X-Response-Time'
      ],
      maxAge: 86400 // 24 hours
    };
  }

  /**
   * Generate Nginx CORS configuration
   */
  static generateNginxCORS(config: CORSConfig): string {
    const origins = Array.isArray(config.origin) 
      ? config.origin.map(o => `'${o}'`).join(' | ')
      : `'${config.origin}'`;

    return `# CORS headers
set $cors_origin "";
if ($http_origin ~* ^(${origins})$) {
    set $cors_origin $http_origin;
}

add_header Access-Control-Allow-Origin $cors_origin always;
add_header Access-Control-Allow-Methods "${config.methods.join(', ')}" always;
add_header Access-Control-Allow-Headers "${config.allowedHeaders.join(', ')}" always;
add_header Access-Control-Expose-Headers "${config.exposedHeaders.join(', ')}" always;
${config.credentials ? 'add_header Access-Control-Allow-Credentials "true" always;' : ''}
add_header Access-Control-Max-Age "${config.maxAge}" always;

# Handle preflight requests
if ($request_method = OPTIONS) {
    return 204;
}`;
  }

  /**
   * Generate Express.js CORS middleware
   */
  static generateExpressCORS(config: CORSConfig): string {
    const originConfig = Array.isArray(config.origin) 
      ? `[${config.origin.map(o => `'${o}'`).join(', ')}]`
      : `'${config.origin}'`;

    return `const cors = require('cors');

app.use(cors({
  origin: ${originConfig},
  credentials: ${config.credentials},
  methods: [${config.methods.map(m => `'${m}'`).join(', ')}],
  allowedHeaders: [${config.allowedHeaders.map(h => `'${h}'`).join(', ')}],
  exposedHeaders: [${config.exposedHeaders.map(h => `'${h}'`).join(', ')}],
  maxAge: ${config.maxAge}
}));`;
  }

  /**
   * Generate preflight request handler
   */
  static generatePreflightHandler(): string {
    return `// Handle preflight requests
app.options('*', cors());
app.options('/api/*', cors());`;
  }
}

// ==================== CONTAINER SECURITY (Error #38) ====================

export class ContainerSecurityConfigurator {
  /**
   * Error #38: Configure container security
   */
  static generateContainerSecurity(): ContainerSecurityConfig {
    return {
      readOnly: true,
      runAsNonRoot: true,
      runAsUser: 1000,
      capabilities: {
        add: [],
        drop: [
          'ALL',
          'NET_RAW',
          'NET_ADMIN',
          'SYS_ADMIN',
          'AUDIT_WRITE'
        ]
      },
      securityContext: {
        privileged: false,
        allowPrivilegeEscalation: false
      }
    };
  }

  /**
   * Generate Dockerfile security configuration
   */
  static generateDockerfileSecurity(): string {
    return `# Create non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Set security options
RUN chmod -R 755 /app

# Run as non-root user
USER appuser

# Enable read-only filesystem
# (add --read-only flag to docker run or docker-compose)
`;
  }

  /**
   * Generate docker-compose security configuration
   */
  static generateComposeSecurityConfig(serviceName: string): string {
    return `  ${serviceName}:
    image: ${serviceName}:latest
    user: "1000"
    read_only: true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp
      - /run
    volumes:
      - app-data:/home/appuser/.local/share:ro
      - app-config:/home/appuser/.config:ro`;
  }

  /**
   * Generate SELinux policy
   */
  static generateSELinuxPolicy(containerName: string): string {
    return `# SELinux policy for ${containerName}
allow ${containerName}_t init_t : file { read open getattr };
allow ${containerName}_t kernel_t : system { module_request };
allow ${containerName}_t sysfs_t : file { read open getattr };
`;
  }

  /**
   * Generate AppArmor profile
   */
  static generateAppArmorProfile(containerName: string): string {
    return `#include <tunables/global>

profile ${containerName} flags=(attach_disconnected,mediate_deleted) {
  #include <abstractions/base>
  
  deny capability dac_override,
  deny capability dac_read_search,
  deny capability setuid,
  deny capability setgid,
  deny capability sys_admin,
  
  /app/** r,
  /proc/*/stat r,
  /proc/sys/kernel/osrelease r,
  
  deny /sys/** w,
  deny /proc/sys/** w,
  deny /dev/mem w,
}
`;
  }
}

// ==================== SECRET MANAGER (Error #39) ====================

export class SecretManager {
  /**
   * Error #39: Configure secret management
   */
  static generateSecretConfig(secretName: string, secretValue: string): SecretConfig {
    return {
      name: secretName,
      value: secretValue,
      encrypted: true,
      rotationPolicy: {
        interval: 90,
        algorithm: 'AES-256-GCM'
      }
    };
  }

  /**
   * Generate .env.example file (without actual secrets)
   */
  static generateEnvExample(secrets: string[]): string {
    return secrets
      .map(secret => `${secret}=YOUR_${secret}_HERE`)
      .join('\n');
  }

  /**
   * Generate secret mounting configuration
   */
  static generateSecretMounts(): string {
    return `# Docker secret management
secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_key:
    file: ./secrets/api_key.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  ssl_certificate:
    file: ./secrets/ssl_cert.pem
  ssl_key:
    file: ./secrets/ssl_key.pem

services:
  app:
    secrets:
      - db_password
      - api_key
      - jwt_secret
      - ssl_certificate
      - ssl_key
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password
      - API_KEY_FILE=/run/secrets/api_key
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
`;
  }

  /**
   * Generate Vault integration configuration
   */
  static generateVaultConfig(): string {
    return `# Vault configuration for secret management
vault {
  address = "http://vault:8200"
  method "auth/approle" {
    params {
      role_id_file_path = "/etc/vault/role-id"
      secret_id_file_path = "/etc/vault/secret-id"
    }
  }
}

# Auto-unseal configuration
seal "transit" {
  address     = "http://vault:8200"
  disable_req_forwarding = "false"
  key_name    = "autounseal"
  mount_path  = "transit/"
  tls_skip_verify = "false"
}
`;
  }

  /**
   * Generate secret rotation script
   */
  static generateSecretRotationScript(): string {
    return `#!/bin/bash
# Secret rotation script

ROTATION_INTERVAL=90

rotate_secrets() {
  echo "Rotating secrets..."
  
  # Generate new database password
  NEW_DB_PASSWORD=$(openssl rand -base64 32)
  echo "$NEW_DB_PASSWORD" > /run/secrets/db_password
  
  # Generate new API key
  NEW_API_KEY=$(openssl rand -hex 32)
  echo "$NEW_API_KEY" > /run/secrets/api_key
  
  # Generate new JWT secret
  NEW_JWT_SECRET=$(openssl rand -base64 64)
  echo "$NEW_JWT_SECRET" > /run/secrets/jwt_secret
  
  # Update application secrets
  docker service update --secret-rm db_password --secret-add db_password=new_db_password app
  
  echo "Secrets rotated successfully"
}

# Run rotation
rotate_secrets

# Schedule next rotation
sleep $((ROTATION_INTERVAL * 24 * 3600))
`;
  }
}

// ==================== SSL/TLS CONFIGURATOR (Error #40) ====================

export class SSLTLSConfigurator {
  /**
   * Error #40: Configure SSL/TLS
   */
  static generateSSLTLSConfig(certificatePath?: string, keyPath?: string): SSLTLSConfig {
    return {
      enabled: true,
      protocol: 'tls',
      version: '1.3',
      certificateFormat: 'pem',
      certificatePath: certificatePath || '/etc/ssl/certs/server.crt',
      keyPath: keyPath || '/etc/ssl/private/server.key',
      cipherSuites: [
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305'
      ],
      hsts: true,
      hstsMaxAge: 31536000
    };
  }

  /**
   * Generate Nginx SSL/TLS configuration
   */
  static generateNginxSSLConfig(config: SSLTLSConfig): string {
    return `# SSL/TLS Configuration
listen 443 ssl http2;
listen [::]:443 ssl http2;

ssl_certificate ${config.certificatePath};
ssl_certificate_key ${config.keyPath};

# TLS version
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;

# Cipher suites
ssl_ciphers '${config.cipherSuites?.join(':')}';

# SSL session
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# HSTS
${config.hsts ? `add_header Strict-Transport-Security "max-age=${config.hstsMaxAge}; includeSubDomains; preload" always;` : ''}

# OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
`;
  }

  /**
   * Generate self-signed certificate script
   */
  static generateCertificateScript(): string {
    return `#!/bin/bash
# Generate self-signed certificate

DAYS=365
COUNTRY="US"
STATE="State"
CITY="City"
ORGANIZATION="Organization"
COMMON_NAME="localhost"

# Generate private key
openssl genrsa -out server.key 2048

# Generate certificate
openssl req -new -x509 -key server.key -out server.crt -days $DAYS \\
  -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORGANIZATION/CN=$COMMON_NAME"

# Set permissions
chmod 600 server.key
chmod 644 server.crt

echo "Certificate and key generated successfully"
`;
  }

  /**
   * Generate Let's Encrypt/Certbot configuration
   */
  static generateCertbotConfig(domain: string): string {
    return `# Certbot configuration for Let's Encrypt
domains = ${domain}
rsa-key-size = 2048
authenticator = webroot
webroot-path = /var/www/certbot/
agree-tos = True
email = admin@${domain}
text = True
non-interactive = True
prefer-challenges = http
certbot-hook = /etc/letsencrypt/renewal-hooks/post/restart-nginx.sh
`;
  }

  /**
   * Generate TLS certificate validation script
   */
  static generateCertificateValidationScript(): string {
    return `#!/bin/bash
# Certificate validation script

CERT_FILE="/etc/ssl/certs/server.crt"

# Check if certificate exists
if [ ! -f "$CERT_FILE" ]; then
  echo "ERROR: Certificate not found"
  exit 1
fi

# Check certificate expiration
EXPIRY_DATE=$(openssl x509 -in "$CERT_FILE" -noout -enddate | cut -d= -f 2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_UNTIL_EXPIRY=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

echo "Certificate expires in $DAYS_UNTIL_EXPIRY days"

# Warn if expiring soon (within 30 days)
if [ $DAYS_UNTIL_EXPIRY -lt 30 ]; then
  echo "WARNING: Certificate will expire soon!"
  exit 1
fi

exit 0
`;
  }
}

export default {
  SecurityHeadersGenerator,
  CORSConfigurator,
  ContainerSecurityConfigurator,
  SecretManager,
  SSLTLSConfigurator
};
