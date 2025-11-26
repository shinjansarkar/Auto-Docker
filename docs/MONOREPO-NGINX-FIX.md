# Monorepo Nginx Configuration Fix

## Problem
When generating Docker files for monorepos, the nginx.conf file is not being created in the root directory. This is because:

1. In `fileManager.ts` line 596-602, there's a conditional check `if (dockerFiles.nginxConf)` that only adds nginx.conf if the LLM generated one
2. For monorepos, nginx.conf should ALWAYS be generated regardless of LLM output
3. The nginx configuration is critical for routing between frontend and backend services

## Solution
Replace lines 588-602 in `src/fileManager.ts`:

**Current Code:**
```typescript
const filesToWrite = [
    { path: frontendDockerfilePath, content: frontendDockerfile, name: `${projectStructure.frontendPath}/Dockerfile` },
    { path: backendDockerfilePath, content: backendDockerfile, name: `${projectStructure.backendPath}/Dockerfile` },
    { path: frontendDockerignorePath, content: dockerignore, name: `${projectStructure.frontendPath}/.dockerignore` },
    { path: backendDockerignorePath, content: dockerignore, name: `${projectStructure.backendPath}/.dockerignore` },
    { path: dockerComposePath, content: this.generateMonorepoDockerCompose(projectStructure), name: 'docker-compose.yml' },
];

if (dockerFiles.nginxConf) {
    filesToWrite.push({ 
        path: nginxConfPath, 
        content: this.generateMonorepoNginxConf(projectStructure), 
        name: 'nginx.conf' 
    });
}
```

**Fixed Code:**
```typescript
const filesToWrite = [
    { path: frontendDockerfilePath, content: frontendDockerfile, name: `${projectStructure.frontendPath}/Dockerfile` },
    { path: backendDockerfilePath, content: backendDockerfile, name: `${projectStructure.backendPath}/Dockerfile` },
    { path: frontendDockerignorePath, content: dockerignore, name: `${projectStructure.frontendPath}/.dockerignore` },
    { path: backendDockerignorePath, content: dockerignore, name: `${projectStructure.backendPath}/.dockerignore` },
    { path: dockerComposePath, content: this.generateMonorepoDockerCompose(projectStructure), name: 'docker-compose.yml' },
    // ALWAYS generate nginx.conf for monorepos
    { 
        path: nginxConfPath, 
        content: this.generateMonorepoNginxConf(projectStructure), 
        name: 'nginx.conf' 
    },
];
```

## Port Detection
The nginx configuration in `generateMonorepoNginxConf()` (lines 991-1046) already uses the correct ports:
- Frontend: port 3000
- Backend: port 5000

These ports are also correctly configured in:
- `generateMonorepoFrontendDockerfile()` - EXPOSE 3000
- `generateMonorepoBackendDockerfile()` - EXPOSE 5000  
- `generateMonorepoDockerCompose()` - Maps ports 3000:3000 and 5000:5000

## Files Generated for Monorepos
After the fix, the following files will be created:
- `frontend/Dockerfile` - Frontend container configuration
- `backend/Dockerfile` - Backend container configuration
- `frontend/.dockerignore` - Frontend ignore rules
- `backend/.dockerignore` - Backend ignore rules
- `docker-compose.yml` - Root level orchestration
- `nginx.conf` - **ROOT LEVEL** reverse proxy configuration

## Testing
To test the fix:
1. Apply the code change above
2. Build the extension: `npm run compile`
3. Package the extension: `vsce package`
4. Test on a monorepo with frontend/ and backend/ directories
5. Verify nginx.conf is created in the root directory
