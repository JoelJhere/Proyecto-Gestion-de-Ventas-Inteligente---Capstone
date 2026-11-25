import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generador determinista para datos consistentes sin números negativos ni incoherencias
function crearRng(semilla = 20261125) {
  let s = semilla % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = crearRng(20261125);
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const redondear2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const haceDias = (dias, hora = 10, minuto = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, randInt(0, 59), 0);
  return d;
};

const enDias = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(12, 0, 0, 0);
  return d;
};

// --- 15 PROVEEDORES PERUANOS ---
const PROVEEDORES_DATA = [
  { nombre: 'Distribuidora Lindley Cajamarca S.A.C.', ruc: '20510100101', telefono: '976410101' },
  { nombre: 'Distribuciones AJE Norte E.I.R.L.', ruc: '20510100102', telefono: '976410102' },
  { nombre: 'Gloria Distribuidora Regional S.A.C.', ruc: '20510100103', telefono: '976410103' },
  { nombre: 'Comercial Laive del Norte S.A.C.', ruc: '20510100104', telefono: '976410104' },
  { nombre: 'Alicorp Mayorista Cajamarca S.A.C.', ruc: '20510100105', telefono: '976410105' },
  { nombre: 'Molitalia Distribuciones Perú S.A.C.', ruc: '20510100106', telefono: '976410106' },
  { nombre: 'Arrocera y Menestras del Norte S.R.L.', ruc: '20510100107', telefono: '976410107' },
  { nombre: 'PepsiCo & Snacks Cajamarca S.A.C.', ruc: '20510100108', telefono: '976410108' },
  { nombre: 'Mondelez & Field Mayorista S.A.C.', ruc: '20510100109', telefono: '976410109' },
  { nombre: 'Backus & Bebidas del Norte S.A.C.', ruc: '20510100110', telefono: '976410110' },
  { nombre: 'Nestlé Bodega Express S.A.C.', ruc: '20510100111', telefono: '976410111' },
  { nombre: 'Procter & Gamble Distribuidora S.A.C.', ruc: '20510100112', telefono: '976410112' },
  { nombre: 'Unilever Cuidado Hogar S.A.C.', ruc: '20510100113', telefono: '976410113' },
  { nombre: 'Papelera Andina & Higiene S.A.C.', ruc: '20510100114', telefono: '976410114' },
  { nombre: 'Clorox & Limpieza Total Perú S.A.C.', ruc: '20510100115', telefono: '976410115' }
];

