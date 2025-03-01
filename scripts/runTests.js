#!/usr/bin/env node

/**
 * Test runner script with enhanced output
 * Usage: node scripts/runTests.js [testPattern]
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ANSI color codes for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Get test pattern from command line arguments
const testPattern = process.argv[2] || '';

// Print header
console.log('\n');
console.log(`${colors.bgBlue}${colors.white}${colors.bright} RUNNING TESTS ${colors.reset}`);
console.log('\n');

if (testPattern) {
  console.log(`${colors.cyan}Test pattern: ${colors.yellow}${testPattern}${colors.reset}`);
  console.log('\n');
}

// Determine the command to run based on the platform
const isWindows = process.platform === 'win32';
const command = isWindows ? 'npx.cmd' : 'npx';
const args = ['cross-env', 'NODE_OPTIONS=--experimental-vm-modules', 'jest'];

if (testPattern) {
  args.push(testPattern);
}

// Add additional Jest arguments
args.push('--colors');

// Spawn the test process
const testProcess = spawn(command, args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

// Handle process exit
testProcess.on('close', (code) => {
  console.log('\n');
  if (code === 0) {
    console.log(`${colors.bgGreen}${colors.black}${colors.bright} TESTS PASSED ${colors.reset}`);
  } else {
    console.log(`${colors.bgRed}${colors.white}${colors.bright} TESTS FAILED ${colors.reset}`);
  }
  console.log('\n');
  process.exit(code);
});

// Handle process errors
testProcess.on('error', (err) => {
  console.error(`${colors.red}Error running tests: ${err.message}${colors.reset}`);
  process.exit(1);
}); 