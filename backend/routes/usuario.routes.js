import express from 'express';
import { obtenerUsuarios, crearUsuario, actualizarUsuario, eliminarUsuario, aceptarTerminos } from '../controllers/usuario.controller.js';
import { verificarToken, esAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Todas las rutas requieren que el usuario esté logueado (verificarToken) 
// y que tenga el rol ADMIN (esAdmin) en su respectiva bodega.

router.put('/aceptar-terminos', verificarToken, aceptarTerminos);

router.get('/', verificarToken, esAdmin, obtenerUsuarios);
router.post('/', verificarToken, esAdmin, crearUsuario);
router.put('/:id', verificarToken, esAdmin, actualizarUsuario);
router.delete('/:id', verificarToken, esAdmin, eliminarUsuario);

export default router;