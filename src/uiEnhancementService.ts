import * as vscode from 'vscode';
import * as path from 'path';

/**
 * UI Enhancement Service
 * 
 * Advanced UI/UX system for enhanced user experience with interactive
 * dashboards, visual explorers, real-time updates, and beautiful notifications.
 * 
 * @version 2.8.0
 * @since Phase 10
 */

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface StatusBarConfig {
    text: string;
    tooltip: string;
    color?: string;
    backgroundColor?: vscode.ThemeColor;
    command?: string;
    priority?: number;
}

export interface NotificationConfig {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
    actions?: Array<{ title: string; callback: () => void }>;
    modal?: boolean;
    progress?: boolean;
    duration?: number;
}

export interface QuickPickConfig {
    title: string;
    placeholder: string;
    items: Array<{
        label: string;
        description?: string;
        detail?: string;
        value: any;
        icon?: string;
    }>;
    canPickMany?: boolean;
    matchOnDescription?: boolean;
    matchOnDetail?: boolean;
}

export interface ProgressConfig {
    title: string;
    location: 'notification' | 'window' | 'source-control';
    cancellable?: boolean;
    steps?: Array<{
        message: string;
        increment: number;
        duration?: number;
    }>;
}

export interface DashboardData {
    overview: {
        totalGenerations: number;
        successRate: number;
        avgQuality: number;
        totalCost: number;
    };
    recentActivity: Array<{
        timestamp: Date;
        action: string;
        result: string;
        duration: number;
    }>;
    metrics: {
        security: { score: number; issues: number };
        dependencies: { total: number; vulnerable: number };
        prompts: { avgTokens: number; quality: number };
    };
    recommendations: string[];
}

export interface ProjectExplorerNode {
    id: string;
    label: string;
    type: 'project' | 'category' | 'file' | 'metric';
    description?: string;
    tooltip?: string;
    icon?: string;
    children?: ProjectExplorerNode[];
    contextValue?: string;
    command?: vscode.Command;
}

// ============================================================================
// STATUS BAR MANAGER
// ============================================================================

export class StatusBarManager {
    private statusBarItems: Map<string, vscode.StatusBarItem> = new Map();
    private updateTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        // Initialize default status bar items
        this.createStatusBarItem('autoDocker.main', {
            text: '$(docker) Auto Docker',
            tooltip: 'Click to open Auto Docker menu',
            command: 'autoDocker.showQuickPick',
            priority: 100
        });
    }

    public createStatusBarItem(id: string, config: StatusBarConfig): vscode.StatusBarItem {
        if (this.statusBarItems.has(id)) {
            return this.statusBarItems.get(id)!;
        }

        const item = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            config.priority || 100
        );

        item.text = config.text;
        item.tooltip = config.tooltip;
        
        if (config.color) {
            item.color = config.color;
        }
        
        if (config.backgroundColor) {
            item.backgroundColor = config.backgroundColor;
        }
        
        if (config.command) {
            item.command = config.command;
        }

        item.show();
        this.statusBarItems.set(id, item);
        return item;
    }

    public updateStatusBar(id: string, config: Partial<StatusBarConfig>): void {
        const item = this.statusBarItems.get(id);
        if (!item) return;

        if (config.text) item.text = config.text;
        if (config.tooltip) item.tooltip = config.tooltip;
        if (config.color) item.color = config.color;
        if (config.backgroundColor) item.backgroundColor = config.backgroundColor;
        if (config.command) item.command = config.command;
    }

    public showProgress(id: string, text: string, duration?: number): void {
        const item = this.statusBarItems.get(id);
        if (!item) return;

        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let frameIndex = 0;
        const originalText = item.text;

        const timer = setInterval(() => {
            item.text = `${frames[frameIndex]} ${text}`;
            frameIndex = (frameIndex + 1) % frames.length;
        }, 100);

        this.updateTimers.set(id, timer);

        if (duration) {
            setTimeout(() => {
                this.stopProgress(id, originalText);
            }, duration);
        }
    }

    public stopProgress(id: string, finalText?: string): void {
        const timer = this.updateTimers.get(id);
        if (timer) {
            clearInterval(timer);
            this.updateTimers.delete(id);
        }

        if (finalText) {
            const item = this.statusBarItems.get(id);
            if (item) {
                item.text = finalText;
            }
        }
    }

    public dispose(): void {
        this.updateTimers.forEach(timer => clearInterval(timer));
        this.statusBarItems.forEach(item => item.dispose());
    }
}

