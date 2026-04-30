import express from 'express';
import webhookController from '../controllers/webhook.controller.js';

const router = express.Router();

router.post('/webhook', webhookController.handleIncoming);
router.get('/webhook', webhookController.verifyWebhook);

export default router;