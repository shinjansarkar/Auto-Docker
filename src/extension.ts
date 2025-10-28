import * as vscode from 'vscode';
import { ProjectAnalyzer } from './projectAnalyzer';
import { LLMService } from './llmService';
import { FileManager } from './fileManager';

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

    // Add commands to subscriptions
    context.subscriptions.push(analyzeCommand, regenerateCommand, directModeCommand, configureApiKeysCommand);

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('hasShownWelcome', false);
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

async function analyzeProject(skipPreview: boolean = false): Promise<void> {
    try {
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine('🔍 Starting project analysis...');

        // Validate workspace
        const fileManager = new FileManager(getWorkspaceRoot());
        if (!await fileManager.validateWorkspace()) {
            return;
        }

        // Check API configuration
        if (!await validateApiConfiguration()) {
            return;
        }

        // Show progress
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Analyzing project and generating Docker files...",
            cancellable: false
        }, async (progress) => {
            // Step 1: Analyze project structure
            progress.report({ increment: 20, message: "Analyzing project structure..." });
            outputChannel.appendLine('📁 Analyzing project structure...');
            
            const analyzer = new ProjectAnalyzer(getWorkspaceRoot());
            const projectStructure = await analyzer.analyzeProject();
            
            outputChannel.appendLine(`Project type detected: ${projectStructure.projectType}`);
            if (projectStructure.frontend) {
                outputChannel.appendLine(`Frontend: ${projectStructure.frontend}`);
            }
            if (projectStructure.backend) {
                outputChannel.appendLine(`Backend: ${projectStructure.backend}`);
            }
            if (projectStructure.database) {
                outputChannel.appendLine(`Database: ${projectStructure.database}`);
            }

            // Step 2: Generate Docker files with LLM
            progress.report({ increment: 50, message: "Generating Docker files with AI..." });
            outputChannel.appendLine('🤖 Generating Docker files with LLM...');
            
            const llmService = new LLMService();
            const dockerFiles = await llmService.generateDockerFiles(projectStructure);

            // Step 3: Show preview and get confirmation
            progress.report({ increment: 70, message: "Preparing preview..." });
            outputChannel.appendLine('👀 Preparing preview...');
            
            let confirmed = false;
            
            if (skipPreview) {
                outputChannel.appendLine('Skipping preview (direct mode)...');
                confirmed = true;
            } else {
                try {
                    outputChannel.appendLine('Showing preview panel...');
                    confirmed = await fileManager.showPreview(dockerFiles);
                    outputChannel.appendLine(`📋 Preview completed with result: ${confirmed ? '✅ CONFIRMED (Create Files clicked)' : '❌ CANCELLED (Cancel clicked or panel closed)'}`);
                } catch (error) {
                    outputChannel.appendLine(`Preview error: ${error}. Asking user for direct creation...`);
                    
                    // Ask user if they want to create files directly
                    const choice = await vscode.window.showWarningMessage(
                        'Preview failed to load. Would you like to create the Docker files directly?',
                        { modal: true },
                        'Yes, Create Files',
                        'Cancel'
                    );
                    
                    confirmed = choice === 'Yes, Create Files';
                }
            }
            
            if (!confirmed) {
                outputChannel.appendLine('❌ File creation cancelled by user');
                vscode.window.showInformationMessage('Docker file generation cancelled. You can try again anytime!', 'Try Direct Mode').then(choice => {
                    if (choice === 'Try Direct Mode') {
                        analyzeProject(true); // Retry without preview
                    }
                });
                return;
            } else {
                outputChannel.appendLine('✅ User confirmed - proceeding with file creation...');
            }

            // Step 4: Write files to workspace
            progress.report({ increment: 90, message: "Writing Docker files..." });
            outputChannel.appendLine('📝 Writing Docker files to workspace...');
            
            await fileManager.writeDockerFiles(dockerFiles);
            
            progress.report({ increment: 100, message: "Complete!" });
            outputChannel.appendLine('✅ Docker files generated successfully!');
        });

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        outputChannel.appendLine(`❌ Error: ${errorMessage}`);
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

export function deactivate() {
    if (outputChannel) {
        outputChannel.dispose();
    }
}
