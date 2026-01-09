import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectAnalyzer } from './projectAnalyzer';
import { EnhancedProjectAnalyzer } from './enhancedProjectAnalyzer';
import { LLMService } from './llmService';
import { FileManager } from './fileManager';
import { DockerTestRunner } from './testRunner';
import { TestReporter } from './testReporter';
import { TestProjectGenerator } from './testProjectGenerator';
import { ComprehensiveAnalyzer } from './comprehensiveAnalyzer';
import {
    MultiWorkspaceManager,
    BOMHandler,
    SafeDirectoryTraversal,
    GenerationLock,
    PathSanitizer,
    DockerignoreGenerator,
    FileWriteLock
} from './criticalErrorHandling';
import { UIEnhancementService } from './uiEnhancementService';

let outputChannel: vscode.OutputChannel;
let uiService: UIEnhancementService;

export function activate(context: vscode.ExtensionContext) {
    console.log('Auto Docker Extension is now active!');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Auto Docker');
    context.subscriptions.push(outputChannel);
    
    // Initialize UI Enhancement Service
    uiService = new UIEnhancementService(context);
    context.subscriptions.push(uiService);

    // Register commands
    const analyzeCommand = vscode.commands.registerCommand('autoDocker.analyzeProject', async () => {
        await analyzeProject();
    });

    const regenerateCommand = vscode.commands.registerCommand('autoDocker.regenerateDockerFiles', async () => {
        await regenerateDockerFiles();
    });

    const directModeCommand = vscode.commands.registerCommand('autoDocker.analyzeProjectDirect', async () => {
        await analyzeProject(true); // Skip preview
    });

    const configureApiKeysCommand = vscode.commands.registerCommand('autoDocker.configureApiKeys', async () => {
        await configureApiKeys();
    });

    const runTestsCommand = vscode.commands.registerCommand('autoDocker.runTests', async () => {
        await runComprehensiveTests();
    });

    const generateTestProjectsCommand = vscode.commands.registerCommand('autoDocker.generateTestProjects', async () => {
        await generateTestProjects();
    });
    
    const showDashboardCommand = vscode.commands.registerCommand('autoDocker.showDashboard', async () => {
        await showDashboard();
    });
    
    const exportMetricsCommand = vscode.commands.registerCommand('autoDocker.exportMetrics', async () => {
        await exportMetrics();
    });
    
    const showSecurityReportCommand = vscode.commands.registerCommand('autoDocker.showSecurityReport', async () => {
        await showSecurityReport();
    });
    
    const analyzeDependenciesCommand = vscode.commands.registerCommand('autoDocker.analyzeDependencies', async () => {
        await analyzeDependencies();
    });
    
    const optimizePromptCommand = vscode.commands.registerCommand('autoDocker.optimizePrompt', async () => {
        await optimizePromptAnalysis();
    });
    
    const showQuickPickCommand = vscode.commands.registerCommand('autoDocker.showQuickPick', async () => {
        await showQuickPickMenu();
    });
    
    const showFullDashboardCommand = vscode.commands.registerCommand('autoDocker.showFullDashboard', async () => {
        await showFullDashboard();
    });

    // Add commands to subscriptions
    context.subscriptions.push(
        analyzeCommand,
        regenerateCommand,
        directModeCommand,
        configureApiKeysCommand,
        runTestsCommand,
        generateTestProjectsCommand,
        showDashboardCommand,
        exportMetricsCommand,
        showSecurityReportCommand,
        analyzeDependenciesCommand,
        optimizePromptCommand,
        showQuickPickCommand,
        showFullDashboardCommand
    );

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

async function analyzeProject(skipPreview: boolean = false): Promise<void> {
    // CRITICAL FIX for Runtime Errors: Comprehensive try-catch and type safety
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🔍 Starting project analysis...');

        // CRITICAL FIX #1: Multi-workspace folder handling
        const workspaceRoot = await MultiWorkspaceManager.getActiveWorkspaceFolder();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
            vscode.window.showErrorMessage('Invalid or no workspace selected');
            return;
        }

        // CRITICAL FIX #5: Check if generation is already in progress (concurrent locking)
        if (GenerationLock.isLocked(workspaceRoot)) {
            vscode.window.showWarningMessage('Docker file generation is already in progress. Please wait...');
            return;
        }

        const fileManager = new FileManager(workspaceRoot);
        const validationResult = await fileManager.validateWorkspace();
        if (!validationResult) {
            return;
        }

        // Check API configuration (CRITICAL FIX #32: Safe null checks)
        const apiConfigValid = await validateApiConfiguration();
        if (!apiConfigValid) {
            return;
        }
        
        // Update UI - show analyzing status
        uiService.showAnalyzing();

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing project and generating Docker files...",
            cancellable: false
        }, async (progress) => {
            try {
                // Step 1: Analyze project structure
                progress.report({ increment: 20, message: "Analyzing project structure..." });
                outputChannel.appendLine('📁 Analyzing project structure...');

                // Use enhanced analyzer for better code understanding
                const config = vscode.workspace.getConfiguration('autoDocker');
                const model = config.get<string>('model', 'gpt-4') || 'gpt-4';

                const enhancedAnalyzer = new EnhancedProjectAnalyzer(workspaceRoot, outputChannel);
                const analysis = await enhancedAnalyzer.analyzeWithAdvancedFeatures(model);

                // CRITICAL FIX #33: Safe property access with defaults
                const projectStructure = analysis?.projectStructure;
                if (!projectStructure) {
                    throw new Error('Failed to analyze project structure');
                }

                outputChannel.appendLine(`Project type detected: ${projectStructure.projectType || 'unknown'}`);
                if (projectStructure.frontend) {
                    outputChannel.appendLine(`Frontend: ${projectStructure.frontend}`);
                }
                if (projectStructure.backend) {
                    outputChannel.appendLine(`Backend: ${projectStructure.backend}`);
                }

                // Step 2: Generate Docker files using LLM
                progress.report({ increment: 40, message: "Generating Docker configuration..." });
                outputChannel.appendLine('🤖 Generating Docker files...');

                const llmService = new LLMService(outputChannel, context);
                const dockerFiles = await llmService.generateDockerFiles(projectStructure);

                // CRITICAL FIX #34: Validate generated content
                if (!dockerFiles ||
                    !dockerFiles.dockerfile ||
                    !dockerFiles.dockerCompose ||
                    !dockerFiles.dockerIgnore) {
                    throw new Error('LLM generated incomplete Docker files');
                }

                outputChannel.appendLine('✅ Docker files generated');

                // Step 3: Preview and confirm
                progress.report({ increment: 70, message: "Preparing preview..." });

                if (!skipPreview) {
                    try {
                        const confirmed = await fileManager.showPreview(dockerFiles);
                        if (!confirmed) {
                            outputChannel.appendLine('⚠️  Docker generation cancelled');
                            vscode.window.showInformationMessage('Docker generation cancelled');
                            return;
                        }
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                        outputChannel.appendLine(`⚠️  Preview error: ${errorMsg}`);
                        // Ask user if they want to continue anyway
                        const choice = await vscode.window.showWarningMessage(
                            'Preview failed. Write files anyway?',
                            'Yes',
                            'No'
                        );
                        if (choice !== 'Yes') {
                            return;
                        }
                    }
                }

                // Step 4: Write files
                progress.report({ increment: 90, message: "Writing files..." });
                outputChannel.appendLine('📝 Writing Docker files to workspace...');

                await fileManager.writeDockerFiles(dockerFiles, projectStructure);

                progress.report({ increment: 100, message: "Complete!" });
                outputChannel.appendLine('✅ Docker files generated successfully!');
                
                // Update UI with success
                uiService.showSuccess('Docker files generated');
                await uiService.showSuccessNotification('Docker files generated successfully!', [
                    { title: 'Open Files', callback: () => {
                        vscode.commands.executeCommand('workbench.view.explorer');
                    }},
                    { title: 'View Dashboard', callback: () => {
                        vscode.commands.executeCommand('autoDocker.showDashboard');
                    }}
                ]);
            } catch (innerError) {
                const errorMsg = innerError instanceof Error ? innerError.message : 'Unknown error';
                outputChannel.appendLine(`❌ Error: ${errorMsg}`);
                throw innerError;
            }
        });

    } catch (error) {
        // CRITICAL FIX #35: Comprehensive error logging and user feedback
        const errorMessage = error instanceof Error ? error.message :
            typeof error === 'string' ? error :
                'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        if (error instanceof Error && error.stack) {
            outputChannel.appendLine(`Stack: ${error.stack}`);
        }
        
        // Update UI with error
        uiService.showError('Generation failed');
        await uiService.showErrorNotification(`Failed to generate Docker files: ${errorMessage}`, [
            { title: 'View Logs', callback: () => outputChannel.show() },
            { title: 'Try Again', callback: () => vscode.commands.executeCommand('autoDocker.analyzeProject') }
        ]);
    }
}

