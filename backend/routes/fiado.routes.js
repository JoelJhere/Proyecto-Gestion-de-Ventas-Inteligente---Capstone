import express from 'express';
import { obtenerFiadosPendientes, liquidarFiado } from '../controllers/fiado.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rutas protegidas (solo cajeros/admin pueden ver y cobrar)
router.get('/', verificarToken, obtenerFiadosPendientes);
router.put('/pagar/:id', verificarToken, liquidarFiado);

export default router;