import * as fs from 'fs';
import * as path from 'path';

/**
 * Build Configuration & Port Detection Module
 * Extracts build commands, ports, output paths, and env variables
 */

// ==================== INTERFACES ====================

export interface BuildConfig {
  buildCommand: string;
  startCommand: string;
  port: number;
  outputPath: string;
  envVariables: EnvironmentVariable[];
  buildArgs?: BuildArg[];
  scripts?: { [key: string]: string };
}

export interface EnvironmentVariable {
  name: string;
  value?: string;
  required: boolean;
  description?: string;
  source?: 'env' | 'config' | 'code' | 'source';
}

export interface BuildArg {
  name: string;
  defaultValue?: string;
  description?: string;
}

// ==================== PORT DETECTION ====================

export class PortDetector {
  /**
   * Detect ports from various configuration files
   */
  static detectPort(projectPath: string, framework: string): number {
    // Try vite.config.js
    const vitePort = this.detectVitePort(projectPath);
    if (vitePort) return vitePort;

    // Try next.config.js
    const nextPort = this.detectNextPort(projectPath);
    if (nextPort) return nextPort;

    // Try nuxt.config.ts
    const nuxtPort = this.detectNuxtPort(projectPath);
    if (nuxtPort) return nuxtPort;

    // Try webpack.config.js
    const webpackPort = this.detectWebpackPort(projectPath);
    if (webpackPort) return webpackPort;

    // Try .env or .env.example
    const envPort = this.detectEnvPort(projectPath);
    if (envPort) return envPort;

    // Try to find port in source code
    const sourcePort = this.detectPortFromSource(projectPath);
    if (sourcePort) return sourcePort;

    // Framework defaults
    return this.getFrameworkDefaultPort(framework);
  }

  private static detectVitePort(projectPath: string): number | null {
    try {
      const viteConfigPath = path.join(projectPath, 'vite.config.js') ||
                            path.join(projectPath, 'vite.config.ts');
      if (fs.existsSync(viteConfigPath)) {
        const content = fs.readFileSync(viteConfigPath, 'utf-8');
        const portMatch = content.match(/port:\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1]);
      }
    } catch (e) {}
    return null;
  }

  private static detectNextPort(projectPath: string): number | null {
    try {
      const nextConfigPath = path.join(projectPath, 'next.config.js') ||
                            path.join(projectPath, 'next.config.mjs');
      if (fs.existsSync(nextConfigPath)) {
        const content = fs.readFileSync(nextConfigPath, 'utf-8');
        const portMatch = content.match(/port:\s*(\d+)|:\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1] || portMatch[2]);
      }
    } catch (e) {}
    return null;
  }

  private static detectNuxtPort(projectPath: string): number | null {
    try {
      const nuxtConfigPath = path.join(projectPath, 'nuxt.config.ts') ||
                            path.join(projectPath, 'nuxt.config.js');
      if (fs.existsSync(nuxtConfigPath)) {
        const content = fs.readFileSync(nuxtConfigPath, 'utf-8');
        const portMatch = content.match(/port:\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1]);
      }
    } catch (e) {}
    return null;
  }

  private static detectWebpackPort(projectPath: string): number | null {
    try {
      const webpackConfigPath = path.join(projectPath, 'webpack.config.js');
      if (fs.existsSync(webpackConfigPath)) {
        const content = fs.readFileSync(webpackConfigPath, 'utf-8');
        const portMatch = content.match(/port:\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1]);
      }
    } catch (e) {}
    return null;
  }

  private static detectEnvPort(projectPath: string): number | null {
    try {
      const envPath = path.join(projectPath, '.env') ||
                     path.join(projectPath, '.env.example');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const portMatch = content.match(/PORT\s*=\s*(\d+)|SERVER_PORT\s*=\s*(\d+)|APP_PORT\s*=\s*(\d+)/);
        if (portMatch) return parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
      }
    } catch (e) {}
    return null;
  }

  private static detectPortFromSource(projectPath: string): number | null {
    try {
      // Check common entry points
      const possibleFiles = ['main.ts', 'index.ts', 'app.ts', 'server.ts', 'main.js', 'index.js', 'app.js', 'server.js'];
      
      for (const file of possibleFiles) {
        const filePath = path.join(projectPath, 'src', file) || path.join(projectPath, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const portMatches = [
            content.match(/\.listen\((\d+)/),
            content.match(/port\s*[:=]\s*(\d+)/),
            content.match(/PORT\s*[:=]\s*(\d+)/)
          ];
          
          for (const match of portMatches) {
            if (match && match[1]) return parseInt(match[1]);
          }
        }
      }
    } catch (e) {}
    return null;
  }

  private static getFrameworkDefaultPort(framework: string): number {
    const ports: { [key: string]: number } = {
      'React': 3000,
      'Vue': 8080,
      'Angular': 4200,
      'Next.js': 3000,
      'Nuxt': 3000,
      'Gatsby': 8000,
      'Vite': 5173,
      'Express': 3000,
      'Django': 8000,
      'Flask': 5000,
      'FastAPI': 8000,
      'Spring Boot': 8080,
      'Quarkus': 8080,
      'Laravel': 8000,
      'Rails': 3000,
      'Go': 8080,
      'Rust': 8080
    };
    
    return ports[framework] || 3000;
  }
}

