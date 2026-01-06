# 🧪 Auto Docker Extension - Testing Framework Usage Guide

## 📚 Overview

This comprehensive testing framework validates the Auto Docker Extension across **28+ technology combinations** including:
- ✅ Frontend frameworks (React, Vue, Next.js, Angular, Svelte)
- ✅ Backend frameworks (Express, NestJS, FastAPI, Django, Spring Boot, Go, etc.)
- ✅ Fullstack applications
- ✅ Monorepo configurations
- ✅ Microservices architectures

## 🚀 Quick Start

### Step 1: Generate Test Projects

```bash
# Run the test suite to generate 28 test projects
node test-automation/runTests.js
```

This will:
- Create 28 test projects in `test-automation/generated-projects/`
- Validate project structures
- Generate comprehensive reports

### Step 2: Review Initial Results

```bash
# View the test report
cat test-automation/results/TEST_REPORT.md

# View solutions for any errors
cat test-automation/results/SOLUTIONS.md
```

### Step 3: Generate Docker Files (Manual)

For each test project, you need to run the Auto Docker extension:

**Option A: Via VS Code UI**
1. Open a test project folder in VS Code
2. Press `Ctrl+Shift+P`
3. Select "Auto Docker: Analyze Project & Generate Docker Files"
4. Wait for generation to complete

**Option B: Programmatically (Advanced)**
```javascript
// Use the extension API to generate files
// See integrate.js for automation examples
```

### Step 4: Validate Generated Files

```bash
# Re-run tests to validate generated Docker files
node test-automation/runTests.js
```

## 📊 Test Projects Generated

### Frontend Projects (7)
1. **React Vite** - Modern React with Vite bundler
2. **React CRA** - Create React App
3. **Vue Vite** - Vue 3 with Vite
4. **Vue Nuxt** - Nuxt.js SSR framework
5. **Next.js SSR** - Next.js with server-side rendering
6. **Angular** - Angular 17
7. **Svelte** - Svelte with Vite

### Backend Projects (10)
1. **Express** - Node.js Express server
2. **NestJS** - NestJS framework
3. **Fastify** - Fastify web framework
4. **Koa** - Koa.js framework
5. **Django** - Python Django framework
6. **Flask** - Python Flask
7. **FastAPI** - Python FastAPI
8. **Bottle** - Python Bottle
9. **Spring Boot** - Java Spring Boot
10. **Go Gin** - Go Gin framework

### Fullstack Projects (8)
1. **React + Express**
2. **React + NestJS**
3. **React + FastAPI**
4. **Vue + Express**
5. **Vue + FastAPI**
6. **Next.js + Express**
7. **Next.js + NestJS**
8. **Angular + Spring Boot**

### Monorepo Projects (3)
1. **Simple Monorepo** - React + Express
2. **Multi-Backend Monorepo** - Vue + Express + FastAPI
3. **Microservices Monorepo** - Next.js + NestJS + Go + Spring Boot

## 📁 Directory Structure

```
test-automation/
├── runTests.js              # Main test runner
├── projectGenerator.js      # Generates test projects
├── integrate.js             # Integration helper
├── README.md               # This file
├── USAGE.md                # Usage guide
├── generated-projects/     # Generated test projects
│   ├── test-xxx-react-vite/
│   ├── test-xxx-express/
│   └── ...
└── results/                # Test results
    ├── test-report.json
    ├── TEST_REPORT.md
    ├── SOLUTIONS.md
    └── ERROR_LOG.json
```

## 🔍 Understanding Test Results

### Test Status
- **✅ Passed**: All validations passed, Docker files generated correctly
- **⚠️ Warning**: Minor issues or Docker files not yet generated
- **❌ Failed**: Critical errors in structure or Docker files
- **🔥 Error**: Runtime errors during testing

### Reports Generated

#### 1. TEST_REPORT.md
Human-readable markdown report with:
- Summary statistics
- Pass/fail breakdown by category
- Detailed results for each test
- Error analysis

#### 2. test-report.json
Machine-readable JSON with:
- Complete test results
- Error details with stack traces
- Timestamps and durations
- File generation status

#### 3. SOLUTIONS.md
Automated solutions for errors:
- Grouped error patterns
- Suggested fixes
- Files to check
- Code locations

#### 4. ERROR_LOG.json
Raw error log for debugging

## 🛠️ Common Workflows

### Workflow 1: Test a Specific Framework

