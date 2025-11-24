import * as vscode from 'vscode';
import * as path from 'path';
import { DockerFiles } from './llmService';
import { ProjectStructure } from './projectAnalyzer';

export class FileManager {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    async writeDockerFiles(dockerFiles: DockerFiles, projectStructure?: ProjectStructure): Promise<void> {
        const config = vscode.workspace.getConfiguration('autoDocker');
        const customPath = config.get<string>('dockerOutputPath', '');
        const overwriteFiles = config.get<boolean>('overwriteFiles', false);

        const outputPath = customPath 
            ? path.join(this.workspaceRoot, customPath)
            : this.workspaceRoot;

        // Check if it's a monorepo structure
        if (projectStructure?.isMonorepo && projectStructure.frontendPath && projectStructure.backendPath) {
            await this.writeMonorepoDockerFiles(dockerFiles, projectStructure, overwriteFiles);
            return;
        }

        const filesToWrite = [
            { name: 'Dockerfile', content: dockerFiles.dockerfile },
            { name: 'docker-compose.yml', content: dockerFiles.dockerCompose },
            { name: '.dockerignore', content: dockerFiles.dockerIgnore }
        ];

        if (dockerFiles.nginxConf) {
            filesToWrite.push({ name: 'nginx.conf', content: dockerFiles.nginxConf });
        }

        // Generate comprehensive .env.example based on detected services
        const envExamplePath = path.join(this.workspaceRoot, '.env.example');
        const envExampleUri = vscode.Uri.file(envExamplePath);
        
        try {
            await vscode.workspace.fs.stat(envExampleUri);
            // .env.example already exists, don't overwrite
        } catch {
            // Create comprehensive .env.example
            const envExampleContent = this.generateComprehensiveEnv(projectStructure || {} as ProjectStructure);
            filesToWrite.push({ name: '.env.example', content: envExampleContent });
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

    private generateEnvExample(envVars: string[]): string {
        const header = `# Environment Variables Template
# Copy this file to .env and fill in your actual values
# DO NOT commit .env to version control

`;
        const vars = envVars.map(varName => {
            // Add helpful comments for common env vars
            const comment = this.getEnvVarComment(varName);
            return comment ? `# ${comment}\n${varName}=\n` : `${varName}=\n`;
        }).join('\n');

        return header + vars;
    }

    private generateComprehensiveEnv(projectStructure: ProjectStructure): string {
        let content = '# ==========================================\n';
        content += '# Environment Configuration\n';
        content += '# Generated by Auto Docker Extension\n';
        content += '# ==========================================\n\n';

        // Application
        content += '# Application Configuration\n';
        content += 'NODE_ENV=development\n';
        content += 'PORT=3000\n';
        if (projectStructure.backend) {
            content += 'API_PORT=5000\n';
        }
        content += '\n';

        // Databases
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            content += '# Database Configuration\n';
            
            if (projectStructure.databases.includes('postgresql')) {
                content += '# PostgreSQL\n';
                content += 'POSTGRES_HOST=postgres\n';
                content += 'POSTGRES_PORT=5432\n';
                content += 'POSTGRES_DB=myapp_db\n';
                content += 'POSTGRES_USER=postgres\n';
                content += 'POSTGRES_PASSWORD=changeme\n';
                content += 'DATABASE_URL=postgresql://postgres:changeme@postgres:5432/myapp_db\n\n';
            }
            
            if (projectStructure.databases.includes('mongodb')) {
                content += '# MongoDB\n';
                content += 'MONGO_HOST=mongodb\n';
                content += 'MONGO_PORT=27017\n';
                content += 'MONGO_DB=myapp_db\n';
                content += 'MONGO_INITDB_ROOT_USERNAME=root\n';
                content += 'MONGO_INITDB_ROOT_PASSWORD=changeme\n';
                content += 'MONGO_URI=mongodb://root:changeme@mongodb:27017/myapp_db?authSource=admin\n\n';
            }
            
            if (projectStructure.databases.includes('mysql')) {
                content += '# MySQL\n';
                content += 'MYSQL_HOST=mysql\n';
                content += 'MYSQL_PORT=3306\n';
                content += 'MYSQL_DATABASE=myapp_db\n';
                content += 'MYSQL_USER=myapp\n';
                content += 'MYSQL_PASSWORD=changeme\n';
                content += 'MYSQL_ROOT_PASSWORD=rootchangeme\n\n';
            }
        }

        // Cache Layer
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) {
            content += '# Redis Configuration\n';
            content += 'REDIS_HOST=redis\n';
            content += 'REDIS_PORT=6379\n';
            content += 'REDIS_PASSWORD=\n';
            content += 'REDIS_URL=redis://redis:6379\n\n';
        } else if (projectStructure.cacheLayer === 'memcached') {
            content += '# Memcached Configuration\n';
            content += 'MEMCACHED_HOST=memcached\n';
            content += 'MEMCACHED_PORT=11211\n\n';
        }

