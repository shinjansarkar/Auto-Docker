import * as vscode from 'vscode';
import * as path from 'path';
import { DockerFiles } from './llmService';

export class FileManager {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async writeDockerFiles(dockerFiles: DockerFiles): Promise<void> {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const customPath = config.get<string>('dockerOutputPath', '');
        const overwriteFiles = config.get<boolean>('overwriteFiles', false);

        const outputPath = customPath 
            ? path.join(this.workspaceRoot, customPath)
            : this.workspaceRoot;

        const filesToWrite = [
            { name: 'Dockerfile', content: dockerFiles.dockerfile },
            { name: 'docker-compose.yml', content: dockerFiles.dockerCompose },
            { name: '.dockerignore', content: dockerFiles.dockerIgnore }
        ];

        if (dockerFiles.nginxConf) {
            filesToWrite.push({ name: 'nginx.conf', content: dockerFiles.nginxConf });
        }

        const existingFiles: string[] = [];
        const newFiles: string[] = [];

        // Check which files already exist
        for (const file of filesToWrite) {
            const filePath = path.join(outputPath, file.name);
            const fileUri = vscode.Uri.file(filePath);
            
            try {
                await vscode.workspace.fs.stat(fileUri);
                existingFiles.push(file.name);
            } catch {
                newFiles.push(file.name);
            }
        }

        // Handle existing files
        if (existingFiles.length > 0 && !overwriteFiles) {
            const choice = await this.showOverwriteDialog(existingFiles);
            
            switch (choice) {
                case 'Overwrite All':
                    break;
                case 'Skip Existing':
                    // Only write new files
                    const filteredFiles = filesToWrite.filter(f => newFiles.includes(f.name));
                    await this.writeFiles(filteredFiles, outputPath);
                    this.showSuccessMessage(filteredFiles.map(f => f.name), existingFiles);
                    return;
                case 'Cancel':
                    return;
                default:
                    return;
            }
        }

        // Write all files
        await this.writeFiles(filesToWrite, outputPath);
        this.showSuccessMessage(filesToWrite.map(f => f.name), []);
    }

