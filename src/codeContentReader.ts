import * as vscode from 'vscode';
import * as path from 'path';

export interface APIRoute {
    method: string;
    path: string;
    file: string;
    line: number;
}

export interface EnvVarUsage {
    name: string;
    file: string;
    required: boolean;
    defaultValue?: string;
}

export interface DBConnection {
    type: string; // 'mongoose', 'typeorm', 'prisma', 'pymongo', etc.
    file: string;
    schema?: string;
}

export interface CodeAnalysis {
    imports: string[];
    exports: string[];
    apiEndpoints: APIRoute[];
    ports: number[];
    environmentVars: EnvVarUsage[];
    databaseConnections: DBConnection[];
    buildCommands: string[];
    entryPoints: string[];
}

export class CodeContentReader {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Analyze source files by reading their actual content
     */
    async analyzeSourceFiles(files: string[]): Promise<CodeAnalysis> {
        const analysis: CodeAnalysis = {
            imports: [],
            exports: [],
            apiEndpoints: [],
            ports: [],
            environmentVars: [],
            databaseConnections: [],
            buildCommands: [],
            entryPoints: []
        };

        for (const file of files) {
            const fullPath = path.join(this.workspaceRoot, file);
            const ext = path.extname(file);

            try {
                const uri = vscode.Uri.file(fullPath);
                const content = await vscode.workspace.fs.readFile(uri);
                const text = content.toString();

                // Analyze based on file type
                if (ext === '.js' || ext === '.ts' || ext === '.mjs' || ext === '.cjs') {
                    this.analyzeJavaScriptFile(text, file, analysis);
                } else if (ext === '.py') {
                    this.analyzePythonFile(text, file, analysis);
                } else if (file === 'package.json') {
                    this.analyzePackageJson(text, analysis);
                }
            } catch (error) {
                // File might not exist or be readable, skip it
                continue;
            }
        }

        // Remove duplicates
        analysis.imports = [...new Set(analysis.imports)];
        analysis.exports = [...new Set(analysis.exports)];
        analysis.ports = [...new Set(analysis.ports)];

        return analysis;
    }

    /**
     * Analyze JavaScript/TypeScript files
     */
    private analyzeJavaScriptFile(content: string, file: string, analysis: CodeAnalysis): void {
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Extract Express/Fastify routes
            const routeMatch = trimmed.match(/app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
            if (routeMatch) {
                analysis.apiEndpoints.push({
                    method: routeMatch[1].toUpperCase(),
                    path: routeMatch[2],
                    file: file,
                    line: index + 1
                });
            }

            // Extract router routes
            const routerMatch = trimmed.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
            if (routerMatch) {
                analysis.apiEndpoints.push({
                    method: routerMatch[1].toUpperCase(),
                    path: routerMatch[2],
                    file: file,
                    line: index + 1
                });
            }

            // Extract ports
            const portMatch = trimmed.match(/(?:PORT|port)\s*[=:]\s*(?:process\.env\.\w+\s*\|\|\s*)?(\d+)/);
            if (portMatch) {
                analysis.ports.push(parseInt(portMatch[1]));
            }

            // Extract app.listen port
            const listenMatch = trimmed.match(/\.listen\s*\(\s*(\d+)/);
            if (listenMatch) {
                analysis.ports.push(parseInt(listenMatch[1]));
            }

            // Extract environment variables
            const envMatch = trimmed.match(/process\.env\.(\w+)/g);
            if (envMatch) {
                envMatch.forEach(match => {
                    const varName = match.replace('process.env.', '');
                    if (!analysis.environmentVars.find(v => v.name === varName)) {
                        // Check if it has a default value
                        const defaultMatch = line.match(new RegExp(`process\\.env\\.${varName}\\s*\\|\\|\\s*['"\`]([^'"\`]+)['"\`]`));
                        analysis.environmentVars.push({
                            name: varName,
                            file: file,
                            required: !defaultMatch,
                            defaultValue: defaultMatch ? defaultMatch[1] : undefined
                        });
                    }
                });
            }

            // Extract database connections
            if (trimmed.includes('mongoose.connect') || trimmed.includes('mongoose.createConnection')) {
                analysis.databaseConnections.push({
                    type: 'mongoose',
                    file: file
                });
            }

            if (trimmed.includes('createConnection') && (content.includes('typeorm') || content.includes('@typeorm'))) {
                analysis.databaseConnections.push({
                    type: 'typeorm',
                    file: file
                });
            }

            if (trimmed.includes('PrismaClient')) {
                analysis.databaseConnections.push({
                    type: 'prisma',
                    file: file
                });
            }

            // Detect entry points
            if (file.includes('index.js') || file.includes('main.js') || file.includes('server.js') ||
                file.includes('index.ts') || file.includes('main.ts') || file.includes('server.ts') ||
                trimmed.includes('app.listen')) {
                if (!analysis.entryPoints.includes(file)) {
                    analysis.entryPoints.push(file);
                }
            }
        });
    }