// ==================== BUILD COMMAND DETECTION ====================

export class BuildCommandDetector {
  static detectBuildCommand(projectPath: string, framework: string, packageJson: any): string {
    const scripts = packageJson.scripts || {};

    // Priority: build:docker > build:prod > build
    if (scripts['build:docker']) return 'npm run build:docker';
    if (scripts['build:prod']) return 'npm run build:prod';
    if (scripts['build:staging']) return 'npm run build:staging';
    if (scripts['build']) return 'npm run build';

    // Framework defaults
    return this.getFrameworkBuildCommand(framework);
  }

  static detectStartCommand(projectPath: string, framework: string, packageJson: any): string {
    const scripts = packageJson.scripts || {};

    // Priority: start > dev > serve
    if (scripts['start']) return 'npm start';
    if (scripts['dev']) return 'npm run dev';
    if (scripts['serve']) return 'npm run serve';

    // Framework defaults
    return this.getFrameworkStartCommand(framework);
  }

  private static getFrameworkBuildCommand(framework: string): string {
    const commands: { [key: string]: string } = {
      'React': 'npm run build',
      'Vue': 'npm run build',
      'Angular': 'ng build --configuration production',
      'Next.js': 'npm run build',
      'Nuxt': 'npm run build',
      'Vite': 'npm run build',
      'Django': 'python manage.py collectstatic --noinput',
      'Flask': 'echo "No build needed for Flask"',
      'FastAPI': 'echo "No build needed for FastAPI"',
      'Java': 'mvn clean package -DskipTests',
      'Go': 'go build -o app .',
      'PHP': 'composer install',
      '.NET': 'dotnet build -c Release'
    };

    return commands[framework] || 'npm run build';
  }

  private static getFrameworkStartCommand(framework: string): string {
    const commands: { [key: string]: string } = {
      'React': 'npm start',
      'Vue': 'npm run serve',
      'Angular': 'ng serve',
      'Next.js': 'npm start',
      'Nuxt': 'npm run start',
      'Vite': 'npm run dev',
      'Django': 'python manage.py runserver 0.0.0.0:8000',
      'Flask': 'flask run --host=0.0.0.0',
      'FastAPI': 'uvicorn main:app --host 0.0.0.0 --reload',
      'Spring Boot': 'java -jar target/app.jar',
      'Go': './app',
      'Laravel': 'php artisan serve --host=0.0.0.0',
      'PHP': 'php -S 0.0.0.0:8000',
      '.NET': 'dotnet run'
    };

    return commands[framework] || 'npm start';
  }
}

// ==================== OUTPUT PATH DETECTION ====================