async function regenerateDockerFiles(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
        'This will regenerate all Docker files and may overwrite existing ones. Continue?',
        { modal: true },
        'Yes, Regenerate',
        'Cancel'
    );

    if (choice === 'Yes, Regenerate') {
        await analyzeProject();
    }
}

async function configureApiKeys(): Promise<void> {
    const config = vscode.workspace.getConfiguration('autoDocker');

    const provider = await vscode.window.showQuickPick(
        ['OpenAI (GPT)', 'Google Gemini'],
        { placeHolder: 'Select your preferred AI provider' }
    );

    if (!provider) {
        return;
    }

    if (provider === 'OpenAI (GPT)') {
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'Enter your OpenAI API key',
            password: true,
            prompt: 'Get your API key from https://platform.openai.com/api-keys'
        });

        if (apiKey) {
            await config.update('apiProvider', 'openai', vscode.ConfigurationTarget.Global);
            await config.update('openaiApiKey', apiKey, vscode.ConfigurationTarget.Global);

            const model = await vscode.window.showQuickPick(
                ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                { placeHolder: 'Select model (gpt-4 recommended)' }
            );

            if (model) {
                await config.update('model', model, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage('OpenAI API configuration saved successfully!');
        }
    } else if (provider === 'Google Gemini') {
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'Enter your Google Gemini API key',
            password: true,
            prompt: 'Get your API key from https://makersuite.google.com/app/apikey'
        });

        if (apiKey) {
            await config.update('apiProvider', 'gemini', vscode.ConfigurationTarget.Global);
            await config.update('geminiApiKey', apiKey, vscode.ConfigurationTarget.Global);
            await config.update('model', 'gemini-pro', vscode.ConfigurationTarget.Global);

            vscode.window.showInformationMessage('Google Gemini API configuration saved successfully!');
        }
    }
}

