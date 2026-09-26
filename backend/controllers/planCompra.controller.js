import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los planes de compra
export const obtenerPlanes = async (req, res) => {
  try {
    const planes = await prisma.planCompra.findMany({
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
  const { proveedorId, fechaEsperada, detalles } = req.body; 

  try {
    // Calculamos el total proyectado de la nota
    const totalEsperado = detalles.reduce((sum, item) => sum + (item.cantidadEsperada * item.precioCompra), 0);

    const nuevoPlan = await prisma.planCompra.create({
      data: {
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

// 3. RECIBIR LA MERCADERÍA (La función mágica que suma el stock)
export const recibirPlan = async (req, res) => {
  const { id } = req.params;
  const { detallesRecibidos } = req.body; 

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Verificamos que el plan exista y no haya sido recibido antes
      const plan = await tx.planCompra.findUnique({ where: { id: parseInt(id) } });
      if (!plan) throw new Error('Plan no encontrado');
      if (plan.estado === 'RECIBIDO') throw new Error('Este pedido ya fue ingresado al sistema anteriormente');

      let totalReal = 0;

      // B. Procesamos cada producto de la lista
      for (const item of detallesRecibidos) {
        const cantidadIngresada = parseInt(item.cantidadRecibida);
        const costoUnitario = parseFloat(item.precioCompra);

        // Sumamos al costo total real de la factura
        totalReal += (cantidadIngresada * costoUnitario);

        // Actualizamos la fila del detalle en la nota de compra
        await tx.detallePlanCompra.update({
          where: { id: parseInt(item.detalleId) },
          data: { cantidadRecibida: cantidadIngresada }
        });

        // C. SI LLEGÓ MERCADERÍA, ACTUALIZAMOS EL STOCK Y EL HISTORIAL
        if (cantidadIngresada > 0) {
          // Sumar inventario Y actualizar el nuevo costo de compra
          await tx.producto.update({
            where: { id: parseInt(item.productoId) },
            data: { 
              stock: { increment: cantidadIngresada },
              precioCompra: costoUnitario
            }
          });

          // Registrar el movimiento para que la IA lo sepa
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

      return planActualizado;
    });

    res.json({ message: 'Mercadería recibida y stock actualizado', plan: resultado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};