# Auto Docker Extension

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue)](https://marketplace.visualstudio.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful VS Code extension that automatically generates Docker configuration files by analyzing your project structure using AI (GPT/Gemini) integration.

## 🚀 Features

- **🔍 Intelligent Project Analysis**: Automatically detects project type, frameworks, and dependencies
- **🤖 AI-Powered Generation**: Uses OpenAI GPT or Google Gemini to create optimized Docker configurations
- **📦 Multi-Stage Dockerfiles**: Generates production-ready multi-stage builds when appropriate
- **🐳 Complete Docker Setup**: Creates Dockerfile, docker-compose.yml, .dockerignore, and nginx.conf
- **⚡ Framework Support**: Supports React, Angular, Vue, Node.js, Python, Java, Go, and more
- **🔧 Customizable**: Configurable output paths, API providers, and generation preferences
- **👀 Preview Mode**: Review generated files before saving them to your workspace
- **🔒 Secure**: API keys are stored securely in VS Code settings

## 📋 Supported Project Types

### Frontend Frameworks
- React, Angular, Vue.js, Next.js, Nuxt.js, Static Sites

### Backend Frameworks
- Node.js (Express, Fastify, NestJS)
- Python (Django, Flask, FastAPI)
- Java (Spring Boot), Go, Ruby

### Databases
- PostgreSQL, MySQL, MongoDB, Redis

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

1. Open your project in VS Code
2. Press `Ctrl+Shift+P` and type `Auto Docker: Analyze Project`
3. Review generated files in preview
4. Click "Create Files" to save to workspace

### Available Commands
- `Auto Docker: Analyze Project & Generate Docker Files`
- `Auto Docker: Regenerate Docker Files`
- `Auto Docker: Configure API Keys`

## 📂 Generated Files

- **Dockerfile**: Optimized for your tech stack with multi-stage builds
- **docker-compose.yml**: Complete service definitions with databases
- **.dockerignore**: Optimized exclusion patterns
- **nginx.conf**: Production-ready configuration (for frontend projects)

## ⚙️ Extension Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `autoDocker.apiProvider` | AI provider (openai/gemini) | `openai` |
| `autoDocker.model` | Model to use | `gpt-4` |
| `autoDocker.overwriteFiles` | Auto-overwrite existing files | `false` |
| `autoDocker.includeNginx` | Generate nginx.conf for frontend | `true` |
| `autoDocker.dockerOutputPath` | Custom output path | `""` (root) |

## 🐛 Troubleshooting

**Extension not working?**
- Restart VS Code
- Check API key configuration
- Verify internet connection

**Incomplete files?**
- Try different model
- Check Output panel for logs
- Verify project structure is supported

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- Additional framework support
- Better Docker optimizations
- UI/UX enhancements

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- VS Code Extension API
- OpenAI & Google Gemini APIs
- Docker community

---

**Happy Dockerizing! 🐳✨**