        // Message Queue
        if (projectStructure.messageQueue === 'rabbitmq') {
            content += '# RabbitMQ Configuration\n';
            content += 'RABBITMQ_HOST=rabbitmq\n';
            content += 'RABBITMQ_PORT=5672\n';
            content += 'RABBITMQ_DEFAULT_USER=guest\n';
            content += 'RABBITMQ_DEFAULT_PASS=guest\n';
            content += 'RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672\n\n';
        } else if (projectStructure.messageQueue === 'kafka') {
            content += '# Kafka Configuration\n';
            content += 'KAFKA_BROKERS=kafka:9092\n';
            content += 'KAFKA_CLIENT_ID=myapp\n';
            content += 'KAFKA_GROUP_ID=myapp-group\n\n';
        }

        // Search Engine
        if (projectStructure.searchEngine === 'elasticsearch') {
            content += '# Elasticsearch Configuration\n';
            content += 'ELASTICSEARCH_NODE=http://elasticsearch:9200\n';
            content += 'ELASTIC_PASSWORD=changeme\n\n';
        } else if (projectStructure.searchEngine === 'opensearch') {
            content += '# OpenSearch Configuration\n';
            content += 'OPENSEARCH_NODE=http://opensearch:9200\n';
            content += 'OPENSEARCH_INITIAL_ADMIN_PASSWORD=changeme\n\n';
        }

        // Security
        content += '# Security Configuration\n';
        content += 'JWT_SECRET=change-this-to-a-random-secret-in-production\n';
        content += 'JWT_EXPIRES_IN=24h\n';
        content += 'SESSION_SECRET=change-this-session-secret\n\n';

        // CORS
        if (projectStructure.frontend) {
            content += '# CORS Configuration\n';
            content += 'CORS_ORIGIN=http://localhost:3000\n';
            content += 'CORS_CREDENTIALS=true\n\n';
        }

        return content;
    }

