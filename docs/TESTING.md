# 🧪 Auto Docker Testing Suite

## Overview

The Auto Docker Testing Suite is a comprehensive testing framework that validates **all supported technologies** in Docker containers. It automatically:

- ✅ **Tests 40+ technologies** across all categories
- 🐳 **Runs everything in Docker** for isolated testing
- 📊 **Generates detailed reports** (HTML, JSON, Markdown)
- 🔍 **Performs health checks** on all services
- 📝 **Reports all issues** with actionable diagnostics

## 🚀 Quick Start

### 1. Generate Test Projects

```
Ctrl+Shift+P → Auto Docker: Generate Test Projects
```

This creates sample projects for all supported technologies in `.test-projects/` folder.

### 2. Run Comprehensive Tests

```
Ctrl+Shift+P → Auto Docker: Run Comprehensive Tests
```

Select what to test:
- 🎨 Frontend Frameworks
- ⚙️ Backend Frameworks
- 🗄️ Databases
- 🔄 Message Queues
- 🔍 Search Engines
- 🌐 Reverse Proxies
- 🏗️ Fullstack Apps
- 🚀 Run All Tests

### 3. View Results

After tests complete, you'll get:
- **HTML Report**: Beautiful, interactive report with all details
- **JSON Report**: Machine-readable data for CI/CD integration
- **Markdown Report**: Human-readable summary for documentation

## 📋 Tested Technologies

### 🎨 Frontend Frameworks (11+)
- ✅ React (Vite, CRA)
- ✅ Vue.js (Vue CLI, Vite, Nuxt.js)
- ✅ Angular (Angular CLI)
- ✅ Next.js (SSR, Static Export)
- ✅ Svelte (SvelteKit, Svelte)
- ✅ Solid.js, Preact, Ember.js

### ⚙️ Backend Frameworks (15+)
- ✅ **Node.js**: Express, Fastify, NestJS, Koa
- ✅ **Python**: Django, Flask, FastAPI, Bottle
- ✅ **Java**: Spring Boot, Quarkus
- ✅ **Go**: Gin, Fiber, Echo
- ✅ **Others**: PHP (Laravel, Symfony), .NET, Rust, Ruby (Rails, Sinatra), Elixir (Phoenix)

### 🗄️ Databases & Data Stores
- ✅ **Relational**: PostgreSQL, MySQL, MariaDB, MSSQL, SQLite
- ✅ **NoSQL**: MongoDB, Redis
- ✅ **In-Memory**: Redis, Memcached

### 🔄 Message Queues
- ✅ RabbitMQ (with Management UI)
- ✅ Apache Kafka (with Zookeeper)
- ✅ Redis Streams
- ✅ ActiveMQ

### 🔍 Search Engines
- ✅ Elasticsearch (v8.x)
- ✅ OpenSearch

### 🌐 Reverse Proxies
- ✅ Nginx (with WebSocket support)
- ✅ Traefik
- ✅ Caddy

## 📊 Test Report Features

### HTML Report
- **Interactive Dashboard**: Visual summary with charts
- **Category Breakdown**: Organized by technology type
- **Health Check Details**: Response times, status codes, endpoints
- **Issue Tracking**: All errors and warnings highlighted
- **Container Logs**: Expandable logs for debugging
- **Responsive Design**: Works on all devices

### JSON Report
```json
{
  "totalTests": 45,
  "passed": 42,
  "failed": 3,
  "warnings": 0,
  "duration": 125000,
  "results": [
    {
      "technology": "React (Vite)",
      "category": "Frontend",
      "status": "passed",
      "message": "All checks passed",
      "issues": [],
      "duration": 2500,
      "healthCheck": {
        "isHealthy": true,
        "endpoint": "http://localhost:3000",
        "responseTime": 45,
        "statusCode": 200
      }
    }
  ]
}
```

### Markdown Report
```markdown
# 🐳 Auto Docker Test Report

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | 45 |
| ✅ Passed | 42 |
| ❌ Failed | 3 |
| Success Rate | 93.3% |

## 🎨 Frontend

### ✅ React (Vite)
- **Status:** passed
- **Duration:** 2500ms
- **Health Check:** ✅ Healthy
```

## 🔧 Test Architecture

### Test Runner (`testRunner.ts`)
- Orchestrates all tests
- Manages Docker containers
- Performs health checks
- Collects logs and metrics
- Handles cleanup

### Test Reporter (`testReporter.ts`)
- Generates HTML reports
- Creates JSON data
- Produces Markdown summaries
- Shows results in VS Code webview

### Test Project Generator (`testProjectGenerator.ts`)
- Creates sample projects
- Generates all necessary files
- Sets up dependencies
- Configures Docker files

## 🎯 Use Cases

### 1. **Technology Validation**
Test if your Docker configurations work for specific technologies:
```
Auto Docker: Run Tests → Frontend Frameworks
```

