import logger from './logger.js';

/**
 * Formats a PascalCase or camelCase string by adding spaces before capital letters
 * (except for the first letter of the string)
 * Example: "CustomerCard" becomes "Customer Card"
 * 
 * @param {string} str - The string to format
 * @returns {string} The formatted string
 */
function formatMenuItemName(str) {
    if (!str) return '';
    // Add a space before each capital letter (except the first one)
    return str.replace(/([A-Z])/g, (match, group, offset) => {
        return offset > 0 ? ' ' + group : group;
    });
}

/**
 * Builds a hierarchical menu structure from view definitions
 * 
 * @param {Object} views - All view definitions keyed by view name
 * @returns {Array} The built menu structure
 */
function buildMenuStructure(views) {
    logger.info('Building menu structure from views');
    
    // Initialize the root menu structure
    const menuStructure = [];
    
    // Track existing menu groups to avoid duplicates
    const menuGroups = {};
    
    // Process all views to build the menu
    Object.entries(views).forEach(([viewName, viewConfig]) => {
        // Skip views without menuLocation
        if (!Array.isArray(viewConfig)) {
            return;
        }
        
        // Process each window configuration in the view
        viewConfig.forEach(windowConfig => {
            const formConfig = windowConfig.formConfig;
            
            // Skip if no form config or no menuLocation
            if (!formConfig || !formConfig.menuLocation) {
                return;
            }
            
            // Get the menu path segments
            const menuPath = formConfig.menuLocation.split('.');
            
            // Skip invalid paths
            if (menuPath.length < 1) {
                logger.warn(`Invalid menu path for view ${viewName}: ${formConfig.menuLocation}`);
                return;
            }
            
            // Process the menu path
            let currentLevel = menuStructure;
            
            // Process all path segments except the last one (which is the menu item)
            for (let i = 0; i < menuPath.length - 1; i++) {
                const segment = menuPath[i];
                const formattedName = formatMenuItemName(segment);
                
                // Look for an existing menu group at this level
                let menuGroup = currentLevel.find(item => item.label === formattedName);
                
                // Create a new menu group if it doesn't exist
                if (!menuGroup) {
                    menuGroup = {
                        label: formattedName,
                        submenu: []
                    };
                    currentLevel.push(menuGroup);
                }
                
                // If submenu isn't defined, initialize it
                if (!menuGroup.submenu) {
                    menuGroup.submenu = [];
                }
                
                // Move to the next level
                currentLevel = menuGroup.submenu;
            }
            
            // Add the final menu item (the last segment in the path)
            const lastSegment = menuPath[menuPath.length - 1];
            const menuItemLabel = formatMenuItemName(lastSegment);
            
            // Add the menu item if it doesn't already exist
            if (!currentLevel.some(item => item.label === menuItemLabel)) {
                currentLevel.push({
                    label: menuItemLabel,
                    viewName: viewName
                });
            }
        });
    });
    
    logger.info(`Menu structure built with ${menuStructure.length} top-level items`);
    return menuStructure;
}

export { buildMenuStructure }; 