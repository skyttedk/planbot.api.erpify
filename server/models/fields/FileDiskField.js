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
        console.log('===== FileDiskField.onSet called =====');
        console.log('Received value type:', typeof value);
        if (typeof value === 'object') {
            console.log('Object properties:', Object.keys(value));
            if (value.data) {
                console.log('Data exists, length:', value.data.length);
                if (value.data.length > 100) {
                    console.log('Data preview (first 100 chars):', value.data.substring(0, 100) + '...');
                } else {
                    console.log('Data (full):', value.data);
                }
            } else {
                console.log('No data property found');
            }
            
            if (value.sourceFilePath) {
                console.log('sourceFilePath:', value.sourceFilePath);
            }
            
            if (value.filename) {
                console.log('filename:', value.filename);
            }
            
            if (value.mimeType) {
                console.log('mimeType:', value.mimeType);
            }
        } else if (typeof value === 'string') {
            console.log('String value (truncated if long):', value.length > 100 ? value.substring(0, 100) + '...' : value);
        }
        
    
        // More permissive check for clear/remove flags
        if (typeof value === 'object') {
            // Check for explicit clearing objects
            if (value.clear === true || value.action === 'remove') {
                console.log('Clearing file field');
                return null;
            }
            
            // If we have sourceFilePath as an empty string, treat it as clearing
            if (value.sourceFilePath === '') {
                console.log('Clearing file field (empty sourceFilePath)');
                return null;
            }
            
            // Handle base64 file upload (from client)
            if (value.data && (value.filename || value.sourceFilePath)) {
                // We have a base64 encoded file from client
                const filename = value.filename || value.sourceFilePath;
                console.log(`Processing file upload with base64 data for ${filename}`);
                console.log(`Data length: ${value.data.length} characters`);
                
                try {
                    // Ensure storage directory exists
                    console.log(`Ensuring storage directory exists: ${this.storageDir}`);
                    await this._ensureStorageDir();
                    
                    // Generate a unique ID for the file
                    const fileId = crypto.randomUUID();
                    console.log(`Generated fileId: ${fileId}`);
                    
                    const originalFilename = filename;
                    const extension = path.extname(originalFilename).toLowerCase();
                    console.log(`Original filename: ${originalFilename}, extension: ${extension}`);
                    
                    // Determine target filename
                    let targetFilename;
                    if (this.preserveFilename) {
                        targetFilename = `${fileId}-${originalFilename}`;
                    } else {
                        targetFilename = `${fileId}${extension}`;
                    }
                    console.log(`Target filename: ${targetFilename}`);
                    
                    // Determine target file path (final destination)
                    const targetPath = path.join(this.storageDir, targetFilename);
                    console.log(`Target path: ${targetPath}`);
                    
                    // Try/catch specifically around base64 decoding, which could fail
                    let fileBuffer;
                    try {
                        // Convert base64 to binary
                        console.log('Converting base64 to binary');
                        fileBuffer = Buffer.from(value.data, 'base64');
                        console.log(`Binary data length: ${fileBuffer.length} bytes`);
                        
                        // Check if buffer seems valid
                        if (fileBuffer.length === 0) {
                            throw new Error('Decoded buffer has zero length');
                        }
                    } catch (decodeError) {
                        console.error('Failed to decode base64 data:', decodeError);
                        console.error('First 100 chars of data:', value.data.substring(0, 100));
                        throw new Error(`Failed to decode base64 data: ${decodeError.message}`);
                    }
                    
                    // Try/catch specifically around file writing
                    try {
                        // Write directly to final destination
                        console.log(`Writing file to: ${targetPath}`);
                        await fs.writeFile(targetPath, fileBuffer);
                    } catch (writeError) {
                        console.error('Failed to write file:', writeError);
                        throw new Error(`Failed to write file to disk: ${writeError.message}`);
                    }
                    
                    // Verify file was written
                    try {
                        const stats = await fs.stat(targetPath);
                        console.log(`File written successfully: ${targetPath}, size: ${stats.size} bytes`);
                        
                        if (stats.size === 0) {
                            console.error('File was created but has zero size');
                            throw new Error('File was created but has zero size');
                        }
                    } catch (verifyError) {
                        console.error(`Failed to verify file: ${verifyError.message}`);
                        throw new Error(`Failed to verify file was written: ${verifyError.message}`);
                    }
                    
                    console.log(`File saved to ${targetPath}`);
                    return targetPath;
                } catch (error) {
                    console.error(`Error processing file upload: ${error.message}`);
                    console.error(error.stack);
                    throw new Error(`Failed to process file upload: ${error.message}`);
                }
            }
            
            // If we have a valid sourceFilePath, handle the file upload
            if (value.sourceFilePath && typeof value.sourceFilePath === 'string') {
                console.log(`Processing file upload with sourceFilePath: ${value.sourceFilePath}`);
                
                // Check if it's just a filename without path information
                if (!value.sourceFilePath.includes('/') && !value.sourceFilePath.includes('\\')) {
                    // This appears to be just a filename from client without path information
                    // We can't process this directly, but we should have received base64 data too
                    if (value.data) {
                        // We have base64 data, so we can handle it directly
                        console.log(`File ${value.sourceFilePath} has base64 data, processing...`);
                        
                        try {
                            // Ensure storage directory exists
                            await this._ensureStorageDir();
                            
                            // Generate a unique ID for the file
                            const fileId = crypto.randomUUID();
                            const originalFilename = value.sourceFilePath;
                            const extension = path.extname(originalFilename).toLowerCase();
                            
                            // Determine target filename
                            let targetFilename;
                            if (this.preserveFilename) {
                                targetFilename = `${fileId}-${originalFilename}`;
                            } else {
                                targetFilename = `${fileId}${extension}`;
                            }
                            
                            // Determine MIME type
                            let mimeType = value.mimeType || 'application/octet-stream';
                            
                            // Validate mime type if needed
                            if (this.allowedMimeTypes && !this.allowedMimeTypes.includes(mimeType)) {
                                throw new Error(`File type ${mimeType} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`);
                            }
                            
                            // Convert base64 to binary
                            const fileData = Buffer.from(value.data, 'base64');
                            
                            // Determine target file path (final destination)
                            const targetPath = path.join(this.storageDir, targetFilename);
                            
                            // Write directly to final destination
                            await fs.writeFile(targetPath, fileData);
                            
                            console.log(`File saved to ${targetPath}`);
                            return targetPath;
                        } catch (error) {
                            console.error(`Error processing file data: ${error.message}`);
                            throw new Error(`Failed to process file upload: ${error.message}`);
                        }
                    } else {
                        console.error('Invalid file upload: sourceFilePath is just a filename without path and no data provided');
                        throw new Error('Invalid file upload: File data is missing');
                    }
                }
                
                // If it's a full path, we can handle it as a server-side file path
                try {
                    // Check if the file exists
                    await fs.access(value.sourceFilePath);
                    
                    // Generate a unique ID for the file
                    const fileId = crypto.randomUUID();
                    const originalFilename = path.basename(value.sourceFilePath);
                    const extension = path.extname(originalFilename).toLowerCase();
                    
                    // Determine target filename
                    let targetFilename;
                    if (this.preserveFilename) {
                        targetFilename = `${fileId}-${originalFilename}`;
                    } else {
                        targetFilename = `${fileId}${extension}`;
                    }
                    
                    // Determine target file path
                    const targetPath = path.join(this.storageDir, targetFilename);
                    
                    // Copy the file to the storage directory
                    await fs.copyFile(value.sourceFilePath, targetPath);
                    
                    console.log(`File copied from ${value.sourceFilePath} to ${targetPath}`);
                    return targetPath;
                } catch (error) {
                    console.error(`Error accessing file at ${value.sourceFilePath}: ${error.message}`);
                    throw new Error(`Failed to access source file: ${error.message}`);
                }
            }
            
            // Handle objects with tempFile (from browser file input via _processFileForSave)
            if (value.tempFile) {
                console.log(`File upload contains tempFile but we need base64 data`);
                throw new Error('File upload format not supported. Expected base64 data to be included.');
            }
            
            // If we got here, we have an object but it doesn't match our expected format
            console.error('Invalid file object:', value);
            throw new Error(`Invalid file input object. Expected properties: sourceFilePath, clear, data, or action.`);
        }
        
        // If value is already a valid file path and exists on the server, return it
        if (typeof value === 'string') {
            // Empty string is treated as clearing the field
            if (value === '') {
                console.log('Clearing file field (empty string)');
                return null;
            }
            
            if (!value.includes('sourceFilePath')) {
                try {
                    // Try to access file to verify it exists
                    await fs.access(value);
                    // It exists, so just return the path
                    return value;
                } catch (error) {
                    // File doesn't exist at the specified path, continue with processing
                }
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
     * Custom getter logic: returns file metadata object for the file path
     *
     * @param {string} value - The stored file path
     * @returns {Object|null} File metadata object or null
     */
    async onGet(value) {
        console.log(`\n===== FileDiskField.onGet called with value: ${value} =====`);
        
        if (!value) {
            console.log("Value is null or empty, returning null");
            return null;
        }
        
        try {
            // Extract filename from path - handle both forward and backslashes
            const filename = path.basename(value);
            console.log(`Extracted filename: ${filename}`);
            
            // Determine mime type from extension
            const extension = path.extname(filename).toLowerCase();
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
            
            const mimeType = extension in mimeTypes ? mimeTypes[extension] : 'application/octet-stream';
            console.log(`Determined MIME type: ${mimeType} for extension ${extension}`);
            
            // Create a URL for the file that points to our HTTP server
            const httpUrl = `/uploads/${filename}`;
            console.log(`Generated HTTP URL: ${httpUrl}`);
            
            let fileSize = 0;
            let lastModified = new Date().getTime();
            
            // Check if file exists and get its stats
            try {
                console.log(`Checking if file exists at: ${value}`);
                await fs.access(value);
                
                // Get file stats
                const stats = await fs.stat(value);
                fileSize = stats.size;
                lastModified = stats.mtime.getTime();
                console.log(`File exists, size: ${fileSize} bytes, last modified: ${new Date(lastModified)}`);
            } catch (accessError) {
                console.warn(`File not found at ${value}: ${accessError.message}`);
                // Continue with default values
            }
            
            // Return metadata object - use client-expected property names
            const result = {
                path: value,               // The actual storage path
                name: filename,            // Field name expected by client is 'name' not 'filename'
                filename: filename,        // Keep filename for backward compatibility
                sourceFilePath: filename,  // Include sourceFilePath for client recognition
                size: fileSize,            // File size in bytes
                type: mimeType,            // Field name expected by client is 'type' not 'mimeType'
                mimeType: mimeType,        // Keep mimeType for backward compatibility
                lastModified: lastModified, // Last modified timestamp as milliseconds (client expects number)
                url: httpUrl               // URL to access the file via the HTTP server
            };
            
            console.log(`FileDiskField.onGet returning:`, result);
            return result;
        } catch (error) {
            console.error(`Error in FileDiskField.onGet:`, error);
            // If we encounter any error, still return basic information
            const filename = path.basename(value);
            return {
                path: value,
                name: filename,
                filename: filename,
                sourceFilePath: filename,
                size: 0,
                type: 'application/octet-stream',
                mimeType: 'application/octet-stream',
                url: `/uploads/${filename}`
            };
        }
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