```bash
# Edit runTests.js to include only your framework
# Then run:
node test-automation/runTests.js
```

### Workflow 2: Add New Framework Support

1. Edit `projectGenerator.js`
2. Add your framework to the creation logic
3. Add test configuration in `runTests.js`
4. Run tests

### Workflow 3: Debug Failed Tests

```bash
# 1. Check the error log
cat test-automation/results/ERROR_LOG.json

# 2. Review solutions
cat test-automation/results/SOLUTIONS.md

# 3. Navigate to the test project
cd test-automation/generated-projects/test-xxx-yourframework

# 4. Manually inspect files
ls -la
```

### Workflow 4: Validate Docker Builds

```bash
# Navigate to a test project
cd test-automation/generated-projects/test-xxx-react-vite

# Test docker-compose syntax
docker-compose config

# Build images
docker-compose build

# Run containers
docker-compose up -d

# Check status
docker-compose ps

# Clean up
docker-compose down
```

## 📈 Success Criteria

### For Each Test Project
- ✅ Project structure created correctly
- ✅ All required dependency files present
- ✅ Dockerfile generated
- ✅ docker-compose.yml generated
- ✅ nginx.conf generated (for frontend/fullstack)
- ✅ .dockerignore generated
- ✅ .env.example generated
- ✅ Docker build succeeds
- ✅ Containers start successfully

### Overall Test Suite
- ✅ >90% pass rate
- ✅ Zero critical errors
- ✅ All frameworks detected correctly
- ✅ Monorepo structure handled properly

## 🐛 Troubleshooting

### Issue: "No Docker files found"
**Cause**: Extension hasn't been run on the test project yet
**Solution**: Run Auto Docker extension manually on each project

### Issue: "Project structure validation failed"
**Cause**: Required files (package.json, requirements.txt, etc.) missing
**Solution**: Check projectGenerator.js logic for that framework

### Issue: "docker-compose.yml syntax error"
**Cause**: Invalid YAML generated by extension
**Solution**: Check src/cleanComposeGenerator.ts in main extension

### Issue: "Docker build failed"
**Cause**: Invalid Dockerfile or incorrect COPY paths
**Solution**: Check src/smartDockerfileGenerator.ts

## 🔄 Continuous Testing

### Before Each Release
```bash
# 1. Run full test suite
node test-automation/runTests.js

# 2. Generate Docker files for all projects
# (Manual step via VS Code extension)

# 3. Re-run tests to validate
node test-automation/runTests.js

# 4. Review reports
cat test-automation/results/TEST_REPORT.md

# 5. Fix any issues
# 6. Repeat until >90% pass rate
```

### After Code Changes
```bash
# Quick validation
node test-automation/runTests.js

# Check for regressions
diff test-automation/results/test-report.json previous-report.json
```

## 📝 Adding More Test Combinations

### Example: Add Laravel Backend

1. **Update projectGenerator.js**:
```javascript
else if (framework === 'laravel') {
    // Create composer.json
    fs.writeFileSync(path.join(projectPath, 'composer.json'),
        JSON.stringify({
            require: {
                "laravel/framework": "^10.0"
            }
        }, null, 2));
    
    // Create artisan file
    fs.writeFileSync(path.join(projectPath, 'artisan'), '#!/usr/bin/env php\n<?php\n');
}
```

2. **Update runTests.js**:
```javascript
{ name: 'Laravel', type: 'backend', framework: 'laravel' }
```

3. **Run tests**:
```bash
node test-automation/runTests.js
```

## 🎯 Next Steps

1. **Generate all test projects** ✅ (Done by running runTests.js)
2. **Run Auto Docker extension** on each project (Manual)
3. **Validate generated files** (Re-run runTests.js)
4. **Fix any errors** found in SOLUTIONS.md
5. **Achieve >90% pass rate**
6. **Document findings**

## 📞 Support

For issues with:
- **Test framework**: Check this guide and error logs
- **Auto Docker extension**: Check main extension documentation
- **Docker builds**: Check Docker logs and Dockerfile syntax

## 🎉 Success Metrics

After running the full test suite, you should see:
- 28 test projects created
- Comprehensive reports generated
- Clear action items for any failures
- Automated solution suggestions

---

**Happy Testing! 🚀**

For more information, see:
- Main README: `../README.md`
- Test Reports: `results/TEST_REPORT.md`
- Solutions: `results/SOLUTIONS.md`
