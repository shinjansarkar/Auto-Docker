/**
 * Integration Test Suite Index
 * Configures Mocha and runs all integration tests
 */

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';
import * as fs from 'fs';

export async function run(): Promise<void> {
    console.log('\n🚀 Starting Auto Docker Integration Tests...\n');
    
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 120000, // 2 minutes timeout per test
        reporter: 'spec',
        slow: 30000, // Mark tests as slow if they take more than 30s
        bail: false, // Continue running tests even if some fail
        retries: 0 // No retries - we want to catch intermittent issues
    });
    
    const testsRoot = path.resolve(__dirname, '..');
    const reportDir = path.resolve(testsRoot, '../../reports');
    
    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }
    
    console.log(`Test root: ${testsRoot}`);
    console.log(`Report directory: ${reportDir}\n`);
    
    return new Promise((resolve, reject) => {
        // Find all integration test files
        glob('integration/**/*.suite.js', { cwd: testsRoot })
            .then((files) => {
                console.log(`Found ${files.length} test suites:\n`);
                
                // Add files to the test suite
                files.forEach(f => {
                    console.log(`  • ${f}`);
                    mocha.addFile(path.resolve(testsRoot, f));
                });
                
                console.log('\n');
                
                try {
                    // Run the mocha test
                    mocha.run(failures => {
                        if (failures > 0) {
                            console.error(`\n❌ ${failures} test(s) failed.\n`);
                            reject(new Error(`${failures} tests failed.`));
                        } else {
                            console.log('\n✅ All tests passed!\n');
                            resolve();
                        }
                    });
                } catch (err) {
                    console.error('\n❌ Error running tests:');
                    console.error(err);
                    reject(err);
                }
            })
            .catch((err) => {
                console.error('\n❌ Error finding test files:');
                console.error(err);
                reject(err);
            });
    });
}
