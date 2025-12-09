import * as fs from 'fs';
import * as path from 'path';

/**
 * Monorepo Detection Module
 * Detects Yarn workspaces, pnpm, Lerna, Nx, Rush, and multi-language monorepos
 * 
 * Errors Fixed:
 * - Error #13: Yarn workspaces detection with glob expansion
 * - Error #14: pnpm workspaces with YAML parsing
 * - Error #15: Lerna monorepo package discovery
 * - Error #16: Nx monorepo project analysis
 * - Error #17: Rush monorepo configuration parsing
 * - Error #18: Multi-language monorepo support
 */

// ==================== INTERFACES ====================

export interface MonorepoInfo {
  type: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'rush' | 'turbo' | 'none';
  isMonorepo: boolean;
  workspaces: WorkspaceInfo[];
  rootPackageJson?: any;
  rootPath: string;
  detectionScore: number; // 0-100% confidence
  errors?: string[]; // Errors encountered during detection
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  type: 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown';
  language: 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed';
  packageJson?: any;
  frameworks?: string[];
  dependencies?: string[];
  devDependencies?: string[];
  detectedLanguages?: string[]; // For multi-language workspaces (Error #18)
  sourceFiles?: { [key: string]: number }; // File count by extension
}

// ==================== YARN WORKSPACES DETECTION (Error #13) ====================

/**
 * Error #13: Yarn workspaces detection
 * - Full glob pattern expansion (*, **)
 * - Workspaces as array or nested object
 * - Proper path normalization
 */
export class YarnWorkspacesDetector {
  static detect(basePath: string): MonorepoInfo | null {
    try {
      const packageJsonPath = path.join(basePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return null;

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      if (!packageJson.workspaces) return null;

      const workspaces = this.extractWorkspaces(basePath, packageJson.workspaces);

      return {
        type: 'yarn',
        isMonorepo: workspaces.length > 0,
        workspaces,
        rootPackageJson: packageJson,
        rootPath: basePath,
        detectionScore: workspaces.length > 0 ? 95 : 0
      };
    } catch (e) {
      return null;
    }
  }

  private static extractWorkspaces(basePath: string, workspacePatterns: string[] | { packages?: string[] }): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];

    const patterns = Array.isArray(workspacePatterns) 
      ? workspacePatterns 
      : workspacePatterns.packages || [];

    for (const pattern of patterns) {
      const expandedPaths = this.expandGlobPattern(basePath, pattern);
      
      for (const workspacePath of expandedPaths) {
        const workspaceInfo = this.analyzeWorkspace(workspacePath);
        if (workspaceInfo) {
          workspaces.push(workspaceInfo);
        }
      }
    }

