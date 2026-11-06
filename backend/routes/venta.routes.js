import express from 'express';
import { crearVenta, obtenerVentaPorId } from '../controllers/venta.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Solo registrar ventas requiere token de cajero/admin
router.post('/', verificarToken, crearVenta);

// Ruta pública para visualizar e imprimir el comprobante desde enlaces externos
router.get('/:id', obtenerVentaPorId);

export default router;