import whatsappService from './whatsapp.service.js';
import sessionStore from './session.store.js';
import gemmatexApi from './gemmatex.api.js';
import llmService from './llm.service.js';
import config from '../config/env.js';

const HISTORY_LIMIT = 10;

const SUPPORT_TEXT =
  `*Soporte Tecnico GEMMATEX*\n\n` +
  `*Tel:* +591 62537378\n` +
  `*Web:* soporte.gemmatex.com.bo\n\n` +
  `Para abrir un ticket formal, ingresa a la plataforma web.\n\n` +
  `Ver todos los productos y precios en: www.gemmatex.com.bo`;

const SALES_TEXT =
  `Para compras y consultas de ventas, visita cualquiera de nuestras sucursales o escribenos por WhatsApp:\n\n` +
  `*Casa Matriz - LA PAZ*\n` +
  `Av. Illampu esq. Graneros N. 682\n` +
  `WhatsApp: +591 71926087\n` +
  `Lun-Vie: 8:40-12:45 y 14:00-18:10 | Sab: 8:40-12:45\n` +
  `Maps: https://goo.gl/maps/do7Hp1SowhjupSrX6\n\n` +
  `*Sucursal - COCHABAMBA*\n` +
  `Av. Aroma entre calle 16 de Julio y Av. Oquendo\n` +
  `WhatsApp: +591 78859336\n` +
  `Lun-Vie: 8:40-13:00 y 14:00-18:30 | Sab: 8:40-12:50\n` +
  `Maps: https://maps.app.goo.gl/YjqQhsZbnFX9Ra3L6\n\n` +
  `*Sucursal - EL ALTO (Ceibo)*\n` +
  `Zona 16 de Julio, Calle Rene Dorado N. 200\n` +
  `WhatsApp: +591 67017253\n` +
  `Lun-Vie: 9:10-13:00 y 13:30-18:20 | Sab: 8:40-12:50\n` +
  `Maps: https://goo.gl/maps/EyVSdMvaQMJREoWF6\n\n` +
  `*Sucursal - EL ALTO (Ciudad Satelite)*\n` +
  `Av. Panoramica, frente al canal RTP, cerca del Teleferico Plateado\n` +
  `WhatsApp: +591 69750231\n` +
  `Lun-Vie: 9:10-13:00 y 13:30-18:20 | Sab: 8:40-12:50\n` +
  `Maps: https://maps.app.goo.gl/VKqJrsZMCApKYFWg8\n\n` +
  `*Sucursal - SANTA CRUZ*\n` +
  `Calle Isabela Catolica casi Canoto, lado Kaywasi N. 275\n` +
  `WhatsApp: +591 78346372\n` +
  `Lun-Vie: 8:40-12:30 y 13:40-18:30 | Sab: 8:40-13:00\n` +
  `Maps: https://maps.app.goo.gl/yY53LgRFoKRL6CPE6\n\n` +
  `Tambien puedes ver todos nuestros productos y precios en:\n` +
  `www.gemmatex.com.bo\n\n` +
  `Realizamos envios a todo el pais. Para coordinar tu envio, contacta a la sucursal mas cercana.`;

const HOURS_TEXT =
  `*Horario de atencion:*\n\n` +
  `*La Paz (Illampu):* Lun-Vie 8:40-12:45 y 14:00-18:10 | Sab 8:40-12:45\n` +
  `*Cochabamba:* Lun-Vie 8:40-13:00 y 14:00-18:30 | Sab 8:40-12:50\n` +
  `*El Alto (Ceibo y Satelite):* Lun-Vie 9:10-13:00 y 13:30-18:20 | Sab 8:40-12:50\n` +
  `*Santa Cruz:* Lun-Vie 8:40-12:30 y 13:40-18:30 | Sab 8:40-13:00\n\n` +
  `Para soporte tecnico: soporte.gemmatex.com.bo\n` +
  `Ver productos y precios: www.gemmatex.com.bo`;

