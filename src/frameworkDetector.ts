import * as fs from 'fs';
import * as path from 'path';
import { readFileSync } from 'fs';

/**
 * Advanced Framework Detection Module
 * Detects all supported frameworks, versions, and configurations
 */

// ==================== INTERFACES ====================

export interface FrameworkInfo {
  name: string;
  version?: string;
  variant?: string;
  buildCommand: string;
  startCommand: string;
  port: number;
  outputPath: string;
  envVariables?: string[];
  scripts?: { [key: string]: string };
  dependencies?: string[];
}

export interface FrameworkDetectionResult {
  frontend?: FrameworkInfo[];
  backend?: FrameworkInfo[];
  databases?: DatabaseInfo[];
  messageQueues?: MessageQueueInfo[];
  cacheLayer?: CacheInfo[];
  reverseProxy?: ReverseProxyInfo;
  searchEngine?: SearchEngineInfo;
  buildTool?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'maven' | 'gradle' | 'pip' | 'poetry' | 'pipenv' | 'composer';
}

export interface DatabaseInfo {
  type: string;
  version?: string;
  port: number;
  environment: string[];
  healthCheck: string;
  initScript?: string;
}

export interface MessageQueueInfo {
  type: string;
  port: number;
  managementPort?: number;
  version?: string;
  environment?: string[];
}

export interface CacheInfo {
  type: 'redis' | 'memcached';
  port: number;
  version?: string;
}

export interface ReverseProxyInfo {
  type: 'nginx' | 'traefik' | 'caddy' | 'haproxy' | 'apache';
  configFile?: string;
  port: number;
}

export interface SearchEngineInfo {
  type: 'elasticsearch' | 'opensearch' | 'meilisearch' | 'typesense';
  version?: string;
  port: number;
}

// ==================== REACT DETECTION ====================

export class ReactDetector {
  static detect(packageJson: any, basePath: string): FrameworkInfo | null {
    if (!packageJson.dependencies?.react && !packageJson.devDependencies?.react) {
      return null;
    }

    const variant = this.detectVariant(packageJson, basePath);
    const buildCommand = this.detectBuildCommand(packageJson, variant);
    const startCommand = this.detectStartCommand(packageJson, variant);
    const port = this.detectPort(basePath, variant);
    const outputPath = this.detectOutputPath(basePath, variant);

    return {
      name: 'React',
      variant,
      version: packageJson.dependencies?.react || packageJson.devDependencies?.react,
      buildCommand,
      startCommand,
      port,
      outputPath,
      scripts: packageJson.scripts || {}
    };
  }

  private static detectVariant(packageJson: any, basePath: string): string {
    // Next.js
    if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
      return 'Next.js';
    }

    // Vite
    if (packageJson.devDependencies?.vite) {
      return 'Vite';
    }

    // Create React App (check react-scripts)
    if (packageJson.dependencies?.['react-scripts'] || packageJson.devDependencies?.['react-scripts']) {
      return 'Create React App';
    }

    // Remix
    if (packageJson.dependencies?.['@remix-run/react']) {
      return 'Remix';
    }

    // Gatsby
    if (packageJson.dependencies?.gatsby || packageJson.devDependencies?.gatsby) {
      return 'Gatsby';
    }

    // Check for custom webpack/esbuild setup
    if (fs.existsSync(path.join(basePath, 'webpack.config.js'))) {
      return 'Webpack';
    }

    if (fs.existsSync(path.join(basePath, 'esbuild.js'))) {
      return 'esbuild';
    }

