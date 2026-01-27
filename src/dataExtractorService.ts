/**
 * Universal Data Extractor Service
 * Extracts critical data from codebases to eliminate hardcoded assumptions
 * Supports any tech stack by intelligently parsing project files
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface ExtractedEntryPoint {
    file: string;
    command?: string;
    confidence: 'high' | 'medium' | 'low';
    source: 'package.json' | 'tsconfig' | 'main.py' | 'inference' | 'custom';
}

export interface ExtractedPort {
    port: number;
    file: string;
    line?: number;
    confidence: 'high' | 'medium' | 'low';
    protocol?: 'http' | 'https' | 'websocket' | 'grpc';
}

export interface ExtractedHealthCheck {
    endpoint: string;
    method: 'GET' | 'POST' | 'HEAD';
    file: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedEnvironmentVar {
    name: string;
    required: boolean;
    defaultValue?: string;
    files: string[];
    description?: string;
}

export interface ExtractedORMCommand {
    framework: 'prisma' | 'typeorm' | 'sequelize' | 'django' | 'alembic' | 'knex' | 'flyway';
    migrateCommand: string;
    seedCommand?: string;
    generateCommand?: string;
}

export interface ExtractedBuildInfo {
    buildCommand: string;
    outputFolder: string;
    intermediateFolder?: string;
    cleanCommand?: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface ExtractedData {
    entryPoints: ExtractedEntryPoint[];
    ports: ExtractedPort[];
    healthChecks: ExtractedHealthCheck[];
    environmentVars: ExtractedEnvironmentVar[];
    ormCommands: ExtractedORMCommand[];
    buildInfo?: ExtractedBuildInfo;
}

/**
 * Universal Data Extractor Service
 */
export class DataExtractorService {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Extract all data from the project
     */
    async extractAll(): Promise<ExtractedData> {
        const [entryPoints, ports, healthChecks, environmentVars, ormCommands, buildInfo] = await Promise.all([
            this.extractEntryPoints(),
            this.extractPorts(),
            this.extractHealthChecks(),
            this.extractEnvironmentVars(),
            this.extractORMCommands(),
            this.extractBuildInfo()
        ]);

        return {
            entryPoints,
            ports,
            healthChecks,
            environmentVars,
            ormCommands,
            buildInfo
        };
    }

    /**
     * Extract entry points from various sources
     */
    async extractEntryPoints(): Promise<ExtractedEntryPoint[]> {
        const entryPoints: ExtractedEntryPoint[] = [];

        // Node.js: package.json "main" and "start" script
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const nodeEntry = await this.extractNodeEntryPoint(packageJsonPath);
            if (nodeEntry) {
                entryPoints.push(nodeEntry);
            }
        }

        // Python: __main__.py, main.py, app.py, or setup.py entry point
        const pythonEntry = await this.extractPythonEntryPoint();
        if (pythonEntry) {
            entryPoints.push(pythonEntry);
        }

        // Go: main package
        const goEntry = await this.extractGoEntryPoint();
        if (goEntry) {
            entryPoints.push(goEntry);
        }

        // Java: Main-Class from MANIFEST.MF or @SpringBootApplication
        const javaEntry = await this.extractJavaEntryPoint();
        if (javaEntry) {
            entryPoints.push(javaEntry);
        }

        // Rust: Cargo.toml [[bin]]
        const rustEntry = await this.extractRustEntryPoint();
        if (rustEntry) {
            entryPoints.push(rustEntry);
        }

        // Generic: Look for common entry point files
        if (entryPoints.length === 0) {
            const genericEntry = await this.findGenericEntryPoint();
            if (genericEntry) {
                entryPoints.push(genericEntry);
            }
        }

