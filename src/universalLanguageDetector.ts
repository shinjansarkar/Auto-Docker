/**
 * Universal Language Detector
 * Detects ANY programming language and tech stack by analyzing file patterns and build configs
 * No hardcoded assumptions - fully extensible for unknown languages
 */

import * as fs from 'fs';
import * as path from 'path';

export interface LanguageInfo {
    language: string;
    version?: string;
    buildTool?: string;
    packageManager?: string;
    configFile?: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface BaseImageInfo {
    image: string;
    version: string;
    confidence: 'high' | 'medium' | 'low';
}

export interface GenericDockerPattern {
    language: string;
    baseImage: string;
    installCommand?: string;
    buildCommand?: string;
    runCommand?: string;
    packageFiles: string[];
    outputFolder?: string;
}

export interface UniversalDetectionResult {
    languages: LanguageInfo[];
    primaryLanguage: LanguageInfo | null;
    baseImage: BaseImageInfo | null;
    genericPattern: GenericDockerPattern | null;
    isKnownStack: boolean;
}

/**
 * Universal Language Detector
 */
export class UniversalLanguageDetector {
    private basePath: string;

    // Language signature definitions - extensible
    private readonly LANGUAGE_SIGNATURES = [
        // JavaScript/TypeScript
        {
            language: 'javascript',
            extensions: ['.js', '.mjs', '.cjs'],
            configFiles: ['package.json', 'package-lock.json'],
            buildTools: ['npm', 'yarn', 'pnpm', 'bun'],
            baseImages: ['node:20-alpine', 'node:18-alpine', 'node:lts-alpine']
        },
        {
            language: 'typescript',
            extensions: ['.ts', '.tsx'],
            configFiles: ['tsconfig.json', 'package.json'],
            buildTools: ['npm', 'yarn', 'pnpm', 'tsc'],
            baseImages: ['node:20-alpine', 'node:18-alpine']
        },
        // Python
        {
            language: 'python',
            extensions: ['.py'],
            configFiles: ['requirements.txt', 'pyproject.toml', 'setup.py', 'Pipfile', 'poetry.lock'],
            buildTools: ['pip', 'poetry', 'pipenv', 'conda'],
            baseImages: ['python:3.12-slim', 'python:3.11-slim', 'python:3.10-slim']
        },
        // Go
        {
            language: 'go',
            extensions: ['.go'],
            configFiles: ['go.mod', 'go.sum'],
            buildTools: ['go'],
            baseImages: ['golang:1.22-alpine', 'golang:1.21-alpine']
        },
        // Rust
        {
            language: 'rust',
            extensions: ['.rs'],
            configFiles: ['Cargo.toml', 'Cargo.lock'],
            buildTools: ['cargo'],
            baseImages: ['rust:1.75-alpine', 'rust:1.74-alpine']
        },
        // Java
        {
            language: 'java',
            extensions: ['.java'],
            configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle'],
            buildTools: ['maven', 'gradle'],
            baseImages: ['eclipse-temurin:21-jdk-alpine', 'eclipse-temurin:17-jdk-alpine']
        },
        // Kotlin
        {
            language: 'kotlin',
            extensions: ['.kt', '.kts'],
            configFiles: ['build.gradle.kts', 'pom.xml'],
            buildTools: ['gradle', 'maven'],
            baseImages: ['eclipse-temurin:21-jdk-alpine', 'gradle:8-jdk21-alpine']
        },
        // C#/.NET
        {
            language: 'csharp',
            extensions: ['.cs'],
            configFiles: ['.csproj', '.sln', 'project.json'],
            buildTools: ['dotnet'],
            baseImages: ['mcr.microsoft.com/dotnet/sdk:8.0', 'mcr.microsoft.com/dotnet/sdk:7.0']
        },
        // PHP
        {
            language: 'php',
            extensions: ['.php'],
            configFiles: ['composer.json', 'composer.lock'],
            buildTools: ['composer'],
            baseImages: ['php:8.3-fpm-alpine', 'php:8.2-fpm-alpine']
        },
        // Ruby
        {
            language: 'ruby',
            extensions: ['.rb'],
            configFiles: ['Gemfile', 'Gemfile.lock', '.ruby-version'],
            buildTools: ['bundle', 'gem'],
            baseImages: ['ruby:3.3-alpine', 'ruby:3.2-alpine']
        },
        // Elixir
        {
            language: 'elixir',
            extensions: ['.ex', '.exs'],
            configFiles: ['mix.exs', 'mix.lock'],
            buildTools: ['mix'],
            baseImages: ['elixir:1.16-alpine', 'elixir:1.15-alpine']
        },
        // Swift
        {
            language: 'swift',
            extensions: ['.swift'],
            configFiles: ['Package.swift', 'Package.resolved'],
            buildTools: ['swift'],
            baseImages: ['swift:5.9', 'swift:5.8']
        },
        // Scala
        {
            language: 'scala',
            extensions: ['.scala'],
            configFiles: ['build.sbt', 'project/build.properties'],
            buildTools: ['sbt', 'mill'],
            baseImages: ['hseeberger/scala-sbt:11.0.15_1.7.1_3.2.0']
        },
        // Dart
        {
            language: 'dart',
            extensions: ['.dart'],
            configFiles: ['pubspec.yaml', 'pubspec.lock'],
            buildTools: ['pub', 'dart'],
            baseImages: ['dart:stable', 'dart:3.2']
        },
        // Haskell
        {
            language: 'haskell',
            extensions: ['.hs'],
            configFiles: ['stack.yaml', 'cabal.project', 'package.yaml'],
            buildTools: ['stack', 'cabal'],
            baseImages: ['haskell:9.4', 'haskell:9.2']
        },
        // OCaml
        {
            language: 'ocaml',
            extensions: ['.ml', '.mli'],
            configFiles: ['dune-project', 'opam'],
            buildTools: ['dune', 'opam'],
            baseImages: ['ocaml/opam:alpine', 'ocaml/opam:ubuntu']
        },
        // Zig
        {
            language: 'zig',
            extensions: ['.zig'],
            configFiles: ['build.zig'],
            buildTools: ['zig'],
            baseImages: ['alpine:latest']
        },
        // Lua
        {
            language: 'lua',
            extensions: ['.lua'],
            configFiles: ['rockspec'],
            buildTools: ['luarocks'],
            baseImages: ['alpine:latest']
        },
        // R
        {
            language: 'r',
            extensions: ['.r', '.R'],
            configFiles: ['DESCRIPTION', 'renv.lock'],
            buildTools: ['renv'],
            baseImages: ['r-base:latest']
        },
        // Julia
        {
            language: 'julia',
            extensions: ['.jl'],
            configFiles: ['Project.toml', 'Manifest.toml'],
            buildTools: ['Pkg'],
            baseImages: ['julia:1.10', 'julia:1.9']
        },
        // C/C++
        {
            language: 'c',
            extensions: ['.c', '.h'],
            configFiles: ['Makefile', 'CMakeLists.txt'],
            buildTools: ['make', 'cmake', 'gcc'],
            baseImages: ['gcc:13-alpine', 'gcc:12-alpine']
        },
        {
            language: 'cpp',
            extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
            configFiles: ['Makefile', 'CMakeLists.txt', 'meson.build'],
            buildTools: ['make', 'cmake', 'g++', 'clang++', 'meson'],
            baseImages: ['gcc:13-alpine', 'gcc:12-alpine']
        }
    ];

