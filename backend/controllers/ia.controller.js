import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// 1. Resumen rápido de alertas para mostrar en la cabecera de la burbuja IA
export const obtenerResumenIA = async (req, res) => {
  const negocioId = req.user.negocioId;

  try {
    const [negocio, productos, fiadosPendientes] = await prisma.$transaction([
      prisma.negocio.findUnique({
        where: { id: negocioId },
        select: { nombre: true, saldoCaja: true }
      }),
      prisma.producto.findMany({
        where: { negocioId, estado: true },
        select: { id: true, nombre: true, stock: true, stockMinimo: true }
      }),
      prisma.cuentaPorCobrar.findMany({
        where: { estado: 'PENDIENTE', cliente: { negocioId } },
        select: { id: true, monto: true, fechaLimite: true }
      })
    ]);

    const productosStockCritico = productos.filter(p => p.stock <= (p.stockMinimo || 3));
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fiadosVencidos = fiadosPendientes.filter(f => {
      if (!f.fechaLimite) return false;
      const limite = new Date(f.fechaLimite);
      limite.setHours(0, 0, 0, 0);
      return limite <= hoy;
    });

    res.json({
      saldoCaja: negocio?.saldoCaja || 0,
      cantidadStockCritico: productosStockCritico.length,
      cantidadFiadosVencidos: fiadosVencidos.length,
      totalPorCobrar: fiadosPendientes.reduce((acc, f) => acc + f.monto, 0)
    });
  } catch (error) {
    console.error('Error al obtener resumen IA:', error);
    res.status(500).json({ message: 'Error al obtener alertas del negocio.' });
  }
};

