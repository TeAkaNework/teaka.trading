import Stripe from 'stripe';
import { logger } from '../utils/logger.js';

export class StripeAuth {
  constructor(secretKey) {
    this.stripe = new Stripe(secretKey);
  }

  async checkSubscription(userId) {
    try {
      const subscriptions = await this.stripe.subscriptions.list({
        customer: userId,
        status: 'active'
      });

      return subscriptions.data.some(sub => 
        ['pro', 'alpha'].includes(sub.plan.nickname?.toLowerCase())
      );
    } catch (error) {
      logger.error('Error checking subscription:', error);
      return false;
    }
  }
}