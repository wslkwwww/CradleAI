const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

class LicenseService {
  constructor() {
    this.baseUrl = config.license.apiEndpoint;
    this.minCredits = config.license.minCredits;
    this.costPerSecond = config.license.costPerSecond;
    this.adminToken = config.license.adminToken;
  }

  /**
   * Check if the user has sufficient balance
   * @param {string} email - User's email
   * @returns {Promise<boolean>} - Whether user has sufficient balance
   */
  async hasSufficientBalance(email) {
    try {
      const balance = await this.getBalance(email);
      return balance >= this.minCredits;
    } catch (error) {
      logger.error(`Error checking balance for ${email}:`, error);
      // If we can't check balance, assume it's sufficient to avoid blocking users
      // You may want to change this behavior based on your business requirements
      return true;
    }
  }

  /**
   * Get the user's current balance
   * @param {string} email - User's email
   * @returns {Promise<number>} - User's balance
   */
  async getBalance(email) {
    try {
      const response = await axios.get(`${this.baseUrl}/balance/${encodeURIComponent(email)}`);
      
      if (response.data && typeof response.data.credits === 'number') {
        logger.info(`Balance for ${email}: ${response.data.credits} credits`);
        return response.data.credits;
      } else {
        logger.error(`Invalid balance response for ${email}:`, response.data);
        throw new Error('Invalid balance response format');
      }
    } catch (error) {
      logger.error(`Error getting balance for ${email}:`, error.message);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}, data:`, error.response.data);
      }
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Deduct credits from user's balance
   * @param {string} email - User's email
   * @param {number} amount - Amount to deduct
   * @returns {Promise<boolean>} - Whether deduction was successful
   */
  async deductCredits(email, amount) {
    try {
      logger.info(`Deducting ${amount} credits from ${email} with admin token`);
      
      const response = await axios.post(
        `${this.baseUrl}/deduct`, 
        {
          email,
          amount
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Admin-Token': this.adminToken
          }
        }
      );
      
      if (response.status === 200) {
        logger.info(`Successfully deducted ${amount} credits from ${email}, remaining: ${response.data.remaining_credits}`);
        return true;
      } else {
        logger.warn(`Unexpected response when deducting credits from ${email}:`, response.data);
        return false;
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        logger.error(`Authentication failed when deducting credits: Invalid admin token`);
      } else {
        logger.error(`Error deducting credits for ${email}:`, error.message);
        if (error.response) {
          logger.error(`Response status: ${error.response.status}, data:`, error.response.data);
        }
      }
      return false;
    }
  }

  /**
   * Calculate cost for a prediction based on runtime
   * @param {Object} metrics - Prediction metrics
   * @returns {number} - Cost amount
   */
  calculateCost(metrics) {
    if (!metrics || typeof metrics.predict_time !== 'number') {
      logger.warn('Invalid metrics for cost calculation:', metrics);
      // Default to minimum cost if metrics are missing
      return this.costPerSecond;
    }
    
    const cost = metrics.predict_time * this.costPerSecond;
    // Ensure minimum cost and round to 2 decimal places for currency
    return parseFloat((Math.max(cost, this.costPerSecond)).toFixed(2));
  }
}

module.exports = new LicenseService();
