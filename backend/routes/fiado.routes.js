import express from 'express';
import { obtenerFiadosPendientes, liquidarFiado, actualizarPlazo, registrarAvisoWhatsApp, obtenerClientesFiado, crearClienteFiado, actualizarClienteFiado } from '../controllers/fiado.controller.js';
import { verificarToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rutas protegidas (solo cajeros/admin pueden ver y cobrar)
router.get('/', verificarToken, obtenerFiadosPendientes);
router.put('/pagar/:id', verificarToken, liquidarFiado);
router.put('/plazo/:id', verificarToken, actualizarPlazo);
router.put('/avisar/:id', verificarToken, registrarAvisoWhatsApp);
router.get('/clientes', verificarToken, obtenerClientesFiado);
router.post('/clientes', verificarToken, crearClienteFiado);
router.put('/clientes/:id', verificarToken, actualizarClienteFiado);

export default router;