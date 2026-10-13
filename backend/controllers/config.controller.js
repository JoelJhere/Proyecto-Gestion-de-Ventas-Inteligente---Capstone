import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener la configuración del negocio (SaaS)
export const obtenerConfiguracion = async (req, res) => {
  try {
    // req.user.negocioId viene del token gracias a nuestro auth.middleware.js
    const negocioId = req.user.negocioId;

    if (!negocioId) {
      return res.status(400).json({ message: 'Usuario no asociado a ningún negocio.' });
    }

    const config = await prisma.negocio.findUnique({
      where: { id: negocioId }
    });

    if (!config) {
      return res.status(404).json({ message: 'Negocio no encontrado.' });
    }

    res.json(config);
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({ message: 'Error al obtener la configuración' });
  }
};

// 2. Actualizar la configuración del negocio (SaaS)
export const actualizarConfiguracion = async (req, res) => {
  const negocioId = req.user.negocioId;

  if (!negocioId) {
    return res.status(400).json({ message: 'Usuario no asociado a ningún negocio.' });
  }

  const { 
    razonSocial, nombre, ruc, direccionFiscal, ciudad, departamento, 
    telefono, email, mensajeTicket, impuestoPorcentaje, logo, nubefactRuta, nubefactToken
  } = req.body;

  try {
    const configActualizada = await prisma.negocio.update({
      where: { id: negocioId },
      data: {
        razonSocial,
        nombre,
        ruc,
        direccionFiscal,
        ciudad,
        departamento,
        telefono,
        email,
        mensajeTicket,
        impuestoPorcentaje: parseFloat(impuestoPorcentaje) || 18.0,
        logo,
        nubefactRuta,
        nubefactToken
      }
    });

    res.json({ message: 'Configuración actualizada con éxito', config: configActualizada });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    res.status(500).json({ message: 'Error al actualizar configuración' });
  }
};