// --- 100 PRODUCTOS VARIADOS DE BODEGA PERUANA ---
// Formato: [nombre, categoria, precioCompra, precioVenta, stock, provIdx]
// Todos usan las 6 categorías base y recibirán código AJ-900001..AJ-900100 (NO entran al catálogo global)
const PRODUCTOS_DATA = [
  // BEBIDAS (20)
  ['Inca Kola 500 ml', 'Bebidas', 2.40, 3.00, 36, 0],
  ['Inca Kola 1.5 L', 'Bebidas', 5.40, 6.50, 18, 0],
  ['Inca Kola 3 L', 'Bebidas', 9.80, 11.50, 4, 0],
  ['Coca-Cola 500 ml', 'Bebidas', 2.40, 3.00, 32, 0],
  ['Coca-Cola 1.5 L', 'Bebidas', 5.40, 6.50, 16, 0],
  ['Coca-Cola Sin Azúcar 500 ml', 'Bebidas', 2.40, 3.00, 14, 0],
  ['Fanta Naranja 500 ml', 'Bebidas', 2.20, 2.80, 20, 0],
  ['Sprite Limón 500 ml', 'Bebidas', 2.20, 2.80, 15, 0],
  ['Agua San Luis Sin Gas 625 ml', 'Bebidas', 1.20, 1.80, 48, 0],
  ['Agua San Luis 2.5 L', 'Bebidas', 3.00, 3.80, 3, 0],
  ['Frugos del Valle Durazno 235 ml', 'Bebidas', 1.10, 1.50, 30, 0],
  ['Powerade Mora Azul 500 ml', 'Bebidas', 2.30, 3.00, 12, 0],
  ['Agua Cielo Sin Gas 625 ml', 'Bebidas', 0.90, 1.50, 45, 1],
  ['Sporade Tropical 500 ml', 'Bebidas', 1.90, 2.50, 22, 1],
  ['Volt Energizante Amarillo 300 ml', 'Bebidas', 1.70, 2.30, 2, 1],
  ['Pulp Durazno Caja 300 ml', 'Bebidas', 1.30, 1.80, 24, 1],
  ['Cifrut Citrus Punch 500 ml', 'Bebidas', 1.20, 1.70, 26, 1],
  ['Guaraná Backus 450 ml', 'Bebidas', 1.80, 2.40, 18, 9],
  ['Agua San Mateo Con Gas 600 ml', 'Bebidas', 1.50, 2.20, 20, 9],
  ['Cerveza Pilsen Callao Lata 355 ml', 'Bebidas', 4.20, 5.20, 24, 9],

  // LÁCTEOS (12)
  ['Leche Gloria Evaporada Azul 395 g', 'Lácteos', 3.60, 4.30, 40, 2],
  ['Leche Gloria Light Roja 395 g', 'Lácteos', 3.70, 4.40, 18, 2],
  ['Leche Gloria Niños Amarilla 395 g', 'Lácteos', 3.90, 4.60, 12, 2],
  ['Leche Gloria UHT Caja 1 L', 'Lácteos', 4.60, 5.50, 14, 2],
  ['Yogurt Gloria Fresa 1 kg', 'Lácteos', 6.20, 7.50, 3, 2],
  ['Yogurt Gloria Vainilla 1 kg', 'Lácteos', 6.20, 7.50, 9, 2],
  ['Mantequilla Gloria Barra 200 g', 'Lácteos', 8.50, 10.20, 8, 2],
  ['Queso Edam Gloria Tajado 180 g', 'Lácteos', 7.80, 9.50, 2, 2],
  ['Leche Condensada Gloria 393 g', 'Lácteos', 5.20, 6.40, 11, 2],
  ['Yogurt Laive Fresa 1 L', 'Lácteos', 6.00, 7.30, 10, 3],
  ['Yogurt Laive Probiótico Durazno 180 g', 'Lácteos', 1.60, 2.20, 16, 3],
  ['Leche Ideal Cremosita 390 g', 'Lácteos', 3.40, 4.10, 28, 10],

  // ABARROTES (28)
  ['Aceite Primor Clásico 900 ml', 'Abarrotes', 7.60, 9.00, 22, 4],
  ['Aceite Primor Premium 900 ml', 'Abarrotes', 8.90, 10.50, 10, 4],
  ['Fideos Don Vittorio Spaghetti 450 g', 'Abarrotes', 2.80, 3.50, 30, 4],
  ['Fideos Don Vittorio Tallarín 450 g', 'Abarrotes', 2.80, 3.50, 24, 4],
  ['Fideos Don Vittorio Codito 250 g', 'Abarrotes', 1.80, 2.30, 20, 4],
  ['Harina Blanca Flor Preparada 1 kg', 'Abarrotes', 6.20, 7.50, 14, 4],
  ['Mayonesa Alacena Doypack 100 g', 'Abarrotes', 2.60, 3.30, 25, 4],
  ['Mayonesa Alacena 475 g', 'Abarrotes', 8.80, 10.50, 4, 4],
  ['Crema de Ají Tari Alacena 85 g', 'Abarrotes', 2.40, 3.10, 18, 4],
  ['Ketchup Alacena 100 g', 'Abarrotes', 2.00, 2.60, 20, 4],
  ['Atún Filete Primor 170 g', 'Abarrotes', 5.10, 6.20, 26, 4],
  ['Fideos Molitalia Cabello de Ángel 250 g', 'Abarrotes', 1.70, 2.20, 22, 5],
  ['Salsa Roja Pomarola 145 g', 'Abarrotes', 1.90, 2.50, 28, 5],
  ['Avena 3 Ositos Clásica 300 g', 'Abarrotes', 3.20, 4.00, 16, 5],
  ['Arroz Costeño Extra 750 g', 'Abarrotes', 3.50, 4.30, 35, 6],
  ['Arroz Costeño Superior 5 kg', 'Abarrotes', 21.50, 25.00, 3, 6],
  ['Azúcar Rubia Cartavio 1 kg', 'Abarrotes', 3.40, 4.20, 42, 6],
  ['Azúcar Blanca Cartavio 1 kg', 'Abarrotes', 3.70, 4.50, 25, 6],
  ['Lenteja Costeño 500 g', 'Abarrotes', 4.60, 5.60, 15, 6],
  ['Frejol Canario Costeño 500 g', 'Abarrotes', 5.80, 7.00, 12, 6],
  ['Arveja Partida Costeño 500 g', 'Abarrotes', 3.40, 4.20, 14, 6],
  ['Sal de Mesa Emsal 1 kg', 'Abarrotes', 1.50, 2.00, 30, 6],
  ['Maíz Pop Corn Costeño 500 g', 'Abarrotes', 3.80, 4.80, 16, 6],
  ['Avena Quaker Tradicional 450 g', 'Abarrotes', 4.90, 6.00, 14, 7],
  ['Nescafé Tradición Doypack 50 g', 'Abarrotes', 7.20, 8.80, 12, 10],
  ['Nescafé Kirma Sobre 10 g', 'Abarrotes', 1.20, 1.60, 40, 10],
  ['Milo Bebida Achocolatada 180 g', 'Abarrotes', 6.80, 8.20, 3, 10],
  ['Caldo de Gallina Maggi Caja x2', 'Abarrotes', 0.90, 1.30, 50, 10],

  // SNACKS (20)
  ['Papas Lay\'s Clásicas 36 g', 'Snacks', 1.50, 2.00, 34, 7],
  ['Papas Lay\'s Clásicas Familiar 150 g', 'Snacks', 5.60, 6.80, 10, 7],
  ['Doritos Queso Atrevido 42 g', 'Snacks', 1.60, 2.20, 28, 7],
  ['Cheetos Horneados Queso 43 g', 'Snacks', 1.50, 2.00, 26, 7],
  ['Piqueo Snax Original 68 g', 'Snacks', 2.80, 3.50, 16, 7],
  ['Cuates Picante 44 g', 'Snacks', 0.90, 1.30, 38, 7],
  ['Chizitos Fiesta Queso 45 g', 'Snacks', 0.90, 1.30, 40, 7],
  ['Galletas Oreo Original 36 g', 'Snacks', 1.10, 1.50, 44, 8],
  ['Galletas Soda Field Paquete 34 g', 'Snacks', 0.70, 1.00, 55, 8],
  ['Galletas Coronita Chocolate 40 g', 'Snacks', 0.80, 1.20, 32, 8],
  ['Galletas Vainilla Field 37 g', 'Snacks', 0.70, 1.00, 36, 8],
  ['Galletas Club Social Original 26 g', 'Snacks', 0.90, 1.30, 30, 8],
  ['Galletas Ritz Queso 34 g', 'Snacks', 1.00, 1.40, 24, 8],
  ['Galletas Casino Menta 43 g', 'Snacks', 0.80, 1.20, 30, 4],
  ['Galletas Margarita Clásica 35 g', 'Snacks', 0.70, 1.00, 28, 4],
  ['Chocolate Sublime Clásico 30 g', 'Snacks', 1.70, 2.20, 3, 10],
  ['Chocolate Princesa Maní 30 g', 'Snacks', 1.70, 2.20, 22, 10],
  ['Chocolate Triángulo D\'Onofrio 30 g', 'Snacks', 1.90, 2.50, 18, 10],
  ['Caramelos Halls Mentol Barra', 'Snacks', 1.40, 2.00, 25, 8],
  ['Chicle Trident Yerbabuena x5', 'Snacks', 1.30, 1.80, 28, 8],

  // LIMPIEZA (10)
  ['Detergente Bolívar Floral 750 g', 'Limpieza', 7.40, 9.00, 16, 4],
  ['Detergente Opal Ultra 450 g', 'Limpieza', 4.20, 5.20, 18, 4],
  ['Jabón de Lavar Bolívar 190 g', 'Limpieza', 2.80, 3.50, 24, 4],
  ['Lavavajilla Ayudín Pasta Limón 300 g', 'Limpieza', 3.40, 4.30, 2, 14],
  ['Lejía Clorox Tradicional 1 L', 'Limpieza', 4.10, 5.20, 20, 14],
  ['Limpiatodo Poett Lavanda 900 ml', 'Limpieza', 5.00, 6.20, 14, 14],
  ['Detergente Ace Limón 500 g', 'Limpieza', 4.80, 5.90, 15, 11],
  ['Detergente Ariel Doble Poder 750 g', 'Limpieza', 8.20, 9.80, 10, 11],
  ['Limpiador Cif Crema Limón 375 g', 'Limpieza', 6.40, 7.80, 9, 12],
  ['Fósforos Inti Paquete x10', 'Limpieza', 2.20, 3.00, 25, 14],

  // CUIDADO PERSONAL (10)
  ['Papel Higiénico Suave Doble Hoja x4', 'Cuidado Personal', 4.60, 5.80, 22, 13],
  ['Papel Higiénico Elite Ultra x4', 'Cuidado Personal', 5.20, 6.50, 3, 13],
  ['Papel Toalla Scott Megarrollo', 'Cuidado Personal', 4.00, 5.00, 15, 13],
  ['Toallas Higiénicas Kotex Nocturna x8', 'Cuidado Personal', 5.40, 6.80, 12, 13],
  ['Pañales Huggies Active Sec G x14', 'Cuidado Personal', 14.50, 17.50, 2, 13],
  ['Shampoo Head & Shoulders 375 ml', 'Cuidado Personal', 15.80, 19.00, 8, 11],
  ['Shampoo Sedal Ceramidas 340 ml', 'Cuidado Personal', 11.20, 13.50, 10, 12],
  ['Jabón de Tocador Dove Original 90 g', 'Cuidado Personal', 3.40, 4.30, 20, 12],
  ['Desodorante Rexona Clinical Roll-On', 'Cuidado Personal', 10.50, 12.80, 3, 12],
  ['Pasta Dental Colgate Triple Acción 75 ml', 'Cuidado Personal', 4.20, 5.30, 18, 12]
];

