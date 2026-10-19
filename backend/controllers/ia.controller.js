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

// --- MOTOR LÓGICO DE RESPALDO (Analiza los datos reales de la bodega si la API externa falla) ---
const generarAnalisisLocalInteligente = (preguntaRaw, datos) => {
  const texto = preguntaRaw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Candado estricto contra temas ajenos al negocio (Política, deportes, cultura general, etc.)
  const palabrasProhibidas = [
    'futbol', 'mundial', 'deporte', 'partido', 'messi', 'cristiano', 'alianza', 'universitario',
    'politica', 'presidente', 'congreso', 'elecciones', 'votar', 'partido politico', 'alcalde',
    'chiste', 'broma', 'poema', 'cancion', 'pelicula', 'anime', 'juego', 'minecraft',
    'receta', 'cocinar', 'clima', 'religion', 'dios', 'horoscopo', 'novia', 'amor', 'capital de'
  ];

  const palabrasNegocio = [
    'venta', 'vendi', 'semana', 'mes', 'hoy', 'ayer', 'ingreso', 'ganancia', 'rentab',
    'producto', 'stock', 'inventario', 'comprar', 'compre', 'pedido', 'proveedor', 'abastec',
    'fiado', 'deuda', 'debe', 'vecino', 'cobrar', 'caja', 'saldo', 'capital', 'dinero',
    'gasto', 'retiro', 'bodega', 'tienda', 'negocio', 'resumen', 'como me fue', 'como vamos', 'hola', 'ayuda'
  ];

  const contieneProhibida = palabrasProhibidas.some(p => texto.includes(p));
  const contieneNegocio = palabrasNegocio.some(p => texto.includes(p));

  if (contieneProhibida || !contieneNegocio) {
    return 'No puedo responder a esa pregunta, ya que solo estoy programado para ayudarte con las ventas, el inventario y las finanzas de tu negocio.';
  }

  // 2. Respuestas lógicas basadas en la base de datos real de la bodega
  if (texto.includes('comprar') || texto.includes('stock') || texto.includes('agot') || texto.includes('inventario') || texto.includes('abastec') || texto.includes('pedir')) {
    const criticos = datos.productosCriticos;
    const top = datos.rankingProductos.slice(0, 3);
    let resp = `📦 **Análisis de Inventario y Compras (${datos.nombreBodega}):**\n\n`;
    resp += `• **Capital disponible en caja:** S/ ${datos.saldoCaja.toFixed(2)}\n`;

    if (criticos.length > 0) {
      resp += `\n⚠️ **Productos urgentes por comprar (Stock Bajo):**\n`;
      criticos.slice(0, 6).forEach(p => {
        resp += `- **${p.nombre}**: Quedan **${p.stock} un.** (Mínimo: ${p.stockMinimo}) | Costo: S/ ${(p.precioCompra || 0).toFixed(2)} | Prov: ${p.proveedor?.nombre || 'Sin asignar'}\n`;
      });
    } else {
      resp += `\n✅ **Todo tu inventario supera el stock mínimo.** No tienes productos en riesgo de agotamiento inmediato.\n`;
    }

    if (top.length > 0) {
      resp += `\n🔥 **Productos de mayor rotación que te conviene priorizar:**\n`;
      top.forEach(t => {
        resp += `- **${t.nombre}**: ${t.unidadesVendidas} un. vendidas (S/ ${t.ingresosGenerados.toFixed(2)})\n`;
      });
    }
    return resp.trim();
  }

  if (texto.includes('fiado') || texto.includes('debe') || texto.includes('deuda') || texto.includes('vecino') || texto.includes('cobrar')) {
    if (datos.fiados.length === 0) {
      return `✅ **¡Excelente noticia!** Actualmente no tienes ningún vecino con fiados pendientes en **${datos.nombreBodega}**.`;
    }
    const totalFiado = datos.fiados.reduce((acc, f) => acc + f.monto, 0);
    let resp = `📋 **Estado de Cuentas por Cobrar (Fiados):**\n\n`;
    resp += `Tienes **${datos.fiados.length} cuenta(s) pendiente(s)** por un total de **S/ ${totalFiado.toFixed(2)}**:\n\n`;
    datos.fiados.slice(0, 6).forEach(f => {
      const limite = f.fechaLimite ? new Date(f.fechaLimite).toLocaleDateString('es-PE') : 'Sin fecha';
      resp += `• **${f.cliente.nombre}**: Debe **S/ ${f.monto.toFixed(2)}** (Aviso programado: ${limite})\n`;
    });
    return resp.trim();
  }

  if (texto.includes('ganancia') || texto.includes('rentab') || texto.includes('margen')) {
    const conMargen = datos.productosActivos
      .filter(p => p.precioCompra && p.precioCompra > 0)
      .map(p => ({
        nombre: p.nombre,
        ganancia: p.precioVenta - p.precioCompra,
        porcentaje: ((p.precioVenta - p.precioCompra) / p.precioCompra) * 100
      }))
      .sort((a, b) => b.ganancia - a.ganancia);

    if (conMargen.length === 0) {
      return `Aún no tienes productos con costo de compra registrado para calcular la ganancia unitaria.`;
    }
    let resp = `💰 **Productos que te dejan mayor ganancia en ${datos.nombreBodega}:**\n\n`;
    conMargen.slice(0, 5).forEach(p => {
      resp += `• **${p.nombre}**: Ganas **S/ ${p.ganancia.toFixed(2)}** por unidad (+${p.porcentaje.toFixed(0)}%)\n`;
    });
    return resp.trim();
  }

  // Por defecto: Resumen de ventas (hoy, semana, mes) y caja
  let resp = `📊 **Balance de ${datos.nombreBodega}:**\n\n`;
  resp += `• **Ventas de Hoy:** ${datos.ventasHoyCount} operación(es) por **S/ ${datos.totalHoy.toFixed(2)}**\n`;
  resp += `• **Últimos 7 días (Semana):** ${datos.ventasSemanaCount} venta(s) por **S/ ${datos.totalSemana.toFixed(2)}**\n`;
  resp += `• **Acumulado del Mes:** ${datos.ventasMesCount} venta(s) por **S/ ${datos.totalMes.toFixed(2)}**\n`;
  resp += `• **Capital actual en Caja:** **S/ ${datos.saldoCaja.toFixed(2)}**\n`;

  if (datos.rankingProductos.length > 0) {
    const estrella = datos.rankingProductos[0];
    resp += `\n🏆 **Producto más vendido:** ${estrella.nombre} (${estrella.unidadesVendidas} unidades, S/ ${estrella.ingresosGenerados.toFixed(2)}).`;
  }
  return resp.trim();
};

