import logger from '../lib/logger.js';
import Resource from '../models/Resource.js';

/**
 * Controller for managing Resource entities
 * Provides CRUD operations and specialized resource handling
 */
class ResourceController {
    /**
     * Create a new resource
     * 
     * @param {string} type - Resource type (person, company, service, system)
     * @param {string} name - Name of the resource
     * @param {string} [title] - Title or prefix (optional)
     * @param {string} [number] - Reference number (optional)
     * @param {string} [email] - Email address (optional)
     * @param {string} [phone] - Phone number (optional)
     * @returns {Object} Created resource with success status
     */
    static async create(type, name, title, number, email, phone) {
        try {
            logger.info(`Creating new ${type} resource: ${name}`);
            
            // Create resource with provided fields
            const resource = await Resource.create({
                type,
                name,
                title,
                number,
                email,
                phone
            });
            
            return {
                success: true,
                message: `Resource created successfully`,
                resource: {
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    title: resource.title,
                    number: resource.number,
                    email: resource.email,
                    phone: resource.phone,
                    createdAt: resource.createdAt,
                    updatedAt: resource.updatedAt
                }
            };
        } catch (error) {
            logger.error('Error creating resource:', error);
            throw new Error(`Failed to create resource: ${error.message}`);
        }
    }
    
    /**
     * Get a resource by ID
     * 
     * @param {number} id - Resource ID
     * @returns {Object} Resource data with success status
     */
    static async get(id) {
        try {
            logger.info(`Fetching resource with ID: ${id}`);
            
            // Find resource by ID
            const resource = await Resource.findById(id);
            
            if (!resource) {
                return {
                    success: false,
                    message: `Resource with ID ${id} not found`
                };
            }
            
            return {
                success: true,
                resource: {
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    title: resource.title,
                    number: resource.number,
                    email: resource.email,
                    phone: resource.phone,
                    createdAt: resource.createdAt,
                    updatedAt: resource.updatedAt
                }
            };
        } catch (error) {
            logger.error(`Error fetching resource ID ${id}:`, error);
            throw new Error(`Failed to fetch resource: ${error.message}`);
        }
    }
    
    /**
     * Update an existing resource
     * 
     * @param {number} id - Resource ID to update
     * @param {string} [type] - Resource type (optional)
     * @param {string} [name] - Name of the resource (optional)
     * @param {string} [title] - Title or prefix (optional)
     * @param {string} [number] - Reference number (optional)
     * @param {string} [email] - Email address (optional)
     * @param {string} [phone] - Phone number (optional)
     * @returns {Object} Updated resource with success status
     */
    static async update(id, type, name, title, number, email, phone) {
        try {
            logger.info(`Updating resource with ID: ${id}`);
            
            // Build update object with only provided fields
            const updateData = {};
            if (type !== undefined) updateData.type = type;
            if (name !== undefined) updateData.name = name;
            if (title !== undefined) updateData.title = title;
            if (number !== undefined) updateData.number = number;
            if (email !== undefined) updateData.email = email;
            if (phone !== undefined) updateData.phone = phone;
            
            // Check if resource exists
            const existingResource = await Resource.findById(id);
            if (!existingResource) {
                return {
                    success: false,
                    message: `Resource with ID ${id} not found`
                };
            }
            
            // Update resource
            const updatedResource = await Resource.update(id, updateData);
            
            return {
                success: true,
                message: `Resource updated successfully`,
                resource: {
                    id: updatedResource.id,
                    type: updatedResource.type,
                    name: updatedResource.name,
                    title: updatedResource.title,
                    number: updatedResource.number,
                    email: updatedResource.email,
                    phone: updatedResource.phone,
                    createdAt: updatedResource.createdAt,
                    updatedAt: updatedResource.updatedAt
                }
            };
        } catch (error) {
            logger.error(`Error updating resource ID ${id}:`, error);
            throw new Error(`Failed to update resource: ${error.message}`);
        }
    }
    