    private async writeFiles(files: Array<{ name: string; content: string }>, outputPath: string): Promise<void> {
        for (const file of files) {
            const filePath = path.join(outputPath, file.name);
            const fileUri = vscode.Uri.file(filePath);
            
            try {
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(file.content, 'utf8'));
                console.log(`Created: ${file.name}`);
            } catch (error) {
                console.error(`Failed to write ${file.name}:`, error);
                vscode.window.showErrorMessage(`Failed to write ${file.name}: ${error}`);
            }
        }
    }

    private async showOverwriteDialog(existingFiles: string[]): Promise<string | undefined> {
        const fileList = existingFiles.join(', ');
        const message = `The following Docker files already exist: ${fileList}. What would you like to do?`;
        
        return await vscode.window.showWarningMessage(
            message,
            { modal: true },
            'Overwrite All',
            'Skip Existing',
            'Cancel'
        );
    }

    private showSuccessMessage(writtenFiles: string[], skippedFiles: string[]): void {
        let message = `Successfully generated Docker files: ${writtenFiles.join(', ')}`;
        
        if (skippedFiles.length > 0) {
            message += `. Skipped existing files: ${skippedFiles.join(', ')}`;
        }

        vscode.window.showInformationMessage(message, 'Open Files').then(choice => {
            if (choice === 'Open Files') {
                this.openGeneratedFiles(writtenFiles);
            }
        });
    }

    private async openGeneratedFiles(fileNames: string[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const customPath = config.get<string>('dockerOutputPath', '');
        
        const outputPath = customPath 
            ? path.join(this.workspaceRoot, customPath)
            : this.workspaceRoot;

        for (const fileName of fileNames) {
            const filePath = path.join(outputPath, fileName);
            const fileUri = vscode.Uri.file(filePath);
            
            try {
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document, { preview: false });
            } catch (error) {
                console.error(`Failed to open ${fileName}:`, error);
            }
        }
    }

    async validateWorkspace(): Promise<boolean> {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder is open. Please open a project folder first.');
            return false;
        }

        return true;
    }

    async backupExistingFiles(): Promise<void> {
        const filesToBackup = ['Dockerfile', 'docker-compose.yml', '.dockerignore', 'nginx.conf'];
        const backupDir = path.join(this.workspaceRoot, '.docker-backup');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        for (const fileName of filesToBackup) {
            const filePath = path.join(this.workspaceRoot, fileName);
            const fileUri = vscode.Uri.file(filePath);
            
            try {
                const fileContent = await vscode.workspace.fs.readFile(fileUri);
                const backupPath = path.join(backupDir, `${fileName}.${timestamp}.backup`);
                const backupUri = vscode.Uri.file(backupPath);
                
                await vscode.workspace.fs.writeFile(backupUri, fileContent);
                console.log(`Backed up: ${fileName}`);
            } catch {
                // File doesn't exist, skip backup
            }
        }
    }

    async showPreview(dockerFiles: DockerFiles): Promise<boolean> {
        try {
            const panel = vscode.window.createWebviewPanel(
                'dockerPreview',
                'Docker Files Preview',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.webview.html = this.getPreviewHtml(dockerFiles);

            return new Promise((resolve) => {
                let resolved = false;

                const resolveOnce = (value: boolean) => {
                    if (!resolved) {
                        resolved = true;
                        resolve(value);
                    }
                };

                panel.webview.onDidReceiveMessage(message => {
                    console.log('Webview received message:', message);
                    if (!resolved) {
                        switch (message.command) {
                            case 'confirm':
                                console.log('User confirmed file creation - resolving with TRUE');
                                resolveOnce(true);
                                setTimeout(() => panel.dispose(), 100); // Delay disposal
                                break;
                            case 'cancel':
                                console.log('User cancelled file creation - resolving with FALSE');
                                resolveOnce(false);
                                setTimeout(() => panel.dispose(), 100); // Delay disposal
                                break;
                            default:
                                console.log('Unknown command:', message.command);
                        }
                    } else {
                        console.log('Message received after resolution - ignoring');
                    }
                });

                panel.onDidDispose(() => {
                    console.log('Preview panel disposed');
                    if (!resolved) {
                        console.log('Panel disposed without user action - treating as cancel');
                        resolveOnce(false);
                    }
                });

                // Timeout after 5 minutes
                setTimeout(() => {
                    if (!resolved) {
                        panel.dispose();
                        resolveOnce(false);
                    }
                }, 300000);
            });
        } catch (error) {
            console.error('Error showing preview:', error);
            vscode.window.showErrorMessage('Failed to show preview. Creating files directly...');
            return true; // Fallback to creating files directly
        }
    }

    private getPreviewHtml(dockerFiles: DockerFiles): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docker Files Preview</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        .file-section {
            margin-bottom: 30px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
        }
        .file-header {
            background-color: var(--vscode-panel-background);
            padding: 10px 15px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .file-content {
            padding: 15px;
            background-color: var(--vscode-editor-background);
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre-wrap;
            overflow-x: auto;
        }
        .buttons {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            margin-left: 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .cancel-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .cancel-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h1>Generated Docker Files Preview</h1>
    
    <div class="file-section">
        <div class="file-header">📦 Dockerfile</div>
        <div class="file-content">${this.escapeHtml(dockerFiles.dockerfile)}</div>
    </div>

    <div class="file-section">
        <div class="file-header">🐳 docker-compose.yml</div>
        <div class="file-content">${this.escapeHtml(dockerFiles.dockerCompose)}</div>
    </div>

    <div class="file-section">
        <div class="file-header">🚫 .dockerignore</div>
        <div class="file-content">${this.escapeHtml(dockerFiles.dockerIgnore)}</div>
    </div>

    ${dockerFiles.nginxConf ? `
    <div class="file-section">
        <div class="file-header">🌐 nginx.conf</div>
        <div class="file-content">${this.escapeHtml(dockerFiles.nginxConf)}</div>
    </div>
    ` : ''}

    <div class="buttons">
        <button id="cancelBtn" class="cancel-btn">Cancel</button>
        <button id="confirmBtn">Create Files</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let actionTaken = false; // Prevent double actions
        
        function handleConfirm() {
            if (actionTaken) {
                console.log('Action already taken, ignoring confirm');
                return;
            }
            actionTaken = true;
            console.log('CONFIRM: User clicked Create Files');
            
            try {
                vscode.postMessage({ command: 'confirm' });
                console.log('CONFIRM: Message sent successfully');
                
                // Disable buttons
                document.getElementById('confirmBtn').disabled = true;
                document.getElementById('cancelBtn').disabled = true;
                document.getElementById('confirmBtn').textContent = 'Creating...';
            } catch (error) {
                console.error('CONFIRM: Error sending message:', error);
                actionTaken = false; // Reset on error
            }
        }
        
        function handleCancel() {
            if (actionTaken) {
                console.log('Action already taken, ignoring cancel');
                return;
            }
            actionTaken = true;
            console.log('CANCEL: User clicked Cancel');
            
            try {
                vscode.postMessage({ command: 'cancel' });
                console.log('CANCEL: Message sent successfully');
                
                // Disable buttons
                document.getElementById('confirmBtn').disabled = true;
                document.getElementById('cancelBtn').disabled = true;
                document.getElementById('cancelBtn').textContent = 'Cancelled';
            } catch (error) {
                console.error('CANCEL: Error sending message:', error);
                actionTaken = false; // Reset on error
            }
        }

        // Set up event listeners when DOM is ready
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded - setting up button listeners');
            
            const confirmBtn = document.getElementById('confirmBtn');
            const cancelBtn = document.getElementById('cancelBtn');
            
            if (confirmBtn) {
                confirmBtn.addEventListener('click', handleConfirm);
                console.log('Confirm button listener added');
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', handleCancel);
                console.log('Cancel button listener added');
            }
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}