// ============================================================================
// NOTIFICATION MANAGER
// ============================================================================

export class NotificationManager {
    private notificationQueue: NotificationConfig[] = [];
    private isProcessing = false;

    public async showNotification(config: NotificationConfig): Promise<string | undefined> {
        const actions = config.actions?.map(a => a.title) || [];
        let result: string | undefined;

        switch (config.type) {
            case 'success':
                result = await vscode.window.showInformationMessage(
                    `✅ ${config.message}`,
                    { modal: config.modal },
                    ...actions
                );
                break;
            case 'info':
                result = await vscode.window.showInformationMessage(
                    config.message,
                    { modal: config.modal },
                    ...actions
                );
                break;
            case 'warning':
                result = await vscode.window.showWarningMessage(
                    `⚠️ ${config.message}`,
                    { modal: config.modal },
                    ...actions
                );
                break;
            case 'error':
                result = await vscode.window.showErrorMessage(
                    `❌ ${config.message}`,
                    { modal: config.modal },
                    ...actions
                );
                break;
        }

        // Execute callback if action was selected
        if (result) {
            const action = config.actions?.find(a => a.title === result);
            if (action) {
                action.callback();
            }
        }

        return result;
    }

    public async showProgress(config: ProgressConfig, task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<void>): Promise<void> {
        const location = this.getProgressLocation(config.location);
        
        await vscode.window.withProgress(
            {
                location,
                title: config.title,
                cancellable: config.cancellable || false
            },
            async (progress, token) => {
                if (config.steps) {
                    for (const step of config.steps) {
                        if (token.isCancellationRequested) {
                            break;
                        }
                        
                        progress.report({
                            message: step.message,
                            increment: step.increment
                        });
                        
                        if (step.duration) {
                            await this.delay(step.duration);
                        }
                    }
                } else {
                    await task(progress);
                }
            }
        );
    }

