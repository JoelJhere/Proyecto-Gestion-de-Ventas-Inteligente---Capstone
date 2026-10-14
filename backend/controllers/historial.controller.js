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
      negocioId: negocioId // Filtrar por el negocio del usuario autenticado
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

// --- OBTENER FLUJO DE CAJA Y DATOS PARA EL GRÁFICO ---
export const obtenerFlujoCaja = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const [negocio, movimientos] = await prisma.$transaction([
      prisma.negocio.findUnique({
        where: { id: negocioId },
        select: { saldoCaja: true, nombre: true }
      }),
      prisma.movimientoCaja.findMany({
        where: { negocioId: negocioId },
        orderBy: { createdAt: 'desc' },
        take: 100
      })
    ]);

    // Calculamos totales por tipo y por billetera (Efectivo vs Digital)
    let totalIngresosCaja = 0;
    let totalEgresosCaja = 0;
    let netoEfectivo = 0;
    let netoDigital = 0;

    movimientos.forEach((m) => {
      const factor = m.tipo === 'INGRESO' ? 1 : -1;
      if (m.tipo === 'INGRESO') totalIngresosCaja += m.monto;
      else totalEgresosCaja += m.monto;

      if (m.metodoPago === 'EFECTIVO') {
        netoEfectivo += m.monto * factor;
      } else if (m.metodoPago === 'YAPE_PLIN' || m.metodoPago === 'TRANSFERENCIA') {
        netoDigital += m.monto * factor;
      }
    });

    res.status(200).json({
      saldoCaja: negocio?.saldoCaja || 0,
      resumenCaja: {
        totalIngresosCaja,
        totalEgresosCaja,
        netoEfectivo,
        netoDigital
      },
      movimientos
    });
  } catch (error) {
    console.error('Error al obtener flujo de caja:', error);
    res.status(500).json({ message: 'Error al cargar el flujo de caja.' });
  }
};

// --- REGISTRAR CAPITAL INICIAL O GASTO/RETIRO PERSONAL ---
export const registrarMovimientoManual = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { tipo, categoria, monto, metodoPago, descripcion } = req.body;
  const montoNum = parseFloat(monto);

  if (!montoNum || montoNum <= 0) {
    return res.status(400).json({ message: 'El monto debe ser mayor a S/ 0.00' });
  }
  if (!descripcion || !descripcion.trim()) {
    return res.status(400).json({ message: 'Ingresa una descripción o motivo.' });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const negocio = await tx.negocio.findUnique({ where: { id: negocioId } });
      if (!negocio) throw new Error('Negocio no encontrado');

      const saldoActual = negocio.saldoCaja || 0;
      const nuevoSaldo = tipo === 'INGRESO' 
        ? saldoActual + montoNum 
        : saldoActual - montoNum;

      if (tipo === 'EGRESO' && nuevoSaldo < 0) {
        throw new Error(`Fondos insuficientes en caja. Saldo actual: S/ ${saldoActual.toFixed(2)}`);
      }

      await tx.negocio.update({
        where: { id: negocioId },
        data: { saldoCaja: nuevoSaldo }
      });

      const nuevoMovimiento = await tx.movimientoCaja.create({
        data: {
          negocioId,
          tipo, // 'INGRESO' o 'EGRESO'
          categoria: categoria || (tipo === 'INGRESO' ? 'CAPITAL_INICIAL' : 'GASTO_PERSONAL'),
          monto: montoNum,
          saldoResultante: nuevoSaldo,
          metodoPago: metodoPago || 'EFECTIVO',
          descripcion: descripcion.trim()
        }
      });

      return { nuevoSaldo, nuevoMovimiento };
    });

    res.status(201).json({
      message: tipo === 'INGRESO' ? 'Capital agregado a la caja.' : 'Gasto/Retiro descontado de la caja.',
      ...resultado
    });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Error al registrar el movimiento de caja.' });
  }
};