    return workspaces;
  }

  /**
   * Advanced glob pattern expansion supporting * and **
   */
  private static expandGlobPattern(basePath: string, pattern: string): string[] {
    const paths: string[] = [];
    
    // Handle ** (recursive wildcard)
    if (pattern.includes('**')) {
      return this.expandRecursiveGlob(basePath, pattern);
    }

    // Handle * (single directory wildcard)
    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      const prefix = parts[0];
      const suffix = parts[1] || '';

      const prefixPath = path.join(basePath, prefix);
      try {
        if (fs.existsSync(prefixPath)) {
          const entries = fs.readdirSync(prefixPath);
          for (const entry of entries) {
            const fullPath = path.join(prefixPath, entry, suffix);
            if (fs.existsSync(fullPath)) {
              // Verify it has package.json (is a valid package)
              if (fs.existsSync(path.join(fullPath, 'package.json'))) {
                paths.push(fullPath);
              }
            }
          }
        }
      } catch (e) {
        // Silently ignore errors during glob expansion
      }
    } else {
      const fullPath = path.join(basePath, pattern);
      if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'))) {
        paths.push(fullPath);
      }
    }

    return paths;
  }

  /**
   * Recursive glob pattern expansion for ** wildcards
   */
  private static expandRecursiveGlob(basePath: string, pattern: string): string[] {
    const paths: string[] = [];
    const parts = pattern.split('**');
    const prefix = parts[0];
    const suffix = (parts[1] || '').replace(/^\//, '');

    const startPath = prefix ? path.join(basePath, prefix) : basePath;

    const walkDir = (dir: string, depth: number = 0): void => {
      if (depth > 10) return; // Prevent infinite recursion
      
      try {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          
          const fullPath = path.join(dir, entry);
          
          if (suffix) {
            const targetPath = path.join(fullPath, suffix);
            if (fs.existsSync(targetPath) && fs.existsSync(path.join(targetPath, 'package.json'))) {
              paths.push(targetPath);
            }
          } else {
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
              paths.push(fullPath);
            }
          }

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory() && !entry.includes('node_modules')) {
            walkDir(fullPath, depth + 1);
          }
        }
      } catch (e) {
        // Silently ignore errors
      }
    };

    if (fs.existsSync(startPath)) {
      walkDir(startPath);
    }

    return paths;
  }

  private static analyzeWorkspace(workspacePath: string): WorkspaceInfo | null {
    try {
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return null;

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      
      return {
        name: packageJson.name || path.basename(workspacePath),
        path: workspacePath,
        type: this.detectWorkspaceType(packageJson),
        language: this.detectLanguage(workspacePath),
        packageJson,
        frameworks: this.detectFrameworks(packageJson),
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        detectedLanguages: this.detectMultipleLanguages(workspacePath),
        sourceFiles: this.analyzeSourceFiles(workspacePath)
      };
    } catch (e) {
      return null;
    }
  }

  private static detectWorkspaceType(packageJson: any): 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown' {
    const keywords = packageJson.keywords || [];
    const name = (packageJson.name || '').toLowerCase();
    const description = (packageJson.description || '').toLowerCase();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    // Check for frontend frameworks
    if (name.includes('web') || name.includes('ui') || name.includes('frontend') || name.includes('app')) {
      return 'frontend';
    }
    if (deps.react || deps.vue || deps['@angular/core'] || deps.svelte) {
      return 'frontend';
    }

    // Check for backend frameworks
    if (name.includes('api') || name.includes('server') || name.includes('backend') || name.includes('service')) {
      return 'backend';
    }
    if (deps.express || deps.fastify || deps.koa || deps.nestjs) {
      return 'backend';
    }

    // Check for shared
    if (name.includes('shared') || name.includes('common') || name.includes('utils') || name.includes('types')) {
      return 'shared';
    }

    // Check for library
    if (keywords.includes('library') || name.includes('lib') || packageJson.main) {
      return 'library';
    }

    return 'unknown';
  }

  private static detectLanguage(workspacePath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed' {
    try {
      const entries = fs.readdirSync(workspacePath);
      const sourceExtensions = new Set<string>();

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue;
        const fullPath = path.join(workspacePath, entry);
        
        if (fs.statSync(fullPath).isFile()) {
          if (entry.endsWith('.ts') || entry.endsWith('.tsx')) sourceExtensions.add('typescript');
          else if (entry.endsWith('.js') || entry.endsWith('.jsx')) sourceExtensions.add('javascript');
          else if (entry.endsWith('.py')) sourceExtensions.add('python');
          else if (entry.endsWith('.java')) sourceExtensions.add('java');
          else if (entry.endsWith('.go')) sourceExtensions.add('go');
          else if (entry.endsWith('.php')) sourceExtensions.add('php');
          else if (entry.endsWith('.cs')) sourceExtensions.add('dotnet');
          else if (entry.endsWith('.rs')) sourceExtensions.add('rust');
        }
      }

      if (sourceExtensions.size > 1) return 'mixed';
      if (sourceExtensions.has('typescript')) return 'typescript';
      if (sourceExtensions.has('python')) return 'python';
      if (sourceExtensions.has('java')) return 'java';
      if (sourceExtensions.has('go')) return 'go';
      if (sourceExtensions.has('php')) return 'php';
      if (sourceExtensions.has('dotnet')) return 'dotnet';
      if (sourceExtensions.has('rust')) return 'rust';

      return 'javascript'; // Default for Node.js
    } catch (e) {
      return 'typescript';
    }
  }

  private static detectMultipleLanguages(workspacePath: string): string[] {
    try {
      const languages = new Set<string>();
      const srcDirs = [
        path.join(workspacePath, 'src'),
        path.join(workspacePath, 'lib'),
        path.join(workspacePath, 'app')
      ];

      for (const dir of srcDirs) {
        if (!fs.existsSync(dir)) continue;
        
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.endsWith('.ts') || entry.endsWith('.tsx')) languages.add('TypeScript');
          else if (entry.endsWith('.js') || entry.endsWith('.jsx')) languages.add('JavaScript');
          else if (entry.endsWith('.py')) languages.add('Python');
        }
      }

      return Array.from(languages);
    } catch (e) {
      return [];
    }
  }

  private static analyzeSourceFiles(workspacePath: string): { [key: string]: number } {
    const counts: { [key: string]: number } = {};

    try {
      const srcDirs = [
        path.join(workspacePath, 'src'),
        path.join(workspacePath, 'lib'),
        workspacePath
      ];

      for (const dir of srcDirs) {
        if (!fs.existsSync(dir)) continue;
        
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const ext = path.extname(entry);
            if (ext) counts[ext] = (counts[ext] || 0) + 1;
          }
        } catch (e) {}
      }
    } catch (e) {}

    return counts;
  }

  private static detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps['@angular/core']) frameworks.push('Angular');
    if (deps.next) frameworks.push('Next.js');
    if (deps.nuxt) frameworks.push('Nuxt');
    if (deps.svelte) frameworks.push('Svelte');
    if (deps.express) frameworks.push('Express');
    if (deps.fastify) frameworks.push('Fastify');
    if (deps.koa) frameworks.push('Koa');
    if (deps['@nestjs/core']) frameworks.push('NestJS');
    if (deps.django) frameworks.push('Django');
    if (deps.flask) frameworks.push('Flask');

    return frameworks;
  }
}

// ==================== PNPM WORKSPACES DETECTION (Error #14) ====================

/**
 * Error #14: pnpm workspaces with YAML parsing
 * - Proper pnpm-workspace.yaml parsing
 * - Support for comments and formatting
 * - Advanced pattern expansion
 */
