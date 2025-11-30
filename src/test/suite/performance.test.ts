import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Performance Benchmark Tests', () => {
    let testWorkspaceRoot: string;

    setup(() => {
        testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace-perf');
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    suite('File Operations Performance', () => {
        test('Should read package.json files efficiently', () => {
            const packageJson = {
                name: 'perf-test',
                dependencies: {
                    express: '^4.18.0',
                    react: '^18.0.0'
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const iterations = 100;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
                JSON.parse(content);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 10, true,
                `Average read time ${avgTime}ms should be under 10ms`);
        });

        test('Should write files efficiently', () => {
            const content = 'FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]';
            const iterations = 100;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                fs.writeFileSync(
                    path.join(testWorkspaceRoot, `Dockerfile-${i}`),
                    content
                );
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 20, true,
                `Average write time ${avgTime}ms should be under 20ms`);

            // Cleanup
            for (let i = 0; i < iterations; i++) {
                fs.unlinkSync(path.join(testWorkspaceRoot, `Dockerfile-${i}`));
            }
        });

        test('Should handle concurrent file reads', async () => {
            // Create multiple test files
            for (let i = 0; i < 10; i++) {
                fs.writeFileSync(
                    path.join(testWorkspaceRoot, `test-${i}.json`),
                    JSON.stringify({ id: i })
                );
            }

            const startTime = Date.now();

            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    fs.promises.readFile(path.join(testWorkspaceRoot, `test-${i}.json`), 'utf8')
                );
            }

            await Promise.all(promises);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            assert.strictEqual(executionTime < 500, true,
                `Concurrent reads took ${executionTime}ms, should be under 500ms`);

            // Cleanup
            for (let i = 0; i < 10; i++) {
                fs.unlinkSync(path.join(testWorkspaceRoot, `test-${i}.json`));
            }
        });
    });

    suite('Large Project Simulation', () => {
        test('Should handle project with 1000+ files', function() {
            this.timeout(10000);

            const startTime = Date.now();

            // Create directory structure
            for (let i = 0; i < 10; i++) {
                const dirPath = path.join(testWorkspaceRoot, `dir-${i}`);
                fs.mkdirSync(dirPath, { recursive: true });

                for (let j = 0; j < 100; j++) {
                    fs.writeFileSync(
                        path.join(dirPath, `file-${j}.js`),
                        `module.exports = { id: ${i * 100 + j} };`
                    );
                }
            }

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            assert.strictEqual(executionTime < 5000, true,
                `Creating 1000 files took ${executionTime}ms, should be under 5000ms`);

            // Verify file count
            let fileCount = 0;
            const countFiles = (dir: string) => {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);
                    if (stat.isDirectory()) {
                        countFiles(filePath);
                    } else {
                        fileCount++;
                    }
                });
            };

            countFiles(testWorkspaceRoot);
            assert.strictEqual(fileCount, 1000);
        });

        test('Should scan large directory efficiently', function() {
            this.timeout(10000);

            // Create test structure
            for (let i = 0; i < 5; i++) {
                const dirPath = path.join(testWorkspaceRoot, `src-${i}`);
                fs.mkdirSync(dirPath, { recursive: true });

                for (let j = 0; j < 50; j++) {
                    fs.writeFileSync(
                        path.join(dirPath, `component-${j}.tsx`),
                        `export const Component${j} = () => <div>${j}</div>;`
                    );
                }
            }

            const startTime = Date.now();

            // Recursive scan
            const scanDirectory = (dir: string): string[] => {
                const files: string[] = [];
                const entries = fs.readdirSync(dir);

                for (const entry of entries) {
                    const fullPath = path.join(dir, entry);
                    const stat = fs.statSync(fullPath);

                    if (stat.isDirectory()) {
                        files.push(...scanDirectory(fullPath));
                    } else {
                        files.push(fullPath);
                    }
                }

                return files;
            };

            const allFiles = scanDirectory(testWorkspaceRoot);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            assert.strictEqual(executionTime < 1000, true,
                `Scanning took ${executionTime}ms, should be under 1000ms`);
            assert.strictEqual(allFiles.length, 250);
        });
    });

    suite('Memory Usage Tests', () => {
        test('Should not leak memory during repeated operations', function() {
            this.timeout(10000);

            const iterations = 1000;
            const initialMemory = process.memoryUsage().heapUsed;

            for (let i = 0; i < iterations; i++) {
                const data = {
                    id: i,
                    name: `test-${i}`,
                    dependencies: Array(10).fill(null).map((_, j) => `dep-${j}`)
                };

                JSON.stringify(data);
                JSON.parse(JSON.stringify(data));
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

            assert.strictEqual(memoryIncreaseMB < 50, true,
                `Memory increased by ${memoryIncreaseMB.toFixed(2)}MB, should be under 50MB`);
        });

        test('Should handle large string operations efficiently', () => {
            const iterations = 100;
            const largeString = 'x'.repeat(10000);

            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const result = largeString.split('').reverse().join('');
                assert.strictEqual(result.length, 10000);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 50, true,
                `Average string operation time ${avgTime}ms should be under 50ms`);
        });
    });

    suite('JSON Processing Performance', () => {
        test('Should parse complex package.json efficiently', () => {
            const complexPackageJson = {
                name: 'complex-project',
                dependencies: Object.fromEntries(
                    Array(100).fill(null).map((_, i) => [`package-${i}`, `^1.0.${i}`])
                ),
                devDependencies: Object.fromEntries(
                    Array(50).fill(null).map((_, i) => [`dev-package-${i}`, `^2.0.${i}`])
                ),
                scripts: Object.fromEntries(
                    Array(30).fill(null).map((_, i) => [`script-${i}`, `echo ${i}`])
                )
            };

            const jsonString = JSON.stringify(complexPackageJson, null, 2);
            const iterations = 100;

            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const parsed = JSON.parse(jsonString);
                assert.strictEqual(Object.keys(parsed.dependencies).length, 100);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 5, true,
                `Average JSON parse time ${avgTime}ms should be under 5ms`);
        });

        test('Should serialize large objects efficiently', () => {
            const largeObject = {
                files: Array(1000).fill(null).map((_, i) => ({
                    path: `/path/to/file-${i}.js`,
                    size: Math.random() * 10000,
                    modified: new Date().toISOString()
                }))
            };

            const iterations = 50;
            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const json = JSON.stringify(largeObject);
                assert.strictEqual(json.length > 0, true);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 100, true,
                `Average serialization time ${avgTime}ms should be under 100ms`);
        });
    });

    suite('String Matching Performance', () => {
        test('Should perform regex matches efficiently', () => {
            const content = fs.readFileSync(__filename, 'utf8');
            const iterations = 1000;

            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const matches = content.match(/test|assert|const|let/g);
                assert.strictEqual(matches !== null, true);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 5, true,
                `Average regex match time ${avgTime}ms should be under 5ms`);
        });

        test('Should perform string includes efficiently', () => {
            const largeString = Array(1000).fill('test string with content').join(' ');
            const iterations = 10000;

            const startTime = Date.now();

            for (let i = 0; i < iterations; i++) {
                const result = largeString.includes('content');
                assert.strictEqual(result, true);
            }

            const endTime = Date.now();
            const avgTime = (endTime - startTime) / iterations;

            assert.strictEqual(avgTime < 1, true,
                `Average string includes time ${avgTime}ms should be under 1ms`);
        });
    });

    suite('Baseline Performance Metrics', () => {
        test('Collect baseline metrics for reporting', () => {
            const metrics = {
                nodeVersion: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: {
                    heapUsed: process.memoryUsage().heapUsed / 1024 / 1024,
                    heapTotal: process.memoryUsage().heapTotal / 1024 / 1024,
                    external: process.memoryUsage().external / 1024 / 1024,
                    rss: process.memoryUsage().rss / 1024 / 1024
                },
                cpuUsage: process.cpuUsage()
            };

            console.log('\n📊 Performance Baseline Metrics:');
            console.log(JSON.stringify(metrics, null, 2));

            assert.strictEqual(metrics.nodeVersion !== undefined, true);
        });
    });
});