// 2. Chat Inteligente con contexto real de la bodega (Multi-Tenant)
export const consultarAsistenteIA = async (req, res) => {
  const negocioId = req.user.negocioId;
  const { mensaje, historial = [] } = req.body;

  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ message: 'Escribe una consulta para el asistente.' });
  }

  try {
    // Fechas de referencia
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const hace7Dias = new Date(inicioHoy);
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

    // Consultamos ÚNICAMENTE los datos de la bodega actual (negocioId)
    const [negocio, productos, ventasRecientes, fiados, planesCompra, movimientosCaja] = await prisma.$transaction([
      prisma.negocio.findUnique({ where: { id: negocioId } }),
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

    const productosActivos = productos.filter(p => p.estado);
    const productosCriticos = productosActivos.filter(p => p.stock <= (p.stockMinimo || 3));

    const datosParaRespaldo = {
      nombreBodega: negocio?.nombre || 'Mi Bodega',
      saldoCaja: negocio?.saldoCaja || 0,
      ventasHoyCount: ventasHoy.length,
      totalHoy: sumarTotal(ventasHoy),
      ventasSemanaCount: ventasSemana.length,
      totalSemana: sumarTotal(ventasSemana),
      ventasMesCount: ventasMes.length,
      totalMes: sumarTotal(ventasMes),
      rankingProductos,
      productosActivos,
      productosCriticos,
      fiados
    };

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
      inventarioActual: productosActivos.map(p => ({
        nombre: p.nombre,
        stockActual: p.stock,
        stockMinimo: p.stockMinimo || 3,
        estadoStock: p.stock <= (p.stockMinimo || 3) ? 'URGENTE REABASTECER' : 'OK',
        costoCompra: p.precioCompra ? `S/ ${p.precioCompra.toFixed(2)}` : 'No registrado',
        precioVenta: `S/ ${p.precioVenta.toFixed(2)}`,
        gananciaUnitaria: p.precioCompra ? `S/ ${(p.precioVenta - p.precioCompra).toFixed(2)}` : 'N/A',
        proveedor: p.proveedor?.nombre || 'Sin proveedor'
      })),
      fiadosPendientesDeCobro: {
        cantidadVecinosDeudores: fiados.length,
        montoTotalPorCobrar: `S/ ${fiados.reduce((acc, f) => acc + f.monto, 0).toFixed(2)}`,
        listaDeudores: fiados.map(f => ({
          vecino: f.cliente.nombre,
          deuda: `S/ ${f.monto.toFixed(2)}`,
          fechaLimite: f.fechaLimite ? new Date(f.fechaLimite).toLocaleDateString('es-PE') : 'Sin fecha'
        }))
      },
      ultimosPlanesDeCompra: planesCompra.slice(0, 8).map(pc => ({
        pedidoId: pc.id,
        proveedor: pc.proveedor?.nombre,
        estado: pc.estado,
        total: `S/ ${(pc.estado === 'RECIBIDO' ? pc.totalReal : pc.totalEsperado).toFixed(2)}`
      })),
      ultimosMovimientosDeCaja: movimientosCaja.slice(0, 8).map(m => ({
        tipo: m.tipo,
        categoria: m.categoria,
        monto: `S/ ${m.monto.toFixed(2)}`,
        descripcion: m.descripcion
      }))
    };

    const systemPrompt = `Eres VendaIA, el asesor comercial, logístico y financiero exclusivo de la bodega "${negocio?.nombre || 'la tienda'}".
REGLAS ESTRICTAS:
1. LÍMITE DE TEMA: SOLO puedes responder preguntas relacionadas con el negocio (ventas, inventario, qué productos comprar, proveedores, fiados, flujo de caja o ganancias de esta bodega).
2. RECHAZO DE TEMAS AJENOS: Si el usuario pregunta sobre política, deportes, fútbol, religión, chistes, tareas, programación o cualquier tema que NO tenga relación con su bodega, responde ÚNICAMENTE con esta frase exacta:
"No puedo responder a esa pregunta, ya que solo estoy programado para ayudarte con las ventas, el inventario y las finanzas de tu negocio."
3. CERO INVENCIÓN: Usa EXCLUSIVAMENTE los datos reales del siguiente JSON. Nunca inventes productos ni cifras. Responde en español claro, conciso y amigable usando Soles (S/).

DATOS EN TIEMPO REAL DE LA BODEGA:
${JSON.stringify(contextoNegocio)}`;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    let respuestaTexto = '';

    if (apiKey) {
      // Limpiamos el historial para asegurar que NUNCA empiece con 'model' ni incluya mensajes de error
      const historialLimpio = historial
        .filter(m => m.text && !m.text.includes('Ocurrió un problema de conexión'))
        .slice(-4);

      while (historialLimpio.length > 0 && historialLimpio[0].role !== 'user') {
        historialLimpio.shift();
      }

      // Inyectamos el contexto en el mensaje del usuario para compatibilidad universal con cualquier endpoint de Gemini
      const contents = [
        ...historialLimpio.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        })),
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nPREGUNTA DEL DUEÑO DE LA BODEGA: "${mensaje}"` }]
        }
      ];

      const payloadGemini = {
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 650
        }
      };

      // Probamos tanto el endpoint Vertex Express (para claves "AQ.") como AI Studio (para claves "AIza")
      const urlsAProbar = apiKey.startsWith('AQ.')
        ? [
            `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
          ]
        : [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            `https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent?key=${apiKey}`
          ];

      for (const url of urlsAProbar) {
        try {
          const response = await axios.post(url, payloadGemini, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 12000
          });
          respuestaTexto = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (respuestaTexto) break;
        } catch (errApi) {
          console.warn('Aviso API IA:', errApi.response?.data?.error?.message || errApi.message);
        }
      }
    }

    // Si la API externa falló o tardó, el Motor Lógico Interno responde al instante con los datos reales de Prisma
    if (!respuestaTexto) {
      respuestaTexto = generarAnalisisLocalInteligente(mensaje, datosParaRespaldo);
    }

    res.status(200).json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error('Error en consultarAsistenteIA:', error);
    res.status(500).json({ message: 'Error al procesar la consulta con el asistente IA.' });
  }
};