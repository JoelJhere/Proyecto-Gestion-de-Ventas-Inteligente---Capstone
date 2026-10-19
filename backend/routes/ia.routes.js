import express from 'express';
import { obtenerResumenIA, consultarAsistenteIA } from '../controllers/ia.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rutas protegidas: extraen automáticamente el negocioId del token
router.get('/resumen', verificarToken, obtenerResumenIA);
router.post('/chat', verificarToken, consultarAsistenteIA);

export default router;