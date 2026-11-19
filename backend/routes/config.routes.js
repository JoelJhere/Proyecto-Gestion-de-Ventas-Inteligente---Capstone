import express from 'express';
import {obtenerConfiguracion, actualizarConfiguracion, actualizarMargenGanancia } from '../controllers/config.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todos los usuarios logueados pueden ver la config (nombre, logo y margen configurado)
router.get('/', verificarToken, obtenerConfiguracion);

// SOLO el Dueño (Admin) puede modificar los datos de la empresa
router.put('/', verificarToken, esAdmin, actualizarConfiguracion);
router.put('/margen', verificarToken, esAdmin, actualizarMargenGanancia);

export default router;