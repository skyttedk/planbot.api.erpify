import { BaseInput } from "./base-input.js";

/**
 * File Input Component
 * Handles file upload inputs including image previews
 */
export class FileInput extends BaseInput {
    /**
     * Create a file input component
     * @param {Object} form - Parent form reference
     * @param {Object} fieldConfig - Field configuration
     */
    constructor(form, fieldConfig) {
        super(form, fieldConfig);

        // Default configuration
        this.showPreview = fieldConfig.showPreview !== false;
        this.acceptTypes = fieldConfig.accept || "";
        this.multiple = !!fieldConfig.multiple;
        this.maxSize = fieldConfig.maxSize || null;

        // File data storage
        this.fileData = null;
        this.fileName = null;

        // Create elements
        this.inputElement = this.createInputElement();
        this.applyCommonAttributes();
    }

    /**
     * Create the DOM element for this input
     * @returns {HTMLElement} The file input container
     */
    createInputElement() {
        // Create container
        const container = document.createElement("div");
        container.className = "file-input-container";
        container.style.width = "100%";

        // Create the actual file input
        this.fileInput = document.createElement("input");
        this.fileInput.type = "file";
        this.fileInput.id = this.field.name;
        this.fileInput.name = this.field.name;
        this.fileInput.className = "file-input-hidden";
        this.fileInput.style.display = "none";

        // Set accept attribute if specified
        if (this.acceptTypes) {
            this.fileInput.accept = this.acceptTypes;
        }

        // Set multiple attribute if needed
        if (this.multiple) {
            this.fileInput.multiple = true;
        }

        // Create custom button and display elements
        this.customButton = document.createElement("button");
        this.customButton.type = "button";
        this.customButton.className = "file-input-button";
        this.customButton.textContent = "Choose File";
        this.customButton.style.display = "inline-block";
        this.customButton.style.padding = "6px 12px";
        this.customButton.style.border = "1px solid #ccc";
        this.customButton.style.borderRadius = "4px";
        this.customButton.style.backgroundColor = "#f8f9fa";
        this.customButton.style.cursor = "pointer";

        // File name display
        this.fileNameDisplay = document.createElement("span");
        this.fileNameDisplay.className = "file-name-display";
        this.fileNameDisplay.textContent = "No file chosen";
        this.fileNameDisplay.style.marginLeft = "8px";
        this.fileNameDisplay.style.color = "#666";

        // Preview container (for images)
        if (this.showPreview) {
            this.previewContainer = document.createElement("div");
            this.previewContainer.className = "file-preview";
            this.previewContainer.style.marginTop = "8px";
            this.previewContainer.style.display = "none";
            this.previewContainer.style.maxWidth = "100%";

            this.previewImage = document.createElement("img");
            this.previewImage.style.maxWidth = "200px";
            this.previewImage.style.maxHeight = "150px";
            this.previewImage.style.border = "1px solid #ddd";
            this.previewImage.style.borderRadius = "4px";
            this.previewImage.style.padding = "2px";

            this.previewContainer.appendChild(this.previewImage);
        }

        // Error message display
        this.errorMessage = document.createElement("div");
        this.errorMessage.className = "file-error-message";
        this.errorMessage.style.color = "#dc3545";
        this.errorMessage.style.fontSize = "12px";
        this.errorMessage.style.marginTop = "4px";
        this.errorMessage.style.display = "none";

        // Assemble the elements
        container.appendChild(this.fileInput);
        container.appendChild(this.customButton);
        container.appendChild(this.fileNameDisplay);
        if (this.showPreview) {
            container.appendChild(this.previewContainer);
        }
        container.appendChild(this.errorMessage);

        return container;
    }

