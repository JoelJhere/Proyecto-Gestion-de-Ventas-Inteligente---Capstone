import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Obtener todos los productos
export const obtenerProductos = async (req, res) => {
  try {
    const productos = await prisma.producto.findMany({
      include: { proveedor: true }, 
      orderBy: { id: 'desc' }
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

// 2. Crear un producto nuevo (Con registro inicial de inventario)
export const crearProducto = async (req, res) => {
  let { codigo, nombre, categoria, precioCompra, precioVenta, stock, proveedorId } = req.body;

  if (!codigo || codigo.trim() === '') {
    codigo = 'AJ-' + Math.floor(100000 + Math.random() * 900000);
  }

  try {
    const nuevoProducto = await prisma.$transaction(async (tx) => {
      
      // A. Creamos el producto base
      const producto = await tx.producto.create({
        data: {
          codigo,
          nombre,
          categoria,
          precioCompra: precioCompra ? parseFloat(precioCompra) : null,
          precioVenta: parseFloat(precioVenta),
          stock: parseInt(stock) || 0,
          proveedorId: proveedorId ? parseInt(proveedorId) : null, // <-- Aseguramos que sea número o null
        },
      });

      // B. Si nos enviaron un stock inicial mayor a 0, registramos el motivo
      if (producto.stock > 0) {
        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            tipo: 'ABASTECIMIENTO', // Etiqueta obligatoria para la IA
            cantidad: producto.stock,
            motivo: 'Stock inicial al registrar producto',
          },
        });
      }

      return producto;
    });

    res.status(201).json({ message: 'Producto registrado exitosamente', producto: nuevoProducto });
  } catch (error) {
    // Si el usuario intenta usar un código de barras que ya está registrado en otro producto
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Error: Este código de producto ya existe en el inventario.' });
    }
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
};

// 3. Editar información básica del producto
export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, precioCompra, precioVenta, proveedorId } = req.body; 

  try {
    const productoActualizado = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: {
        nombre,
        categoria,
        precioCompra: precioCompra ? parseFloat(precioCompra) : null,
        precioVenta: parseFloat(precioVenta),
        proveedorId: proveedorId ? parseInt(proveedorId) : null, // <-- Guardamos la actualización del proveedor
      },
    });
    res.json({ message: 'Producto actualizado exitosamente', producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
};

// 4. Gestionar Stock (Registra el movimiento para la IA)
export const gestionarStock = async (req, res) => {
  const { id } = req.params;
  const { tipo, cantidad, motivo } = req.body; // tipo: 'ABASTECIMIENTO', 'DEVOLUCION', 'AJUSTE_NEGATIVO'
  const cantidadNum = parseInt(cantidad);

  if (cantidadNum <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Obtenemos el producto actual para saber cuánto stock tiene
      const productoActual = await tx.producto.findUnique({ where: { id: parseInt(id) } });
      if (!productoActual) throw new Error('Producto no encontrado');

      // B. Calculamos el nuevo stock dependiendo de la acción
      let nuevoStock = productoActual.stock;
      if (tipo === 'ABASTECIMIENTO' || tipo === 'DEVOLUCION') {
        nuevoStock += cantidadNum; // Suma stock
      } else if (tipo === 'AJUSTE_NEGATIVO' || tipo === 'MERMA') {
        nuevoStock -= cantidadNum; // Resta stock
        if (nuevoStock < 0) throw new Error('No puedes tener stock negativo');
      }

      // C. Actualizamos el stock en el producto
      const productoActualizado = await tx.producto.update({
        where: { id: parseInt(id) },
        data: { stock: nuevoStock },
      });

      // D. Registramos el movimiento histórico obligatoriamente
      await tx.movimientoInventario.create({
        data: {
          productoId: parseInt(id),
          tipo,
          cantidad: cantidadNum,
          motivo: motivo || 'Actualización manual de stock',
        },
      });

      return productoActualizado;
    });

    res.json({ message: 'Inventario actualizado correctamente', producto: resultado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 5. Habilitar o Deshabilitar Producto (Soft Delete)
export const toggleEstadoProducto = async (req, res) => {
  const { id } = req.params;
  try {
    const producto = await prisma.producto.findUnique({ where: { id: parseInt(id) } });
    const productoActualizado = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: { estado: !producto.estado }, 
    });
    res.json({ message: 'Estado del producto actualizado', producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
  }
};