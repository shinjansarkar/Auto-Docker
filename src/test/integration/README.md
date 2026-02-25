# Auto Docker Extension - Integration Testing Guide

## Overview

This integration test suite validates the Auto Docker extension against multiple project types to ensure Docker files are generated correctly without manual intervention.

## Test Architecture

```
src/test/integration/
├── vsix-test.suite.ts           # Main test suite
├── docker-build-validator.ts    # Docker build validation utilities
├── run-integration-tests.ts     # Test runner
└── suite/
    └── index.ts                 # Mocha configuration
```

## Features

✅ **Automated Testing**: Tests all project types automatically  
✅ **Multi-Language Support**: Tests 15+ technology stacks  
✅ **Comprehensive Validation**: Syntax, security, best practices  
✅ **Docker Build Testing**: Optional actual Docker build validation  
✅ **Detailed Reporting**: Generates markdown test reports  
✅ **CI/CD Ready**: Can be integrated into GitHub Actions  

## Test Coverage

### Backend Projects Tested
- Node.js Express
- FastAPI (Python)
- Flask (Python)
- Django (Python)
- Go Gin
- Spring Boot (Java)
- NestJS (TypeScript)
- Ruby on Rails
- Rust Actix
- PHP Laravel
- .NET Core API
- Kotlin Ktor (if available)
- Elixir Phoenix (if available)
- Scala Play (if available)
- Haskell Servant (if available)

### Validation Checks
1. **File Generation**: Dockerfile, docker-compose.yml, .dockerignore
2. **Syntax Validation**: YAML and Dockerfile syntax
3. **Best Practices**: Multi-stage builds, WORKDIR, USER directives
4. **Security**: Checks for common security issues
5. **Port Configuration**: Validates exposed ports
6. **Docker Build**: Optional actual build testing

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Compile Tests

```bash
npm run compile-tests
```

### 3. Run Tests

#### Basic Test (No Docker Build)
```bash
npm run test:integration
```

#### Full Test with Docker Build
```bash
npm run test:integration:build
```

#### Run All Tests
```bash
npm run test:all
```

## Test Execution Flow

```
1. Setup Phase
   ├── Activate extension
   ├── Verify test projects exist
   └── Configure test environment

2. For Each Project Type
   ├── Clean existing Docker files
   ├── Open project folder
   ├── Execute: autoDocker.analyzeProject
   ├── Validate file generation
   ├── Check Dockerfile syntax
   ├── Validate docker-compose.yml
   ├── Verify port configuration
   ├── [Optional] Run Docker build
   └── Check security best practices

3. Teardown Phase
   ├── Collect all test results
   ├── Generate test report
   └── Display summary
```

## Test Results

After running tests, a comprehensive report is generated:

**Location**: `AUTO_DOCKER_TEST_REPORT.md`

**Report Includes**:
- Summary table of all tests
- Detailed results per project
- Files generated
- Validation results
- Errors and warnings
- Security issues
- Recommendations for fixes

## Environment Variables

Configure test behavior with environment variables:

```bash
# Enable actual Docker builds (slow but thorough)
RUN_DOCKER_BUILD=true npm run test:integration

# Set custom test timeout (milliseconds)
TEST_TIMEOUT=180000 npm run test:integration
```

## Test Configuration

### Timeout Settings

Default timeouts can be adjusted in the test suite:

```typescript
// Suite setup timeout
this.timeout(120000); // 2 minutes

// Per-test timeout
test('name', async function() {
    this.timeout(180000); // 3 minutes for slow builds
});
```

### Project-Specific Configuration

Each project can have custom settings:

```typescript
{
    name: 'Spring Boot Java',
    path: 'backend/06-spring-boot-java',
    expectedFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore'],
    shouldHaveNginx: false,
    expectedPorts: [8080],
    buildTimeout: 180000 // Java builds are slower
}
```

## Interpreting Test Results

### Success Criteria

