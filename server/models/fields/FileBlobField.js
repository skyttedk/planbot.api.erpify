// models/fields/FileBlobField.js
import Field from '../../lib/orm/Field.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * A custom field class for storing files as BLOBs in the database, extending the base Field class.
 * This field stores the file content as a binary data in the database along with metadata.
 *
 * @param {Object} options - Configuration options.
 * @param {boolean} [options.required=false] - Whether the field is required.
 * @param {Object} [options.default] - Default value if none is provided.
 * @param {string} [options.caption] - Caption for the field.
 * @param {Array<string>} [options.allowedMimeTypes] - Array of allowed MIME types (e.g., ['image/jpeg', 'application/pdf']).
 * @param {number} [options.maxSizeBytes] - Maximum file size in bytes.
 */
class FileBlobField extends Field {
    constructor(options = {}) {
        // Fixed properties for a FileBlob field
        const fixedProperties = {
            uid: '{d8e72a3f-7ab1-4e43-8ce5-c5a3d81b7e22}',
            type: 'jsonb',
            caption: 'File Upload (Database)',
        };

        // Only allow specific properties to be overridden by options
        const allowedOverrides = {
            required: options.required,
            default: options.default,
            caption: options.caption,
        };

        // Field documentation provides metadata about the field
        const documentation = {
            description: 'File storage field that saves files as BLOBs in the database',
            examples: ['{ "filename": "document.pdf", "mimeType": "application/pdf", "size": 12345, "data": "base64data..." }'],
            usage: 'Use for storing smaller files directly in the database',
        };

        // Merge fixed properties and allowed overrides and pass them to the base Field constructor
        super({ ...fixedProperties, ...allowedOverrides, documentation }, 'FileBlobField');
        
        // Custom properties
        this.allowedMimeTypes = options.allowedMimeTypes || null; // null means all types allowed
        this.maxSizeBytes = options.maxSizeBytes || 5 * 1024 * 1024; // Default 5MB limit
    }
    
    /**
     * Custom setter logic: handles file uploads and converts to storable format
     *
     * @param {Object|string} value - File object or path
     * @returns {Object} File metadata and content
     */
    async onSet(value) {
        if (!value) return value;
        
        // If value is already a properly formatted object with data, return it
        if (typeof value === 'object' && value.filename && value.data) {
            // Validate size if needed
            if (this.maxSizeBytes && value.size > this.maxSizeBytes) {
                throw new Error(`File size (${value.size} bytes) exceeds maximum allowed size (${this.maxSizeBytes} bytes)`);
            }
            
            // Validate mime type if needed
            if (this.allowedMimeTypes && !this.allowedMimeTypes.includes(value.mimeType)) {
                throw new Error(`File type ${value.mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
            }
            
            return value;
        }
        
        // Handle file path input (for uploads or server files)
        if (typeof value === 'string') {
            try {
                // Read file from path
                const fileData = await fs.readFile(value);
                const fileStats = await fs.stat(value);
                
                // Get file info
                const filename = path.basename(value);
                const extension = path.extname(value).toLowerCase();
                
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
                
                // Generate a unique ID for the file
                const fileId = crypto.randomUUID();
                
                // Return file data in format for database storage
                return {
                    id: fileId,
                    filename,
                    mimeType,
                    size: fileStats.size,
                    data: fileData.toString('base64'),
                    uploadDate: new Date().toISOString()
                };
            } catch (error) {
                throw new Error(`Error processing file: ${error.message}`);
            }
        }
        
        throw new Error('Invalid file input. Expected a file path or file data object.');
    }
    
    /**
     * Custom getter logic: formats the returned file data
     *
     * @param {Object} value - The stored file data
     * @returns {Object} Formatted file data object
     */
    onGet(value) {
        if (!value) return value;
        
        // If it's a string, try to parse it as JSON
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch (e) {
                return value;
            }
        }
        
        return value;
    }
}

export default FileBlobField; 