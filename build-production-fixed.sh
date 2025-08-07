#!/bin/bash

echo "🔧 Fixed production build..."

# Create dist directory structure
mkdir -p dist/{startup,monitoring,middleware}

# Copy clean JavaScript server
echo "🔧 Copying clean JavaScript server..."
cp index.js dist/index.js

# Copy and convert all server modules to JavaScript
echo "🔧 Converting server modules to JavaScript..."

# Convert TypeScript files to JavaScript by removing type annotations
node -e "
const fs = require('fs');
const path = require('path');

function convertTsToJs(content) {
  return content
    // Remove type imports
    .replace(/import.*{.*type.*}.*from.*$/gm, (match) => {
      return match.replace(/,?\\s*type\\s+[\\w<>\\[\\]]+/g, '').replace(/type\\s+[\\w<>\\[\\]]+,?\\s*/g, '');
    })
    // Fix function parameter types - preserve parameter names
    .replace(/(\\w+)\\s*:\\s*[\\w<>\\[\\]|\\s<>&,]+(?=[,)])/g, '$1')
    // Remove variable type annotations
    .replace(/:\\s*[\\w<>\\[\\]|\\s<>&,]+(?=\\s*[=;,)])/g, '')
    // Remove optional property markers
    .replace(/\\?:/g, ':')
    // Remove generic types
    .replace(/<[^>]*>/g, '')
    // Remove type assertions
    .replace(/as\\s+[\\w<>\\[\\]]+/g, '')
    // Remove interface definitions
    .replace(/interface\\s+\\w+\\s*{[\\s\\S]*?}/g, '')
    // Remove type aliases
    .replace(/type\\s+\\w+\\s*=\\s*[^;]+;/g, '')
    // Update imports to use .js extensions
    .replace(/from ['\"]\\.\\/([^'\"]+)['\"]/g, (match, p1) => {
      return match.replace(p1, p1.endsWith('.js') ? p1 : p1 + '.js');
    })
    .replace(/from ['\"]\\.\\.?\\/([^'\"]+)['\"]/g, (match, p1) => {
      return match.replace(p1, p1.endsWith('.js') ? p1 : p1 + '.js');
    });
}

// Copy main server files
const serverFiles = [
  'server/routes.ts',
  'server/vite.ts',
  'server/startup/database-init.ts',
  'server/monitoring/sentry.ts',
  'server/monitoring/prometheus.ts',
  'server/middleware/monitoring.ts'
];

serverFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const jsContent = convertTsToJs(content);
    const outputPath = file.replace('server/', 'dist/').replace('.ts', '.js');
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, jsContent);
    console.log('Converted: ' + file + ' -> ' + outputPath);
  }
});
"

# Create ES module config
echo '{"type":"module"}' > dist/package.json

echo "✅ Fixed build completed with all modules!"