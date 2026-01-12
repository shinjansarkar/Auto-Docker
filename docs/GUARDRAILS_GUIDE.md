# Guardrails AI Integration - User Guide

## Overview

The Auto Docker Extension now includes **Guardrails AI Integration** for structured output validation. This ensures that all generated Docker files meet production standards, security best practices, and are syntactically correct.

## Features

### 🛡️ Automated Validation
- **Schema Validation**: Ensures Docker files have correct structure
- **Security Checks**: Detects hardcoded secrets, root users, and security issues
- **Best Practices**: Validates multi-stage builds, version pinning, health checks
- **Consistency Checks**: Verifies service dependencies and port conflicts

### 🔧 Auto-Fix Capabilities
- Automatically adds missing USER directives
- Replaces `:latest` tags with specific versions
- Fixes common syntax errors
- Applies security best practices

### 🔄 Re-Ask Mechanism
- If validation fails, LLM is re-prompted with specific error feedback
- Up to 2 automatic retry attempts (configurable)
- Each attempt learns from previous validation errors

## Configuration

### Settings

Add these settings to your VS Code settings:

```json
{
  "autoDocker.enableGuardrails": true,
  "autoDocker.guardrailsStrictMode": false,
  "autoDocker.maxReasks": 2
}
```

#### `autoDocker.enableGuardrails`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable Guardrails validation

#### `autoDocker.guardrailsStrictMode`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: When enabled, warnings are treated as errors

#### `autoDocker.maxReasks`
- **Type**: `number`
- **Default**: `2`
- **Range**: 1-5
- **Description**: Maximum number of re-ask attempts when validation fails

## Validators

### 1. No Root User Validator ❌ ROOT
**Severity**: Error  
**Purpose**: Ensures containers don't run as root

**What it checks**:
- Presence of `USER` directive
- Non-root user specification

**Auto-fix**: Adds `USER nodejs` before CMD instruction

**Example**:
```dockerfile
# ❌ Bad
FROM node:20-alpine
COPY . .
CMD ["node", "server.js"]

# ✅ Good
FROM node:20-alpine
COPY . .
USER nodejs
CMD ["node", "server.js"]
```

### 2. Multi-Stage Build Validator 🏗️
**Severity**: Warning  
**Purpose**: Recommends multi-stage builds for production

**What it checks**:
- Number of FROM statements
- Proper stage naming with AS

**Example**:
```dockerfile
# ✅ Good
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

### 3. Valid Ports Validator 🔌
**Severity**: Error  
**Purpose**: Validates port ranges

**What it checks**:
- Ports are between 1-65535
- Warns about privileged ports (<1024)

**Example**:
```dockerfile
# ❌ Bad
EXPOSE 70000  # Invalid port

# ⚠️ Warning
EXPOSE 80  # Privileged port, needs root

# ✅ Good
EXPOSE 3000
```

### 4. No Hardcoded Secrets Validator 🔒
**Severity**: Error  
**Purpose**: Prevents credential exposure

**What it checks**:
- API keys, passwords, tokens in ENV or RUN commands
- AWS credentials
- Private keys

**Example**:
```dockerfile
# ❌ Bad
ENV API_KEY=abc123secret456

# ✅ Good
ENV API_KEY=${API_KEY}
```

### 5. Health Check Validator 💓
**Severity**: Warning  
**Purpose**: Ensures production readiness

**What it checks**:
- Presence of HEALTHCHECK instruction in production builds

**Example**:
```dockerfile
# ✅ Good
HEALTHCHECK --interval=30s --timeout=10s \
  CMD node healthcheck.js || exit 1
```

### 6. Version Pinning Validator 📌
**Severity**: Warning  
**Purpose**: Ensures reproducible builds

**What it checks**:
- Base images use specific version tags
- Avoids `:latest` tag

**Auto-fix**: Replaces `:latest` with specific version

**Example**:
```dockerfile
# ❌ Bad
FROM node:latest

# ⚠️ Warning
FROM node

