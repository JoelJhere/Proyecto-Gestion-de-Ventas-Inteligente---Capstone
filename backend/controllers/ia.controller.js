import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// --- UTILIDADES DE FECHA EN HORA DE PERÚ (UTC-5, evita desfase en Render después de las 7 PM) ---
const obtenerInicioDiaPeruUTC = (diasAtras = 0) => {
  const ahoraPeru = new Date(Date.now() - 5 * 3600000);
  return new Date(
    Date.UTC(
      ahoraPeru.getUTCFullYear(),
      ahoraPeru.getUTCMonth(),
      ahoraPeru.getUTCDate() - diasAtras,
      5, 0, 0, 0
    )
  );
};

const obtenerInicioMesPeruUTC = () => {
  const ahoraPeru = new Date(Date.now() - 5 * 3600000);
  return new Date(
    Date.UTC(ahoraPeru.getUTCFullYear(), ahoraPeru.getUTCMonth(), 1, 5, 0, 0, 0)
  );
};

// --- UTILIDADES DE TOLERANCIA ORTOGRÁFICA Y FONÉTICA (ESPAÑOL PERÚ) ---
const normalizarFonetico = (texto = '') => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quita tildes
    .replace(/[^a-z0-9\s]/g, ' ')    // Limpia signos de puntuación
    .replace(/(.)\1+/g, '$1')        // Colapsa letras repetidas (holaaa -> hola)
    .replace(/(?<!c)h/g, '')         // Quita h muda conservando "ch" (hoy/oy -> oy)
    .replace(/v/g, 'b')              // Unifica b/v (vendi/bendi -> bendi)
    .replace(/qu(?=[ei])/g, 'k')     // que/qui -> ke/ki
    .replace(/z/g, 's')              // Unifica z/s
    .replace(/c(?=[ei])/g, 's')      // ce/ci -> se/si (ganancia/ganansia)
    .replace(/c(?!h)/g, 'k')         // ca/co/cu -> ka/ko/ku
    .replace(/y(?=\s|$)/g, 'i')      // hoy/oy -> oi
    .replace(/\s+/g, ' ')
    .trim();
};

const distanciaLevenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i - 1;
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, prev + costo);
      prev = temp;
    }
  }
  return fila[b.length];
};

