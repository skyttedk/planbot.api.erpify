import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ViewLoader {
    async init() {
        const views = {};

        try {
            const files = await fs.readdir(__dirname);

            for (const file of files) {
                if (file === 'index.js' || !file.endsWith('.js')) {
                    continue;
                }

                const viewName = path.basename(file, '.js');
                const { default: view } = await import(`./${file}`);
                views[viewName] = view;
            }

            console.log(`Loaded ${Object.keys(views).length} views`);
        } catch (error) {
            // If views directory doesn't exist yet, just return empty object
            if (error.code === 'ENOENT') {
                console.log('Views directory not found, creating empty views object');
            } else {
                console.error('Error loading views:', error);
            }
        }

        return views;
    }
}

export default new ViewLoader(); 