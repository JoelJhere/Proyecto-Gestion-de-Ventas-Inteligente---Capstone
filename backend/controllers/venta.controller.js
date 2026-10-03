import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const crearVenta = async (req, res) => {
  const { carrito, tipoComprobante, subtotal, igv, total } = req.body;
  const vendedorId = req.user.id; // Extraído de tu auth.middleware.js

  if (!carrito || carrito.length === 0) {
    return res.status(400).json({ message: 'El carrito está vacío' });
  }

  try {
    // Mapeo estricto a tu Enum 'TipoDocumento' del schema.prisma
    let tipoDocDB = 'SIN_COMPROBANTE';
    if (tipoComprobante === 'BOLETA') tipoDocDB = 'BOLETA';
    if (tipoComprobante === 'FACTURA') tipoDocDB = 'FACTURA';

    // Transacción de Prisma (Asegura que si algo falla, no se descuente stock por error)
    const nuevaVenta = await prisma.$transaction(async (tx) => {
      
      // 1. Crear la cabecera en el modelo 'Venta'
      const venta = await tx.venta.create({
        data: {
          vendedorId: parseInt(vendedorId),
          tipoComprobante: tipoDocDB,
          numeroComprobante: `${tipoDocDB.charAt(0)}-${Date.now()}`,
          subtotal: parseFloat(subtotal),
          igv: parseFloat(igv),
          total: parseFloat(total),
        }
      });

      // 2. Procesar detalles y stock
      for (const item of carrito) {
        // Validación de stock real
        const productoDB = await tx.producto.findUnique({ where: { id: item.id } });
        if (productoDB.stock < item.cantidad) {
          throw new Error(`Stock insuficiente para: ${item.nombre}`);
        }

        // Crear registro en 'DetalleVenta'
        await tx.detalleVenta.create({
          data: {
            ventaId: venta.id,
            productoId: item.id,
            cantidad: item.cantidad,
            precioVenta: parseFloat(item.precioVenta),
            subtotal: parseFloat(item.precioVenta) * item.cantidad
          }
        });

        // Actualizar stock en 'Producto'
        await tx.producto.update({
          where: { id: item.id },
          data: { stock: { decrement: item.cantidad } }
        });

        // Registrar en 'MovimientoInventario' (Usando tu Enum TipoMovimiento 'VENTA')
        await tx.movimientoInventario.create({
          data: {
            productoId: item.id,
            tipo: 'VENTA',
            cantidad: item.cantidad,
            motivo: `Venta POS #${venta.id}`
          }
        });
      }

      return venta;
    });

    res.status(201).json({ message: 'Venta procesada con éxito', venta: nuevaVenta });
  } catch (error) {
    console.error('Error procesando venta:', error);
    res.status(400).json({ message: error.message || 'Error interno al procesar la venta' });
  }
};