# Guardrails AI Integration - Installation & Testing

## Prerequisites

- Node.js >= 16.x
- VS Code >= 1.95.0
- Auto Docker Extension v2.6.1+

## Installation

### Step 1: Install Dependencies

```bash
# Navigate to extension directory
cd path/to/Auto\ Docker-extension

# Install new dependencies
npm install zod@^3.22.4 js-yaml@^4.1.0
npm install --save-dev @types/js-yaml@^4.0.9

# Optional: Install Guardrails AI SDK (future integration)
npm install --save-optional @guardrails-ai/sdk@^0.4.0
```

### Step 2: Compile Extension

```bash
# Clean previous build
npm run clean

# Compile TypeScript
npm run compile

# Or watch for changes during development
npm run watch
```

### Step 3: Reload Extension

1. Press `F5` in VS Code (opens Extension Development Host)
2. Or manually reload: **Developer: Reload Window**

## Configuration

### Enable Guardrails

Add to `.vscode/settings.json`:

```json
{
  "autoDocker.enableGuardrails": true,
  "autoDocker.guardrailsStrictMode": false,
  "autoDocker.maxReasks": 2
}
```

### Verify Configuration

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run: `Preferences: Open Settings (JSON)`
3. Search for `autoDocker`
4. Verify Guardrails settings are present

## Testing

### Test 1: Basic Validation

Create a test project:

```bash
mkdir test-project
cd test-project
npm init -y
```

Add a simple Express server:

```javascript
// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello Docker!');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

Generate Docker files:
1. Open test-project in VS Code
2. Command Palette → `Auto Docker: Analyze Project & Generate Docker Files`
3. Check Output Channel for validation results

**Expected Output**:
```
🔍 Starting project analysis...
📊 Analyzing project structure...
🤖 Generating Docker files with AI...
🛡️ Starting Guardrails validation...
Phase 1: Schema validation...
Phase 2: Custom validator checks...
Phase 3: Semantic validation...
✅ Validation passed successfully
```

### Test 2: Validation with Errors

Create a Dockerfile with intentional errors:

```dockerfile
# Intentional errors for testing
FROM node:latest
COPY . .
ENV SECRET_KEY=hardcoded_secret_abc123
EXPOSE 70000
CMD ["node", "index.js"]
```

Run validation:
```bash
# Should detect:
# 1. Using :latest tag
# 2. Hardcoded secret
# 3. Invalid port (>65535)
# 4. No USER directive
# 5. No health check
```

**Expected Errors**:
```
❌ Errors:
  1. [CRITICAL] dockerfile: Potential Secret Key detected
  2. [CRITICAL] dockerfile: Invalid port 70000
  3. [CRITICAL] dockerfile: Should include USER directive

⚠️ Warnings:
  1. [best-practice] dockerfile: Avoid using "latest" tag
  2. [best-practice] dockerfile: Include HEALTHCHECK instruction
