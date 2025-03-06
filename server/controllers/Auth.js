import logger from '../lib/logger.js';
import User from '../models/User.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Secret key for JWT tokens - should be moved to environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-for-jwt-tokens';
const TOKEN_EXPIRY = '24h'; // Token expiry time

/**
 * Authentication Controller
 * Handles user authentication operations like login, registration, and token validation
 */
class Auth {
    /**
     * User login method
     * Authenticates a user and returns a JWT token if successful
     * 
     * @param {string} username - The username to authenticate
     * @param {string} password - The password to verify
     * @returns {Object} Authentication result with token if successful
     */
    static async login(username, password) {
        try {
            logger.info(`Login attempt for user: ${username}`);
            
            // Get the password field to hash the password
            const passwordField = User.fields.password;
            
            // Hash the password before querying
            const hashedPassword = await passwordField.hashPassword(password);
            
            // Find user by username and password in a single query
            const user = await User.findOne({ 
                where: { 
                    username: username,
                    password: hashedPassword
                }
            });
            
            // If no user found with that username and password
            if (!user) {
                logger.warn(`Login failed: Invalid credentials for username: ${username}`);
                return {
                    success: false,
                    message: 'Invalid username or password'
                };
            }
            
            // Check if user is active
            if (user.isActive === false) {
                logger.warn(`Login attempt for inactive user: ${username}`);
                return {
                    success: false,
                    message: 'Account is inactive. Please contact an administrator.'
                };
            }
            
            // Update last login timestamp
            await User.update(user.id, { 
                lastLoginDate: new Date() 
            });
            
            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.id,
                    username: user.username,
                    isAdmin: user.isAdmin
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );
            
            logger.info(`User ${username} logged in successfully`);
            
            return {
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            };
        } catch (error) {
            logger.error(`Login error: ${error.message}`, error);
            return {
                success: false,
                message: 'An error occurred during login'
            };
        }
    }
    
    /**
     * User registration method
     * Creates a new user account
     * 
     * @param {string} username - The username for the new account
     * @param {string} password - The password for the new account
     * @param {string} email - The email address for the new account
     * @param {string} name - The user's full name
     * @returns {Object} Registration result
     */
    static async register(username, password, email, name = '') {
        try {
            logger.info(`Registration attempt for username: ${username}`);
            
            // Check if username already exists using findOne
            const existingUser = await User.findOne({ 
                where: { username }
            });
            
            if (existingUser) {
                return {
                    success: false,
                    message: 'Username already exists'
                };
            }
            
            // Check if email already exists using findOne
            const existingEmail = await User.findOne({ 
                where: { email }
            });
            
            if (existingEmail) {
                return {
                    success: false,
                    message: 'Email already in use'
                };
            }
            
            // Create the new user
            const newUser = await User.create({
                username,
                password, // Will be hashed by the PasswordField
                email,
                name,
                isAdmin: false, // Default to regular user
                isActive: true,
                lastLoginDate: null
            });
            
            logger.info(`User registered successfully: ${username}`);
            
            // Generate JWT token for immediate login
            const token = jwt.sign(
                { 
                    userId: newUser.id,
                    username: newUser.username,
                    isAdmin: newUser.isAdmin
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );
            
            return {
                success: true,
                message: 'Registration successful',
                token,
                user: {
                    id: newUser.id,
                    username: newUser.username,
                    name: newUser.name,
                    email: newUser.email,
                    isAdmin: newUser.isAdmin
                }
            };
        } catch (error) {
            logger.error(`Registration error: ${error.message}`, error);
            return {
                success: false,
                message: error.message || 'An error occurred during registration'
            };
        }
    }
    
    /**
     * Verifies a JWT token
     * 
     * @param {string} token - The JWT token to verify
     * @returns {Object} Verification result
     */
    static async verifyToken(token) {
        try {
            if (!token) {
                return {
                    success: false,
                    message: 'No token provided'
                };
            }
            
            // Verify the token
            const decoded = jwt.verify(token, JWT_SECRET);
            
            // Check if the user still exists and is active using findOne
            const user = await User.findOne({ 
                where: { id: decoded.userId }
            });
            
            if (!user) {
                return {
                    success: false,
                    message: 'User not found'
                };
            }
            
            if (user.isActive === false) {
                return {
                    success: false,
                    message: 'User account is inactive'
                };
            }
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            };
        } catch (error) {
            logger.error(`Token verification error: ${error.message}`);
            return {
                success: false,
                message: 'Invalid or expired token'
            };
        }
    }
    
    /**
     * Refreshes a user's token
     * 
     * @param {string} token - The current token to refresh
     * @returns {Object} Refresh result with new token
     */
    static async refreshToken(token) {
        try {
            const verification = await Auth.verifyToken(token);
            
            if (!verification.success) {
                return verification;
            }
            
            const user = verification.user;
            
            // Generate a new token
            const newToken = jwt.sign(
                { 
                    userId: user.id,
                    username: user.username,
                    isAdmin: user.isAdmin
                },
                JWT_SECRET,
                { expiresIn: TOKEN_EXPIRY }
            );
            
            return {
                success: true,
                token: newToken,
                user
            };
        } catch (error) {
            logger.error(`Token refresh error: ${error.message}`);
            return {
                success: false,
                message: 'Failed to refresh token'
            };
        }
    }
}

export default Auth; 