    public queueNotification(config: NotificationConfig): void {
        this.notificationQueue.push(config);
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    private async processQueue(): Promise<void> {
        if (this.notificationQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const config = this.notificationQueue.shift()!;
        await this.showNotification(config);
        
        if (config.duration) {
            await this.delay(config.duration);
        }
        
        await this.processQueue();
    }

    private getProgressLocation(location: string): vscode.ProgressLocation {
        switch (location) {
            case 'notification':
                return vscode.ProgressLocation.Notification;
            case 'window':
                return vscode.ProgressLocation.Window;
            case 'source-control':
                return vscode.ProgressLocation.SourceControl;
            default:
                return vscode.ProgressLocation.Notification;
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================================
// PROJECT EXPLORER PROVIDER
// ============================================================================

export class ProjectExplorerProvider implements vscode.TreeDataProvider<ProjectExplorerNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<ProjectExplorerNode | undefined | null | void> = new vscode.EventEmitter<ProjectExplorerNode | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ProjectExplorerNode | undefined | null | void> = this._onDidChangeTreeData.event;

    private data: ProjectExplorerNode[] = [];

    constructor() {
        this.initializeData();
    }

    private initializeData(): void {
        this.data = [
            {
                id: 'overview',
                label: 'Project Overview',
                type: 'category',
                icon: 'dashboard',
                children: [
                    {
                        id: 'overview.type',
                        label: 'Type: Not Analyzed',
                        type: 'metric',
                        icon: 'info'
                    },
                    {
                        id: 'overview.files',
                        label: 'Files: 0',
                        type: 'metric',
                        icon: 'file'
                    },
                    {
                        id: 'overview.status',
                        label: 'Status: Ready',
                        type: 'metric',
                        icon: 'check'
                    }
                ]
            },
            {
                id: 'docker',
                label: 'Docker Files',
                type: 'category',
                icon: 'docker',
                children: [
                    {
                        id: 'docker.dockerfile',
                        label: 'Dockerfile: Not Generated',
                        type: 'file',
                        icon: 'file-code'
                    },
                    {
                        id: 'docker.compose',
                        label: 'docker-compose.yml: Not Generated',
                        type: 'file',
                        icon: 'file-code'
                    },
                    {
                        id: 'docker.ignore',
                        label: '.dockerignore: Not Generated',
                        type: 'file',
                        icon: 'file'
                    }
                ]
            },
            {
                id: 'metrics',
                label: 'Metrics',
                type: 'category',
                icon: 'graph',
                children: [
                    {
                        id: 'metrics.security',
                        label: 'Security: Not Scanned',
                        type: 'metric',
                        icon: 'shield'
                    },
                    {
                        id: 'metrics.dependencies',
                        label: 'Dependencies: Not Analyzed',
                        type: 'metric',
                        icon: 'package'
                    },
                    {
                        id: 'metrics.quality',
                        label: 'Quality: N/A',
                        type: 'metric',
                        icon: 'star'
                    }
                ]
            },
            {
                id: 'actions',
                label: 'Quick Actions',
                type: 'category',
                icon: 'zap',
                children: [
                    {
                        id: 'actions.generate',
                        label: 'Generate Docker Files',
                        type: 'file',
                        icon: 'play',
                        command: {
                            command: 'autoDocker.analyzeProject',
                            title: 'Generate'
                        }
                    },
                    {
                        id: 'actions.dashboard',
                        label: 'Open Dashboard',
                        type: 'file',
                        icon: 'dashboard',
                        command: {
                            command: 'autoDocker.showDashboard',
                            title: 'Dashboard'
                        }
                    },
                    {
                        id: 'actions.settings',
                        label: 'Configure Settings',
                        type: 'file',
                        icon: 'settings',
                        command: {
                            command: 'autoDocker.configureApiKeys',
                            title: 'Settings'
                        }
                    }
                ]
            }
        ];
    }

    public updateData(newData: ProjectExplorerNode[]): void {
        this.data = newData;
        this.refresh();
    }

    public updateNode(id: string, updates: Partial<ProjectExplorerNode>): void {
        const updateNodeRecursive = (nodes: ProjectExplorerNode[]): boolean => {
            for (const node of nodes) {
                if (node.id === id) {
                    Object.assign(node, updates);
                    return true;
                }
                if (node.children && updateNodeRecursive(node.children)) {
                    return true;
                }
            }
            return false;
        };

        if (updateNodeRecursive(this.data)) {
            this.refresh();
        }
    }

    public refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ProjectExplorerNode): vscode.TreeItem {
        const treeItem = new vscode.TreeItem(
            element.label,
            element.children ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
        );

        treeItem.description = element.description;
        treeItem.tooltip = element.tooltip || element.label;
        treeItem.contextValue = element.contextValue || element.type;

        if (element.icon) {
            treeItem.iconPath = new vscode.ThemeIcon(element.icon);
        }

        if (element.command) {
            treeItem.command = element.command;
        }

        return treeItem;
    }

    getChildren(element?: ProjectExplorerNode): Thenable<ProjectExplorerNode[]> {
        if (!element) {
            return Promise.resolve(this.data);
        }
        return Promise.resolve(element.children || []);
    }
}

// ============================================================================
// WEBVIEW PROVIDER
// ============================================================================

export class DashboardWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'autoDocker.dashboardView';
    private _view?: vscode.WebviewView;
    private _extensionUri: vscode.Uri;
    private _data?: DashboardData;

    constructor(extensionUri: vscode.Uri) {
        this._extensionUri = extensionUri;
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'refresh':
                    this.refresh();
                    break;
                case 'openDashboard':
                    vscode.commands.executeCommand('autoDocker.showFullDashboard');
                    break;
                case 'generate':
                    vscode.commands.executeCommand('autoDocker.analyzeProject');
                    break;
            }
        });
    }

    public updateData(data: DashboardData): void {
        this._data = data;
        if (this._view) {
            this._view.webview.postMessage({ type: 'update', data });
        }
    }

    public refresh(): void {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const data = this._data || this._getDefaultData();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Docker Dashboard</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 16px;
            margin: 0;
        }
        
        .dashboard-container {
            max-width: 100%;
        }
        
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .header h1 {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .header-icon {
            font-size: 24px;
        }
        
        .refresh-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .refresh-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 20px;
        }
        
        .metric-card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 12px;
        }
        
        .metric-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        
        .metric-value {
            font-size: 20px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }
        
        .metric-trend {
            font-size: 11px;
            margin-top: 4px;
        }
        
        .trend-up {
            color: #4ec9b0;
        }
        
        .trend-down {
            color: #f48771;
        }
        
        .section {
            margin-bottom: 20px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        
        .activity-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 12px;
            background-color: var(--vscode-list-hoverBackground);
        }
        
        .activity-icon {
            font-size: 16px;
        }
        
        .activity-time {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }
        
        .recommendation-item {
            padding: 8px;
            border-left: 3px solid var(--vscode-textLink-foreground);
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            margin-bottom: 6px;
            font-size: 12px;
            border-radius: 2px;
        }
        
        .action-buttons {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        
        .action-btn {
            flex: 1;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
        }
        
        .action-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .action-btn.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .action-btn.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .progress-bar {
            height: 4px;
            background-color: var(--vscode-progressBar-background);
            border-radius: 2px;
            margin-top: 4px;
            overflow: hidden;
        }
        
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-background);
            transition: width 0.3s ease;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: var(--vscode-descriptionForeground);
        }
        
        .empty-state-icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <div class="header">
            <h1><span class="header-icon">🐳</span> Auto Docker</h1>
            <button class="refresh-btn" onclick="refresh()">🔄 Refresh</button>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Generations</div>
                <div class="metric-value">${data.overview.totalGenerations}</div>
                <div class="metric-trend trend-up">↑ All time</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Success Rate</div>
                <div class="metric-value">${data.overview.successRate.toFixed(1)}%</div>
                <div class="metric-trend trend-up">↑ Excellent</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Quality</div>
                <div class="metric-value">${data.overview.avgQuality.toFixed(1)}</div>
                <div class="metric-trend trend-up">↑ High</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Cost</div>
                <div class="metric-value">$${data.overview.totalCost.toFixed(3)}</div>
                <div class="metric-trend">Optimized</div>
            </div>
        </div>
        
        <div class="section">
            <div class="section-title">📊 Security & Dependencies</div>
            <div class="metric-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div class="metric-label">Security Score</div>
                        <div class="metric-value">${data.metrics.security.score}/100</div>
                    </div>
                    <div>
                        <div class="metric-label">Issues</div>
                        <div class="metric-value">${data.metrics.security.issues}</div>
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${data.metrics.security.score}%"></div>
                </div>
            </div>
        </div>
        
        ${data.recommendations.length > 0 ? `
        <div class="section">
            <div class="section-title">💡 Recommendations</div>
            ${data.recommendations.slice(0, 3).map(rec => `
                <div class="recommendation-item">${rec}</div>
            `).join('')}
        </div>
        ` : ''}
        
        <div class="action-buttons">
            <button class="action-btn" onclick="generate()">🚀 Generate</button>
            <button class="action-btn secondary" onclick="openDashboard()">📊 Full Dashboard</button>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function refresh() {
            vscode.postMessage({ type: 'refresh' });
        }
        
        function openDashboard() {
            vscode.postMessage({ type: 'openDashboard' });
        }
        
        function generate() {
            vscode.postMessage({ type: 'generate' });
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'update') {
                // Update dashboard with new data
                window.location.reload();
            }
        });
    </script>
