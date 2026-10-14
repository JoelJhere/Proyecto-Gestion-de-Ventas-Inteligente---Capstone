import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los planes de compra (SOLO DE LA BODEGA ACTUAL)
export const obtenerPlanes = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const planes = await prisma.planCompra.findMany({
      where: { negocioId: negocioId }, // Filtro SaaS
      include: {
        proveedor: true,
        detalles: {
          include: { producto: true }
        }
      },
      orderBy: { fechaCreacion: 'desc' }
    });
    res.json(planes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener planes', error: error.message });
  }
};

// 2. Crear un nuevo Plan de Compra (Estado: PENDIENTE)
export const crearPlan = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { proveedorId, fechaEsperada, detalles } = req.body; 

  try {
    const totalEsperado = detalles.reduce((sum, item) => sum + (item.cantidadEsperada * item.precioCompra), 0);

    const nuevoPlan = await prisma.planCompra.create({
      data: {
        negocioId: negocioId, // Amarramos el plan al negocio del dueño
        proveedorId: parseInt(proveedorId),
        fechaEsperada: fechaEsperada ? new Date(fechaEsperada) : null,
        totalEsperado,
        detalles: {
          create: detalles.map(item => ({
            productoId: parseInt(item.productoId),
            cantidadEsperada: parseInt(item.cantidadEsperada),
            precioCompra: parseFloat(item.precioCompra)
          }))
        }
      },
      include: { detalles: true }
    });

    res.status(201).json({ message: 'Plan de compra creado exitosamente', plan: nuevoPlan });
  } catch (error) {
    res.status(500).json({ message: 'Error al crear plan de compra', error: error.message });
  }
};

// 3. RECIBIR LA MERCADERÍA (Suma stock y descuenta el pago del capital de la bodega)
export const recibirPlan = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { detallesRecibidos, metodoPago = 'EFECTIVO' } = req.body; 

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Verificamos que el plan exista, sea de esta bodega y no haya sido recibido
      const plan = await tx.planCompra.findFirst({ 
        where: { id: parseInt(id), negocioId: negocioId },
        include: { proveedor: true }
      });
      if (!plan) throw new Error('Plan no encontrado en tu negocio');
      if (plan.estado === 'RECIBIDO') throw new Error('Este pedido ya fue ingresado al sistema anteriormente');

      let totalReal = 0;

      // B. Procesamos cada producto de la lista
      for (const item of detallesRecibidos) {
        const cantidadIngresada = parseInt(item.cantidadRecibida);
        const costoUnitario = parseFloat(item.precioCompra);

        totalReal += (cantidadIngresada * costoUnitario);

        await tx.detallePlanCompra.update({
          where: { id: parseInt(item.detalleId) },
          data: { cantidadRecibida: cantidadIngresada }
        });

        // C. SI LLEGÓ MERCADERÍA, ACTUALIZAMOS EL STOCK Y EL HISTORIAL
        if (cantidadIngresada > 0) {
          await tx.producto.update({
            where: { id: parseInt(item.productoId) },
            data: { 
              stock: { increment: cantidadIngresada },
              precioCompra: costoUnitario
            }
          });

          await tx.movimientoInventario.create({
            data: {
              productoId: parseInt(item.productoId),
              tipo: 'ABASTECIMIENTO',
              cantidad: cantidadIngresada,
              motivo: `Ingreso por Plan de Compra #${plan.id}`
            }
          });
        }
      }

      // D. Cerramos el Plan de Compra
      const planActualizado = await tx.planCompra.update({
        where: { id: parseInt(id) },
        data: {
          estado: 'RECIBIDO',
          fechaRecibido: new Date(),
          totalReal
        },
        include: { proveedor: true, detalles: true }
      });

      // E. DESCONTAMOS EL PAGO AL PROVEEDOR DEL CAPITAL DE LA BODEGA
      if (totalReal > 0) {
        const metodoValido = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA'].includes(metodoPago) ? metodoPago : 'EFECTIVO';

        const negocioActualizado = await tx.negocio.update({
          where: { id: negocioId },
          data: { saldoCaja: { decrement: totalReal } }
        });

        await tx.movimientoCaja.create({
          data: {
            negocioId: negocioId,
            tipo: 'EGRESO',
            categoria: 'COMPRA_PROVEEDOR',
            monto: totalReal,
            saldoResultante: negocioActualizado.saldoCaja,
            metodoPago: metodoValido,
            descripcion: `Pago Plan de Compra #${plan.id} (${plan.proveedor?.nombre || 'Proveedor'})`
          }
        });
      }

      return planActualizado;
    });

    res.json({ message: 'Mercadería recibida, stock y caja actualizados', plan: resultado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};