const VECINOS_DATA = [
  { nombre: 'María Elena Quispe Rojas', telefono: '976112233' },
  { nombre: 'Carlos Alberto Mendoza Díaz', telefono: '976223344' },
  { nombre: 'Rosaura Chávez Paredes', telefono: '976334455' },
  { nombre: 'Jorge Luis Huamán Terán', telefono: '976445566' },
  { nombre: 'Carmen Rosa Vásquez León', telefono: '976556677' },
  { nombre: 'Segundo Manuel Salazar Cruz', telefono: '976667788' },
  { nombre: 'Luz Marina Terrones Vigo', telefono: '976778899' },
  { nombre: 'Pedro Pablo Alcántara Soto', telefono: '976889900' },
  { nombre: 'Ana Lucía Becerra Morales', telefono: '976990011' },
  { nombre: 'José Antonio Cabrera Pajares', telefono: '976102030' }
];

const CLIENTES_BOLETA = [
  { nombre: 'Luis Fernando Paredes Silva', doc: '45218934' },
  { nombre: 'Fiorella Jazmín Torres Vargas', doc: '72456128' },
  { nombre: 'Víctor Hugo Zambrano Ortiz', doc: '26645109' },
  { nombre: 'Milagros del Pilar Rojas Muñoz', doc: '41892345' },
  { nombre: 'César Augusto León Morales', doc: '26710482' },
  { nombre: 'Diana Carolina Vargas Flores', doc: '71984321' },
  { nombre: 'Elmer Oswaldo Cruzado Vera', doc: '43567891' },
  { nombre: 'Yolanda Beatriz Díaz Cerna', doc: '26689012' }
];

