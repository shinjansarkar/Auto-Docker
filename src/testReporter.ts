import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TestResult, TestSummary } from './testRunner';

export class TestReporter {
    static generateHTMLReport(summary: TestSummary, outputPath: string): string {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Auto Docker Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; min-height: 100vh; }
        .container { max-width: 1400px; margin: 0 auto; background: white; border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.3); overflow: hidden; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px; text-align: center; }
        .header h1 { font-size: 2.5em; margin-bottom: 10px; font-weight: 700; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; padding: 40px; background: #f8f9fa; }
        .summary-card { background: white; padding: 25px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,.1); text-align: center; }
        .summary-card .number { font-size: 3em; font-weight: bold; margin-bottom: 10px; }
        .summary-card .label { font-size: 1em; color: #666; text-transform: uppercase; letter-spacing: 1px; }
        .summary-card.total .number { color: #667eea; }
        .summary-card.passed .number { color: #10b981; }
        .summary-card.failed .number { color: #ef4444; }
        .summary-card.warnings .number { color: #f59e0b; }
        .results { padding: 40px; }
        .category-section { margin-bottom: 40px; }
        .category-header { font-size: 1.8em; margin-bottom: 20px; color: #333; border-bottom: 3px solid #667eea; padding-bottom: 10px; }
        .test-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 20px; }
        .test-card { background: white; border: 2px solid #e5e7eb; border-radius: 12px; padding: 20px; }
        .test-card.passed { border-left: 5px solid #10b981; }
        .test-card.failed { border-left: 5px solid #ef4444; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-name { font-size: 1.2em; font-weight: 600; color: #333; }
        .test-status { padding: 5px 12px; border-radius: 20px; font-size: .85em; font-weight: 600; text-transform: uppercase; }
        .test-status.passed { background: #d1fae5; color: #065f46; }
        .test-status.failed { background: #fee2e2; color: #991b1b; }
        .footer { background: #f8f9fa; padding: 30px; text-align: center; color: #666; border-top: 1px solid #e5e7eb; }
        .progress-bar { width: 100%; height: 30px; background: #e5e7eb; border-radius: 15px; overflow: hidden; margin: 20px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🐳 Auto Docker Test Report</h1>
            <p>Comprehensive validation of all supported technologies</p>
            <p style="margin-top:10px;font-size:.9em;">Generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="summary">
            <div class="summary-card total"><div class="number">${summary.totalTests}</div><div class="label">Total Tests</div></div>
            <div class="summary-card passed"><div class="number">${summary.passed}</div><div class="label">Passed</div></div>
            <div class="summary-card failed"><div class="number">${summary.failed}</div><div class="label">Failed</div></div>
            <div class="summary-card warnings"><div class="number">${summary.warnings}</div><div class="label">Warnings</div></div>
        </div>
        <div class="summary" style="padding-top:0;">
            <div style="grid-column:1/-1;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${(summary.passed / summary.totalTests * 100).toFixed(1)}%">
                        ${(summary.passed / summary.totalTests * 100).toFixed(1)}% Success Rate
                    </div>
                </div>
            </div>
        </div>
        <div class="results">${this.generateCategoryResults(summary.results)}</div>
        <div class="footer"><p><strong>Auto Docker Extension</strong></p><p style="margin-top:10px;">Made with ❤️ for the developer community</p></div>
    </div>
    <script>function toggleLogs(id){document.getElementById('logs-'+id).classList.toggle('show');}</script>
</body>
</html>`;
        if (outputPath) {
            const reportPath = path.join(outputPath, 'test-report.html');
            fs.writeFileSync(reportPath, html);
            return reportPath;
        }
        return html;
    }

    private static generateCategoryResults(results: TestResult[]): string {
        const categories = [...new Set(results.map(r => r.category))];
        return categories.map(category => {
            const categoryResults = results.filter(r => r.category === category);
            return `
                <div class="category-section">
                    <h2 class="category-header">${this.getCategoryIcon(category)} ${category}</h2>
                    <div class="test-grid">
                        ${categoryResults.map((result, index) => this.generateTestCard(result, index)).join('')}
                    </div>
                </div>`;
        }).join('');
    }

    private static generateTestCard(result: TestResult, index: number): string {
        return `
            <div class="test-card ${result.status}">
                <div class="test-header">
                    <div class="test-name">${result.technology}</div>
                    <div class="test-status ${result.status}">
                        ${result.status === 'passed' ? '✅ Passed' : result.status === 'failed' ? '❌ Failed' : '⚠️ Warning'}
                    </div>
                </div>
                <div class="test-message">${result.message}</div>
                <div class="test-duration">⏱️ Duration: ${result.duration}ms</div>
                ${result.issues.length > 0 ? `<div class="test-issues"><h4>Issues Found:</h4><ul>${result.issues.map(issue => `<li>${issue}</li>`).join('')}</ul></div>` : ''}
                ${result.containerLogs ? `<div class="logs-section"><button class="logs-toggle" onclick="toggleLogs(${index})">View Container Logs</button><div class="logs-content" id="logs-${index}"><pre>${this.escapeHtml(result.containerLogs)}</pre></div></div>` : ''}
            </div>`;
    }

    private static getCategoryIcon(category: string): string {
        const icons: Record<string, string> = {
            'Frontend': '🎨', 'Backend': '⚙️', 'Database': '🗄️',
            'Message Queue': '🔄', 'Search Engine': '🔍',
            'Reverse Proxy': '🌐', 'Fullstack': '🏗️',
        };
        return icons[category] || '📦';
    }

    private static escapeHtml(text: string): string {
        const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    static generateJSONReport(summary: TestSummary, outputPath: string): string {
        const reportPath = path.join(outputPath, 'test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
        return reportPath;
    }

    static generateMarkdownReport(summary: TestSummary, outputPath: string): string {
        let markdown = `# 🐳 Auto Docker Test Report\n\n`;
        markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
        markdown += `## 📊 Summary\n\n`;
        markdown += `| Metric | Value |\n|--------|-------|\n`;
        markdown += `| Total Tests | ${summary.totalTests} |\n`;
        markdown += `| ✅ Passed | ${summary.passed} |\n`;
        markdown += `| ❌ Failed | ${summary.failed} |\n`;
        markdown += `| ⚠️ Warnings | ${summary.warnings} |\n`;
        markdown += `| ⏱️ Duration | ${(summary.duration / 1000).toFixed(2)}s |\n\n`;

        const categories = [...new Set(summary.results.map(r => r.category))];
        categories.forEach(category => {
            const catResults = summary.results.filter(r => r.category === category);
            markdown += `## ${this.getCategoryIcon(category)} ${category}\n\n`;
            catResults.forEach(result => {
                const icon = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
                markdown += `### ${icon} ${result.technology}\n\n`;
                markdown += `- **Status:** ${result.status}\n- **Message:** ${result.message}\n- **Duration:** ${result.duration}ms\n`;
                if (result.issues.length > 0) {
                    markdown += `- **Issues:**\n`;
                    result.issues.forEach(issue => { markdown += `  - ${issue}\n`; });
                }
                markdown += '\n';
            });
        });

        const reportPath = path.join(outputPath, 'test-report.md');
        fs.writeFileSync(reportPath, markdown);
        return reportPath;
    }

    static showReportInWebview(context: vscode.ExtensionContext, summary: TestSummary): void {
        const panel = vscode.window.createWebviewPanel(
            'autoDockerTestReport', 'Auto Docker Test Report',
            vscode.ViewColumn.One, { enableScripts: true }
        );
        panel.webview.html = this.generateHTMLReport(summary, '');
    }
}