### 2. **CI/CD Integration**
Use JSON reports in your CI/CD pipeline:
```bash
# In your CI script
code --install-extension auto-docker-extension.vsix
code --command autoDocker.runTests
# Parse .test-reports/test-report.json
```

### 3. **Issue Diagnosis**
When Docker files fail, run tests to identify issues:
```
Auto Docker: Run Tests → View Issues
```

### 4. **Learning & Examples**
Generate test projects to see working examples:
```
Auto Docker: Generate Test Projects
# Explore .test-projects/ for examples
```

## 📁 Generated Structure

After running tests, you'll have:

```
your-workspace/
├── .test-projects/          # Sample projects
│   ├── react-vite/
│   ├── express/
│   ├── django/
│   ├── mern/
│   └── ...
├── .test-reports/           # Test results
│   ├── test-report.html    # Interactive report
│   ├── test-report.json    # Machine-readable
│   └── test-report.md      # Human-readable
└── docker-compose.yml       # Your actual config
```

## 🔍 Health Checks

Each test performs comprehensive health checks:

### Frontend Apps
- ✅ HTTP GET to root endpoint
- ✅ Response time < 5000ms
- ✅ Status code 200 or 304

### Backend APIs
- ✅ API endpoint reachable
- ✅ JSON response valid
- ✅ Health endpoint returns 200

### Databases
- ✅ Connection successful
- ✅ Authentication works
- ✅ Database ready for queries

### Message Queues
- ✅ Service running
- ✅ Management UI accessible (if applicable)
- ✅ Can connect to queue

### Search Engines
- ✅ Cluster health green/yellow
- ✅ API responds
- ✅ Can create/query indices

### Reverse Proxies
- ✅ Proxy running
- ✅ Can handle requests
- ✅ WebSocket support (if configured)

## 🐛 Troubleshooting

### Tests Fail to Start
```
❌ Error: Docker daemon not running
```
**Solution**: Start Docker Desktop

### Container Won't Start
```
❌ Error: Port already in use
```
**Solution**: Stop conflicting services or change ports

### Health Check Fails
```
❌ Health check failed: Connection refused
```
**Solution**: Check container logs in the report

### Out of Memory
```
❌ Error: Cannot allocate memory
```
**Solution**: Increase Docker memory limit in settings

## 📈 Performance

- **Fast Analysis**: < 2 seconds for project detection
- **Parallel Testing**: Multiple containers tested simultaneously
- **Smart Cleanup**: Automatic container removal after tests
- **Resource Efficient**: Only runs selected test categories

## 🔐 Security

- ✅ **Isolated Testing**: Each test runs in separate container
- ✅ **No Data Persistence**: Test data cleaned up automatically
- ✅ **Default Credentials**: Only for testing, never in production
- ✅ **Network Isolation**: Containers use isolated networks

## 🎨 Customization

### Custom Test Projects
Add your own test projects to `.test-projects/`:
```
.test-projects/
└── my-custom-app/
    ├── package.json
    ├── Dockerfile
    └── ...
```

### Custom Health Checks
Extend `testRunner.ts` to add custom health checks:
```typescript
private async checkCustomHealth(name: string, port: number): Promise<HealthCheckResult> {
    // Your custom health check logic
}
```

## 📚 Examples

### Example 1: Test MERN Stack
```
1. Auto Docker: Generate Test Projects
2. Auto Docker: Run Tests → Fullstack Apps
3. View HTML report
4. Check MongoDB connection
5. Verify React frontend
6. Test Express API
```

### Example 2: Validate Database Setup
```
1. Auto Docker: Run Tests → Databases
2. Check PostgreSQL health
3. Verify MongoDB connection
4. Test Redis cache
5. Review connection strings in report
```

### Example 3: CI/CD Integration
```yaml
# .github/workflows/docker-test.yml
name: Docker Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Docker Tests
        run: |
          npm install
          npm run test:docker
      - name: Upload Reports
        uses: actions/upload-artifact@v2
        with:
          name: test-reports
          path: .test-reports/
```

## 🌟 Best Practices

1. **Run Tests Regularly**: Validate Docker configs after changes
2. **Review Reports**: Check health checks and response times
3. **Fix Issues Promptly**: Address failed tests immediately
4. **Use in CI/CD**: Automate testing in your pipeline
5. **Keep Updated**: Update test projects with new technologies

## 🤝 Contributing

Want to add more tests? Here's how:

1. **Add Test Project**: Create in `testProjectGenerator.ts`
2. **Add Test Logic**: Update `testRunner.ts`
3. **Add Health Check**: Implement specific validation
4. **Update Docs**: Document the new test
5. **Submit PR**: Share with the community!

## 📞 Support

- 🐛 **Issues**: Report bugs in GitHub Issues
- 💡 **Feature Requests**: Suggest new tests
- 📧 **Email**: Get help with testing
- ⭐ **Star**: Show your support!

---

**Happy Testing! 🐳✨**

Made with ❤️ for the developer community