    /**
     * Set up event listeners for the file input
     * @param {Function} onChangeCallback - Called when file input changes
     */
    setupEventListeners(onChangeCallback) {
        if (!this.fileInput || !this.customButton || !onChangeCallback) return;

        // Custom button click triggers file input
        this.customButton.addEventListener("click", () => {
            this.fileInput.click();
        });

        // Handle file selection
        this.fileInput.addEventListener("change", (e) => {
            this.errorMessage.style.display = "none";

            const files = e.target.files;

            if (!files || files.length === 0) {
                this.fileNameDisplay.textContent = "No file chosen";
                if (this.showPreview) {
                    this.previewContainer.style.display = "none";
                }
                this.fileData = null;
                this.fileName = null;
                onChangeCallback(this.field.name, null);
                return;
            }

            const file = files[0]; // For now, we just handle the first file

            // Check file size if max size specified
            if (this.maxSize && file.size > this.maxSize) {
                this.errorMessage.textContent = `File is too large. Maximum size is ${this.formatSize(this.maxSize)}.`;
                this.errorMessage.style.display = "block";
                this.fileInput.value = "";
                this.fileNameDisplay.textContent = "No file chosen";
                if (this.showPreview) {
                    this.previewContainer.style.display = "none";
                }
                return;
            }

            // Update file name display
            this.fileNameDisplay.textContent = file.name;
            this.fileName = file.name;

            // Handle preview for images
            if (this.showPreview && file.type.startsWith("image/")) {
                const reader = new FileReader();

                reader.onload = (e) => {
                    this.previewImage.src = e.target.result;
                    this.previewContainer.style.display = "block";

                    // Store file data
                    this.fileData = e.target.result;

                    // Notify change
                    onChangeCallback(this.field.name, {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: e.target.result
                    });
                };

                reader.readAsDataURL(file);
            } else {
                // For non-image files
                const reader = new FileReader();

                reader.onload = (e) => {
                    // Store file data
                    this.fileData = e.target.result;

                    // Hide preview if it exists
                    if (this.showPreview) {
                        this.previewContainer.style.display = "none";
                    }

                    // Notify change
                    onChangeCallback(this.field.name, {
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: e.target.result
                    });
                };

                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * Update the file input value from record data
     * @param {Object} record - The record data
     */
    updateValue(record) {
        if (!this.fileNameDisplay || !record) return;

        const fileValue = record[this.field.name];

        if (!fileValue) {
            // No file data
            this.fileNameDisplay.textContent = "No file chosen";
            if (this.showPreview) {
                this.previewContainer.style.display = "none";
            }
            this.fileData = null;
            this.fileName = null;
            return;
        }

        // Handle different file value formats
        if (typeof fileValue === "string") {
            // Assume it's a file path or URL
            this.fileNameDisplay.textContent = this._extractFilenameFromPath(fileValue);
            this.fileName = this._extractFilenameFromPath(fileValue);

            if (this.showPreview && this._isImageFile(fileValue)) {
                this.previewImage.src = fileValue;
                this.previewContainer.style.display = "block";
            } else if (this.showPreview) {
                this.previewContainer.style.display = "none";
            }

            this.fileData = fileValue;
        } else if (typeof fileValue === "object") {
            // Handle object format (from FormData or FileReader)
            const fileName = fileValue.name || fileValue.fileName || "Unknown file";
            this.fileNameDisplay.textContent = fileName;
            this.fileName = fileName;

            if (fileValue.data && this.showPreview && this._isImageFile(fileName)) {
                this.previewImage.src = fileValue.data;
                this.previewContainer.style.display = "block";
            } else if (this.showPreview) {
                this.previewContainer.style.display = "none";
            }

            this.fileData = fileValue.data || fileValue;
        }
    }

    /**
     * Get the current file value from the input
     * @returns {Object|null} The file data object or null if no file
     */
    getValue() {
        if (!this.fileData) return null;

        return {
            name: this.fileName,
            data: this.fileData
        };
    }

    /**
     * Utility to format file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    formatSize(bytes) {
        const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
        if (bytes === 0) return "0 Bytes";
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        if (i === 0) return bytes + " " + sizes[i];
        return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
    }

    /**
     * Extract filename from a file path
     * @param {string} path - File path
     * @returns {string} Extracted filename
     */
    _extractFilenameFromPath(path) {
        if (!path) return "Unknown file";

        // Handle both slash types for paths
        const parts = path.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * Check if a file is an image based on extension
     * @param {string} filename - Filename or path
     * @returns {boolean} True if it's an image file
     */
    _isImageFile(filename) {
        if (!filename) return false;

        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp"];
        const lcFilename = filename.toLowerCase();

        return imageExtensions.some(ext => lcFilename.endsWith(ext)) ||
            lcFilename.includes("image/");
    }
}
