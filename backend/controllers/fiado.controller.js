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

// 2. Liquidar (Pagar) la deuda del vecino y sumar el dinero a la caja
export const liquidarFiado = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { metodoPago = 'EFECTIVO' } = req.body;

  try {
    const fiadoExistente = await prisma.cuentaPorCobrar.findFirst({
      where: { id: parseInt(id), cliente: { negocioId: negocioId } },
      include: { cliente: true }
    });

    if (!fiadoExistente) {
      return res.status(404).json({ message: 'Fiado no encontrado en tu negocio.' });
    }
    if (fiadoExistente.estado === 'PAGADO') {
      return res.status(400).json({ message: 'Esta deuda ya fue pagada anteriormente.' });
    }

    const metodoValido = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA'].includes(metodoPago) ? metodoPago : 'EFECTIVO';

    const fiadoPagado = await prisma.$transaction(async (tx) => {
      // A. Marcar el fiado como PAGADO
      const pagado = await tx.cuentaPorCobrar.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'PAGADO',
          fechaPago: new Date()
        }
      });

      // B. Actualizar el método de pago en la venta original para el Historial/Excel
      await tx.venta.update({
        where: { id: fiadoExistente.ventaId },
        data: { metodoPago: metodoValido }
      });

      // C. Sumar el monto cobrado al saldo de la bodega
      const negocioActualizado = await tx.negocio.update({
        where: { id: negocioId },
        data: { saldoCaja: { increment: fiadoExistente.monto } }
      });

      // D. Registrar el ingreso en el Flujo de Caja (Sube la curva del gráfico)
      await tx.movimientoCaja.create({
        data: {
          negocioId: negocioId,
          tipo: 'INGRESO',
          categoria: 'COBRO_FIADO',
          monto: fiadoExistente.monto,
          saldoResultante: negocioActualizado.saldoCaja,
          metodoPago: metodoValido,
          descripcion: `Cobro de fiado - ${fiadoExistente.cliente.nombre}`
        }
      });

      return pagado;
    });

    res.status(200).json({ 
      message: 'Cuenta liquidada correctamente. El pago ha sido sumado a la caja.', 
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

// 5. Obtener el directorio completo de vecinos (creados en POS o en Fiados)
export const obtenerClientesFiado = async (req, res) => {
  const negocioId = req.user.negocioId;
  try {
    const clientes = await prisma.cliente.findMany({
      where: { negocioId: negocioId },
      include: {
        _count: {
          select: { fiados: { where: { estado: 'PENDIENTE' } } }
        }
      },
      orderBy: { nombre: 'asc' }
    });
    res.status(200).json(clientes);
  } catch (error) {
    console.error('Error al obtener clientes de fiado:', error);
    res.status(500).json({ message: 'Error al cargar el directorio de vecinos' });
  }
};

// 6. Registrar un vecino manualmente desde el módulo Control de Fiados
export const crearClienteFiado = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { nombre, telefono } = req.body;

  if (!nombre?.trim() || !telefono?.trim()) {
    return res.status(400).json({ message: 'El nombre y el celular son obligatorios.' });
  }

  try {
    const existente = await prisma.cliente.findFirst({
      where: {
        negocioId: negocioId,
        nombre: { equals: nombre.trim(), mode: 'insensitive' }
      }
    });

    if (existente) {
      return res.status(400).json({ message: 'Ya existe un vecino registrado con ese nombre.' });
    }

    const nuevoCliente = await prisma.cliente.create({
      data: {
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        negocioId: negocioId
      }
    });

    res.status(201).json({ message: 'Vecino agregado al directorio', cliente: nuevoCliente });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ message: 'Error interno al registrar vecino' });
  }
};

// 7. Actualizar nombre o celular de un vecino
export const actualizarClienteFiado = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { nombre, telefono } = req.body;

  try {
    const clienteExistente = await prisma.cliente.findFirst({
      where: { id: parseInt(id), negocioId: negocioId }
    });

    if (!clienteExistente) {
      return res.status(404).json({ message: 'Vecino no encontrado en tu bodega.' });
    }

    const actualizado = await prisma.cliente.update({
      where: { id: parseInt(id) },
      data: {
        nombre: nombre?.trim() || clienteExistente.nombre,
        telefono: telefono?.trim() || clienteExistente.telefono
      }
    });

    res.status(200).json({ message: 'Datos del vecino actualizados', cliente: actualizado });
  } catch (error) {
    console.error('Error al actualizar vecino:', error);
    res.status(500).json({ message: 'Error al actualizar los datos del vecino' });
  }
};