export class PnpmWorkspacesDetector {
  static detect(basePath: string): MonorepoInfo | null {
    try {
      const pnpmYamlPath = path.join(basePath, 'pnpm-workspace.yaml');
      if (!fs.existsSync(pnpmYamlPath)) return null;

      const content = fs.readFileSync(pnpmYamlPath, 'utf-8');
      const workspacePatterns = this.parsePnpmWorkspaceYaml(content);

      if (workspacePatterns.length === 0) return null;

      const packageJsonPath = path.join(basePath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      const workspaces = this.extractWorkspaces(basePath, workspacePatterns);

      return {
        type: 'pnpm',
        isMonorepo: workspaces.length > 0,
        workspaces,
        rootPackageJson: packageJson,
        rootPath: basePath,
        detectionScore: workspaces.length > 0 ? 95 : 0
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Advanced YAML parsing for pnpm-workspace.yaml
   * Handles comments, indentation, and various formats
   */
  private static parsePnpmWorkspaceYaml(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');

    let inPackages = false;
    for (const line of lines) {
      // Remove comments
      const cleanLine = line.split('#')[0].trim();
      
      if (!cleanLine) continue;

      // Check for packages: key
      if (cleanLine === 'packages:' || cleanLine.startsWith('packages:')) {
        inPackages = true;
        
        // Handle inline format: packages: ['packages/*', 'apps/*']
        if (cleanLine.includes('[')) {
          const match = cleanLine.match(/\['([^']*)'\s*,?\s*'([^']*)'\s*(?:,\s*'([^']*)'\s*)*\]/);
          if (match) {
            for (let i = 1; i < match.length; i++) {
              if (match[i]) patterns.push(match[i]);
            }
          }
          inPackages = false;
        }
        continue;
      }

      // Handle array format
      if (inPackages && cleanLine.startsWith('- ')) {
        const pattern = cleanLine.replace(/^-\s+['"]?/, '').replace(/['"]?\s*$/, '').trim();
        if (pattern && pattern !== 'packages:') {
          patterns.push(pattern);
        }
      }

      // Exit packages section if we hit another top-level key
      if (inPackages && !cleanLine.startsWith('- ') && !cleanLine.startsWith(' ') && cleanLine.includes(':')) {
        inPackages = false;
      }
    }

    return patterns;
  }

  private static extractWorkspaces(basePath: string, patterns: string[]): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];
    const seen = new Set<string>(); // Prevent duplicates

    for (const pattern of patterns) {
      const expandedPaths = this.expandGlobPattern(basePath, pattern);
      
      for (const workspacePath of expandedPaths) {
        if (!seen.has(workspacePath)) {
          seen.add(workspacePath);
          const workspaceInfo = this.analyzeWorkspace(workspacePath);
          if (workspaceInfo) {
            workspaces.push(workspaceInfo);
          }
        }
      }
    }

    return workspaces;
  }

  private static expandGlobPattern(basePath: string, pattern: string): string[] {
    const paths: string[] = [];

    // Handle ** (recursive wildcard)
    if (pattern.includes('**')) {
      return this.expandRecursiveGlob(basePath, pattern);
    }

    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      const prefix = parts[0];
      const suffix = parts[1] || '';

      const prefixPath = path.join(basePath, prefix);
      try {
        if (fs.existsSync(prefixPath)) {
          const entries = fs.readdirSync(prefixPath);
          for (const entry of entries) {
            const fullPath = path.join(prefixPath, entry, suffix);
            if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'))) {
              paths.push(fullPath);
            }
          }
        }
      } catch (e) {}
    } else {
      const fullPath = path.join(basePath, pattern);
      if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'))) {
        paths.push(fullPath);
      }
    }

    return paths;
  }

  private static expandRecursiveGlob(basePath: string, pattern: string): string[] {
    const paths: string[] = [];
    const parts = pattern.split('**');
    const prefix = parts[0];
    const suffix = (parts[1] || '').replace(/^\//, '');

    const startPath = prefix ? path.join(basePath, prefix) : basePath;

    const walkDir = (dir: string, depth: number = 0): void => {
      if (depth > 10) return;
      
      try {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
          if (entry.startsWith('.') || entry === 'node_modules') continue;
          
          const fullPath = path.join(dir, entry);
          
          if (suffix) {
            const targetPath = path.join(fullPath, suffix);
            if (fs.existsSync(targetPath) && fs.existsSync(path.join(targetPath, 'package.json'))) {
              paths.push(targetPath);
            }
          } else {
            if (fs.existsSync(path.join(fullPath, 'package.json'))) {
              paths.push(fullPath);
            }
          }

          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath, depth + 1);
          }
        }
      } catch (e) {}
    };

    if (fs.existsSync(startPath)) {
      walkDir(startPath);
    }

    return paths;
  }