async function validateApiConfiguration(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('autoDocker');
    const provider = config.get<string>('apiProvider', 'openai');

    let isConfigured = false;

    if (provider === 'openai') {
        const apiKey = config.get<string>('openaiApiKey');
        isConfigured = !!apiKey && apiKey.trim().length > 0;
    } else if (provider === 'gemini') {
        const apiKey = config.get<string>('geminiApiKey');
        isConfigured = !!apiKey && apiKey.trim().length > 0;
    }

    if (!isConfigured) {
        const choice = await vscode.window.showErrorMessage(
            `${provider} API key is not configured. Please set up your API key to use Auto Docker Extension.`,
            'Configure Now',
            'Cancel'
        );

        if (choice === 'Configure Now') {
            await configureApiKeys();
            return await validateApiConfiguration(); // Re-validate after configuration
        }

        return false;
    }

    return true;
}

function getWorkspaceRoot(): string {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        throw new Error('No workspace folder is open');
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
}

function showWelcomeMessage(): void {
    const message = 'Welcome to Auto Docker Extension! Generate Docker files automatically using AI.';
    vscode.window.showInformationMessage(message, 'Configure API Keys', 'Learn More').then(choice => {
        if (choice === 'Configure API Keys') {
            configureApiKeys();
        } else if (choice === 'Learn More') {
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/auto-docker-extension#readme'));
        }
    });
}

