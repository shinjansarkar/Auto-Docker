import * as vscode from 'vscode';
import * as path from 'path';
import { DockerFiles } from './llmService';
import { ProjectStructure } from './projectAnalyzer';
import {
    PathSanitizer,
    DockerignoreGenerator,
    FileWriteLock
} from './criticalErrorHandling';

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

        // Always write nginx.conf if provided (needed for frontend projects with nginx)
        if (dockerFiles.nginxConf) {
            filesToWrite.push({ name: 'nginx.conf', content: dockerFiles.nginxConf });
        }

        // REMOVED: .env.example generation (Issue #21 fix)
        // The extension will NOT generate .env.example files anymore

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

            try {
                // CRITICAL FIX #21: Validate path for special characters
                if (!PathSanitizer.isValidPath(filePath)) {
                    console.error(`Invalid path: ${filePath}`);
                    vscode.window.showErrorMessage(`Invalid file path: ${file.name}`);
                    continue;
                }

                // CRITICAL FIX #23: Use atomic file write with locking
                await FileWriteLock.writeFileWithLock(filePath, file.content);
                console.log(`Created: ${file.name}`);

                // CRITICAL FIX #22: Ensure .dockerignore has security entries
                if (file.name === '.dockerignore' || file.name === 'Dockerfile' || file.name === 'docker-compose.yml') {
                    if (file.name === '.dockerignore') {
                        DockerignoreGenerator.validateAndUpdateDockerigore(outputPath);
                    }
                }
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
                // ALWAYS generate nginx.conf for monorepos - critical for reverse proxy
                {
                    path: nginxConfPath,
                    content: this.generateMonorepoNginxConf(projectStructure),
                    name: 'nginx.conf'
                },
            ];

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
        return `# Stage 1: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \\
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \\
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \\
    else npm install; fi

# Copy source files
COPY . .

# Build for production
RUN npm run build

# Stage 2: Nginx Runtime
FROM nginx:alpine

# Copy built application from builder
COPY --from=builder /app/dist /usr/share/nginx/html
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx configuration for SPA routing
RUN echo 'server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Run as non-root user
USER nginx

CMD ["nginx", "-g", "daemon off;"]`;
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
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

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

        // CRITICAL FIX for Docker Config: Proper depends_on syntax and health checks
        let compose = `version: '3.8'

services:
  frontend:
    build: ./${projectStructure.frontendPath}
    container_name: app-frontend
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
      backend:
        condition: service_healthy
    restart: unless-stopped

  backend:
    build: ./${projectStructure.backendPath}
    container_name: app-backend
    ports:
      - "${backendPort}:${backendPort}"
    env_file:
      - .env
    volumes:
      - ./${projectStructure.backendPath}:/app${projectStructure.backendDependencies?.requirementsTxt ? '' : `
      - /app/node_modules`}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${backendPort}/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s
    restart: unless-stopped
    depends_on:`;

        // Add dependencies with proper syntax (CRITICAL FIX #6)
        const backendDeps: string[] = [];
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            projectStructure.databases.forEach(db => {
                if (db !== 'sqlite') {
                    backendDeps.push(db);
                }
            });
        }
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) {
            if (!backendDeps.includes('redis')) {
                backendDeps.push('redis');
            }
        }
        if (projectStructure.cacheLayer === 'memcached') {
            if (!backendDeps.includes('memcached')) {
                backendDeps.push('memcached');
            }
        }
        if (projectStructure.messageQueue === 'rabbitmq') {
            if (!backendDeps.includes('rabbitmq')) {
                backendDeps.push('rabbitmq');
            }
        }
        if (projectStructure.messageQueue === 'kafka') {
            if (!backendDeps.includes('kafka')) {
                backendDeps.push('kafka');
            }
        }
        if (projectStructure.searchEngine) {
            const searchService = projectStructure.searchEngine === 'opensearch' ? 'opensearch' : 'elasticsearch';
            if (!backendDeps.includes(searchService)) {
                backendDeps.push(searchService);
            }
        }

        if (backendDeps.length > 0) {
            backendDeps.forEach(dep => {
                compose += `\n      ${dep}:`;
                // Add condition: service_healthy for services with healthchecks
                if (['postgresql', 'mongodb', 'mysql', 'redis', 'rabbitmq', 'elasticsearch', 'opensearch'].includes(dep)) {
                    compose += `\n        condition: service_healthy`;
                } else {
                    compose += `\n        condition: service_started`;
                }
            });
        }

        compose += `

  nginx:
    image: nginx:alpine
    container_name: app-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - app-network
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s
    restart: unless-stopped
`;

        // Add databases with proper health checks (CRITICAL FIX #7)
        if (projectStructure.databases && projectStructure.databases.length > 0) {
            if (projectStructure.databases.includes('postgresql')) {
                compose += `
  postgresql:
    image: postgres:15-alpine
    container_name: app-postgres
    environment:
      POSTGRES_DB: \${POSTGRES_DB:-myapp_db}
      POSTGRES_USER: \${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-postgres} -d \${POSTGRES_DB:-myapp_db}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
`;
            }

            if (projectStructure.databases.includes('mongodb')) {
                compose += `
  mongodb:
    image: mongo:7-alpine
    container_name: app-mongo
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
      start_period: 20s
    restart: unless-stopped
`;
            }

            if (projectStructure.databases.includes('mysql')) {
                compose += `
  mysql:
    image: mysql:8.0-alpine
    container_name: app-mysql
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
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-u", "\${MYSQL_USER:-myapp}", "-p\${MYSQL_PASSWORD:-changeme}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
`;
            }
        }

        // Add Redis if needed (CRITICAL FIX #7: Health checks)
        if (projectStructure.cacheLayer === 'redis' || projectStructure.databases?.includes('redis')) {
            compose += `
  redis:
    image: redis:7-alpine
    container_name: app-redis
    command: redis-server --appendonly yes --requirepass \${REDIS_PASSWORD:-changeme}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped
`;
        }

        // Add Memcached
        if (projectStructure.cacheLayer === 'memcached') {
            compose += `
  memcached:
    image: memcached:alpine
    container_name: app-memcached
    networks:
      - app-network
    restart: unless-stopped
`;
        }

        // Add RabbitMQ
        if (projectStructure.messageQueue === 'rabbitmq') {
            compose += `
  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: app-rabbitmq
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
      start_period: 20s
    restart: unless-stopped
`;
        }

        // Add Kafka
        if (projectStructure.messageQueue === 'kafka') {
            compose += `
  zookeeper:
    image: confluentinc/cp-zookeeper:7.0.0-alpine
    container_name: app-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    networks:
      - app-network
    restart: unless-stopped

  kafka:
    image: confluentinc/cp-kafka:7.0.0-alpine
    container_name: app-kafka
    depends_on:
      zookeeper:
        condition: service_started
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    volumes:
      - kafka_data:/var/lib/kafka/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions.sh", "--bootstrap-server", "kafka:9092"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s
    restart: unless-stopped
`;
        }

        // Add Elasticsearch
        if (projectStructure.searchEngine === 'elasticsearch') {
            compose += `
  elasticsearch:
    image: elasticsearch:8.11.0-alpine
    container_name: app-elasticsearch
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
      start_period: 30s
    restart: unless-stopped
`;
        }

        // Add OpenSearch
        if (projectStructure.searchEngine === 'opensearch') {
            compose += `
  opensearch:
    image: opensearchproject/opensearch:latest-alpine
    container_name: app-opensearch
    environment:
      - discovery.type=single-node
      - OPENSEARCH_INITIAL_ADMIN_PASSWORD=\${OPENSEARCH_INITIAL_ADMIN_PASSWORD:-Admin123!}
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
    volumes:
      - opensearch_data:/usr/share/opensearch/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "curl -f https://localhost:9200/_cluster/health -k -u admin:Admin123! || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    restart: unless-stopped
`;
        }

        // Networks (CRITICAL FIX #8: Proper network configuration)
        compose += `
networks:
  app-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
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
        return `# ============================================================================
