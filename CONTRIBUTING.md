# Contributing to Auto Docker Extension

Thank you for considering contributing to the Auto Docker Extension! This document provides guidelines and instructions for contributing.

---

## 📚 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## 🤝 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for everyone. We expect all contributors to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling, insulting comments, or personal attacks
- Publishing others' private information
- Other conduct inappropriate in a professional setting

---

## 🚀 Getting Started

### Prerequisites

Before contributing, ensure you have:

```bash
Node.js >= 18.0.0
VS Code >= 1.95.0
Git >= 2.30.0
Docker Desktop (for testing)
```

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR-USERNAME/auto-docker-extension.git
   cd auto-docker-extension
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/auto-docker/auto-docker-extension.git
   ```

---

## 🔧 Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Build Extension

```bash
# Development build with watch
npm run watch

# Production build
npm run compile
```

### 3. Run Extension

Press `F5` in VS Code to launch the Extension Development Host

### 4. Configure API Keys (Optional)

For testing LLM features:

```
Ctrl+Shift+P > Auto Docker: Configure API Keys
```

---

## 💡 How to Contribute

### Types of Contributions

We welcome various types of contributions:

#### 🐛 Bug Reports

Found a bug? Please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- VS Code version, OS, extension version
- Relevant logs/screenshots

#### ✨ Feature Requests

Have an idea? Create an issue with:
- Clear description of the feature
- Use case and benefits
- Possible implementation approach
- Examples if applicable

#### 📝 Documentation

Improvements to documentation are always welcome:
- README updates
- Code comments
- API documentation
- Tutorials and guides
- FAQ entries

#### 🔧 Code Contributions

See [Pull Request Process](#pull-request-process) below

---

## 🔀 Pull Request Process

### 1. Create a Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clear, maintainable code
- Follow coding standards (see below)
- Add tests for new features
- Update documentation

### 3. Test Changes

```bash
# Run linter
npm run lint

# Run tests
npm test

# Test manually in Extension Host (F5)
```

### 4. Commit Changes

Follow conventional commit format:

```bash
git commit -m "feat: add support for Solid.js framework"
git commit -m "fix: resolve Docker build error for Vue projects"
git commit -m "docs: update installation instructions"
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style/formatting
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

### 5. Push and Create PR

```bash
# Push to your fork
git push origin feature/your-feature-name

# Create Pull Request on GitHub
```

**PR Title Format:**
```
feat: add Solid.js framework detection
fix: resolve nginx.conf generation error
docs: improve test automation guide
```

**PR Description Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested manually
- [ ] Added unit tests
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex logic
- [ ] Updated documentation
- [ ] No new warnings
```

### 6. Code Review

- Respond to feedback promptly
- Make requested changes
- Keep PR scope focused
- Be patient and respectful

---

## 📏 Coding Standards

### TypeScript Style Guide

#### Naming Conventions

```typescript
// ✅ Good
class ProjectAnalyzer { }
interface DockerConfig { }
type FrameworkType = 'frontend' | 'backend';
const MAX_RETRY_COUNT = 3;
function analyzeProject() { }
const isValidProject = true;

// ❌ Bad
class project_analyzer { }
interface dockerconfig { }
const max_retry_count = 3;
function AnalyzeProject() { }
```

#### Type Safety

```typescript
// ✅ Good: Explicit types
function processFiles(files: string[]): Promise<ProcessResult> {
    const config: DockerConfig = getConfig();
    return process(files, config);
}

// ❌ Bad: Any types
function processFiles(files: any): any {
    const config: any = getConfig();
    return process(files, config);
}
```

#### Error Handling

```typescript
// ✅ Good: Comprehensive error handling
try {
    const result = await operation();
    return result;
} catch (error) {
    const message = error instanceof Error 
        ? error.message 
        : 'Unknown error';
    
    logger.error(`Operation failed: ${message}`);
    vscode.window.showErrorMessage(`Failed: ${message}`);
    throw error;
}

// ❌ Bad: Silent failures
try {
    await operation();
} catch (e) {
    // Silent failure
}
```

#### Async/Await

```typescript
// ✅ Good: Sequential when needed
async function processSequential() {
    const data = await fetchData();
    const processed = await processData(data);
    return processed;
}

// ✅ Good: Parallel when possible
async function processParallel() {
    const [data1, data2, data3] = await Promise.all([
        fetchData1(),
        fetchData2(),
        fetchData3()
    ]);
    return combine(data1, data2, data3);
}

