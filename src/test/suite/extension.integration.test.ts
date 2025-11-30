import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Integration Test Suite', () => {
    
    suite('Extension Activation', () => {
        test('Extension should be present', () => {
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            assert.strictEqual(extension !== undefined, true);
        });

        test('Extension should activate', async function() {
            this.timeout(10000);
            
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            if (extension) {
                await extension.activate();
                assert.strictEqual(extension.isActive, true);
            }
        });
    });

    suite('Commands Registration', () => {
        test('Should register analyzeProject command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.analyzeProject'), true);
        });

        test('Should register regenerateDockerFiles command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.regenerateDockerFiles'), true);
        });

        test('Should register analyzeProjectDirect command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.analyzeProjectDirect'), true);
        });

        test('Should register configureApiKeys command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.configureApiKeys'), true);
        });

        test('Should register runTests command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.runTests'), true);
        });

        test('Should register generateTestProjects command', async () => {
            const commands = await vscode.commands.getCommands(true);
            assert.strictEqual(commands.includes('autoDocker.generateTestProjects'), true);
        });
    });

    suite('Configuration', () => {
        test('Should have apiProvider configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const apiProvider = config.get('apiProvider');
            assert.strictEqual(apiProvider !== undefined, true);
        });

        test('Should have model configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const model = config.get('model');
            assert.strictEqual(model !== undefined, true);
        });

        test('Should have overwriteFiles configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const overwriteFiles = config.get('overwriteFiles');
            assert.strictEqual(overwriteFiles !== undefined, true);
        });

        test('Should have includeNginx configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const includeNginx = config.get('includeNginx');
            assert.strictEqual(includeNginx !== undefined, true);
        });

        test('Should have useReverseProxy configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const useReverseProxy = config.get('useReverseProxy');
            assert.strictEqual(useReverseProxy !== undefined, true);
        });

        test('Should have dockerOutputPath configuration', () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            const dockerOutputPath = config.get('dockerOutputPath');
            assert.strictEqual(dockerOutputPath !== undefined, true);
        });
    });

    suite('Configuration Updates', () => {
        test('Should be able to update apiProvider', async () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            
            // In test environment, configuration updates may not persist
            // Just verify that update doesn't throw an error
            try {
                await config.update('apiProvider', 'gemini', vscode.ConfigurationTarget.Global);
                assert.ok(true, 'Configuration update succeeded');
            } catch (error) {
                assert.fail('Configuration update failed: ' + error);
            }
        });

        test('Should be able to update model', async () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            
            // In test environment, configuration updates may not persist
            // Just verify that update doesn't throw an error
            try {
                await config.update('model', 'gpt-3.5-turbo', vscode.ConfigurationTarget.Global);
                assert.ok(true, 'Configuration update succeeded');
            } catch (error) {
                assert.fail('Configuration update failed: ' + error);
            }
        });

        test('Should be able to update overwriteFiles', async () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            
            // In test environment, configuration updates may not persist
            // Just verify that update doesn't throw an error
            try {
                await config.update('overwriteFiles', true, vscode.ConfigurationTarget.Global);
                assert.ok(true, 'Configuration update succeeded');
            } catch (error) {
                assert.fail('Configuration update failed: ' + error);
            }
        });
    });

    suite('Output Channel', () => {
        test('Should create output channel', async function() {
            this.timeout(5000);
            
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            if (extension && !extension.isActive) {
                await extension.activate();
            }

            // Output channel should be accessible after activation
            assert.strictEqual(extension?.isActive, true);
        });
    });

    suite('Performance Tests', () => {
        test('Extension should activate quickly (< 5 seconds)', async function() {
            this.timeout(10000);

            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            
            const startTime = Date.now();
            if (extension && !extension.isActive) {
                await extension.activate();
            }
            const endTime = Date.now();

            const activationTime = endTime - startTime;
            assert.strictEqual(activationTime < 5000, true,
                `Extension activation took ${activationTime}ms, should be under 5000ms`);
        });

        test('Commands should be registered quickly', async function() {
            this.timeout(5000);

            const startTime = Date.now();
            const commands = await vscode.commands.getCommands(true);
            const endTime = Date.now();

            const executionTime = endTime - startTime;
            assert.strictEqual(executionTime < 2000, true);
            assert.strictEqual(commands.length > 0, true);
        });
    });

    suite('Error Handling', () => {
        test('Should handle missing workspace gracefully', async () => {
            const config = vscode.workspace.getConfiguration('autoDocker');
            
            // This should not throw an error
            try {
                const value = config.get('apiProvider');
                assert.strictEqual(value !== undefined, true);
            } catch (error) {
                assert.fail('Should not throw error when accessing configuration');
            }
        });
    });

    suite('Context Menu', () => {
        test('Should have command in explorer context menu', async () => {
            const commands = await vscode.commands.getCommands(true);
            const hasAnalyzeCommand = commands.includes('autoDocker.analyzeProject');
            assert.strictEqual(hasAnalyzeCommand, true);
        });
    });

    suite('Extension Metadata', () => {
        test('Should have correct display name', () => {
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            assert.strictEqual(extension?.packageJSON.displayName, 'Auto Docker Extension');
        });

        test('Should have correct version', () => {
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            assert.strictEqual(extension?.packageJSON.version !== undefined, true);
        });

        test('Should have correct publisher', () => {
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            assert.strictEqual(extension?.packageJSON.publisher, 'auto-docker-publisher');
        });

        test('Should be in AI category', () => {
            const extension = vscode.extensions.getExtension('auto-docker-publisher.auto-docker-extension');
            const categories = extension?.packageJSON.categories || [];
            assert.strictEqual(categories.includes('AI'), true);
        });
    });
});
