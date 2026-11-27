import { PrismaClient } from '@prisma/client';
import {
  parsearFechaVencimiento,
  claveFechaDia,
  sincronizarLotesConStock,
  agregarStockALote,
  descontarStockFEFO,
  enriquecerProductoConVencimiento
} from '../utils/lotes.util.js';

const prisma = new PrismaClient();

// Función para detectar nombres duplicados aunque varíen en conectores o espacios
const normalizarNombreProducto = (texto = '') => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(de|del|con|la|el|los|las|en|para|por)\b/g, ' ')
    .replace(/(\d+)\s+(ml|l|lt|lts|gr|g|kg|un|und|oz)\b/g, '$1$2')
    .replace(/[^a-z0-9.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// 1. Obtener todos los productos (SOLO DE LA BODEGA ACTUAL, con lotes y estado de vencimiento)
export const obtenerProductos = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const productos = await prisma.producto.findMany({
      where: { negocioId },
      include: {
        proveedor: true,
        lotes: {
          where: { cantidad: { gt: 0 } },
          orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }]
        }
      },
      orderBy: { id: 'desc' }
    });

    res.json(productos.map(enriquecerProductoConVencimiento));
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

// 2. Crear un producto nuevo (Amarrado al negocioId actual + fecha de vencimiento inicial opcional)
export const crearProducto = async (req, res) => {
  const negocioId = req.user.negocioId;
  let {
    codigo,
    nombre,
    categoria,
    precioCompra,
    precioVenta,
    stock,
    proveedorId,
    stockMinimo,
    unidadMedida,
    fechaVencimiento
  } = req.body;

  if (!codigo || codigo.trim() === '') {
    codigo = 'AJ-' + Math.floor(100000 + Math.random() * 900000);
  }

  try {
    const fechaVencObj = parsearFechaVencimiento(fechaVencimiento);

    // Validar que no exista un producto con el mismo nombre normalizado en esta bodega
    const productosDeBodega = await prisma.producto.findMany({
      where: { negocioId },
      select: { id: true, nombre: true, codigo: true }
    });

    const nombreNormalizadoNuevo = normalizarNombreProducto(nombre);
    const posibleDuplicado = productosDeBodega.find(
      p => normalizarNombreProducto(p.nombre) === nombreNormalizadoNuevo
    );

    if (posibleDuplicado) {
      return res.status(400).json({
        message: `Ya tienes registrado este producto en tu inventario como "${posibleDuplicado.nombre}" (Cód: ${posibleDuplicado.codigo}).`
      });
    }

    const nuevoProducto = await prisma.$transaction(async (tx) => {
      const stockInicial = parseInt(stock, 10) || 0;

      const producto = await tx.producto.create({
        data: {
          codigo,
          nombre,
          categoria,
          precioCompra: precioCompra ? parseFloat(precioCompra) : null,
          precioVenta: parseFloat(precioVenta),
          stock: stockInicial,
          stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo, 10) : 3,
          unidadMedida: unidadMedida || 'Unidades',
          proveedorId: proveedorId ? parseInt(proveedorId, 10) : null,
          negocioId
        }
      });

      if (producto.stock > 0) {
        await tx.loteProducto.create({
          data: {
            productoId: producto.id,
            cantidad: producto.stock,
            fechaVencimiento: fechaVencObj
          }
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            tipo: 'ABASTECIMIENTO',
            cantidad: producto.stock,
            motivo: 'Stock inicial al registrar producto'
          }
        });
      }

      return producto;
    });

    res.status(201).json({ message: 'Producto registrado exitosamente', producto: nuevoProducto });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Error: Este código de producto ya existe en tu inventario.' });
    }
    res.status(400).json({ message: error.message || 'Error al crear producto' });
  }
};

