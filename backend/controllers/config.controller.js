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

    const { nubefactToken, ...configPublica } = config;
    res.json({
    ...configPublica,
  nubefactTokenGuardado: Boolean(nubefactToken)
});
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
        ...(nubefactToken ? { nubefactToken } : {})
      }
    });

    const { nubefactToken: _omitido, ...configPublica } = configActualizada;
    res.json({ message: 'Configuración actualizada con éxito', config: configPublica });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    res.status(500).json({ message: 'Error al actualizar configuración' });
  }
};

// 3. Configurar porcentaje de ganancia automático para productos (SaaS)
export const actualizarMargenGanancia = async (req, res) => {
  const negocioId = req.user.negocioId;

  if (!negocioId) {
    return res.status(400).json({ message: 'Usuario no asociado a ningún negocio.' });
  }

  const { autoMargenActivo, porcentajeGanancia } = req.body;
  const activar = Boolean(autoMargenActivo);
  const porcentajeNum =
    porcentajeGanancia !== '' && porcentajeGanancia !== null && porcentajeGanancia !== undefined
      ? parseFloat(porcentajeGanancia)
      : null;

  if (activar) {
    if (porcentajeNum === null || Number.isNaN(porcentajeNum) || porcentajeNum <= 0 || porcentajeNum > 500) {
      return res.status(400).json({
        message: 'Para activar el cálculo automático debes ingresar un porcentaje válido entre 1% y 500%.'
      });
    }
  }

  try {
    const configActualizada = await prisma.negocio.update({
      where: { id: negocioId },
      data: {
        autoMargenActivo: activar,
        porcentajeGanancia:
          porcentajeNum !== null && !Number.isNaN(porcentajeNum) && porcentajeNum > 0
            ? porcentajeNum
            : null
      }
    });

    const { nubefactToken, ...configPublica } = configActualizada;
    res.json({
      message: activar
        ? `Cálculo automático activado con ${porcentajeNum}% de ganancia.`
        : 'Cálculo automático de precios desactivado.',
      config: {
        ...configPublica,
        nubefactTokenGuardado: Boolean(nubefactToken)
      }
    });
  } catch (error) {
    console.error('Error al actualizar margen de ganancia:', error);
    res.status(500).json({ message: 'Error al guardar el porcentaje de ganancia.' });
  }
};