import express from 'express';
import { consultarDocumento } from '../controllers/api.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta final será: GET /api/externa/consulta/dni/71710183
router.get('/consulta/:tipo/:numero', verificarToken, consultarDocumento);

export default router;