// 3. Editar información básica del producto (Verificando propiedad)
export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const productoId = parseInt(id, 10);
  const { codigo, nombre, categoria, precioCompra, precioVenta, proveedorId, stockMinimo, unidadMedida } = req.body;

  try {
    const productoExistente = await prisma.producto.findFirst({
      where: { id: productoId, negocioId }
    });

    if (!productoExistente) {
      return res.status(404).json({ message: 'Producto no encontrado en tu inventario.' });
    }

    const codigoFinal = codigo && codigo.trim() !== '' ? codigo.trim() : productoExistente.codigo;

    if (codigoFinal !== productoExistente.codigo) {
      const codigoRepetido = await prisma.producto.findFirst({
        where: {
          negocioId,
          codigo: codigoFinal,
          id: { not: productoId }
        }
      });

      if (codigoRepetido) {
        return res.status(400).json({
          message: `El código "${codigoFinal}" ya está asignado a otro producto de tu inventario (${codigoRepetido.nombre}).`
        });
      }
    }

    const productoActualizado = await prisma.producto.update({
      where: { id: productoId },
      data: {
        codigo: codigoFinal,
        nombre,
        categoria,
        precioCompra: precioCompra ? parseFloat(precioCompra) : null,
        precioVenta: parseFloat(precioVenta),
        proveedorId: proveedorId ? parseInt(proveedorId, 10) : null,
        ...(stockMinimo !== undefined && { stockMinimo: parseInt(stockMinimo, 10) }),
        ...(unidadMedida && { unidadMedida })
      }
    });

    res.json({ message: 'Producto actualizado exitosamente', producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar producto', error: error.message });
  }
};

// 4. Gestionar Stock (Soporta fechaVencimiento al abastecer y baja por loteId o FEFO al descontar)
export const gestionarStock = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const productoId = parseInt(id, 10);
  const { tipo, cantidad, motivo, fechaVencimiento, loteId } = req.body;
  const cantidadNum = parseInt(cantidad, 10);

  if (Number.isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const productoActual = await tx.producto.findFirst({
        where: { id: productoId, negocioId }
      });
      if (!productoActual) throw new Error('Producto no encontrado en tu bodega');

      let nuevoStock = productoActual.stock;
      const esEntrada = tipo === 'ABASTECIMIENTO' || tipo === 'DEVOLUCION';
      const esSalida = tipo === 'AJUSTE_NEGATIVO' || tipo === 'MERMA';

      if (!esEntrada && !esSalida) {
        throw new Error('Tipo de movimiento de stock inválido.');
      }

      if (esEntrada) {
        nuevoStock += cantidadNum;
        await agregarStockALote(tx, productoId, cantidadNum, fechaVencimiento, productoActual.stock);
      } else {
        nuevoStock -= cantidadNum;
        if (nuevoStock < 0) throw new Error('No puedes tener stock negativo');

        if (loteId) {
          // Baja directa de un lote específico (ej. merma de un lote vencido)
          await sincronizarLotesConStock(tx, productoId, productoActual.stock);
          const lote = await tx.loteProducto.findFirst({
            where: { id: parseInt(loteId, 10), productoId }
          });
          if (!lote) throw new Error('Lote no encontrado para este producto.');
          if (cantidadNum > lote.cantidad) {
            throw new Error(`El lote seleccionado solo tiene ${lote.cantidad} unidad(es).`);
          }
          if (cantidadNum === lote.cantidad) {
            await tx.loteProducto.delete({ where: { id: lote.id } });
          } else {
            await tx.loteProducto.update({
              where: { id: lote.id },
              data: { cantidad: lote.cantidad - cantidadNum }
            });
          }
        } else {
          // Descuento automático priorizando lo más próximo a vencer (FEFO)
          await descontarStockFEFO(tx, productoId, cantidadNum, productoActual.stock);
        }
      }

      const productoActualizado = await tx.producto.update({
        where: { id: productoId },
        data: { stock: nuevoStock }
      });

      // El enum TipoMovimiento en Prisma no incluye 'MERMA', se registra como 'AJUSTE_NEGATIVO'
      const tipoPrisma = tipo === 'MERMA' ? 'AJUSTE_NEGATIVO' : tipo;

      await tx.movimientoInventario.create({
        data: {
          productoId,
          tipo: tipoPrisma,
          cantidad: cantidadNum,
          motivo: motivo || (tipo === 'MERMA' ? 'Baja por vencimiento / merma' : 'Actualización manual de stock')
        }
      });

      return productoActualizado;
    });

    res.json({ message: 'Inventario actualizado correctamente', producto: resultado });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// 5. Asignar fecha de vencimiento a stock existente que aún no tiene fecha (Botón "+ Fecha")