    return 'Standard React';
  }

  private static detectBuildCommand(packageJson: any, variant: string): string {
    const scripts = packageJson.scripts || {};

    // Check for build:docker or build:prod first
    if (scripts['build:docker']) return 'npm run build:docker';
    if (scripts['build:prod']) return 'npm run build:prod';

    // Variant-specific defaults
    switch (variant) {
      case 'Next.js':
        return 'npm run build';
      case 'Vite':
        return 'npm run build';
      case 'Create React App':
        return 'npm run build';
      case 'Remix':
        return 'npm run build';
      case 'Gatsby':
        return 'npm run build';
      default:
        return 'npm run build';
    }
  }

  private static detectStartCommand(packageJson: any, variant: string): string {
    switch (variant) {
      case 'Next.js':
        return 'npm run start';
      case 'Vite':
        return 'npm run preview';
      case 'Create React App':
        return 'npm start';
      case 'Remix':
        return 'npm run start';
      case 'Gatsby':
        return 'gatsby serve';
      default:
        return 'npm start';
    }
  }

  private static detectPort(basePath: string, variant: string): number {
    // Check vite.config.js
    try {
      const vitePath = path.join(basePath, 'vite.config.js');
      if (fs.existsSync(vitePath)) {
        const content = fs.readFileSync(vitePath, 'utf-8');
        const portMatch = content.match(/port:\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1]);
      }
    } catch (e) {}

    // Check next.config.js
    try {
      const nextPath = path.join(basePath, 'next.config.js');
      if (fs.existsSync(nextPath)) {
        return 3000; // Next.js default
      }
    } catch (e) {}

    // Default ports by variant
    switch (variant) {
      case 'Next.js':
        return 3000;
      case 'Vite':
        return 5173;
      case 'Create React App':
        return 3000;
      case 'Remix':
        return 3000;
      case 'Gatsby':
        return 8000;
      default:
        return 3000;
    }
  }

  private static detectOutputPath(basePath: string, variant: string): string {
    // Check vite.config.js
    try {
      const vitePath = path.join(basePath, 'vite.config.js');
      if (fs.existsSync(vitePath)) {
        const content = fs.readFileSync(vitePath, 'utf-8');
        const outDirMatch = content.match(/outDir:\s*['"](.*?)['"]/);
        if (outDirMatch) return outDirMatch[1];
      }
    } catch (e) {}

    // Default output paths
    switch (variant) {
      case 'Next.js':
        return '.next';
      case 'Vite':
        return 'dist';
      case 'Create React App':
        return 'build';
      case 'Remix':
        return 'public/build';
      case 'Gatsby':
        return 'public';
      default:
        return 'dist';
    }
  }
}

// ==================== VUE DETECTION ====================

export class VueDetector {
  static detect(packageJson: any, basePath: string): FrameworkInfo | null {
    if (!packageJson.dependencies?.vue && !packageJson.devDependencies?.vue) {
      return null;
    }

    const variant = this.detectVariant(packageJson, basePath);
    const vueVersion = packageJson.dependencies?.vue || packageJson.devDependencies?.vue;

    return {
      name: 'Vue.js',
      variant,
      version: vueVersion,
      buildCommand: this.detectBuildCommand(packageJson, variant),
      startCommand: this.detectStartCommand(variant),
      port: this.detectPort(basePath, variant),
      outputPath: this.detectOutputPath(variant),
      scripts: packageJson.scripts || {}
    };
  }

  private static detectVariant(packageJson: any, basePath: string): string {
    // Nuxt.js
    if (packageJson.dependencies?.nuxt || packageJson.devDependencies?.nuxt) {
      const nuxtVersion = packageJson.dependencies?.nuxt || packageJson.devDependencies?.nuxt;
      return nuxtVersion.startsWith('3') ? 'Nuxt 3' : 'Nuxt 2';
    }

    // Vite + Vue
    if (packageJson.devDependencies?.vite) {
      return 'Vue + Vite';
    }

    // Vue CLI
    if (fs.existsSync(path.join(basePath, 'vue.config.js'))) {
      return 'Vue CLI';
    }

    // Check Vue version
    const vueVersion = packageJson.dependencies?.vue || packageJson.devDependencies?.vue;
    if (vueVersion?.startsWith('3')) {
      return 'Vue 3';
    }

    return 'Vue 2';
  }

  private static detectBuildCommand(packageJson: any, variant: string): string {
    const scripts = packageJson.scripts || {};
    if (scripts['build:docker']) return 'npm run build:docker';
    if (scripts['build:prod']) return 'npm run build:prod';

    return 'npm run build';
  }

  private static detectStartCommand(variant: string): string {
    if (variant.includes('Nuxt')) {
      return 'npm run start';
    }
    return 'npm run serve';
  }

  private static detectPort(basePath: string, variant: string): number {
    // Nuxt default
    if (variant.includes('Nuxt')) return 3000;

    // Vite default
    if (variant.includes('Vite')) return 5173;

    // Vue CLI default
    return 8080;
  }

  private static detectOutputPath(variant: string): string {
    if (variant.includes('Nuxt')) return '.nuxt';
    return 'dist';
  }
}

// ==================== ANGULAR DETECTION ====================

export class AngularDetector {
  static detect(packageJson: any, basePath: string): FrameworkInfo | null {
    if (!packageJson.dependencies?.['@angular/core'] && !packageJson.devDependencies?.['@angular/core']) {
      return null;
    }

    const version = this.detectVersion(packageJson);
    const outputPath = this.detectOutputPath(basePath);

    return {
      name: 'Angular',
      version,
      buildCommand: 'ng build --configuration production',
      startCommand: 'ng serve',
      port: 4200,
      outputPath,
      scripts: packageJson.scripts || {}
    };
  }

  private static detectVersion(packageJson: any): string {
    const angularVersion = packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core'];
    if (angularVersion?.startsWith('^16') || angularVersion?.startsWith('^17')) {
      return 'Angular 16+';
    }
    return angularVersion || 'Angular';
  }

  private static detectOutputPath(basePath: string): string {
    try {
      const angularJsonPath = path.join(basePath, 'angular.json');
      if (fs.existsSync(angularJsonPath)) {
        const content = JSON.parse(fs.readFileSync(angularJsonPath, 'utf-8'));
        const defaultProject = content.defaultProject || Object.keys(content.projects)[0];
        return content.projects[defaultProject]?.architect?.build?.options?.outputPath || 'dist/app';
      }
    } catch (e) {}
    return 'dist/app';
  }
}

// ==================== PYTHON DETECTION ====================

export class PythonDetector {
  static detect(basePath: string): FrameworkInfo | null {
    const pythonFiles = this.findPythonFramework(basePath);
    if (!pythonFiles.framework) {
      return null;
    }

    return {
      name: pythonFiles.framework,
      version: pythonFiles.version,
      buildCommand: 'pip install -r requirements.txt',
      startCommand: this.detectStartCommand(pythonFiles.framework),
      port: this.detectPort(pythonFiles.framework),
      outputPath: '',
      scripts: {}
    };
  }

  private static findPythonFramework(basePath: string): { framework: string | null; version?: string } {
    // Check for requirements.txt or pyproject.toml
    const reqPath = path.join(basePath, 'requirements.txt');
    const pyProjectPath = path.join(basePath, 'pyproject.toml');
    const setupPath = path.join(basePath, 'setup.py');
    const pipfilePath = path.join(basePath, 'Pipfile');

    try {
      // Django detection
      if (fs.existsSync(reqPath)) {
        const content = fs.readFileSync(reqPath, 'utf-8');
        if (content.includes('django')) return { framework: 'Django' };
        if (content.includes('flask')) return { framework: 'Flask' };
        if (content.includes('fastapi')) return { framework: 'FastAPI' };
        if (content.includes('bottle')) return { framework: 'Bottle' };
        if (content.includes('pyramid')) return { framework: 'Pyramid' };
        if (content.includes('tornado')) return { framework: 'Tornado' };
      }

      // pyproject.toml check
      if (fs.existsSync(pyProjectPath)) {
        const content = fs.readFileSync(pyProjectPath, 'utf-8');
        if (content.includes('django')) return { framework: 'Django' };
        if (content.includes('flask')) return { framework: 'Flask' };
        if (content.includes('fastapi')) return { framework: 'FastAPI' };
      }

      // Pipfile check
      if (fs.existsSync(pipfilePath)) {
        const content = fs.readFileSync(pipfilePath, 'utf-8');
        if (content.includes('django')) return { framework: 'Django' };
        if (content.includes('flask')) return { framework: 'Flask' };
        if (content.includes('fastapi')) return { framework: 'FastAPI' };
      }

      // Check main.py or wsgi.py
      if (fs.existsSync(path.join(basePath, 'manage.py'))) {
        return { framework: 'Django' };
      }

      if (fs.existsSync(path.join(basePath, 'wsgi.py'))) {
        return { framework: 'Flask or similar' };
      }

      return { framework: 'Python (unspecified)' };
    } catch (e) {
      return { framework: null };
    }
  }

  private static detectStartCommand(framework: string): string {
    switch (framework) {
      case 'Django':
        return 'python manage.py runserver 0.0.0.0:8000';
      case 'Flask':
        return 'flask run --host 0.0.0.0';
      case 'FastAPI':
        return 'uvicorn main:app --host 0.0.0.0 --port 8000';
      case 'Bottle':
        return 'python app.py';
      case 'Pyramid':
        return 'pserve development.ini';
      case 'Tornado':
        return 'python app.py';
      default:
        return 'python app.py';
    }
  }

  private static detectPort(framework: string): number {
    return 8000; // Most Python frameworks default to 8000
  }
}

// ==================== JAVA DETECTION ====================

export class JavaDetector {
  static detect(basePath: string): FrameworkInfo | null {
    const framework = this.detectJavaFramework(basePath);
    if (!framework) {
      return null;
    }

    const buildTool = this.detectBuildTool(basePath);

    return {
      name: framework,
      buildCommand: this.detectBuildCommand(buildTool),
      startCommand: this.detectStartCommand(framework, buildTool),
      port: this.detectPort(framework),
      outputPath: this.detectOutputPath(buildTool),
      scripts: {}
    };
  }

  private static detectJavaFramework(basePath: string): string | null {
    const pomPath = path.join(basePath, 'pom.xml');
    const gradlePath = path.join(basePath, 'build.gradle') || path.join(basePath, 'build.gradle.kts');

    try {
      if (fs.existsSync(pomPath)) {
        const content = fs.readFileSync(pomPath, 'utf-8');
        if (content.includes('spring-boot')) return 'Spring Boot';
        if (content.includes('quarkus')) return 'Quarkus';
        if (content.includes('micronaut')) return 'Micronaut';
        if (content.includes('grails')) return 'Grails';
      }

      if (fs.existsSync(gradlePath)) {
        const content = fs.readFileSync(gradlePath, 'utf-8');
        if (content.includes('spring-boot')) return 'Spring Boot';
        if (content.includes('quarkus')) return 'Quarkus';
        if (content.includes('micronaut')) return 'Micronaut';
      }
    } catch (e) {}

    return null;
  }

  private static detectBuildTool(basePath: string): 'maven' | 'gradle' {
    if (fs.existsSync(path.join(basePath, 'pom.xml'))) {
      return 'maven';
    }
    return 'gradle';
  }

  private static detectBuildCommand(buildTool: 'maven' | 'gradle'): string {
    return buildTool === 'maven' ? 'mvn clean package -DskipTests' : 'gradle build -x test';
  }

  private static detectStartCommand(framework: string, buildTool: 'maven' | 'gradle'): string {
    if (buildTool === 'maven') {
      return 'java -jar target/*.jar';
    }
    return 'java -jar build/libs/*.jar';
  }

  private static detectPort(framework: string): number {
    return 8080; // Standard for Java applications
  }

  private static detectOutputPath(buildTool: 'maven' | 'gradle'): string {
    return buildTool === 'maven' ? 'target' : 'build/libs';
  }
}

// ==================== GO DETECTION ====================

export class GoDetector {
  static detect(basePath: string): FrameworkInfo | null {
    if (!fs.existsSync(path.join(basePath, 'go.mod'))) {
      return null;
    }

    const framework = this.detectGoFramework(basePath);

    return {
      name: 'Go',
      variant: framework,
      buildCommand: 'go build -o app .',
      startCommand: './app',
      port: this.detectPort(framework),
      outputPath: '.',
      scripts: {}
    };
  }

  private static detectGoFramework(basePath: string): string {
    try {
      const mainPath = path.join(basePath, 'main.go');
      if (fs.existsSync(mainPath)) {
        const content = fs.readFileSync(mainPath, 'utf-8');
        if (content.includes('github.com/gin-gonic/gin')) return 'Gin';
        if (content.includes('github.com/gofiber/fiber')) return 'Fiber';
        if (content.includes('github.com/labstack/echo')) return 'Echo';
        if (content.includes('github.com/gorilla/mux')) return 'Gorilla Mux';
        if (content.includes('github.com/valyala/fasthttp')) return 'FastHTTP';
      }
    } catch (e) {}

    return 'Standard Go';
  }

  private static detectPort(framework: string): number {
    // Most Go frameworks use 8080 or 3000
    return 8080;
  }
}

// ==================== PHP DETECTION ====================

export class PHPDetector {
  static detect(basePath: string): FrameworkInfo | null {
    const framework = this.detectPHPFramework(basePath);
    if (!framework) {
      return null;
    }

    return {
      name: framework,
      buildCommand: 'composer install',
      startCommand: this.detectStartCommand(framework),
      port: this.detectPort(framework),
      outputPath: '',
      scripts: {}
    };
  }

  private static detectPHPFramework(basePath: string): string | null {
    try {
      const composerPath = path.join(basePath, 'composer.json');
      if (fs.existsSync(composerPath)) {
        const content = fs.readFileSync(composerPath, 'utf-8');
        if (content.includes('laravel/framework')) return 'Laravel';
        if (content.includes('symfony/framework-bundle')) return 'Symfony';
        if (content.includes('zendframework') || content.includes('laminas')) return 'Laminas';
        if (content.includes('cakephp/cakephp')) return 'CakePHP';
        if (content.includes('wordpress')) return 'WordPress';
        if (content.includes('drupal')) return 'Drupal';
      }

      // Check for config files
      if (fs.existsSync(path.join(basePath, 'config/app.php'))) return 'Laravel';
      if (fs.existsSync(path.join(basePath, 'config/services.yaml'))) return 'Symfony';
      if (fs.existsSync(path.join(basePath, 'config/bootstrap.php'))) return 'CakePHP';

      return 'PHP (unspecified)';
    } catch (e) {
      return null;
    }
  }

  private static detectStartCommand(framework: string): string {
    switch (framework) {
      case 'Laravel':
        return 'php artisan serve --host=0.0.0.0 --port=8000';
      case 'Symfony':
        return 'php -S 0.0.0.0:8000 -t public';
      case 'CakePHP':
        return 'bin/cake server --host 0.0.0.0 --port 8000';
      default:
        return 'php -S 0.0.0.0:8000';
    }
  }

  private static detectPort(framework: string): number {
    return 8000;
  }
}

// ==================== .NET DETECTION ====================

export class DotNetDetector {
  static detect(basePath: string): FrameworkInfo | null {
    const projectFile = this.findProjectFile(basePath);
    if (!projectFile) {
      return null;
    }

    try {
      const content = fs.readFileSync(projectFile, 'utf-8');
      const framework = this.detectFramework(content);
      const version = this.detectVersion(content);

      return {
        name: '.NET',
        variant: framework,
        version,
        buildCommand: 'dotnet build -c Release',
        startCommand: 'dotnet run',
        port: 80,
        outputPath: 'bin/Release',
        scripts: {}
      };
    } catch (e) {
      return null;
    }
  }

  private static findProjectFile(basePath: string): string | null {
    const files = fs.readdirSync(basePath).filter(f => f.endsWith('.csproj'));
    return files.length > 0 ? path.join(basePath, files[0]) : null;
  }

  private static detectFramework(content: string): string {
    if (content.includes('AspNetCore')) return 'ASP.NET Core';
    if (content.includes('WindowsDesktop')) return 'WPF/WinForms';
    if (content.includes('Web')) return 'ASP.NET Core';
    return '.NET';
  }

  private static detectVersion(content: string): string {
    const versionMatch = content.match(/<TargetFramework>(.*?)<\/TargetFramework>/);
    return versionMatch ? versionMatch[1] : 'Unknown';
  }
}

// ==================== DATABASE DETECTION ====================

export class DatabaseDetector {
  static detect(packageJson: any, basePath: string): DatabaseInfo[] {
    const databases: DatabaseInfo[] = [];

    // PostgreSQL
    if (packageJson.dependencies?.pg || packageJson.dependencies?.['knex'] || 
        packageJson.dependencies?.['sequelize'] || packageJson.dependencies?.['typeorm']) {
      databases.push(this.getPostgresInfo());
    }

    // MySQL
    if (packageJson.dependencies?.mysql || packageJson.dependencies?.['mysql2']) {
      databases.push(this.getMysqlInfo());
    }

    // MongoDB
    if (packageJson.dependencies?.mongodb || packageJson.dependencies?.['mongoose']) {
      databases.push(this.getMongoInfo());
    }

    // Redis
    if (packageJson.dependencies?.redis || packageJson.dependencies?.['ioredis']) {
      databases.push(this.getRedisInfo());
    }

    // Check .env for database hints
    try {
      const envPath = path.join(basePath, '.env') || path.join(basePath, '.env.example');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('POSTGRES') && !databases.some(d => d.type === 'PostgreSQL')) {
          databases.push(this.getPostgresInfo());
        }
        if (envContent.includes('MYSQL') && !databases.some(d => d.type === 'MySQL')) {
          databases.push(this.getMysqlInfo());
        }
        if (envContent.includes('MONGODB') && !databases.some(d => d.type === 'MongoDB')) {
          databases.push(this.getMongoInfo());
        }
      }
    } catch (e) {}

    return databases;
  }

  private static getPostgresInfo(): DatabaseInfo {
    return {
      type: 'PostgreSQL',
      version: '15',
      port: 5432,
      environment: [
        'POSTGRES_USER=postgres',
        'POSTGRES_PASSWORD=postgres',
        'POSTGRES_DB=app_db'
      ],
      healthCheck: 'pg_isready -U postgres',
      initScript: 'initdb.d/01-schema.sql'
    };
  }

  private static getMysqlInfo(): DatabaseInfo {
    return {
      type: 'MySQL',
      version: '8.0',
      port: 3306,
      environment: [
        'MYSQL_ROOT_PASSWORD=root',
        'MYSQL_DATABASE=app_db',
        'MYSQL_USER=app',
        'MYSQL_PASSWORD=app'
      ],
      healthCheck: 'mysqladmin ping -u root -proot',
      initScript: 'initdb.d/01-schema.sql'
    };
  }

  private static getMongoInfo(): DatabaseInfo {
    return {
      type: 'MongoDB',
      version: '6.0',
      port: 27017,
      environment: [
        'MONGO_INITDB_ROOT_USERNAME=root',
        'MONGO_INITDB_ROOT_PASSWORD=root',
        'MONGO_INITDB_DATABASE=app_db'
      ],
      healthCheck: 'mongo --eval "db.adminCommand(\'ping\')"',
      initScript: 'initdb.d/01-init.js'
    };
  }

  private static getRedisInfo(): DatabaseInfo {
    return {
      type: 'Redis',
      version: '7.0',
      port: 6379,
      environment: [],
      healthCheck: 'redis-cli ping',
      initScript: undefined
    };
  }
}