const GREETINGS = [
  'hola', 'hello', 'hi', 'buenas', 'buenas tardes', 'buenas noches',
  'buenos dias', 'buenos días', 'buen dia', 'buen día', 'buenas mañanas',
  'inicio', 'start', 'menu', 'menú',
];

class MessageHandler {

  // ─── Entry point ──────────────────────────────────────────────────────────

  async handleIncomingMessage(message, senderInfo) {
    const { from, id: messageId, type } = message;
    await whatsappService.markAsRead(messageId);

    const session = sessionStore.getSession(from);

    if (type === 'text') {
      const body = message.text.body.toLowerCase().trim();

      // Cotizacion activa — todo texto va al flujo de cotizacion
      if (session.quoteStep) {
        await this.processQuoteStep(from, message.text.body, session);
        return;
      }

      // Saludo puro o primer mensaje
      if (session.state === 'idle' || this.isGreeting(body)) {
        await this.sendWelcomeMessage(from, messageId, senderInfo);
        // Si habia contenido ademas del saludo, procesarlo
        const extra = this.stripGreeting(body);
        if (extra.length > 2) {
          const fresh = sessionStore.getSession(from);
          await this.handleFreeText(from, extra, fresh);
        }
        return;
      }

      await this.handleFreeText(from, message.text.body, session);
      return;
    }

    if (type === 'interactive') {
      const iType = message.interactive?.type;
      if (iType === 'button_reply') {
        await this.handleButtonReply(from, message.interactive.button_reply.id, session);
        return;
      }
      if (iType === 'list_reply') {
        await this.handleListReply(from, message.interactive.list_reply.id);
        return;
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  isGreeting(body) {
    return GREETINGS.some(g => body.includes(g));
  }

  stripGreeting(body) {
    let result = body;
    const sorted = [...GREETINGS].sort((a, b) => b.length - a.length);
    for (const g of sorted) {
      result = result.replace(g, ' ');
    }
    return result.replace(/[?!.,]/g, '').replace(/\s+/g, ' ').trim();
  }

  getSenderName(senderInfo) {
    return senderInfo?.profile?.name || 'Cliente';
  }

  buildSearchContext(products) {
    return products.slice(0, 5).map(p => {
      const v = p.variants?.[0];
      const parts = [`Producto: ${p.name}`];
      if (p.brand) parts.push(`Marca: ${p.brand}`);
      if (v?.shortDescription || v?.description) parts.push(v.shortDescription || v.description);
      if (v?.price) parts.push(`Precio: Bs. ${parseFloat(v.price).toLocaleString('es-BO')}`);
      if (v?.stock != null) parts.push(`Stock: ${v.stock}`);
      return parts.join(' | ');
    }).join('\n');
  }

  formatPrice(product) {
    const v = product.variants?.[0];
    const price = parseFloat(v?.price || 0);
    const discount = parseFloat(v?.discountPrice || 0);
    const effective = discount > 0 && discount < price ? discount : price;
    const stock = v?.stock ?? null;
    const priceStr = effective > 0 ? `Bs. ${effective.toLocaleString('es-BO')}` : 'Precio a consultar';
    const stockStr = stock != null ? ` — ${stock} en stock` : '';
    return `*${product.name}*\n${priceStr}${stockStr}`;
  }

  // ─── Bienvenida ───────────────────────────────────────────────────────────

  async sendWelcomeMessage(to, messageId, senderInfo) {
    const name = this.getSenderName(senderInfo);
    await whatsappService.sendMessage(
      to,
      `Hola *${name}*, bienvenido/a a *GEMMATEX*.\n¿En que te puedo ayudar hoy?`,
      messageId
    );
    await this.sendMainMenu(to);
    sessionStore.updateSession(to, { state: 'main_menu', history: [], quoteStep: null, quote: {} });
  }

  async sendMainMenu(to) {
    const buttons = [
      { type: 'reply', reply: { id: 'menu_products', title: 'Ver Productos' } },
      { type: 'reply', reply: { id: 'menu_support', title: 'Soporte Tecnico' } },
      { type: 'reply', reply: { id: 'menu_hours', title: 'Horarios' } },
    ];
    await whatsappService.sendInteractiveButtons(to, 'Selecciona una opcion:', buttons);
  }

  // ─── Texto libre ──────────────────────────────────────────────────────────

  async handleFreeText(to, userMessage, session) {
    await whatsappService.sendMessage(to, 'Un momento...');

    // LLM extrae keyword del producto mencionado
    const keyword = await llmService.extractKeyword(userMessage);

    if (keyword) {
      await this.searchAndShow(to, keyword, session);
    } else if (session.lastKeyword) {
      // Sin keyword nueva pero hay una anterior — mismo contexto de producto
      await this.searchAndShow(to, session.lastKeyword, session);
    } else {
      // Sin keyword nueva — LLM responde con contexto de productos si existe
      const reply = await llmService.chat(userMessage, session.searchContext || '', session.history);
      await whatsappService.sendMessage(
        to,
        reply || 'No entendi tu consulta. Contacta a soporte: +591 62537378'
      );
      const newHistory = [
        ...session.history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: reply || '' },
      ].slice(-HISTORY_LIMIT);
      sessionStore.updateSession(to, { history: newHistory });
      await this.sendMainMenu(to);
    }
  }

  async searchAndShow(to, keyword, session) {
    const result = await gemmatexApi.searchProducts(keyword);
    const products = result?.data || [];

    const searchContext = products.length ? this.buildSearchContext(products) : null;
    sessionStore.updateSession(to, { lastKeyword: keyword, searchContext });

    if (!products.length) {
      await whatsappService.sendMessage(
        to,
        `No encontre "${keyword}" en nuestro catalogo.\n\nPuedes ver todos nuestros productos en *www.gemmatex.com.bo* o contactar a una sucursal:`
      );
      await whatsappService.sendMessage(to, SALES_TEXT);
      await this.sendMainMenu(to);
      return;
    }

    // Precios directo desde la API — sin LLM
    const lines = products.slice(0, 5).map(p => this.formatPrice(p));
    await whatsappService.sendMessage(to, lines.join('\n\n'));

    if (products.length === 1) {
      await this.sendProductDetail(to, products[0].id);
    } else {
      const rows = products.slice(0, 8).map(p => ({
        id: `prod_${p.id}`,
        title: p.name.slice(0, 24),
        description: p.brand || '',
      }));
      await whatsappService.sendListMessage(
        to,
        'Elige un producto para ver mas detalles:',
        'Ver productos',
        [{ title: 'Resultados', rows }]
      );
      sessionStore.updateSession(to, { state: 'product_list' });
    }
  }

  // ─── Button replies ───────────────────────────────────────────────────────

  async handleButtonReply(to, optionId, session) {
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
        sessionStore.updateSession(to, { state: 'main_menu', quoteStep: null, quote: {} });
        await this.sendMainMenu(to);
        break;
      case 'action_next_page':
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page + 1);
        break;
      case 'action_prev_page':
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page - 1);
        break;
      case 'action_back_products':
        await this.sendProductsList(to, session.subcategoryId, session.subcategoryName, session.page);
        break;
      case 'action_cotizar':
        await this.startQuoteFlow(to, session);
        break;
      default:
        await this.sendMainMenu(to);
    }
  }

  // ─── List replies ─────────────────────────────────────────────────────────

  async handleListReply(to, optionId) {
    if (optionId.startsWith('cat_')) {
      await this.sendSubcategoriesList(to, parseInt(optionId.replace('cat_', '')));
      return;
    }
    if (optionId.startsWith('sub_')) {
      const subcategoryId = parseInt(optionId.replace('sub_', ''));
      const subs = await gemmatexApi.getSubcategories();
      const sub = subs.find(s => s.id === subcategoryId);
      await this.sendProductsList(to, subcategoryId, sub?.name || '', 1);
      return;
    }
    if (optionId.startsWith('prod_')) {
      await this.sendProductDetail(to, parseInt(optionId.replace('prod_', '')));
      return;
    }
  }

  // ─── Navegacion catalogo ──────────────────────────────────────────────────

  async sendCategoriesList(to) {
    const categories = await gemmatexApi.getCategories();
    const rows = categories.map(c => ({
      id: `cat_${c.id}`,
      title: c.name.slice(0, 24),
      description: c.description?.slice(0, 72) || '',
    }));
    sessionStore.updateSession(to, { state: 'categories' });
    await whatsappService.sendListMessage(
      to, 'Elige una categoria para ver los productos:', 'Ver categorias',
      [{ title: 'Categorias', rows }]
    );
  }

  async sendSubcategoriesList(to, categoryId) {
    const [categories, subcats] = await Promise.all([
      gemmatexApi.getCategories(),
      gemmatexApi.getSubcategoriesByCategory(categoryId),
    ]);
    const cat = categories.find(c => c.id === categoryId);
    const rows = subcats.map(s => ({
      id: `sub_${s.id}`,
      title: s.name.slice(0, 24),
      description: s.description?.slice(0, 72) || '',
    }));
    sessionStore.updateSession(to, { state: 'subcategories', categoryId, categoryName: cat?.name });
    await whatsappService.sendListMessage(
      to, `*${cat?.name}* - Elige una subcategoria:`, 'Ver subcategorias',
      [{ title: (cat?.name || 'Subcategorias').slice(0, 24), rows }]
    );
  }

  async sendProductsList(to, subcategoryId, subcategoryName, page) {
    const result = await gemmatexApi.getProductsBySubcategory(subcategoryId, page);
    const { data: products, meta } = result;

    if (!products?.length) {
      await whatsappService.sendMessage(to, 'No hay productos en esta categoria.');
      await this.sendMainMenu(to);
      return;
    }

    sessionStore.updateSession(to, {
      state: 'product_list', subcategoryId, subcategoryName,
      page: meta.page, totalPages: meta.totalPages,
    });

    const rows = products.map(p => ({
      id: `prod_${p.id}`,
      title: p.name.slice(0, 24),
      description: p.brand || '',
    }));

    const pageInfo = meta.totalPages > 1 ? ` (pag. ${meta.page}/${meta.totalPages})` : '';
    await whatsappService.sendListMessage(
      to, `*${subcategoryName}*${pageInfo}\nElige un producto:`, 'Ver productos',
      [{ title: subcategoryName.slice(0, 24), rows }]
    );

    const navButtons = [];
    if (meta.hasPrevPage) navButtons.push({ type: 'reply', reply: { id: 'action_prev_page', title: 'Anterior' } });
    if (meta.hasNextPage) navButtons.push({ type: 'reply', reply: { id: 'action_next_page', title: 'Siguiente' } });
    navButtons.push({ type: 'reply', reply: { id: 'action_back_menu', title: 'Menu principal' } });
    await whatsappService.sendInteractiveButtons(to, 'Navegacion:', navButtons.slice(0, 3));
  }

  async sendProductDetail(to, productId) {
    const product = await gemmatexApi.getProduct(productId);
    const v = product.variants?.[0];

    const rawPrice = parseFloat(v?.price || 0);
    const rawDiscount = parseFloat(v?.discountPrice || 0);
    const price = rawPrice > 0 ? `*Precio:* Bs. ${rawPrice.toLocaleString('es-BO')}` : '*Precio:* Consultar';
    const discount = rawDiscount > 0 && rawDiscount < rawPrice
      ? `*Precio especial:* Bs. ${rawDiscount.toLocaleString('es-BO')}` : '';
    const stock = v?.stock != null ? `*Stock:* ${v.stock} ${v.unitOfMeasure || 'unidades'}` : '';
    const sku = v?.sku ? `*SKU:* ${v.sku}` : '';
    const description = v?.shortDescription || v?.description || product.subcategory?.description || '';

    const text = [
      `*${product.name}*`, product.brand, '', description, '',
      price, discount, stock, sku,
    ].filter(Boolean).join('\n');

    if (v?.imageUrl || product.imageUrl) {
      await whatsappService.sendMediaMessage(to, 'image', v?.imageUrl || product.imageUrl, product.name);
    }
    await whatsappService.sendMessage(to, text);

    const buttons = [
      { type: 'reply', reply: { id: 'action_cotizar', title: 'Cotizar' } },
      { type: 'reply', reply: { id: 'action_back_products', title: 'Mas productos' } },
      { type: 'reply', reply: { id: 'action_back_menu', title: 'Menu principal' } },
    ];
    await whatsappService.sendInteractiveButtons(to, 'Que deseas hacer?', buttons);

    const detailContext = [
      `Producto: ${product.name}`,
      product.brand ? `Marca: ${product.brand}` : '',
      description ? `Descripcion: ${description}` : '',
      rawPrice > 0 ? `Precio: Bs. ${rawPrice.toLocaleString('es-BO')}` : '',
      rawDiscount > 0 && rawDiscount < rawPrice ? `Precio especial: Bs. ${rawDiscount.toLocaleString('es-BO')}` : '',
      v?.stock != null ? `Stock: ${v.stock} ${v.unitOfMeasure || 'unidades'}` : '',
      v?.sku ? `SKU: ${v.sku}` : '',
    ].filter(Boolean).join(' | ');

    sessionStore.updateSession(to, {
      state: 'product_detail',
      searchContext: detailContext,
      currentProduct: {
        name: product.name,
        brand: product.brand,
        price: rawPrice > 0 ? `Bs. ${rawPrice.toLocaleString('es-BO')}` : 'Consultar',
        discountPrice: rawDiscount > 0 && rawDiscount < rawPrice
          ? `Bs. ${rawDiscount.toLocaleString('es-BO')}` : null,
        stock: v?.stock ?? null,
        sku: v?.sku || null,
      },
    });
  }

  // ─── Cotizacion ───────────────────────────────────────────────────────────

  async startQuoteFlow(to, session) {
    const productName = session.currentProduct?.name || 'Producto';
    await whatsappService.sendMessage(to, SALES_TEXT);
    sessionStore.updateSession(to, {
      quoteStep: 'name',
      quote: { productName },
    });
    await whatsappService.sendMessage(
      to,
      `Si prefieres que te contactemos para *${productName}*, dinos tu nombre completo:`
    );
  }

  async processQuoteStep(to, text, session) {
    const { quoteStep, quote } = session;

    if (quoteStep === 'name') {
      sessionStore.updateSession(to, { quoteStep: 'quantity', quote: { ...quote, name: text.trim() } });
      await whatsappService.sendMessage(to, `Gracias *${text.trim()}*. ¿Cuantas unidades necesitas?`);
      return;
    }
    if (quoteStep === 'quantity') {
      sessionStore.updateSession(to, { quoteStep: 'city', quote: { ...quote, quantity: text.trim() } });
      await whatsappService.sendMessage(to, '¿De que ciudad eres?');
      return;
    }
    if (quoteStep === 'city') {
      const final = { ...quote, city: text.trim() };
      sessionStore.updateSession(to, { quoteStep: null, quote: {}, state: 'main_menu' });

      const summary =
        `*Nueva Cotizacion*\n\n` +
        `*Producto:* ${final.productName}\n` +
        `*Cliente:* ${final.name}\n` +
        `*Cantidad:* ${final.quantity}\n` +
        `*Ciudad:* ${final.city}\n` +
        `*WhatsApp:* ${to}`;

      if (config.VENDOR_PHONE) {
        await whatsappService.sendMessage(config.VENDOR_PHONE, summary).catch(() => {});
      }

      await whatsappService.sendMessage(
        to,
        `Tu solicitud fue registrada.\n\n` +
        `*Producto:* ${final.productName}\n` +
        `*Cantidad:* ${final.quantity}\n` +
        `*Ciudad:* ${final.city}\n\n` +
        `Un asesor te contactara pronto. Para urgencias: *+591 62537378*`
      );
      await this.sendMainMenu(to);
    }
  }
}

export default new MessageHandler();