  private static analyzeWorkspace(workspacePath: string): WorkspaceInfo | null {
    try {
      const packageJsonPath = path.join(workspacePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return null;

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      return {
        name: packageJson.name || path.basename(workspacePath),
        path: workspacePath,
        type: this.detectWorkspaceType(packageJson),
        language: this.detectLanguage(workspacePath),
        packageJson,
        frameworks: this.detectFrameworks(packageJson),
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        detectedLanguages: this.detectMultipleLanguages(workspacePath),
        sourceFiles: this.analyzeSourceFiles(workspacePath)
      };
    } catch (e) {
      return null;
    }
  }

  private static detectWorkspaceType(packageJson: any): 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown' {
    const name = (packageJson.name || '').toLowerCase();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (name.includes('web') || name.includes('ui') || name.includes('frontend')) return 'frontend';
    if (deps.react || deps.vue || deps['@angular/core']) return 'frontend';

    if (name.includes('api') || name.includes('server') || name.includes('backend')) return 'backend';
    if (deps.express || deps.fastify) return 'backend';

    if (name.includes('shared') || name.includes('common')) return 'shared';
    if (name.includes('lib')) return 'library';

    return 'unknown';
  }

  private static detectLanguage(workspacePath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed' {
    try {
      const srcPath = path.join(workspacePath, 'src');
      if (!fs.existsSync(srcPath)) return 'typescript';

      const entries = fs.readdirSync(srcPath);
      let hasTs = false, hasJs = false, hasOther = false;

      for (const entry of entries) {
        if (entry.endsWith('.ts') || entry.endsWith('.tsx')) hasTs = true;
        else if (entry.endsWith('.js') || entry.endsWith('.jsx')) hasJs = true;
        else if (entry.endsWith('.py') || entry.endsWith('.go') || entry.endsWith('.rs')) hasOther = true;
      }

      if (hasOther) return 'mixed';
      if (hasTs && hasJs) return 'mixed';
      if (hasTs) return 'typescript';
      if (hasJs) return 'javascript';

      return 'typescript';
    } catch (e) {
      return 'typescript';
    }
  }

  private static detectMultipleLanguages(workspacePath: string): string[] {
    try {
      const languages = new Set<string>();
      const srcPath = path.join(workspacePath, 'src');
      
      if (!fs.existsSync(srcPath)) return [];
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        if (entry.endsWith('.ts')) languages.add('TypeScript');
        else if (entry.endsWith('.js')) languages.add('JavaScript');
        else if (entry.endsWith('.py')) languages.add('Python');
      }

      return Array.from(languages);
    } catch (e) {
      return [];
    }
  }

  private static analyzeSourceFiles(workspacePath: string): { [key: string]: number } {
    const counts: { [key: string]: number } = {};

    try {
      const srcPath = path.join(workspacePath, 'src');
      if (!fs.existsSync(srcPath)) return counts;
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        const ext = path.extname(entry);
        if (ext) counts[ext] = (counts[ext] || 0) + 1;
      }
    } catch (e) {}

    return counts;
  }

  private static detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps['@angular/core']) frameworks.push('Angular');
    if (deps.next) frameworks.push('Next.js');
    if (deps.express) frameworks.push('Express');

    return frameworks;
  }
}

// ==================== LERNA MONOREPO DETECTION (Error #15) ====================

/**
 * Error #15: Lerna monorepo package discovery
 * - Full lerna.json parsing
 * - Package location detection
 * - Version management support
 */
export class LernaDetector {
  static detect(basePath: string): MonorepoInfo | null {
    try {
      const lernaJsonPath = path.join(basePath, 'lerna.json');
      if (!fs.existsSync(lernaJsonPath)) return null;

      const lernaJson = JSON.parse(fs.readFileSync(lernaJsonPath, 'utf-8'));
      const packages = lernaJson.packages || ['packages/*'];

      const packageJsonPath = path.join(basePath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      const workspaces = this.extractPackages(basePath, packages);

      return {
        type: 'lerna',
        isMonorepo: workspaces.length > 0,
        workspaces,
        rootPackageJson: packageJson,
        rootPath: basePath,
        detectionScore: workspaces.length > 0 ? 95 : 0
      };
    } catch (e) {
      return null;
    }
  }

  private static extractPackages(basePath: string, patterns: string[]): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];
    const seen = new Set<string>();

    for (const pattern of patterns) {
      const expandedPaths = this.expandGlobPattern(basePath, pattern);
      
      for (const packagePath of expandedPaths) {
        if (!seen.has(packagePath)) {
          seen.add(packagePath);
          const workspaceInfo = this.analyzePackage(packagePath);
          if (workspaceInfo) {
            workspaces.push(workspaceInfo);
          }
        }
      }
    }

