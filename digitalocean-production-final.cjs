// DigitalOcean Production Final - B2B License Management Platform
// Complete deployment script with build detection and unified server launch

const fs = require('fs');
const path = require('path');

console.log('=== B2B PLATFORM FINAL DEPLOYMENT ===');
console.log(`🕐 Timestamp: ${new Date().toISOString()}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
console.log(`🔌 Port: ${process.env.PORT || '8080'}`);
console.log(`⚙️  Node version: ${process.version}`);

// Check if this is build-only mode
const isBuildOnly = process.argv.includes('--build-only');

// Phase detection
const runEnvCount = Object.keys(process.env).filter(key => 
  key.startsWith('npm_') || 
  key.startsWith('NODE_') ||
  key.includes('RUNTIME') ||
  key.includes('BUILD')
).length;

const isBuildContext = process.env.npm_lifecycle_event === 'build' || 
                      process.env.BUILD_PHASE === 'true' ||
                      runEnvCount < 10;

console.log('🔍 Phase Detection:');
console.log(`  - Build-only flag: ${isBuildOnly}`);
console.log(`  - Runtime environments: ${runEnvCount}`);
console.log(`  - Build context detected: ${isBuildContext}`);

if (isBuildOnly) {
  console.log('📦 BUILD PHASE: Creating production assets...');
  
  // Build frontend and backend assets using npm run build
  console.log('🔨 Running npm run build to create frontend and backend assets...');
  const { execSync } = require('child_process');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
  
  // Verify that the build created the necessary files
  const distPath = path.join(process.cwd(), 'dist');
  const publicPath = path.join(distPath, 'public');
  const indexHtmlPath = path.join(publicPath, 'index.html');
  
  if (!fs.existsSync(indexHtmlPath)) {
    console.error('❌ Build failed: index.html not found at', indexHtmlPath);
    process.exit(1);
  }
  
  console.log('✅ Frontend assets built successfully');
  console.log('✅ index.html found at', indexHtmlPath);
  console.log('✅ Ready for production deployment');
  process.exit(0);
  
} else {
  console.log('🚀 RUNTIME PHASE: Starting B2B License Platform...');
  console.log(`📍 Target port: ${process.env.PORT || '8080'}`);
  
  // Use the working production server file only
  const workingServerPath = path.join(process.cwd(), 'server', 'production-server.cjs');
  
  if (!fs.existsSync(workingServerPath)) {
    console.error('❌ Working production server not found at:', workingServerPath);
    console.log('This deployment requires the server/production-server.cjs file from the August 7th working version');
    process.exit(1);
  }
  
  const serverPath = workingServerPath;
  console.log('✅ Using working production server:', serverPath);
  
  console.log('📂 Loading production server module...');
  try {
    // Load and execute the production server
    require(serverPath);
  } catch (error) {
    console.error('❌ Failed to start production server:', error);
    process.exit(1);
  }
}