const coincideConKeywords = (textoNormalizado, tokens, keywords) => {
  for (const kwRaw of keywords) {
    const kw = normalizarFonetico(kwRaw);
    if (!kw) continue;

    // Frases de varias palabras
    if (kw.includes(' ')) {
      if (textoNormalizado.includes(kw)) return true;
      continue;
    }

    for (const token of tokens) {
      if (token === kw) return true;

      // Coincidencia por raíz o palabra truncada (ej. "seman" vs "semana", "prod" vs "producto")
      if (token.length >= 4 && kw.length >= 5) {
        if (kw.startsWith(token) || token.startsWith(kw)) return true;
      }

      // Tolerancia a errores de escritura (1 error en palabras de 5-7 letras, hasta 2 en 8+)
      if (token.length >= 5 && kw.length >= 5) {
        const maxDist = token.length >= 8 && kw.length >= 8 ? 2 : 1;
        if (Math.abs(token.length - kw.length) <= maxDist && distanciaLevenshtein(token, kw) <= maxDist) {
          return true;
        }
      }
    }
  }
  return false;
};

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

    const inicioMananaPeru = obtenerInicioDiaPeruUTC(-1);
    const fiadosVencidos = fiadosPendientes.filter(f => {
      if (!f.fechaLimite) return false;
      return new Date(f.fechaLimite) < inicioMananaPeru;
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

// MOTOR LÓGICO DE RESPALDO (Con tolerancia a faltas de ortografía y modismos peruanos)
const generarAnalisisLocalInteligente = (preguntaRaw, datos) => {
  const textoNorm = normalizarFonetico(preguntaRaw);
  const tokens = textoNorm.split(' ').filter(Boolean);

  // 1. Candado estricto contra temas ajenos al negocio (incluso con faltas de ortografía)
  const palabrasProhibidas = [
    'futbol', 'mundial', 'goleador', 'deporte', 'partido', 'messi', 'cristiano', 'alianza', 'universitario',
    'politica', 'presidente', 'congreso', 'elecciones', 'votar', 'alcalde',
    'chiste', 'broma', 'poema', 'cancion', 'pelicula', 'anime', 'juego', 'minecraft',
    'receta', 'cocinar', 'clima', 'religion', 'dios', 'horoscopo', 'novia', 'amor', 'capital de'
  ];

  const palabrasNegocio = [
    'venta', 'vendi', 'vender', 'semana', 'mes', 'hoy', 'ayer', 'ingreso', 'ganancia', 'ganar', 'rentable', 'margen',
    'producto', 'mercaderia', 'stock', 'inventario', 'comprar', 'compra', 'pedido', 'proveedor', 'abastecer', 'falta', 'agotado',
    'fiado', 'fiao', 'deuda', 'debe', 'deben', 'vecino', 'cliente', 'cobrar', 'caja', 'saldo', 'capital', 'dinero', 'plata', 'soles',
    'yape', 'plin', 'efectivo', 'transferencia', 'boleta', 'factura', 'ticket', 'gasto', 'egreso', 'retiro',
    'bodega', 'tienda', 'negocio', 'resumen', 'balance', 'yendo', 'como fue', 'como vamos', 'como voy', 'hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'ayuda'
  ];

  const contieneProhibida = coincideConKeywords(textoNorm, tokens, palabrasProhibidas);
  const contieneNegocio = coincideConKeywords(textoNorm, tokens, palabrasNegocio);

  if (contieneProhibida || !contieneNegocio) {
    return 'No puedo responder a esa pregunta, ya que solo estoy programado para ayudarte con las ventas, el inventario y las finanzas de tu negocio.';
  }

  // 2. Compras / Stock / Inventario
  if (coincideConKeywords(textoNorm, tokens, ['comprar', 'compra', 'stock', 'agotado', 'inventario', 'abastecer', 'pedir', 'pedido', 'falta', 'mercaderia', 'proveedor'])) {
    const criticos = datos.productosCriticos;
    const top = datos.rankingProductos.slice(0, 3);
    let resp = `📦 **Análisis de Inventario y Compras (${datos.nombreBodega}):**\n\n`;
    resp += `• **Capital disponible en caja:** S/ ${datos.saldoCaja.toFixed(2)}\n`;

    if (criticos.length > 0) {
      resp += `\n⚠️ **Productos urgentes por comprar (${criticos.length} con stock bajo):**\n`;
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

  // 3. Fiados / Cuentas por cobrar
  if (coincideConKeywords(textoNorm, tokens, ['fiado', 'fiao', 'debe', 'deben', 'deuda', 'vecino', 'cobrar'])) {
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

  // 4. Ganancia / Rentabilidad
  if (coincideConKeywords(textoNorm, tokens, ['ganancia', 'ganar', 'rentable', 'margen'])) {
    if (datos.topRentables.length === 0) {
      return 'Aún no tienes productos con costo de compra registrado para calcular la ganancia unitaria.';
    }
    let resp = `💰 **Productos que te dejan mayor ganancia en ${datos.nombreBodega}:**\n\n`;
    datos.topRentables.slice(0, 5).forEach(p => {
      resp += `• **${p.nombre}**: Ganas **S/ ${p.gananciaUnitaria.toFixed(2)}** por unidad (+${p.porcentajeMargen.toFixed(0)}%)\n`;
    });
    return resp.trim();
  }

  // 5. Saludos o ayuda
  if (
    tokens.length <= 4 &&
    coincideConKeywords(textoNorm, tokens, ['hola', 'buenos dias', 'buenas tardes', 'buenas noches', 'ayuda'])
  ) {
    return `¡Hola! Soy **VendaIA**, el asistente de **${datos.nombreBodega}**.\n\nEn este momento tienes **S/ ${datos.saldoCaja.toFixed(2)}** en caja, **${datos.ventasHoyCount} venta(s)** registradas hoy y **${datos.productosCriticos.length} producto(s)** con stock crítico.\n\nPuedes preguntarme cosas como:\n• ¿Qué tal me fue en las ventas de esta semana?\n• ¿Qué productos me dejan mayor ganancia?\n• ¿Qué mercadería debería comprar pronto?\n• ¿Quiénes me deben fiado actualmente?`;
  }

  // 6. Por defecto: Balance general de ventas (hoy, semana, mes) y caja
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
    // Fechas de referencia exactas en hora Perú (UTC-5)
    const ahora = new Date();
    const inicioHoy = obtenerInicioDiaPeruUTC(0);
    const hace7Dias = obtenerInicioDiaPeruUTC(7);
    const inicioMes = obtenerInicioMesPeruUTC();

    // Consultamos únicamente los datos de la bodega actual (negocioId)
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

    const desglosePorMedio = (lista) => {
      const totales = { EFECTIVO: 0, YAPE_PLIN: 0, TRANSFERENCIA: 0, FIADO: 0 };
      lista.forEach(v => {
        if (totales[v.metodoPago] !== undefined) totales[v.metodoPago] += v.total;
      });
      return {
        efectivo: `S/ ${totales.EFECTIVO.toFixed(2)}`,
        yapePlin: `S/ ${totales.YAPE_PLIN.toFixed(2)}`,
        transferencia: `S/ ${totales.TRANSFERENCIA.toFixed(2)}`,
        fiado: `S/ ${totales.FIADO.toFixed(2)}`
      };
    };

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

    const topRentables = productosActivos
      .filter(p => p.precioCompra && p.precioCompra > 0)
      .map(p => ({
        nombre: p.nombre,
        precioCompra: p.precioCompra,
        precioVenta: p.precioVenta,
        gananciaUnitaria: p.precioVenta - p.precioCompra,
        porcentajeMargen: ((p.precioVenta - p.precioCompra) / p.precioCompra) * 100
      }))
      .sort((a, b) => b.gananciaUnitaria - a.gananciaUnitaria);

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
      topRentables,
      productosActivos,
      productosCriticos,
      fiados
    };

    const contextoNegocio = {
      fechaActualPeru: ahora.toLocaleDateString('es-PE', {
        timeZone: 'America/Lima',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      nombreBodega: negocio?.nombre || 'Mi Bodega',
      capitalDisponibleEnCaja: `S/ ${(negocio?.saldoCaja || 0).toFixed(2)}`,
      metricasVentas: {
        hoy: {
          cantidadVentas: ventasHoy.length,
          totalRecaudado: `S/ ${sumarTotal(ventasHoy).toFixed(2)}`,
          porMedioPago: desglosePorMedio(ventasHoy)
        },
        ultimos7Dias: {
          cantidadVentas: ventasSemana.length,
          totalRecaudado: `S/ ${sumarTotal(ventasSemana).toFixed(2)}`,
          porMedioPago: desglosePorMedio(ventasSemana)
        },
        esteMes: {
          cantidadVentas: ventasMes.length,
          totalRecaudado: `S/ ${sumarTotal(ventasMes).toFixed(2)}`,
          porMedioPago: desglosePorMedio(ventasMes)
        }
      },
      topProductosMasVendidos: rankingProductos.slice(0, 10),
      topProductosMasRentables: topRentables.slice(0, 10).map(p => ({
        nombre: p.nombre,
        gananciaUnitaria: `S/ ${p.gananciaUnitaria.toFixed(2)}`,
        margen: `${p.porcentajeMargen.toFixed(0)}%`
      })),
      resumenInventario: {
        totalProductosActivos: productosActivos.length,
        cantidadStockCritico: productosCriticos.length,
        productosUrgentesReabastecer: productosCriticos.slice(0, 20).map(p => ({
          nombre: p.nombre,
          stock: p.stock,
          minimo: p.stockMinimo || 3,
          costoCompra: p.precioCompra ? `S/ ${p.precioCompra.toFixed(2)}` : 'N/A',
          proveedor: p.proveedor?.nombre || 'Sin proveedor'
        }))
      },
      // Formato compacto para soportar 100+ productos sin saturar tokens ni lentificar respuestas
      catalogoCompacto: productosActivos
        .slice(0, 120)
        .map(p => `${p.nombre} [${p.categoria || '-'}] stk:${p.stock} comp:${p.precioCompra ?? '-'} vta:${p.precioVenta}`),
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
2. TOLERANCIA ORTOGRÁFICA Y MODISMOS: El dueño suele escribir rápido desde un celular o tablet con faltas de ortografía, letras faltantes, abreviaturas o expresiones coloquiales peruanas (por ejemplo: "com e esta yendo e eta seman?", "cuanto bendi oy", "kien me deve plata", "k prod falta"). Interpreta siempre su intención comercial real con naturalidad, sin corregirle la ortografía ni rechazar preguntas del negocio por estar mal escritas.
3. RECHAZO DE TEMAS AJENOS: Si el usuario pregunta sobre política, deportes, fútbol, religión, chistes, tareas, programación o cualquier tema que NO tenga relación con su bodega (incluso mal escrito), responde ÚNICAMENTE con esta frase exacta:
"No puedo responder a esa pregunta, ya que solo estoy programado para ayudarte con las ventas, el inventario y las finanzas de tu negocio."
4. CERO INVENCIÓN: Usa EXCLUSIVAMENTE los datos reales del siguiente JSON. Nunca inventes productos ni cifras. Responde en español claro, conciso y amigable usando Soles (S/).

DATOS EN TIEMPO REAL DE LA BODEGA:
${JSON.stringify(contextoNegocio)}`;

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    let respuestaTexto = '';

    const extraerTextoGemini = (data) => {
      if (!data) return '';
      if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
      if (typeof data.text === 'string' && data.text.trim()) return data.text;
      if (typeof data.output === 'string' && data.output.trim()) return data.output;
      if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
      }
      if (Array.isArray(data.outputs)) {
        for (const out of data.outputs) {
          if (typeof out.text === 'string' && out.text.trim()) return out.text;
          if (out.content?.parts?.[0]?.text) return out.content.parts[0].text;
          if (Array.isArray(out.content)) {
            for (const c of out.content) {
              if (typeof c.text === 'string' && c.text.trim()) return c.text;
            }
          }
        }
      }
      if (data.response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.response.candidates[0].content.parts[0].text;
      }
      return '';
    };

    if (apiKey) {
      const historialReciente = historial
        .filter(m => m.text && !m.text.includes('Ocurrió un problema de conexión'))
        .slice(-4)
        .map(m => `${m.role === 'user' ? 'Dueño' : 'VendaIA'}: ${m.text}`)
        .join('\n');

      const promptCompleto = `${systemPrompt}\n\n${
        historialReciente ? `HISTORIAL RECIENTE DE LA CONVERSACIÓN:\n${historialReciente}\n\n` : ''
      }PREGUNTA ACTUAL DEL DUEÑO DE LA BODEGA: "${mensaje}"`;

      const headersGemini = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      };

      const modelosActivos = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

      for (const modelo of modelosActivos) {
        if (respuestaTexto) break;
        try {
          const resInt = await axios.post(
            'https://generativelanguage.googleapis.com/v1beta/interactions',
            {
              model: modelo,
              input: promptCompleto
            },
            { headers: headersGemini, timeout: 12000 }
          );
          respuestaTexto = extraerTextoGemini(resInt.data);
        } catch (errInt) {
          console.warn(
            `Aviso Interactions (${modelo}):`,
            errInt.response?.data?.error?.message || errInt.message
          );
        }
      }

      if (!respuestaTexto) {
        for (const modelo of modelosActivos) {
          if (respuestaTexto) break;
          try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
            const response = await axios.post(
              url,
              {
                contents: [{ role: 'user', parts: [{ text: promptCompleto }] }],
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 700
                }
              },
              { headers: headersGemini, timeout: 12000 }
            );
            respuestaTexto = extraerTextoGemini(response.data);
          } catch (errGen) {
            console.warn(
              `Aviso generateContent (${modelo}):`,
              errGen.response?.data?.error?.message || errGen.message
            );
          }
        }
      }
    }

    // Si la API externa falló o tardó, el Motor Lógico Interno responde con tolerancia ortográfica
    if (!respuestaTexto) {
      respuestaTexto = generarAnalisisLocalInteligente(mensaje, datosParaRespaldo);
    }

    res.status(200).json({ respuesta: respuestaTexto });
  } catch (error) {
    console.error('Error en consultarAsistenteIA:', error);
    res.status(500).json({ message: 'Error al procesar la consulta con el asistente IA.' });
  }
};