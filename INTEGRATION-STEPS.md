# Integration Steps - How to Use Advanced Analysis

## Quick Integration

To start using the advanced codebase analysis features, you need to update `extension.ts`.

### Step 1: Add Import

Add this import at the top of `src/extension.ts` (around line 4):

```typescript
import { EnhancedProjectAnalyzer } from './enhancedProjectAnalyzer';
```

### Step 2: Update analyzeProject Function

Replace lines 90-91 in the `analyzeProject` function:

**OLD CODE (lines 90-91):**
```typescript
const analyzer = new ProjectAnalyzer(getWorkspaceRoot());
const projectStructure = await analyzer.analyzeProject();
```

**NEW CODE:**
```typescript
// Use enhanced analyzer for better code understanding
const enhancedAnalyzer = new EnhancedProjectAnalyzer(getWorkspaceRoot(), outputChannel);
const config = vscode.workspace.getConfiguration('autoDocker');
const model = config.get<string>('model', 'gpt-4');

// Run advanced analysis
const analysis = await enhancedAnalyzer.analyzeWithAdvancedFeatures(model);
const projectStructure = analysis.projectStructure;

// Log insights
outputChannel.appendLine(`\n📊 Advanced Analysis Results:`);
outputChannel.appendLine(`   - Complexity: ${analysis.codebaseInsights.estimatedComplexity}`);
outputChannel.appendLine(`   - Frameworks: ${analysis.codebaseInsights.detectedFrameworks.join(', ')}`);
outputChannel.appendLine(`   - Strategy: ${analysis.codebaseInsights.recommendedDockerStrategy}\n`);
```

### Step 3: Test

After making these changes:

1. **Compile**: `npm run compile`
2. **Press F5** to launch Extension Development Host
3. **Open a project** in the new window
4. **Run**: `Ctrl+Shift+P` → "Auto Docker: Analyze Project"
5. **Check output** for the advanced analysis insights

---

## Summary

**Do you need to test?**
- ✅ **No** - if you just want the code available for future use
- ✅ **Yes** - if you want to actually use the advanced features

The code is already compiled and working - it just needs to be connected to your main workflow!
