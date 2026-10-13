import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const obtenerHistorialVentas = async (req, res) => {
  const negocioId = req.user.negocioId;

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

    // 2. Construir la consulta dinámica (SIEMPRE FILTRADA POR EL NEGOCIO ACTUAL)
    const whereClause = {
      negocioId: negocioId // <-- CLAVE SAAS QUE FALTABA
    };

    // A. Filtro por Rango de Fechas
    if (fechaInicio || fechaFin) {
      whereClause.createdAt = {};
      if (fechaInicio) {
        whereClause.createdAt.gte = new Date(`${fechaInicio}T00:00:00.000Z`);
      }
      if (fechaFin) {
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
      prisma.venta.count({ where: whereClause }),
      prisma.venta.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          vendedor: {
            select: { nombre: true }
          },
          detalles: {
            include: {
              producto: {
                select: { nombre: true, codigo: true, unidadMedida: true }
              }
            }
          },
          cuentaPorCobrar: {
            select: { estado: true }
          }
        }
      })
    ]);

    // 4. Calcular métricas para las "Tarjetas de Resumen (Top)"
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