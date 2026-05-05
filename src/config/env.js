import dotenv from 'dotenv';

dotenv.config();

export default {
  VERIFY_TOKEN: process.env.VERIFY_TOKEN,
  API_TOKEN: process.env.API_TOKEN,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  API_VERSION: process.env.API_VERSION,
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL,
  XAI_API_KEY: process.env.XAI_API_KEY,
  XAI_MODEL: process.env.XAI_MODEL || 'grok-3-mini',
  VENDOR_PHONE: process.env.VENDOR_PHONE,
};