import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los proveedores (SOLO DE LA BODEGA ACTUAL)
export const obtenerProveedores = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const proveedores = await prisma.proveedor.findMany({
      where: { negocioId: negocioId }, // Filtro SaaS
      orderBy: { nombre: 'asc' }
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proveedores', error: error.message });
  }
};

// 2. Crear un nuevo proveedor (Amarrado al negocioId)
export const crearProveedor = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { nombre, ruc, telefono } = req.body;

  try {
    const nuevoProveedor = await prisma.proveedor.create({
      data: { 
        nombre, 
        ruc: ruc && ruc.trim() !== '' ? ruc : null, 
        telefono: telefono || null,
        negocioId: negocioId // Amarramos el proveedor al negocio del dueño
      }
    });
    res.status(201).json({ message: 'Proveedor creado', proveedor: nuevoProveedor });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Este RUC ya está registrado en tu lista de proveedores' });
    }
    res.status(500).json({ message: 'Error al crear proveedor', error: error.message });
  }
};

// 3. Editar un proveedor (Verificando que pertenezca a la bodega)
export const actualizarProveedor = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { nombre, ruc, telefono } = req.body;

  try {
    const proveedorExistente = await prisma.proveedor.findFirst({
      where: { id: parseInt(id), negocioId: negocioId }
    });

    if (!proveedorExistente) {
      return res.status(404).json({ message: 'Proveedor no encontrado en tu negocio.' });
    }

    const proveedorActualizado = await prisma.proveedor.update({
      where: { id: parseInt(id) },
      data: { 
        nombre, 
        ruc: ruc && ruc.trim() !== '' ? ruc : null, 
        telefono: telefono || null 
      }
    });
    res.json({ message: 'Proveedor actualizado', proveedor: proveedorActualizado });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Este RUC ya pertenece a otro de tus proveedores' });
    }
    res.status(500).json({ message: 'Error al actualizar proveedor', error: error.message });
  }
};