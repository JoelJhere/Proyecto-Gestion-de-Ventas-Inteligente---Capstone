import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener la lista de vecinos que deben (SOLO DE LA BODEGA ACTUAL)
export const obtenerFiadosPendientes = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const fiados = await prisma.cuentaPorCobrar.findMany({
      where: { 
        estado: 'PENDIENTE',
        cliente: { negocioId: negocioId } // Filtro SaaS a través del cliente
      },
      include: {
        cliente: true,
        venta: {
          include: { 
            detalles: { 
              include: { producto: true } 
            } 
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(fiados);
  } catch (error) {
    console.error('Error al obtener fiados:', error);
    res.status(500).json({ message: 'Error interno al cargar la lista de fiados' });
  }
};

// 2. Liquidar (Pagar) la deuda del vecino
export const liquidarFiado = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;

  try {
    const fiadoExistente = await prisma.cuentaPorCobrar.findFirst({
      where: { id: parseInt(id), cliente: { negocioId: negocioId } }
    });

    if (!fiadoExistente) {
      return res.status(404).json({ message: 'Fiado no encontrado en tu negocio.' });
    }

    const fiadoPagado = await prisma.cuentaPorCobrar.update({
      where: { id: parseInt(id) },
      data: {
        estado: 'PAGADO',
        fechaPago: new Date()
      }
    });

    res.status(200).json({ 
      message: 'Cuenta liquidada correctamente. El pago ha sido registrado.', 
      fiado: fiadoPagado 
    });
  } catch (error) {
    console.error('Error al liquidar fiado:', error);
    res.status(500).json({ message: 'Error al procesar el pago del fiado' });
  }
};

// 3. Actualizar la fecha límite del recordatorio (Edición manual)
export const actualizarPlazo = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { nuevaFecha } = req.body;

  try {
    const fiadoExistente = await prisma.cuentaPorCobrar.findFirst({
      where: { id: parseInt(id), cliente: { negocioId: negocioId } }
    });

    if (!fiadoExistente) {
      return res.status(404).json({ message: 'Fiado no encontrado en tu negocio.' });
    }

    const fiadoActualizado = await prisma.cuentaPorCobrar.update({
      where: { id: parseInt(id) },
      data: {
        fechaLimite: new Date(nuevaFecha)
      }
    });

    res.status(200).json({ 
      message: 'Fecha de recordatorio actualizada', 
      fiado: fiadoActualizado 
    });
  } catch (error) {
    console.error('Error al actualizar plazo:', error);
    res.status(500).json({ message: 'Error al actualizar el plazo del fiado' });
  }
};

// 4. Registrar envío de WhatsApp (Pospone 1 día y cuenta el aviso)
export const registrarAvisoWhatsApp = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  
  try {
    const fiado = await prisma.cuentaPorCobrar.findFirst({ 
      where: { id: parseInt(id), cliente: { negocioId: negocioId } } 
    });

    if (!fiado) {
      return res.status(404).json({ message: 'Fiado no encontrado en tu negocio' });
    }
    
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);

    const fiadoActualizado = await prisma.cuentaPorCobrar.update({
      where: { id: parseInt(id) },
      data: {
        fechaLimite: manana,
        recordatorios: (fiado.recordatorios || 0) + 1
      }
    });

    res.status(200).json({ 
      message: 'Aviso registrado exitosamente.', 
      fiado: fiadoActualizado 
    });
  } catch (error) {
    console.error('Error al registrar aviso:', error);
    res.status(500).json({ message: 'Error al registrar el aviso en el sistema' });
  }
};