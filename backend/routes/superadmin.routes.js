import express from 'express';
import { obtenerTodosLosNegocios } from '../controllers/superadmin.controller.js';
import { verificarToken, esSuperAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Ruta protegida con doble candado: Solo usuarios logueados Y que sean SUPER_ADMIN
router.get('/negocios', verificarToken, esSuperAdmin, obtenerTodosLosNegocios);

export default router;