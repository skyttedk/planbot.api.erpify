import logger from './lib/logger.js';

// Simple example to demonstrate the logger's capabilities
async function demoLogger() {
  console.log('\n--- Colored Logging Demo ---\n');
  
  // Simple colored logging - now with full message coloring
  logger.info('This is an info message in yellow - entire message is colored');
  logger.success('This is a success message in green with a checkmark');
  logger.warn('This is a warning message in yellow with a warning symbol');
  logger.error('This is an error message in red with an error symbol');
  logger.debug('This is a debug message in gray - entire message is colored');
  logger.notice('This is a notice message in bright magenta - new log type!');
  logger.schema('This is a schema-related message in blue');
  logger.db('This is a database-related message in magenta');
  
  // Model logs with improved formatting
  logger.model('create', 'Customer', { id: 1, name: 'John Doe', email: 'john@example.com' });
  logger.model('update', 'Order', { id: 123, total: 99.99, items: 5, status: 'pending' });

  console.log('\n--- Custom Colorize Utility Demo ---\n');
  
  // Demo the colorize utility
  console.log(logger.colorize('Custom colored text in red', 'red'));
  console.log(logger.colorize('Bright blue text using the utility', 'blue', true));
  console.log(logger.colorize('Green background with black text', 'bgGreen'));

  console.log('\n--- Spinner Demo ---\n');
  
  // Spinner example - now in green
  const spinner = logger.spinner('This is a spinner in green');
  
  // Simulate some time-consuming task
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Update the spinner text
  spinner.text = 'Still processing...';
  
  // Simulate more processing
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Complete with success
  spinner.succeed('Task completed successfully');

  console.log('\n--- Progress Bar Demo ---\n');
  
  // Progress bar example
  const progress = logger.progressBar('Loading data');
  
  // Simulate progress increments
  for (let i = 0; i <= 100; i += 20) {
    progress.update(i);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  progress.complete('Data loaded successfully');

  console.log('\n--- Table Demo ---\n');
  
  // Table example with different color options
  const userData = [
    { id: 1, name: 'John Doe', age: 30, role: 'Admin' },
    { id: 2, name: 'Jane Smith', age: 25, role: 'User' },
    { id: 3, name: 'Bob Johnson', age: 40, role: 'Manager' }
  ];
  
  console.log('Default Cyan Table:');
  logger.table(userData);
  
  console.log('\nGreen Table:');
  logger.table(userData, 'green');
  
  console.log('\nYellow Table:');
  logger.table(userData, 'yellow');

  console.log('\n--- Multiple Spinners Demo ---\n');
  
  // Multiple spinners in parallel
  const spinner1 = logger.spinner('Task 1 processing', 'task1');
  const spinner2 = logger.spinner('Task 2 processing', 'task2');
  const spinner3 = logger.spinner('Task 3 processing', 'task3');
  
  // Simulate different completion times
  setTimeout(() => spinner2.succeed('Task 2 finished first'), 1000);
  setTimeout(() => spinner1.succeed('Task 1 finished second'), 2000);
  setTimeout(() => spinner3.fail('Task 3 failed'), 3000);
  
  // Wait for all spinners to complete
  await new Promise(resolve => setTimeout(resolve, 3500));
  
  console.log('\nAll demonstrations completed!');
}

// Run the demo
demoLogger().catch(console.error);

// Instructions:
// Run this file with: node server/demo-logger.js
// You'll see examples of all the logger's capabilities 