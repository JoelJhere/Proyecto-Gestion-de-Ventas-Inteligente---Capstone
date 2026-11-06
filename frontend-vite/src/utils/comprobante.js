// Utilidades compartidas por Ticket.jsx y el modal de Vista Previa de Historial.jsx
export const NOMBRE_SISTEMA = 'VendaIA';

// Formatea cualquier valor (number, string o Decimal serializado) a 2 decimales sin romper si llega null/undefined.
export const dinero = (valor) => (Number(valor) || 0).toFixed(2);

export const etiquetaMetodoPago = (metodo) => {
  if (metodo === 'YAPE_PLIN') return 'Yape / Plin';
  if (metodo === 'TRANSFERENCIA') return 'Transferencia';
  if (metodo === 'FIADO') return 'Crédito (Fiado)';
  return 'Efectivo';
};

// Define cómo se presenta cada tipo de documento.
export const tipoDocumento = (venta) => {
  if (venta?.tipoComprobante === 'FACTURA') {
    return { clave: 'FACTURA', nombre: 'Factura', titulo: 'FACTURA DE VENTA ELECTRÓNICA', codigoSunat: '01' };
  }
  if (venta?.tipoComprobante === 'BOLETA') {
    return { clave: 'BOLETA', nombre: 'Boleta', titulo: 'BOLETA DE VENTA ELECTRÓNICA', codigoSunat: '03' };
  }
  return { clave: 'TICKET', nombre: 'Venta rápida', titulo: 'TICKET DE VENTA', codigoSunat: null };
};

// Identifica si el documento del cliente es RUC o DNI según su longitud.
export const tipoDocCliente = (numero) => {
  const n = String(numero || '').trim();
  if (n.length === 11) return { etiqueta: 'RUC', codigo: '6' };
  if (n.length === 8 && n !== '00000000') return { etiqueta: 'DNI', codigo: '1' };
  return { etiqueta: 'Doc', codigo: '0' };
};

// Usa subtotal/igv guardados en BD; si no existen, los calcula a partir del total.
export const calcularTotales = (venta, tasaIgv = 18) => {
  const total = Number(venta?.total) || 0;
  const sub = Number(venta?.subtotal);
  const igv = Number(venta?.igv);

  if (Number.isFinite(sub) && Number.isFinite(igv) && sub + igv > 0) {
    return { gravada: sub, igv, total };
  }
  const gravada = total / (1 + tasaIgv / 100);
  return { gravada, igv: total - gravada, total };
};

// Cadena que SUNAT define para el QR del comprobante.
// RUC | Tipo | Serie | Correlativo | IGV | Total | Fecha | Tipo doc. cliente | N° doc. cliente |
export const generarTextoQR = (venta, rucEmisor, igv) => {
  const [serie = '', correlativo = ''] = String(venta.numeroComprobante || '').split('-');
  const tipo = tipoDocumento(venta).codigoSunat;
  const doc = String(venta.clienteDocumento || '').trim();
  const cliente = tipoDocCliente(doc);
  const fecha = new Date(venta.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

  return [
    rucEmisor || '',
    tipo,
    serie,
    correlativo,
    dinero(igv),
    dinero(venta.total),
    fecha,
    cliente.codigo,
    doc && doc !== '00000000' ? doc : '-'
  ].join('|') + '|';
};

// ---------- Importe en letras ----------
const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
const VEINTI = ['VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

const menorDeMil = (n) => {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const partes = [];
  const c = Math.floor(n / 100);
  const resto = n % 100;

  if (c) partes.push(CENTENAS[c]);

  if (resto) {
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(ESPECIALES[resto - 10]);
    else if (resto < 30) partes.push(VEINTI[resto - 20]);
    else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      partes.push(u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`);
    }
  }
  return partes.join(' ');
};

// "UNO" se apocopa cuando precede a MIL o MILLONES (veintiún mil, treinta y un mil).
const apocopar = (texto) => texto.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');

const enteroALetras = (n) => {
  if (n === 0) return 'CERO';

  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes = [];

  if (millones) partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopar(menorDeMil(millones))} MILLONES`);
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocopar(menorDeMil(miles))} MIL`);
  if (resto) partes.push(menorDeMil(resto));

  return partes.join(' ');
};

// Ej: 15 -> "QUINCE CON 00/100 SOLES"
export const numeroALetras = (monto) => {
  const centavosTotales = Math.round((Number(monto) || 0) * 100);
  const entero = Math.floor(centavosTotales / 100);
  const centimos = String(centavosTotales % 100).padStart(2, '0');
  return `${enteroALetras(entero)} CON ${centimos}/100 SOLES`;
};