import express from 'express';
import { crearVenta } from '../controllers/venta.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta protegida por el middleware
router.post('/', verificarToken, crearVenta);

export default router;