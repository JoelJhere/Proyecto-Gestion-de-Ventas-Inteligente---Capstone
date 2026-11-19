import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los planes de compra (SOLO DE LA BODEGA ACTUAL)
export const obtenerPlanes = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const planes = await prisma.planCompra.findMany({
      where: { negocioId },
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

// 2. Crear un nuevo Plan de Compra (Estado: PENDIENTE, soporta ofertas a S/ 0.00)
export const crearPlan = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { proveedorId, fechaEsperada, detalles } = req.body;

  if (!proveedorId) {
    return res.status(400).json({ message: 'Debes seleccionar un proveedor.' });
  }
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return res.status(400).json({ message: 'Debes agregar al menos un producto al plan de compra.' });
  }

  try {
    // Validar que el proveedor pertenezca a esta bodega
    const proveedorValido = await prisma.proveedor.findFirst({
      where: { id: parseInt(proveedorId, 10), negocioId }
    });
    if (!proveedorValido) {
      return res.status(404).json({ message: 'Proveedor no encontrado en tu negocio.' });
    }

    // Normalizar y validar cada detalle (acepta precioCompra === 0 para regalos/ofertas)
    const detallesLimpios = detalles.map((item) => {
      const productoId = parseInt(item.productoId, 10);
      const cantidadEsperada = parseInt(item.cantidadEsperada, 10);
      const precioCompra =
        item.precioCompra === '' || item.precioCompra === null || item.precioCompra === undefined
          ? 0
          : parseFloat(item.precioCompra);

      if (Number.isNaN(productoId) || Number.isNaN(cantidadEsperada) || cantidadEsperada <= 0) {
        throw new Error('Todos los productos deben tener una cantidad solicitada mayor a 0.');
      }
      if (Number.isNaN(precioCompra) || precioCompra < 0) {
        throw new Error('El costo unitario no puede ser negativo.');
      }

      return { productoId, cantidadEsperada, precioCompra };
    });

    // Verificar que todos los productos pertenezcan a esta bodega
    const idsProductosUnicos = [...new Set(detallesLimpios.map(d => d.productoId))];
    const productosValidos = await prisma.producto.count({
      where: { id: { in: idsProductosUnicos }, negocioId }
    });
    if (productosValidos !== idsProductosUnicos.length) {
      return res.status(400).json({ message: 'Uno o más productos no pertenecen a tu inventario.' });
    }

    const totalEsperado = detallesLimpios.reduce(
      (sum, item) => sum + (item.cantidadEsperada * item.precioCompra),
      0
    );

    // Evita desfase de 1 día en zona horaria de Perú cuando llega como "YYYY-MM-DD"
    let fechaEsperadaDate = null;
    if (fechaEsperada) {
      const fechaStr = String(fechaEsperada).includes('T')
        ? String(fechaEsperada)
        : `${fechaEsperada}T12:00:00.000Z`;
      fechaEsperadaDate = new Date(fechaStr);
    }

    const nuevoPlan = await prisma.planCompra.create({
      data: {
        negocioId,
        proveedorId: parseInt(proveedorId, 10),
        fechaEsperada: fechaEsperadaDate,
        totalEsperado,
        detalles: {
          create: detallesLimpios
        }
      },
      include: { detalles: true }
    });

    res.status(201).json({ message: 'Plan de compra creado exitosamente', plan: nuevoPlan });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error al crear plan de compra' });
  }
};

// 3. RECIBIR LA MERCADERÍA (Solo disminuir o marcar 0 sin stock, respeta ofertas gratis)
export const recibirPlan = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { detallesRecibidos, metodoPago = 'EFECTIVO' } = req.body;

  if (!Array.isArray(detallesRecibidos)) {
    return res.status(400).json({ message: 'Debes enviar el detalle de cantidades recibidas.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Verificamos que el plan exista, sea de esta bodega y traemos sus detalles reales
      const plan = await tx.planCompra.findFirst({
        where: { id: parseInt(id, 10), negocioId },
        include: {
          proveedor: true,
          detalles: true
        }
      });

      if (!plan) throw new Error('Plan no encontrado en tu negocio.');
      if (plan.estado === 'RECIBIDO') {
        throw new Error('Este pedido ya fue ingresado al sistema anteriormente.');
      }

      // Mapa de cantidades enviadas indexado por detalleId (evita duplicados)
      const mapaRecibidos = new Map();
      for (const item of detallesRecibidos) {
        const detId = parseInt(item.detalleId, 10);
        if (!Number.isNaN(detId)) {
          mapaRecibidos.set(detId, parseInt(item.cantidadRecibida, 10) || 0);
        }
      }

      let totalReal = 0;

      // B. Iteramos sobre los detalles REALES del plan en BD (fuente única de verdad)
      for (const detalleOriginal of plan.detalles) {
        const cantidadIngresada = mapaRecibidos.has(detalleOriginal.id)
          ? mapaRecibidos.get(detalleOriginal.id)
          : 0;

        if (cantidadIngresada < 0) {
          throw new Error('La cantidad recibida no puede ser negativa.');
        }
        if (cantidadIngresada > detalleOriginal.cantidadEsperada) {
          throw new Error(
            `No puedes recibir más de lo solicitado (${detalleOriginal.cantidadEsperada} un.).`
          );
        }

        const costoUnitario = Number(detalleOriginal.precioCompra || 0);
        const esRegalo = costoUnitario === 0;

        totalReal += cantidadIngresada * costoUnitario;

        await tx.detallePlanCompra.update({
          where: { id: detalleOriginal.id },
          data: { cantidadRecibida: cantidadIngresada }
        });

        // C. Si llegó mercadería (> 0), sumamos stock y registramos movimiento
        if (cantidadIngresada > 0) {
          await tx.producto.update({
            where: { id: detalleOriginal.productoId },
            data: {
              stock: { increment: cantidadIngresada },
              // Si es oferta/regalo (S/ 0.00), NO sobrescribimos el costo real del producto
              ...(costoUnitario > 0 ? { precioCompra: costoUnitario } : {})
            }
          });

          await tx.movimientoInventario.create({
            data: {
              productoId: detalleOriginal.productoId,
              tipo: 'ABASTECIMIENTO',
              cantidad: cantidadIngresada,
              motivo: esRegalo
                ? `Bonificación / Oferta gratis por Plan de Compra #${plan.id}`
                : `Ingreso por Plan de Compra #${plan.id}`
            }
          });
        }
      }

      // D. Cerramos el Plan de Compra
      const planActualizado = await tx.planCompra.update({
        where: { id: plan.id },
        data: {
          estado: 'RECIBIDO',
          fechaRecibido: new Date(),
          totalReal
        },
        include: { proveedor: true, detalles: true }
      });

      // E. Descontamos de caja solo si hubo importe real a pagar (> 0)
      if (totalReal > 0) {
        const metodoValido = ['EFECTIVO', 'YAPE_PLIN', 'TRANSFERENCIA'].includes(metodoPago)
          ? metodoPago
          : 'EFECTIVO';

        const negocioActualizado = await tx.negocio.update({
          where: { id: negocioId },
          data: { saldoCaja: { decrement: totalReal } }
        });

        await tx.movimientoCaja.create({
          data: {
            negocioId,
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