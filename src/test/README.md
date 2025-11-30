# Unit Test Documentation

## Overview
This directory contains comprehensive unit tests for the Auto Docker Extension. The test suite covers all major components, performance benchmarks, edge cases, and integration scenarios.

## Test Structure

```
src/test/
├── suite/
│   ├── index.ts                      # Test suite entry point
│   ├── projectAnalyzer.test.ts       # ProjectAnalyzer tests
│   ├── detector.test.ts              # Stack detection tests
│   ├── fileManager.test.ts           # File management tests
│   ├── llmService.test.ts            # LLM service tests
│   ├── extension.integration.test.ts # Integration tests
│   ├── performance.test.ts           # Performance benchmarks
│   ├── edgeCases.test.ts            # Edge cases & error scenarios
│   └── extension.test.ts             # Legacy extension tests
├── runTest.ts                        # Test runner configuration
└── README.md                         # This file
```

## Test Categories

### 1. **ProjectAnalyzer Tests** (`projectAnalyzer.test.ts`)
- Project type detection (React, Node.js, Python, Django, Fullstack)
- Database detection (PostgreSQL, MongoDB, MySQL, Redis)
- Monorepo structure detection
- Advanced services (RabbitMQ, Kafka, Elasticsearch)
- Environment file detection
- Special features (Prisma, WebSocket)
- Performance tests (< 5s analysis time)

### 2. **Detector Tests** (`detector.test.ts`)
- Frontend framework detection (React, Vue, Angular, Next.js, Svelte)
- Backend framework detection (Express, NestJS, Flask, Django, FastAPI, Spring Boot, Go)
- Database detection from dependencies
- Docker files detection (Dockerfile, docker-compose.yml, nginx.conf)
- Evidence collection for detections
- Performance tests (< 2s detection time)

### 3. **FileManager Tests** (`fileManager.test.ts`)
- Workspace validation
- Docker files writing (Dockerfile, docker-compose.yml, .dockerignore)
- Nginx configuration writing
- Environment file generation
- Monorepo file structure handling
- File content validation
- Performance tests (< 1s file operations)

### 4. **LLMService Tests** (`llmService.test.ts`)
- Docker file generation for various project types
- Multi-stage build generation
- Service configuration (databases, message queues, search engines)
- Nginx configuration with WebSocket support
- Monorepo support
- Fallback template usage
- Dockerignore generation
- Performance tests (< 30s generation time)
- Error handling and validation

### 5. **Integration Tests** (`extension.integration.test.ts`)
- Extension activation
- Command registration
- Configuration management
- Output channel creation
- Extension metadata validation
- Performance benchmarks
- Error handling

### 6. **Performance Tests** (`performance.test.ts`)
- File operation benchmarks (read/write < 10ms avg)
- Large project simulation (1000+ files)
- Memory usage monitoring (< 50MB increase)
- JSON processing performance
- String matching and regex performance
- Concurrent operations handling
- Baseline metrics collection

### 7. **Edge Cases Tests** (`edgeCases.test.ts`)
- Malformed JSON handling
- Missing dependencies
- Special characters in paths
- Large files (> 1MB)
- Circular references
- Permission errors
- Concurrent operations
- Deep object nesting
- Type validation
- Boundary values

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suite
```bash
npm test -- --grep "ProjectAnalyzer"
npm test -- --grep "Detector"
npm test -- --grep "Performance"
```

### Compile Tests Only
```bash
npm run compile-tests
```

### Watch Mode
```bash
npm run watch-tests
```

## Performance Benchmarks

### Target Metrics
- **Project Analysis**: < 5 seconds
- **Stack Detection**: < 2 seconds
- **File Operations**: < 1 second
- **LLM Generation**: < 30 seconds
- **File Read (avg)**: < 10ms
- **File Write (avg)**: < 20ms
- **Memory Increase**: < 50MB
- **JSON Parsing (avg)**: < 5ms

## Coverage Goals

- **Line Coverage**: > 80%
- **Function Coverage**: > 85%
- **Branch Coverage**: > 75%
- **Statement Coverage**: > 80%

## Test Scenarios Covered