        return entryPoints;
    }

    /**
     * Extract Node.js entry point from package.json
     */
    private async extractNodeEntryPoint(packageJsonPath: string): Promise<ExtractedEntryPoint | null> {
        try {
            const content = fs.readFileSync(packageJsonPath, 'utf-8');
            const pkg = JSON.parse(content);

            // Check "start" script first (most reliable)
            if (pkg.scripts?.start) {
                const startScript = pkg.scripts.start;
                // Parse command: "node server.js", "ts-node src/index.ts", "nodemon app.js"
                const match = startScript.match(/(?:node|ts-node|nodemon|tsx)\s+([^\s]+)/);
                if (match) {
                    return {
                        file: match[1],
                        command: startScript,
                        confidence: 'high',
                        source: 'package.json'
                    };
                }
            }

            // Check "main" field
            if (pkg.main) {
                return {
                    file: pkg.main,
                    command: `node ${pkg.main}`,
                    confidence: 'high',
                    source: 'package.json'
                };
            }

            // Check "module" field (ES modules)
            if (pkg.module) {
                return {
                    file: pkg.module,
                    command: `node ${pkg.module}`,
                    confidence: 'medium',
                    source: 'package.json'
                };
            }

            // Check tsconfig for outDir + index
            const tsconfigPath = path.join(this.workspaceRoot, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
                const outDir = tsconfig.compilerOptions?.outDir || 'dist';
                return {
                    file: `${outDir}/index.js`,
                    command: `node ${outDir}/index.js`,
                    confidence: 'medium',
                    source: 'tsconfig'
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract Python entry point
     */
    private async extractPythonEntryPoint(): Promise<ExtractedEntryPoint | null> {
        const candidates = [
            '__main__.py',
            'main.py',
            'app.py',
            'server.py',
            'wsgi.py',
            'asgi.py',
            'manage.py'
        ];

        for (const candidate of candidates) {
            const fullPath = path.join(this.workspaceRoot, candidate);
            if (fs.existsSync(fullPath)) {
                // For Django
                if (candidate === 'manage.py') {
                    return {
                        file: candidate,
                        command: 'python manage.py runserver 0.0.0.0:8000',
                        confidence: 'high',
                        source: 'main.py'
                    };
                }

                // Check if it has if __name__ == '__main__'
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    if (content.includes('if __name__') || content.includes('.run(') || content.includes('uvicorn')) {
                        return {
                            file: candidate,
                            command: `python ${candidate}`,
                            confidence: 'high',
                            source: 'main.py'
                        };
                    }
                } catch (error) {
                    // Continue checking
                }
            }
        }

        // Check pyproject.toml or setup.py for entry point
        const pyprojectPath = path.join(this.workspaceRoot, 'pyproject.toml');
        if (fs.existsSync(pyprojectPath)) {
            try {
                const content = fs.readFileSync(pyprojectPath, 'utf-8');
                const scriptMatch = content.match(/\[tool\.poetry\.scripts\]\s*(\w+)\s*=/);
                if (scriptMatch) {
                    return {
                        file: 'pyproject.toml',
                        command: scriptMatch[1],
                        confidence: 'high',
                        source: 'main.py'
                    };
                }
            } catch (error) {
                // Continue
            }
        }

        return null;
    }

    /**
     * Extract Go entry point
     */
    private async extractGoEntryPoint(): Promise<ExtractedEntryPoint | null> {
        const goModPath = path.join(this.workspaceRoot, 'go.mod');
        if (!fs.existsSync(goModPath)) {
            return null;
        }

        // Look for main.go
        const candidates = ['main.go', 'cmd/main.go', 'cmd/server/main.go'];
        for (const candidate of candidates) {
            const fullPath = path.join(this.workspaceRoot, candidate);
            if (fs.existsSync(fullPath)) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    if (content.includes('package main') && content.includes('func main()')) {
                        const dir = path.dirname(candidate);
                        return {
                            file: candidate,
                            command: dir === '.' ? 'go run main.go' : `go run ${dir}`,
                            confidence: 'high',
                            source: 'inference'
                        };
                    }
                } catch (error) {
                    // Continue
                }
            }
        }

        return null;
    }

    /**
     * Extract Java entry point
     */
    private async extractJavaEntryPoint(): Promise<ExtractedEntryPoint | null> {
        // Look for Spring Boot application
        const srcPath = path.join(this.workspaceRoot, 'src');
        if (fs.existsSync(srcPath)) {
            const javaFiles = await this.findFilesRecursive(srcPath, /\.java$/);
            for (const file of javaFiles) {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    if (content.includes('@SpringBootApplication')) {
                        const relativePath = path.relative(this.workspaceRoot, file);
                        return {
                            file: relativePath,
                            command: 'java -jar app.jar',
                            confidence: 'high',
                            source: 'inference'
                        };
                    }
                    if (content.includes('public static void main')) {
                        const relativePath = path.relative(this.workspaceRoot, file);
                        return {
                            file: relativePath,
                            command: 'java -jar app.jar',
                            confidence: 'medium',
                            source: 'inference'
                        };
                    }
                } catch (error) {
                    // Continue
                }
            }
        }

        return null;
    }

    /**
     * Extract Rust entry point
     */
    private async extractRustEntryPoint(): Promise<ExtractedEntryPoint | null> {
        const cargoPath = path.join(this.workspaceRoot, 'Cargo.toml');
        if (!fs.existsSync(cargoPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(cargoPath, 'utf-8');
            // Look for [[bin]] section
            const binMatch = content.match(/\[\[bin\]\]\s*name\s*=\s*"([^"]+)"/);
            if (binMatch) {
                return {
                    file: 'src/main.rs',
                    command: `./target/release/${binMatch[1]}`,
                    confidence: 'high',
                    source: 'custom'
                };
            }

            // Default Rust binary
            if (fs.existsSync(path.join(this.workspaceRoot, 'src', 'main.rs'))) {
                const pkgMatch = content.match(/\[package\]\s*name\s*=\s*"([^"]+)"/);
                const pkgName = pkgMatch ? pkgMatch[1] : 'app';
                return {
                    file: 'src/main.rs',
                    command: `./target/release/${pkgName}`,
                    confidence: 'high',
                    source: 'inference'
                };
            }
        } catch (error) {
            // Continue
        }

        return null;
    }

    /**
     * Find generic entry point by common patterns
     */
    private async findGenericEntryPoint(): Promise<ExtractedEntryPoint | null> {
        const patterns = [
            { file: 'index.js', command: 'node index.js' },
            { file: 'index.ts', command: 'node dist/index.js' },
            { file: 'server.js', command: 'node server.js' },
            { file: 'app.js', command: 'node app.js' },
            { file: 'src/index.js', command: 'node src/index.js' },
            { file: 'src/server.js', command: 'node src/server.js' },
            { file: 'dist/index.js', command: 'node dist/index.js' }
        ];

        for (const pattern of patterns) {
            const fullPath = path.join(this.workspaceRoot, pattern.file);
            if (fs.existsSync(fullPath)) {
                return {
                    file: pattern.file,
                    command: pattern.command,
                    confidence: 'low',
                    source: 'inference'
                };
            }
        }

        return null;
    }

    /**
     * Extract ports from source code
     */
    async extractPorts(): Promise<ExtractedPort[]> {
        const ports: ExtractedPort[] = [];
        const seenPorts = new Set<number>();

        // Scan source files for port definitions
        const sourceFiles = await this.findSourceFiles();

        for (const file of sourceFiles) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    // Pattern: .listen(3000), app.run(port=8000), :8080, PORT=5000
                    const patterns = [
                        /\.listen\s*\(\s*(\d{4,5})/g,
                        /port\s*[=:]\s*(\d{4,5})/gi,
                        /PORT\s*=\s*(\d{4,5})/g,
                        /:(\d{4,5})(?!\d)/g,
                        /app\.run\([^)]*port\s*=\s*(\d{4,5})/g
                    ];

                    for (const pattern of patterns) {
                        let match;
                        while ((match = pattern.exec(line)) !== null) {
                            const port = parseInt(match[1]);
                            if (port >= 1024 && port <= 65535 && !seenPorts.has(port)) {
                                seenPorts.add(port);
                                ports.push({
                                    port,
                                    file: path.relative(this.workspaceRoot, file),
                                    line: index + 1,
                                    confidence: 'high'
                                });
                            }
                        }
                    }
                });
            } catch (error) {
                // Skip file
            }
        }

        // Check environment files for PORT
        const envFiles = ['.env', '.env.example', '.env.local'];
        for (const envFile of envFiles) {
            const envPath = path.join(this.workspaceRoot, envFile);
            if (fs.existsSync(envPath)) {
                try {
                    const content = fs.readFileSync(envPath, 'utf-8');
                    const match = content.match(/PORT\s*=\s*(\d{4,5})/);
                    if (match) {
                        const port = parseInt(match[1]);
                        if (!seenPorts.has(port)) {
                            seenPorts.add(port);
                            ports.push({
                                port,
                                file: envFile,
                                confidence: 'medium'
                            });
                        }
                    }
                } catch (error) {
                    // Skip
                }
            }
        }

        return ports;
    }

    /**
     * Extract health check endpoints
     */
    async extractHealthChecks(): Promise<ExtractedHealthCheck[]> {
        const healthChecks: ExtractedHealthCheck[] = [];
        const sourceFiles = await this.findSourceFiles();

        for (const file of sourceFiles) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line) => {
                    // Pattern: /health, /healthz, /ping, /ready, /livez
                    const healthPatterns = [
                        /['"`](\/health(?:z|check)?(?:\/.*)?)['"`]/gi,
                        /['"`](\/ping)['"`]/gi,
                        /['"`](\/ready)['"`]/gi,
                        /['"`](\/live(?:z|ness)?)['"`]/gi,
                        /@Get\(['"`](\/health.*?)['"`]\)/gi
                    ];

                    for (const pattern of healthPatterns) {
                        let match;
                        while ((match = pattern.exec(line)) !== null) {
                            const endpoint = match[1];
                            if (!healthChecks.some(h => h.endpoint === endpoint)) {
                                healthChecks.push({
                                    endpoint,
                                    method: 'GET',
                                    file: path.relative(this.workspaceRoot, file),
                                    confidence: 'high'
                                });
                            }
                        }
                    }
                });
            } catch (error) {
                // Skip file
            }
        }

        // Default fallback
        if (healthChecks.length === 0) {
            healthChecks.push({
                endpoint: '/health',
                method: 'GET',
                file: 'inferred',
                confidence: 'low'
            });
        }

        return healthChecks;
    }

    /**
     * Extract environment variables from source code
     */
    async extractEnvironmentVars(): Promise<ExtractedEnvironmentVar[]> {
        const envVars = new Map<string, ExtractedEnvironmentVar>();
        const sourceFiles = await this.findSourceFiles();

        for (const file of sourceFiles) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const lines = content.split('\n');

                lines.forEach((line) => {
                    // Pattern: process.env.VAR, os.getenv('VAR'), ENV['VAR']
                    const patterns = [
                        /process\.env\.(\w+)/g,
                        /os\.getenv\(['"`](\w+)['"`](?:,\s*['"`]([^'"`]+)['"`])?\)/g,
                        /ENV\[['"`](\w+)['"`]\]/g,
                        /\$\{(\w+)\}/g
                    ];

                    for (const pattern of patterns) {
                        let match;
                        while ((match = pattern.exec(line)) !== null) {
                            const varName = match[1];
                            const defaultValue = match[2];
                            
                            if (!envVars.has(varName)) {
                                envVars.set(varName, {
                                    name: varName,
                                    required: !defaultValue,
                                    defaultValue,
                                    files: []
                                });
                            }
                            
                            const envVar = envVars.get(varName)!;
                            const relativePath = path.relative(this.workspaceRoot, file);
                            if (!envVar.files.includes(relativePath)) {
                                envVar.files.push(relativePath);
                            }
                        }
                    }
                });
            } catch (error) {
                // Skip file
            }
        }

        // Also check .env.example for documentation
        const envExamplePath = path.join(this.workspaceRoot, '.env.example');
        if (fs.existsSync(envExamplePath)) {
            try {
                const content = fs.readFileSync(envExamplePath, 'utf-8');
                const lines = content.split('\n');
                
                lines.forEach((line) => {
                    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
                    if (match) {
                        const varName = match[1];
                        const value = match[2].trim();
                        
                        if (!envVars.has(varName)) {
                            envVars.set(varName, {
                                name: varName,
                                required: false,
                                defaultValue: value,
                                files: ['.env.example']
                            });
                        }
                    }
                });
            } catch (error) {
                // Skip
            }
        }

        return Array.from(envVars.values());
    }

    /**
     * Extract ORM commands
     */
    async extractORMCommands(): Promise<ExtractedORMCommand[]> {
        const commands: ExtractedORMCommand[] = [];

        // Prisma
        const prismaPath = path.join(this.workspaceRoot, 'prisma', 'schema.prisma');
        if (fs.existsSync(prismaPath)) {
            commands.push({
                framework: 'prisma',
                migrateCommand: 'npx prisma migrate deploy',
                generateCommand: 'npx prisma generate',
                seedCommand: 'npx prisma db seed'
            });
        }

        // Django
        const managePyPath = path.join(this.workspaceRoot, 'manage.py');
        if (fs.existsSync(managePyPath)) {
            commands.push({
                framework: 'django',
                migrateCommand: 'python manage.py migrate',
                seedCommand: 'python manage.py loaddata'
            });
        }

        // Alembic
        const alembicPath = path.join(this.workspaceRoot, 'alembic.ini');
        if (fs.existsSync(alembicPath)) {
            commands.push({
                framework: 'alembic',
                migrateCommand: 'alembic upgrade head'
            });
        }

        // TypeORM
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const content = fs.readFileSync(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content);
                if (pkg.dependencies?.typeorm || pkg.devDependencies?.typeorm) {
                    commands.push({
                        framework: 'typeorm',
                        migrateCommand: 'npm run typeorm migration:run'
                    });
                }
            } catch (error) {
                // Skip
            }
        }

        return commands;
    }

    /**
     * Extract build info
     */
    async extractBuildInfo(): Promise<ExtractedBuildInfo | undefined> {
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        
        if (fs.existsSync(packageJsonPath)) {
            try {
                const content = fs.readFileSync(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(content);

                if (pkg.scripts?.build) {
                    const buildCommand = pkg.scripts.build;
                    
                    // Infer output folder from common patterns
                    let outputFolder = 'dist';
                    if (buildCommand.includes('next build')) {
                        outputFolder = '.next';
                    } else if (buildCommand.includes('nuxt build')) {
                        outputFolder = '.output';
                    } else if (buildCommand.includes('vite build')) {
                        outputFolder = 'dist';
                    } else if (buildCommand.includes('react-scripts build')) {
                        outputFolder = 'build';
                    }

                    return {
                        buildCommand,
                        outputFolder,
                        cleanCommand: pkg.scripts?.clean,
                        confidence: 'high'
                    };
                }
            } catch (error) {
                // Continue
            }
        }

        return undefined;
    }

    /**
     * Find all source files in the project
     */
    private async findSourceFiles(): Promise<string[]> {
        const sourceFiles: string[] = [];
        const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rs', '.php', '.rb'];
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '__pycache__', 'target', 'vendor'];

        const scanDir = (dir: string) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    
                    if (entry.isDirectory()) {
                        if (!ignoreDirs.includes(entry.name) && !entry.name.startsWith('.')) {
                            scanDir(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (extensions.includes(ext)) {
                            sourceFiles.push(fullPath);
                        }
                    }
                }
            } catch (error) {
                // Skip directory
            }
        };

        scanDir(this.workspaceRoot);
        return sourceFiles.slice(0, 200); // Limit for performance
    }

    /**
     * Find files recursively with pattern
     */
    private async findFilesRecursive(dir: string, pattern: RegExp): Promise<string[]> {
        const results: string[] = [];
        
        const scanDir = (currentDir: string) => {
            try {
                const entries = fs.readdirSync(currentDir, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(currentDir, entry.name);
                    
                    if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        scanDir(fullPath);
                    } else if (entry.isFile() && pattern.test(entry.name)) {
                        results.push(fullPath);
                    }
                }
            } catch (error) {
                // Skip
            }
        };

        scanDir(dir);
        return results;
    }
}
