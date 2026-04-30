import whatsappService from './whatsapp.service.js';
/* import appendToSheet from './googleSheetsService.js';
import openAiService from './openAiService.js'; */

class MessageHandler {

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type !== 'text') return;
    const incomingMessage = message.text.body.toLowerCase().trim();

    if (this.isGreeting(incomingMessage)) {
      await this.sendWelcomeMessage(message.from, message.id);
    } else {
      const response = `Echo: ${message.text.body}`;
      await whatsappService.sendMessage(message.from, response, message.id);
    }
    await whatsappService.markAsRead(message.id);
  }

  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id;
  }

  async sendWelcomeMessage(to, messageId) {
    const welcomeMessage = `Hola, Bienvenido a GEMMATEX,` + `¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
  }
}

export default new MessageHandler();