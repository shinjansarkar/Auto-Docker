/**
 * Test Runner Script
 * Executes the full Auto Docker extension test suite
 */

import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        console.log('\n╔═══════════════════════════════════════════════════════════╗');
        console.log('║   Auto Docker Extension - Integration Test Suite         ║');
        console.log('╚═══════════════════════════════════════════════════════════╝\n');
        
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
        
        // The path to test runner
        const extensionTestsPath = path.resolve(__dirname, './suite/index');
        
        // Additional launch args
        const launchArgs = [
            '--disable-extensions', // Disable other extensions to avoid conflicts
            '--disable-gpu',
            '--disable-workspace-trust', // Skip workspace trust dialog
            extensionDevelopmentPath // Open workspace with test projects
        ];
        
        console.log('Configuration:');
        console.log(`  Extension Path: ${extensionDevelopmentPath}`);
        console.log(`  Test Suite Path: ${extensionTestsPath}`);
        console.log(`  Launch Args: ${launchArgs.join(' ')}\n`);
        
        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            extensionTestsEnv: {
                // Set environment variables for tests
                NODE_ENV: 'test',
                RUN_DOCKER_BUILD: process.env.RUN_DOCKER_BUILD || 'false',
                TEST_TIMEOUT: process.env.TEST_TIMEOUT || '120000'
            }
        });
        
        console.log('\n✓ All tests completed successfully!\n');
        
    } catch (err) {
        console.error('\n✗ Test execution failed:');
        console.error(err);
        console.error('\n');
        process.exit(1);
    }
}

main();