const CLIENTES_FACTURA = [
  { nombre: 'RESTAURANTE EL SABOR CAJAMARQUINO S.A.C.', doc: '20601234561' },
  { nombre: 'FERRETERÍA SAN MARTÍN E.I.R.L.', doc: '20602345672' },
  { nombre: 'HOSPEDAJE LOS PINOS DEL INCA S.R.L.', doc: '20603456783' },
  { nombre: 'PANADERÍA LA ESPIGA DORADA E.I.R.L.', doc: '20604567894' },
  { nombre: 'BOTICA SALUD DEL NORTE S.A.C.', doc: '20605678905' }
];

async function buscarBodegaNova() {
  const negocio = await prisma.negocio.findFirst({
    where: { nombre: { equals: 'Bodega NOVA', mode: 'insensitive' } },
    include: { usuarios: true }
  });

  if (!negocio) {
    throw new Error('No se encontró ningún negocio llamado exactamente "Bodega NOVA". Operación abortada por seguridad.');
  }
  if (!negocio.nombre.toUpperCase().includes('NOVA')) {
    throw new Error(`Negocio inesperado (${negocio.nombre}). Abortando para no tocar otra bodega.`);
  }
  return negocio;
}

async function limpiarDatosNova(negocioId) {
  console.log('Limpiando datos operativos anteriores de Bodega NOVA (conservando usuarios y configuración)...');
  await prisma.$transaction([
    prisma.cuentaPorCobrar.deleteMany({ where: { cliente: { negocioId } } }),
    prisma.detalleVenta.deleteMany({ where: { venta: { negocioId } } }),
    prisma.venta.deleteMany({ where: { negocioId } }),
    prisma.detallePlanCompra.deleteMany({ where: { planCompra: { negocioId } } }),
    prisma.planCompra.deleteMany({ where: { negocioId } }),
    prisma.movimientoInventario.deleteMany({ where: { producto: { negocioId } } }),
    prisma.movimientoCaja.deleteMany({ where: { negocioId } }),
    prisma.cliente.deleteMany({ where: { negocioId } }),
    prisma.producto.deleteMany({ where: { negocioId } }),
    prisma.proveedor.deleteMany({ where: { negocioId } }),
    prisma.negocio.update({ where: { id: negocioId }, data: { saldoCaja: 0 } })
  ]);
  console.log('Limpieza completada.');
}

