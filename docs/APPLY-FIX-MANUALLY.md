# CRITICAL FIX - Apply This Manually

## File: src/fileManager.ts
## Lines: 588-602

### FIND THIS CODE (lines 588-602):
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

### REPLACE WITH THIS CODE:
```typescript
            const filesToWrite = [
                { path: frontendDockerfilePath, content: frontendDockerfile, name: `${projectStructure.frontendPath}/Dockerfile` },
                { path: backendDockerfilePath, content: backendDockerfile, name: `${projectStructure.backendPath}/Dockerfile` },
                { path: frontendDockerignorePath, content: dockerignore, name: `${projectStructure.frontendPath}/.dockerignore` },
                { path: backendDockerignorePath, content: dockerignore, name: `${projectStructure.backendPath}/.dockerignore` },
                { path: dockerComposePath, content: this.generateMonorepoDockerCompose(projectStructure), name: 'docker-compose.yml' },
                // ALWAYS generate nginx.conf for monorepos - critical for reverse proxy
                { 
                    path: nginxConfPath, 
                    content: this.generateMonorepoNginxConf(projectStructure), 
                    name: 'nginx.conf' 
                },
            ];
```

## What Changed:
1. **Removed** the conditional `if (dockerFiles.nginxConf)` check
2. **Moved** the nginx.conf object directly into the `filesToWrite` array
3. **Added** a comment explaining why this is critical

## Why This Fixes The Bug:
- Before: nginx.conf was only generated if the LLM returned it (unreliable)
- After: nginx.conf is ALWAYS generated for monorepos (guaranteed)

## How To Apply:
1. Open `src/fileManager.ts` in VS Code
2. Press `Ctrl+G` and go to line 588
3. Select lines 588-602
4. Delete them
5. Paste the replacement code above
6. Save the file
7. Run: `npm run compile`
8. Run: `vsce package`

This is a 7-line deletion and 6-line addition (net: -1 line, removes conditional).
