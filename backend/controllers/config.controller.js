import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener la configuración del negocio
export const obtenerConfiguracion = async (req, res) => {
  try {
    let config = await prisma.businessConfig.findFirst();

    if (!config) {
      config = await prisma.businessConfig.create({
        data: {
          razonSocial: 'Mi Empresa S.A.C.',
          nombre: 'Mi Negocio',
          ruc: '',
          direccionFiscal: '',
          ciudad: '',
          departamento: '',
          telefono: '',
          email: '',
          mensajeTicket: '¡Gracias por su preferencia!',
          impuestoPorcentaje: 18.0
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
  const { 
    razonSocial, nombre, ruc, direccionFiscal, ciudad, departamento, 
    telefono, email, mensajeTicket, impuestoPorcentaje, logo, nubefactRuta, nubefactToken
  } = req.body;

  try {
    const configExistente = await prisma.businessConfig.findFirst();

    if (!configExistente) {
      return res.status(404).json({ message: 'No se encontró la configuración base' });
    }

    const configActualizada = await prisma.businessConfig.update({
      where: { id: configExistente.id },
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
    res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
  }
};