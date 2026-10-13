import express from 'express';
import { login, registrarNegocio } from '../controllers/auth.controller.js';

const router = express.Router();

// Ruta para iniciar sesión
router.post('/login', login);

// Ruta pública para que nuevos clientes creen su bodega
router.post('/registro-saas', registrarNegocio);

export default router;