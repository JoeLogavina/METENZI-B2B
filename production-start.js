#!/usr/bin/env node

/**
 * Production Entry Point - Handles both CommonJS and ES Module environments
 * 
 * This file ensures the application starts correctly on DigitalOcean regardless
 * of module system configuration.
 */

// Try to import the built ES module first
import('./dist/index.js')
  .then(() => {
    console.log('✅ Production server started via ES module');
  })
  .catch((error) => {
    console.error('❌ Failed to start ES module, falling back to index.js:', error.message);
    
    // Fallback to the CommonJS production server
    try {
      require('./index.js');
    } catch (fallbackError) {
      console.error('❌ Both ES module and CommonJS fallback failed:', fallbackError.message);
      process.exit(1);
    }
  });