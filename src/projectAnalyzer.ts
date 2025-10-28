import * as vscode from 'vscode';
import * as path from 'path';

export interface ProjectStructure {
    projectType: string;
    frontend?: string;
    backend?: string;
    database?: string;
    files: string[];
    dependencies: { [key: string]: any };
    hasMultiStage: boolean;
    description: string;
}

export class ProjectAnalyzer {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async analyzeProject(): Promise<ProjectStructure> {
        const files = await this.getProjectFiles();
        const packageInfo = await this.analyzePackageFiles();
        const projectType = this.detectProjectType(files, packageInfo);
        
        return {
            projectType: projectType.type,
            frontend: projectType.frontend,
            backend: projectType.backend,
            database: projectType.database,
            files: files.slice(0, 50), // Limit files for LLM context
            dependencies: packageInfo,
            hasMultiStage: this.shouldUseMultiStage(projectType),
            description: this.generateProjectDescription(projectType, files)
        };
    }

    private async getProjectFiles(): Promise<string[]> {
        if (!vscode.workspace.workspaceFolders) {
            return [];
        }

        const files: string[] = [];
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        
        try {
            // Get important files first
            const patterns = [
                '*.json',
                '*.js',
                '*.ts',
                '*.py',
                '*.md',
                '*.yml',
                '*.yaml',
                '*.txt',
                '*.lock',
                'Dockerfile*',
                'docker-compose*'
            ];

            for (const pattern of patterns) {
                const foundFiles = await vscode.workspace.findFiles(
                    new vscode.RelativePattern(workspaceFolder, `**/${pattern}`),
                    '**/node_modules/**',
                    100
                );
                files.push(...foundFiles.map(uri => 
                    path.relative(this.workspaceRoot, uri.fsPath).replace(/\\/g, '/')
                ));
            }

            return [...new Set(files)].sort();
        } catch (error) {
            console.error('Error getting project files:', error);
            return [];
        }
    }

    private async analyzePackageFiles(): Promise<{ [key: string]: any }> {
        const packageInfo: { [key: string]: any } = {};

        try {
            // Check for package.json (Node.js)
            const packageJsonUri = vscode.Uri.file(path.join(this.workspaceRoot, 'package.json'));
            try {
                const packageContent = await vscode.workspace.fs.readFile(packageJsonUri);
                packageInfo.packageJson = JSON.parse(packageContent.toString());
            } catch {}

            // Check for requirements.txt (Python)
            const requirementsUri = vscode.Uri.file(path.join(this.workspaceRoot, 'requirements.txt'));
            try {
                const requirementsContent = await vscode.workspace.fs.readFile(requirementsUri);
                packageInfo.requirementsTxt = requirementsContent.toString();
            } catch {}

            // Check for pom.xml (Java Maven)
            const pomUri = vscode.Uri.file(path.join(this.workspaceRoot, 'pom.xml'));
            try {
                const pomContent = await vscode.workspace.fs.readFile(pomUri);
                packageInfo.pomXml = pomContent.toString();
            } catch {}

            // Check for Gemfile (Ruby)
            const gemfileUri = vscode.Uri.file(path.join(this.workspaceRoot, 'Gemfile'));
            try {
                const gemfileContent = await vscode.workspace.fs.readFile(gemfileUri);
                packageInfo.gemfile = gemfileContent.toString();
            } catch {}

            // Check for go.mod (Go)
            const goModUri = vscode.Uri.file(path.join(this.workspaceRoot, 'go.mod'));
            try {
                const goModContent = await vscode.workspace.fs.readFile(goModUri);
                packageInfo.goMod = goModContent.toString();
            } catch {}

        } catch (error) {
            console.error('Error analyzing package files:', error);
        }

        return packageInfo;
    }

    private detectProjectType(files: string[], packageInfo: { [key: string]: any }): any {
        const result = {
            type: 'unknown',
            frontend: undefined as string | undefined,
            backend: undefined as string | undefined,
            database: undefined as string | undefined
        };

        // Check for specific frameworks and languages
        if (packageInfo.packageJson) {
            const pkg = packageInfo.packageJson;
            const deps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Frontend frameworks
            if (deps.react || deps['@types/react']) {
                result.frontend = 'react';
            } else if (deps.vue || deps['@vue/cli']) {
                result.frontend = 'vue';
            } else if (deps['@angular/core']) {
                result.frontend = 'angular';
            } else if (deps.next) {
                result.frontend = 'nextjs';
                result.type = 'fullstack';
            } else if (deps.nuxt) {
                result.frontend = 'nuxt';
                result.type = 'fullstack';
            }

            // Backend frameworks
            if (deps.express) {
                result.backend = 'express';
            } else if (deps.fastify) {
                result.backend = 'fastify';
            } else if (deps.nestjs || deps['@nestjs/core']) {
                result.backend = 'nestjs';
            }

            // Database detection
            if (deps.mongoose || deps.mongodb) {
                result.database = 'mongodb';
            } else if (deps.pg || deps.postgresql) {
                result.database = 'postgresql';
            } else if (deps.mysql || deps.mysql2) {
                result.database = 'mysql';
            }
        }

        // Python frameworks
        if (packageInfo.requirementsTxt) {
            const requirements = packageInfo.requirementsTxt.toLowerCase();
            if (requirements.includes('django')) {
                result.backend = 'django';
                result.type = 'backend';
            } else if (requirements.includes('flask')) {
                result.backend = 'flask';
                result.type = 'backend';
            } else if (requirements.includes('fastapi')) {
                result.backend = 'fastapi';
                result.type = 'backend';
            }
        }

        // Java frameworks
        if (packageInfo.pomXml) {
            const pom = packageInfo.pomXml.toLowerCase();
            if (pom.includes('spring-boot')) {
                result.backend = 'spring-boot';
                result.type = 'backend';
            }
        }

        // Go detection
        if (packageInfo.goMod) {
            result.backend = 'go';
            result.type = 'backend';
        }

        // Determine overall project type
        if (result.type === 'unknown') {
            if (result.frontend && result.backend) {
                result.type = 'fullstack';
            } else if (result.frontend) {
                result.type = 'frontend';
            } else if (result.backend) {
                result.type = 'backend';
            } else {
                // Try to infer from file structure
                const hasPublicFolder = files.some(f => f.startsWith('public/') || f.startsWith('static/'));
                const hasSrcFolder = files.some(f => f.startsWith('src/'));
                const hasServerFiles = files.some(f => 
                    f.includes('server') || f.includes('api') || f.includes('routes')
                );

                if (hasPublicFolder && hasSrcFolder) {
                    result.type = 'frontend';
                } else if (hasServerFiles) {
                    result.type = 'backend';
                } else {
                    result.type = 'static';
                }
            }
        }

        return result;
    }

    private shouldUseMultiStage(projectType: any): boolean {
        // Use multi-stage for production builds
        return projectType.type === 'fullstack' || 
               projectType.frontend === 'react' || 
               projectType.frontend === 'angular' || 
               projectType.frontend === 'vue' ||
               projectType.backend === 'nestjs' ||
               projectType.backend === 'spring-boot';
    }

    private generateProjectDescription(projectType: any, files: string[]): string {
        let description = `This is a ${projectType.type} project`;
        
        if (projectType.frontend) {
            description += ` with ${projectType.frontend} frontend`;
        }
        
        if (projectType.backend) {
            description += ` and ${projectType.backend} backend`;
        }
        
        if (projectType.database) {
            description += ` using ${projectType.database} database`;
        }
        
        description += `. Key files include: ${files.slice(0, 10).join(', ')}`;
        
        return description;
    }
}