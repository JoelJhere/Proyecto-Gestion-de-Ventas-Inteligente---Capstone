import { PrismaClient } from '@prisma/client';
import { parsearFechaVencimiento, agregarStockALote } from '../utils/lotes.util.js';

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
    const proveedorValido = await prisma.proveedor.findFirst({
      where: { id: parseInt(proveedorId, 10), negocioId }
    });
    if (!proveedorValido) {
      return res.status(404).json({ message: 'Proveedor no encontrado en tu negocio.' });
    }

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

// 3. RECIBIR LA MERCADERÍA (Soporta fecha de vencimiento por lote, ofertas gratis y faltantes)
export const recibirPlan = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const { detallesRecibidos, metodoPago = 'EFECTIVO' } = req.body;

  if (!Array.isArray(detallesRecibidos)) {
    return res.status(400).json({ message: 'Debes enviar el detalle de cantidades recibidas.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
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

      // Mapa indexado por detalleId con cantidad recibida y fecha de vencimiento opcional
      const mapaRecibidos = new Map();
      for (const item of detallesRecibidos) {
        const detId = parseInt(item.detalleId, 10);
        if (!Number.isNaN(detId)) {
          mapaRecibidos.set(detId, {
            cantidad: parseInt(item.cantidadRecibida, 10) || 0,
            fechaVencimiento: item.fechaVencimiento || null
          });
        }
      }

      let totalReal = 0;

      for (const detalleOriginal of plan.detalles) {
        const infoRecibida = mapaRecibidos.get(detalleOriginal.id) || { cantidad: 0, fechaVencimiento: null };
        const cantidadIngresada = infoRecibida.cantidad;

        if (cantidadIngresada < 0) {
          throw new Error('La cantidad recibida no puede ser negativa.');
        }
        if (cantidadIngresada > detalleOriginal.cantidadEsperada) {
          throw new Error(
            `No puedes recibir más de lo solicitado (${detalleOriginal.cantidadEsperada} un.).`
          );
        }

        const fechaVencObj = cantidadIngresada > 0
          ? parsearFechaVencimiento(infoRecibida.fechaVencimiento)
          : null;

        const costoUnitario = Number(detalleOriginal.precioCompra || 0);
        const esRegalo = costoUnitario === 0;

        totalReal += cantidadIngresada * costoUnitario;

        await tx.detallePlanCompra.update({
          where: { id: detalleOriginal.id },
          data: {
            cantidadRecibida: cantidadIngresada,
            fechaVencimiento: fechaVencObj
          }
        });

        if (cantidadIngresada > 0) {
          // Leemos el stock actual antes de sumar para preservar el lote viejo sin sobrescribirlo
          const productoActual = await tx.producto.findUnique({
            where: { id: detalleOriginal.productoId },
            select: { stock: true }
          });

          await agregarStockALote(
            tx,
            detalleOriginal.productoId,
            cantidadIngresada,
            fechaVencObj,
            productoActual?.stock ?? 0
          );

          await tx.producto.update({
            where: { id: detalleOriginal.productoId },
            data: {
              stock: { increment: cantidadIngresada },
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

      const planActualizado = await tx.planCompra.update({
        where: { id: plan.id },
        data: {
          estado: 'RECIBIDO',
          fechaRecibido: new Date(),
          totalReal
        },
        include: { proveedor: true, detalles: true }
      });

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

    res.json({ message: 'Mercadería recibida, stock, lotes y caja actualizados', plan: resultado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};