</body>
</html>`;
    }

    private _getDefaultData(): DashboardData {
        return {
            overview: {
                totalGenerations: 0,
                successRate: 0,
                avgQuality: 0,
                totalCost: 0
            },
            recentActivity: [],
            metrics: {
                security: { score: 0, issues: 0 },
                dependencies: { total: 0, vulnerable: 0 },
                prompts: { avgTokens: 0, quality: 0 }
            },
            recommendations: [
                'Run your first analysis to get started',
                'Configure API keys for better results',
                'Enable all validation phases'
            ]
        };
    }
}

// ============================================================================
// UI ENHANCEMENT SERVICE
// ============================================================================

export class UIEnhancementService {
    private statusBarManager: StatusBarManager;
    private notificationManager: NotificationManager;
    private projectExplorer?: ProjectExplorerProvider;
    private dashboardProvider?: DashboardWebviewProvider;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.statusBarManager = new StatusBarManager();
        this.notificationManager = new NotificationManager();
        this.initialize();
    }

    private initialize(): void {
        // Register project explorer
        this.projectExplorer = new ProjectExplorerProvider();
        vscode.window.registerTreeDataProvider('autoDocker.projectExplorer', this.projectExplorer);

        // Register dashboard webview
        this.dashboardProvider = new DashboardWebviewProvider(this.context.extensionUri);
        vscode.window.registerWebviewViewProvider(
            DashboardWebviewProvider.viewType,
            this.dashboardProvider
        );
    }

    // ========================================================================
    // STATUS BAR METHODS
    // ========================================================================

    public showGenerating(): void {
        this.statusBarManager.showProgress('autoDocker.main', 'Generating Docker files');
    }

    public showAnalyzing(): void {
        this.statusBarManager.showProgress('autoDocker.main', 'Analyzing project');
    }

    public showSuccess(message: string): void {
        this.statusBarManager.stopProgress('autoDocker.main', `✅ ${message}`);
        setTimeout(() => {
            this.statusBarManager.updateStatusBar('autoDocker.main', {
                text: '$(docker) Auto Docker'
            });
        }, 3000);
    }

    public showError(message: string): void {
        this.statusBarManager.stopProgress('autoDocker.main', `❌ ${message}`);
        setTimeout(() => {
            this.statusBarManager.updateStatusBar('autoDocker.main', {
                text: '$(docker) Auto Docker'
            });
        }, 3000);
    }

    // ========================================================================
    // NOTIFICATION METHODS
    // ========================================================================

    public async showSuccessNotification(message: string, actions?: Array<{ title: string; callback: () => void }>): Promise<void> {
        await this.notificationManager.showNotification({
            message,
            type: 'success',
            actions
        });
    }

    public async showErrorNotification(message: string, actions?: Array<{ title: string; callback: () => void }>): Promise<void> {
        await this.notificationManager.showNotification({
            message,
            type: 'error',
            actions
        });
    }

    public async showInfoNotification(message: string, actions?: Array<{ title: string; callback: () => void }>): Promise<void> {
        await this.notificationManager.showNotification({
            message,
            type: 'info',
            actions
        });
    }

    public async showWarningNotification(message: string, actions?: Array<{ title: string; callback: () => void }>): Promise<void> {
        await this.notificationManager.showNotification({
            message,
            type: 'warning',
            actions
        });
    }

    public async showProgressNotification(config: ProgressConfig, task: (progress: any) => Promise<void>): Promise<void> {
        await this.notificationManager.showProgress(config, task);
    }

    // ========================================================================
    // PROJECT EXPLORER METHODS
    // ========================================================================

    public updateProjectExplorer(data: ProjectExplorerNode[]): void {
        if (this.projectExplorer) {
            this.projectExplorer.updateData(data);
        }
    }

    public updateProjectNode(id: string, updates: Partial<ProjectExplorerNode>): void {
        if (this.projectExplorer) {
            this.projectExplorer.updateNode(id, updates);
        }
    }

    public refreshProjectExplorer(): void {
        if (this.projectExplorer) {
            this.projectExplorer.refresh();
        }
    }

    // ========================================================================
    // DASHBOARD METHODS
    // ========================================================================

    public updateDashboard(data: DashboardData): void {
        if (this.dashboardProvider) {
            this.dashboardProvider.updateData(data);
        }
    }

    public refreshDashboard(): void {
        if (this.dashboardProvider) {
            this.dashboardProvider.refresh();
        }
    }

    // ========================================================================
    // QUICK PICK METHODS
    // ========================================================================

    public async showQuickPick(config: QuickPickConfig): Promise<any> {
        const items = config.items.map(item => ({
            label: item.icon ? `$(${item.icon}) ${item.label}` : item.label,
            description: item.description,
            detail: item.detail,
            value: item.value
        }));

        const selected = await vscode.window.showQuickPick(items, {
            title: config.title,
            placeHolder: config.placeholder,
            canPickMany: config.canPickMany,
            matchOnDescription: config.matchOnDescription,
            matchOnDetail: config.matchOnDetail
        });

        return selected?.value;
    }

    // ========================================================================
    // INPUT BOX METHODS
    // ========================================================================

    public async showInputBox(prompt: string, placeholder?: string, value?: string): Promise<string | undefined> {
        return await vscode.window.showInputBox({
            prompt,
            placeHolder: placeholder,
            value
        });
    }

    // ========================================================================
    // DISPOSE
    // ========================================================================

    public dispose(): void {
        this.statusBarManager.dispose();
    }
}
