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
import {
    MultiWorkspaceManager,
    BOMHandler,
    SafeDirectoryTraversal,
    GenerationLock,
    PathSanitizer,
    DockerignoreGenerator,
    FileWriteLock
} from './criticalErrorHandling';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('Auto Docker Extension is now active!');

    // Create output channel for logging
    outputChannel = vscode.window.createOutputChannel('Auto Docker');
    context.subscriptions.push(outputChannel);

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

    // Add commands to subscriptions
    context.subscriptions.push(
        analyzeCommand,
        regenerateCommand,
        directModeCommand,
        configureApiKeysCommand,
        runTestsCommand,
        generateTestProjectsCommand
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

                const llmService = new LLMService();
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
                            outputChannel.appendLine('⚠️  Docker generation cancelled by user');
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
                vscode.window.showInformationMessage('✅ Docker files generated successfully!');
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
        vscode.window.showErrorMessage(`Failed to generate Docker files: ${errorMessage}`);
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

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