async function runComprehensiveTests(): Promise<void> {
    // CRITICAL FIX for Runtime Errors: Add race condition prevention and unhandled promise handling
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🧪 Starting comprehensive Docker tests...\n');

        const workspaceRoot = getWorkspaceRoot();
        if (!workspaceRoot || typeof workspaceRoot !== 'string' || workspaceRoot.trim().length === 0) {
            vscode.window.showErrorMessage('Invalid workspace root');
            return;
        }

        // Ask user what to test
        const testOptions = await vscode.window.showQuickPick([
            { label: '🎨 Frontend Frameworks', value: 'frontend' },
            { label: '⚙️ Backend Frameworks', value: 'backend' },
            { label: '🗄️ Databases', value: 'databases' },
            { label: '🔄 Message Queues', value: 'queues' },
            { label: '🔍 Search Engines', value: 'search' },
            { label: '🌐 Reverse Proxies', value: 'proxies' },
            { label: '🏗️ Fullstack Apps', value: 'fullstack' },
            { label: '🚀 Run All Tests', value: 'all' }
        ], {
            placeHolder: 'Select what to test',
            canPickMany: false
        });

        if (!testOptions || !testOptions.value) {
            return;
        }

        // CRITICAL FIX #36: Prevent race conditions with proper promise handling
        const testPromise = vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Running Docker Tests...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: "Initializing test runner..." });

                const testRunner = new DockerTestRunner();
                // Add timeout to prevent hanging tests
                const testWithTimeout = Promise.race([
                    testRunner.runAllTests(workspaceRoot),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Test execution timeout')), 300000) // 5 minute timeout
                    )
                ]) as Promise<any>;

                const summary = await testWithTimeout;

                progress.report({ message: "Generating reports..." });

                // Generate reports (CRITICAL FIX #34: Safe array access)
                const reportsDir = path.join(workspaceRoot, '.test-reports');
                if (!fs.existsSync(reportsDir)) {
                    try {
                        fs.mkdirSync(reportsDir, { recursive: true });
                    } catch (mkdirError) {
                        console.warn('Failed to create reports directory:', mkdirError);
                    }
                }

                // Write test report (CRITICAL FIX #35: Proper error handling)
                try {
                    if (summary && typeof summary === 'object') {
                        const reportPath = path.join(reportsDir, `test-report-${Date.now()}.json`);
                        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
                        outputChannel.appendLine(`📊 Test report saved to: ${reportPath}`);
                    }
                } catch (reportError) {
                    const reportErrorMsg = reportError instanceof Error ? reportError.message : 'Unknown error';
                    outputChannel.appendLine(`⚠️ Failed to save report: ${reportErrorMsg}`);
                }

                progress.report({ increment: 100 });
                vscode.window.showInformationMessage('✅ Tests completed!');
            } catch (testError) {
                const testErrorMsg = testError instanceof Error ? testError.message : 'Unknown error';
                outputChannel.appendLine(`❌ Test error: ${testErrorMsg}`);
                throw testError;
            }
        });

        // Test promise already has error handling in the withProgress callback
        // No additional catch needed here

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message :
            typeof error === 'string' ? error :
                'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Test execution failed: ${errorMessage}`);
    }
}

async function generateTestProjects(): Promise<void> {
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🏗️ Generating test projects...\n');

        const workspaceRoot = getWorkspaceRoot();

        const confirm = await vscode.window.showWarningMessage(
            'This will create sample projects for all supported technologies in .test-projects folder. Continue?',
            { modal: true },
            'Yes, Generate',
            'Cancel'
        );

        if (confirm !== 'Yes, Generate') {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Generating test projects...",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: "Creating project templates..." });

            await TestProjectGenerator.generateAllTestProjects(workspaceRoot);

            outputChannel.appendLine('✅ Test projects generated successfully!');
            outputChannel.appendLine(`\nLocation: ${path.join(workspaceRoot, '.test-projects')}`);
            outputChannel.appendLine('\nGenerated projects:');
            outputChannel.appendLine('  Frontend:');
            outputChannel.appendLine('    - react-vite');
            outputChannel.appendLine('    - vue-vite');
            outputChannel.appendLine('    - angular');
            outputChannel.appendLine('    - nextjs');
            outputChannel.appendLine('  Backend:');
            outputChannel.appendLine('    - express');
            outputChannel.appendLine('    - django');
            outputChannel.appendLine('    - flask');
            outputChannel.appendLine('    - fastapi');
            outputChannel.appendLine('    - spring-boot');
            outputChannel.appendLine('  Fullstack:');
            outputChannel.appendLine('    - mern');
            outputChannel.appendLine('    - django-react');

            vscode.window.showInformationMessage(
                'Test projects generated successfully!',
                'Open Folder',
                'Run Tests'
            ).then(choice => {
                if (choice === 'Open Folder') {
                    const testProjectsUri = vscode.Uri.file(path.join(workspaceRoot, '.test-projects'));
                    vscode.commands.executeCommand('revealFileInOS', testProjectsUri);
                } else if (choice === 'Run Tests') {
                    runComprehensiveTests();
                }
            });
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to generate test projects: ${errorMessage}`);
    }
}

async function showDashboard() {
    try {
        const { AIObservabilityService } = await import('./aiObservabilityService');
        const observability = new AIObservabilityService();
        
        const period = await vscode.window.showQuickPick(
            ['All Time', 'This Month', 'This Week', 'Today', 'Current Session'],
            {
                placeHolder: 'Select time period for metrics'
            }
        );
        
        if (!period) {
            return;
        }
        
        const periodMap: Record<string, 'all' | 'month' | 'week' | 'day' | 'session'> = {
            'All Time': 'all',
            'This Month': 'month',
            'This Week': 'week',
            'Today': 'day',
            'Current Session': 'session'
        };
        
        observability.showDashboard(periodMap[period]);
        vscode.window.showInformationMessage('AI Observability Dashboard opened in Output panel');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to show dashboard: ${errorMessage}`);
    }
}

