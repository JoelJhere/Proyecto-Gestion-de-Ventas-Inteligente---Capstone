import { Router } from 'express';
import { obtenerHistorialVentas } from '../controllers/historial.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/', verificarToken, obtenerHistorialVentas);

export default router;