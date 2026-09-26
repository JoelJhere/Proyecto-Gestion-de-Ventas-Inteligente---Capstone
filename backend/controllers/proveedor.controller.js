import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los proveedores
export const obtenerProveedores = async (req, res) => {
  try {
    const proveedores = await prisma.proveedor.findMany({
      orderBy: { nombre: 'asc' }
    });
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener proveedores', error: error.message });
  }
};

// 2. Crear un nuevo proveedor
export const crearProveedor = async (req, res) => {
  const { nombre, ruc, telefono } = req.body;
  try {
    const nuevoProveedor = await prisma.proveedor.create({
      data: { nombre, ruc: ruc || null, telefono: telefono || null }
    });
    res.status(201).json({ message: 'Proveedor creado', proveedor: nuevoProveedor });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ message: 'Este RUC ya está registrado' });
    res.status(500).json({ message: 'Error al crear proveedor', error: error.message });
  }
};

// 3. Editar un proveedor
export const actualizarProveedor = async (req, res) => {
  const { id } = req.params;
  const { nombre, ruc, telefono } = req.body;
  try {
    const proveedorActualizado = await prisma.proveedor.update({
      where: { id: parseInt(id) },
      data: { nombre, ruc: ruc || null, telefono: telefono || null }
    });
    res.json({ message: 'Proveedor actualizado', proveedor: proveedorActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar proveedor', error: error.message });
  }
};