async function exportMetrics() {
    try {
        const { AIObservabilityService } = await import('./aiObservabilityService');
        const observability = new AIObservabilityService();
        
        const uri = await vscode.window.showSaveDialog({
            filters: { 'JSON': ['json'] },
            defaultUri: vscode.Uri.file('docker-ai-metrics.json'),
            saveLabel: 'Export Metrics'
        });
        
        if (uri) {
            await observability.exportMetrics(uri.fsPath);
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Failed to export metrics: ${errorMessage}`);
    }
}

async function showSecurityReport() {
    try {
        const { SecurityScanningService } = await import('./securityScanningService');
        
        // Check if security scanning is enabled
        if (!SecurityScanningService.isEnabled()) {
            vscode.window.showWarningMessage('Security scanning is disabled. Enable it in settings.');
            return;
        }
        
        // Prompt user to select which files to scan
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        // Try to find Docker files in workspace
        const fs = require('fs').promises;
        const path = require('path');
        
        const dockerfilePath = path.join(workspaceFolder.uri.fsPath, 'Dockerfile');
        const composePath = path.join(workspaceFolder.uri.fsPath, 'docker-compose.yml');
        const nginxPath = path.join(workspaceFolder.uri.fsPath, 'nginx.conf');
        
        let dockerfile = '';
        let dockerCompose = '';
        let nginxConf: string | undefined;
        
        try {
            dockerfile = await fs.readFile(dockerfilePath, 'utf-8');
        } catch {
            outputChannel.appendLine('⚠️ Dockerfile not found');
        }
        
        try {
            dockerCompose = await fs.readFile(composePath, 'utf-8');
        } catch {
            outputChannel.appendLine('⚠️ docker-compose.yml not found');
        }
        
        try {
            nginxConf = await fs.readFile(nginxPath, 'utf-8');
        } catch {
            // nginx.conf is optional
        }
        
        if (!dockerfile && !dockerCompose) {
            vscode.window.showErrorMessage('No Docker files found in workspace');
            return;
        }
        
        // Run security scan
        const securityService = new SecurityScanningService();
        outputChannel.show();
        outputChannel.appendLine('\n🔒 Running security scan...\n');
        
        const result = await securityService.scanDockerFiles({
            dockerfile,
            dockerCompose,
            nginxConf
        });
        
        // Show detailed report
        securityService.showResults(result);
        
        // Show summary notification
        if (result.passed) {
            vscode.window.showInformationMessage(
                `✅ Security scan passed! Score: ${result.score}/100`,
                'View Report'
            ).then(selection => {
                if (selection === 'View Report') {
                    outputChannel.show();
                }
            });
        } else {
            vscode.window.showWarningMessage(
                `⚠️ Security issues found: ${result.criticalCount} critical, ${result.highCount} high. Score: ${result.score}/100`,
                'View Report'
            ).then(selection => {
                if (selection === 'View Report') {
                    outputChannel.show();
                }
            });
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Security scan failed: ${errorMessage}`);
    }
}