// ==================== MESSAGE QUEUE DETECTION ====================

export class MessageQueueDetector {
  static detect(packageJson: any): MessageQueueInfo[] {
    const queues: MessageQueueInfo[] = [];

    if (packageJson.dependencies?.amqplib) {
      queues.push({
        type: 'RabbitMQ',
        port: 5672,
        managementPort: 15672,
        version: '3.12',
        environment: [
          'RABBITMQ_DEFAULT_USER=guest',
          'RABBITMQ_DEFAULT_PASS=guest'
        ]
      });
    }

    if (packageJson.dependencies?.kafkajs) {
      queues.push({
        type: 'Kafka',
        port: 9092,
        version: '7.0',
        environment: []
      });
    }

    if (packageJson.dependencies?.bull || packageJson.dependencies?.['bullmq']) {
      queues.push({
        type: 'Redis (Bull)',
        port: 6379,
        version: '7.0',
        environment: []
      });
    }

    if (packageJson.dependencies?.['aws-sdk'] && packageJson.dependencies?.['sqs-consumer']) {
      queues.push({
        type: 'AWS SQS',
        port: 0,
        environment: [
          'AWS_ACCESS_KEY_ID=',
          'AWS_SECRET_ACCESS_KEY='
        ]
      });
    }

    return queues;
  }
}

