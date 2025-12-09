import * as vscode from 'vscode';
import * as path from 'path';
import { FullStackDetector } from './frameworkDetector';
import { BuildConfigDetector } from './buildConfigDetector';
import { MonorepoDetector } from './monorepoDetector';
import { DockerGeneratorFinal } from './dockerGeneratorAdvanced';
import { SafeFileReader } from './safeFileReader';

/**
 * Enhanced Project Analyzer Integration
 * Combines all detection modules for comprehensive project analysis
 */

export interface EnhancedProjectAnalysis {
  frameworks: any;
  buildConfig: any;
  monorepo: any;
  generatedFiles: {
    dockerfile: string;
    dockerCompose: string;
    nginx: string;
  };
  metadata: {
    detectionTime: number;
    confidence: number;
    warnings: string[];
    suggestions: string[];
  };
}

export class EnhancedProjectAnalyzer {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Perform complete analysis using all detection modules
   */
  async analyzeCompleteStack(): Promise<EnhancedProjectAnalysis> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Step 1: Detect all frameworks and technologies
      console.log('🔍 Detecting frameworks and technologies...');
      const frameworks = await FullStackDetector.detectAll(this.projectPath);
      
      if (!frameworks.frontend?.length && !frameworks.backend?.length) {
        warnings.push('No frontend or backend frameworks detected');
        suggestions.push('Ensure package.json exists and contains framework dependencies');
      }

      // Step 2: Detect monorepo structure
      console.log('🏗️  Detecting monorepo structure...');
      const monorepo = await MonorepoDetector.detectMonorepo(this.projectPath);
      
      if (monorepo.isMonorepo) {
        console.log(`✅ Detected ${monorepo.type} monorepo with ${monorepo.workspaces.length} workspaces`);
      }

      // Step 3: Analyze build configuration
      console.log('⚙️  Analyzing build configuration...');
      const buildConfigs: any = {};
      
      if (frameworks.frontend && frameworks.frontend.length > 0) {
        buildConfigs.frontend = await BuildConfigDetector.detectAllConfigs(
          this.projectPath,
          frameworks.frontend[0].name
        );
      }

      if (frameworks.backend && frameworks.backend.length > 0) {
        buildConfigs.backend = await BuildConfigDetector.detectAllConfigs(
          this.projectPath,
          frameworks.backend[0].name
        );
      }

      // Step 4: Generate Docker configurations
      console.log('🐳 Generating Docker configurations...');
      const generatedFiles = await this.generateDockerConfigs(frameworks, buildConfigs);

      // Step 5: Validate generated configurations
      console.log('✔️  Validating configurations...');
      const { isValid, issues } = this.validateConfigurations(generatedFiles);
      
      if (!isValid) {
        warnings.push(...issues);
      }

      // Calculate confidence score
      const confidence = this.calculateConfidenceScore(frameworks, buildConfigs);

      // Add suggestions based on analysis
      if (frameworks.cacheLayer) {
        suggestions.push(`Redis cache layer detected: Consider implementing cache warming strategies`);
      }
      if (frameworks.messageQueues && frameworks.messageQueues.length > 0) {
        suggestions.push(`Message queue(s) detected: Ensure proper health checks and retry logic`);
      }
      if (monorepo.isMonorepo && monorepo.type === 'none') {
        suggestions.push(`Consider using a monorepo tool for better dependency management`);
      }

      const endTime = Date.now();

