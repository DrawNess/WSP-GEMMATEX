import axios from 'axios';
import config from '../config/env.js';

class WhatsAppService {
  async sendMessage(to, body, messageId) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
            headers: {
                'Authorization': `Bearer ${config.API_TOKEN}`,
            },
            data: {
                messaging_product: 'whatsapp',
                to,
                text: { body },
                context: { message_id: messageId },
            }
        })
    } catch (error) {
        console.error('Error sending message to WhatsApp:', error.response?.data || error.message);
    }
  }

  async markAsRead(messageId) {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
            headers: {
                'Authorization': `Bearer ${config.API_TOKEN}`,
            },
            data: {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            }
        })
    } catch (error) {
        console.error('Error marking message as read:', error.response?.data || error.message);
    }
  }

  async sendInteractiveButtons(to, body, buttons) {
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: { text: body },
            action: {
                buttons: buttons
            }
        }
    };
    console.log('sendInteractiveButtons payload:', JSON.stringify(payload, null, 2));
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/${config.API_VERSION}/${config.BUSINESS_PHONE}/messages`,
            headers: {
                'Authorization': `Bearer ${config.API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: payload,
        })
    } catch (error) {
        console.error('Error sending interactive buttons:', error.response?.data || error.message);
    }
  }
}

export default new WhatsAppService();