// ==================== CACHE DETECTION ====================

export class CacheDetector {
  static detect(packageJson: any): CacheInfo[] {
    const cache: CacheInfo[] = [];

    if (packageJson.dependencies?.redis || packageJson.dependencies?.['ioredis']) {
      cache.push({
        type: 'redis',
        port: 6379,
        version: '7.0'
      });
    }

    if (packageJson.dependencies?.memcached) {
      cache.push({
        type: 'memcached',
        port: 11211,
        version: '1.6'
      });
    }

    return cache;
  }
}

// ==================== REVERSE PROXY DETECTION ====================

export class ReverseProxyDetector {
  static detect(basePath: string): ReverseProxyInfo {
    // Check for Traefik
    if (fs.existsSync(path.join(basePath, 'traefik.yml')) || 
        fs.existsSync(path.join(basePath, 'traefik.toml'))) {
      return {
        type: 'traefik',
        port: 80,
        configFile: 'traefik.yml'
      };
    }

    // Check for Caddy
    if (fs.existsSync(path.join(basePath, 'Caddyfile'))) {
      return {
        type: 'caddy',
        port: 80,
        configFile: 'Caddyfile'
      };
    }

    // Check for HAProxy
    if (fs.existsSync(path.join(basePath, 'haproxy.cfg'))) {
      return {
        type: 'haproxy',
        port: 80,
        configFile: 'haproxy.cfg'
      };
    }

    // Check for Apache
    if (fs.existsSync(path.join(basePath, 'apache2.conf')) || 
        fs.existsSync(path.join(basePath, '.htaccess'))) {
      return {
        type: 'apache',
        port: 80,
        configFile: 'apache2.conf'
      };
    }

    // Default to Nginx
    return {
      type: 'nginx',
      port: 80
    };
  }
}