    constructor(basePath: string) {
        this.basePath = basePath;
    }

    /**
     * Detect all languages and tech stacks in the project
     */
    async detect(): Promise<UniversalDetectionResult> {
        const languages = await this.detectLanguages();
        const primaryLanguage = this.determinePrimaryLanguage(languages);
        const baseImage = primaryLanguage ? this.selectBaseImage(primaryLanguage) : null;
        const genericPattern = primaryLanguage ? await this.generateGenericPattern(primaryLanguage) : null;
        const isKnownStack = this.isKnownTechStack(languages);

        return {
            languages,
            primaryLanguage,
            baseImage,
            genericPattern,
            isKnownStack
        };
    }

    /**
     * Detect all languages in the project
     */
    private async detectLanguages(): Promise<LanguageInfo[]> {
        const detectedLanguages: LanguageInfo[] = [];
        const languageCounts = new Map<string, number>();

        // Scan for config files (highest confidence)
        for (const signature of this.LANGUAGE_SIGNATURES) {
            for (const configFile of signature.configFiles) {
                const fullPath = path.join(this.basePath, configFile);
                if (fs.existsSync(fullPath)) {
                    const version = await this.extractVersion(configFile, signature.language);
                    const buildTool = await this.detectBuildTool(signature);
                    
                    detectedLanguages.push({
                        language: signature.language,
                        version,
                        buildTool,
                        packageManager: signature.buildTools[0],
                        configFile,
                        confidence: 'high'
                    });

                    languageCounts.set(signature.language, (languageCounts.get(signature.language) || 0) + 10);
                    break; // Found config, no need to check other config files for this language
                }
            }
        }

        // Scan for source files (medium confidence)
        const fileExtensions = await this.scanFileExtensions();
        
        for (const signature of this.LANGUAGE_SIGNATURES) {
            for (const ext of signature.extensions) {
                if (fileExtensions.has(ext)) {
                    const count = fileExtensions.get(ext)!;
                    languageCounts.set(signature.language, (languageCounts.get(signature.language) || 0) + count);
                    
                    // Only add if not already detected by config file
                    if (!detectedLanguages.some(l => l.language === signature.language)) {
                        detectedLanguages.push({
                            language: signature.language,
                            buildTool: signature.buildTools[0],
                            packageManager: signature.buildTools[0],
                            confidence: 'medium'
                        });
                    }
                }
            }
        }

        // Detect unknown languages by unique extensions
        for (const [ext, count] of fileExtensions.entries()) {
            const isKnown = this.LANGUAGE_SIGNATURES.some(sig => sig.extensions.includes(ext));
            if (!isKnown && count > 3) {
                detectedLanguages.push({
                    language: `unknown-${ext.substring(1)}`,
                    confidence: 'low'
                });
            }
        }

        return detectedLanguages;
    }

