#!/bin/bash

# Production Build Script for DigitalOcean
# Handles missing dependencies that get pruned during deployment

echo "🔧 Starting production build process..."

# Check if critical build dependencies are available
MISSING_DEPS=()

if ! npm list @vitejs/plugin-react >/dev/null 2>&1; then
    MISSING_DEPS+=("@vitejs/plugin-react")
fi

if ! npm list vite >/dev/null 2>&1; then
    MISSING_DEPS+=("vite")
fi

if ! npm list esbuild >/dev/null 2>&1; then
    MISSING_DEPS+=("esbuild")
fi

# Install missing dependencies if any
if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    echo "🔧 Installing missing build dependencies: ${MISSING_DEPS[*]}"
    npm install --no-save "${MISSING_DEPS[@]}"
fi

# Run the build
echo "🔧 Running Vite build..."
npx vite build

echo "🔧 Running esbuild for server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Create package.json for ES modules
echo "🔧 Creating dist/package.json for ES modules..."
echo '{"type":"module"}' > dist/package.json

echo "✅ Production build completed successfully!"