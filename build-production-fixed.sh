#!/bin/bash

echo "🔧 Fixed production build..."

# Create dist directory
mkdir -p dist

# Build backend by removing TypeScript syntax
echo "🔧 Converting TypeScript to JavaScript..."
node -e "
const fs = require('fs');
const content = fs.readFileSync('server/index.ts', 'utf8');

// Remove TypeScript type annotations and imports
const jsContent = content
  // Fix the main import line that's causing the error
  .replace(/import express, { type Request, Response, NextFunction } from \"express\";/, 'import express, { Response, NextFunction } from \"express\";')
  // Remove other type imports
  .replace(/import.*{.*type.*}.*from.*$/gm, (match) => {
    return match.replace(/,?\\s*type\\s+[\\w<>\\[\\]]+/g, '').replace(/type\\s+[\\w<>\\[\\]]+,?\\s*/g, '');
  })
  // Remove function parameter type annotations
  .replace(/(\\w+)\\s*:\\s*[\\w<>\\[\\]]+/g, '$1')
  // Remove variable type annotations
  .replace(/:\\s*[\\w<>\\[\\]]+(?=\\s*[=;])/g, '')
  // Remove optional property markers
  .replace(/\\?:/g, ':')
  // Remove generic types
  .replace(/<[^>]+>/g, '')
  // Remove type assertions
  .replace(/as\\s+[\\w<>\\[\\]]+/g, '')
  // Remove interface definitions
  .replace(/interface\\s+\\w+\\s*{[^}]*}/g, '')
  // Remove type aliases
  .replace(/type\\s+\\w+\\s*=\\s*[^;]+;/g, '');

fs.writeFileSync('dist/index.js', jsContent);
console.log('TypeScript converted to JavaScript');
"

# Create ES module config
echo '{"type":"module"}' > dist/package.json

echo "✅ Fixed build completed!"