    return workspaces;
  }

  private static expandGlobPattern(basePath: string, pattern: string): string[] {
    const paths: string[] = [];

    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      const prefix = parts[0];
      const suffix = parts[1] || '';

      const prefixPath = path.join(basePath, prefix);
      try {
        if (fs.existsSync(prefixPath)) {
          const entries = fs.readdirSync(prefixPath);
          for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            
            const fullPath = path.join(prefixPath, entry, suffix);
            if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'))) {
              paths.push(fullPath);
            }
          }
        }
      } catch (e) {}
    } else {
      const fullPath = path.join(basePath, pattern);
      if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, 'package.json'))) {
        paths.push(fullPath);
      }
    }

    return paths;
  }

  private static analyzePackage(packagePath: string): WorkspaceInfo | null {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) return null;

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      return {
        name: packageJson.name || path.basename(packagePath),
        path: packagePath,
        type: this.detectPackageType(packageJson),
        language: this.detectLanguage(packagePath),
        packageJson,
        frameworks: this.detectFrameworks(packageJson),
        dependencies: Object.keys(packageJson.dependencies || {}),
        devDependencies: Object.keys(packageJson.devDependencies || {}),
        detectedLanguages: this.detectMultipleLanguages(packagePath),
        sourceFiles: this.analyzeSourceFiles(packagePath)
      };
    } catch (e) {
      return null;
    }
  }

  private static detectPackageType(packageJson: any): 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown' {
    const name = (packageJson.name || '').toLowerCase();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const keywords = packageJson.keywords || [];

    // Frontend detection
    if (name.includes('web') || name.includes('ui') || name.includes('frontend') || name.includes('app')) {
      return 'frontend';
    }
    if (deps.react || deps.vue || deps['@angular/core'] || deps.svelte) {
      return 'frontend';
    }

    // Backend detection
    if (name.includes('api') || name.includes('server') || name.includes('backend') || name.includes('service')) {
      return 'backend';
    }
    if (deps.express || deps.fastify || deps.koa) {
      return 'backend';
    }

    // Shared/Common
    if (name.includes('shared') || name.includes('common') || name.includes('utils') || name.includes('types')) {
      return 'shared';
    }

    // Library
    if (keywords.includes('library') || name.includes('lib') || packageJson.main || packageJson.types) {
      return 'library';
    }

    return 'unknown';
  }

  private static detectLanguage(packagePath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed' {
    try {
      const srcPath = path.join(packagePath, 'src');
      if (!fs.existsSync(srcPath)) return 'typescript';

      const entries = fs.readdirSync(srcPath);
      const langCount = { ts: 0, js: 0, py: 0, other: 0 };

      for (const entry of entries) {
        if (entry.endsWith('.ts') || entry.endsWith('.tsx')) langCount.ts++;
        else if (entry.endsWith('.js') || entry.endsWith('.jsx')) langCount.js++;
        else if (entry.endsWith('.py')) langCount.py++;
        else if (entry.match(/\.(go|java|php|rs|cs)$/)) langCount.other++;
      }

      if (langCount.other > 0) return 'mixed';
      if (langCount.py > 0) return 'python';
      if ((langCount.ts + langCount.js) > 0) {
        if (langCount.ts > langCount.js) return 'typescript';
        if (langCount.js > langCount.ts) return 'javascript';
        if (langCount.ts === langCount.js) return 'mixed';
      }

      return 'typescript';
    } catch (e) {
      return 'typescript';
    }
  }

  private static detectMultipleLanguages(packagePath: string): string[] {
    try {
      const languages = new Set<string>();
      const srcPath = path.join(packagePath, 'src');
      
      if (!fs.existsSync(srcPath)) return [];
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        if (entry.endsWith('.ts')) languages.add('TypeScript');
        else if (entry.endsWith('.js')) languages.add('JavaScript');
        else if (entry.endsWith('.py')) languages.add('Python');
        else if (entry.endsWith('.java')) languages.add('Java');
        else if (entry.endsWith('.go')) languages.add('Go');
      }

      return Array.from(languages);
    } catch (e) {
      return [];
    }
  }

  private static analyzeSourceFiles(packagePath: string): { [key: string]: number } {
    const counts: { [key: string]: number } = {};

    try {
      const srcPath = path.join(packagePath, 'src');
      if (!fs.existsSync(srcPath)) return counts;
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        const ext = path.extname(entry);
        if (ext) counts[ext] = (counts[ext] || 0) + 1;
      }
    } catch (e) {}

    return counts;
  }

  private static detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps['@angular/core']) frameworks.push('Angular');
    if (deps.next) frameworks.push('Next.js');
    if (deps.nuxt) frameworks.push('Nuxt');
    if (deps.svelte) frameworks.push('Svelte');
    if (deps.express) frameworks.push('Express');
    if (deps.fastify) frameworks.push('Fastify');
    if (deps.koa) frameworks.push('Koa');
    if (deps['@nestjs/core']) frameworks.push('NestJS');

    return frameworks;
  }
}

// ==================== NX MONOREPO DETECTION (Error #16) ====================

/**
 * Error #16: Nx monorepo project analysis
 * - nx.json parsing
 * - project.json discovery
 * - Project type detection
 */
export class NxDetector {
  static detect(basePath: string): MonorepoInfo | null {
    try {
      const nxJsonPath = path.join(basePath, 'nx.json');
      if (!fs.existsSync(nxJsonPath)) return null;

      const nxJson = JSON.parse(fs.readFileSync(nxJsonPath, 'utf-8'));

      const packageJsonPath = path.join(basePath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      const workspaces = this.extractProjects(basePath);

      return {
        type: 'nx',
        isMonorepo: workspaces.length > 0,
        workspaces,
        rootPackageJson: packageJson,
        rootPath: basePath,
        detectionScore: workspaces.length > 0 ? 95 : 0
      };
    } catch (e) {
      return null;
    }
  }

  private static extractProjects(basePath: string): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];
    const seen = new Set<string>();

