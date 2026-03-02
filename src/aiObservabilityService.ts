/**
 * AI Observability & Monitoring Service (Phase 6)
 * 
 * Comprehensive monitoring and observability for all AI operations.
 * Tracks LLM calls, token usage, costs, latency, errors, and quality metrics.
 * 
 * Features:
 * - Real-time telemetry collection
 * - Token usage and cost tracking
 * - Performance metrics (latency, throughput)
 * - Error tracking and analysis
 * - Validation quality metrics
 * - Success/failure rate monitoring
 * - Historical data storage
 * - Analytics dashboard
 * - Cost optimization insights
 * - Provider comparison
 * - Trend analysis
 * 
 * @author Auto Docker Extension
 * @date January 8, 2026
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface LLMCallMetrics {
    id: string;
    timestamp: Date;
    provider: 'openai' | 'gemini' | 'anthropic';
    model: string;
    operation: 'generate' | 'validate' | 'analyze' | 'fix';
    status: 'success' | 'failure' | 'partial';
    
    // Token metrics
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    
    // Cost metrics
    estimatedCost: number;
    
    // Performance metrics
    latencyMs: number;
    
    // Quality metrics
    validationPassed?: boolean;
    guardrailsScore?: number;
    staticAnalysisScore?: number;
    composeSpecScore?: number;
    
    // Error tracking
    error?: string;
    errorType?: string;
    
    // Context
    projectType?: string;
    framework?: string;
    
    // Additional metadata
    metadata?: Record<string, any>;
}

interface ValidationMetrics {
    timestamp: Date;
    phase: 'guardrails' | 'schema' | 'static-analysis' | 'compose-spec';
    passed: boolean;
    score: number;
    errors: number;
    warnings: number;
    infos: number;
    autoFixesApplied: number;
    duration: number;
}

interface CostBreakdown {
    provider: string;
    model: string;
    totalCalls: number;
    totalTokens: number;
    totalCost: number;
    averageCost: number;
}

interface PerformanceMetrics {
    averageLatency: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    minLatency: number;
    maxLatency: number;
    totalCalls: number;
    successRate: number;
}

interface QualityMetrics {
    averageGuardrailsScore: number;
    averageStaticAnalysisScore: number;
    averageComposeSpecScore: number;
    validationPassRate: number;
    autoFixSuccessRate: number;
}

interface TrendData {
    date: string;
    calls: number;
    tokens: number;
    cost: number;
    averageLatency: number;
    successRate: number;
}

interface ObservabilityReport {
    reportDate: Date;
    period: string;
    summary: {
        totalCalls: number;
        totalTokens: number;
        totalCost: number;
        successRate: number;
        averageLatency: number;
    };
    costBreakdown: CostBreakdown[];
    performance: PerformanceMetrics;
    quality: QualityMetrics;
    trends: TrendData[];
    topErrors: Array<{ error: string; count: number }>;
    recommendations: string[];
}

interface SessionMetrics {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    operations: LLMCallMetrics[];
    validations: ValidationMetrics[];
    totalCost: number;
    totalDuration: number;
    success: boolean;
}

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

const PRICING = {
    openai: {
        'gpt-4-turbo-preview': { input: 0.01, output: 0.03 }, // per 1K tokens
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
    },
    gemini: {
        'gemini-pro': { input: 0.00025, output: 0.0005 },
        'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
        'gemini-1.5-pro': { input: 0.00125, output: 0.00375 }
    },
    anthropic: {
        'claude-3-opus': { input: 0.015, output: 0.075 },
        'claude-3-sonnet': { input: 0.003, output: 0.015 },
        'claude-3-haiku': { input: 0.00025, output: 0.00125 }
    }
};

// ============================================================================
// AI OBSERVABILITY SERVICE
// ============================================================================

export class AIObservabilityService {
    private outputChannel: vscode.OutputChannel;
    private metricsChannel: vscode.OutputChannel;
    private enabled: boolean;
    private storageUri?: vscode.Uri;
    private currentSession?: SessionMetrics;
    
    // In-memory metrics storage
    private metrics: LLMCallMetrics[] = [];
    private validations: ValidationMetrics[] = [];
    private sessions: SessionMetrics[] = [];
    
    // Configuration
    private maxMetricsInMemory = 1000;
    private persistMetrics = true;
    private realTimeUpdates = true;

    constructor(context?: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Auto Docker - AI Observability');
        this.metricsChannel = vscode.window.createOutputChannel('Auto Docker - Metrics Dashboard');
        
        const config = vscode.workspace.getConfiguration('autoDocker');
        this.enabled = config.get('enableObservability', true);
        
        if (context) {
            this.storageUri = context.globalStorageUri;
        }
        
        if (this.enabled) {
            this.log('🔍 AI Observability Service initialized');
            this.loadHistoricalMetrics();
        }
    }

    /**
     * Check if observability is enabled
     */
    public static isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('autoDocker');
        return config.get('enableObservability', true);
    }

    /**
     * Start a new session
     */
    public startSession(metadata?: Record<string, any>): string {
        const sessionId = this.generateId();
        
        this.currentSession = {
            sessionId,
            startTime: new Date(),
            operations: [],
            validations: [],
            totalCost: 0,
            totalDuration: 0,
            success: false
        };
        
        this.log(`📊 Started session: ${sessionId}`);
        
        if (metadata) {
            this.log(`   Metadata: ${JSON.stringify(metadata)}`);
        }
        
        return sessionId;
    }

    /**
     * End current session
     */
    public endSession(success: boolean): void {
        if (!this.currentSession) {
            return;
        }
        
        this.currentSession.endTime = new Date();
        this.currentSession.success = success;
        
        // Calculate totals
        this.currentSession.totalCost = this.currentSession.operations.reduce(
            (sum, op) => sum + op.estimatedCost, 0
        );
        
        if (this.currentSession.endTime && this.currentSession.startTime) {
            this.currentSession.totalDuration = 
                this.currentSession.endTime.getTime() - this.currentSession.startTime.getTime();
        }
        
        this.sessions.push(this.currentSession);
        
        this.log(`✅ Session ended: ${this.currentSession.sessionId}`);
        this.log(`   Success: ${success}`);
        this.log(`   Total cost: $${this.currentSession.totalCost.toFixed(4)}`);
        this.log(`   Duration: ${this.currentSession.totalDuration}ms`);
        
        if (this.persistMetrics) {
            this.saveSession(this.currentSession);
        }
        
        this.currentSession = undefined;
    }

    /**
     * Track an LLM API call
     */
    public async trackLLMCall(
        provider: 'openai' | 'gemini' | 'anthropic',
        model: string,
        operation: 'generate' | 'validate' | 'analyze' | 'fix',
        startTime: Date,
        endTime: Date,
        promptTokens: number,
        completionTokens: number,
        status: 'success' | 'failure' | 'partial',
        metadata?: Record<string, any>
    ): Promise<LLMCallMetrics> {
        
        if (!this.enabled) {
            return {} as LLMCallMetrics;
        }
        
        const totalTokens = promptTokens + completionTokens;
        const latencyMs = endTime.getTime() - startTime.getTime();
        const estimatedCost = this.calculateCost(provider, model, promptTokens, completionTokens);
        
        const metrics: LLMCallMetrics = {
            id: this.generateId(),
            timestamp: startTime,
            provider,
            model,
            operation,
            status,
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost,
            latencyMs,
            metadata
        };
        
        this.metrics.push(metrics);
        
        // Add to current session
        if (this.currentSession) {
            this.currentSession.operations.push(metrics);
        }
        
        // Trim if exceeds limit
        if (this.metrics.length > this.maxMetricsInMemory) {
            const toRemove = this.metrics.length - this.maxMetricsInMemory;
            this.metrics.splice(0, toRemove);
        }
        
        // Real-time logging
        if (this.realTimeUpdates) {
            this.logLLMCall(metrics);
        }
        
        // Persist
        if (this.persistMetrics) {
            await this.saveMetric(metrics);
        }
        
        return metrics;
    }

    /**
     * Track validation results
     */
    public async trackValidation(
        phase: 'guardrails' | 'schema' | 'static-analysis' | 'compose-spec',
        passed: boolean,
        score: number,
        errors: number,
        warnings: number,
        infos: number,
        autoFixesApplied: number,
        duration: number
    ): Promise<void> {
        
        if (!this.enabled) {
            return;
        }
        
        const validation: ValidationMetrics = {
            timestamp: new Date(),
            phase,
            passed,
            score,
            errors,
            warnings,
            infos,
            autoFixesApplied,
            duration
        };
        
        this.validations.push(validation);
        
        // Add to current session
        if (this.currentSession) {
            this.currentSession.validations.push(validation);
        }
        
        // Real-time logging
        if (this.realTimeUpdates) {
            this.logValidation(validation);
        }
        
        // Update last LLM call with validation results
        if (this.metrics.length > 0) {
            const lastMetric = this.metrics[this.metrics.length - 1];
            
            switch (phase) {
                case 'guardrails':
                    lastMetric.guardrailsScore = score;
                    break;
                case 'static-analysis':
                    lastMetric.staticAnalysisScore = score;
                    break;
                case 'compose-spec':
                    lastMetric.composeSpecScore = score;
                    break;
            }
            
            lastMetric.validationPassed = passed;
        }
    }

    /**
     * Track an error
     */
    public trackError(
        error: Error | string,
        context: {
            provider?: string;
            model?: string;
            operation?: string;
            metadata?: Record<string, any>;
        }
    ): void {
        
        if (!this.enabled) {
            return;
        }
        
        const errorMessage = typeof error === 'string' ? error : error.message;
        const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
        
        // Update last metric with error
        if (this.metrics.length > 0) {
            const lastMetric = this.metrics[this.metrics.length - 1];
            lastMetric.error = errorMessage;
            lastMetric.errorType = errorType;
            lastMetric.status = 'failure';
        }
        
        this.log(`❌ Error tracked: ${errorMessage}`);
        this.log(`   Type: ${errorType}`);
        if (context.provider) {
            this.log(`   Provider: ${context.provider}`);
        }
    }

    /**
     * Calculate estimated cost
     */
    private calculateCost(
        provider: 'openai' | 'gemini' | 'anthropic',
        model: string,
        promptTokens: number,
        completionTokens: number
    ): number {
        
        const actualProvider = provider;
        
        const providerPricing = PRICING[actualProvider] as Record<string, { input: number; output: number }>;
        const pricing = providerPricing?.[model];
        
        if (!pricing) {
            // Default estimate if pricing not found
            return ((promptTokens + completionTokens) / 1000) * 0.002;
        }
        
        const inputCost = (promptTokens / 1000) * pricing.input;
        const outputCost = (completionTokens / 1000) * pricing.output;
        
        return inputCost + outputCost;
    }

    /**
     * Generate analytics report
     */
    public generateReport(period: 'session' | 'day' | 'week' | 'month' | 'all' = 'all'): ObservabilityReport {
        const now = new Date();
        let filteredMetrics = this.metrics;
        
        // Filter by period
        if (period !== 'all') {
            const cutoff = this.getCutoffDate(period);
            filteredMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
        }
        
        if (filteredMetrics.length === 0) {
            return this.getEmptyReport(now, period);
        }
        
        // Calculate summary
        const totalCalls = filteredMetrics.length;
        const totalTokens = filteredMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
        const totalCost = filteredMetrics.reduce((sum, m) => sum + m.estimatedCost, 0);
        const successCount = filteredMetrics.filter(m => m.status === 'success').length;
        const successRate = (successCount / totalCalls) * 100;
        const averageLatency = filteredMetrics.reduce((sum, m) => sum + m.latencyMs, 0) / totalCalls;
        
        // Cost breakdown by provider/model
        const costBreakdown = this.calculateCostBreakdown(filteredMetrics);
        
        // Performance metrics
        const performance = this.calculatePerformanceMetrics(filteredMetrics);
        
        // Quality metrics
        const quality = this.calculateQualityMetrics(filteredMetrics);
        
        // Trends
        const trends = this.calculateTrends(filteredMetrics, period);
        
        // Top errors
        const topErrors = this.getTopErrors(filteredMetrics);
        
        // Recommendations
        const recommendations = this.generateRecommendations(
            filteredMetrics,
            costBreakdown,
            performance,
            quality
        );
        
        return {
            reportDate: now,
            period,
            summary: {
                totalCalls,
                totalTokens,
                totalCost,
                successRate,
                averageLatency
            },
            costBreakdown,
            performance,
            quality,
            trends,
            topErrors,
            recommendations
        };
    }

    /**
     * Calculate cost breakdown
     */
    private calculateCostBreakdown(metrics: LLMCallMetrics[]): CostBreakdown[] {
        const breakdown = new Map<string, CostBreakdown>();
        
        for (const metric of metrics) {
            const key = `${metric.provider}:${metric.model}`;
            
            if (!breakdown.has(key)) {
                breakdown.set(key, {
                    provider: metric.provider,
                    model: metric.model,
                    totalCalls: 0,
                    totalTokens: 0,
                    totalCost: 0,
                    averageCost: 0
                });
            }
            
            const entry = breakdown.get(key)!;
            entry.totalCalls++;
            entry.totalTokens += metric.totalTokens;
            entry.totalCost += metric.estimatedCost;
        }
        
        // Calculate averages
        breakdown.forEach(entry => {
            entry.averageCost = entry.totalCost / entry.totalCalls;
        });
        
        return Array.from(breakdown.values()).sort((a, b) => b.totalCost - a.totalCost);
    }

    /**
     * Calculate performance metrics
     */
    private calculatePerformanceMetrics(metrics: LLMCallMetrics[]): PerformanceMetrics {
        const latencies = metrics.map(m => m.latencyMs).sort((a, b) => a - b);
        const successCount = metrics.filter(m => m.status === 'success').length;
        
        return {
            averageLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
            p50Latency: this.percentile(latencies, 50),
            p95Latency: this.percentile(latencies, 95),
            p99Latency: this.percentile(latencies, 99),
            minLatency: latencies[0],
            maxLatency: latencies[latencies.length - 1],
            totalCalls: metrics.length,
            successRate: (successCount / metrics.length) * 100
        };
    }

    /**
     * Calculate quality metrics
     */
    private calculateQualityMetrics(metrics: LLMCallMetrics[]): QualityMetrics {
        const guardrailsScores = metrics
            .filter(m => m.guardrailsScore !== undefined)
            .map(m => m.guardrailsScore!);
        
        const staticAnalysisScores = metrics
            .filter(m => m.staticAnalysisScore !== undefined)
            .map(m => m.staticAnalysisScore!);
        
        const composeSpecScores = metrics
            .filter(m => m.composeSpecScore !== undefined)
            .map(m => m.composeSpecScore!);
        
        const validationChecks = metrics.filter(m => m.validationPassed !== undefined);
        const validationPassed = validationChecks.filter(m => m.validationPassed).length;
        
        return {
            averageGuardrailsScore: this.average(guardrailsScores),
            averageStaticAnalysisScore: this.average(staticAnalysisScores),
            averageComposeSpecScore: this.average(composeSpecScores),
            validationPassRate: validationChecks.length > 0 
                ? (validationPassed / validationChecks.length) * 100 
                : 0,
            autoFixSuccessRate: 0 // TODO: Track auto-fix success
        };
    }

    /**
     * Calculate trends over time
     */
    private calculateTrends(metrics: LLMCallMetrics[], period: string): TrendData[] {
        const trends = new Map<string, TrendData>();
        
        for (const metric of metrics) {
            const dateKey = this.getDateKey(metric.timestamp, period);
            
            if (!trends.has(dateKey)) {
                trends.set(dateKey, {
                    date: dateKey,
                    calls: 0,
                    tokens: 0,
                    cost: 0,
                    averageLatency: 0,
                    successRate: 0
                });
            }
            
            const trend = trends.get(dateKey)!;
            trend.calls++;
            trend.tokens += metric.totalTokens;
            trend.cost += metric.estimatedCost;
        }
        
        // Calculate averages
        for (const trend of trends.values()) {
            const dayMetrics = metrics.filter(m => 
                this.getDateKey(m.timestamp, period) === trend.date
            );
            
            trend.averageLatency = dayMetrics.reduce((sum, m) => sum + m.latencyMs, 0) / dayMetrics.length;
            const successCount = dayMetrics.filter(m => m.status === 'success').length;
            trend.successRate = (successCount / dayMetrics.length) * 100;
        }
        
        return Array.from(trends.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    /**
     * Get top errors
     */
    private getTopErrors(metrics: LLMCallMetrics[]): Array<{ error: string; count: number }> {
        const errorCounts = new Map<string, number>();
        
        for (const metric of metrics) {
            if (metric.error) {
                const count = errorCounts.get(metric.error) || 0;
                errorCounts.set(metric.error, count + 1);
            }
        }
        
        return Array.from(errorCounts.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    /**
     * Generate recommendations based on metrics
     */
    private generateRecommendations(
        metrics: LLMCallMetrics[],
        costBreakdown: CostBreakdown[],
        performance: PerformanceMetrics,
        quality: QualityMetrics
    ): string[] {
        
        const recommendations: string[] = [];
        
        // Cost optimization
        if (costBreakdown.length > 0) {
            const mostExpensive = costBreakdown[0];
            if (mostExpensive.averageCost > 0.05) {
                recommendations.push(
                    `💰 Consider using a more cost-effective model. ${mostExpensive.provider}/${mostExpensive.model} ` +
                    `costs $${mostExpensive.averageCost.toFixed(4)} per call on average.`
                );
            }
        }
        
        // Performance optimization
        if (performance.averageLatency > 10000) {
            recommendations.push(
                `⚡ Average latency is ${(performance.averageLatency / 1000).toFixed(1)}s. ` +
                `Consider using a faster model or caching frequently requested prompts.`
            );
        }
        
        // Success rate
        if (performance.successRate < 90) {
            recommendations.push(
                `⚠️ Success rate is ${performance.successRate.toFixed(1)}%. ` +
                `Review error logs and consider improving error handling.`
            );
        }
        
        // Quality
        if (quality.averageGuardrailsScore < 80) {
            recommendations.push(
                `🛡️ Guardrails score is ${quality.averageGuardrailsScore.toFixed(0)}/100. ` +
                `Consider improving prompt engineering or model selection.`
            );
        }
        
        if (quality.validationPassRate < 80) {
            recommendations.push(
                `✅ Validation pass rate is ${quality.validationPassRate.toFixed(1)}%. ` +
                `Generated files often require fixes. Consider refining prompts.`
            );
        }
        
        // Token usage
        const avgTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0) / metrics.length;
        if (avgTokens > 5000) {
            recommendations.push(
                `📝 Average token usage is ${avgTokens.toFixed(0)}. ` +
                `Consider optimizing prompts to reduce costs.`
            );
        }
        
        // Provider diversity
        const providers = new Set(metrics.map(m => m.provider));
        if (providers.size === 1 && metrics.length > 10) {
            recommendations.push(
                `🔄 You're only using one AI provider. ` +
                `Consider testing multiple providers for better cost/performance balance.`
            );
        }
        
        return recommendations;
    }

    /**
     * Display dashboard in output channel
     */
    public showDashboard(period: 'session' | 'day' | 'week' | 'month' | 'all' = 'all'): void {
        const report = this.generateReport(period);
        
        this.metricsChannel.clear();
        this.metricsChannel.appendLine(this.formatReport(report));
        this.metricsChannel.show(true);
    }

    /**
     * Format report for display
     */
    private formatReport(report: ObservabilityReport): string {
        let output = '\n';
        output += '╔════════════════════════════════════════════════════════════╗\n';
        output += '║         AI Observability & Monitoring Dashboard           ║\n';
        output += '╚════════════════════════════════════════════════════════════╝\n\n';
        
        output += `📅 Report Date: ${report.reportDate.toLocaleString()}\n`;
        output += `⏱️  Period: ${report.period}\n\n`;
        
        // Summary
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        output += '📊 SUMMARY\n';
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        output += `Total API Calls:     ${report.summary.totalCalls}\n`;
        output += `Total Tokens:        ${report.summary.totalTokens.toLocaleString()}\n`;
        output += `Total Cost:          $${report.summary.totalCost.toFixed(4)}\n`;
        output += `Success Rate:        ${report.summary.successRate.toFixed(1)}%\n`;
        output += `Average Latency:     ${report.summary.averageLatency.toFixed(0)}ms\n\n`;
        
        // Cost Breakdown
        if (report.costBreakdown.length > 0) {
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '💰 COST BREAKDOWN\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            
            for (const breakdown of report.costBreakdown) {
                output += `${breakdown.provider}/${breakdown.model}:\n`;
                output += `  Calls:        ${breakdown.totalCalls}\n`;
                output += `  Tokens:       ${breakdown.totalTokens.toLocaleString()}\n`;
                output += `  Total Cost:   $${breakdown.totalCost.toFixed(4)}\n`;
                output += `  Avg Cost:     $${breakdown.averageCost.toFixed(4)}\n\n`;
            }
        }
        
        // Performance
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        output += '⚡ PERFORMANCE METRICS\n';
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        output += `Average Latency:     ${report.performance.averageLatency.toFixed(0)}ms\n`;
        output += `P50 Latency:         ${report.performance.p50Latency.toFixed(0)}ms\n`;
        output += `P95 Latency:         ${report.performance.p95Latency.toFixed(0)}ms\n`;
        output += `P99 Latency:         ${report.performance.p99Latency.toFixed(0)}ms\n`;
        output += `Min Latency:         ${report.performance.minLatency.toFixed(0)}ms\n`;
        output += `Max Latency:         ${report.performance.maxLatency.toFixed(0)}ms\n`;
        output += `Success Rate:        ${report.performance.successRate.toFixed(1)}%\n\n`;
        
        // Quality
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        output += '⭐ QUALITY METRICS\n';
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
        output += `Guardrails Score:    ${report.quality.averageGuardrailsScore.toFixed(0)}/100\n`;
        output += `Static Analysis:     ${report.quality.averageStaticAnalysisScore.toFixed(0)}/100\n`;
        output += `Compose Spec:        ${report.quality.averageComposeSpecScore.toFixed(0)}/100\n`;
        output += `Validation Pass:     ${report.quality.validationPassRate.toFixed(1)}%\n\n`;
        
        // Trends
        if (report.trends.length > 0) {
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '📈 TRENDS\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            
            for (const trend of report.trends.slice(-7)) { // Last 7 data points
                output += `${trend.date}:\n`;
                output += `  Calls:        ${trend.calls}\n`;
                output += `  Tokens:       ${trend.tokens.toLocaleString()}\n`;
                output += `  Cost:         $${trend.cost.toFixed(4)}\n`;
                output += `  Avg Latency:  ${trend.averageLatency.toFixed(0)}ms\n`;
                output += `  Success:      ${trend.successRate.toFixed(1)}%\n\n`;
            }
        }
        
        // Top Errors
        if (report.topErrors.length > 0) {
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '❌ TOP ERRORS\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            
            for (const error of report.topErrors) {
                output += `[${error.count}x] ${error.error}\n`;
            }
            output += '\n';
        }
        
        // Recommendations
        if (report.recommendations.length > 0) {
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '💡 RECOMMENDATIONS\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
            
            for (const recommendation of report.recommendations) {
                output += `${recommendation}\n\n`;
            }
        }
        
        return output;
    }

    /**
     * Export metrics to JSON
     */
    public async exportMetrics(filepath: string): Promise<void> {
        const report = this.generateReport('all');
        
        const exportData = {
            report,
            rawMetrics: this.metrics,
            validations: this.validations,
            sessions: this.sessions,
            exportDate: new Date()
        };
        
        try {
            await fs.promises.writeFile(
                filepath,
                JSON.stringify(exportData, null, 2),
                'utf8'
            );
            
            this.log(`📦 Metrics exported to: ${filepath}`);
            vscode.window.showInformationMessage(`Metrics exported to ${filepath}`);
        } catch (error) {
            this.log(`❌ Export failed: ${error}`);
            vscode.window.showErrorMessage(`Failed to export metrics: ${error}`);
        }
    }

    /**
     * Clear all metrics
     */
    public clearMetrics(): void {
        this.metrics = [];
        this.validations = [];
        this.sessions = [];
        this.currentSession = undefined;
        
        this.log('🗑️ All metrics cleared');
    }

    /**
     * Helper: Load historical metrics from storage
     */
    private async loadHistoricalMetrics(): Promise<void> {
        if (!this.storageUri) {
            return;
        }
        
        try {
            const metricsFile = vscode.Uri.joinPath(this.storageUri, 'metrics.json');
            const data = await vscode.workspace.fs.readFile(metricsFile);
            const parsed = JSON.parse(data.toString());
            
            this.metrics = parsed.metrics || [];
            this.validations = parsed.validations || [];
            this.sessions = parsed.sessions || [];
            
            this.log(`📂 Loaded ${this.metrics.length} historical metrics`);
        } catch (error) {
            // File doesn't exist or is corrupted - start fresh
            this.log('📂 No historical metrics found - starting fresh');
        }
    }

    /**
     * Helper: Save metric to storage
     */
    private async saveMetric(metric: LLMCallMetrics): Promise<void> {
        if (!this.storageUri) {
            return;
        }
        
        try {
            // Ensure directory exists
            await vscode.workspace.fs.createDirectory(this.storageUri);
            
            const metricsFile = vscode.Uri.joinPath(this.storageUri, 'metrics.json');
            
            const data = {
                metrics: this.metrics,
                validations: this.validations,
                sessions: this.sessions,
                lastUpdated: new Date()
            };
            
            await vscode.workspace.fs.writeFile(
                metricsFile,
                Buffer.from(JSON.stringify(data, null, 2))
            );
        } catch (error) {
            // Silently fail - don't interrupt the main flow
            console.warn('Failed to save metrics:', error);
        }
    }

    /**
     * Helper: Save session
     */
    private async saveSession(session: SessionMetrics): Promise<void> {
        if (!this.storageUri) {
            return;
        }
        
        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            
            const sessionFile = vscode.Uri.joinPath(
                this.storageUri,
                `session-${session.sessionId}.json`
            );
            
            await vscode.workspace.fs.writeFile(
                sessionFile,
                Buffer.from(JSON.stringify(session, null, 2))
            );
        } catch (error) {
            console.warn('Failed to save session:', error);
        }
    }

    /**
     * Helper: Log LLM call
     */
    private logLLMCall(metrics: LLMCallMetrics): void {
        const status = metrics.status === 'success' ? '✅' : '❌';
        
        this.log(`${status} LLM Call: ${metrics.provider}/${metrics.model}`);
        this.log(`   Operation: ${metrics.operation}`);
        this.log(`   Tokens: ${metrics.totalTokens} (prompt: ${metrics.promptTokens}, completion: ${metrics.completionTokens})`);
        this.log(`   Cost: $${metrics.estimatedCost.toFixed(4)}`);
        this.log(`   Latency: ${metrics.latencyMs}ms`);
        
        if (metrics.error) {
            this.log(`   Error: ${metrics.error}`);
        }
    }

    /**
     * Helper: Log validation
     */
    private logValidation(validation: ValidationMetrics): void {
        const status = validation.passed ? '✅' : '❌';
        
        this.log(`${status} Validation: ${validation.phase}`);
        this.log(`   Score: ${validation.score}/100`);
        this.log(`   Errors: ${validation.errors}, Warnings: ${validation.warnings}, Info: ${validation.infos}`);
        this.log(`   Auto-fixes: ${validation.autoFixesApplied}`);
        this.log(`   Duration: ${validation.duration}ms`);
    }

    /**
     * Helper utilities
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private getCutoffDate(period: string): Date {
        const now = new Date();
        
        switch (period) {
            case 'session':
                return this.currentSession?.startTime || now;
            case 'day':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
            case 'week':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(0);
        }
    }

    private getDateKey(date: Date, period: string): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        if (period === 'day' || period === 'session') {
            return `${year}-${month}-${day}`;
        } else if (period === 'week') {
            const weekNum = Math.ceil(date.getDate() / 7);
            return `${year}-W${weekNum}`;
        } else if (period === 'month') {
            return `${year}-${month}`;
        }
        
        return `${year}-${month}-${day}`;
    }

    private percentile(sorted: number[], p: number): number {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        return sorted[Math.max(0, index)];
    }

    private average(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    }

    private getEmptyReport(date: Date, period: string): ObservabilityReport {
        return {
            reportDate: date,
            period,
            summary: {
                totalCalls: 0,
                totalTokens: 0,
                totalCost: 0,
                successRate: 0,
                averageLatency: 0
            },
            costBreakdown: [],
            performance: {
                averageLatency: 0,
                p50Latency: 0,
                p95Latency: 0,
                p99Latency: 0,
                minLatency: 0,
                maxLatency: 0,
                totalCalls: 0,
                successRate: 0
            },
            quality: {
                averageGuardrailsScore: 0,
                averageStaticAnalysisScore: 0,
                averageComposeSpecScore: 0,
                validationPassRate: 0,
                autoFixSuccessRate: 0
            },
            trends: [],
            topErrors: [],
            recommendations: ['No data available for the selected period.']
        };
    }

    private log(message: string): void {
        if (this.enabled) {
            this.outputChannel.appendLine(message);
        }
    }
}
