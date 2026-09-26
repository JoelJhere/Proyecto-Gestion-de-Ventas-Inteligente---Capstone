import express from 'express';
import { obtenerProveedores, crearProveedor, actualizarProveedor } from '../controllers/proveedor.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todos los trabajadores pueden ver la lista para contactarlos
router.get('/', verificarToken, obtenerProveedores);

// Solo el dueño (ADMIN) puede crear o editar proveedores
router.post('/', verificarToken, esAdmin, crearProveedor);
router.put('/:id', verificarToken, esAdmin, actualizarProveedor);

export default router;