### Project Types
✅ React Frontend  
✅ Vue.js Frontend  
✅ Angular Frontend  
✅ Next.js Frontend  
✅ Node.js Express Backend  
✅ NestJS Backend  
✅ Python Flask Backend  
✅ Python Django Backend  
✅ Python FastAPI Backend  
✅ Java Spring Boot Backend  
✅ Go Gin Backend  
✅ Fullstack MERN  
✅ Monorepo Structure  

### Databases
✅ PostgreSQL  
✅ MongoDB  
✅ MySQL  
✅ Redis  
✅ SQLite  
✅ Multiple Databases  

### Advanced Services
✅ RabbitMQ  
✅ Kafka  
✅ Elasticsearch  
✅ OpenSearch  
✅ Memcached  

### Special Features
✅ Prisma ORM  
✅ WebSocket Support  
✅ Environment Files  
✅ Multi-stage Builds  
✅ Reverse Proxy (Nginx)  

## Writing New Tests

### Test Template
```typescript
import * as assert from 'assert';

suite('Component Name Test Suite', () => {
    setup(() => {
        // Setup code before each test
    });

    teardown(() => {
        // Cleanup code after each test
    });

    suite('Feature Category', () => {
        test('Should do something specific', () => {
            // Arrange
            const input = 'test';
            
            // Act
            const result = someFunction(input);
            
            // Assert
            assert.strictEqual(result, 'expected');
        });
    });
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up resources in teardown
3. **Descriptive Names**: Use clear, descriptive test names
4. **Single Responsibility**: Test one thing per test
5. **Performance**: Add timeout for long-running tests
6. **Error Cases**: Test both success and failure scenarios

## Continuous Integration

### GitHub Actions
```yaml
- name: Run Tests
  run: npm test
  
- name: Check Coverage
  run: npm run test:coverage
```

## Troubleshooting

### Common Issues

**Tests timing out**
```typescript
test('Long running test', async function() {
    this.timeout(10000); // Increase timeout to 10s
    // ... test code
});
```

**Workspace not found**
```typescript
// Ensure workspace is created in setup
setup(() => {
    testWorkspaceRoot = path.join(__dirname, '..', '..', '..', 'test-workspace');
    if (!fs.existsSync(testWorkspaceRoot)) {
        fs.mkdirSync(testWorkspaceRoot, { recursive: true });
    }
});
```

**File system permissions**
```typescript
// Skip permission tests on Windows
if (process.platform === 'win32') {
    this.skip();
}
```

## Maintenance

### Adding New Tests
1. Identify the component/feature to test
2. Create test file in `src/test/suite/`
3. Write comprehensive test cases
4. Add performance benchmarks if applicable
5. Update this README

### Updating Tests
1. Keep tests in sync with code changes
2. Update performance benchmarks when optimizations are made
3. Add new edge cases as they're discovered
4. Maintain backward compatibility

## Contributing

When contributing tests:
1. Follow existing test patterns
2. Ensure all tests pass before submitting
3. Add documentation for complex test scenarios
4. Include performance tests for critical paths
5. Test edge cases and error conditions

## Dependencies

### Test Dependencies
- `mocha`: Test framework
- `@types/mocha`: TypeScript types
- `sinon`: Mocking and stubbing
- `@types/sinon`: TypeScript types
- `@vscode/test-electron`: VS Code testing
- `glob`: File pattern matching

## Metrics Dashboard

Run tests to see performance metrics:
```
📊 Performance Baseline Metrics:
{
  "nodeVersion": "v22.x.x",
  "platform": "darwin",
  "arch": "arm64",
  "memory": {
    "heapUsed": 25.6,
    "heapTotal": 45.2,
    "external": 2.1,
    "rss": 78.4
  }
}
```

## Future Enhancements

- [ ] Visual coverage reports
- [ ] Automated performance regression detection
- [ ] Snapshot testing for generated files
- [ ] E2E tests with real VS Code workspace
- [ ] Load testing for concurrent operations
- [ ] Integration with CI/CD pipelines
- [ ] Test result visualization

---

**Last Updated**: 2025-11-30  
**Test Count**: 150+ tests  
**Coverage**: ~85%
