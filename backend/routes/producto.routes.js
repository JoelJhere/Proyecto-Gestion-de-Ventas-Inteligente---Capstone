import express from 'express';
import { obtenerProductos, crearProducto, actualizarProducto, gestionarStock, toggleEstadoProducto } from '../controllers/producto.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Rutas protegidas: Solo los usuarios logueados con token pueden ver o crear
router.get('/', verificarToken, obtenerProductos);

// Restricción extra: Solo el ADMIN (Dueño) puede crear productos nuevos
router.post('/', verificarToken, esAdmin, crearProducto);

router.put('/:id', verificarToken, esAdmin, actualizarProducto);
router.post('/:id/stock', verificarToken, esAdmin, gestionarStock);

router.put('/:id/estado', verificarToken, esAdmin, toggleEstadoProducto);

export default router;