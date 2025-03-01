import logger from '../lib/logger.js';

class Test {
    // Example method that could be called via a controller request
    static async performTest(testParam1, testParam2) {
        logger.info('Test controller called with params:', testParam1, testParam2);
        
        // Do some processing
        const result = {
            success: true,
            testResult: `Performed test with ${testParam1} and ${testParam2}`,
            timestamp: new Date().toISOString()
        };
        
        return result;
    }
    
    // Example welcome email method similar to your example
    static async sendWelcomeMail(body, subject) {
        logger.info('Sending welcome email');
        logger.info('Subject:', subject);
        logger.info('Body:', body);
        
        // In a real implementation, this would connect to an email service
        return {
            sent: true,
            messageId: `msg_${Date.now()}`,
            recipientCount: 1
        };
    }
}

export default Test;