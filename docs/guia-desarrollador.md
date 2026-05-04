# Guía de Desarrollador — Gemmatex ChatBOT

Bot de WhatsApp para GEMMATEX. Usa la API de WhatsApp Business de Meta y la API de productos de Gemmatex.

---

## Stack

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Node.js | ≥ 18 | Runtime (ES Modules) |
| Express | 5.2.x | Servidor HTTP / webhook |
| Axios | 1.x | Llamadas HTTP a Meta API y API de productos |
| dotenv | 17.x | Variables de entorno |

Sin base de datos. Estado en memoria (Map).

---

## Estructura del proyecto

```
src/
├── app.js                        # Entry point — Express server
├── config/
│   └── env.js                    # Carga variables de entorno
├── controllers/
│   └── webhook.controller.js     # Maneja GET y POST /webhook
├── routes/
│   └── webhook.routes.js         # Registra rutas
└── services/
    ├── message.handler.js        # State machine — lógica del bot
    ├── whatsapp.service.js       # Wrapper de la API de WhatsApp Business
    ├── gemmatex.api.js           # Cliente HTTP para API de productos
    └── session.store.js          # Sesiones en memoria por usuario

docs/
├── guia-usuario.md
└── guia-desarrollador.md         # Este archivo
```

---

## Configuración

Crea un archivo `.env` en la raíz:

```env
VERIFY_TOKEN=tu_token_de_verificacion
API_TOKEN=tu_bearer_token_de_meta
BUSINESS_PHONE=id_del_numero_de_negocio
API_VERSION=v25.0
PORT=3000
BASE_URL=https://tu-dominio.com
```

| Variable | Dónde obtenerla |
|----------|----------------|
| `VERIFY_TOKEN` | Lo defines tú, se configura en Meta Developers al suscribir el webhook |
| `API_TOKEN` | Meta Developers → Tu App → WhatsApp → API Setup → Temporary/Permanent Token |
| `BUSINESS_PHONE` | Meta Developers → Tu App → WhatsApp → API Setup → Phone Number ID |
| `API_VERSION` | Meta Developers → API version activa (ej. `v25.0`) |

---

## Instalación y ejecución

```bash
npm install

# Producción
npm start

# Desarrollo (auto-restart con --watch)
npm run dev
```

---

## Webhook

El bot expone dos endpoints:

### `GET /webhook`
Verificación de Meta al suscribir el webhook.
- Valida `hub.verify_token` contra `VERIFY_TOKEN`
- Responde con `hub.challenge` si es válido

### `POST /webhook`
Recibe mensajes entrantes de WhatsApp.
- Extrae `message` y `senderInfo` del body
- Delega a `MessageHandler.handleIncomingMessage()`

---

## Flujo de mensajes

```
POST /webhook
  └── WebhookController.handleIncomingMessage()
        └── MessageHandler.handleIncomingMessage(message, senderInfo)
              ├── message.type === 'text'
              │     ├── isGreeting() → sendWelcomeMessage() + sendMainMenu()
              │     └── otro → redirigir a sendMainMenu()
              │
              └── message.type === 'interactive'
                    ├── button_reply → handleButtonReply(to, optionId)
                    └── list_reply  → handleListReply(to, optionId)
```

---

## State Machine

Cada usuario tiene una sesión con un `state`:

```
idle → main_menu → categories → subcategories → product_list → product_detail
```

### Sesión (session.store.js)

```js
{
  state: 'idle' | 'main_menu' | 'categories' | 'subcategories' | 'product_list' | 'product_detail',
  categoryId: Number | null,
  categoryName: String | null,
  subcategoryId: Number | null,
  subcategoryName: String | null,
  page: Number,          // página actual de productos
  totalPages: Number,
  lastActivity: Number,  // timestamp ms
}
```

- TTL: **30 minutos** de inactividad → sesión se resetea
- Cleanup automático: cada **10 minutos** se eliminan sesiones expiradas

### IDs de opciones (convención)

| Prefijo | Tipo | Ejemplo |
|---------|------|---------|
| `menu_*` | Botón menú principal | `menu_products` |
| `cat_*` | List reply de categoría | `cat_2` |
| `sub_*` | List reply de subcategoría | `sub_10` |
| `prod_*` | List reply de producto | `prod_165` |
| `action_*` | Botón de navegación | `action_next_page` |

---

## API de WhatsApp (whatsapp.service.js)

| Método | Descripción |
|--------|-------------|
| `sendMessage(to, body, messageId?)` | Mensaje de texto simple |
| `sendInteractiveButtons(to, bodyText, buttons)` | Hasta 3 botones |
| `sendListMessage(to, bodyText, buttonLabel, sections)` | Lista de hasta 10 items por sección |
| `sendMediaMessage(to, type, mediaUrl, caption)` | Imagen, video, audio, documento |
| `markAsRead(messageId)` | Marca mensaje como leído |

**Formato de botones:**
```js
[{ type: 'reply', reply: { id: 'string', title: 'string' } }]
```

**Formato de secciones para List Message:**
```js
[{
  title: 'Nombre sección',
  rows: [{ id: 'string', title: 'string', description: 'string' }]
}]
```

---

## API de Productos (gemmatex.api.js)

Base URL: `https://gemmatex.store/api/v1`

| Método | Endpoint | Caché |
|--------|----------|-------|
| `getCategories()` | `GET /categories` | Indefinida |
| `getSubcategories()` | `GET /subcategories` | Indefinida |
| `getSubcategoriesByCategory(categoryId)` | — filtro local | Indefinida |
| `getProductsBySubcategory(subcategoryId, page)` | `GET /products?subcategoryId=&page=&pageSize=8` | 5 min |
| `getProduct(productId)` | `GET /products/:id` | 5 min |

**Estructura de respuesta de productos:**
```js
{
  data: [{ id, name, brand, imageUrl, subcategoryId, subcategory, category }],
  meta: { page, pageSize, totalItems, totalPages, hasNextPage, hasPrevPage }
}
```

**Estructura de detalle de producto:**
```js
{
  id, name, brand, imageUrl, subcategory, category,
  variants: [{
    price, discountPrice, sku, stock, unitOfMeasure,
    description, shortDescription, imageUrl, galleryUrls, dimensions, tags
  }]
}
```

---

## Agregar una nueva opción al menú

1. Añadir botón en `sendMainMenu()` (máx 3 botones totales)
2. Agregar `case 'menu_nueva_opcion':` en `handleButtonReply()`
3. Implementar el método correspondiente

---

## Cómo añadir una categoría/producto nuevo

No requiere cambios en el bot. Las categorías y productos se leen desde la API de Gemmatex en tiempo real. Solo actualiza la API y el bot los mostrará automáticamente (tras expirar el caché si aplica).

---

## Limitaciones conocidas de WhatsApp Business API

| Límite | Valor |
|--------|-------|
| Botones interactivos | Máx 3 |
| Rows en List Message | Máx 10 por sección |
| Título de botón | Máx 20 caracteres |
| Título de row | Máx 24 caracteres |
| Descripción de row | Máx 72 caracteres |
| Mensajes fuera de ventana 24h | Solo templates aprobados |

---

## Escalabilidad

Estado actual: sesiones en memoria (`Map`). Suficiente para cientos de usuarios concurrentes.

Si se requiere escalar horizontalmente (múltiples instancias):
- Migrar `session.store.js` a **Redis** (`ioredis`)
- Migrar caché de productos a Redis o usar CDN/proxy para la API de Gemmatex

No se requieren cambios en ningún otro módulo.