// 2. Chat Inteligente con contexto real de la bodega (Multi-Tenant)
export const consultarAsistenteIA = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { mensaje, historial = [] } = req.body;

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ message: 'Escribe una consulta para el asistente.' });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return res.status(500).json({ message: 'Falta configurar GEMINI_API_KEY en el servidor.' });
  }

  try {
    // Fechas de referencia (Zona horaria Perú)
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hace7Dias = new Date(inicioHoy);
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // Consultamos ÚNICAMENTE los datos de la bodega actual (negocioId)
    const [negocio, productos, ventasRecientes, fiados, planesCompra, movimientosCaja] = await prisma.$transaction([
      prisma.negocio.findUnique({
        where: { id: negocioId }
      }),
      prisma.producto.findMany({
        where: { negocioId },
        include: { proveedor: { select: { nombre: true, telefono: true } } },
        orderBy: { stock: 'asc' }
      }),
      prisma.venta.findMany({
        where: { negocioId },
        include: {
          detalles: {
            include: { producto: { select: { nombre: true, precioCompra: true } } }
          },
          vendedor: { select: { nombre: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 150
      }),
      prisma.cuentaPorCobrar.findMany({
        where: { estado: 'PENDIENTE', cliente: { negocioId } },
        include: { cliente: true },
        orderBy: { monto: 'desc' }
      }),
      prisma.planCompra.findMany({
        where: { negocioId },
        include: {
          proveedor: { select: { nombre: true } },
          detalles: { include: { producto: { select: { nombre: true } } } }
        },
        orderBy: { fechaCreacion: 'desc' },
        take: 15
      }),
      prisma.movimientoCaja.findMany({
        where: { negocioId },
        orderBy: { createdAt: 'desc' },
        take: 25
      })
    ]);

    // --- PROCESAMIENTO LÓGICO DE MÉTRICAS PARA QUE LA IA NO INVENTE NADA ---
    const ventasHoy = ventasRecientes.filter(v => new Date(v.createdAt) >= inicioHoy);
    const ventasSemana = ventasRecientes.filter(v => new Date(v.createdAt) >= hace7Dias);
    const ventasMes = ventasRecientes.filter(v => new Date(v.createdAt) >= inicioMes);

    const sumarTotal = (lista) => lista.reduce((acc, v) => acc + v.total, 0);

    // Ranking de rotación de productos
    const conteoProductos = {};
    ventasRecientes.forEach(v => {
      v.detalles.forEach(d => {
        const nombreProd = d.producto?.nombre || 'Producto';
        if (!conteoProductos[nombreProd]) {
          conteoProductos[nombreProd] = { unidadesVendidas: 0, ingresosGenerados: 0 };
        }
        conteoProductos[nombreProd].unidadesVendidas += d.cantidad;
        conteoProductos[nombreProd].ingresosGenerados += d.subtotal;
      });
    });

    const rankingProductos = Object.entries(conteoProductos)
      .map(([nombre, data]) => ({ nombre, ...data }))
      .sort((a, b) => b.unidadesVendidas - a.unidadesVendidas);

    // Radiografía de Inventario (Activos)
    const resumenInventario = productos.filter(p => p.estado).map(p => ({
      nombre: p.nombre,
      categoria: p.categoria || 'General',
      stockActual: p.stock,
      stockMinimo: p.stockMinimo || 3,
      alertaAgotamiento: p.stock <= (p.stockMinimo || 3) ? 'URGENTE REABASTECER' : 'OK',
      costoCompra: p.precioCompra ? `S/ ${p.precioCompra.toFixed(2)}` : 'No registrado',
      precioVenta: `S/ ${p.precioVenta.toFixed(2)}`,
      gananciaUnitaria: p.precioCompra ? `S/ ${(p.precioVenta - p.precioCompra).toFixed(2)}` : 'N/A',
      proveedor: p.proveedor?.nombre || 'Sin proveedor asignado'
    }));

    // Radiografía de Fiados Pendientes
    const resumenFiados = fiados.map(f => ({
      vecino: f.cliente.nombre,
      telefono: f.cliente.telefono,
      deuda: `S/ ${f.monto.toFixed(2)}`,
      fechaLimite: f.fechaLimite ? new Date(f.fechaLimite).toLocaleDateString('es-PE') : 'Sin fecha',
      avisosEnviados: f.recordatorios
    }));

    const contextoNegocio = {
      fechaActualPeru: ahora.toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      nombreBodega: negocio?.nombre || 'Mi Bodega',
      capitalDisponibleEnCaja: `S/ ${(negocio?.saldoCaja || 0).toFixed(2)}`,
      metricasVentas: {
        hoy: { cantidadVentas: ventasHoy.length, totalRecaudado: `S/ ${sumarTotal(ventasHoy).toFixed(2)}` },
        ultimos7Dias: { cantidadVentas: ventasSemana.length, totalRecaudado: `S/ ${sumarTotal(ventasSemana).toFixed(2)}` },
        esteMes: { cantidadVentas: ventasMes.length, totalRecaudado: `S/ ${sumarTotal(ventasMes).toFixed(2)}` }
      },
      topProductosMasVendidos: rankingProductos.slice(0, 10),
      inventarioActual: resumenInventario,
      fiadosPendientesDeCobro: {
        cantidadVecinosDeudores: fiados.length,
        montoTotalPorCobrar: `S/ ${fiados.reduce((acc, f) => acc + f.monto, 0).toFixed(2)}`,
        listaDeudores: resumenFiados
      },
      ultimosPlanesDeCompra: planesCompra.map(pc => ({
        pedidoId: pc.id,
        proveedor: pc.proveedor?.nombre,
        estado: pc.estado,
        total: `S/ ${(pc.estado === 'RECIBIDO' ? pc.totalReal : pc.totalEsperado).toFixed(2)}`,
        fecha: new Date(pc.fechaCreacion).toLocaleDateString('es-PE')
      })),
      ultimosMovimientosDeCaja: movimientosCaja.slice(0, 10).map(m => ({
        tipo: m.tipo,
        categoria: m.categoria,
        monto: `S/ ${m.monto.toFixed(2)}`,
        metodo: m.metodoPago,
        descripcion: m.descripcion
      }))
    };

    // --- INSTRUCCIÓN MAESTRA CON CANDADO DE SEGURIDAD TEMÁTICA ---
    const systemPrompt = `
Eres VendaIA, el asesor comercial, logístico y financiero exclusivo de la bodega "${negocio?.nombre || 'la tienda'}".

REGLAS ESTRICTAS E INQUEBRANTABLES:
1. LÍMITE DE TEMA: SOLO puedes responder preguntas relacionadas con el negocio (ventas, inventario, qué productos comprar, proveedores, fiados, flujo de caja, ganancias o consejos para mejorar las ventas de esta bodega).
2. RECHAZO DE TEMAS AJENOS: Si el usuario pregunta sobre política, deportes, fútbol, religión, chistes, farándula, tareas escolares, programación, historia o cualquier tema que NO tenga relación con la gestión de su bodega, NO respondas la pregunta y contesta ÚNICAMENTE con esta frase exacta:
"No puedo responder a esa pregunta, ya que solo estoy programado para ayudarte con las ventas, el inventario y las finanzas de tu negocio."
3. CERO INVENCIÓN DE DATOS: Usa EXCLUSIVAMENTE los datos reales del JSON adjunto. Nunca inventes productos, precios ni ventas que no estén en el JSON. Si te preguntan qué comprar para un mes o semana, analiza qué productos tienen mayor rotación (topProductosMasVendidos), cuáles están con stock bajo (URGENTE REABASTECER), cuánto cuestan y cuánto capital disponible hay en caja (${contextoNegocio.capitalDisponibleEnCaja}).
4. ESTILO DE RESPUESTA: Responde en español claro, directo, amigable y fácil de entender para el dueño de una bodega en Perú (usa soles "S/"). Usa viñetas cortas cuando listes productos o cifras.

DATOS REALES EN TIEMPO REAL DE LA BODEGA:
${JSON.stringify(contextoNegocio)}
`;

    // Formateamos el historial reciente de la conversación para mantener el hilo
    const contents = [
      ...historial.slice(-6).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      })),
      {
        role: 'user',
        parts: [{ text: mensaje }]
      }
    ];

    const payloadGemini = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents,
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 700
      }
    };

    // Llamada directa a la API de Google Gemini (con respaldo automático de modelo)
    let respuestaTexto = '';
    const modelos = ['gemini-2.5-flash', 'gemini-2.0-flash'];

    for (const modelo of modelos) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`;
        const response = await axios.post(url, payloadGemini, {
          headers: { 'Content-Type': 'application/json' }
        });
        respuestaTexto = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (respuestaTexto) break;
      } catch (errModelo) {
        console.warn(`Intento con ${modelo}:`, errModelo.response?.data?.error?.message || errModelo.message);
      }
    }

    if (!respuestaTexto) {
      return res.status(500).json({ message: 'El asistente IA está ocupado en este momento. Intenta en unos segundos.' });
    }

    res.json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error('Error en consultarAsistenteIA:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error al procesar la consulta con el asistente IA.' });
  }
};