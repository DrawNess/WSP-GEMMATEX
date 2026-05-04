import whatsappService from './whatsapp.service.js';
import sessionStore from './session.store.js';
import gemmatexApi from './gemmatex.api.js';

const SUPPORT_TEXT =
  `*Soporte Técnico GEMMATEX* 🔧\n\n` +
  `📞 +591 62537378\n` +
  `🖥 soporte.gemmatex.com.bo\n\n` +
  `Para abrir un ticket ingresa a nuestra plataforma web.\n\n` +
  `📍 *Sucursales:*\n` +
  `▸ La Paz: +591 71926087\n` +
  `▸ Cochabamba: +591 78859336\n` +
  `▸ Santa Cruz: +591 78346372\n` +
  `▸ El Alto Satélite: +591 69750231\n` +
  `▸ El Alto Ceibo: +591 67017253\n\n` +
  `www.gemmatex.com.bo`;

const HOURS_TEXT =
  `🕘 *Horario de atención:*\n` +
  `▸ Lun–Vie: 8:40–13:00 y 14:00–18:30\n` +
  `▸ Sábados: 8:40–13:00\n\n` +
  `Para registrar tu ticket de atención ingresa a:\n` +
  `🖥 soporte.gemmatex.com.bo\n\n` +
  `Para consultas urgentes, contacta nuestras sucursales:\n\n` +
  `📍 *Sucursales:*\n` +
  `▸ La Paz: +591 71926087\n` +
  `▸ Cochabamba: +591 78859336\n` +
  `▸ Santa Cruz: +591 78346372\n` +
  `▸ El Alto Satélite: +591 69750231\n` +
  `▸ El Alto Ceibo: +591 67017253`;

class MessageHandler {

  async handleIncomingMessage(message, senderInfo) {
    const { from, id: messageId, type } = message;
    await whatsappService.markAsRead(messageId);

    if (type === 'text') {
      const body = message.text.body.toLowerCase().trim();
      if (this.isGreeting(body)) {
        await this.sendWelcomeMessage(from, messageId, senderInfo);
        return;
      }
      // Cualquier texto fuera de saludo → redirigir al menú
      await whatsappService.sendMessage(from, 'Por favor, elige una opción del menú 👇');
      await this.sendMainMenu(from);
      return;
    }

    if (type === 'interactive') {
      const interactiveType = message.interactive?.type;

      if (interactiveType === 'button_reply') {
        const optionId = message.interactive.button_reply.id;
        await this.handleButtonReply(from, optionId);
        return;
      }

      if (interactiveType === 'list_reply') {
        const optionId = message.interactive.list_reply.id;
        await this.handleListReply(from, optionId);
        return;
      }
    }
  }

  isGreeting(message) {
    const greetings = ['hola', 'hello', 'hi', 'buenas', 'buenas tardes', 'buenas noches', 'buenos dias', 'buenos días', 'buen dia', 'buen día', 'buenas mañanas', 'inicio', 'start', 'menu', 'menú'];
    return greetings.some(g => message.includes(g));
  }