    /**
     * Delete a resource
     * 
     * @param {number} id - Resource ID to delete
     * @returns {Object} Success status and deletion confirmation
     */
    static async delete(id) {
        try {
            logger.info(`Deleting resource with ID: ${id}`);
            
            // Check if resource exists
            const existingResource = await Resource.findById(id);
            if (!existingResource) {
                return {
                    success: false,
                    message: `Resource with ID ${id} not found`
                };
            }
            
            // Delete resource
            await Resource.delete(id);
            
            return {
                success: true,
                message: `Resource with ID ${id} deleted successfully`
            };
        } catch (error) {
            logger.error(`Error deleting resource ID ${id}:`, error);
            throw new Error(`Failed to delete resource: ${error.message}`);
        }
    }
    
    /**
     * List resources with optional filtering
     * 
     * @param {string} [type] - Filter by resource type (optional)
     * @param {string} [search] - Search term for name/email (optional)
     * @param {number} [limit=50] - Maximum number of results to return
     * @param {number} [offset=0] - Number of results to skip for pagination
     * @returns {Object} List of resources matching criteria
     */
    static async list(type, search, limit = 50, offset = 0) {
        try {
            logger.info(`Listing resources${type ? ` of type: ${type}` : ''}`);
            
            // Build query options
            const options = {
                where: {},
                limit: parseInt(limit, 10) || 50,
                offset: parseInt(offset, 10) || 0,
                orderBy: { column: 'createdAt', direction: 'DESC' }
            };
            
            // Add type filter if provided
            if (type) {
                options.where.type = type;
            }
            
            // Add search filter if provided (would need custom implementation in a real app)
            // Note: This is a simplistic approach - in a real application you'd implement
            // more sophisticated search through SQL LIKE or full-text search
            
            // Find resources with options
            const resources = await Resource.find(options);
            
            // Count total matching resources for pagination info
            const totalCount = await Resource.count({
                where: options.where
            });
            
            return {
                success: true,
                resources: resources.map(resource => ({
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    title: resource.title,
                    number: resource.number,
                    email: resource.email,
                    phone: resource.phone,
                    createdAt: resource.createdAt,
                    updatedAt: resource.updatedAt
                })),
                pagination: {
                    total: totalCount,
                    limit: options.limit,
                    offset: options.offset,
                    hasMore: totalCount > (options.offset + options.limit)
                }
            };
        } catch (error) {
            logger.error('Error listing resources:', error);
            throw new Error(`Failed to list resources: ${error.message}`);
        }
    }
    
    /**
     * Search resources by name, email, or number
     * 
     * @param {string} query - Search query
     * @param {string} [type] - Optional resource type filter
     * @param {number} [limit=20] - Maximum number of results
     * @returns {Object} Resources matching the search query
     */
    static async search(query, type, limit = 20) {
        try {
            if (!query || query.trim().length < 2) {
                return {
                    success: false,
                    message: 'Search query must be at least 2 characters'
                };
            }
            
            logger.info(`Searching resources with query: "${query}"`);
            
            // In a real implementation, you would use database-specific 
            // full-text search or LIKE queries. This is a simplified version
            // that loads and filters resources in memory.
            
            const options = {
                where: {},
                limit: 100 // Get a larger set for filtering
            };
            
            // Add type filter if provided
            if (type) {
                options.where.type = type;
            }
            
            // Get resources
            const resources = await Resource.find(options);
            
            // Filter resources that match the query in any searchable field
            const searchQuery = query.toLowerCase();
            const searchResults = resources.filter(resource => {
                return (
                    (resource.name && resource.name.toLowerCase().includes(searchQuery)) ||
                    (resource.email && resource.email.toLowerCase().includes(searchQuery)) ||
                    (resource.number && resource.number.toLowerCase().includes(searchQuery)) ||
                    (resource.phone && resource.phone.toLowerCase().includes(searchQuery))
                );
            });
            
            // Limit results
            const limitedResults = searchResults.slice(0, parseInt(limit, 10) || 20);
            
            return {
                success: true,
                query: query,
                resourceCount: limitedResults.length,
                resources: limitedResults.map(resource => ({
                    id: resource.id,
                    type: resource.type,
                    name: resource.name,
                    title: resource.title,
                    number: resource.number,
                    email: resource.email,
                    phone: resource.phone
                }))
            };
        } catch (error) {
            logger.error(`Error searching resources with query "${query}":`, error);
            throw new Error(`Failed to search resources: ${error.message}`);
        }
    }
}

export default ResourceController;