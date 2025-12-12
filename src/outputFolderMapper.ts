/**
 * Output Folder Mapper
 * Maps frameworks and their variants to correct build output directories
 * Fixes Issue #6: Fails to detect required output folder
 */

export interface FrameworkOutputInfo {
    framework: string;
    variant?: string;
    outputFolder: string;
    buildCommand: string;
    packageManager?: 'npm' | 'yarn' | 'pnpm';
    isSSR?: boolean;
}

/**
 * Get the correct output folder for a given framework and variant
 */
export class OutputFolderMapper {

    /**
     * Get output folder for React projects
     */
    static getReactOutputFolder(packageJson: any, hasViteConfig: boolean, hasCRAConfig: boolean): FrameworkOutputInfo {
        const scripts = packageJson.scripts || {};
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for Vite
        if (hasViteConfig || dependencies['vite']) {
            return {
                framework: 'react',
                variant: 'vite',
                outputFolder: 'dist',
                buildCommand: 'npm run build'
            };
        }

        // Check for Create React App
        if (hasCRAConfig || dependencies['react-scripts']) {
            return {
                framework: 'react',
                variant: 'cra',
                outputFolder: 'build',
                buildCommand: 'npm run build'
            };
        }

        // Check for Preact
        if (dependencies['preact']) {
            return {
                framework: 'react',
                variant: 'preact',
                outputFolder: 'dist',
                buildCommand: 'npm run build'
            };
        }

        // Check for custom webpack config
        if (dependencies['webpack']) {
            return {
                framework: 'react',
                variant: 'webpack',
                outputFolder: 'dist',
                buildCommand: 'npm run build'
            };
        }

        // Default to Vite (modern standard)
        return {
            framework: 'react',
            variant: 'vite',
            outputFolder: 'dist',
            buildCommand: 'npm run build'
        };
    }

    /**
     * Get output folder for Next.js projects
     */
    static getNextJsOutputFolder(nextConfig: any, packageJson: any): FrameworkOutputInfo {
        // Check if static export is configured
        const isStaticExport = nextConfig?.output === 'export';

        if (isStaticExport) {
            return {
                framework: 'nextjs',
                variant: 'static',
                outputFolder: 'out',
                buildCommand: 'npm run build',
                isSSR: false
            };
        }

        // Default to SSR mode
        return {
            framework: 'nextjs',
            variant: 'ssr',
            outputFolder: '.next',
            buildCommand: 'npm run build',
            isSSR: true
        };
    }

    /**
     * Get output folder for Vue projects
     */
    static getVueOutputFolder(packageJson: any, hasViteConfig: boolean): FrameworkOutputInfo {
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for Nuxt.js
        if (dependencies['nuxt']) {
            const nuxtVersion = dependencies['nuxt'];
            const isNuxt3 = nuxtVersion && (nuxtVersion.includes('^3') || nuxtVersion.includes('3.'));

            return {
                framework: 'vue',
                variant: 'nuxt',
                outputFolder: isNuxt3 ? '.output/public' : 'dist',
                buildCommand: 'npm run build',
                isSSR: true
            };
        }

        // Check for Vite
        if (hasViteConfig || dependencies['vite']) {
            return {
                framework: 'vue',
                variant: 'vite',
                outputFolder: 'dist',
                buildCommand: 'npm run build'
            };
        }

        // Check for Vue CLI
        if (dependencies['@vue/cli-service']) {
            return {
                framework: 'vue',
                variant: 'cli',
                outputFolder: 'dist',
                buildCommand: 'npm run build'
            };
        }

        // Default to Vite
        return {
            framework: 'vue',
            variant: 'vite',
            outputFolder: 'dist',
            buildCommand: 'npm run build'
        };
    }

    /**
     * Get output folder for Angular projects
     */
    static getAngularOutputFolder(angularJson: any, packageJson: any): FrameworkOutputInfo {
        let outputFolder = 'dist';

        // Try to get the project name from angular.json
        if (angularJson && angularJson.projects) {
            const firstProject = Object.keys(angularJson.projects)[0];
            if (firstProject) {
                const buildOptions = angularJson.projects[firstProject]?.architect?.build?.options;
                if (buildOptions?.outputPath) {
                    outputFolder = buildOptions.outputPath;
                } else {
                    outputFolder = `dist/${firstProject}`;
                }
            }
        }

        return {
            framework: 'angular',
            outputFolder: outputFolder,
            buildCommand: 'npm run build'
        };
    }