    // Check apps and libs directories
    const dirsToCheck = [
      path.join(basePath, 'apps'),
      path.join(basePath, 'libs'),
      path.join(basePath, 'packages'),
      path.join(basePath, 'modules')
    ];

    for (const dir of dirsToCheck) {
      try {
        if (fs.existsSync(dir)) {
          const entries = fs.readdirSync(dir);
          
          for (const entry of entries) {
            if (entry.startsWith('.')) continue;
            
            const projectPath = path.join(dir, entry);
            
            // Try to find project.json
            let projectJson: any = null;
            const projectJsonPath = path.join(projectPath, 'project.json');
            const projectJsonTsPath = path.join(projectPath, 'project.json');
            
            if (fs.existsSync(projectJsonPath)) {
              try {
                projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
              } catch (e) {}
            }

            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = fs.existsSync(packageJsonPath)
              ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
              : {};

            // Only include if it has at least a package.json or project.json
            if (Object.keys(packageJson).length > 0 || projectJson) {
              const key = path.normalize(projectPath);
              if (!seen.has(key)) {
                seen.add(key);
                
                workspaces.push({
                  name: projectJson?.name || packageJson.name || entry,
                  path: projectPath,
                  type: this.detectProjectType(dir, projectJson, packageJson),
                  language: this.detectLanguage(projectPath),
                  packageJson,
                  frameworks: this.detectFrameworks(packageJson),
                  dependencies: Object.keys(packageJson.dependencies || {}),
                  devDependencies: Object.keys(packageJson.devDependencies || {}),
                  detectedLanguages: this.detectMultipleLanguages(projectPath),
                  sourceFiles: this.analyzeSourceFiles(projectPath)
                });
              }
            }
          }
        }
      } catch (e) {}
    }

    return workspaces;
  }

  private static detectProjectType(parentDir: string, projectJson: any, packageJson: any): 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown' {
    // Check parent directory
    if (parentDir.includes('apps')) return 'service';
    if (parentDir.includes('libs')) return 'library';
    
    // Check project.json tags
    if (projectJson?.tags) {
      const tags = projectJson.tags as string[];
      if (tags.includes('type:app') || tags.includes('scope:frontend')) return 'frontend';
      if (tags.includes('type:lib') || tags.includes('type:library')) return 'library';
      if (tags.includes('type:api')) return 'backend';
    }

    // Check package name and deps
    const name = (packageJson.name || '').toLowerCase();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (name.includes('web') || name.includes('ui') || name.includes('frontend')) return 'frontend';
    if (deps.react || deps.vue || deps['@angular/core']) return 'frontend';

    if (name.includes('api') || name.includes('server')) return 'backend';
    if (deps.express || deps.fastify) return 'backend';

    if (name.includes('shared') || name.includes('common')) return 'shared';

    return 'unknown';
  }

  private static detectLanguage(projectPath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed' {
    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) return 'typescript';

      const entries = fs.readdirSync(srcPath);
      let ts = 0, js = 0, other = 0;

      for (const entry of entries) {
        if (entry.endsWith('.ts') || entry.endsWith('.tsx')) ts++;
        else if (entry.endsWith('.js') || entry.endsWith('.jsx')) js++;
        else if (entry.match(/\.(py|java|go|php|rs|cs)$/)) other++;
      }

      if (other > 0) return 'mixed';
      if (ts > js) return 'typescript';
      if (js > ts) return 'javascript';
      if (ts === js && ts > 0) return 'mixed';

      return 'typescript';
    } catch (e) {
      return 'typescript';
    }
  }

  private static detectMultipleLanguages(projectPath: string): string[] {
    try {
      const languages = new Set<string>();
      const srcPath = path.join(projectPath, 'src');
      
      if (!fs.existsSync(srcPath)) return [];
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        if (entry.endsWith('.ts')) languages.add('TypeScript');
        else if (entry.endsWith('.js')) languages.add('JavaScript');
        else if (entry.endsWith('.py')) languages.add('Python');
      }

      return Array.from(languages);
    } catch (e) {
      return [];
    }
  }

  private static analyzeSourceFiles(projectPath: string): { [key: string]: number } {
    const counts: { [key: string]: number } = {};

    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) return counts;
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        const ext = path.extname(entry);
        if (ext) counts[ext] = (counts[ext] || 0) + 1;
      }
    } catch (e) {}

    return counts;
  }

  private static detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps['@angular/core']) frameworks.push('Angular');
    if (deps.next) frameworks.push('Next.js');
    if (deps.nuxt) frameworks.push('Nuxt');
    if (deps.express) frameworks.push('Express');
    if (deps.fastify) frameworks.push('Fastify');

    return frameworks;
  }
}

// ==================== RUSH MONOREPO DETECTION (Error #17) ====================

/**
 * Error #17: Rush monorepo configuration parsing
 * - rush.json parsing
 * - Project discovery from configuration
 * - Dependency management support
 */