async function analyzeDependencies() {
    try {
        const { DependencyGraphService } = await import('./dependencyGraphService');
        
        // Check if dependency analysis is enabled
        if (!DependencyGraphService.isEnabled()) {
            vscode.window.showWarningMessage('Dependency analysis is disabled. Enable it in settings.');
            return;
        }
        
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        const dependencyService = new DependencyGraphService();
        outputChannel.show();
        outputChannel.appendLine('\n📦 Analyzing project dependencies...\n');
        
        // Run dependency analysis
        const result = await dependencyService.analyzeProject(workspaceFolder.uri.fsPath);
        
        if (!result.success) {
            vscode.window.showErrorMessage('Dependency analysis failed. Check output for details.');
            return;
        }
        
        // Show detailed report
        dependencyService.showResults(result);
        
        // Show summary notification
        const criticalVulns = result.vulnerabilityCount.critical;
        const highVulns = result.vulnerabilityCount.high;
        
        if (criticalVulns > 0 || highVulns > 0) {
            vscode.window.showWarningMessage(
                `⚠️ Found ${criticalVulns} critical and ${highVulns} high severity vulnerabilities. Score: ${result.score}/100`,
                'View Report'
            ).then(selection => {
                if (selection === 'View Report') {
                    outputChannel.show();
                }
            });
        } else {
            vscode.window.showInformationMessage(
                `✅ Dependency analysis complete! Score: ${result.score}/100 (${result.totalDependencies} dependencies)`,
                'View Report'
            ).then(selection => {
                if (selection === 'View Report') {
                    outputChannel.show();
                }
            });
        }
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Dependency analysis failed: ${errorMessage}`);
    }
}

/**
 * Optimize prompt engineering and show analysis
 */
async function optimizePromptAnalysis() {
    const { PromptEngineeringService } = await import('./promptEngineeringService');
    const { EnhancedProjectAnalyzer } = await import('./enhancedProjectAnalyzer');
    
    try {
        // Get workspace folder
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        
        const projectPath = workspaceFolders[0].uri.fsPath;
        outputChannel.appendLine('🧩 Analyzing prompt optimization opportunities...\n');
        
        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Optimizing Prompts...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 10, message: 'Analyzing project...' });
            
            // Analyze project
            const analyzer = new EnhancedProjectAnalyzer(projectPath);
            const projectStructure = await analyzer.analyze();
            
            progress.report({ increment: 30, message: 'Generating optimized prompts...' });
            
            // Initialize prompt engineering service
            const promptService = new PromptEngineeringService();
            
            // Build context
            let projectSize: 'small' | 'medium' | 'large' | 'enterprise' = 'medium';
            const fileCount = projectStructure.files.length;
            if (fileCount < 20) projectSize = 'small';
            else if (fileCount < 100) projectSize = 'medium';
            else if (fileCount < 500) projectSize = 'large';
            else projectSize = 'enterprise';
            
            let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';
            if (projectStructure.backend && projectStructure.frontend && projectStructure.database) {
                complexity = 'complex';
            } else if (!projectStructure.backend || !projectStructure.frontend) {
                complexity = 'simple';
            }
            
            const context = {
                projectType: projectStructure.projectType,
                framework: projectStructure.frontend?.framework || projectStructure.backend?.framework,
                language: projectStructure.backend === 'flask' || projectStructure.backend === 'django' ? 'python' : 'javascript',
                projectSize,
                complexity,
                requirements: [
                    projectStructure.hasEnvFile ? 'Environment variables' : null,
                    projectStructure.database ? `Database: ${projectStructure.database}` : null
                ].filter(Boolean) as string[]
            };
            
            progress.report({ increment: 30, message: 'Optimizing...' });
            
            // Generate optimized prompt
            const optimized = await promptService.generateOptimizedPrompt('dockerfile', context);
            
            progress.report({ increment: 20, message: 'Generating report...' });
            
            // Show results
            outputChannel.appendLine('✅ Prompt Optimization Complete!\n');
            outputChannel.appendLine('='.repeat(80));
            outputChannel.appendLine('OPTIMIZATION RESULTS');
            outputChannel.appendLine('='.repeat(80));
            outputChannel.appendLine(`\n📊 Metrics:`);
            outputChannel.appendLine(`   - Token Reduction: ${optimized.tokenReduction} tokens saved`);
            outputChannel.appendLine(`   - Quality Score: ${optimized.qualityScore.toFixed(1)}/100`);
            outputChannel.appendLine(`   - Strategy: ${optimized.strategy}`);
            
            if (optimized.improvements.length > 0) {
                outputChannel.appendLine(`\n🎯 Improvements Applied:`);
                optimized.improvements.forEach((imp, idx) => {
                    outputChannel.appendLine(`   ${idx + 1}. ${imp}`);
                });
            }
            
            if (optimized.chainOfThought) {
                outputChannel.appendLine(`\n🧠 Chain-of-Thought Steps: ${optimized.chainOfThought.length} reasoning steps`);
            }
            
            if (optimized.fewShotExamples && optimized.fewShotExamples.length > 0) {
                outputChannel.appendLine(`\n📚 Few-Shot Examples: ${optimized.fewShotExamples.length} examples included`);
            }
            
            if (optimized.ragContext) {
                outputChannel.appendLine(`\n📖 RAG Enhancement: Context added from documentation`);
            }
            
            // Get overall stats
            const stats = promptService.getStats();
            outputChannel.appendLine(`\n📈 Service Statistics:`);
            outputChannel.appendLine(`   - Total Templates: ${stats.totalTemplates}`);
            outputChannel.appendLine(`   - Total Examples: ${stats.totalExamples}`);
            outputChannel.appendLine(`   - Average Quality: ${stats.averageQuality.toFixed(1)}/100`);
            outputChannel.appendLine(`   - Total Cost: $${stats.totalCost.toFixed(4)}`);
            
            outputChannel.appendLine('\n' + '='.repeat(80));
            outputChannel.show();
            
            progress.report({ increment: 10, message: 'Complete!' });
            
            // Show success message
            const choice = await vscode.window.showInformationMessage(
                `Prompt optimization complete! Token reduction: ${optimized.tokenReduction}, Quality: ${optimized.qualityScore.toFixed(1)}/100`,
                'View Details',
                'Close'
            );
            
            if (choice === 'View Details') {
                outputChannel.show();
            }
        });
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
        vscode.window.showErrorMessage(`Prompt optimization failed: ${errorMessage}`);
    }
}

/**
 * Show quick pick menu for common actions
 */
async function showQuickPickMenu() {
    const selected = await uiService.showQuickPick({
        title: 'Auto Docker - Quick Actions',
        placeholder: 'Select an action',
        items: [
            {
                label: 'Generate Docker Files',
                description: 'Analyze project and generate Docker configuration',
                detail: 'Full analysis with all validation phases',
                icon: 'rocket',
                value: 'generate'
            },
            {
                label: 'Show Dashboard',
                description: 'View AI Observability dashboard',
                detail: 'Metrics, analytics, and insights',
                icon: 'dashboard',
                value: 'dashboard'
            },
            {
                label: 'Security Scan',
                description: 'Run security analysis',
                detail: 'Scan for vulnerabilities and issues',
                icon: 'shield',
                value: 'security'
            },
            {
                label: 'Dependency Analysis',
                description: 'Analyze project dependencies',
                detail: 'Check for vulnerabilities and updates',
                icon: 'package',
                value: 'dependencies'
            },
            {
                label: 'Optimize Prompts',
                description: 'Analyze prompt engineering',
                detail: 'Token optimization and quality analysis',
                icon: 'lightbulb',
                value: 'prompts'
            },
            {
                label: 'Configure Settings',
                description: 'Set up API keys and preferences',
                detail: 'OpenAI, Gemini, Anthropic configuration',
                icon: 'settings-gear',
                value: 'settings'
            },
            {
                label: 'Run Tests',
                description: 'Execute comprehensive tests',
                detail: 'Validate Docker configurations',
                icon: 'beaker',
                value: 'tests'
            },
            {
                label: 'Export Metrics',
                description: 'Export AI metrics to file',
                detail: 'JSON format for analysis',
                icon: 'export',
                value: 'export'
            }
        ]
    });
    
    if (!selected) return;
    
    switch (selected) {
        case 'generate':
            await vscode.commands.executeCommand('autoDocker.analyzeProject');
            break;
        case 'dashboard':
            await vscode.commands.executeCommand('autoDocker.showDashboard');
            break;
        case 'security':
            await vscode.commands.executeCommand('autoDocker.showSecurityReport');
            break;
        case 'dependencies':
            await vscode.commands.executeCommand('autoDocker.analyzeDependencies');
            break;
        case 'prompts':
            await vscode.commands.executeCommand('autoDocker.optimizePrompt');
            break;
        case 'settings':
            await vscode.commands.executeCommand('autoDocker.configureApiKeys');
            break;
        case 'tests':
            await vscode.commands.executeCommand('autoDocker.runTests');
            break;
        case 'export':
            await vscode.commands.executeCommand('autoDocker.exportMetrics');
            break;
    }
}

/**
 * Show full dashboard in new webview panel
 */
async function showFullDashboard() {
    const panel = vscode.window.createWebviewPanel(
        'autoDockerFullDashboard',
        'Auto Docker - Full Dashboard',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );
    
    panel.webview.html = getFullDashboardHtml();
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'refresh':
                    panel.webview.html = getFullDashboardHtml();
                    break;
                case 'generate':
                    await vscode.commands.executeCommand('autoDocker.analyzeProject');
                    break;
                case 'openSettings':
                    await vscode.commands.executeCommand('autoDocker.configureApiKeys');
                    break;
            }
        }
    );
}

/**
 * Generate full dashboard HTML
 */
function getFullDashboardHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Docker Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 40px;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 50px;
        }
        .header h1 {
            font-size: 48px;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header p {
            font-size: 18px;
            opacity: 0.9;
        }
        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-bottom: 40px;
        }
        .card {
            background: rgba(255,255,255,0.95);
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            color: #333;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.3);
        }
        .card-header {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 20px;
        }
        .card-icon {
            font-size: 36px;
        }
        .card-title {
            font-size: 20px;
            font-weight: 600;
            color: #667eea;
        }
        .card-value {
            font-size: 42px;
            font-weight: 700;
            color: #667eea;
            margin-bottom: 10px;
        }
        .card-label {
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .feature-card {
            background: rgba(255,255,255,0.95);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            color: #333;
            transition: all 0.3s ease;
        }
        .feature-card:hover {
            transform: scale(1.05);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .feature-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .feature-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 10px;
            color: #667eea;
        }
        .feature-desc {
            font-size: 14px;
            color: #666;
            line-height: 1.6;
        }
        .action-buttons {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
        }
        .btn {
            padding: 15px 40px;
            border: none;
            border-radius: 30px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        .btn-primary {
            background: #fff;
            color: #667eea;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.3);
        }
        .btn-secondary {
            background: rgba(255,255,255,0.2);
            color: #fff;
            backdrop-filter: blur(10px);
        }
        .btn-secondary:hover {
            background: rgba(255,255,255,0.3);
        }
        .pipeline-section {
            background: rgba(255,255,255,0.95);
            border-radius: 16px;
            padding: 30px;
            margin-bottom: 40px;
            color: #333;
        }
        .pipeline-title {
            font-size: 24px;
            font-weight: 600;
            color: #667eea;
            margin-bottom: 30px;
            text-align: center;
        }
        .pipeline-steps {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: center;
        }
        .pipeline-step {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            padding: 15px 25px;
            border-radius: 25px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 5px 15px rgba(102,126,234,0.3);
        }
        .step-number {
            background: rgba(255,255,255,0.3);
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Auto Docker Dashboard</h1>
            <p>AI-Powered Docker Configuration Generator with 10-Phase Validation</p>
        </div>
        
        <div class="dashboard-grid">
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">📊</span>
                    <span class="card-title">Generations</span>
                </div>
                <div class="card-value">0</div>
                <div class="card-label">Total Generations</div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">✅</span>
                    <span class="card-title">Success Rate</span>
                </div>
                <div class="card-value">0%</div>
                <div class="card-label">All Time Success</div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">⭐</span>
                    <span class="card-title">Quality Score</span>
                </div>
                <div class="card-value">0</div>
                <div class="card-label">Average Quality</div>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <span class="card-icon">💰</span>
                    <span class="card-title">Total Cost</span>
                </div>
                <div class="card-value">$0.00</div>
                <div class="card-label">Optimized Spending</div>
            </div>
        </div>
        
        <div class="pipeline-section">
            <h2 class="pipeline-title">10-Phase Validation Pipeline</h2>
            <div class="pipeline-steps">
                <div class="pipeline-step">
                    <span class="step-number">1</span>
                    <span>Guardrails AI</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">2</span>
                    <span>Schema Validation</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">3</span>
                    <span>LangChain Output</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">4</span>
                    <span>Static Analysis</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">5</span>
                    <span>Compose Spec</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">6</span>
                    <span>AI Observability</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">7</span>
                    <span>Security Scanning</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">8</span>
                    <span>Dependencies</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">9</span>
                    <span>Prompt Engineering</span>
                </div>
                <div class="pipeline-step">
                    <span class="step-number">10</span>
                    <span>UI/UX</span>
                </div>
            </div>
        </div>
        
        <div class="feature-grid">
            <div class="feature-card">
                <div class="feature-icon">🛡️</div>
                <div class="feature-title">Security First</div>
                <div class="feature-desc">110+ security checks with real-time vulnerability scanning</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🎯</div>
                <div class="feature-title">Smart Analysis</div>
                <div class="feature-desc">AI-powered project detection and optimization</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">⚡</div>
                <div class="feature-title">Fast Generation</div>
                <div class="feature-desc">Production-ready configs in seconds</div>
            </div>
            <div class="feature-card">
                <div class="feature-icon">📈</div>
                <div class="feature-title">Analytics</div>
                <div class="feature-desc">Comprehensive metrics and insights</div>
            </div>
        </div>
        
        <div class="action-buttons">
            <button class="btn btn-primary" onclick="generate()">🚀 Generate Docker Files</button>
            <button class="btn btn-secondary" onclick="openSettings()">⚙️ Configure Settings</button>
            <button class="btn btn-secondary" onclick="refresh()">🔄 Refresh Dashboard</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function generate() {
            vscode.postMessage({ command: 'generate' });
        }
        
        function openSettings() {
            vscode.postMessage({ command: 'openSettings' });
        }
        
        function refresh() {
            vscode.postMessage({ command: 'refresh' });
        }
    </script>
</body>
</html>`;
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