```

### Test 3: Auto-Fix

The extension should:
1. Detect errors
2. Attempt auto-fix
3. Re-validate
4. Show corrections made

**Check for**:
- USER directive added
- :latest replaced with :20-alpine
- Validation score improvement

### Test 4: Re-Ask Mechanism

Set `maxReasks` to 2 and generate for complex project:

```json
{
  "autoDocker.maxReasks": 2
}
```

Monitor output for:
```
🔄 Attempting OpenAI (Attempt 1/3)...
❌ Validation failed with 3 errors
🔧 Attempting auto-fix...
🔄 Re-asking LLM with validation feedback...
🔄 Attempting OpenAI (Attempt 2/3)...
✅ Validation passed!
```

### Test 5: Strict Mode

Enable strict mode:

```json
{
  "autoDocker.guardrailsStrictMode": true
}
```

Generate Docker files - warnings should now cause validation failure:

```
Status: ❌ FAILED
Reason: Strict mode enabled, warnings treated as errors
```

## Verification Checklist

- [ ] Dependencies installed successfully
- [ ] Extension compiles without errors
- [ ] Guardrails settings appear in VS Code settings
- [ ] Validation runs automatically on generation
- [ ] Schema validation works (Phase 1)
- [ ] Custom validators work (Phase 2)
- [ ] Semantic validation works (Phase 3)
- [ ] Validation report displays correctly
- [ ] Auto-fix functionality works
- [ ] Re-ask mechanism triggers on errors
- [ ] Strict mode behaves correctly
- [ ] No secrets detected in generated files
- [ ] USER directive added automatically
- [ ] Version pinning works
- [ ] Port validation works
- [ ] Service dependency validation works
- [ ] Port conflict detection works

## Common Issues & Solutions

### Issue: "Cannot find module 'zod'"

**Solution**:
```bash
npm install zod
npm run compile
```

### Issue: "Cannot find module 'js-yaml'"

**Solution**:
```bash
npm install js-yaml @types/js-yaml
npm run compile
```

### Issue: Validation doesn't run

**Solution**:
1. Check `autoDocker.enableGuardrails` is `true`
2. Verify extension reloaded after changes
3. Check Output Channel for errors
4. Try: Developer → Reload Window

### Issue: TypeScript compilation errors

**Solution**:
```bash
npm run clean
npm install
npm run compile
```

### Issue: Validators not found

**Solution**:
1. Ensure `dockerValidators.ts` is in `src/` directory
2. Check imports in `guardrailsService.ts`
3. Verify `ValidatorRegistry` is initialized

## Performance Benchmarks

### Target Metrics

- **Validation Time**: < 500ms
- **Auto-Fix Time**: < 200ms
- **Total Overhead**: < 1s per generation

### Measuring Performance

Add timing logs:

```typescript
// In guardrailsService.ts
const startTime = Date.now();
// ... validation logic ...
const endTime = Date.now();
console.log(`Validation took ${endTime - startTime}ms`);
```

### Expected Results

```
[Guardrails] Phase 1: Schema validation... (50ms)
[Guardrails] Phase 2: Custom validator checks... (200ms)
[Guardrails] Phase 3: Semantic validation... (100ms)
[Guardrails] Total validation time: 350ms
```

## Integration Tests

### Create Test Suite

```typescript
// src/test/guardrails.test.ts
import { GuardrailsService } from '../guardrailsService';
import { ValidatorRegistry } from '../dockerValidators';

describe('Guardrails Integration', () => {
    let service: GuardrailsService;

    beforeEach(() => {
        service = new GuardrailsService();
    });

    it('should validate valid Dockerfile', async () => {
        const dockerfile = `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
USER nodejs
EXPOSE 3000
HEALTHCHECK CMD node healthcheck.js
CMD ["node", "server.js"]
        `;

        const result = await service.validateDockerFiles({
            dockerfile,
            dockerCompose: 'version: "3.8"\nservices:\n  app:\n    build: .',
            dockerIgnore: 'node_modules\n.git'
        });

        expect(result.validationResult.valid).toBe(true);
        expect(result.validationResult.errors).toHaveLength(0);
    });

    it('should detect hardcoded secrets', async () => {
        const dockerfile = `
FROM node:20-alpine
ENV API_KEY=secret123abc
        `;

        const result = await service.validateDockerFiles({
            dockerfile,
            dockerCompose: 'version: "3.8"\nservices:\n  app:\n    build: .',
            dockerIgnore: 'node_modules'
        });

        expect(result.validationResult.valid).toBe(false);
        expect(result.validationResult.errors.length).toBeGreaterThan(0);
    });
});
```

### Run Tests

```bash
npm test
```

## Debugging

### Enable Debug Logging

```typescript
// In guardrailsService.ts
private log(message: string): void {
    this.outputChannel.appendLine(`[Guardrails] ${message}`);
    console.log(`[Guardrails] ${message}`); // Console logs
}
```

### Check Output Channels

1. View → Output
2. Select "Auto Docker" or "Auto Docker - Guardrails"
3. Monitor validation progress

### Breakpoints

Set breakpoints in:
- `guardrailsService.ts` → `validateDockerFiles()`
- `dockerValidators.ts` → Individual validator `validate()` methods
- `llmService.ts` → After LLM response, before validation

## Next Steps

After successful installation:

1. ✅ Test with multiple project types
2. ✅ Customize validators for your needs
3. ✅ Add custom validation rules
4. ✅ Share team configuration
5. ✅ Monitor validation metrics
6. ✅ Contribute improvements

## Resources

- **Full Documentation**: [GUARDRAILS_GUIDE.md](./GUARDRAILS_GUIDE.md)
- **Enhancement Plan**: [AI-DOCKERFILE-ENHANCEMENT-PLAN.md](../AI-DOCKERFILE-ENHANCEMENT-PLAN.md)
- **Validators**: [src/dockerValidators.ts](../src/dockerValidators.ts)
- **Service**: [src/guardrailsService.ts](../src/guardrailsService.ts)

## Support

Issues? Questions?

- **GitHub Issues**: [Report a bug](https://github.com/auto-docker/auto-docker-extension/issues)
- **Discussions**: [Ask a question](https://github.com/auto-docker/auto-docker-extension/discussions)

---

**Happy Testing! 🛡️**
