// Utilidades compartidas para control de Lotes y salida automática FEFO (First Expired, First Out)
export const DIAS_ALERTA_VENCIMIENTO = 15;

// Convierte "YYYY-MM-DD" (o Date) a las 12:00 UTC para evitar desfases de 1 día en hora Perú (UTC-5)
export const parsearFechaVencimiento = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) throw new Error('Fecha de vencimiento inválida.');
    return new Date(Date.UTC(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate(), 12, 0, 0));
  }
  const str = String(valor).trim();
  if (!str) return null;

  const soloFecha = str.includes('T') ? str.split('T')[0] : str;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(soloFecha);
  if (!match) throw new Error('Formato de fecha de vencimiento inválido.');

  const fecha = new Date(`${soloFecha}T12:00:00.000Z`);
  if (Number.isNaN(fecha.getTime())) throw new Error('Fecha de vencimiento inválida.');
  return fecha;
};

export const claveFechaDia = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};

// Orden FEFO: primero los lotes con fecha más cercana/vencida, y al final los lotes sin fecha
export const ordenarLotesFEFO = (lotes = []) => {
  return [...lotes].sort((a, b) => {
    if (a.fechaVencimiento && b.fechaVencimiento) {
      const diff = new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
      return diff !== 0 ? diff : a.id - b.id;
    }
    if (a.fechaVencimiento && !b.fechaVencimiento) return -1;
    if (!a.fechaVencimiento && b.fechaVencimiento) return 1;
    return a.id - b.id;
  });
};

// Garantiza que los productos antiguos (que tenían stock antes de esta mejora) tengan su stock respaldado en un lote base
export const sincronizarLotesConStock = async (tx, productoId, stockActual) => {
  const lotesActivos = await tx.loteProducto.findMany({
    where: { productoId, cantidad: { gt: 0 } },
    orderBy: { id: 'asc' }
  });

  const sumaLotes = lotesActivos.reduce((acc, l) => acc + l.cantidad, 0);

  if (stockActual > sumaLotes) {
    const diferencia = stockActual - sumaLotes;
    const loteSinFecha = lotesActivos.find(l => l.fechaVencimiento === null);
    if (loteSinFecha) {
      await tx.loteProducto.update({
        where: { id: loteSinFecha.id },
        data: { cantidad: { increment: diferencia } }
      });
    } else {
      await tx.loteProducto.create({
        data: { productoId, cantidad: diferencia, fechaVencimiento: null }
      });
    }
  }
};

// Agrega unidades a un lote (si ya existe un lote con el mismo día de vencimiento, las suma ahí)
export const agregarStockALote = async (tx, productoId, cantidad, fechaVencimientoRaw = null, stockPrevio = null) => {
  const cant = parseInt(cantidad, 10);
  if (!cant || cant <= 0) return;

  if (stockPrevio !== null && stockPrevio > 0) {
    await sincronizarLotesConStock(tx, productoId, stockPrevio);
  }

  const fechaObj = parsearFechaVencimiento(fechaVencimientoRaw);
  const claveObjetivo = claveFechaDia(fechaObj);

  const lotesExistentes = await tx.loteProducto.findMany({
    where: { productoId, cantidad: { gt: 0 } }
  });

  const loteMismaFecha = lotesExistentes.find(l => claveFechaDia(l.fechaVencimiento) === claveObjetivo);

  if (loteMismaFecha) {
    await tx.loteProducto.update({
      where: { id: loteMismaFecha.id },
      data: { cantidad: { increment: cant } }
    });
  } else {
    await tx.loteProducto.create({
      data: {
        productoId,
        cantidad: cant,
        fechaVencimiento: fechaObj
      }
    });
  }
};

// Descuenta stock priorizando automáticamente los productos más próximos a vencer (FEFO)
export const descontarStockFEFO = async (tx, productoId, cantidadADescontar, stockPrevio = null) => {
  let restante = parseInt(cantidadADescontar, 10);
  if (!restante || restante <= 0) return;

  if (stockPrevio !== null && stockPrevio > 0) {
    await sincronizarLotesConStock(tx, productoId, stockPrevio);
  }

  const lotes = await tx.loteProducto.findMany({
    where: { productoId, cantidad: { gt: 0 } }
  });

  const lotesOrdenados = ordenarLotesFEFO(lotes);

  for (const lote of lotesOrdenados) {
    if (restante <= 0) break;

    if (lote.cantidad <= restante) {
      restante -= lote.cantidad;
      await tx.loteProducto.delete({ where: { id: lote.id } });
    } else {
      await tx.loteProducto.update({
        where: { id: lote.id },
        data: { cantidad: lote.cantidad - restante }
      });
      restante = 0;
    }
  }
};

// Calcula el estado de vencimiento (umbral de 15 días en hora de Perú) para enviar al frontend
export const enriquecerProductoConVencimiento = (producto) => {
  const lotesActivos = ordenarLotesFEFO((producto.lotes || []).filter(l => l.cantidad > 0));
  const lotesConFecha = lotesActivos.filter(l => l.fechaVencimiento !== null);

  const sumaLotes = lotesActivos.reduce((acc, l) => acc + l.cantidad, 0);
  const stockSinLoteRegistrado = Math.max(0, (producto.stock || 0) - sumaLotes);
  const stockEnLotesSinFecha = lotesActivos
    .filter(l => l.fechaVencimiento === null)
    .reduce((acc, l) => acc + l.cantidad, 0);
  const stockSinFecha = stockEnLotesSinFecha + stockSinLoteRegistrado;

  const loteMasProximo = lotesConFecha[0] || null;
  let diasParaVencer = null;
  let estadoVencimiento = 'SIN_FECHA';

  if (loteMasProximo) {
    const ahoraPeru = new Date(Date.now() - 5 * 3600000);
    const hoyMediodiaUTC = Date.UTC(
      ahoraPeru.getUTCFullYear(),
      ahoraPeru.getUTCMonth(),
      ahoraPeru.getUTCDate(),
      12, 0, 0
    );
    const fv = new Date(loteMasProximo.fechaVencimiento);
    const fvMediodiaUTC = Date.UTC(
      fv.getUTCFullYear(),
      fv.getUTCMonth(),
      fv.getUTCDate(),
      12, 0, 0
    );

    diasParaVencer = Math.round((fvMediodiaUTC - hoyMediodiaUTC) / 86400000);

    if (diasParaVencer <= 0) {
      estadoVencimiento = 'VENCIDO';
    } else if (diasParaVencer <= DIAS_ALERTA_VENCIMIENTO) {
      estadoVencimiento = 'POR_VENCER';
    } else {
      estadoVencimiento = 'VIGENTE';
    }
  }

  return {
    ...producto,
    lotes: lotesActivos,
    proximoVencimiento: loteMasProximo ? loteMasProximo.fechaVencimiento : null,
    cantidadProximoVencimiento: loteMasProximo ? loteMasProximo.cantidad : 0,
    diasParaVencer,
    estadoVencimiento,
    totalLotesConFecha: lotesConFecha.length,
    stockSinFecha
  };
};