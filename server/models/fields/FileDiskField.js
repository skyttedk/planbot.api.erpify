// models/fields/FileDiskField.js
import Field from '../../lib/orm/Field.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default storage location relative to the server root
const DEFAULT_STORAGE_DIR = path.join(__dirname, '../../../storage/uploads');

/**
 * A custom field class for storing files on the server's filesystem, extending the base Field class.
 * This field stores file metadata in the database, but the actual file content is saved on disk.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {Object} [options.default] - Default value if none is provided.
 * @param {string} [options.caption] - Caption for the field.
 * @param {string} [options.storageDir] - Custom directory for file storage.
 * @param {Array<string>} [options.allowedMimeTypes] - Array of allowed MIME types.
 * @param {number} [options.maxSizeBytes] - Maximum file size in bytes.
 * @param {boolean} [options.preserveFilename=false] - Whether to preserve original filenames (with UUID prefix).
 */
class FileDiskField extends Field {
    constructor(options = {}) {
        // Fixed properties for a FileDisk field
        const fixedProperties = {
            uid: '{e4f5a8b3-1c9d-4f67-8e25-b47d32a0c91f}',
            type: 'text',
            caption: 'File Upload (Disk)',
        };

        // Only allow specific properties to be overridden by options
        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        // Field documentation provides metadata about the field
        const documentation = {
            description: 'File storage field that saves files on the server filesystem',
            examples: ['/storage/uploads/f8d7e6c5-abcd-1234-efgh-456789abcdef.pdf'],
            usage: 'Use for storing files on the server filesystem rather than in the database',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor
        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'FileDiskField');
        
        // Custom properties
        this.storageDir = options.storageDir || DEFAULT_STORAGE_DIR;
        this.allowedMimeTypes = options.allowedMimeTypes || null; // null means all types allowed
        this.maxSizeBytes = options.maxSizeBytes || 50 * 1024 * 1024; // Default 50MB limit
        this.preserveFilename = options.preserveFilename || false;
        
        // Ensure storage directory exists
        this._ensureStorageDir();
    }
    
    /**
     * Ensures the storage directory exists
     * @private
     */
    async _ensureStorageDir() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            console.error(`Error creating storage directory ${this.storageDir}: ${error.message}`);
        }
    }
    
    /**
     * Custom setter logic: handles file uploads and saves to disk
     *
     * @param {Object|string} value - File object or path
     * @returns {string} Path to the stored file
     */
    async onSet(value) {
        if (!value) return value;
        
        // If value is already a valid file path and exists on the server, return it
        if (typeof value === 'string' && !value.includes('sourceFilePath')) {
            try {
                // Try to access file to verify it exists
                await fs.access(value);
                // It exists, so just return the path
                return value;
            } catch (error) {
                // File doesn't exist at the specified path, continue with processing
            }
        }
        
        // Ensure storage directory exists
        await this._ensureStorageDir();
        
        // Generate a unique ID for the file
        const fileId = crypto.randomUUID();
        
        // Handle file upload or copy
        if (typeof value === 'string') {
            // Treat as a source file path
            try {
                // Read file info
                const fileStats = await fs.stat(value);
                const originalFilename = path.basename(value);
                const extension = path.extname(value).toLowerCase();
                
                // Determine target filename
                let targetFilename;
                if (this.preserveFilename) {
                    targetFilename = `${fileId}-${originalFilename}`;
                } else {
                    targetFilename = `${fileId}${extension}`;
                }
                
                // Determine MIME type based on extension (basic implementation)
                let mimeType = 'application/octet-stream'; // Default
                const mimeTypes = {
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.pdf': 'application/pdf',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.txt': 'text/plain',
                    '.csv': 'text/csv',
                    '.json': 'application/json',
                    '.xml': 'application/xml',
                    '.zip': 'application/zip'
                };
                
                if (extension in mimeTypes) {
                    mimeType = mimeTypes[extension];
                }
                
                // Validate file size
                if (this.maxSizeBytes && fileStats.size > this.maxSizeBytes) {
                    throw new Error(`File size (${fileStats.size} bytes) exceeds maximum allowed size (${this.maxSizeBytes} bytes)`);
                }
                
                // Validate mime type
                if (this.allowedMimeTypes && !this.allowedMimeTypes.includes(mimeType)) {
                    throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
                }
                
                // Determine target file path
                const targetPath = path.join(this.storageDir, targetFilename);
                
                // Copy the file to the storage directory
                await fs.copyFile(value, targetPath);
                
                // Return just the path to the stored file
                return targetPath;
            } catch (error) {
                throw new Error(`Error processing file: ${error.message}`);
            }
        } else if (typeof value === 'object' && value.sourceFilePath) {
            // Handle object format with sourceFilePath property
            return this.onSet(value.sourceFilePath);
        }
        
        throw new Error('Invalid file input. Expected a file path or object with sourceFilePath.');
    }
    
    /**
     * Custom getter logic: simply returns the file path
     *
     * @param {string} value - The stored file path
     * @returns {string} File path
     */
    onGet(value) {
        return value;
    }
    
    /**
     * Deletes the file from disk when the field value is deleted
     * 
     * @param {string} value - The stored file path
     */
    async onDelete(value) {
        if (value) {
            try {
                // Check if file exists before attempting to delete
                await fs.access(value);
                await fs.unlink(value);
                console.log(`Deleted file: ${value}`);
            } catch (error) {
                console.error(`Error deleting file ${value}: ${error.message}`);
                // Don't throw, just log the error as this is a cleanup operation
            }
        }
    }
}

export default FileDiskField; 