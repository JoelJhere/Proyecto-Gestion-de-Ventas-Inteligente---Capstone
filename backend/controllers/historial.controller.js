import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const obtenerHistorialVentas = async (req, res) => {
  try {
    // 1. Recibir parámetros de la URL
    const { 
      pagina = 1, 
      limite = 25, 
      busqueda = '', 
      fechaInicio, 
      fechaFin 
    } = req.query;

    const page = parseInt(pagina);
    const take = parseInt(limite);
    const skip = (page - 1) * take;

    // 2. Construir la consulta dinámica (Filtros)
    const whereClause = {};

    // A. Filtro por Rango de Fechas
    if (fechaInicio || fechaFin) {
      whereClause.createdAt = {};
      if (fechaInicio) {
        whereClause.createdAt.gte = new Date(`${fechaInicio}T00:00:00.000Z`);
      }
      if (fechaFin) {
        // Aseguramos cubrir hasta el último segundo del día final
        const dateFin = new Date(`${fechaFin}T23:59:59.999Z`);
        whereClause.createdAt.lte = dateFin; 
      }
    }

    // B. Filtro de Búsqueda de Texto (Nombre, Documento o N° Comprobante)
    if (busqueda && busqueda.trim() !== '') {
      whereClause.OR = [
        { clienteNombre: { contains: busqueda, mode: 'insensitive' } },
        { clienteDocumento: { contains: busqueda, mode: 'insensitive' } },
        { numeroComprobante: { contains: busqueda, mode: 'insensitive' } }
      ];
    }

    // 3. Consultar la Base de Datos (Paginado)
    const [totalVentas, ventas] = await prisma.$transaction([
      prisma.venta.count({ where: whereClause }), // Cuenta cuántas hay en total
      prisma.venta.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' }, // Las más recientes primero
        include: {
          vendedor: {
            select: { nombre: true } // Traemos quién la vendió
          },
          detalles: {
            include: {
              producto: {
                select: { nombre: true, codigo: true, unidadMedida: true }
              }
            }
          },
          // Si fue fiado, traemos info extra opcional
          cuentaPorCobrar: {
            select: { estado: true }
          }
        }
      })
    ]);

    // 4. Calcular métricas para las "Tarjetas de Resumen (Top)"
    // Hacemos una suma rápida del total vendido en el filtro actual
    const agregaciones = await prisma.venta.aggregate({
      where: whereClause,
      _sum: { total: true },
      _count: { id: true }
    });

    const totalIngresos = agregaciones._sum.total || 0;
    const cantidadOperaciones = agregaciones._count.id;

    // 5. Devolver Respuesta al Frontend
    res.status(200).json({
      datos: ventas,
      resumen: {
        totalIngresos,
        cantidadOperaciones
      },
      paginacion: {
        totalRegistros: totalVentas,
        totalPaginas: Math.ceil(totalVentas / take),
        paginaActual: page,
        limitePorPagina: take,
        hayMas: page < Math.ceil(totalVentas / take)
      }
    });

  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ message: 'Error interno al cargar el historial de ventas.' });
  }
};