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


