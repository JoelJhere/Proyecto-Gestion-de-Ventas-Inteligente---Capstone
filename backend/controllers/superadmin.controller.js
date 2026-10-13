import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Obtener todas las bodegas registradas
export const obtenerTodosLosNegocios = async (req, res) => {
  try {
    const negocios = await prisma.negocio.findMany({
      include: {
        _count: {
          select: { usuarios: true, ventas: true, productos: true } // Contamos cuántos usuarios y ventas tiene cada bodega
        },
        usuarios: {
          where: { rol: 'ADMIN' },
          select: { nombre: true, email: true } // Traemos el nombre del dueño
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(negocios);
  } catch (error) {
    console.error("Error al obtener negocios:", error);
    res.status(500).json({ message: 'Error al cargar el panel de control maestro.' });
  }
};