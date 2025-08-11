#!/usr/bin/env node

/**
 * Database Backup Script for Support System Integration
 * Creates backup before schema changes to mitigate migration risks
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load environment variables
config();

const BACKUP_DIR = './backups';
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_FILENAME = `database-backup-${TIMESTAMP}.sql`;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Parse DATABASE_URL to get connection parameters
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

// Extract connection details from URL
const url = new URL(databaseUrl);
const host = url.hostname;
const port = url.port || '5432';
const database = url.pathname.slice(1);
const username = url.username;
const password = url.password;

console.log('🔄 Starting database backup...');
console.log(`📊 Database: ${database} on ${host}:${port}`);

// Create pg_dump command
const backupPath = path.join(BACKUP_DIR, BACKUP_FILENAME);
const pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --no-owner --no-acl --clean --if-exists > "${backupPath}"`;

exec(pgDumpCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Backup failed:', error.message);
    
    // Try alternative backup method for cloud databases
    console.log('🔄 Attempting alternative backup method...');
    
    const alternativeCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} --data-only --inserts > "${backupPath}"`;
    
    exec(alternativeCommand, (altError, altStdout, altStderr) => {
      if (altError) {
        console.error('❌ Alternative backup also failed:', altError.message);
        console.log('⚠️  Proceeding without backup - ensure manual backup is available');
      } else {
        console.log('✅ Alternative backup completed successfully');
        console.log(`📁 Backup saved to: ${backupPath}`);
        logBackupInfo();
      }
    });
    
    return;
  }

  console.log('✅ Database backup completed successfully');
  console.log(`📁 Backup saved to: ${backupPath}`);
  
  if (stderr) {
    console.log('⚠️  Backup warnings:', stderr);
  }
  
  logBackupInfo();
});

function logBackupInfo() {
  // Create backup log
  const logFile = path.join(BACKUP_DIR, 'backup-log.json');
  const logEntry = {
    timestamp: new Date().toISOString(),
    filename: BACKUP_FILENAME,
    database: database,
    reason: 'Pre-support-system-integration backup',
    status: 'completed'
  };
  
  let logs = [];
  if (fs.existsSync(logFile)) {
    logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  }
  
  logs.push(logEntry);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  
  console.log('📝 Backup logged successfully');
  console.log('🛡️  Database backup complete - ready for support system integration');
}