export class OutputPathDetector {
  static detectOutputPath(projectPath: string, framework: string, packageJson: any): string {
    // Check vite.config.js
    const vitePath = this.detectViteOutputPath(projectPath);
    if (vitePath) return vitePath;

    // Check next.config.js
    const nextPath = this.detectNextOutputPath(projectPath);
    if (nextPath) return nextPath;

    // Check angular.json
    const angularPath = this.detectAngularOutputPath(projectPath);
    if (angularPath) return angularPath;

    // Check tsconfig.json
    const tsconfigPath = this.detectTsconfigOutputPath(projectPath);
    if (tsconfigPath) return tsconfigPath;

    // Framework defaults
    return this.getFrameworkDefaultPath(framework);
  }

  private static detectViteOutputPath(projectPath: string): string | null {
    try {
      const viteConfigPath = path.join(projectPath, 'vite.config.ts') ||
                            path.join(projectPath, 'vite.config.js');
      if (fs.existsSync(viteConfigPath)) {
        const content = fs.readFileSync(viteConfigPath, 'utf-8');
        const outDirMatch = content.match(/outDir:\s*['"](.*?)['"]/);
        if (outDirMatch) return outDirMatch[1];
      }
    } catch (e) {}
    return null;
  }

  private static detectNextOutputPath(projectPath: string): string | null {
    // Next.js typically outputs to .next
    try {
      const nextConfigPath = path.join(projectPath, 'next.config.js') ||
                            path.join(projectPath, 'next.config.mjs');
      if (fs.existsSync(nextConfigPath)) {
        return '.next';
      }
    } catch (e) {}
    return null;
  }

  private static detectAngularOutputPath(projectPath: string): string | null {
    try {
      const angularJsonPath = path.join(projectPath, 'angular.json');
      if (fs.existsSync(angularJsonPath)) {
        const content = JSON.parse(fs.readFileSync(angularJsonPath, 'utf-8'));
        const defaultProject = content.defaultProject || Object.keys(content.projects)[0];
        return content.projects[defaultProject]?.architect?.build?.options?.outputPath || 'dist';
      }
    } catch (e) {}
    return null;
  }

  private static detectTsconfigOutputPath(projectPath: string): string | null {
    try {
      const tsconfigPath = path.join(projectPath, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const content = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        return content.compilerOptions?.outDir || null;
      }
    } catch (e) {}
    return null;
  }

  private static getFrameworkDefaultPath(framework: string): string {
    const paths: { [key: string]: string } = {
      'React': 'build',
      'Vue': 'dist',
      'Angular': 'dist',
      'Next.js': '.next',
      'Nuxt': '.nuxt',
      'Vite': 'dist',
      'Gatsby': 'public',
      'Django': 'staticfiles',
      'Java': 'target',
      'Go': '.',
      'PHP': '.',
      '.NET': 'bin/Release'
    };

    return paths[framework] || 'dist';
  }
}

// ==================== ENVIRONMENT VARIABLE DETECTION ====================

export class EnvironmentDetector {
  static detectEnvironmentVariables(projectPath: string, packageJson: any): EnvironmentVariable[] {
    const envVars: EnvironmentVariable[] = [];

    // Check .env and .env.example
    const envVarsFromFile = this.extractFromEnvFiles(projectPath);
    envVars.push(...envVarsFromFile);

    // Check source code for environment variable usage
    const envVarsFromCode = this.extractFromSourceCode(projectPath);
    envVars.push(...envVarsFromCode);

    // Check package.json scripts
    const envVarsFromScripts = this.extractFromScripts(packageJson);
    envVars.push(...envVarsFromScripts);

    // Remove duplicates
    const unique = new Map<string, EnvironmentVariable>();
    for (const variable of envVars) {
      if (!unique.has(variable.name)) {
        unique.set(variable.name, variable);
      }
    }

    return Array.from(unique.values());
  }

  private static extractFromEnvFiles(projectPath: string): EnvironmentVariable[] {
    const variables: EnvironmentVariable[] = [];

    const envFiles = [
      path.join(projectPath, '.env'),
      path.join(projectPath, '.env.example'),
      path.join(projectPath, '.env.development'),
      path.join(projectPath, '.env.production')
    ];

    for (const envFile of envFiles) {
      try {
        if (fs.existsSync(envFile)) {
          const content = fs.readFileSync(envFile, 'utf-8');
          const lines = content.split('\n');

          for (const line of lines) {
            if (line.trim() && !line.startsWith('#')) {
              const [key, value] = line.split('=');
              if (key) {
                variables.push({
                  name: key.trim(),
                  value: value?.trim() || undefined,
                  required: !value || value.trim() === '',
                  source: 'env'
                });
              }
            }
          }
        }
      } catch (e) {}
    }

    return variables;
  }

  private static extractFromSourceCode(projectPath: string): EnvironmentVariable[] {
    const variables: EnvironmentVariable[] = [];
    const patterns = [
      /process\.env\.([A-Z_]+)/g,
      /import\.meta\.env\.([A-Z_]+)/g,
      /process\.getenv\(['"]([A-Z_]+)['"]\)/g,
      /os\.environ\[['"]([A-Z_]+)['"]\]/g
    ];

    try {
      const files = this.getAllSourceFiles(projectPath);
      
      for (const file of files) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          
          for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const varName = match[1];
              if (varName && !variables.some(v => v.name === varName)) {
                variables.push({
                  name: varName,
                  required: true,
                  source: 'code'
                });
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}

    return variables;
  }

  private static extractFromScripts(packageJson: any): EnvironmentVariable[] {
    const variables: EnvironmentVariable[] = [];
    const scripts = packageJson.scripts || {};

    for (const [_, command] of Object.entries(scripts)) {
      const matches = (command as string).match(/([A-Z_]+)=/g);
      if (matches) {
        for (const match of matches) {
          const varName = match.replace('=', '');
          if (!variables.some(v => v.name === varName)) {
            variables.push({
              name: varName,
              required: true,
              source: 'code'
            });
          }
        }
      }
    }

    return variables;
  }

  private static getAllSourceFiles(projectPath: string, maxDepth: number = 5, currentDepth: number = 0): string[] {
    const files: string[] = [];
    if (currentDepth > maxDepth) return files;

    const ignorePatterns = ['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'];

    try {
      const entries = fs.readdirSync(projectPath);

      for (const entry of entries) {
        if (ignorePatterns.some(pattern => entry.includes(pattern))) continue;

        const fullPath = path.join(projectPath, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js') || 
                             entry.endsWith('.py') || entry.endsWith('.java') || 
                             entry.endsWith('.go') || entry.endsWith('.php'))) {
          files.push(fullPath);
        } else if (stat.isDirectory() && currentDepth < maxDepth) {
          files.push(...this.getAllSourceFiles(fullPath, maxDepth, currentDepth + 1));
        }
      }
    } catch (e) {}

    return files;
  }
}

// ==================== MAIN BUILD CONFIG DETECTOR ====================

export class BuildConfigDetector {
  static async detectAllConfigs(projectPath: string, framework: string): Promise<BuildConfig> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      const port = PortDetector.detectPort(projectPath, framework);
      const buildCommand = BuildCommandDetector.detectBuildCommand(projectPath, framework, packageJson);
      const startCommand = BuildCommandDetector.detectStartCommand(projectPath, framework, packageJson);
      const outputPath = OutputPathDetector.detectOutputPath(projectPath, framework, packageJson);
      const envVariables = EnvironmentDetector.detectEnvironmentVariables(projectPath, packageJson);

      return {
        buildCommand,
        startCommand,
        port,
        outputPath,
        envVariables,
        scripts: packageJson.scripts || {}
      };
    } catch (error) {
      console.error('Error detecting build config:', error);
      return {
        buildCommand: 'npm run build',
        startCommand: 'npm start',
        port: 3000,
        outputPath: 'dist',
        envVariables: []
      };
    }
  }
}

export default BuildConfigDetector;
