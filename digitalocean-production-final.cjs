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
  
  // Create dist directory
  const distPath = path.join(process.cwd(), 'dist');
  console.log('📁 Creating dist directory...');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  // Check if dist/index.cjs already exists
  const targetPath = path.join(distPath, 'index.cjs');
  if (fs.existsSync(targetPath)) {
    console.log('✅ dist/index.cjs already exists');
  } else {
    // Check if index.cjs exists
    const sourcePath = path.join(process.cwd(), 'index.cjs');
    
    if (fs.existsSync(sourcePath)) {
      console.log('✅ index.cjs found - copying to dist...');
      fs.copyFileSync(sourcePath, targetPath);
      console.log('✅ dist/index.cjs created successfully');
    } else {
      console.log('❌ Error: index.cjs source file not found');
      process.exit(1);
    }
  }

  console.log('✅ Ready for CommonJS deployment');
  process.exit(0);
  
} else {
  console.log('🚀 RUNTIME PHASE: Starting B2B License Platform...');
  console.log(`📍 Target port: ${process.env.PORT || '8080'}`);
  
  // Look for the production server in multiple locations
  const possiblePaths = [
    path.join(process.cwd(), 'server', 'production-server.cjs'), // Working server file first
    path.join(process.cwd(), 'index.cjs'),
    path.join(process.cwd(), 'dist', 'index.cjs'),
    path.join(process.cwd(), 'server', 'index.cjs')
  ];
  
  let serverPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      serverPath = testPath;
      break;
    }
  }
  
  if (!serverPath) {
    console.error('❌ No production server found in expected locations');
    console.log('Searched paths:', possiblePaths);
    process.exit(1);
  }
  
  console.log('📂 Loading production server module...');
  try {
    // Load and execute the production server
    require(serverPath);
  } catch (error) {
    console.error('❌ Failed to start production server:', error);
    process.exit(1);
  }
}