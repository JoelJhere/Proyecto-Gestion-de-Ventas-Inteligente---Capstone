import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Función para detectar nombres duplicados aunque varíen en conectores o espacios
const normalizarNombreProducto = (texto = '') => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/\b(de|del|con|la|el|los|las|en|para|por)\b/g, ' ') // Quita conectores
    .replace(/(\d+)\s+(ml|l|lt|lts|gr|g|kg|un|und|oz)\b/g, '$1$2')
    .replace(/[^a-z0-9.]/g, ' ') // Limpia símbolos raros
    .replace(/\s+/g, ' ')
    .trim();
};

// 1. Obtener todos los productos (SOLO DE LA BODEGA ACTUAL)
export const obtenerProductos = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const productos = await prisma.producto.findMany({
      where: { negocioId: negocioId }, // Filtro SaaS
      include: { proveedor: true }, 
      orderBy: { id: 'desc' }
    });
    res.json(productos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener productos', error: error.message });
  }
};

// 2. Crear un producto nuevo (Amarrado al negocioId actual)
export const crearProducto = async (req, res) => {
  const negocioId = req.user.negocioId;
  let { codigo, nombre, categoria, precioCompra, precioVenta, stock, proveedorId, stockMinimo, unidadMedida } = req.body;

  if (!codigo || codigo.trim() === '') {
    codigo = 'AJ-' + Math.floor(100000 + Math.random() * 900000);
  }

  try {
    // Validar que no exista un producto con el mismo nombre normalizado en esta bodega
    const productosDeBodega = await prisma.producto.findMany({
      where: { negocioId: negocioId },
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
      
      // A. Creamos el producto base inyectando el negocioId
      const producto = await tx.producto.create({
        data: {
          codigo,
          nombre,
          categoria,
          precioCompra: precioCompra ? parseFloat(precioCompra) : null,
          precioVenta: parseFloat(precioVenta),
          stock: parseInt(stock) || 0,
          stockMinimo: stockMinimo !== undefined ? parseInt(stockMinimo) : 3,
          unidadMedida: unidadMedida || "Unidades",
          proveedorId: proveedorId ? parseInt(proveedorId) : null,
          negocioId: negocioId, // Amarramos el producto al negocio del dueño
        },
      });

      // B. Si nos enviaron un stock inicial mayor a 0, registramos el motivo
      if (producto.stock > 0) {
        await tx.movimientoInventario.create({
          data: {
            productoId: producto.id,
            tipo: 'ABASTECIMIENTO',
            cantidad: producto.stock,
            motivo: 'Stock inicial al registrar producto',
          },
        });
      }

      return producto;
    });

    res.status(201).json({ message: 'Producto registrado exitosamente', producto: nuevoProducto });
  } catch (error) {
    // Si el usuario intenta usar un código de barras que ya existe EN SU MISMA BODEGA
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Error: Este código de producto ya existe en tu inventario.' });
    }
    res.status(500).json({ message: 'Error al crear producto', error: error.message });
  }
};

// 3. Editar información básica del producto (Verificando propiedad)
export const actualizarProducto = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;
  const productoId = parseInt(id);
  const { codigo, nombre, categoria, precioCompra, precioVenta, proveedorId, stockMinimo, unidadMedida } = req.body; 

  try {
    // Verificar que el producto pertenezca a esta bodega
    const productoExistente = await prisma.producto.findFirst({
      where: { id: productoId, negocioId: negocioId }
    });

    if (!productoExistente) {
      return res.status(404).json({ message: 'Producto no encontrado en tu inventario.' });
    }

    const codigoFinal = codigo && codigo.trim() !== '' ? codigo.trim() : productoExistente.codigo;

    // Si cambió el código, verificamos que no lo tenga otro producto de su misma bodega
    if (codigoFinal !== productoExistente.codigo) {
      const codigoRepetido = await prisma.producto.findFirst({
        where: {
          negocioId: negocioId,
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
        proveedorId: proveedorId ? parseInt(proveedorId) : null,
        ...(stockMinimo !== undefined && { stockMinimo: parseInt(stockMinimo) }),
        ...(unidadMedida && { unidadMedida }),
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
  const negocioId = req.user.negocioId;
  const { tipo, cantidad, motivo } = req.body;
  const cantidadNum = parseInt(cantidad);

  if (cantidadNum <= 0) {
    return res.status(400).json({ message: 'La cantidad debe ser mayor a 0' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // A. Obtenemos el producto validando que sea de esta bodega
      const productoActual = await tx.producto.findFirst({ 
        where: { id: parseInt(id), negocioId: negocioId } 
      });
      if (!productoActual) throw new Error('Producto no encontrado en tu bodega');

      // B. Calculamos el nuevo stock dependiendo de la acción
      let nuevoStock = productoActual.stock;
      if (tipo === 'ABASTECIMIENTO' || tipo === 'DEVOLUCION') {
        nuevoStock += cantidadNum;
      } else if (tipo === 'AJUSTE_NEGATIVO' || tipo === 'MERMA') {
        nuevoStock -= cantidadNum;
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
  const negocioId = req.user.negocioId;

  try {
    const producto = await prisma.producto.findFirst({ 
      where: { id: parseInt(id), negocioId: negocioId } 
    });

    if (!producto) {
      return res.status(404).json({ message: 'Producto no encontrado.' });
    }

    const productoActualizado = await prisma.producto.update({
      where: { id: parseInt(id) },
      data: { estado: !producto.estado }, 
    });
    res.json({ message: 'Estado del producto actualizado', producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado', error: error.message });
  }
};

// 6. Obtener Catálogo Global (Solo productos escaneados sin prefijo AJ- y Categorías globales)
export const obtenerCatalogoGlobal = async (req, res) => {
  try {
    // A. Obtenemos todos los productos para extraer categorías globales y códigos escaneados
    const todosLosProductos = await prisma.producto.findMany({
      select: {
        codigo: true,
        nombre: true,
        categoria: true,
        precioCompra: true,
        precioVenta: true,
        unidadMedida: true,
      },
      orderBy: { id: 'asc' } // Tomamos el registro original como plantilla base
    });

    // B. Extraemos categorías únicas globales (sin repetir mayúsculas/minúsculas)
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

    // C. Filtramos SOLO los productos escaneados (los que NO tienen código interno 'AJ-')
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