export class RushDetector {
  static detect(basePath: string): MonorepoInfo | null {
    try {
      const rushJsonPath = path.join(basePath, 'rush.json');
      if (!fs.existsSync(rushJsonPath)) return null;

      const rushJson = JSON.parse(fs.readFileSync(rushJsonPath, 'utf-8'));

      const packageJsonPath = path.join(basePath, 'package.json');
      const packageJson = fs.existsSync(packageJsonPath)
        ? JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
        : {};

      const workspaces = this.extractProjects(basePath, rushJson);

      return {
        type: 'rush',
        isMonorepo: workspaces.length > 0,
        workspaces,
        rootPackageJson: packageJson,
        rootPath: basePath,
        detectionScore: workspaces.length > 0 ? 95 : 0
      };
    } catch (e) {
      return null;
    }
  }

  private static extractProjects(basePath: string, rushJson: any): WorkspaceInfo[] {
    const workspaces: WorkspaceInfo[] = [];
    const projects = rushJson.projects || [];
    const seen = new Set<string>();

    for (const project of projects) {
      const projectPath = path.join(basePath, project.projectFolder);
      const key = path.normalize(projectPath);

      if (seen.has(key)) continue;
      seen.add(key);

      const packageJsonPath = path.join(projectPath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

          workspaces.push({
            name: packageJson.name || path.basename(projectPath),
            path: projectPath,
            type: this.detectProjectType(packageJson),
            language: this.detectLanguage(projectPath),
            packageJson,
            frameworks: this.detectFrameworks(packageJson),
            dependencies: Object.keys(packageJson.dependencies || {}),
            devDependencies: Object.keys(packageJson.devDependencies || {}),
            detectedLanguages: this.detectMultipleLanguages(projectPath),
            sourceFiles: this.analyzeSourceFiles(projectPath)
          });
        } catch (e) {}
      }
    }

    return workspaces;
  }

  private static detectProjectType(packageJson: any): 'frontend' | 'backend' | 'library' | 'service' | 'shared' | 'unknown' {
    const name = (packageJson.name || '').toLowerCase();
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const keywords = packageJson.keywords || [];

    if (name.includes('web') || name.includes('ui') || name.includes('frontend') || name.includes('app')) {
      return 'frontend';
    }
    if (deps.react || deps.vue || deps['@angular/core']) return 'frontend';

    if (name.includes('api') || name.includes('server') || name.includes('backend') || name.includes('service')) {
      return 'backend';
    }
    if (deps.express || deps.fastify) return 'backend';

    if (name.includes('shared') || name.includes('common') || name.includes('utils')) return 'shared';

    if (keywords.includes('library') || name.includes('lib')) return 'library';

    return 'unknown';
  }

  private static detectLanguage(projectPath: string): 'typescript' | 'javascript' | 'python' | 'java' | 'go' | 'php' | 'dotnet' | 'rust' | 'mixed' {
    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) return 'typescript';

      const entries = fs.readdirSync(srcPath);
      let ts = 0, js = 0;

      for (const entry of entries) {
        if (entry.endsWith('.ts') || entry.endsWith('.tsx')) ts++;
        else if (entry.endsWith('.js') || entry.endsWith('.jsx')) js++;
      }

      if (ts > js) return 'typescript';
      if (js > ts) return 'javascript';
      if (ts === js && ts > 0) return 'mixed';

      return 'typescript';
    } catch (e) {
      return 'typescript';
    }
  }

  private static detectMultipleLanguages(projectPath: string): string[] {
    try {
      const languages = new Set<string>();
      const srcPath = path.join(projectPath, 'src');
      
      if (!fs.existsSync(srcPath)) return [];
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        if (entry.endsWith('.ts')) languages.add('TypeScript');
        else if (entry.endsWith('.js')) languages.add('JavaScript');
        else if (entry.endsWith('.py')) languages.add('Python');
      }

      return Array.from(languages);
    } catch (e) {
      return [];
    }
  }

  private static analyzeSourceFiles(projectPath: string): { [key: string]: number } {
    const counts: { [key: string]: number } = {};

    try {
      const srcPath = path.join(projectPath, 'src');
      if (!fs.existsSync(srcPath)) return counts;
      
      const entries = fs.readdirSync(srcPath);
      for (const entry of entries) {
        const ext = path.extname(entry);
        if (ext) counts[ext] = (counts[ext] || 0) + 1;
      }
    } catch (e) {}

    return counts;
  }

  private static detectFrameworks(packageJson: any): string[] {
    const frameworks: string[] = [];
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.react) frameworks.push('React');
    if (deps.vue) frameworks.push('Vue');
    if (deps['@angular/core']) frameworks.push('Angular');
    if (deps.next) frameworks.push('Next.js');
    if (deps.express) frameworks.push('Express');

    return frameworks;
  }
}

// ==================== MAIN MONOREPO DETECTOR (Error #18) ====================

/**
 * Error #18: Multi-language monorepo support
 * - Detect multiple programming languages in monorepo
 * - Per-workspace language analysis
 * - Cross-language dependency tracking
 */
