# Changelog

All notable changes to the "Auto Docker Extension" will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.5.0] - 2025-11-25

### 🚀 Added - Enterprise-Grade Features
- **Single-Folder Fullstack Detection**: Automatically detects when frontend and backend coexist in the same folder
- **Multiple Database Support**: Simultaneously configure PostgreSQL, MongoDB, MySQL, Redis, and SQLite in one project
- **Message Queue Integration**: Full support for RabbitMQ, Kafka, Redis Streams, and ActiveMQ
- **Caching Layers**: Redis (with AOF persistence) and Memcached configuration
- **Search Engines**: Elasticsearch and OpenSearch integration
- **Comprehensive .env Files**: Auto-generates environment configurations for ALL detected services
- **Health Checks**: Production-ready health checks for all services in docker-compose
- **Persistent Volumes**: Automatic volume configuration for data persistence across container restarts

### 🎨 Enhanced
- **Advanced Service Detection**: Detects 15+ backend frameworks, 11+ frontend frameworks
- **Monorepo Support**: Improved detection and handling of frontend/backend folder structures
- **WebSocket Support**: Built-in WebSocket configuration in nginx for real-time applications
- **Reverse Proxy**: Automatic nginx reverse proxy configuration for frontend applications
- **Environment Variable Detection**: Smarter detection of .env files and automatic configuration

### 🐛 Fixed
- Improved Vite project detection and build directory handling
- Fixed nginx configuration for SPA routing with try_files
- Better handling of Python frameworks (Flask, Django, FastAPI) with proper WSGI/ASGI servers
- Resolved issues with Next.js standalone output configuration
- Fixed port conflicts in multi-service docker-compose files

### 📚 Documentation
- Added comprehensive README with real-world examples
- Created detailed testing documentation (TESTING.md, TESTING-SUMMARY.md)
- Added implementation summary and failure analysis documents
- Included quickstart testing guide and monorepo testing documentation

---

## [2.0.0] - 2025-11-20

### 🚀 Added - Major Rewrite
- **AI-Powered Generation**: Integration with OpenAI GPT-4 and Google Gemini
- **Intelligent Project Analysis**: Automatic detection of project type, frameworks, and dependencies
- **Multi-Stage Dockerfiles**: Production-ready multi-stage builds when appropriate
- **Complete Docker Setup**: Generates Dockerfile, docker-compose.yml, .dockerignore, and nginx.conf
- **Preview Mode**: Review generated files before saving to workspace
- **Customizable Output Paths**: Configure where Docker files are saved
- **API Provider Selection**: Choose between OpenAI and Google Gemini

### 🎨 Enhanced
- Complete TypeScript rewrite for better maintainability
- Improved error handling and user feedback
- Better VS Code integration with commands and settings
- Secure API key storage in VS Code settings

### 🗄️ Database Support
- PostgreSQL
- MongoDB
- MySQL
- Redis
- SQLite

### 🎨 Frontend Framework Support
- React (CRA, Vite)
- Vue.js (Vue CLI, Vite, Nuxt.js)
- Angular
- Next.js (SSR, Static Export)
- Svelte, SvelteKit
- Solid.js, Preact, Ember.js

### ⚙️ Backend Framework Support
- Node.js (Express, Fastify, NestJS, Koa)
- Python (Django, Flask, FastAPI, Bottle)
- Java (Spring Boot, Quarkus)
- Go (Gin, Fiber, Echo)
- PHP (Laravel, Symfony)
- .NET, Rust, Ruby (Rails, Sinatra)
- Elixir (Phoenix)

---

## [1.5.0] - 2025-11-10

### 🚀 Added
- **Monorepo Detection**: Automatically detects frontend/backend folder structures
- **Fallback Templates**: Instant generation if AI fails or is unavailable
- **Direct Mode**: Faster generation without AI for simple projects
- **Testing Infrastructure**: Added comprehensive test suite

### 🎨 Enhanced
- Improved project structure analysis
- Better dependency detection from package.json and requirements.txt
- Enhanced nginx configuration with gzip compression and security headers

### 🐛 Fixed
- Fixed issues with environment variable detection
- Improved handling of missing dependencies
- Better error messages for API failures

---

## [1.0.0] - 2025-11-01

### 🚀 Initial Release
- Basic Docker file generation
- Support for Node.js and Python projects
- Simple Dockerfile and docker-compose.yml generation
- Manual configuration required
- Template-based generation only

### 📋 Supported Technologies
- Node.js (Express)
- Python (Flask, Django)
- PostgreSQL
- MongoDB
- Basic nginx configuration

---

## [Unreleased]

### 🔮 Planned for v2.6.0
- [ ] Kubernetes manifest generation (deployment.yaml, service.yaml, ingress.yaml)
- [ ] Docker Swarm support
- [ ] CI/CD pipeline generation (GitHub Actions, GitLab CI, Jenkins)
- [ ] Performance monitoring integration (Prometheus, Grafana)
- [ ] Service mesh support (Istio, Linkerd)
- [ ] Better Docker layer caching optimization
- [ ] BuildKit support for faster builds

### 🔮 Planned for v3.0.0
- [ ] Visual editor for docker-compose.yml
- [ ] Cost estimation for cloud deployments (AWS, GCP, Azure)
- [ ] Security scanning integration (Trivy, Snyk)
- [ ] Multi-environment configuration (dev, staging, production)
- [ ] Terraform/Infrastructure as Code generation
- [ ] Docker image optimization recommendations
- [ ] Automated testing of generated Docker configurations
- [ ] Internationalization (i18n) support

---

## Version History Summary

| Version | Release Date | Key Features |
|---------|--------------|--------------|
| **2.5.0** | 2025-11-25 | Enterprise features, multiple databases, message queues, search engines |
| **2.0.0** | 2025-11-20 | AI-powered generation, multi-framework support, preview mode |
| **1.5.0** | 2025-11-10 | Monorepo support, fallback templates, testing infrastructure |
| **1.0.0** | 2025-11-01 | Initial release with basic Docker generation |

---

## Migration Guides

### Migrating from v1.x to v2.x

**Breaking Changes:**
- API keys are now required for full functionality
- Configuration format has changed (see README for new settings)
- Output file structure may differ for monorepo projects

**Steps:**
1. Update extension to v2.x
2. Configure API keys: `Ctrl+Shift+P` → "Auto Docker: Configure API Keys"
3. Review new settings in VS Code settings
4. Regenerate Docker files to use new features

### Migrating from v2.0 to v2.5

**New Features (No Breaking Changes):**
- Multiple databases now supported in single project
- Message queues and search engines auto-detected
- Enhanced .env file generation

**Recommended:**
1. Regenerate Docker files to benefit from new service detection
2. Review generated .env.example for new service configurations
3. Update docker-compose.yml to include health checks

---

## Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) for details.

### Reporting Issues
- 🐛 [Report Bugs](https://github.com/shinjansarkar/Auto-Docker/issues)
- 💡 [Request Features](https://github.com/shinjansarkar/Auto-Docker/discussions)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the developer community**

[2.5.0]: https://github.com/shinjansarkar/Auto-Docker/releases/tag/v2.5.0
[2.0.0]: https://github.com/shinjansarkar/Auto-Docker/releases/tag/v2.0.0
[1.5.0]: https://github.com/shinjansarkar/Auto-Docker/releases/tag/v1.5.0
[1.0.0]: https://github.com/shinjansarkar/Auto-Docker/releases/tag/v1.0.0
[Unreleased]: https://github.com/shinjansarkar/Auto-Docker/compare/v2.5.0...HEAD
