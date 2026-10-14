import { Router } from 'express';
import { obtenerHistorialVentas, obtenerFlujoCaja, registrarMovimientoManual } from '../controllers/historial.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', verificarToken, obtenerHistorialVentas);
router.get('/caja', verificarToken, esAdmin, obtenerFlujoCaja);
router.post('/caja/movimiento', verificarToken, esAdmin, registrarMovimientoManual);

export default router;