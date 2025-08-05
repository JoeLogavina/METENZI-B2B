// Simple Node.js production server that avoids all Vite dependencies
const express = require('express');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 B2B License Platform - Simple Production Server');

const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

// Set production environment
process.env.NODE_ENV = 'production';

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'B2B License Platform is running' });
});

// Start the actual TypeScript server as a child process
let serverProcess = null;

function startServer() {
    console.log('📦 Starting TypeScript server...');
    
    serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
    });

    serverProcess.on('close', (code) => {
        console.log(`Server process exited with code ${code}`);
        if (code !== 0) {
            console.log('🔄 Restarting server...');
            setTimeout(startServer, 2000);
        }
    });

    serverProcess.on('error', (error) => {
        console.error('❌ Server error:', error);
        setTimeout(startServer, 2000);
    });
}

// Start the TypeScript server
startServer();

// Start health check server on different port for monitoring
const healthPort = port + 1;
app.listen(healthPort, '0.0.0.0', () => {
    console.log(`🔍 Health check server running on port ${healthPort}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (serverProcess) {
        serverProcess.kill('SIGTERM');
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (serverProcess) {
        serverProcess.kill('SIGINT');
    }
    process.exit(0);
});