export const asignarFechaLote = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const productoId = parseInt(id, 10);
  const { fechaVencimiento, cantidad } = req.body;

  try {
    const fechaObj = parsearFechaVencimiento(fechaVencimiento);
    if (!fechaObj) {
      return res.status(400).json({ message: 'Debes seleccionar una fecha de vencimiento válida.' });
    }

    const productoActualizado = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({
        where: { id: productoId, negocioId }
      });
      if (!producto) throw new Error('Producto no encontrado en tu inventario.');
      if (producto.stock <= 0) {
        throw new Error('Este producto no tiene stock disponible para asignar una fecha.');
      }

      await sincronizarLotesConStock(tx, productoId, producto.stock);

      const loteSinFecha = await tx.loteProducto.findFirst({
        where: { productoId, fechaVencimiento: null, cantidad: { gt: 0 } }
      });
      if (!loteSinFecha) {
        throw new Error('Todo el stock de este producto ya tiene fecha de vencimiento asignada.');
      }

      const cantAsignar = cantidad !== undefined && cantidad !== '' && cantidad !== null
        ? parseInt(cantidad, 10)
        : loteSinFecha.cantidad;

      if (Number.isNaN(cantAsignar) || cantAsignar <= 0) {
        throw new Error('La cantidad debe ser mayor a 0.');
      }
      if (cantAsignar > loteSinFecha.cantidad) {
        throw new Error(`Solo tienes ${loteSinFecha.cantidad} unidad(es) sin fecha para asignar.`);
      }

      // Reducimos o eliminamos el lote sin fecha
      if (cantAsignar === loteSinFecha.cantidad) {
        await tx.loteProducto.delete({ where: { id: loteSinFecha.id } });
      } else {
        await tx.loteProducto.update({
          where: { id: loteSinFecha.id },
          data: { cantidad: loteSinFecha.cantidad - cantAsignar }
        });
      }

      // Sumamos al lote con esa fecha (o creamos uno nuevo si no existe)
      const claveObjetivo = claveFechaDia(fechaObj);
      const otrosLotes = await tx.loteProducto.findMany({
        where: { productoId, cantidad: { gt: 0 } }
      });
      const loteMismaFecha = otrosLotes.find(l => claveFechaDia(l.fechaVencimiento) === claveObjetivo);

      if (loteMismaFecha) {
        await tx.loteProducto.update({
          where: { id: loteMismaFecha.id },
          data: { cantidad: { increment: cantAsignar } }
        });
      } else {
        await tx.loteProducto.create({
          data: {
            productoId,
            cantidad: cantAsignar,
            fechaVencimiento: fechaObj
          }
        });
      }

      return tx.producto.findUnique({
        where: { id: productoId },
        include: {
          proveedor: true,
          lotes: { where: { cantidad: { gt: 0 } }, orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }] }
        }
      });
    });

    res.json({
      message: 'Fecha de vencimiento asignada correctamente.',
      producto: enriquecerProductoConVencimiento(productoActualizado)
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error al asignar fecha de vencimiento.' });
  }
};

