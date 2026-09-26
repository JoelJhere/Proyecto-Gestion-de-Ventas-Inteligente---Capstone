import express from 'express';
import { obtenerPlanes, crearPlan, recibirPlan } from '../controllers/planCompra.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todos pueden ver los planes (para que los ayudantes sepan qué camión llegará)
router.get('/', verificarToken, obtenerPlanes);

// Solo el ADMIN (dueño) planea las compras
router.post('/', verificarToken, esAdmin, crearPlan);

// Cualquier trabajador logueado puede recibir la mercadería
router.put('/:id/recibir', verificarToken, recibirPlan);

export default router;