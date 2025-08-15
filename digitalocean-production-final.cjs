#!/usr/bin/env node

// DigitalOcean Production Build Script
// This script handles both build-only and production server modes

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if this is build-only mode
const isBuildOnly = process.argv.includes('--build-only');

console.log(`🚀 DigitalOcean Production Script`);
console.log(`Mode: ${isBuildOnly ? 'Build Only' : 'Production Server'}`);
console.log(`Node Version: ${process.version}`);
console.log(`Working Directory: ${process.cwd()}`);

if (isBuildOnly) {
  console.log('📦 Running in build-only mode...');
  
  // Create dist directory if it doesn't exist
  const distPath = path.join(process.cwd(), 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
    console.log('✅ Created dist directory');
  }
  
  // Run the build process
  console.log('🔨 Starting build process...');
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production'
    }
  });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed successfully');
      
      // Verify dist folder exists and has content
      if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        console.log(`📁 Dist folder contains ${files.length} files/folders`);
        console.log('📋 Contents:', files.slice(0, 5).join(', ') + (files.length > 5 ? '...' : ''));
      }
      
      process.exit(0);
    } else {
      console.error(`❌ Build failed with code ${code}`);
      process.exit(code);
    }
  });
  
  buildProcess.on('error', (error) => {
    console.error('❌ Build process error:', error);
    process.exit(1);
  });
  
} else {
  // Production server mode
  console.log('🌐 Starting production server...');
  
  // Use the existing production server
  const serverPath = path.join(process.cwd(), 'index.cjs');
  
  if (fs.existsSync(serverPath)) {
    console.log('📍 Using index.cjs for production server');
    
    const serverProcess = spawn('node', [serverPath], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: process.env.PORT || '8080'
      }
    });
    
    serverProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });
    
    serverProcess.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down gracefully...');
      serverProcess.kill('SIGTERM');
    });
    
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down gracefully...');
      serverProcess.kill('SIGINT');
    });
    
  } else {
    console.error('❌ Production server file not found:', serverPath);
    process.exit(1);
  }
}