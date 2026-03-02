export type FrontendFramework =
  | "react"
  | "vue"
  | "angular"
  | "svelte"
  | "nextjs"
  | "nuxt"
  | "gatsby"
  | "vite"
  | "webpack"
  | "unknown";

export type BackendFramework =
  | "node-express"
  | "node-koa"
  | "node-fastify"
  | "node-nestjs"
  | "python-flask"
  | "python-django"
  | "python-fastapi"
  | "python-bottle"
  | "java-spring-boot"
  | "java-quarkus"
  | "go-gin"
  | "go-fiber"
  | "go-echo"
  | "php-laravel"
  | "php-symfony"
  | "php-slim"
  | ".net-core"
  | ".net-framework"
  | "rust-actix"
  | "rust-warp"
  | "rust-rocket"
  | "ruby-rails"
  | "ruby-sinatra"
  | "elixir-phoenix"
  | "unknown";

export interface StackDetection {
  frontend: {
    framework: FrontendFramework;
    port: number | null;
    evidence: string[];
    buildTool?: string;
    packageManager?: string;
  };
  backend: {
    framework: BackendFramework;
    port: number | null;
    evidence: string[];
    version?: string;
    packageManager?: string;
  };
  database: {
    type: "mysql" | "postgres" | "mongodb" | "mssql" | "redis" | "sqlite" | "mariadb" | "unknown" | null;
    evidence: string[];
    version?: string;
  };
  projectRoot: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  hasNginxConfig: boolean;
}

export interface AiPrompt {
  summary: string;
  requiredFiles: string[];
  specifics: string[];
  includedFileSnippets: Array<{ path: string; content: string }>;
  projectType: 'fullstack' | 'frontend-only' | 'backend-only' | 'api-only';
  deploymentTarget?: 'production' | 'development' | 'staging';
}

export interface GeneratedFiles {
  files: Array<{ path: string; content: string }>;
  warnings?: string[];
  recommendations?: string[];
}

export interface GenerationOptions {
  includeDevConfigs: boolean;
  includeMonitoring: boolean;
  includeSecurity: boolean;
  includeCI: boolean;
  customPorts?: {
    frontend?: number;
    backend?: number;
    database?: number;
  };
}

export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'azure-openai' | 'ollama' | 'groq' | 'huggingface' | 'cohere';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Docker Files Interface
export interface DockerFiles {
  dockerfile: string;
  dockerCompose: string;
  dockerIgnore: string;
  nginxConf?: string;
}

// Project Structure Interface (Legacy - used for compatibility)
export interface ProjectStructure {
  projectType: string;
  frontend?: string;
  backend?: string;
  database?: string;
  databases?: string[]; // Multiple databases
  files: string[];
  dependencies: { [key: string]: any };
  hasMultiStage: boolean;
  description: string;
  hasEnvFile?: boolean;
  envVars?: string[];
  isMonorepo?: boolean;
  isSingleFolderFullstack?: boolean; // Single folder with both frontend and backend
  frontendPath?: string;
  backendPath?: string;
  frontendDependencies?: any;
  backendDependencies?: any;
  // Enhanced Monorepo support
  workspaces?: string[]; // npm/yarn/pnpm workspaces (raw patterns)
  expandedWorkspaces?: string[]; // Expanded workspace paths
  allFrontendServices?: Array<{ path: string; dependencies: any }>; // All frontend services
  allBackendServices?: Array<{ path: string; dependencies: any; language: string }>; // All backend services
  buildTool?: 'turbo' | 'nx' | 'lerna' | 'npm' | 'yarn' | 'pnpm'; // Build tool detection
  monorepoType?: 'yarn' | 'pnpm' | 'lerna' | 'nx' | 'rush' | 'turbo' | 'none'; // Detected monorepo type
  services?: Array<{ path: string; language: string; framework: string }>; // Multi-language services
  detectionLog?: string[]; // Detection log for debugging
  hasPrisma?: boolean; // Prisma ORM detection
  hasCelery?: boolean; // Celery worker detection
  hasWebSocket?: boolean; // WebSocket support detection
  // Advanced services
  messageQueue?: 'rabbitmq' | 'kafka' | 'redis-streams' | 'activemq';
  cacheLayer?: 'redis' | 'memcached';
  searchEngine?: 'elasticsearch' | 'opensearch';
  reverseProxy?: 'nginx' | 'traefik' | 'caddy';
  monitoring?: 'prometheus' | 'grafana';
  // Frontend/Backend classification flags (for Nginx and Docker generation)
  isFrontendOnly?: boolean;  // true if has frontend && !backend
  isBackendOnly?: boolean;   // true if has backend && !frontend
  isFullstack?: boolean;     // true if has both frontend && backend
  projectRoot?: string; // Added for compatibility
}