// ==================== SEARCH ENGINE DETECTION ====================

export class SearchEngineDetector {
  static detect(packageJson: any): SearchEngineInfo | null {
    if (packageJson.dependencies?.['@elastic/elasticsearch']) {
      return {
        type: 'elasticsearch',
        version: '8.0',
        port: 9200
      };
    }

    if (packageJson.dependencies?.opensearchpy) {
      return {
        type: 'opensearch',
        version: '2.0',
        port: 9200
      };
    }

    if (packageJson.dependencies?.meilisearch) {
      return {
        type: 'meilisearch',
        version: '1.0',
        port: 7700
      };
    }

    if (packageJson.dependencies?.typesense) {
      return {
        type: 'typesense',
        version: '0.24',
        port: 8108
      };
    }

    return null;
  }
}

// ==================== MAIN DETECTOR CLASS ====================

export class FullStackDetector {
  static async detectAll(projectPath: string): Promise<FrameworkDetectionResult> {
    const result: FrameworkDetectionResult = {
      frontend: [],
      backend: [],
      databases: [],
      messageQueues: [],
      cacheLayer: []
    };

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath) 
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      // Frontend detection
      const react = ReactDetector.detect(packageJson, projectPath);
      if (react) result.frontend?.push(react);

      const vue = VueDetector.detect(packageJson, projectPath);
      if (vue) result.frontend?.push(vue);

