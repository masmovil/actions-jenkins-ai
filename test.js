#!/usr/bin/env node

/**
 * Test script for Jenkins AI Action
 * This script simulates GitHub Actions inputs using environment variables
 * and runs the action locally for testing purposes.
 */

require('dotenv').config();

// Mock the @actions/core module to use environment variables as inputs
const mockCore = {
  getInput: (name, options) => {
    const envVarName = name.toUpperCase().replace(/-/g, '_');
    const value = process.env[envVarName];
    
    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    
    console.log(`📥 Input '${name}': ${value ? '[SET]' : '[NOT SET]'}`);
    return value || '';
  },
  
  info: (message) => {
    console.log(`ℹ️  ${message}`);
  },
  
  error: (message) => {
    console.error(`❌ ${message}`);
  },
  
  setFailed: (message) => {
    console.error(`💥 Action failed: ${message}`);
    process.exit(1);
  }
};

// Replace the @actions/core module with our mock
require.cache[require.resolve('@actions/core')] = {
  exports: mockCore
};

async function runTest() {
  console.log('🧪 Starting Jenkins AI Action Test');
  console.log('=====================================');
  
  // Check if .env file exists
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('📝 Please create a .env file based on .env.example');
    console.log('   cp .env.example .env');
    console.log('   # Then edit .env with your actual values');
    process.exit(1);
  }
  
  // Validate required environment variables
  const requiredEnvVars = [
    'STATUS_URL',
    'SLACK_ACCESS_TOKEN', 
    'SLACK_MESSAGE_THREAD_TS',
    'SLACK_CHANNEL',
    'GCP_SA'
  ];
  
  console.log('🔍 Checking environment variables...');
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    console.log('📝 Please check your .env file and ensure all required variables are set');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are set');
  console.log('');
  
  try {
    // Import and run the main function
    const { main } = require('./dist/main.js');
    await main();
    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the test
runTest().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