    private getEnvVarComment(varName: string): string {
        const upperName = varName.toUpperCase();
        
        if (upperName.includes('PORT')) return 'Application port';
        if (upperName.includes('DATABASE') || upperName.includes('DB')) {
            if (upperName.includes('URL') || upperName.includes('URI')) return 'Database connection string';
            if (upperName.includes('HOST')) return 'Database host';
            if (upperName.includes('USER')) return 'Database username';
            if (upperName.includes('PASSWORD') || upperName.includes('PASS')) return 'Database password';
            if (upperName.includes('NAME')) return 'Database name';
        }
        if (upperName.includes('API_KEY') || upperName.includes('APIKEY')) return 'API key';
        if (upperName.includes('SECRET')) return 'Secret key';
        if (upperName.includes('NODE_ENV')) return 'Environment (development, production, test)';
        if (upperName.includes('JWT')) return 'JWT configuration';
        if (upperName.includes('REDIS')) return 'Redis configuration';
        
        return '';
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

    private async writeMonorepoDockerFiles(dockerFiles: DockerFiles, projectStructure: ProjectStructure, overwriteFiles: boolean): Promise<void> {
        try {
            const frontendPath = path.join(this.workspaceRoot, projectStructure.frontendPath!);
            const backendPath = path.join(this.workspaceRoot, projectStructure.backendPath!);

            // Generate frontend Dockerfile
            const frontendDockerfile = this.generateMonorepoFrontendDockerfile(projectStructure);
            const frontendDockerfilePath = path.join(frontendPath, 'Dockerfile');
            
            // Generate backend Dockerfile
            const backendDockerfile = this.generateMonorepoBackendDockerfile(projectStructure);
            const backendDockerfilePath = path.join(backendPath, 'Dockerfile');

            // Generate .dockerignore for both
            const dockerignore = dockerFiles.dockerIgnore;
            const frontendDockerignorePath = path.join(frontendPath, '.dockerignore');
            const backendDockerignorePath = path.join(backendPath, '.dockerignore');

            // Generate root-level docker-compose.yml and nginx.conf
            const dockerComposePath = path.join(this.workspaceRoot, 'docker-compose.yml');
            const nginxConfPath = path.join(this.workspaceRoot, 'nginx.conf');

            const filesToWrite = [
                { path: frontendDockerfilePath, content: frontendDockerfile, name: `${projectStructure.frontendPath}/Dockerfile` },
                { path: backendDockerfilePath, content: backendDockerfile, name: `${projectStructure.backendPath}/Dockerfile` },
                { path: frontendDockerignorePath, content: dockerignore, name: `${projectStructure.frontendPath}/.dockerignore` },
                { path: backendDockerignorePath, content: dockerignore, name: `${projectStructure.backendPath}/.dockerignore` },
                { path: dockerComposePath, content: this.generateMonorepoDockerCompose(projectStructure), name: 'docker-compose.yml' },
            ];

            if (dockerFiles.nginxConf) {
                filesToWrite.push({ 
                    path: nginxConfPath, 
                    content: this.generateMonorepoNginxConf(projectStructure), 
                    name: 'nginx.conf' 
                });
            }

            // Write all files
            for (const file of filesToWrite) {
                const fileUri = vscode.Uri.file(file.path);
                
                // Check if file exists
                let exists = false;
                try {
                    await vscode.workspace.fs.stat(fileUri);
                    exists = true;
                } catch {
                    // File doesn't exist
                }

                if (exists && !overwriteFiles) {
                    const choice = await vscode.window.showWarningMessage(
                        `${file.name} already exists. Overwrite?`,
                        'Yes', 'No'
                    );
                    if (choice !== 'Yes') {
                        continue;
                    }
                }

                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(file.content, 'utf8'));
            }

            vscode.window.showInformationMessage(
                `✅ Monorepo Docker files created successfully!\n` +
                `- ${projectStructure.frontendPath}/Dockerfile\n` +
                `- ${projectStructure.backendPath}/Dockerfile\n` +
                `- docker-compose.yml\n` +
                `- nginx.conf`
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Error writing monorepo Docker files: ${error}`);
        }
    }

    private generateMonorepoFrontendDockerfile(projectStructure: ProjectStructure): string {
        return `FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

# Copy source files
COPY . .

# Expose port
EXPOSE 3000

# Run dev server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]`;
    }

    private generateMonorepoBackendDockerfile(projectStructure: ProjectStructure): string {
        // Check if it's Python or Node.js backend
        const isPython = projectStructure.backendDependencies?.requirementsTxt;
        
        if (isPython) {
            return `FROM python:3.11-slim
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy source files
COPY . .

# Expose port
EXPOSE 5000

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]`;
        } else {
            return `FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

# Copy source files
COPY . .

# Expose port
EXPOSE 5000

# Run application
CMD ["npm", "start"]`;
        }
    }

    private generateMonorepoDockerCompose(projectStructure: ProjectStructure): string {
        const hasEnv = projectStructure.hasEnvFile;
        const backendPort = projectStructure.backendDependencies?.requirementsTxt ? '5000' : '5000';
        
        const dependencies = ['backend'];
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            projectStructure.databases.forEach(db => dependencies.push(db));
        }
        if (projectStructure.cacheLayer) dependencies.push(projectStructure.cacheLayer);
        if (projectStructure.messageQueue) dependencies.push(projectStructure.messageQueue);
        if (projectStructure.searchEngine) dependencies.push(projectStructure.searchEngine);
        
        let compose = `services:
  frontend:
    build: ./${projectStructure.frontendPath}
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./${projectStructure.frontendPath}:/app
      - /app/node_modules
    networks:
      - app-network
    depends_on:
      - backend

  backend:
    build: ./${projectStructure.backendPath}
    ports:
      - "${backendPort}:${backendPort}"
    env_file:
      - .env
    volumes:
      - ./${projectStructure.backendPath}:/app${projectStructure.backendDependencies?.requirementsTxt ? '' : `
      - /app/node_modules`}
    networks:
      - app-network
    depends_on:`;

        // Add dependencies
        const backendDeps: string[] = [];
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            projectStructure.databases.forEach(db => {
                if (db !== 'sqlite') backendDeps.push(db);
            });
        }
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) {
            if (!backendDeps.includes('redis')) backendDeps.push('redis');
        }
        if (projectStructure.cacheLayer === 'memcached') backendDeps.push('memcached');
        if (projectStructure.messageQueue) backendDeps.push(projectStructure.messageQueue);
        if (projectStructure.searchEngine) backendDeps.push(projectStructure.searchEngine);

