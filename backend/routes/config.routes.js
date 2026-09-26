import express from 'express';
import { obtenerConfiguracion, actualizarConfiguracion } from '../controllers/config.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todos los usuarios logueados pueden ver la config (para mostrar el nombre en el menú)
router.get('/', verificarToken, obtenerConfiguracion);

// SOLO el Dueño (Admin) puede modificar los datos de la empresa
router.put('/', verificarToken, esAdmin, actualizarConfiguracion);

export default router;