# ✅ Good
FROM node:20-alpine
```

### 7. Service Dependency Validator 🔄
**Severity**: Error  
**Purpose**: Detects circular dependencies

**What it checks**:
- Service dependency chains in docker-compose.yml
- Circular dependency detection

**Example**:
```yaml
# ❌ Bad - Circular dependency
services:
  frontend:
    depends_on:
      - backend
  backend:
    depends_on:
      - frontend  # ❌ Circular!

# ✅ Good
services:
  frontend:
    depends_on:
      - backend
  backend:
    # No depends_on
```

### 8. Port Conflict Validator ⚠️
**Severity**: Error  
**Purpose**: Prevents port binding conflicts

**What it checks**:
- Multiple services using same host port

**Example**:
```yaml
# ❌ Bad
services:
  frontend:
    ports:
      - "3000:80"
  backend:
    ports:
      - "3000:8000"  # ❌ Conflict!

# ✅ Good
services:
  frontend:
    ports:
      - "3000:80"
  backend:
    ports:
      - "8000:8000"
```

## Usage

### Automatic Validation

Guardrails validation runs automatically when you generate Docker files:

1. **Command Palette** → `Auto Docker: Analyze Project & Generate Docker Files`
2. Extension analyzes your project
3. LLM generates Docker files
4. **Guardrails validates** output
5. If errors found:
   - Auto-fix is attempted
   - If auto-fix fails, LLM is re-asked with error feedback
   - Process repeats up to `maxReasks` times
6. Validation report is displayed

### Understanding Validation Results

#### ✅ Validation Passed
```
🛡️ Guardrails Validation Report
==================================================

Status: ✅ PASSED
Validation Score: 100/100
Reasks: 0
```

#### ⚠️ Validation with Warnings
```
🛡️ Guardrails Validation Report
==================================================

Status: ✅ PASSED
Validation Score: 92/100
Reasks: 0

⚠️ Warnings:
  1. [best-practice] dockerfile: Consider using multi-stage build
     💡 Use builder stage for compilation and minimal runtime image
```

#### ❌ Validation Failed
```
🛡️ Guardrails Validation Report
==================================================

Status: ❌ FAILED
Validation Score: 60/100
Reasks: 2

❌ Errors:
  1. [CRITICAL] dockerfile: Dockerfile should include USER directive
     💡 Add "USER nodejs" or "USER appuser" before CMD
  2. [HIGH] dockerCompose: Port 3000 used by multiple services
     💡 Assign unique host ports to each service

🔧 Auto-corrections Applied:
  1. dockerfile: Added USER nodejs
     Reason: Security best practice
```

### Manual Validation

You can also manually validate existing Docker files:

```typescript
// In your code
import { GuardrailsService } from './guardrailsService';

const guardrails = new GuardrailsService();
const validated = await guardrails.validateDockerFiles(dockerFiles, {
    isProduction: true
});

if (!validated.validationResult.valid) {
    console.log('Validation failed:', validated.validationResult.errors);
}
```

## Validation Workflow

```
┌─────────────────────┐
│  Generate with LLM  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Phase 1: Schema    │ ◄─── Zod validation
│  Validation         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Phase 2: Custom    │ ◄─── Docker validators
│  Validators         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Phase 3: Semantic  │ ◄─── Consistency checks
│  Validation         │
└──────────┬──────────┘
           │
           ▼
      ┌────────┐
      │ Valid? │
      └───┬┬───┘
     Yes  ││  No
      │   ││
      │   │└──► Auto-fix attempted?
      │   │         │
      │   │     Yes │ No
      │   │         │  │
      │   │    Fixed?  │
      │   │      │     │
      │   │   Yes│ No  │
      │   │      │  │  │
      │   │◄─────┘  │  │
      │   │         │  │
      │   │   ┌─────▼──▼───┐
      │   │   │  Reasks <  │
      │   │   │  maxReasks?│
      │   │   └──┬──────┬──┘
      │   │    Yes│    No│
      │   │       │      │
      │   │   Re-ask  Show
      │   │   with   error
      │   │  feedback  +
      │   │     │    ask user
      │   │     └─►Loop│
      │   │           │
      ▼   ▼           ▼
   ┌──────────────────┐
   │  Return Files    │
   └──────────────────┘