    /**
     * Analyze Python files
     */
    private analyzePythonFile(content: string, file: string, analysis: CodeAnalysis): void {
        const lines = content.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();

            // Extract Flask routes
            const flaskMatch = trimmed.match(/@app\.route\s*\(\s*['"]([^'"]+)['"]\s*,?\s*methods\s*=\s*\[['"](\w+)['"]\]/);
            if (flaskMatch) {
                analysis.apiEndpoints.push({
                    method: flaskMatch[2].toUpperCase(),
                    path: flaskMatch[1],
                    file: file,
                    line: index + 1
                });
            }

            // Simple Flask route
            const simpleFlaskMatch = trimmed.match(/@app\.route\s*\(\s*['"]([^'"]+)['"]\)/);
            if (simpleFlaskMatch) {
                analysis.apiEndpoints.push({
                    method: 'GET',
                    path: simpleFlaskMatch[1],
                    file: file,
                    line: index + 1
                });
            }

            // FastAPI routes
            const fastAPIMatch = trimmed.match(/@app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]\)/);
            if (fastAPIMatch) {
                analysis.apiEndpoints.push({
                    method: fastAPIMatch[1].toUpperCase(),
                    path: fastAPIMatch[2],
                    file: file,
                    line: index + 1
                });
            }

            // Extract ports
            const portMatch = trimmed.match(/(?:port|PORT)\s*=\s*(?:int\()?(?:os\.getenv\([^)]+\)\s*or\s*)?(\d+)/);
            if (portMatch) {
                analysis.ports.push(parseInt(portMatch[1]));
            }

            // app.run port
            const runMatch = trimmed.match(/app\.run\s*\([^)]*port\s*=\s*(\d+)/);
            if (runMatch) {
                analysis.ports.push(parseInt(runMatch[1]));
            }

            // Extract environment variables
            const envMatch = trimmed.match(/os\.getenv\s*\(\s*['"](\w+)['"]/g);
            if (envMatch) {
                envMatch.forEach(match => {
                    const varMatch = match.match(/['"](\w+)['"]/);
                    if (varMatch) {
                        const varName = varMatch[1];
                        if (!analysis.environmentVars.find(v => v.name === varName)) {
                            analysis.environmentVars.push({
                                name: varName,
                                file: file,
                                required: !line.includes(',')  // Has default if comma present
                            });
                        }
                    }
                });
            }

            // Detect entry points
            if (file.includes('app.py') || file.includes('main.py') || file.includes('wsgi.py') ||
                trimmed.includes('if __name__ == "__main__"')) {
                if (!analysis.entryPoints.includes(file)) {
                    analysis.entryPoints.push(file);
                }
            }
        });
    }

    /**
     * Analyze package.json for build commands
     */
    private analyzePackageJson(content: string, analysis: CodeAnalysis): void {
        try {
            const pkg = JSON.parse(content);

            if (pkg.scripts) {
                // Extract build-related scripts
                Object.keys(pkg.scripts).forEach(scriptName => {
                    if (scriptName.includes('build') || scriptName.includes('compile')) {
                        analysis.buildCommands.push(pkg.scripts[scriptName]);
                    }
                });

                // Detect entry point from start script
                if (pkg.scripts.start) {
                    const startCommand = pkg.scripts.start;
                    const fileMatch = startCommand.match(/(?:node|ts-node|tsx)\s+([^\s]+)/);
                    if (fileMatch && !analysis.entryPoints.includes(fileMatch[1])) {
                        analysis.entryPoints.push(fileMatch[1]);
                    }
                }
            }

            // Extract main entry point
            if (pkg.main && !analysis.entryPoints.includes(pkg.main)) {
                analysis.entryPoints.push(pkg.main);
            }
        } catch (error) {
            // Invalid JSON, skip
        }
    }

    /**
     * Get summary of code analysis for logging
     */
    getSummary(analysis: CodeAnalysis): string {
        return `
Code Analysis Summary:
- API Endpoints: ${analysis.apiEndpoints.length}
- Detected Ports: ${analysis.ports.join(', ') || 'None'}
- Environment Variables: ${analysis.environmentVars.length}
- Database Connections: ${analysis.databaseConnections.length}
- Entry Points: ${analysis.entryPoints.join(', ')}
        `.trim();
    }
}