# Production-Ready Nginx Reverse Proxy for Monorepo Full-Stack Application
# Serves Frontend (React/Vue) + Routes API to Backend (Node.js/Python)
# ============================================================================

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=general:10m rate=50r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;

# Upstream servers with health checks
upstream frontend {
    server frontend:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

upstream backend {
    server backend:5000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    charset utf-8;
    
    # Security: Hide server tokens
    server_tokens off;
    
    # ========================================================================
    # LOGGING CONFIGURATION
    # ========================================================================
    access_log /var/log/nginx/access.log combined buffer=32k flush=5s;
    error_log /var/log/nginx/error.log warn;
    
    # ========================================================================
    # REQUEST LIMITS & TIMEOUTS
    # ========================================================================
    client_max_body_size 100m;
    client_body_timeout 30s;
    client_header_timeout 30s;
    keepalive_timeout 65s;
    send_timeout 30s;
    
    # ========================================================================
    # GZIP COMPRESSION
    # ========================================================================
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json 
               application/javascript application/xml+rss application/atom+xml 
               image/svg+xml font/truetype font/opentype application/vnd.ms-fontobject 
               application/font-woff2;
    
    # ========================================================================
    # GLOBAL SECURITY HEADERS
    # ========================================================================
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' wss: ws:; frame-ancestors 'self';" always;
    
    # ========================================================================
    # RATE LIMITING
    # ========================================================================
    limit_req zone=general burst=100 nodelay;
    limit_req_status 429;

    # ========================================================================
    # FRONTEND APPLICATION ROUTES
    # ========================================================================
    location / {
        # Apply rate limiting
        limit_req zone=general burst=100 nodelay;
        
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        
        # Connection upgrade for WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        
        # Client information headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
        
        # Cache bypass
        proxy_cache_bypass $http_upgrade;
    }

    # ========================================================================
    # BACKEND API ROUTES
    # ========================================================================
    location /api/ {
        # Stricter rate limiting for API
        limit_req zone=api burst=200 nodelay;
        
        proxy_pass http://backend/api/;
        proxy_http_version 1.1;
        
        # Connection settings
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for API
        proxy_connect_timeout 30s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # ========================================================================
    # WEBSOCKET SUPPORT - Socket.io for real-time apps
    # ========================================================================
    location /socket.io/ {
        proxy_pass http://backend/socket.io/;
        proxy_http_version 1.1;
        
        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Disable buffering for WebSocket
        proxy_buffering off;
        
        # Long-lived connection timeouts
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
    
    # ========================================================================
    # DENY SENSITIVE FILES & DIRECTORIES
    # ========================================================================
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ ~$ {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # ========================================================================
    # HEALTH CHECK ENDPOINT
    # ========================================================================
    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
    
    # ========================================================================
    # ERROR PAGES
    # ========================================================================
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        access_log off;
    }
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

    // CRITICAL FIX for Parsing Errors: Proper escaping of special characters in environment variables
    private escapeEnvVariable(value: string): string {
        if (!value) return '';

        // CRITICAL FIX: Escape special characters that break YAML/Docker syntax
        // Characters that need escaping in YAML values: quotes, colons, dashes, special chars
        let escaped = value;

        // Escape backslashes first
        escaped = escaped.replace(/\\/g, '\\\\');

        // Escape double quotes
        escaped = escaped.replace(/"/g, '\\"');

        // If value contains special characters, wrap in quotes
        if (/[:#@\[\]&*!|>'"`,{}\\]/.test(escaped)) {
            // Quote the value if it contains special YAML characters
            if (escaped.includes('"')) {
                escaped = `'${escaped}'`;
            } else {
                escaped = `"${escaped}"`;
            }
        }

        return escaped;
    }

    // CRITICAL FIX for Parsing Errors: Validate docker-compose syntax before returning
    private validateDockerComposeYAML(yaml: string): string {
        try {
            // Check if YAML is valid by basic structure validation
            const lines = yaml.split('\n');
            let inBlock = false;
            let blockIndent = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();

                // Skip empty lines and comments
                if (!trimmed || trimmed.startsWith('#')) {
                    continue;
                }

                // Check indentation consistency
                const indent = line.search(/\S/);

                // Ensure proper YAML structure
                if (trimmed.endsWith(':') && !trimmed.includes('|')) {
                    // Key without value should be followed by indented content
                    if (i < lines.length - 1) {
                        const nextLine = lines[i + 1];
                        const nextTrimmed = nextLine.trim();
                        const nextIndent = nextLine.search(/\S/);

                        if (nextTrimmed && nextIndent <= indent) {
                            console.warn(`YAML indentation issue at line ${i + 1}: ${trimmed}`);
                        }
                    }
                }
            }

            return yaml;
        } catch (error) {
            console.warn('YAML validation warning:', error);
            return yaml;
        }
    }
}