```

## Best Practices

### For Developers

1. **Keep Guardrails Enabled**: Always run with validation for production quality
2. **Review Validation Reports**: Check warnings even if validation passes
3. **Use Strict Mode for CI/CD**: Enable `guardrailsStrictMode` in CI pipelines
4. **Customize Validators**: Add project-specific validators as needed

### For Teams

1. **Standardize Settings**: Share team settings via `.vscode/settings.json`
2. **Enforce Validation**: Make Guardrails validation mandatory in code reviews
3. **Monitor Validation Scores**: Track improvement over time
4. **Document Exceptions**: If you bypass validation, document why

## Troubleshooting

### Validation Always Fails

**Issue**: Validation fails even after multiple reasks

**Solutions**:
1. Check if your project structure is unusual
2. Temporarily disable strict mode
3. Review validation errors carefully
4. Manually fix critical issues
5. Report patterns that consistently fail

### False Positives

**Issue**: Validator flags correct code as error

**Solutions**:
1. Check if validator is appropriate for your use case
2. Disable specific validator if not applicable
3. Report false positive to improve validators

### Performance Issues

**Issue**: Validation takes too long

**Solutions**:
1. Reduce `maxReasks` value
2. Disable non-critical validators
3. Use faster AI provider

## API Reference

### GuardrailsService

```typescript
class GuardrailsService {
    /**
     * Validate Docker files
     */
    async validateDockerFiles(
        files: DockerFiles,
        metadata?: any
    ): Promise<ValidatedDockerFiles>

    /**
     * Attempt to auto-fix issues
     */
    async attemptAutoFix(
        files: DockerFiles,
        errors: ValidationError[]
    ): Promise<{ files: DockerFiles; corrections: Correction[] }>

    /**
     * Generate validation report
     */
    generateReport(result: ValidationResult): string

    /**
     * Show validation results to user
     */
    async showValidationResults(result: ValidationResult): Promise<void>
}
```

### ValidatorRegistry

```typescript
class ValidatorRegistry {
    /**
     * Register custom validator
     */
    register(validator: DockerValidator): void

    /**
     * Get validator by name
     */
    get(name: string): DockerValidator | undefined

    /**
     * Validate Dockerfile
     */
    async validateDockerfile(
        dockerfile: string,
        validatorNames?: string[],
        metadata?: any
    ): Promise<ValidationError[]>

    /**
     * Validate docker-compose.yml
     */
    async validateDockerCompose(
        composeContent: string,
        validatorNames?: string[]
    ): Promise<ValidationError[]>
}
```

## Custom Validators

You can create custom validators for project-specific needs:

```typescript
import { DockerValidator, ValidationError } from './dockerValidators';

class CustomOrgValidator extends DockerValidator {
    name = 'custom-org-standard';
    description = 'Validates against organization standards';
    severity: 'error' | 'warning' = 'warning';

    async validate(dockerfile: string): Promise<ValidationError[]> {
        const errors: ValidationError[] = [];
        
        // Your validation logic
        if (!dockerfile.includes('LABEL maintainer=')) {
            errors.push(this.createError(
                'dockerfile',
                'Missing maintainer label',
                undefined,
                'Add LABEL maintainer="your-email@company.com"'
            ));
        }

        return errors;
    }
}

// Register custom validator
const registry = new ValidatorRegistry();
registry.register(new CustomOrgValidator());
```

## Contributing

To add new validators or improve existing ones:

1. Create validator in `src/dockerValidators.ts`
2. Extend `DockerValidator` class
3. Implement `validate()` method
4. Register in `ValidatorRegistry`
5. Add tests
6. Update documentation

## Support

- **Issues**: [GitHub Issues](https://github.com/auto-docker/auto-docker-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/auto-docker/auto-docker-extension/discussions)
- **Documentation**: [Full Docs](../AI-DOCKERFILE-ENHANCEMENT-PLAN.md)

---

**Version**: 2.7.0+  
**Last Updated**: January 7, 2026
