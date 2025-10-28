import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StackDetection, FrontendFramework, BackendFramework } from './types';

async function fileExists(fullPath: string): Promise<boolean> {
  try {
    await fs.stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

async function readTextIfExists(fullPath: string): Promise<string | null> {
  if (!(await fileExists(fullPath))) return null;
  try {
    const buf = await fs.readFile(fullPath);
    return buf.toString('utf8');
  } catch {
    return null;
  }
}

function detectFrontendFromPackageJson(pkgJson: any): { 
  framework: FrontendFramework; 
  port: number | null; 
  evidence: string[]; 
  buildTool?: string; 
  packageManager?: string; 
} {
  const deps = { ...(pkgJson?.dependencies || {}), ...(pkgJson?.devDependencies || {}) } as Record<string, string>;
  const scripts = pkgJson?.scripts || {};
  const evidence: string[] = [];
  let buildTool: string | undefined;
  let packageManager: string | undefined;

  const contains = (keys: string[]) => keys.some((k) => deps[k]);

  // Detect package manager
  if (pkgJson.packageManager) {
    packageManager = pkgJson.packageManager;
    evidence.push(`Package manager: ${packageManager}`);
  }

  // Detect build tools
  if (contains(['vite'])) {
    buildTool = 'vite';
    evidence.push('Using Vite as build tool');
  } else if (contains(['webpack'])) {
    buildTool = 'webpack';
    evidence.push('Using Webpack as build tool');
  } else if (contains(['rollup'])) {
    buildTool = 'rollup';
    evidence.push('Using Rollup as build tool');
  } else if (contains(['parcel'])) {
    buildTool = 'parcel';
    evidence.push('Using Parcel as build tool');
  }

  // Detect frameworks
  if (contains(['next'])) {
    evidence.push('Found Next.js in package.json');
    const port = /PORT=(\d{2,5})/.test(JSON.stringify(scripts)) ? Number((JSON.stringify(scripts).match(/PORT=(\d{2,5})/) || [])[1]) : 3000;
    return { framework: 'nextjs', port, evidence, buildTool, packageManager };
  }
  if (contains(['react', 'react-dom'])) {
    evidence.push('Found react/react-dom in package.json');
    const port = /PORT=(\d{2,5})/.test(JSON.stringify(scripts)) ? Number((JSON.stringify(scripts).match(/PORT=(\d{2,5})/) || [])[1]) : 3000;
    return { framework: 'react', port, evidence, buildTool, packageManager };
  }
  if (contains(['nuxt'])) {
    evidence.push('Found Nuxt.js in package.json');
    const port = 3000;
    return { framework: 'nuxt', port, evidence, buildTool, packageManager };
  }
  if (contains(['vue', '@vue/cli-service'])) {
    evidence.push('Found vue/@vue/cli-service in package.json');
    const port = 5173; // Vite default
    return { framework: 'vue', port, evidence, buildTool, packageManager };
  }
  if (contains(['@angular/core'])) {
    evidence.push('Found @angular/core in package.json');
    const port = 4200;
    return { framework: 'angular', port, evidence, buildTool, packageManager };
  }
  if (contains(['svelte'])) {
    evidence.push('Found Svelte in package.json');
    const port = 5173; // Vite default
    return { framework: 'svelte', port, evidence, buildTool, packageManager };
  }
  if (contains(['gatsby'])) {
    evidence.push('Found Gatsby in package.json');
    const port = 8000;
    return { framework: 'gatsby', port, evidence, buildTool, packageManager };
  }
  if (contains(['vite']) && !contains(['react', 'vue', 'svelte'])) {
    evidence.push('Found Vite configuration');
    const port = 5173;
    return { framework: 'vite', port, evidence, buildTool, packageManager };
  }
  if (contains(['webpack']) && !contains(['react', 'vue', 'angular'])) {
    evidence.push('Found Webpack configuration');
    const port = 8080;
    return { framework: 'webpack', port, evidence, buildTool, packageManager };
  }
  
  return { framework: 'unknown', port: null, evidence, buildTool, packageManager };
}

function detectBackendFromFiles(fileMap: Record<string, string | null>): { 
  framework: BackendFramework; 
  port: number | null; 
  evidence: string[]; 
  version?: string; 
  packageManager?: string; 
} {
  const evidence: string[] = [];
  const pkg = fileMap['package.json'] ? JSON.parse(fileMap['package.json'] as string) : null;
  const req = fileMap['requirements.txt'] || '';
  const pom = fileMap['pom.xml'] || '';
  const goMod = fileMap['go.mod'] || '';
  const composer = fileMap['composer.json'] ? JSON.parse(fileMap['composer.json'] as string) : null;
  const csproj = fileMap['csproj'] || '';
  const cargo = fileMap['Cargo.toml'] || '';
  const gemfile = fileMap['Gemfile'] || '';
  const mixExs = fileMap['mix.exs'] || '';

  // Node.js frameworks
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>;
    const has = (k: string) => Boolean(deps[k]);
    const getVersion = (k: string) => deps[k] || 'unknown';
    
    if (has('express')) { 
      evidence.push(`Found express ${getVersion('express')} in package.json`); 
      return { framework: 'node-express', port: 3000, evidence, version: getVersion('express'), packageManager: 'npm' }; 
    }
    if (has('koa')) { 
      evidence.push(`Found koa ${getVersion('koa')} in package.json`); 
      return { framework: 'node-koa', port: 3000, evidence, version: getVersion('koa'), packageManager: 'npm' }; 
    }
    if (has('fastify')) { 
      evidence.push(`Found fastify ${getVersion('fastify')} in package.json`); 
      return { framework: 'node-fastify', port: 3000, evidence, version: getVersion('fastify'), packageManager: 'npm' }; 
    }
    if (has('@nestjs/core')) { 
      evidence.push(`Found NestJS ${getVersion('@nestjs/core')} in package.json`); 
      return { framework: 'node-nestjs', port: 3000, evidence, version: getVersion('@nestjs/core'), packageManager: 'npm' }; 
    }
  }

  // Python frameworks
  const reqLower = req.toLowerCase();
  if (reqLower.includes('flask')) { 
    const version = req.match(/flask[>=<]+([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found flask ${version} in requirements.txt`); 
    return { framework: 'python-flask', port: 5000, evidence, version, packageManager: 'pip' }; 
  }
  if (reqLower.includes('django')) { 
    const version = req.match(/django[>=<]+([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found django ${version} in requirements.txt`); 
    return { framework: 'python-django', port: 8000, evidence, version, packageManager: 'pip' }; 
  }
  if (reqLower.includes('fastapi')) { 
    const version = req.match(/fastapi[>=<]+([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found fastapi ${version} in requirements.txt`); 
    return { framework: 'python-fastapi', port: 8000, evidence, version, packageManager: 'pip' }; 
  }
  if (reqLower.includes('bottle')) { 
    const version = req.match(/bottle[>=<]+([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found bottle ${version} in requirements.txt`); 
    return { framework: 'python-bottle', port: 8080, evidence, version, packageManager: 'pip' }; 
  }

  // Java frameworks
  if (pom.includes('<groupId>org.springframework.boot</groupId>')) { 
    const version = pom.match(/<version>([^<]+)<\/version>/)?.[1] || 'unknown';
    evidence.push(`Found Spring Boot ${version} in pom.xml`); 
    return { framework: 'java-spring-boot', port: 8080, evidence, version, packageManager: 'maven' }; 
  }
  if (pom.includes('<groupId>io.quarkus</groupId>')) { 
    const version = pom.match(/<version>([^<]+)<\/version>/)?.[1] || 'unknown';
    evidence.push(`Found Quarkus ${version} in pom.xml`); 
    return { framework: 'java-quarkus', port: 8080, evidence, version, packageManager: 'maven' }; 
  }

  // Go frameworks
  if (goMod.includes('gin-gonic/gin')) { 
    const version = goMod.match(/gin-gonic\/gin\s+v([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found gin-gonic/gin ${version} in go.mod`); 
    return { framework: 'go-gin', port: 8080, evidence, version, packageManager: 'go' }; 
  }
  if (goMod.includes('gofiber/fiber')) { 
    const version = goMod.match(/gofiber\/fiber\s+v([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found gofiber/fiber ${version} in go.mod`); 
    return { framework: 'go-fiber', port: 8080, evidence, version, packageManager: 'go' }; 
  }
  if (goMod.includes('labstack/echo')) { 
    const version = goMod.match(/labstack\/echo\s+v([\d.]+)/)?.[1] || 'unknown';
    evidence.push(`Found labstack/echo ${version} in go.mod`); 
    return { framework: 'go-echo', port: 8080, evidence, version, packageManager: 'go' }; 
  }

  // PHP frameworks
  if (composer) {
    const reqs = { ...(composer.require || {}) } as Record<string, string>;
    if (reqs['laravel/framework']) { 
      evidence.push(`Found laravel/framework ${reqs['laravel/framework']} in composer.json`); 
      return { framework: 'php-laravel', port: 8000, evidence, version: reqs['laravel/framework'], packageManager: 'composer' }; 
    }
    if (reqs['symfony/symfony']) { 
      evidence.push(`Found symfony/symfony ${reqs['symfony/symfony']} in composer.json`); 
      return { framework: 'php-symfony', port: 8000, evidence, version: reqs['symfony/symfony'], packageManager: 'composer' }; 
    }
    if (reqs['slim/slim']) { 
      evidence.push(`Found slim/slim ${reqs['slim/slim']} in composer.json`); 
      return { framework: 'php-slim', port: 8000, evidence, version: reqs['slim/slim'], packageManager: 'composer' }; 
    }
  }

  // .NET frameworks
  if (csproj.includes('<Project Sdk="Microsoft.NET.Sdk.Web">')) { 
    const version = csproj.match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] || 'unknown';
    evidence.push(`Found Microsoft.NET.Sdk.Web ${version} in csproj`); 
    return { framework: '.net-core', port: 8080, evidence, version, packageManager: 'dotnet' }; 
  }
  if (csproj.includes('<Project Sdk="Microsoft.NET.Sdk">')) { 
    const version = csproj.match(/<TargetFramework>([^<]+)<\/TargetFramework>/)?.[1] || 'unknown';
    evidence.push(`Found Microsoft.NET.Sdk ${version} in csproj`); 
    return { framework: '.net-framework', port: 8080, evidence, version, packageManager: 'dotnet' }; 
  }

  // Rust frameworks
  if (cargo.includes('actix-web')) { 
    const version = cargo.match(/actix-web\s*=\s*"([^"]+)"/)?.[1] || 'unknown';
    evidence.push(`Found actix-web ${version} in Cargo.toml`); 
    return { framework: 'rust-actix', port: 8080, evidence, version, packageManager: 'cargo' }; 
  }
  if (cargo.includes('warp')) { 
    const version = cargo.match(/warp\s*=\s*"([^"]+)"/)?.[1] || 'unknown';
    evidence.push(`Found warp ${version} in Cargo.toml`); 
    return { framework: 'rust-warp', port: 8080, evidence, version, packageManager: 'cargo' }; 
  }
  if (cargo.includes('rocket')) { 
    const version = cargo.match(/rocket\s*=\s*"([^"]+)"/)?.[1] || 'unknown';
    evidence.push(`Found rocket ${version} in Cargo.toml`); 
    return { framework: 'rust-rocket', port: 8080, evidence, version, packageManager: 'cargo' }; 
  }

  // Ruby frameworks
  if (gemfile.includes('rails')) { 
    const version = gemfile.match(/gem\s+['"]rails['"]\s*,\s*['"]([^'"]+)['"]/)?.[1] || 'unknown';
    evidence.push(`Found rails ${version} in Gemfile`); 
    return { framework: 'ruby-rails', port: 3000, evidence, version, packageManager: 'bundle' }; 
  }
  if (gemfile.includes('sinatra')) { 
    const version = gemfile.match(/gem\s+['"]sinatra['"]\s*,\s*['"]([^'"]+)['"]/)?.[1] || 'unknown';
    evidence.push(`Found sinatra ${version} in Gemfile`); 
    return { framework: 'ruby-sinatra', port: 4567, evidence, version, packageManager: 'bundle' }; 
  }

  // Elixir frameworks
  if (mixExs.includes('phoenix')) { 
    const version = mixExs.match(/phoenix\s*,\s*"([^"]+)"/)?.[1] || 'unknown';
    evidence.push(`Found phoenix ${version} in mix.exs`); 
    return { framework: 'elixir-phoenix', port: 4000, evidence, version, packageManager: 'mix' }; 
  }

  return { framework: 'unknown', port: null, evidence };
}

function detectDatabaseFromEnvOrCode(fileMap: Record<string, string | null>): { 
  type: StackDetection['database']['type']; 
  evidence: string[]; 
  version?: string; 
} {
  const evidence: string[] = [];
  const env = fileMap['.env'] || '';
  const allContent = Object.values(fileMap).filter(Boolean).join('\n').toLowerCase();

  // MySQL detection
  if (/db_connection\s*=\s*mysql/i.test(env) || allContent.includes('mysql://') || allContent.includes('mysql2://')) { 
    const version = env.match(/mysql_version\s*=\s*([^\s]+)/)?.[1] || '8.0';
    evidence.push(`Detected MySQL ${version} in env or code`); 
    return { type: 'mysql', evidence, version }; 
  }

  // PostgreSQL detection
  if (/db_connection\s*=\s*pgsql/i.test(env) || allContent.includes('postgres://') || allContent.includes('postgresql://')) { 
    const version = env.match(/postgres_version\s*=\s*([^\s]+)/)?.[1] || '15';
    evidence.push(`Detected PostgreSQL ${version}`); 
    return { type: 'postgres', evidence, version }; 
  }

  // MongoDB detection
  if (allContent.includes('mongodb://') || allContent.includes('mongoose') || allContent.includes('pymongo')) { 
    const version = env.match(/mongo_version\s*=\s*([^\s]+)/)?.[1] || '7.0';
    evidence.push(`Detected MongoDB ${version}`); 
    return { type: 'mongodb', evidence, version }; 
  }

  // Redis detection
  if (allContent.includes('redis://') || allContent.includes('redis') || allContent.includes('ioredis')) { 
    const version = env.match(/redis_version\s*=\s*([^\s]+)/)?.[1] || '7.0';
    evidence.push(`Detected Redis ${version}`); 
    return { type: 'redis', evidence, version }; 
  }

  // SQL Server detection
  if (allContent.includes('mssql://') || allContent.includes('sql server') || allContent.includes('microsoft.sqlserver')) { 
    const version = env.match(/mssql_version\s*=\s*([^\s]+)/)?.[1] || '2022';
    evidence.push(`Detected MSSQL ${version}`); 
    return { type: 'mssql', evidence, version }; 
  }

  // SQLite detection
  if (allContent.includes('sqlite://') || allContent.includes('sqlite3') || allContent.includes('better-sqlite3')) { 
    evidence.push('Detected SQLite'); 
    return { type: 'sqlite', evidence, version: '3.40' }; 
  }

  // MariaDB detection
  if (allContent.includes('mariadb://') || allContent.includes('mariadb')) { 
    const version = env.match(/mariadb_version\s*=\s*([^\s]+)/)?.[1] || '10.11';
    evidence.push(`Detected MariaDB ${version}`); 
    return { type: 'mariadb', evidence, version }; 
  }

  return { type: null, evidence };
}

export async function detectStack(projectRoot: string): Promise<StackDetection> {
  const targets = ['package.json', 'requirements.txt', 'pom.xml', 'go.mod', 'composer.json', '.env', 'Gemfile', 'mix.exs'];
  const csprojFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(projectRoot, '**/*.csproj'), '**/node_modules/**', 5);
  const cargoToml = await vscode.workspace.findFiles(new vscode.RelativePattern(projectRoot, 'Cargo.toml'), '**/target/**', 1);

  const fileMap: Record<string, string | null> = {};
  for (const t of targets) {
    fileMap[t] = await readTextIfExists(path.join(projectRoot, t));
  }
  if (csprojFiles.length > 0) {
    const fp = csprojFiles[0].fsPath;
    fileMap['csproj'] = await readTextIfExists(fp);
  }
  if (cargoToml.length > 0) {
    const fp = cargoToml[0].fsPath;
    fileMap['Cargo.toml'] = await readTextIfExists(fp);
  }

  // Check for existing Docker files
  const hasDockerfile = await fileExists(path.join(projectRoot, 'Dockerfile')) || 
                       await fileExists(path.join(projectRoot, 'Dockerfile.frontend')) ||
                       await fileExists(path.join(projectRoot, 'Dockerfile.backend'));
  const hasDockerCompose = await fileExists(path.join(projectRoot, 'docker-compose.yml')) ||
                          await fileExists(path.join(projectRoot, 'docker-compose.yaml'));
  const hasNginxConfig = await fileExists(path.join(projectRoot, 'nginx.conf')) ||
                        await fileExists(path.join(projectRoot, 'nginx/nginx.conf'));

  // Frontend
  const pkgJsonContent = fileMap['package.json'];
  const frontend = pkgJsonContent ? detectFrontendFromPackageJson(JSON.parse(pkgJsonContent)) : { framework: 'unknown' as FrontendFramework, port: null, evidence: [] as string[] };

  // Backend
  const backend = detectBackendFromFiles(fileMap);

  // Database
  const db = detectDatabaseFromEnvOrCode(fileMap);

  return {
    frontend,
    backend,
    database: { type: db.type, evidence: db.evidence, version: db.version },
    projectRoot,
    hasDockerfile,
    hasDockerCompose,
    hasNginxConfig,
  };
}


