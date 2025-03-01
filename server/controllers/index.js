import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../lib/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ControllerLoader {
    async init() {
        const controllerSpinner = logger.spinner('Loading controllers');
        try {
            const controllers = {};
            const files = await fs.readdir(__dirname);
            let loadedCount = 0;
            const totalFiles = files.filter(file => file !== 'index.js' && file.endsWith('.js')).length;

            for (const file of files) {
                if (file === 'index.js' || !file.endsWith('.js')) {
                    continue;
                }

                controllerSpinner.text = `Loading controller: ${file}`;
                const controllerName = path.basename(file, '.js');
                const { default: controller } = await import(`./${file}`);
                controllers[controllerName] = controller;
                loadedCount++;
                controllerSpinner.text = `Loaded ${loadedCount}/${totalFiles} controllers`;
            }

            controllerSpinner.succeed(`Successfully loaded ${Object.keys(controllers).length} controllers`);
            return controllers;
        } catch (error) {
            controllerSpinner.fail(`Failed to load controllers: ${error.message}`);
            throw error;
        }
    }
}

export default new ControllerLoader(); 