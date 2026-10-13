import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// 1. Obtener todos los empleados de LA BODEGA ACTUAL
export const obtenerUsuarios = async (req, res) => {
  const negocioId = req.user.negocioId;  // Obtenemos el negocioId del usuario autenticado (dueño de la bodega)

  try {
    const usuarios = await prisma.user.findMany({
      where: { negocioId: negocioId },
      select: { // No enviamos la contraseña al frontend por seguridad
        id: true,
        nombre: true,
        email: true,
        rol: true,
        estado: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error("Error al obtener usuarios:", error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

// 2. Crear un nuevo empleado para la bodega
export const crearUsuario = async (req, res) => {
  const { nombre, email, password, rol } = req.body;
  const negocioId = req.user.negocioId;

  try {
    // Validar si el correo ya existe en todo el SaaS
    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) {
      return res.status(400).json({ message: 'Este correo ya está registrado en el sistema.' });
    }

    // Encriptar la contraseña del nuevo cajero
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Solo se pueden crear roles ADMIN o AYUDANTE
    const rolFinal = (rol === 'ADMIN' || rol === 'AYUDANTE') ? rol : 'AYUDANTE';

    const nuevoUsuario = await prisma.user.create({
      data: {
        nombre,
        email,
        password: hashedPassword,
        rol: rolFinal,
        negocioId: negocioId, // Se asigna automáticamente a la bodega del dueño
      },
      select: { id: true, nombre: true, email: true, rol: true, estado: true } // Devolvemos el usuario sin la clave
    });

    res.status(201).json({ message: 'Empleado creado exitosamente.', usuario: nuevoUsuario });
  } catch (error) {
    console.error("Error al crear usuario:", error);
    res.status(500).json({ message: 'Error al registrar al empleado.' });
  }
};

// 3. Editar datos básicos o cambiar contraseña de un empleado
export const actualizarUsuario = async (req, res) => {
  const { id } = req.params;
  const { nombre, email, password, rol, estado } = req.body;
  const negocioId = req.user.negocioId;

  try {
    // Verificar que el usuario que intentan editar pertenezca a esta bodega
    const usuarioDestino = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    
    if (!usuarioDestino || usuarioDestino.negocioId !== negocioId) {
      return res.status(404).json({ message: 'Usuario no encontrado o no pertenece a tu negocio.' });
    }

    // Preparar los datos a actualizar
    const dataUpdate = {
      nombre,
      rol: (rol === 'ADMIN' || rol === 'AYUDANTE') ? rol : usuarioDestino.rol,
      estado: estado !== undefined ? estado : usuarioDestino.estado
    };

    // Si cambian el correo, verificar que el nuevo no exista
    if (email && email !== usuarioDestino.email) {
      const existeEmail = await prisma.user.findUnique({ where: { email } });
      if (existeEmail) return res.status(400).json({ message: 'El nuevo correo ya está en uso.' });
      dataUpdate.email = email;
    }

    // Si envían una nueva contraseña, encriptarla
    if (password && password.trim() !== '') {
      const salt = await bcrypt.genSalt(10);
      dataUpdate.password = await bcrypt.hash(password, salt);
    }

    const usuarioActualizado = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataUpdate,
      select: { id: true, nombre: true, email: true, rol: true, estado: true }
    });

    res.json({ message: 'Datos actualizados correctamente.', usuario: usuarioActualizado });
  } catch (error) {
    console.error("Error actualizando usuario:", error);
    res.status(500).json({ message: 'Error al actualizar al empleado.' });
  }
};

// 4. "Eliminar" (Suspender) a un empleado
export const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const usuarioEjecutorId = req.user.id;

  try {
    // 1. Un dueño no puede eliminarse a sí mismo por error
    if (parseInt(id) === usuarioEjecutorId) {
      return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta.' });
    }

    // 2. Verificar que el usuario pertenezca a la bodega
    const usuarioDestino = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    
    if (!usuarioDestino || usuarioDestino.negocioId !== negocioId) {
      return res.status(404).json({ message: 'Empleado no encontrado.' });
    }

    // En los sistemas contables/POS nunca se deberia eliminar un usuario del sistema completamente,
    // porque rompería el historial de ventas del cajero. Hacemos un "Soft Delete" (desactivarlo).
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: { estado: false }
    });

    res.json({ message: 'El acceso del empleado ha sido revocado (suspendido).' });
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    res.status(500).json({ message: 'Error al procesar la solicitud.' });
  }
};

// 5. Aceptar Términos y Condiciones (Primer inicio de sesión del empleado)
export const aceptarTerminos = async (req, res) => {
  const usuarioId = req.user.id;

  try {
    await prisma.user.update({
      where: { id: parseInt(usuarioId) },
      data: { terminosAceptados: true }
    });

    res.json({ message: 'Términos y condiciones aceptados correctamente.' });
  } catch (error) {
    console.error("Error al aceptar términos:", error);
    res.status(500).json({ message: 'Error al registrar la aceptación.' });
  }
};