      return {
        frameworks,
        buildConfig: buildConfigs,
        monorepo,
        generatedFiles,
        metadata: {
          detectionTime: endTime - startTime,
          confidence,
          warnings,
          suggestions
        }
      };
    } catch (error) {
      console.error('Error in enhanced project analysis:', error);
      throw error;
    }
  }

  /**
   * Generate Docker configurations based on detected frameworks
   */
  private async generateDockerConfigs(frameworks: any, buildConfigs: any): Promise<any> {
    try {
      const services = [];

      // Add frontend service
      if (frameworks.frontend && frameworks.frontend.length > 0) {
        const frontend = frameworks.frontend[0];
        services.push({
          name: 'frontend',
          framework: frontend.name,
          port: buildConfigs.frontend?.port || 3000,
          buildCommand: buildConfigs.frontend?.buildCommand || 'npm run build',
          startCommand: buildConfigs.frontend?.startCommand || 'npm start'
        });
      }

      // Add backend service
      if (frameworks.backend && frameworks.backend.length > 0) {
        const backend = frameworks.backend[0];
        services.push({
          name: 'backend',
          framework: backend.name,
          port: buildConfigs.backend?.port || 8000,
          buildCommand: buildConfigs.backend?.buildCommand || 'npm run build',
          startCommand: buildConfigs.backend?.startCommand || 'npm start'
        });
      }

      const config = {
        services,
        databases: frameworks.databases || [],
        messageQueues: frameworks.messageQueues || [],
        cacheLayer: frameworks.cacheLayer,
        reverseProxy: frameworks.reverseProxy,
        searchEngine: frameworks.searchEngine,
        framework: frameworks.backend?.[0]?.name || frameworks.frontend?.[0]?.name || 'Node.js'
      };

      const generated = await DockerGeneratorFinal.generateAll(this.projectPath, config);
      
      return generated;
    } catch (error) {
      console.error('Error generating Docker configs:', error);
      return {
        dockerfile: '# Error generating Dockerfile',
        dockerCompose: '# Error generating docker-compose.yml',
        nginx: '# Error generating nginx.conf'
      };
    }
  }

  /**
   * Validate generated Docker configurations
   */
  private validateConfigurations(files: any): { isValid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Validate Dockerfile
    if (!files.dockerfile || files.dockerfile.includes('# Error')) {
      issues.push('Dockerfile generation failed');
    }
    if (files.dockerfile && !files.dockerfile.includes('FROM')) {
      issues.push('Invalid Dockerfile: missing FROM statement');
    }

    // Validate docker-compose
    if (!files.dockerCompose || files.dockerCompose.includes('# Error')) {
      issues.push('docker-compose.yml generation failed');
    }
    if (files.dockerCompose && !files.dockerCompose.includes('services:')) {
      issues.push('Invalid docker-compose.yml: missing services section');
    }

    // Validate Nginx config
    if (files.nginx && !files.nginx.includes('server {')) {
      issues.push('Invalid nginx.conf: missing server block');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Calculate confidence score for analysis (0-100)
   */
  private calculateConfidenceScore(frameworks: any, buildConfigs: any): number {
    let score = 50; // Base score

    // Add points for detected frameworks
    if (frameworks.frontend?.length > 0) score += 10;
    if (frameworks.backend?.length > 0) score += 10;
    if (frameworks.databases?.length > 0) score += 10;
    if (frameworks.messageQueues?.length > 0) score += 5;
    if (frameworks.cacheLayer) score += 5;

    // Add points for complete build config
    if (buildConfigs.frontend?.buildCommand) score += 5;
    if (buildConfigs.frontend?.port) score += 2;
    if (buildConfigs.backend?.buildCommand) score += 5;
    if (buildConfigs.backend?.port) score += 2;

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Export analysis results as JSON
   */
  async exportAnalysis(analysis: EnhancedProjectAnalysis, outputPath: string): Promise<void> {
    try {
      const outputUri = vscode.Uri.file(outputPath);
      const data = JSON.stringify(analysis, null, 2);
      await vscode.workspace.fs.writeFile(outputUri, Buffer.from(data));
      console.log(`✅ Analysis exported to ${outputPath}`);
    } catch (error) {
      console.error('Error exporting analysis:', error);
    }
  }

  /**
   * Export generated Docker files
   */
  async exportDockerFiles(generatedFiles: any, outputDir: string): Promise<void> {
    try {
      // Write Dockerfile
      const dockerfilePath = path.join(outputDir, 'Dockerfile');
      const dockerfileUri = vscode.Uri.file(dockerfilePath);
      await vscode.workspace.fs.writeFile(
        dockerfileUri,
        Buffer.from(generatedFiles.dockerfile)
      );

      // Write docker-compose.yml
      const composePath = path.join(outputDir, 'docker-compose.yml');
      const composeUri = vscode.Uri.file(composePath);
      await vscode.workspace.fs.writeFile(
        composeUri,
        Buffer.from(generatedFiles.dockerCompose)
      );

      // Write nginx.conf
      const nginxPath = path.join(outputDir, 'nginx.conf');
      const nginxUri = vscode.Uri.file(nginxPath);
      await vscode.workspace.fs.writeFile(
        nginxUri,
        Buffer.from(generatedFiles.nginx)
      );

      console.log(`✅ Docker files exported to ${outputDir}`);
    } catch (error) {
      console.error('Error exporting Docker files:', error);
      throw error;
    }
  }

  /**
   * Generate analysis summary for display
   */
  generateSummary(analysis: EnhancedProjectAnalysis): string {
    let summary = `
╔════════════════════════════════════════════════════════════╗
║          AUTO DOCKER - PROJECT ANALYSIS SUMMARY            ║
╚════════════════════════════════════════════════════════════╝

📊 DETECTED FRAMEWORKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Frontend:
${analysis.frameworks.frontend?.length ? analysis.frameworks.frontend.map((f: any) => `  • ${f.name} (${f.version})`).join('\n') : '  (None detected)'}

Backend:
${analysis.frameworks.backend?.length ? analysis.frameworks.backend.map((b: any) => `  • ${b.name} (${b.version})`).join('\n') : '  (None detected)'}

Databases:
${analysis.frameworks.databases?.length ? analysis.frameworks.databases.map((d: any) => `  • ${d.type} (${d.version})`).join('\n') : '  (None detected)'}

Message Queues:
${analysis.frameworks.messageQueues?.length ? analysis.frameworks.messageQueues.map((q: any) => `  • ${q.type}`).join('\n') : '  (None detected)'}

Cache Layer:
${analysis.frameworks.cacheLayer ? `  • ${analysis.frameworks.cacheLayer}` : '  (None detected)'}

📁 MONOREPO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type: ${analysis.monorepo.type !== 'none' ? analysis.monorepo.type : 'Single repository'}
Workspaces: ${analysis.monorepo.workspaces?.length || 0}

⚙️  BUILD CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Frontend Build: ${analysis.buildConfig.frontend?.buildCommand || 'N/A'}
Frontend Port: ${analysis.buildConfig.frontend?.port || 'N/A'}

Backend Build: ${analysis.buildConfig.backend?.buildCommand || 'N/A'}
Backend Port: ${analysis.buildConfig.backend?.port || 'N/A'}

📈 ANALYSIS QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Confidence Score: ${analysis.metadata.confidence}%
Detection Time: ${analysis.metadata.detectionTime}ms

${analysis.metadata.warnings.length > 0 ? `
⚠️  WARNINGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${analysis.metadata.warnings.map(w => `  • ${w}`).join('\n')}
` : ''}

${analysis.metadata.suggestions.length > 0 ? `
💡 SUGGESTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${analysis.metadata.suggestions.map(s => `  • ${s}`).join('\n')}
` : ''}

✅ Docker files have been generated successfully!
    `;
    return summary;
  }
}

export default EnhancedProjectAnalyzer;
