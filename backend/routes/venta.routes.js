import express from 'express';
import { crearVenta, obtenerVentaPorId } from '../controllers/venta.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta protegida por el middleware
router.post('/', verificarToken, crearVenta);
router.get('/:id', verificarToken, obtenerVentaPorId);

export default router;