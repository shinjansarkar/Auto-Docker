# Changelog

All notable changes to the Auto Docker Extension will be documented in this file.

## [2.6.0] - 2025-12-05

### 🎉 Major Improvements

#### Fixed - Lockfile Copying (CRITICAL)
- **CRITICAL FIX:** Fixed lockfile copying in all Dockerfile generation functions
  - `package-lock.json`, `yarn.lock`, and `pnpm-lock.yaml` are now properly copied before `npm ci`
  - This ensures deterministic builds and prevents version conflicts
  - Affects Next.js, Nuxt, SvelteKit, generic frontends, Node.js backends, and monorepo structures
- Fixed monorepo frontend and backend Dockerfile lockfile handling
- Added support for yarn and pnpm lockfiles with frozen-lockfile flags

#### Enhanced - Dependency Installation
- Enhanced dependency installation to support npm, yarn, and pnpm package managers
- Proper lockfile detection with fallback to `npm install` only when no lockfile exists
- Uses `npm ci --prefer-offline` for package-lock.json
- Uses `yarn install --frozen-lockfile` for yarn.lock
- Uses `pnpm install --frozen-lockfile` for pnpm-lock.yaml

### Technical Details

**Files Modified:**
- `src/fileManager.ts` - Fixed 2 locations (monorepo frontend/backend)
- `src/llmService.ts` - Fixed 7 locations (all Dockerfile generators)

**Before (BROKEN):**
```dockerfile
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \
    else npm install; fi
```
**Problem:** `package*.json` glob does NOT match `package-lock.json` (dash breaks pattern)

**After (FIXED):**
```dockerfile
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then npm ci --prefer-offline; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
    else npm install; fi
```

### Benefits
- ✅ Deterministic builds with locked dependencies
- ✅ Prevents version conflicts in Docker containers
- ✅ Supports npm, yarn, and pnpm ecosystems
- ✅ Faster builds with `npm ci` instead of `npm install`
- ✅ Production-ready Docker configurations

---

## [2.5.5] - Previous Release

### Features
- AI-powered Docker file generation
- Support for 25+ frameworks and languages
- Monorepo support with separate Dockerfiles
- Advanced service detection (databases, message queues, caching, search engines)
- Multi-stage Docker builds
- Nginx reverse proxy configuration
- Environment variable management

---

## Future Enhancements

### Planned for v3.0.0
- **Deep File Scanning:** Detect dependency files in nested directories (e.g., `requirements/requirements.txt`)
- **Enhanced Python Support:** Better handling of `pyproject.toml` and `Pipfile`
- **Kubernetes Manifests:** Generate K8s deployment files
- **Service Mesh Support:** Istio, Linkerd configuration generation

---

**Full Changelog:** https://github.com/auto-docker/auto-docker-extension/compare/v2.5.5...v2.6.0
