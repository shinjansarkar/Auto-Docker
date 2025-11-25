# Auto Docker Extension

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An enterprise-grade VS Code extension that automatically generates production-ready Docker configurations by intelligently analyzing your project structure using AI (GPT/Gemini) integration. Supports ANY fullstack application with advanced service detection!

## ✨ Key Features

- **🔍 Intelligent Project Analysis**: Automatically detects project type, frameworks, and dependencies
- **🤖 AI-Powered Generation**: Uses OpenAI GPT or Google Gemini to create optimized Docker configurations
- **📦 Multi-Stage Dockerfiles**: Generates production-ready multi-stage builds when appropriate
- **🐳 Complete Docker Setup**: Creates Dockerfile, docker-compose.yml, .dockerignore, and nginx.conf
- **🏗️ Monorepo Support**: Detects and handles frontend/backend folder structures automatically
- **🔧 Customizable**: Configurable output paths, API providers, and generation preferences
- **👀 Preview Mode**: Review generated files before saving them to your workspace
- **🔒 Secure**: API keys are stored securely in VS Code settings
- **🌐 Reverse Proxy**: Automatic nginx reverse proxy for frontend applications
- **🔄 WebSocket Support**: Built-in WebSocket configuration for real-time apps
- **📊 Advanced Services**: Auto-detects and configures message queues, caching, search engines

## 🎯 What's New in v2.5.0

### 🚀 Enterprise-Grade Features
- ✅ **Single-Folder Fullstack Detection**: Detects when frontend and backend coexist in same folder
- ✅ **Multiple Database Support**: Simultaneously configure PostgreSQL, MongoDB, MySQL, Redis, and SQLite
- ✅ **Message Queue Integration**: RabbitMQ, Kafka, Redis Streams, ActiveMQ
- ✅ **Caching Layers**: Redis (with AOF persistence), Memcached
- ✅ **Search Engines**: Elasticsearch, OpenSearch
- ✅ **Comprehensive .env Files**: Auto-generates environment configs for ALL detected services
- ✅ **Health Checks**: Production-ready health checks for all services
- ✅ **Persistent Volumes**: Automatic volume configuration for data persistence

## 📋 Supported Technologies

### 🎨 Frontend Frameworks (11+)
- **React**: CRA, Vite, Create React App
- **Vue.js**: Vue CLI, Vite, Nuxt.js
- **Angular**: Angular CLI
- **Next.js**: SSR, Static Export
- **Svelte**: SvelteKit, Svelte
- **Others**: Solid.js, Preact, Ember.js

### ⚙️ Backend Frameworks (15+)
- **Node.js**: Express, Fastify, NestJS, Koa
- **Python**: Django, Flask, FastAPI, Bottle
- **Java**: Spring Boot, Quarkus
- **Go**: Gin, Fiber, Echo
- **Others**: PHP (Laravel, Symfony), .NET, Rust, Ruby (Rails, Sinatra), Elixir (Phoenix)

### 🗄️ Databases & Data Stores
- **Relational**: PostgreSQL, MySQL, MariaDB, MSSQL, SQLite
- **NoSQL**: MongoDB, Redis
- **In-Memory**: Redis, Memcached

### 🔄 Message Queues
- **RabbitMQ** (with Management UI)
- **Apache Kafka** (with Zookeeper)
- **Redis Streams**
- **ActiveMQ**

### 🔍 Search Engines
- **Elasticsearch** (v8.x)
- **OpenSearch**

### 🌐 Reverse Proxies
- **Nginx** (default, with WebSocket support)
- **Traefik** (detection)
- **Caddy** (detection)

## 🛠️ Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Auto Docker Extension"
4. Click Install

## ⚙️ Setup

### API Configuration
1. Open Command Palette (Ctrl+Shift+P)
2. Run: `Auto Docker: Configure API Keys`
3. Choose your provider:
   - **OpenAI**: Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
   - **Google Gemini**: Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## 🎯 Usage
### For Monorepo/Fullstack Projects
```
project/
├── frontend/
│   ├── Dockerfile          ✅ Generated
│   └── .dockerignore       ✅ Generated
├── backend/
│   ├── Dockerfile          ✅ Generated
│   └── .dockerignore       ✅ Generated
├── docker-compose.yml      ✅ Complete orchestration
├── nginx.conf              ✅ Reverse proxy + WebSocket
└── .env.example            ✅ All service configs
```

## 🔥 Real-World Examples

### Example 1: MERN Stack
**Detects:** React + Express + MongoDB + Redis
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
  
  backend:
    build: ./backend
    ports: ["5000:5000"]
    depends_on: [mongodb, redis]
  
  mongodb:
    image: mongo:7
    volumes: [mongodb_data:/data/db]
  
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
  
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
```

### Example 2: Django + PostgreSQL + RabbitMQ
**Detects:** Django + PostgreSQL + RabbitMQ + Redis (cache)
```yaml
services:
  backend:
    build: .
    depends_on: [postgresql, redis, rabbitmq]
  
  postgresql:
    image: postgres:15-alpine
    healthcheck:
      test: ["CMD", "pg_isready"]
  
  redis:
    image: redis:7-alpine
  
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports: ["15672:15672"]  # Management UI
```

### Example 3: Microservices with Kafka
**Detects:** Node.js services + PostgreSQL + Kafka + Elasticsearch
```yaml
services:
  api-gateway:
    build: ./api-gateway
  
  kafka:
    image: confluentinc/cp-kafka:latest
  
  elasticsearch:
    image: elasticsearch:8.11.0
    volumes: [es_data:/usr/share/elasticsearch/data]