    /**
     * Scan project for file extensions
     */
    private async scanFileExtensions(): Promise<Map<string, number>> {
        const extensions = new Map<string, number>();
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
                        const ext = path.extname(entry.name).toLowerCase();
                        if (ext) {
                            extensions.set(ext, (extensions.get(ext) || 0) + 1);
                        }
                    }
                }
            } catch (error) {
                // Skip directory
            }
        };

        scanDir(this.basePath);
        return extensions;
    }

    /**
     * Extract version from config files
     */
    private async extractVersion(configFile: string, language: string): Promise<string | undefined> {
        const fullPath = path.join(this.basePath, configFile);
        
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');

            switch (configFile) {
                case 'package.json':
                    const pkg = JSON.parse(content);
                    return pkg.engines?.node;
                
                case '.ruby-version':
                    return content.trim();
                
                case 'go.mod':
                    const goMatch = content.match(/go\s+(\d+\.\d+)/);
                    return goMatch ? goMatch[1] : undefined;
                
                case 'Cargo.toml':
                    const rustMatch = content.match(/rust-version\s*=\s*"([^"]+)"/);
                    return rustMatch ? rustMatch[1] : undefined;
                
                case 'pyproject.toml':
                    const pythonMatch = content.match(/python\s*=\s*"([^"]+)"/);
                    return pythonMatch ? pythonMatch[1] : undefined;
                
                default:
                    return undefined;
            }
        } catch (error) {
            return undefined;
        }
    }

    /**
     * Detect build tool from signature
     */
    private async detectBuildTool(signature: any): Promise<string | undefined> {
        for (const tool of signature.buildTools) {
            // Check for tool-specific indicators
            const indicators: { [key: string]: string[] } = {
                'yarn': ['yarn.lock'],
                'pnpm': ['pnpm-lock.yaml'],
                'maven': ['pom.xml'],
                'gradle': ['build.gradle', 'build.gradle.kts'],
                'poetry': ['poetry.lock'],
                'pipenv': ['Pipfile.lock'],
                'cargo': ['Cargo.lock'],
                'go': ['go.mod']
            };

            const files = indicators[tool];
            if (files) {
                for (const file of files) {
                    if (fs.existsSync(path.join(this.basePath, file))) {
                        return tool;
                    }
                }
            }
        }

        return signature.buildTools[0];
    }

    /**
     * Determine primary language (most files/highest priority)
     */
    private determinePrimaryLanguage(languages: LanguageInfo[]): LanguageInfo | null {
        if (languages.length === 0) {
            return null;
        }

        // Prioritize high confidence languages
        const highConfidence = languages.filter(l => l.confidence === 'high');
        if (highConfidence.length > 0) {
            return highConfidence[0];
        }

        return languages[0];
    }

    /**
     * Select appropriate base Docker image
     */
    private selectBaseImage(language: LanguageInfo): BaseImageInfo | null {
        const signature = this.LANGUAGE_SIGNATURES.find(s => s.language === language.language);
        
        if (!signature) {
            // Unknown language - use Alpine as base
            return {
                image: 'alpine',
                version: 'latest',
                confidence: 'low'
            };
        }

        const baseImage = signature.baseImages[0];
        const [image, version] = baseImage.split(':');

        return {
            image,
            version: version || 'latest',
            confidence: language.confidence
        };
    }

    /**
     * Generate generic Dockerfile pattern for any language
     */
    private async generateGenericPattern(language: LanguageInfo): Promise<GenericDockerPattern | null> {
        const signature = this.LANGUAGE_SIGNATURES.find(s => s.language === language.language);
        
        if (!signature) {
            return null;
        }

        // Build generic pattern based on language
        const pattern: GenericDockerPattern = {
            language: language.language,
            baseImage: signature.baseImages[0],
            packageFiles: signature.configFiles,
            installCommand: this.getGenericInstallCommand(language.language, language.buildTool),
            buildCommand: this.getGenericBuildCommand(language.language, language.buildTool),
            runCommand: this.getGenericRunCommand(language.language),
            outputFolder: this.getGenericOutputFolder(language.language)
        };

        return pattern;
    }

    /**
     * Get generic install command for language
     */
    private getGenericInstallCommand(language: string, buildTool?: string): string {
        const commands: { [key: string]: string } = {
            'javascript': buildTool === 'yarn' ? 'yarn install --frozen-lockfile' : buildTool === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci',
            'typescript': buildTool === 'yarn' ? 'yarn install --frozen-lockfile' : buildTool === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci',
            'python': buildTool === 'poetry' ? 'poetry install --no-dev' : buildTool === 'pipenv' ? 'pipenv install --deploy' : 'pip install --no-cache-dir -r requirements.txt',
            'go': 'go mod download',
            'rust': 'cargo build --release',
            'java': buildTool === 'maven' ? 'mvn clean install' : 'gradle build',
            'kotlin': buildTool === 'maven' ? 'mvn clean install' : 'gradle build',
            'csharp': 'dotnet restore',
            'php': 'composer install --no-dev --optimize-autoloader',
            'ruby': 'bundle install --without development test',
            'elixir': 'mix deps.get',
            'swift': 'swift package resolve',
            'scala': 'sbt compile',
            'dart': 'pub get',
            'haskell': buildTool === 'stack' ? 'stack build' : 'cabal build',
            'ocaml': 'opam install . --deps-only',
            'zig': 'zig build'
        };

        return commands[language] || 'echo "No install command"';
    }

    /**
     * Get generic build command for language
     */
    private getGenericBuildCommand(language: string, buildTool?: string): string {
        const commands: { [key: string]: string } = {
            'javascript': 'npm run build',
            'typescript': 'npm run build',
            'python': 'python -m compileall .',
            'go': 'go build -o app',
            'rust': 'cargo build --release',
            'java': buildTool === 'maven' ? 'mvn package' : 'gradle build',
            'kotlin': buildTool === 'maven' ? 'mvn package' : 'gradle build',
            'csharp': 'dotnet publish -c Release -o /app/publish',
            'php': 'composer dump-autoload --optimize',
            'ruby': 'bundle exec rake assets:precompile',
            'elixir': 'mix compile',
            'swift': 'swift build -c release',
            'scala': 'sbt assembly',
            'dart': 'dart compile exe bin/main.dart -o app',
            'haskell': buildTool === 'stack' ? 'stack build' : 'cabal build',
            'ocaml': 'dune build',
            'zig': 'zig build -Doptimize=ReleaseFast'
        };

        return commands[language] || 'echo "No build command"';
    }

    /**
     * Get generic run command for language
     */
    private getGenericRunCommand(language: string): string {
        const commands: { [key: string]: string } = {
            'javascript': 'node index.js',
            'typescript': 'node dist/index.js',
            'python': 'python main.py',
            'go': './app',
            'rust': './target/release/app',
            'java': 'java -jar app.jar',
            'kotlin': 'java -jar app.jar',
            'csharp': 'dotnet app.dll',
            'php': 'php-fpm',
            'ruby': 'bundle exec puma',
            'elixir': 'mix phx.server',
            'swift': './.build/release/app',
            'scala': 'java -jar target/scala-*/app.jar',
            'dart': './app',
            'haskell': './.stack-work/install/*/bin/app',
            'ocaml': './_build/default/bin/main.exe',
            'zig': './zig-out/bin/app'
        };

        return commands[language] || './app';
    }

    /**
     * Get generic output folder for language
     */
    private getGenericOutputFolder(language: string): string | undefined {
        const folders: { [key: string]: string } = {
            'javascript': 'dist',
            'typescript': 'dist',
            'python': '.',
            'go': '.',
            'rust': 'target/release',
            'java': 'target',
            'kotlin': 'build',
            'csharp': 'publish',
            'php': '.',
            'ruby': '.',
            'elixir': '_build/prod',
            'swift': '.build/release',
            'scala': 'target',
            'dart': '.',
            'haskell': '.stack-work',
            'ocaml': '_build',
            'zig': 'zig-out'
        };

        return folders[language];
    }

    /**
     * Check if tech stack is known/common
     */
    private isKnownTechStack(languages: LanguageInfo[]): boolean {
        const knownLanguages = ['javascript', 'typescript', 'python', 'go', 'java', 'rust', 'php', 'ruby'];
        return languages.some(l => knownLanguages.includes(l.language) && l.confidence === 'high');
    }

    /**
     * Get language signature by name
     */
    getSignature(language: string): any {
        return this.LANGUAGE_SIGNATURES.find(s => s.language === language);
    }
}