  getSenderName(senderInfo) {
    return senderInfo?.profile?.name || 'Cliente';
  }

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    await whatsappService.sendMessage(
      to,
      `👋 Hola *${name}*, bienvenido/a a *GEMMATEX*.\n¿En qué te puedo ayudar hoy?`,
      messageId
    );
    await this.sendMainMenu(to);
    sessionStore.updateSession(to, { state: 'main_menu' });
  }

  async sendMainMenu(to) {
    const buttons = [
      { type: 'reply', reply: { id: 'menu_products', title: '🛍 Ver Productos' } },
      { type: 'reply', reply: { id: 'menu_support', title: '🔧 Soporte Técnico' } },
      { type: 'reply', reply: { id: 'menu_hours', title: '🕘 Horarios' } },
    ];
    await whatsappService.sendInteractiveButtons(to, 'Selecciona una opción:', buttons);
  }

  // ─── Button replies (menú principal + acciones de producto) ───────────────

  async handleButtonReply(to, optionId) {
    switch (optionId) {
      case 'menu_products':
        await this.sendCategoriesList(to);
        break;
      case 'menu_support':
        await whatsappService.sendMessage(to, SUPPORT_TEXT);
        await this.sendMainMenu(to);
        break;
      case 'menu_hours':
        await whatsappService.sendMessage(to, HOURS_TEXT);
        await this.sendMainMenu(to);
        break;
      case 'action_back_menu':
        sessionStore.updateSession(to, { state: 'main_menu' });
        await this.sendMainMenu(to);
        break;
      case 'action_next_page': {
        const session = sessionStore.getSession(to);
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page + 1);
        break;
      }
      case 'action_prev_page': {
        const session = sessionStore.getSession(to);
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page - 1);
        break;
      }
      case 'action_back_products': {
        const session = sessionStore.getSession(to);
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page);
        break;
      }
      case 'action_consult': {
        await whatsappService.sendMessage(to, SUPPORT_TEXT);
        await this.sendMainMenu(to);
        break;
      }
      default:
        await this.sendMainMenu(to);
    }
  }

  // ─── List replies (categorías, subcategorías, productos) ─────────────────

  async handleListReply(to, optionId) {
    if (optionId.startsWith('cat_')) {
      const categoryId = parseInt(optionId.replace('cat_', ''));
      await this.sendSubcategoriesList(to, categoryId);
      return;
    }

    if (optionId.startsWith('sub_')) {
      const subcategoryId = parseInt(optionId.replace('sub_', ''));
      const subcategories = await gemmatexApi.getSubcategories();
      const sub = subcategories.find(s => s.id === subcategoryId);
      await this.sendProductsList(to, subcategoryId, sub?.name || '', 1);
      return;
    }

    if (optionId.startsWith('prod_')) {
      const productId = parseInt(optionId.replace('prod_', ''));
      await this.sendProductDetail(to, productId);
      return;
    }
  }

  // ─── Categorías ──────────────────────────────────────────────────────────

  async sendCategoriesList(to) {
    const categories = await gemmatexApi.getCategories();
    const rows = categories.map(c => ({
      id: `cat_${c.id}`,
      title: c.name,
      description: c.description?.slice(0, 72) || '',
    }));

    sessionStore.updateSession(to, { state: 'categories' });
    await whatsappService.sendListMessage(
      to,
      '🗂 Elige una categoría para ver los productos:',
      'Ver categorías',
      [{ title: 'Categorías', rows }]
    );
  }

  // ─── Subcategorías ───────────────────────────────────────────────────────

  async sendSubcategoriesList(to, categoryId) {
    const [categories, subcats] = await Promise.all([
      gemmatexApi.getCategories(),
      gemmatexApi.getSubcategoriesByCategory(categoryId),
    ]);
    const cat = categories.find(c => c.id === categoryId);

    const rows = subcats.map(s => ({
      id: `sub_${s.id}`,
      title: s.name,
      description: s.description?.slice(0, 72) || '',
    }));

    sessionStore.updateSession(to, { state: 'subcategories', categoryId, categoryName: cat?.name });
    await whatsappService.sendListMessage(
      to,
      `📦 *${cat?.name}* — Elige una subcategoría:`,
      'Ver subcategorías',
      [{ title: cat?.name || 'Subcategorías', rows }]
    );
  }

  // ─── Lista de productos ──────────────────────────────────────────────────

  async sendProductsList(to, subcategoryId, subcategoryName, page) {
    const result = await gemmatexApi.getProductsBySubcategory(subcategoryId, page);
    const { data: products, meta } = result;

    if (!products || products.length === 0) {
      await whatsappService.sendMessage(to, 'No hay productos disponibles en esta categoría.');
      await this.sendMainMenu(to);
      return;
    }

    sessionStore.updateSession(to, {
      state: 'product_list',
      subcategoryId,
      subcategoryName,
      page: meta.page,
      totalPages: meta.totalPages,
    });

    const rows = products.map(p => ({
      id: `prod_${p.id}`,
      title: p.name.slice(0, 24),
      description: p.brand || '',
    }));

    const pageInfo = meta.totalPages > 1 ? ` (pág. ${meta.page}/${meta.totalPages})` : '';
    await whatsappService.sendListMessage(
      to,
      `🛍 *${subcategoryName}*${pageInfo}\nElige un producto para ver detalles:`,
      'Ver productos',
      [{ title: subcategoryName.slice(0, 24), rows }]
    );

    // Botones de paginación + volver
    const navButtons = [];
    if (meta.hasPrevPage) navButtons.push({ type: 'reply', reply: { id: 'action_prev_page', title: '⬅ Anterior' } });
    if (meta.hasNextPage) navButtons.push({ type: 'reply', reply: { id: 'action_next_page', title: 'Siguiente ➡' } });
    navButtons.push({ type: 'reply', reply: { id: 'action_back_menu', title: '🏠 Menú principal' } });

    await whatsappService.sendInteractiveButtons(to, 'Navegación:', navButtons.slice(0, 3));
  }

  // ─── Detalle de producto ─────────────────────────────────────────────────

  async sendProductDetail(to, productId) {
    const product = await gemmatexApi.getProduct(productId);
    const variant = product.variants?.[0];

    const price = variant?.price
      ? `💰 *Precio:* Bs. ${parseFloat(variant.price).toLocaleString('es-BO')}`
      : '';
    const discount = variant?.discountPrice && parseFloat(variant.discountPrice) > 0
      ? `🏷 *Precio especial:* Bs. ${parseFloat(variant.discountPrice).toLocaleString('es-BO')}`
      : '';
    const stock = variant?.stock != null ? `📦 *Stock:* ${variant.stock} ${variant.unitOfMeasure || 'unidades'}` : '';
    const sku = variant?.sku ? `🔖 *SKU:* ${variant.sku}` : '';
    const description = variant?.shortDescription || variant?.description || product.subcategory?.description || '';

    const text = [
      `*${product.name}*`,
      `🏷 ${product.brand}`,
      '',
      description,
      '',
      price,
      discount,
      stock,
      sku,
    ].filter(Boolean).join('\n');

    // Enviar imagen si existe
    if (variant?.imageUrl || product.imageUrl) {
      await whatsappService.sendMediaMessage(
        to,
        'image',
        variant?.imageUrl || product.imageUrl,
        product.name
      );
    }

    await whatsappService.sendMessage(to, text);

    // Acciones post-detalle
    const buttons = [
      { type: 'reply', reply: { id: 'action_consult', title: '📞 Consultar' } },
      { type: 'reply', reply: { id: 'action_back_products', title: '⬅ Más productos' } },
      { type: 'reply', reply: { id: 'action_back_menu', title: '🏠 Menú principal' } },
    ];
    await whatsappService.sendInteractiveButtons(to, '¿Qué deseas hacer?', buttons);

    sessionStore.updateSession(to, { state: 'product_detail' });
  }
}

export default new MessageHandler();
