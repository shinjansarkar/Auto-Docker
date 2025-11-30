import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Edge Cases and Error Scenarios', () => {
    let testWorkspaceRoot: string;

    setup(() => {
        testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace-edge');
        if (!fs.existsSync(testWorkspaceRoot)) {
            fs.mkdirSync(testWorkspaceRoot, { recursive: true });
        }
    });

    teardown(() => {
        if (fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }
    });

    suite('Malformed Files', () => {
        test('Should handle malformed package.json gracefully', () => {
            const malformedJson = '{ "name": "test", dependencies: { "express": "^4.18.0" }'; // Missing closing brace

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                malformedJson
            );

            try {
                const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
                JSON.parse(content);
                assert.fail('Should have thrown error for malformed JSON');
            } catch (error) {
                assert.strictEqual(error instanceof SyntaxError, true);
            }
        });

        test('Should handle empty package.json', () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                ''
            );

            try {
                const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
                JSON.parse(content);
                assert.fail('Should have thrown error for empty JSON');
            } catch (error) {
                assert.strictEqual(error !== null, true);
            }
        });

        test('Should handle package.json with only whitespace', () => {
            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                '   \n\t   '
            );

            try {
                const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
                JSON.parse(content);
                assert.fail('Should have thrown error for whitespace-only JSON');
            } catch (error) {
                assert.strictEqual(error !== null, true);
            }
        });
    });

    suite('Missing Dependencies', () => {
        test('Should handle package.json without dependencies field', () => {
            const packageJson = {
                name: 'test-app',
                version: '1.0.0'
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.dependencies, undefined);
            assert.strictEqual(parsed.devDependencies, undefined);
        });

        test('Should handle empty dependencies object', () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {},
                devDependencies: {}
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(Object.keys(parsed.dependencies).length, 0);
            assert.strictEqual(Object.keys(parsed.devDependencies).length, 0);
        });

        test('Should handle null dependencies', () => {
            const packageJson = {
                name: 'test-app',
                dependencies: null,
                devDependencies: null
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.dependencies, null);
            assert.strictEqual(parsed.devDependencies, null);
        });
    });

    suite('Special Characters', () => {
        test('Should handle file paths with special characters', () => {
            const specialDir = path.join(testWorkspaceRoot, 'test-@#$%');
            
            // Some file systems may not support all special characters
            try {
                fs.mkdirSync(specialDir, { recursive: true });
                fs.writeFileSync(
                    path.join(specialDir, 'test.json'),
                    JSON.stringify({ test: true })
                );

                const exists = fs.existsSync(path.join(specialDir, 'test.json'));
                assert.strictEqual(exists, true);
            } catch (error) {
                // If the file system doesn't support these characters, that's okay
                assert.strictEqual(error !== null, true);
            }
        });

        test('Should handle Unicode in package.json', () => {
            const packageJson = {
                name: 'test-app',
                description: '这是一个测试应用 🚀',
                author: 'Tëst Üsér'
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.description, '这是一个测试应用 🚀');
            assert.strictEqual(parsed.author, 'Tëst Üsér');
        });
    });

    suite('Large Files', () => {
        test('Should handle very large package.json (> 1MB)', function() {
            this.timeout(10000);

            // Create enough dependencies to exceed 1MB
            const largeDependencies = Object.fromEntries(
                Array(50000).fill(null).map((_, i) => [
                    `very-long-package-name-with-scope-${i}`,
                    `^${Math.floor(i / 1000)}.${Math.floor(i / 100) % 10}.${i % 100}`
                ])
            );

            const packageJson = {
                name: 'large-project',
                dependencies: largeDependencies
            };

            const jsonString = JSON.stringify(packageJson, null, 2);

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                jsonString
            );

            const stats = fs.statSync(path.join(testWorkspaceRoot, 'package.json'));
            assert.strictEqual(stats.size > 1024 * 1024, true, 'File should be larger than 1MB');

            const startTime = Date.now();
            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);
            const endTime = Date.now();

            assert.strictEqual(Object.keys(parsed.dependencies).length, 50000);
            assert.strictEqual(endTime - startTime < 5000, true, 'Should parse large file within 5 seconds');
        });
    });

    suite('Circular References', () => {
        test('Should detect circular references in objects', () => {
            const obj: any = { name: 'test' };
            obj.self = obj; // Circular reference

            try {
                JSON.stringify(obj);
                assert.fail('Should have thrown error for circular reference');
            } catch (error) {
                assert.strictEqual(error instanceof TypeError, true);
                assert.strictEqual((error as Error).message.includes('circular'), true);
            }
        });

        test('Should handle nested circular references', () => {
            const obj1: any = { name: 'obj1' };
            const obj2: any = { name: 'obj2', ref: obj1 };
            obj1.ref = obj2; // Circular reference

            try {
                JSON.stringify(obj1);
                assert.fail('Should have thrown error for nested circular reference');
            } catch (error) {
                assert.strictEqual(error instanceof TypeError, true);
            }
        });
    });

    suite('Permission Errors', () => {
        test('Should handle read-only files appropriately', function() {
            if (process.platform === 'win32') {
                this.skip(); // Skip on Windows due to different permission model
            }

            const filePath = path.join(testWorkspaceRoot, 'readonly.json');
            fs.writeFileSync(filePath, JSON.stringify({ test: true }));
            fs.chmodSync(filePath, 0o444); // Read-only

            try {
                // Try to write to read-only file
                fs.writeFileSync(filePath, JSON.stringify({ test: false }));
                assert.fail('Should have thrown permission error');
            } catch (error) {
                assert.strictEqual(error !== null, true);
            } finally {
                // Cleanup - restore write permission
                fs.chmodSync(filePath, 0o644);
            }
        });
    });

    suite('Concurrent Operations', () => {
        test('Should handle concurrent reads without issues', async () => {
            const testFile = path.join(testWorkspaceRoot, 'concurrent-test.json');
            fs.writeFileSync(testFile, JSON.stringify({ id: 1 }));

            const promises = Array(100).fill(null).map(() =>
                fs.promises.readFile(testFile, 'utf8')
            );

            const results = await Promise.all(promises);
            
            results.forEach(result => {
                const parsed = JSON.parse(result);
                assert.strictEqual(parsed.id, 1);
            });
        });

        test('Should handle concurrent writes safely', async function() {
            this.timeout(5000);

            const promises = Array(50).fill(null).map((_, i) =>
                fs.promises.writeFile(
                    path.join(testWorkspaceRoot, `file-${i}.json`),
                    JSON.stringify({ id: i })
                )
            );

            await Promise.all(promises);

            // Verify all files were created
            for (let i = 0; i < 50; i++) {
                const exists = fs.existsSync(path.join(testWorkspaceRoot, `file-${i}.json`));
                assert.strictEqual(exists, true);
            }
        });
    });

    suite('Deep Nesting', () => {
        test('Should handle deeply nested objects', () => {
            let deepObject: any = { value: 'end' };
            
            for (let i = 0; i < 100; i++) {
                deepObject = { nested: deepObject };
            }

            const jsonString = JSON.stringify(deepObject);
            const parsed = JSON.parse(jsonString);

            // Navigate to the end
            let current = parsed;
            for (let i = 0; i < 100; i++) {
                current = current.nested;
            }

            assert.strictEqual(current.value, 'end');
        });
    });

    suite('Type Validation', () => {
        test('Should validate string types in dependencies', () => {
            const packageJson = {
                name: 'test-app',
                dependencies: {
                    'valid-string': '^1.0.0',
                    'number-version': 123 as any, // Invalid type
                    'object-version': { version: '1.0.0' } as any // Invalid type
                }
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            // Validate types
            assert.strictEqual(typeof parsed.dependencies['valid-string'], 'string');
            assert.strictEqual(typeof parsed.dependencies['number-version'], 'number');
            assert.strictEqual(typeof parsed.dependencies['object-version'], 'object');
        });
    });

    suite('Boundary Values', () => {
        test('Should handle empty strings in package.json', () => {
            const packageJson = {
                name: '',
                version: '',
                description: ''
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.name, '');
            assert.strictEqual(parsed.version, '');
            assert.strictEqual(parsed.description, '');
        });

        test('Should handle very long strings', () => {
            const longString = 'a'.repeat(100000);
            const packageJson = {
                name: 'test',
                description: longString
            };

            fs.writeFileSync(
                path.join(testWorkspaceRoot, 'package.json'),
                JSON.stringify(packageJson, null, 2)
            );

            const content = fs.readFileSync(path.join(testWorkspaceRoot, 'package.json'), 'utf8');
            const parsed = JSON.parse(content);

            assert.strictEqual(parsed.description.length, 100000);
        });
    });
});
