export default {
  // Tell Jest to handle ES modules
  transform: {},
  
  // File extensions
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'json'],
  
  // The root directory for tests
  rootDir: './',
  
  // The test match pattern
  testMatch: ['**/tests/**/*.test.js'],
  
  // Disable automatic coverage collection
  collectCoverage: false,
  
  // The test environment
  testEnvironment: 'node',
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // Verbose output
  verbose: true,
  
  // Use ESM for all js files
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1.js'
  },
  
  // For Jest to work with ESM
  testEnvironmentOptions: {
    url: 'http://localhost/'
  },
  
  // Allow import from ESM
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?)'
  ],
  
  // Set experimental flags
  globals: {
    'node-options': '--experimental-vm-modules'
  },
}; 