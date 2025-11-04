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
│   ├── extension.ts         # Main extension entry point
│   ├── projectAnalyzer.ts   # Project structure analysis
│   ├── llmService.ts        # AI integration (GPT/Gemini)
│   └── fileManager.ts       # File operations and preview
├── dist/                    # Compiled JavaScript output
├── images/                  # Extension icons and assets
├── package.json             # Extension manifest and dependencies
└── README.md               # This file
```

---

**Happy Dockerizing! 🐳✨**
