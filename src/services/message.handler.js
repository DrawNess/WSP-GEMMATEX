import whatsappService from './whatsapp.service.js';
/* import appendToSheet from './googleSheetsService.js';
import openAiService from './openAiService.js'; */

class MessageHandler {

  async handleIncomingMessage(message, senderInfo) {
    if (message?.type === 'text'){
      const incomingMessage = message.text.body.toLowerCase().trim();
  
      if (this.isGreeting(incomingMessage)) {
        await this.sendWelcomeMessage(message.from, message.id, senderInfo);
        await this.sendWelcomeMenu(message.from);
      } else {
        const response = `Echo: ${message.text.body}`;
        await whatsappService.sendMessage(message.from, response, message.id);
      }
      await whatsappService.markAsRead(message.id);

    } else if(message?.type === 'interactive') {
      const option = message.interactive?.button_reply?.id.toLowerCase().trim();
      await this.handleMenuOption(message.from, option);
      await whatsappService.markAsRead(message.id);
    }
  }

  isGreeting(message) {
    const greetings = ["hola", "hello", "hi", "buenas tardes"];
    return greetings.includes(message);
  }

  getSenderName(senderInfo) {
    return senderInfo.profile?.name || senderInfo.wa_id || 'Usuario';
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    const welcomeMessage = `Hola ${name}, Bienvenido a GEMMATEX,` + `¿En qué puedo ayudarte hoy?`;
    await whatsappService.sendMessage(to, welcomeMessage, messageId);
  }

  async sendWelcomeMenu(to){
    const menuMessage = "Por favor, elige una opción:\n1. Ver productos\n2. Contactar soporte\n3. Horarios de atención";
    const buttons = [
      { type: 'reply', reply: { id: 'option_1', title: 'Ver productos' } },
      { type: 'reply', reply: { id: 'option_2', title: 'Contactar soporte' } },
      { type: 'reply', reply: { id: 'option_3', title: 'Horarios de atención' } },
    ];
    await whatsappService.sendInteractiveButtons(to, menuMessage, buttons);
  }

  async handleMenuOption(to, option) {
    let response;
    switch (option) {
      case 'option_1':
        response = 'Aquí están nuestros productos...';
        break;
      case 'option_2':
        response = 'Puedes contactar a nuestro soporte en aqui'
        break;
      case 'option_3':
        response = 'Nuestros horarios de atención son...';
        break;
      default:
        response = 'Lo siento, no entendí esa opción. Por favor, elige una opción válida.';
    }
    await whatsappService.sendMessage(to, response);
  }
}

export default new MessageHandler();