import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ControllerLoader {
    async init() {
        const controllers = {};
        const files = await fs.readdir(__dirname);

        for (const file of files) {
            if (file === 'index.js' || !file.endsWith('.js')) {
                continue;
            }

            const controllerName = path.basename(file, '.js');
            const { default: controller } = await import(`./${file}`);
            controllers[controllerName] = controller;
        }

        console.log(`Loaded ${Object.keys(controllers).length} controllers`);
        return controllers;
    }
}

export default new ControllerLoader(); 