async function main() {
  const modoLimpiar = process.argv.includes('--limpiar');
  const modoReset = process.argv.includes('--reset');

  const nova = await buscarBodegaNova();
  console.log(`\nBodega objetivo verificada: [${nova.id}] ${nova.nombre} (RUC: ${nova.ruc || 'Sin RUC'})`);

  if (modoLimpiar) {
    await limpiarDatosNova(nova.id);
    console.log('Listo: Bodega NOVA quedó limpia sin afectar ninguna otra bodega.\n');
    return;
  }

  if (modoReset) {
    await limpiarDatosNova(nova.id);
  } else {
    const yaSembrado = await prisma.producto.findFirst({
      where: { negocioId: nova.id, codigo: 'AJ-900001' }
    });
    if (yaSembrado) {
      console.log('\nLos datos de prueba ya fueron cargados en Bodega NOVA.');
      console.log('Si quieres regenerarlos desde cero, ejecuta: node scripts/seedNova.js --reset\n');
      return;
    }
  }

  const vendedor = nova.usuarios.find(u => u.rol === 'ADMIN') || nova.usuarios[0];
  if (!vendedor) {
    throw new Error('Bodega NOVA no tiene ningún usuario registrado para asignar como vendedor.');
  }
  console.log(`Vendedor asignado para el historial: ${vendedor.nombre} (${vendedor.rol})`);

  const igvFactor = 1 + (Number(nova.impuestoPorcentaje || 18) / 100);

  // 1. CREAR 15 PROVEEDORES
  console.log('\n1/6 Creando 15 proveedores peruanos...');
  const proveedoresCreados = [];
  for (const p of PROVEEDORES_DATA) {
    const existente = await prisma.proveedor.findFirst({
      where: { negocioId: nova.id, ruc: p.ruc }
    });
    if (existente) {
      proveedoresCreados.push(existente);
    } else {
      const creado = await prisma.proveedor.create({
        data: { ...p, negocioId: nova.id }
      });
      proveedoresCreados.push(creado);
    }
  }
  console.log(`   -> ${proveedoresCreados.length} proveedores listos.`);

  // 2. CREAR 100 PRODUCTOS VARIADOS (Con prefijo AJ- para NO salir en catálogo global)
  console.log('2/6 Creando 100 productos de bodega peruana...');
  const productosCreados = [];
  const movimientosInvBatch = [];

  for (let i = 0; i < PRODUCTOS_DATA.length; i++) {
    const [nombre, categoria, precioCompra, precioVenta, stock, provIdx] = PRODUCTOS_DATA[i];
    const codigo = `AJ-${900001 + i}`;
    const proveedor = proveedoresCreados[provIdx];

    const prod = await prisma.producto.create({
      data: {
        codigo,
        nombre,
        categoria,
        precioCompra,
        precioVenta,
        stock,
        stockMinimo: 5,
        unidadMedida: 'Unidades',
        negocioId: nova.id,
        proveedorId: proveedor.id,
        createdAt: haceDias(46, 8, 30)
      }
    });
    productosCreados.push(prod);

    movimientosInvBatch.push({
      productoId: prod.id,
      tipo: 'ABASTECIMIENTO',
      cantidad: stock + randInt(5, 20),
      motivo: 'Stock inicial de apertura de bodega',
      createdAt: haceDias(46, 9, 0)
    });
  }
  console.log(`   -> ${productosCreados.length} productos creados (prefijo AJ-900xxx).`);

  // 3. CREAR 10 VECINOS (DIRECTORIO DE FIADOS)
  console.log('3/6 Creando directorio de 10 vecinos...');
  const vecinosCreados = [];
  for (const v of VECINOS_DATA) {
    const creado = await prisma.cliente.create({
      data: {
        nombre: v.nombre,
        telefono: v.telefono,
        negocioId: nova.id,
        createdAt: haceDias(40, 10, 0)
      }
    });
    vecinosCreados.push(creado);
  }
  console.log(`   -> ${vecinosCreados.length} vecinos registrados.`);

  // Acumulador cronológico de caja (se ordena y calcula saldoResultante al final)
  const eventosCaja = [
    {
      tipo: 'INGRESO',
      categoria: 'CAPITAL_INICIAL',
      monto: 2500.0,
      metodoPago: 'EFECTIVO',
      descripcion: 'Capital inicial de apertura en efectivo',
      createdAt: haceDias(46, 8, 0)
    },
    {
      tipo: 'INGRESO',
      categoria: 'CAPITAL_INICIAL',
      monto: 1200.0,
      metodoPago: 'YAPE_PLIN',
      descripcion: 'Fondo inicial en billetera digital Yape/Plin',
      createdAt: haceDias(46, 8, 5)
    }
  ];

  // 4. CREAR 8 PLANES DE COMPRA (5 RECIBIDOS + 3 PENDIENTES, CON OFERTAS GRATIS Y FALTANTES)
  console.log('4/6 Creando 8 planes de compra (incluyendo ofertas gratis y faltantes)...');
  const definicionPlanes = [
    { provIdx: 0, diasAtras: 36, estado: 'RECIBIDO', metodo: 'EFECTIVO', conRegalo: true, conFaltante: false },
    { provIdx: 2, diasAtras: 28, estado: 'RECIBIDO', metodo: 'TRANSFERENCIA', conRegalo: false, conFaltante: false },
    { provIdx: 4, diasAtras: 20, estado: 'RECIBIDO', metodo: 'YAPE_PLIN', conRegalo: false, conFaltante: true },
    { provIdx: 7, diasAtras: 12, estado: 'RECIBIDO', metodo: 'EFECTIVO', conRegalo: true, conFaltante: false },
    { provIdx: 6, diasAtras: 5, estado: 'RECIBIDO', metodo: 'TRANSFERENCIA', conRegalo: false, conFaltante: true },
    { provIdx: 1, diasAtras: 1, estado: 'PENDIENTE', metodo: 'EFECTIVO', conRegalo: true, conFaltante: false, esperaEnDias: 2 },
    { provIdx: 11, diasAtras: 1, estado: 'PENDIENTE', metodo: 'YAPE_PLIN', conRegalo: false, conFaltante: false, esperaEnDias: 4 },
    { provIdx: 13, diasAtras: 0, estado: 'PENDIENTE', metodo: 'EFECTIVO', conRegalo: false, conFaltante: false, esperaEnDias: 5 }
  ];

  for (const cfg of definicionPlanes) {
    const prov = proveedoresCreados[cfg.provIdx];
    const prodsProv = productosCreados.filter(p => p.proveedorId === prov.id);
    const seleccionados = prodsProv.slice(0, Math.min(3, prodsProv.length));

    const detalles = seleccionados.map((prod, idx) => {
      const cantidadEsperada = idx === 0 ? 24 : 12;
      let cantidadRecibida = 0;
      if (cfg.estado === 'RECIBIDO') {
        if (cfg.conFaltante && idx === 0) cantidadRecibida = 12; // Llegó solo 1 caja de 2
        else if (cfg.conFaltante && idx === 2) cantidadRecibida = 0; // Proveedor sin stock
        else cantidadRecibida = cantidadEsperada;
      }
      return {
        productoId: prod.id,
        cantidadEsperada,
        cantidadRecibida,
        precioCompra: prod.precioCompra
      };
    });

    // Bonificación / Oferta gratis S/ 0.00
    if (cfg.conRegalo && prodsProv.length > 0) {
      const prodRegalo = prodsProv[prodsProv.length - 1];
      detalles.push({
        productoId: prodRegalo.id,
        cantidadEsperada: 2,
        cantidadRecibida: cfg.estado === 'RECIBIDO' ? 2 : 0,
        precioCompra: 0
      });
    }

    const totalEsperado = redondear2(detalles.reduce((s, d) => s + d.cantidadEsperada * d.precioCompra, 0));
    const totalReal = cfg.estado === 'RECIBIDO'
      ? redondear2(detalles.reduce((s, d) => s + d.cantidadRecibida * d.precioCompra, 0))
      : 0;

    const fechaCreacion = haceDias(cfg.diasAtras, 9, 15);
    const fechaEsperada = cfg.estado === 'PENDIENTE'
      ? enDias(cfg.esperaEnDias)
      : haceDias(Math.max(0, cfg.diasAtras - 1), 12, 0);
    const fechaRecibido = cfg.estado === 'RECIBIDO'
      ? haceDias(Math.max(0, cfg.diasAtras - 1), 14, 30)
      : null;

    const plan = await prisma.planCompra.create({
      data: {
        negocioId: nova.id,
        proveedorId: prov.id,
        estado: cfg.estado,
        fechaCreacion,
        fechaEsperada,
        fechaRecibido,
        totalEsperado,
        totalReal,
        detalles: { create: detalles }
      }
    });

    if (cfg.estado === 'RECIBIDO') {
      for (const d of detalles) {
        if (d.cantidadRecibida > 0) {
          movimientosInvBatch.push({
            productoId: d.productoId,
            tipo: 'ABASTECIMIENTO',
            cantidad: d.cantidadRecibida,
            motivo: d.precioCompra === 0
              ? `Bonificación / Oferta gratis por Plan de Compra #${plan.id}`
              : `Ingreso por Plan de Compra #${plan.id}`,
            createdAt: fechaRecibido
          });
        }
      }

      if (totalReal > 0) {
        eventosCaja.push({
          tipo: 'EGRESO',
          categoria: 'COMPRA_PROVEEDOR',
          monto: totalReal,
          metodoPago: cfg.metodo,
          descripcion: `Pago Plan de Compra #${plan.id} (${prov.nombre})`,
          createdAt: fechaRecibido
        });
      }
    }
  }
  console.log('   -> 8 planes de compra registrados.');

  // 5. CREAR 75 VENTAS HISTÓRICAS (HOY, SEMANA, MES Y ANTERIORES) + FIADOS
  console.log('5/6 Generando 75 ventas históricas (Tickets, Boletas, Facturas y Fiados)...');

  // Distribución de días hacia atrás para tener datos ricos en HOY, SEMANA, MES y AÑO
  const diasVentas = [
    ...Array(6).fill(0),                       // 6 ventas HOY
    1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, // 18 ventas en la SEMANA
    ...Array.from({ length: 35 }, (_, idx) => 8 + (idx % 22)), // 35 ventas en el MES (días 8..29)
    ...Array.from({ length: 16 }, (_, idx) => 31 + (idx % 14)) // 16 ventas anteriores (días 31..44)
  ];

  // 10 ventas serán FIADO (3 pagadas, 3 vencidas hoy/ayer, 4 próximas)
  const indicesFiado = new Map([
    [10, { estado: 'PAGADO', vecinoIdx: 0, diasPagoDespues: 2, metodoCobro: 'EFECTIVO', recordatorios: 1 }],
    [22, { estado: 'PAGADO', vecinoIdx: 1, diasPagoDespues: 3, metodoCobro: 'YAPE_PLIN', recordatorios: 0 }],
    [35, { estado: 'PAGADO', vecinoIdx: 2, diasPagoDespues: 4, metodoCobro: 'EFECTIVO', recordatorios: 1 }],
    [12, { estado: 'PENDIENTE', vecinoIdx: 3, limiteEnDias: -2, recordatorios: 2 }],
    [18, { estado: 'PENDIENTE', vecinoIdx: 4, limiteEnDias: -1, recordatorios: 1 }],
    [25, { estado: 'PENDIENTE', vecinoIdx: 5, limiteEnDias: 0, recordatorios: 0 }],
    [4,  { estado: 'PENDIENTE', vecinoIdx: 6, limiteEnDias: 3, recordatorios: 0 }],
    [7,  { estado: 'PENDIENTE', vecinoIdx: 7, limiteEnDias: 5, recordatorios: 0 }],
    [14, { estado: 'PENDIENTE', vecinoIdx: 8, limiteEnDias: 7, recordatorios: 0 }],
    [2,  { estado: 'PENDIENTE', vecinoIdx: 9, limiteEnDias: 10, recordatorios: 0 }]
  ]);

  let seqTicket = 1;
  let seqBoleta = 1;
  let seqFactura = 1;

  for (let i = 0; i < diasVentas.length; i++) {
    const dias = diasVentas[i];
    const fechaVenta = haceDias(dias, randInt(8, 21), randInt(0, 59));
    const infoFiado = indicesFiado.get(i);

    // Elegir entre 1 y 4 productos distintos para la venta
    const cantidadLineas = randInt(1, 4);
    const usados = new Set();
    const detallesVenta = [];

    for (let k = 0; k < cantidadLineas; k++) {
      let prod = pick(productosCreados);
      while (usados.has(prod.id)) prod = pick(productosCreados);
      usados.add(prod.id);

      const cantidad = randInt(1, 3);
      const subtotalLinea = redondear2(prod.precioVenta * cantidad);
      detallesVenta.push({
        productoId: prod.id,
        cantidad,
        precioVenta: prod.precioVenta,
        subtotal: subtotalLinea
      });
    }

    const total = redondear2(detallesVenta.reduce((s, d) => s + d.subtotal, 0));

    let tipoComprobante = 'SIN_COMPROBANTE';
    let metodoPago = 'EFECTIVO';
    let numeroComprobante = '';
    let clienteNombre = 'Cliente Varios';
    let clienteDocumento = null;

    if (infoFiado) {
      tipoComprobante = 'SIN_COMPROBANTE';
      metodoPago = 'FIADO';
      numeroComprobante = `T001-${String(seqTicket++).padStart(5, '0')}`;
      clienteNombre = vecinosCreados[infoFiado.vecinoIdx].nombre;
    } else {
      const rDoc = rng();
      if (rDoc < 0.55) {
        tipoComprobante = 'SIN_COMPROBANTE';
        numeroComprobante = `T001-${String(seqTicket++).padStart(5, '0')}`;
      } else if (rDoc < 0.85) {
        tipoComprobante = 'BOLETA';
        numeroComprobante = `B001-${String(seqBoleta++).padStart(5, '0')}`;
        const cli = pick(CLIENTES_BOLETA);
        clienteNombre = cli.nombre;
        clienteDocumento = cli.doc;
      } else {
        tipoComprobante = 'FACTURA';
        numeroComprobante = `F001-${String(seqFactura++).padStart(5, '0')}`;
        const emp = pick(CLIENTES_FACTURA);
        clienteNombre = emp.nombre;
        clienteDocumento = emp.doc;
      }

      const rPago = rng();
      if (rPago < 0.55) metodoPago = 'EFECTIVO';
      else if (rPago < 0.88) metodoPago = 'YAPE_PLIN';
      else metodoPago = 'TRANSFERENCIA';
    }

    const subtotal = tipoComprobante === 'SIN_COMPROBANTE' ? total : redondear2(total / igvFactor);
    const igv = tipoComprobante === 'SIN_COMPROBANTE' ? 0 : redondear2(total - subtotal);

    const venta = await prisma.venta.create({
      data: {
        negocioId: nova.id,
        vendedorId: vendedor.id,
        tipoComprobante,
        metodoPago,
        numeroComprobante,
        clienteNombre,
        clienteDocumento,
        subtotal,
        igv,
        total,
        createdAt: fechaVenta,
        detalles: { create: detallesVenta }
      }
    });

    for (const d of detallesVenta) {
      movimientosInvBatch.push({
        productoId: d.productoId,
        tipo: 'VENTA',
        cantidad: d.cantidad,
        motivo: `Venta ${numeroComprobante}`,
        createdAt: fechaVenta
      });
    }

    if (infoFiado) {
      const vecino = vecinosCreados[infoFiado.vecinoIdx];
      const fechaLimite = infoFiado.estado === 'PAGADO'
        ? haceDias(Math.max(0, dias - 1), 12, 0)
        : enDias(infoFiado.limiteEnDias);
      const fechaPago = infoFiado.estado === 'PAGADO'
        ? haceDias(Math.max(0, dias - infoFiado.diasPagoDespues), 16, 20)
        : null;

      await prisma.cuentaPorCobrar.create({
        data: {
          clienteId: vecino.id,
          ventaId: venta.id,
          monto: total,
          estado: infoFiado.estado,
          fechaLimite,
          fechaPago,
          recordatorios: infoFiado.recordatorios,
          createdAt: fechaVenta
        }
      });

      if (infoFiado.estado === 'PAGADO') {
        eventosCaja.push({
          tipo: 'INGRESO',
          categoria: 'COBRO_FIADO',
          monto: total,
          metodoPago: infoFiado.metodoCobro,
          descripcion: `Cobro de fiado - ${vecino.nombre}`,
          createdAt: fechaPago
        });
      }
    } else {
      eventosCaja.push({
        tipo: 'INGRESO',
        categoria: 'VENTA',
        monto: total,
        metodoPago,
        descripcion: `Venta ${numeroComprobante} (${clienteNombre})`,
        createdAt: fechaVenta
      });
    }
  }

  // Gastos operativos realistas de bodega peruana
  const gastosExtra = [
    { dias: 38, monto: 185.50, metodo: 'TRANSFERENCIA', desc: 'Pago de recibo de luz Hidrandina' },
    { dias: 30, monto: 48.00, metodo: 'EFECTIVO', desc: 'Compra de bolsas plásticas y rollos térmicos' },
    { dias: 22, monto: 89.90, metodo: 'YAPE_PLIN', desc: 'Pago mensual de internet para punto de venta' },
    { dias: 11, monto: 35.00, metodo: 'EFECTIVO', desc: 'Pasajes y flete de mercadería local' },
    { dias: 3,  monto: 65.00, metodo: 'YAPE_PLIN', desc: 'Mantenimiento preventivo de vitrina refrigeradora' }
  ];

  for (const g of gastosExtra) {
    eventosCaja.push({
      tipo: 'EGRESO',
      categoria: 'GASTO_PERSONAL',
      monto: g.monto,
      metodoPago: g.metodo,
      descripcion: g.desc,
      createdAt: haceDias(g.dias, 17, 10)
    });
  }

  // 6. INSERTAR MOVIMIENTOS DE INVENTARIO Y FLUJO DE CAJA CRONOLÓGICO
  console.log('6/6 Registrando kardex de inventario y curva de flujo de caja...');
  await prisma.movimientoInventario.createMany({ data: movimientosInvBatch });

  eventosCaja.sort((a, b) => a.createdAt - b.createdAt);
  let saldoAcumulado = 0;
  const movimientosCajaFinales = eventosCaja.map(ev => {
    saldoAcumulado = redondear2(saldoAcumulado + (ev.tipo === 'INGRESO' ? ev.monto : -ev.monto));
    return {
      negocioId: nova.id,
      tipo: ev.tipo,
      categoria: ev.categoria,
      monto: ev.monto,
      saldoResultante: saldoAcumulado,
      metodoPago: ev.metodoPago,
      descripcion: ev.descripcion,
      createdAt: ev.createdAt
    };
  });

  await prisma.movimientoCaja.createMany({ data: movimientosCajaFinales });
  await prisma.negocio.update({
    where: { id: nova.id },
    data: { saldoCaja: saldoAcumulado }
  });

  console.log('\n=================================================');
  console.log('  DATOS DE PRUEBA CARGADOS EN BODEGA NOVA');
  console.log('=================================================');
  console.log(`  Proveedores:         ${proveedoresCreados.length}`);
  console.log(`  Productos (AJ-):     ${productosCreados.length}`);
  console.log(`  Vecinos (Fiados):    ${vecinosCreados.length}`);
  console.log('  Planes de Compra:    8 (5 recibidos, 3 pendientes)');
  console.log(`  Ventas históricas:   ${diasVentas.length} (incluye 10 fiados)`);
  console.log(`  Movimientos de caja: ${movimientosCajaFinales.length}`);
  console.log(`  Saldo final en caja: S/ ${saldoAcumulado.toFixed(2)}`);
  console.log('=================================================\n');
}

main()
  .catch((err) => {
    console.error('\nError ejecutando seedNova:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });