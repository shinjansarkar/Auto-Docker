#!/bin/bash

# Auto Docker Extension - Test Runner Script
# This script runs all tests and generates reports

echo "🧪 Auto Docker Extension - Test Suite"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Compile TypeScript
echo -e "${YELLOW}🔨 Compiling TypeScript...${NC}"
npm run compile-tests

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Compilation successful${NC}"
echo ""

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
npm test

TEST_RESULT=$?

echo ""
echo "======================================"

if [ $TEST_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
