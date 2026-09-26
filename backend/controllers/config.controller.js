import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener la configuración del negocio
export const obtenerConfiguracion = async (req, res) => {
  try {
    // Buscamos el primer (y único) registro
    let config = await prisma.businessConfig.findFirst();

    // Si la base de datos está vacía, creamos la configuración por defecto
    if (!config) {
      config = await prisma.businessConfig.create({
        data: {
          nombre: 'Bodega NOVA',
          ruc: '20000000000',
          direccion: 'Dirección no configurada'
        }
      });
    }

    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener la configuración', error: error.message });
  }
};

// 2. Actualizar la configuración
export const actualizarConfiguracion = async (req, res) => {
  const { nombre, ruc, direccion, telefono, email, mensajeTicket, impuestoPorcentaje } = req.body;

  try {
    const configExistente = await prisma.businessConfig.findFirst();

    if (!configExistente) {
      return res.status(404).json({ message: 'No se encontró la configuración base' });
    }

    const configActualizada = await prisma.businessConfig.update({
      where: { id: configExistente.id },
      data: {
        nombre,
        ruc,
        direccion,
        telefono,
        email,
        mensajeTicket,
        impuestoPorcentaje: parseFloat(impuestoPorcentaje) || 18.0
      }
    });

    res.json({ message: 'Configuración actualizada con éxito', config: configActualizada });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
  }
};