A test passes when:
- ✅ All expected files are generated
- ✅ Dockerfile syntax is valid
- ✅ docker-compose.yml syntax is valid
- ✅ No critical errors found
- ✅ [Optional] Docker build succeeds

### Common Failures

**1. File Not Generated**
```
Error: Expected file not generated: Dockerfile
```
**Fix**: Check if extension command executed successfully

**2. Syntax Error**
```
Error: Dockerfile missing FROM instruction
```
**Fix**: Review Dockerfile generation logic

**3. Port Mismatch**
```
Warning: Expected ports 3000 but found 8080
```
**Fix**: Update port detection or test expectations

**4. Docker Build Failed**
```
Error: Build failed: COPY failed
```
**Fix**: Check file paths and .dockerignore patterns

## Continuous Integration

### GitHub Actions Integration

Create `.github/workflows/test-extension.yml`:

```yaml
name: Test Auto Docker Extension

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Dependencies
        run: npm install
      
      - name: Compile Extension
        run: npm run compile
      
      - name: Compile Tests
        run: npm run compile-tests
      
      - name: Run Integration Tests
        run: npm run test:integration
      
      - name: Upload Test Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-report
          path: AUTO_DOCKER_TEST_REPORT.md
```

## Troubleshooting

### Extension Not Activating

**Issue**: Extension fails to activate during tests

**Solution**:
```bash
# Ensure extension is compiled
npm run compile

# Clean and rebuild
npm run rebuild
```

### Test Timeout

**Issue**: Tests timeout before completion

**Solution**:
```bash
# Increase timeout
TEST_TIMEOUT=300000 npm run test:integration

# Or skip Docker builds
RUN_DOCKER_BUILD=false npm run test:integration
```

### Docker Not Available

**Issue**: Docker build tests fail

**Solution**:
```bash
# Verify Docker is running
docker version

# Skip build tests
npm run test:integration
```

### Test Projects Missing

**Issue**: Test projects not found

**Solution**:
```bash
# Generate test projects
npm run generate-test-projects

# Or verify path
ls -la test-projects/
```

## Advanced Usage

### Testing Specific Projects

Modify the test suite to focus on specific projects:

```typescript
const testProjects: ProjectTestConfig[] = [
    {
        name: 'Node.js Express',
        path: 'backend/01-node-express',
        // ... config
    }
    // Comment out others
];
```

### Custom Validators

Add custom validation logic:

```typescript
async function customValidation(projectPath: string): Promise<boolean> {
    // Your validation logic
    const dockerfile = fs.readFileSync(path.join(projectPath, 'Dockerfile'), 'utf-8');
    return dockerfile.includes('HEALTHCHECK');
}
```

### Performance Profiling

Track generation performance:

```typescript
const startTime = Date.now();
await vscode.commands.executeCommand('autoDocker.analyzeProject');
const duration = Date.now() - startTime;
console.log(`Generation took ${duration}ms`);
```

## Best Practices

1. **Run tests frequently** during development
2. **Review test reports** for patterns in failures
3. **Update test expectations** when changing templates
4. **Add new project types** as they're supported
5. **Keep test projects minimal** to speed up tests
6. **Use Docker build tests** before releases
7. **Integrate with CI/CD** for automated validation

## Metrics

The test suite tracks:
- ⏱️  **Generation Time**: How long to generate files
- 📦 **Image Size**: Docker image size (if built)
- 🔍 **Layer Count**: Number of Docker layers
- ⚠️  **Warning Count**: Best practice violations
- ❌ **Error Count**: Critical issues found

## Contributing

When adding new features:

1. Add test cases for new project types
2. Update validation rules
3. Document expected behavior
4. Run full test suite before committing

## Support

For issues or questions:
- Check `AUTO_DOCKER_TEST_REPORT.md` for detailed failures
- Review test logs for error messages
- Update test expectations if behavior changed intentionally

---

**Last Updated**: February 2026  
**Version**: 1.0.0  
**Maintainer**: Auto Docker Team