```

## ⚙️ Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `autoDocker.apiProvider` | AI provider (openai/gemini) | `openai` |
| `autoDocker.openaiApiKey` | OpenAI API key | `""` |
| `autoDocker.geminiApiKey` | Google Gemini API key | `""` |
| `autoDocker.model` | Model to use (gpt-4, gpt-3.5-turbo, gemini-pro) | `gpt-4` |
| `autoDocker.overwriteFiles` | Auto-overwrite existing files | `false` |
| `autoDocker.includeNginx` | Generate nginx.conf for frontend | `true` |
| `autoDocker.useReverseProxy` | Use nginx as reverse proxy | `true` |
| `autoDocker.dockerOutputPath` | Custom output path (relative to workspace root) | `""` (root) |

## 🎨 Configuration Examples

### OpenAI Setup
```json
{
  "autoDocker.apiProvider": "openai",
  "autoDocker.model": "gpt-4",
  "autoDocker.openaiApiKey": "sk-your-key-here"
}
```

### Google Gemini Setup
```json
{
  "autoDocker.apiProvider": "gemini",
  "autoDocker.model": "gemini-pro",
  "autoDocker.geminiApiKey": "your-gemini-key-here"
}
```

### Customization
```json
{
  "autoDocker.overwriteFiles": true,
  "autoDocker.includeNginx": true,
  "autoDocker.useReverseProxy": true,
  "autoDocker.dockerOutputPath": "docker-configs"
}
```

## 🚀 Best Practices

### For Production Deployments
1. **Review Generated Files**: Always review before deploying
2. **Update Passwords**: Change default passwords in `.env`
3. **Resource Limits**: Add memory/CPU limits in docker-compose
4. **Secrets Management**: Use Docker secrets or external vaults
5. **Health Checks**: Verify health check endpoints work

### For Development
1. **Volume Mounts**: Use volumes for hot-reload during development
2. **Port Conflicts**: Check for port conflicts before starting services
3. **Environment Files**: Keep `.env` in `.gitignore`
4. **Testing**: Test with `docker-compose up` before committing

## 🐛 Troubleshooting

### Extension Not Working?
- ✅ Restart VS Code
- ✅ Check API key configuration: `Ctrl+Shift+P` → `Auto Docker: Configure API Keys`
- ✅ Verify internet connection
- ✅ Check Output panel: View → Output → Select "Auto Docker Extension"

### Incomplete Files?
- ✅ Try different model (GPT-4 vs GPT-3.5-turbo)
- ✅ Check project structure is supported
- ✅ Ensure `package.json` or `requirements.txt` exists
- ✅ Review console logs for errors

### AI Generation Fails?
- ✅ Verify API key is valid
- ✅ Check API quota/credits
- ✅ Fallback templates will be used automatically
- ✅ Try "Direct Mode" for faster generation

### Docker Compose Issues?
- ✅ Ensure Docker Desktop is running
- ✅ Run `docker-compose config` to validate syntax
- ✅ Check for port conflicts
- ✅ Review service dependencies

## 💡 Tips & Tricks

### Tip 1: Custom Output Path
Save Docker files to a specific folder:
```json
"autoDocker.dockerOutputPath": "docker"
```

### Tip 2: Multiple Databases
The extension automatically detects multiple database dependencies:
```json
{
  "dependencies": {
    "pg": "^8.0.0",        // PostgreSQL
    "mongodb": "^6.0.0",    // MongoDB
    "redis": "^4.0.0"       // Redis
  }
}
```
Result: All three databases in `docker-compose.yml`!

### Tip 3: Monorepo Structure
Organize your fullstack project:
```
project/
├── frontend/   ← Detected automatically
├── backend/    ← Detected automatically
└── shared/     ← Shared code
```

### Tip 4: Environment Variables
The generated `.env.example` includes ALL detected services:
- Database connection strings
- Message queue URLs
- Cache configurations
- Security keys (JWT, session secrets)

## 📊 Feature Comparison

| Feature | v2.5.0 | Other Extensions |
|---------|--------|------------------|
| **AI-Powered Generation** | ✅ GPT-4 & Gemini | ❌ Templates only |
| **Monorepo Support** | ✅ Separate Dockerfiles | ⚠️ Limited |
| **Multiple Databases** | ✅ Simultaneous | ❌ Single only |
| **Message Queues** | ✅ RabbitMQ, Kafka | ❌ None |
| **Search Engines** | ✅ Elasticsearch, OpenSearch | ❌ None |
| **WebSocket Support** | ✅ Built-in | ⚠️ Manual |
| **Health Checks** | ✅ All services | ❌ None |
| **Environment Generation** | ✅ Comprehensive | ⚠️ Basic |
| **Single-Folder Fullstack** | ✅ Detected | ❌ Not supported |
| **Reverse Proxy** | ✅ Nginx auto-config | ⚠️ Manual |

## 🤝 Contributing

Contributions are welcome! This is an open-source project.

### Areas for Improvement
- 🎯 Additional framework support (Deno, Bun, etc.)
- 🔧 Better Docker optimizations (BuildKit, cache layers)
- 🎨 UI/UX enhancements (better preview, editing)
- 🧪 Testing infrastructure (unit tests, integration tests)
- 📚 Documentation improvements
- 🌍 Internationalization (i18n)

### How to Contribute
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **VS Code Extension API**: For the powerful extension framework
- **OpenAI & Google Gemini**: For AI-powered Docker generation
- **Docker Community**: For best practices and optimization techniques
- **Contributors**: Everyone who has contributed to this project

## 🌟 Roadmap

### v2.6.0 (Planned)
- [ ] Kubernetes manifest generation
- [ ] Docker Swarm support
- [ ] CI/CD pipeline generation (GitHub Actions, GitLab CI)
- [ ] Performance monitoring integration (Prometheus, Grafana)
- [ ] Service mesh support (Istio, Linkerd)

### v3.0.0 (Future)
- [ ] Visual editor for docker-compose
- [ ] Cost estimation for cloud deployments
- [ ] Security scanning integration
- [ ] Multi-environment configuration (dev, staging, prod)
- [ ] Terraform/Infrastructure as Code generation

## 🛠️ Development Setup

If you want to clone this repository and run the extension locally for development:

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [VS Code](https://code.visualstudio.com/)
- [Git](https://git-scm.com/)

### Clone and Setup
```bash
# Clone the repository
git clone https://github.com/shinjansarkar/Auto-Docker.git
cd Auto-Docker