// ❌ Bad: Sequential when could be parallel
async function processSlow() {
    const data1 = await fetchData1();
    const data2 = await fetchData2(); // Could run in parallel
    const data3 = await fetchData3(); // Could run in parallel
    return combine(data1, data2, data3);
}
```

### Code Organization

```typescript
// ✅ Good: Well-organized class
export class DockerGenerator {
    // Constants
    private static readonly DEFAULT_PORT = 3000;
    
    // Properties
    private readonly config: GeneratorConfig;
    private outputChannel: vscode.OutputChannel;
    
    // Constructor
    constructor(config: GeneratorConfig) {
        this.config = config;
        this.outputChannel = vscode.window.createOutputChannel('Docker');
    }
    
    // Public methods
    public async generate(): Promise<DockerFiles> {
        return this.generateFiles();
    }
    
    // Private methods
    private async generateFiles(): Promise<DockerFiles> {
        // Implementation
    }
    
    // Cleanup
    public dispose(): void {
        this.outputChannel.dispose();
    }
}
```

---

## 🧪 Testing Guidelines

### Test Structure

```typescript
import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';

describe('ProjectAnalyzer', () => {
    let analyzer: ProjectAnalyzer;
    
    beforeEach(() => {
        analyzer = new ProjectAnalyzer('/test/path');
    });
    
    describe('analyze()', () => {
        it('should detect React project', async () => {
            const result = await analyzer.analyze();
            assert.strictEqual(result.framework, 'React');
        });
        
        it('should handle missing package.json', async () => {
            await assert.rejects(
                analyzer.analyze(),
                /package.json not found/
            );
        });
    });
});
```

### Test Coverage

Aim for:
- **Unit tests:** 90% coverage
- **Integration tests:** Key workflows
- **E2E tests:** Critical user paths

### Running Tests

```bash
# All tests
npm test

# Specific file
npm test -- --grep "ProjectAnalyzer"

# With coverage
npm run test:coverage

# Integration tests
cd test-automation
node runTests.js
```

---

## 📚 Documentation

### Code Documentation

```typescript
/**
 * Analyzes project structure and generates Docker configuration
 * 
 * @param workspacePath - Absolute path to project workspace
 * @param options - Optional configuration for analysis
 * @returns Promise resolving to Docker configuration
 * 
 * @throws {Error} If workspace is invalid or analysis fails
 * 
 * @example
 * ```typescript
 * const generator = new DockerGenerator();
 * const config = await generator.analyze('/path/to/project', {
 *   skipLinting: false,
 *   includeDevDependencies: true
 * });
 * ```
 */
export async function analyze(
    workspacePath: string,
    options?: AnalysisOptions
): Promise<DockerConfig> {
    // Implementation
}
```

### README Updates

When adding features:
1. Update feature list
2. Add usage examples
3. Update supported technologies
4. Include screenshots if applicable

### Changelog

Update `CHANGELOG.md` with:
```markdown
## [2.7.0] - 2025-12-15

### Added
- Support for Solid.js framework detection
- Improved monorepo handling

### Fixed
- Docker build error with Vue 3 projects
- Nginx configuration for SPA routing

### Changed
- Updated LLM prompts for better accuracy
```

---

## 🏷️ Issue Labels

Understanding our labels:

| Label | Meaning |
|-------|---------|
| `bug` | Something isn't working |
| `enhancement` | New feature request |
| `documentation` | Documentation improvements |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention needed |
| `priority: high` | Critical issue |
| `priority: medium` | Important issue |
| `priority: low` | Nice to have |

---

## 🎯 Areas Needing Help

We especially welcome contributions in:

### High Priority
- [ ] Add support for new frameworks (Remix, Qwik, etc.)
- [ ] Improve monorepo detection accuracy
- [ ] Add more comprehensive tests
- [ ] Performance optimizations

### Medium Priority
- [ ] Documentation improvements
- [ ] Better error messages
- [ ] UI/UX enhancements
- [ ] Code refactoring

### Low Priority
- [ ] Additional configuration options
- [ ] Extended logging
- [ ] CLI version of the tool

---

## 📞 Getting Help

### Questions?

- **GitHub Discussions:** For general questions
- **GitHub Issues:** For bug reports and feature requests
- **Documentation:** Check DEVELOPER_GUIDE.md

### Maintainers

Feel free to tag maintainers in PRs if:
- No response after 7 days
- Critical bug fix
- Breaking changes proposed

---

## 🎉 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Acknowledged in the extension

Thank you for contributing! 🚀

---

**Last Updated:** December 12, 2025
