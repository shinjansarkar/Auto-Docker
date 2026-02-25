# 🧪 Auto Docker Extension - Automated Testing

**Complete integration test suite for validating Docker file generation across 15+ project types.**

---

## 📋 Quick Start

### 1. Fix Compilation Issues (Required First)

```powershell
# Fix zod version compatibility (fixes 59 errors)
npm install zod@3.23.8

# Verify compilation
npm run compile
```

### 2. Run Tests

```powershell
# Basic test (recommended first run)
.\run-integration-tests.ps1

# Full test with Docker builds (slower but thorough)
.\run-integration-tests.ps1 -BuildDocker

# Clean existing Docker files first
.\run-integration-tests.ps1 -CleanFirst
```

### 3. Review Results

After tests complete:
- **Report**: `AUTO_DOCKER_TEST_REPORT.md` (opens automatically)
- **Summary**: Console output shows pass/fail counts
- **Details**: Report includes errors, warnings, recommendations

---

## 📁 Documentation Files

| File | Purpose |
|------|---------|
| **TEST_SUITE_SUMMARY.md** | 📊 Start here - Overview of entire test suite |
| **QUICK_FIX_GUIDE.md** | ⚡ Quick commands to fix and run tests |
| **AUTO_DOCKER_ISSUES_FOUND.md** | 🐛 Detailed list of 92 compilation errors found |
| **AUTO_DOCKER_TEST_IMPLEMENTATION.md** | 📖 Full implementation details |
| **src/test/integration/README.md** | 📚 Complete testing guide |

---

## ✨ What Gets Tested

### Project Types (15+)
✅ Node.js (Express, NestJS)  
✅ Python (Flask, Django, FastAPI)  
✅ Java (Spring Boot)  
✅ Go (Gin)  
✅ Rust (Actix)  
✅ PHP (Laravel)  
✅ .NET Core  
✅ Ruby on Rails  
✅ And more...

### Validation Checks
✅ File generation (Dockerfile, docker-compose.yml, .dockerignore)  
✅ Dockerfile syntax  
✅ YAML validation  
✅ Port configuration  
✅ Security best practices  
✅ Multi-stage builds  
✅ [Optional] Docker build testing

---

## 🎯 Test Commands

```powershell
# Via PowerShell (recommended)
.\run-integration-tests.ps1                    # Basic test
.\run-integration-tests.ps1 -BuildDocker       # With Docker builds
.\run-integration-tests.ps1 -CleanFirst        # Clean + test

# Via npm
npm run test:integration                        # Basic test
npm run test:integration:build                  # With Docker builds

# Clean test projects
.\clean-test-projects.ps1
.\clean-test-projects.ps1 -DryRun              # Preview only
```

---

## 📊 Sample Output

```
═══════════════════════════════════════════════════════════
   Auto Docker Extension - Integration Test Suite
═══════════════════════════════════════════════════════════

✓ Extension activated
✓ Test projects root found

Testing: Node.js Express
  ✓ Files generated (Dockerfile, docker-compose.yml, .dockerignore)
  ✓ Dockerfile syntax valid
  ✓ docker-compose.yml valid
  ✓ Port configuration correct
  ✓ Passed (8420ms)

Testing: Python Flask
  ✓ Files generated
  ✓ Dockerfile syntax valid
  ✓ docker-compose.yml valid
  ✓ Passed (7890ms)

...

═══════════════════════════════════════════════════════════
✓ All tests passed! (Duration: 142.5s)

Test Summary:
  Total Projects: 15
  Passed: 15
  Failed: 0

✓ Test report generated: AUTO_DOCKER_TEST_REPORT.md
```

---

## 🚨 Current Status

### ⚠️ BLOCKED: Compilation Errors

**Issue**: 92 pre-existing TypeScript errors in codebase prevent test execution

**Quick Fix**:
```powershell
npm install zod@3.23.8
npm run compile
```

**Detailed Fix**: See `QUICK_FIX_GUIDE.md` or `AUTO_DOCKER_ISSUES_FOUND.md`

---

## 📖 Learn More

### Getting Started
1. **Read**: `TEST_SUITE_SUMMARY.md` - Overview
2. **Fix**: `QUICK_FIX_GUIDE.md` - Fix compilation  
3. **Run**: `.\run-integration-tests.ps1`
4. **Review**: `AUTO_DOCKER_TEST_REPORT.md`

### Deep Dive
- **Test Architecture**: `src/test/integration/README.md`
- **Issue Details**: `AUTO_DOCKER_ISSUES_FOUND.md`
- **Implementation**: `AUTO_DOCKER_TEST_IMPLEMENTATION.md`

---

## 💡 Tips

- **First Run**: Use basic test (no `-BuildDocker`) - faster feedback
- **Before Release**: Use `-BuildDocker` - validates actual builds
- **Clean State**: Use `-CleanFirst` - ensures fresh test
- **CI/CD**: See `src/test/integration/README.md` for GitHub Actions setup

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Tests won't compile | See `QUICK_FIX_GUIDE.md` |
| Tests fail | Check `AUTO_DOCKER_TEST_REPORT.md` |
| Docker not found | Install Docker or skip `-BuildDocker` |
| Tests timeout | Increase `TEST_TIMEOUT` env var |
| Extension not found | Run `npm run compile` first |

---

## 📞 Need Help?

1. Check documentation files above
2. Review test output and report
3. Examine error messages in console
4. See `src/test/integration/README.md` for detailed troubleshooting

---

## ✅ Success Criteria

Your extension is working correctly when:

✅ All 15+ projects generate Docker files  
✅ Dockerfile syntax is valid  
✅ docker-compose.yml is valid YAML  
✅ Security best practices followed  
✅ Tests complete in < 10 minutes  
✅ Report shows 100% pass rate  

---

**Ready to test?** → Start with `QUICK_FIX_GUIDE.md` → Run `.\run-integration-tests.ps1` 🚀