# Install dependencies
npm install

# Compile the extension
npm run compile
```

### Running the Extension
```bash
# Option 1: Launch Extension Development Host
code .
# Then press F5 to open a new VS Code window with the extension loaded

# Option 2: Watch mode for development
npm run watch
# In another terminal, open VS Code and press F5

# Option 3: Package and install locally
npm run package
code --install-extension auto-docker-extension-1.0.0.vsix
```

### Available Scripts
| Command | Description |
|---------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch for changes and auto-compile |
| `npm run package` | Create VSIX package for distribution |
| `npm test` | Run tests (if available) |

### Testing Your Changes
1. Make changes to the source code in `src/`
2. Press `Ctrl+Shift+F5` to reload the Extension Development Host
3. Test your extension commands with `Ctrl+Shift+P`

### Project Structure
```
Auto-Docker/
├── src/                     # TypeScript source code
│   ├── extension.ts         # Main extension entry point & commands
│   ├── projectAnalyzer.ts   # Intelligent project structure analysis
│   ├── llmService.ts        # AI integration (GPT-4/Gemini) + fallback templates
│   ├── fileManager.ts       # File operations, preview, and monorepo handling
│   └── types.d.ts           # TypeScript type definitions
├── dist/                    # Compiled JavaScript output (esbuild)
├── images/                  # Extension icons and assets
│   └── docker-icon.png      # Extension icon
├── package.json             # Extension manifest and dependencies
├── tsconfig.json            # TypeScript configuration
├── esbuild.js               # Build configuration
└── README.md                # This file
```

## 📈 Performance

- **Fast Analysis**: < 2 seconds for most projects
- **AI Generation**: 5-15 seconds (depending on model)
- **Fallback Templates**: Instant generation if AI fails
- **Preview**: Real-time file preview without disk writes
- **Monorepo**: Efficient parallel analysis of frontend/backend

## 🔐 Security & Privacy

- ✅ **API Keys**: Stored securely in VS Code settings (encrypted)
- ✅ **No Data Collection**: Your code never leaves your machine (except API calls)
- ✅ **Source Code Privacy**: Only project structure sent to AI, not actual code
- ✅ **Environment Variables**: `.env` values never transmitted
- ✅ **Open Source**: Fully auditable code

## 📞 Support & Community

- 📧 **Email**: [Report Issues](mailto:your-email@example.com)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/shinjansarkar/Auto-Docker/issues)
- 💡 **Feature Requests**: [GitHub Discussions](https://github.com/shinjansarkar/Auto-Docker/discussions)
- ⭐ **Star on GitHub**: [Auto-Docker Repository](https://github.com/shinjansarkar/Auto-Docker)

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [VS Code Extension API](https://code.visualstudio.com/api)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Google Gemini API](https://ai.google.dev/)

---

**Made with ❤️ for the developer community**

**Happy Dockerizing! 🐳✨**

[![GitHub stars](https://img.shields.io/github/stars/shinjansarkar/Auto-Docker?style=social)](https://github.com/shinjansarkar/Auto-Docker)
[![VS Code Installs](https://img.shields.io/visual-studio-marketplace/i/auto-docker-publisher.auto-docker-extension)](https://marketplace.visualstudio.com/)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/auto-docker-publisher.auto-docker-extension)](https://marketplace.visualstudio.com/)