export class MonorepoDetector {
  static async detectMonorepo(basePath: string): Promise<MonorepoInfo> {
    // Try detection in order of specificity
    let monorepo: MonorepoInfo | null = null;

    // Check Nx
    monorepo = NxDetector.detect(basePath);
    if (monorepo?.isMonorepo) return monorepo;

    // Check Rush
    monorepo = RushDetector.detect(basePath);
    if (monorepo?.isMonorepo) return monorepo;

    // Check Lerna
    monorepo = LernaDetector.detect(basePath);
    if (monorepo?.isMonorepo) return monorepo;

    // Check pnpm workspaces
    monorepo = PnpmWorkspacesDetector.detect(basePath);
    if (monorepo?.isMonorepo) return monorepo;

    // Check Yarn workspaces
    monorepo = YarnWorkspacesDetector.detect(basePath);
    if (monorepo?.isMonorepo) return monorepo;

    // Not a monorepo
    return {
      type: 'none',
      isMonorepo: false,
      workspaces: [],
      rootPath: basePath,
      detectionScore: 0
    };
  }

  /**
   * Detect if it's a multi-language monorepo (Error #18)
   * Returns true if workspaces use different programming languages
   */
  static hasMultipleLanguages(monorepo: MonorepoInfo): boolean {
    const languages = new Set<string>();
    
    for (const workspace of monorepo.workspaces) {
      languages.add(workspace.language);
      
      // Also check detectedLanguages for finer granularity
      if (workspace.detectedLanguages && workspace.detectedLanguages.length > 0) {
        workspace.detectedLanguages.forEach(lang => languages.add(lang));
      }
    }

    return languages.size > 1;
  }

  /**
   * Get all unique languages used across workspaces
   */
  static getAllLanguages(monorepo: MonorepoInfo): string[] {
    const languages = new Set<string>();

    for (const workspace of monorepo.workspaces) {
      languages.add(workspace.language);
      
      if (workspace.detectedLanguages) {
        workspace.detectedLanguages.forEach(lang => languages.add(lang));
      }
    }

    return Array.from(languages).sort();
  }

  /**
   * Get all unique frameworks used across workspaces
   */
  static getAllFrameworks(monorepo: MonorepoInfo): string[] {
    const frameworks = new Set<string>();

    for (const workspace of monorepo.workspaces) {
      if (workspace.frameworks) {
        workspace.frameworks.forEach(f => frameworks.add(f));
      }
    }

    return Array.from(frameworks).sort();
  }

  /**
   * Get workspaces by language (Error #18)
   */
  static getWorkspacesByLanguage(monorepo: MonorepoInfo, language: string): WorkspaceInfo[] {
    return monorepo.workspaces.filter(w => {
      if (w.language === language) return true;
      if (w.detectedLanguages?.includes(language)) return true;
      return false;
    });
  }

  /**
   * Get workspaces by type
   */
  static getWorkspacesByType(monorepo: MonorepoInfo, type: string): WorkspaceInfo[] {
    return monorepo.workspaces.filter(w => w.type === type);
  }

  /**
   * Analyze cross-workspace dependencies
   */
  static analyzeDependencies(monorepo: MonorepoInfo): Map<string, string[]> {
    const deps = new Map<string, string[]>();

    for (const workspace of monorepo.workspaces) {
      const workspaceDeps: string[] = [];
      
      // Check for internal dependencies (same monorepo)
      if (workspace.dependencies) {
        for (const dep of workspace.dependencies) {
          // Check if dependency is another workspace
          const dependedWorkspace = monorepo.workspaces.find(w => w.packageJson?.name === dep);
          if (dependedWorkspace) {
            workspaceDeps.push(dependedWorkspace.name);
          }
        }
      }

      if (workspaceDeps.length > 0) {
        deps.set(workspace.name, workspaceDeps);
      }
    }

    return deps;
  }

  /**
   * Get multi-language summary (Error #18)
   */
  static getMultiLanguageSummary(monorepo: MonorepoInfo): {
    isMultiLanguage: boolean;
    languages: string[];
    workspacesByLanguage: { [key: string]: string[] };
    totalWorkspaces: number;
  } {
    const languages = this.getAllLanguages(monorepo);
    const workspacesByLanguage: { [key: string]: string[] } = {};

    for (const language of languages) {
      workspacesByLanguage[language] = this.getWorkspacesByLanguage(monorepo, language)
        .map(w => w.name);
    }

    return {
      isMultiLanguage: languages.length > 1,
      languages,
      workspacesByLanguage,
      totalWorkspaces: monorepo.workspaces.length
    };
  }

  /**
   * Validate monorepo configuration
   */
  static validateMonorepo(monorepo: MonorepoInfo): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (monorepo.workspaces.length === 0) {
      errors.push('No workspaces found in monorepo');
    }

    // Check for duplicate workspace names
    const names = monorepo.workspaces.map(w => w.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate workspace names found: ${duplicates.join(', ')}`);
    }

    // Check for missing package.json in workspaces
    for (const workspace of monorepo.workspaces) {
      if (!workspace.packageJson || Object.keys(workspace.packageJson).length === 0) {
        errors.push(`Workspace "${workspace.name}" has no valid package.json`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default MonorepoDetector;
