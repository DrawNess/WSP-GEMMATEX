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

Soporte tecnico: +591 62537378 | soporte.gemmatex.com.bo
Para compras: visitar sucursales en La Paz, Cochabamba, Santa Cruz, El Alto.
Ver catalogo completo: www.gemmatex.com.bo

Reglas:
- Responde SIEMPRE en espanol, breve y directo.
- Para compras o pedidos: deriva a sucursales, NO a soporte tecnico.
- Para problemas tecnicos: deriva a soporte.gemmatex.com.bo.
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
