import chalk from 'chalk';
import ora from 'ora';
import logSymbols from 'log-symbols';

class Logger {
  constructor() {
    this.activeSpinners = new Map();
  }

  /**
   * Log an info message in yellow
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    console.log(chalk.yellow('INFO:', ...args));
  }

  /**
   * Log a success message in green
   * @param {...any} args - Arguments to log
   */
  success(...args) {
    console.log(chalk.green(logSymbols.success, ...args));
  }

  /**
   * Log a warning message in yellow
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.log(chalk.yellow(logSymbols.warning, ...args));
  }

  /**
   * Log an error message in red
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error(chalk.red(logSymbols.error, ...args));
  }

  /**
   * Log a debug message in gray
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    console.log(chalk.gray('DEBUG:', ...args));
  }

  /**
   * Log a notice message in bright magenta
   * @param {...any} args - Arguments to log
   */
  notice(...args) {
    console.log(chalk.magentaBright('NOTICE:', ...args));
  }

  /**
   * Log a schema sync message in blue
   * @param {...any} args - Arguments to log
   */
  schema(...args) {
    console.log(chalk.blue('SCHEMA:', ...args));
  }

  /**
   * Log a database message in magenta
   * @param {...any} args - Arguments to log
   */
  db(...args) {
    console.log(chalk.magenta('DB:', ...args));
  }

  /**
   * Log a model message in green with custom formatting
   * @param {string} operation - The operation name
   * @param {string} model - The model name
   * @param {...any} data - Additional data to log
   */
  model(operation, model, ...data) {
    // Format data objects for better readability
    const formattedData = data.map(item => {
      if (typeof item === 'object' && item !== null) {
        return JSON.stringify(item, null, 2);
      }
      return item;
    });
    
    console.log(
      chalk.greenBright(`[MODEL:${model}] ${operation}`),
      ...formattedData.map(item => chalk.greenBright(item))
    );
  }

  /**
   * Start a spinner with the given text
   * @param {string} text - Text to display next to the spinner
   * @param {string} id - Optional ID for the spinner (for reference)
   * @returns {Object} - The spinner instance
   */
  spinner(text, id = 'default') {
    const spinner = ora({
      text,
      color: 'green',
    }).start();
    
    if (id) {
      this.activeSpinners.set(id, spinner);
    }
    
    return spinner;
  }

  /**
   * Updates an existing spinner text
   * @param {string} text - New text to display
   * @param {string|Object} idOrSpinner - Spinner ID or spinner instance
   */
  updateSpinner(text, idOrSpinner = 'default') {
    const spinner = typeof idOrSpinner === 'string'
      ? this.activeSpinners.get(idOrSpinner)
      : idOrSpinner;
      
    if (spinner) {
      spinner.text = text;
    }
  }

  /**
   * Completes a spinner with a success message
   * @param {string} text - Success text to display
   * @param {string|Object} idOrSpinner - Spinner ID or spinner instance
   */
  succeed(text, idOrSpinner = 'default') {
    const spinner = typeof idOrSpinner === 'string'
      ? this.activeSpinners.get(idOrSpinner)
      : idOrSpinner;
      
    if (spinner) {
      spinner.succeed(text);
      if (typeof idOrSpinner === 'string') {
        this.activeSpinners.delete(idOrSpinner);
      }
    }
  }

  /**
   * Completes a spinner with a failure message
   * @param {string} text - Error text to display
   * @param {string|Object} idOrSpinner - Spinner ID or spinner instance
   */
  fail(text, idOrSpinner = 'default') {
    const spinner = typeof idOrSpinner === 'string'
      ? this.activeSpinners.get(idOrSpinner)
      : idOrSpinner;
      
    if (spinner) {
      spinner.fail(text);
      if (typeof idOrSpinner === 'string') {
        this.activeSpinners.delete(idOrSpinner);
      }
    }
  }

  /**
   * Creates a simple progress bar (using spinner and percentage)
   * @param {string} text - Text to display next to the progress
   * @param {string} id - Optional ID for the progress bar
   * @returns {Object} - Progress control object
   */
  progressBar(text, id = 'progress') {
    const spinner = this.spinner(`${text} 0%`, id);
    let progress = 0;
    
    return {
      update: (percentage) => {
        progress = Math.min(100, Math.max(0, percentage));
        spinner.text = `${text} ${progress}%`;
      },
      increment: (amount = 10) => {
        progress = Math.min(100, progress + amount);
        spinner.text = `${text} ${progress}%`;
        if (progress >= 100) {
          spinner.succeed(`${text} complete!`);
          this.activeSpinners.delete(id);
        }
      },
      complete: (successText) => {
        spinner.succeed(successText || `${text} complete!`);
        this.activeSpinners.delete(id);
      },
      fail: (errorText) => {
        spinner.fail(errorText || `${text} failed`);
        this.activeSpinners.delete(id);
      }
    };
  }

  /**
   * Display a table with proper formatting
   * @param {Array} data - Array of objects
   * @param {string} color - Optional color for the table (default: 'cyan')
   */
  table(data, color = 'cyan') {
    if (!Array.isArray(data) || data.length === 0) {
      return;
    }
    
    // Get chalk color function
    const colorFn = chalk[color] || chalk.cyan;
    
    // Get all keys from the first object
    const keys = Object.keys(data[0]);
    
    // Calculate column widths
    const columnWidths = {};
    keys.forEach(key => {
      columnWidths[key] = key.length;
      data.forEach(row => {
        const valueStr = String(row[key] ?? '');
        columnWidths[key] = Math.max(columnWidths[key], valueStr.length);
      });
    });
    
    // Create header
    const header = keys.map(key => 
      chalk.bold(colorFn(key.padEnd(columnWidths[key])))
    ).join(colorFn(' | '));
    
    // Create separator
    const separator = colorFn(keys.map(key => 
      '─'.repeat(columnWidths[key])
    ).join('─┼─'));
    
    // Print header
    console.log(header);
    console.log(separator);
    
    // Print rows
    data.forEach(row => {
      const rowStr = keys.map(key => {
        const valueStr = String(row[key] ?? '');
        return valueStr.padEnd(columnWidths[key]);
      }).join(' | ');
      console.log(colorFn(rowStr));
    });
  }

  /**
   * Utility method to colorize text with a specific color
   * @param {string} text - Text to colorize
   * @param {string} color - Color to use ('red', 'green', 'blue', 'yellow', 'cyan', 'magenta', etc.)
   * @param {boolean} bright - Whether to use the bright version of the color
   * @returns {string} - Colorized text
   */
  colorize(text, color = 'white', bright = false) {
    const colorKey = bright ? `${color}Bright` : color;
    return chalk[colorKey] ? chalk[colorKey](text) : text;
  }
}

// Export a singleton instance
export default new Logger(); 