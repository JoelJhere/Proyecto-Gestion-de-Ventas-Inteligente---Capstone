import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener la lista de vecinos que deben (Fiados Pendientes)
export const obtenerFiadosPendientes = async (req, res) => {
  try {
    const fiados = await prisma.cuentaPorCobrar.findMany({
      where: { estado: 'PENDIENTE' },
      include: {
        cliente: true, // Trae el nombre y WhatsApp del vecino
        venta: {
          include: { 
            detalles: { 
              include: { producto: true } // Trae qué productos se llevó
            } 
          }
        }
      },
      orderBy: { createdAt: 'desc' } // Los más recientes primero
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

  try {
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