// 6. Corregir o quitar la fecha de un lote existente (fusión automática si coincide con otro lote)
export const actualizarFechaLote = async (req, res) => {
  const { id, loteId } = req.params;
  const negocioId = req.user.negocioId;
  const productoId = parseInt(id, 10);
  const loteIdNum = parseInt(loteId, 10);
  const { fechaVencimiento } = req.body;

  try {
    const fechaObj = parsearFechaVencimiento(fechaVencimiento);

    const productoActualizado = await prisma.$transaction(async (tx) => {
      const producto = await tx.producto.findFirst({
        where: { id: productoId, negocioId }
      });
      if (!producto) throw new Error('Producto no encontrado en tu inventario.');

      const lote = await tx.loteProducto.findFirst({
        where: { id: loteIdNum, productoId }
      });
      if (!lote) throw new Error('Lote no encontrado.');

      const claveNueva = claveFechaDia(fechaObj);
      const otrosLotes = await tx.loteProducto.findMany({
        where: { productoId, id: { not: lote.id }, cantidad: { gt: 0 } }
      });

      const loteDestino = otrosLotes.find(l => claveFechaDia(l.fechaVencimiento) === claveNueva);

      if (loteDestino) {
        // Si ya existía un lote con esa fecha, los unificamos sumando sus unidades
        await tx.loteProducto.update({
          where: { id: loteDestino.id },
          data: { cantidad: { increment: lote.cantidad } }
        });
        await tx.loteProducto.delete({ where: { id: lote.id } });
      } else {
        await tx.loteProducto.update({
          where: { id: lote.id },
          data: { fechaVencimiento: fechaObj }
        });
      }

      return tx.producto.findUnique({
        where: { id: productoId },
        include: {
          proveedor: true,
          lotes: { where: { cantidad: { gt: 0 } }, orderBy: [{ fechaVencimiento: 'asc' }, { id: 'asc' }] }
        }
      });
    });

    res.json({
      message: 'Fecha del lote actualizada correctamente.',
      producto: enriquecerProductoConVencimiento(productoActualizado)
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error al actualizar fecha del lote.' });
  }
};

// 7. Habilitar o Deshabilitar Producto (Soft Delete)
export const toggleEstadoProducto = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;

  try {
    const producto = await prisma.producto.findFirst({
      where: { id: parseInt(id, 10), negocioId }
    });

    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const productoActualizado = await prisma.producto.update({
      where: { id: parseInt(id, 10) },
      data: { estado: !producto.estado }
    });
    res.json({ message: 'Estado del producto actualizado', producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
  }
};

// 8. Obtener Catálogo Global (Solo productos escaneados sin prefijo AJ- y Categorías globales)
export const obtenerCatalogoGlobal = async (req, res) => {
  try {
    const todosLosProductos = await prisma.producto.findMany({
      select: {
        codigo: true,
        nombre: true,
        categoria: true,
        precioCompra: true,
        precioVenta: true,
        unidadMedida: true
      },
      orderBy: { id: 'asc' }
    });

    const mapaCategorias = new Map();
    ['Bebidas', 'Abarrotes', 'Lácteos', 'Snacks', 'Limpieza', 'Cuidado Personal'].forEach(cat => {
      mapaCategorias.set(cat.toLowerCase(), cat);
    });

    todosLosProductos.forEach(p => {
      if (p.categoria && p.categoria.trim() !== '') {
        const clave = p.categoria.trim().toLowerCase();
        if (!mapaCategorias.has(clave)) {
          mapaCategorias.set(clave, p.categoria.trim());
        }
      }
    });

    const mapaProductosEscaneados = new Map();
    todosLosProductos.forEach(p => {
      const cod = (p.codigo || '').trim();
      const esCodigoInterno = cod.toUpperCase().startsWith('AJ-');
      if (cod && !esCodigoInterno && !mapaProductosEscaneados.has(cod)) {
        mapaProductosEscaneados.set(cod, {
          codigo: cod,
          nombre: p.nombre,
          categoria: p.categoria || '',
          precioCompra: p.precioCompra || '',
          precioVenta: p.precioVenta || '',
          unidadMedida: p.unidadMedida || 'Unidades'
        });
      }
    });

    res.json({
      categoriasGlobales: Array.from(mapaCategorias.values()).sort(),
      productosGlobales: Array.from(mapaProductosEscaneados.values())
    });
  } catch (error) {
    console.error('Error al obtener catálogo global:', error);
    res.status(500).json({ message: 'Error al consultar catálogo compartido' });
  }
};