      const angular = AngularDetector.detect(packageJson, projectPath);
      if (angular) result.frontend?.push(angular);

      // Backend detection
      const pythonApp = PythonDetector.detect(projectPath);
      if (pythonApp) result.backend?.push(pythonApp);

      const javaApp = JavaDetector.detect(projectPath);
      if (javaApp) result.backend?.push(javaApp);

      const goApp = GoDetector.detect(projectPath);
      if (goApp) result.backend?.push(goApp);

      const phpApp = PHPDetector.detect(projectPath);
      if (phpApp) result.backend?.push(phpApp);

      const dotNetApp = DotNetDetector.detect(projectPath);
      if (dotNetApp) result.backend?.push(dotNetApp);

      // Database, Queue, and Cache detection
      result.databases = DatabaseDetector.detect(packageJson, projectPath);
      result.messageQueues = MessageQueueDetector.detect(packageJson);
      result.cacheLayer = CacheDetector.detect(packageJson);

      // Reverse Proxy detection
      result.reverseProxy = ReverseProxyDetector.detect(projectPath);

      // Search Engine detection
      result.searchEngine = SearchEngineDetector.detect(packageJson) || undefined;

      return result;
    } catch (error) {
      console.error('Error detecting frameworks:', error);
      return result;
    }
  }
}

export default FullStackDetector;
