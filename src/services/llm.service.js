import axios from 'axios';
import config from '../config/env.js';

const OLLAMA_URL = 'https://ollama.com/api/chat';

const SYSTEM_PROMPT = `Eres el asistente virtual de GEMMATEX, empresa boliviana especializada en equipos y materiales para sublimacion, serigrafia y personalizacion textil.

Productos que vendemos:
- Impresoras Epson (sublimacion, DTF, etiquetas, EcoTank, CAD/plotters)
- Maquinas GX (planchas transfer pequenas, grandes y especiales)
- Papeles (rollo, hoja, manilla)
- Productos AGABE (emulsiones, sensibilizadores, auxiliares para serigrafia)
- Viniles (PU, PU Neon)

Sucursales donde recoger productos:
- LA PAZ (Casa Matriz): Av. Illampu esq. Graneros N. 682 | WhatsApp: +591 71926087
- COCHABAMBA: Av. Aroma entre 16 de Julio y Av. Oquendo | WhatsApp: +591 78859336
- EL ALTO (Ceibo): Zona 16 de Julio, Calle Rene Dorado N. 200 | WhatsApp: +591 67017253
- EL ALTO (Ciudad Satelite): Av. Panoramica, frente al canal RTP | WhatsApp: +591 69750231
- SANTA CRUZ: Calle Isabela Catolica casi Canoto, lado Kaywasi N. 275 | WhatsApp: +591 78346372

Envios: Si, realizamos envios a todo el pais. El cliente debe contactar a la sucursal mas cercana para coordinar el envio y el pago.

Horarios generales:
- Lun-Vie: 8:40-13:00 y 14:00-18:30 (varia por sucursal)
- Sabados: 8:40-13:00

Soporte tecnico: +591 62537378 | soporte.gemmatex.com.bo
Ver catalogo completo: www.gemmatex.com.bo

Reglas:
- Responde SIEMPRE en espanol, breve y directo.
- Para compras, recojo o envios: indica la sucursal correspondiente y su WhatsApp.
- Para problemas tecnicos con equipos: deriva a soporte.gemmatex.com.bo.
- Nunca inventes precios ni especificaciones tecnicas.
- Maximo 2 oraciones.`;

async function post(messages) {
  const res = await axios.post(
    OLLAMA_URL,
    { model: config.OLLAMA_MODEL, messages, stream: false },
    {
      headers: {
        'Authorization': `Bearer ${config.OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );
  return res.data.message?.content?.trim() || null;
}

// Extrae keyword de producto del mensaje del usuario. Retorna null si no hay producto.
async function extractKeyword(userMessage) {
  try {
    const messages = [
      {
        role: 'system',
        content: `Extrae el nombre del producto que busca el usuario en 1-3 palabras. Solo el nombre del producto o articulo. Si el usuario no busca un producto especifico, responde exactamente: ninguno

Ejemplos:
"buenas tardes tuviera viniles" → viniles
"quiero consultar si tienen tintas para la F170" → tintas F170
"a cuanto esta el cyan" → cyan
"hola buenos dias" → ninguno
"para que sirve esto" → ninguno
"tienen papel para sublimacion" → papel sublimacion`,
      },
      { role: 'user', content: userMessage },
    ];
    const result = await post(messages);
    if (!result || result.toLowerCase().includes('ninguno')) return null;
    return result.trim();
  } catch {
    return null;
  }
}

// Responde pregunta general con historial de contexto
async function chat(userMessage, context = '', history = []) {
  try {
    const systemContent = SYSTEM_PROMPT + (context ? `\n\nContexto: ${context}` : '');
    const messages = [
      { role: 'system', content: systemContent },
      ...history.slice(-10),
      { role: 'user', content: userMessage },
    ];
    return await post(messages);
  } catch (error) {
    console.error('LLM error:', error.response?.data || error.message);
    return null;
  }
}

export default { extractKeyword, chat };