        if (backendDeps.length > 0) {
            backendDeps.forEach(dep => {
                compose += `\n      - ${dep}`;
            });
        }

        compose += `

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - frontend
      - backend
    networks:
      - app-network
`;

        // Add databases
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            if (projectStructure.databases.includes('postgresql')) {
                compose += `
  postgresql:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-myapp_db}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
            }

            if (projectStructure.databases.includes('mongodb')) {
                compose += `
  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${MONGO_INITDB_ROOT_USERNAME:-root}
      MONGO_INITDB_ROOT_PASSWORD: \${MONGO_INITDB_ROOT_PASSWORD:-changeme}
    volumes:
      - mongodb_data:/data/db
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
            }

            if (projectStructure.databases.includes('mysql')) {
                compose += `
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: \${MYSQL_ROOT_PASSWORD:-rootchangeme}
      MYSQL_DATABASE: \${MYSQL_DATABASE:-myapp_db}
      MYSQL_USER: \${MYSQL_USER:-myapp}
      MYSQL_PASSWORD: \${MYSQL_PASSWORD:-changeme}
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
            }
        }

        // Add Redis if needed
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) {
            compose += `
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
        }

        // Add Memcached
        if (projectStructure.cacheLayer === 'memcached') {
            compose += `
  memcached:
    image: memcached:alpine
    networks:
      - app-network
`;
        }

        // Add RabbitMQ
        if (projectStructure.messageQueue === 'rabbitmq') {
            compose += `
  rabbitmq:
    image: rabbitmq:3-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: \${RABBITMQ_DEFAULT_USER:-guest}
      RABBITMQ_DEFAULT_PASS: \${RABBITMQ_DEFAULT_PASS:-guest}
    ports:
      - "15672:15672"  # Management UI
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
        }

        // Add Kafka
        if (projectStructure.messageQueue === 'kafka') {
            compose += `
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - app-network

  kafka:
    image: confluentinc/cp-kafka:latest
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - app-network
`;
        }

        // Add Elasticsearch
        if (projectStructure.searchEngine === 'elasticsearch') {
            compose += `
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - ELASTIC_PASSWORD=\${ELASTIC_PASSWORD:-changeme}
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
        }

        // Add OpenSearch
        if (projectStructure.searchEngine === 'opensearch') {
            compose += `
  opensearch:
    image: opensearchproject/opensearch:latest
    environment:
      - discovery.type=single-node
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=\${OPENSEARCH_INITIAL_ADMIN_PASSWORD:-Admin123!}
    volumes:
      - opensearch_data:/usr/share/opensearch/data
    networks:
      - app-network
`;
        }

        // Networks
        compose += `
networks:
  app-network:
    driver: bridge
`;

        // Volumes
        const volumes = [];
        if (projectStructure.databases?.includes('postgresql')) volumes.push('postgres_data');
        if (projectStructure.databases?.includes('mongodb')) volumes.push('mongodb_data');
        if (projectStructure.databases?.includes('mysql')) volumes.push('mysql_data');
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) volumes.push('redis_data');
        if (projectStructure.messageQueue === 'rabbitmq') volumes.push('rabbitmq_data');
        if (projectStructure.messageQueue === 'kafka') volumes.push('kafka_data');
        if (projectStructure.searchEngine === 'elasticsearch') volumes.push('elasticsearch_data');
        if (projectStructure.searchEngine === 'opensearch') volumes.push('opensearch_data');

        if (volumes.length > 0) {
            compose += `\nvolumes:\n`;
            volumes.forEach(volume => {
                compose += `  ${volume}:\n`;
            });
        }

        return compose;
    }

    private generateMonorepoNginxConf(projectStructure: ProjectStructure): string {
        return `# Upstream servers
upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:5000;
}

server {
    listen 80;
    server_name localhost;

    # Frontend routes
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API routes
    location /api/ {
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for Socket.io and real-time features
    location /socket.io/ {
        proxy_pass http://backend/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}`;
    }

    private getDatabaseImage(database?: string): string {
        switch (database) {
            case 'postgresql': return 'postgres:15-alpine';
            case 'mysql': return 'mysql:8.0';
            case 'mongodb': return 'mongo:7';
            default: return 'postgres:15-alpine';
        }
    }
}