    /**
     * Get output folder for Svelte projects
     */
    static getSvelteOutputFolder(packageJson: any, hasSvelteKitConfig: boolean): FrameworkOutputInfo {
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for SvelteKit
        if (hasSvelteKitConfig || dependencies['@sveltejs/kit']) {
            return {
                framework: 'svelte',
                variant: 'kit',
                outputFolder: 'build',
                buildCommand: 'npm run build',
                isSSR: true
            };
        }

        // Default Svelte (usually with Vite)
        return {
            framework: 'svelte',
            variant: 'vite',
            outputFolder: 'dist',
            buildCommand: 'npm run build'
        };
    }

    /**
     * Get output folder for any framework with auto-detection
     */
    static getOutputFolder(
        framework: string,
        basePath: string,
        packageJson?: any,
        configFiles?: {
            hasViteConfig?: boolean;
            hasCRAConfig?: boolean;
            hasNextConfig?: boolean;
            nextConfigContent?: any;
            hasAngularJson?: boolean;
            angularJsonContent?: any;
            hasSvelteKitConfig?: boolean;
        }
    ): FrameworkOutputInfo {
        const config = configFiles || {};

        switch (framework.toLowerCase()) {
            case 'react':
            case 'preact':
                return this.getReactOutputFolder(
                    packageJson || {},
                    config.hasViteConfig || false,
                    config.hasCRAConfig || false
                );

            case 'nextjs':
            case 'next':
                return this.getNextJsOutputFolder(
                    config.nextConfigContent || {},
                    packageJson || {}
                );

            case 'vue':
                return this.getVueOutputFolder(
                    packageJson || {},
                    config.hasViteConfig || false
                );

            case 'nuxt':
                return {
                    framework: 'vue',
                    variant: 'nuxt',
                    outputFolder: '.output/public',
                    buildCommand: 'npm run build',
                    isSSR: true
                };

            case 'angular':
                return this.getAngularOutputFolder(
                    config.angularJsonContent || {},
                    packageJson || {}
                );

            case 'svelte':
                return this.getSvelteOutputFolder(
                    packageJson || {},
                    config.hasSvelteKitConfig || false
                );

            case 'gatsby':
                return {
                    framework: 'gatsby',
                    outputFolder: 'public',
                    buildCommand: 'npm run build'
                };

            case 'ember':
                return {
                    framework: 'ember',
                    outputFolder: 'dist',
                    buildCommand: 'npm run build'
                };

            case 'solid':
            case 'solidjs':
                return {
                    framework: 'solid',
                    outputFolder: 'dist',
                    buildCommand: 'npm run build'
                };

            default:
                // Default fallback for unknown frameworks
                return {
                    framework: framework,
                    outputFolder: 'dist',
                    buildCommand: 'npm run build'
                };
        }
    }

    /**
     * Detect package manager from lock files
     */
    static detectPackageManager(basePath: string): 'npm' | 'yarn' | 'pnpm' {
        const fs = require('fs');
        const path = require('path');

        if (fs.existsSync(path.join(basePath, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        if (fs.existsSync(path.join(basePath, 'yarn.lock'))) {
            return 'yarn';
        }
        return 'npm';
    }

    /**
     * Get the correct install command based on package manager
     */
    static getInstallCommand(packageManager: 'npm' | 'yarn' | 'pnpm', production: boolean = false): string {
        switch (packageManager) {
            case 'npm':
                // Use npm ci for faster, cleaner installs when package-lock.json exists
                return production ? 'npm ci --only=production' : 'npm ci';
            case 'yarn':
                return production ? 'yarn install --production' : 'yarn install';
            case 'pnpm':
                return production ? 'pnpm install --prod' : 'pnpm install';
            default:
                return 'npm install';
        }
    }

    /**
     * Get the correct build command with package manager
     */
    static getBuildCommand(packageManager: 'npm' | 'yarn' | 'pnpm', customCommand?: string): string {
        const command = customCommand || 'build';

        switch (packageManager) {
            case 'npm':
                return `npm run ${command}`;
            case 'yarn':
                return `yarn ${command}`;
            case 'pnpm':
                return `pnpm ${command}`;
            default:
                return `npm run ${command}`;
        }
    }

    /**
     * Get comprehensive framework info including everything needed for Dockerfile
     */
    static getCompleteFrameworkInfo(
        framework: string,
        basePath: string,
        packageJson?: any,
        configFiles?: any
    ): FrameworkOutputInfo & { installCommand: string; packageManager: 'npm' | 'yarn' | 'pnpm' } {
        const outputInfo = this.getOutputFolder(framework, basePath, packageJson, configFiles);
        const packageManager = this.detectPackageManager(basePath);
        const installCommand = this.getInstallCommand(packageManager, false);
        const buildCommand = this.getBuildCommand(packageManager, 'build');

        return {
            ...outputInfo,
            packageManager,
            installCommand,
            buildCommand
        };
    }
}
