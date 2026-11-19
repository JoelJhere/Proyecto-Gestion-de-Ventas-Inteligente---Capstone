import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaSearch, FaShoppingCart, FaTrash, FaPlus, FaMinus, FaCamera,
  FaUser, FaFileInvoice, FaTimes, FaEnvelope, FaWhatsapp, FaPrint,
  FaCheckCircle, FaBarcode, FaExternalLinkAlt
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { io } from 'socket.io-client';
import { useBusiness } from '../context/BusinessContext';
import ComprobanteDetallado from '../components/ComprobanteDetallado';

const socket = io('https://proyecto-gestion-de-ventas-inteligente.onrender.com');

const LogoEfectivo = () => (
  <div className="flex items-center justify-center w-7 h-5 rounded bg-emerald-700 text-white font-bold text-[11px] shadow-2xs shrink-0 border border-emerald-800">
    S/
  </div>
);

const LogosYapePlin = () => (
  <div className="flex items-center -space-x-1.5 shrink-0">
    <div className="w-5 h-5 rounded-md bg-[#742384] text-white flex items-center justify-center font-black text-[10px] shadow-2xs border border-white z-10">
      y
    </div>
    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#00A8E8] to-[#00E5FF] text-white flex items-center justify-center font-extrabold text-[8px] shadow-2xs border border-white">
      plin
    </div>
  </div>
);

const LogosBancos = () => (
  <div className="flex items-center gap-0.5 shrink-0">
    <span className="px-1 py-0.5 rounded bg-[#002A8D] text-white font-black text-[8px] tracking-tighter">BCP</span>
    <span className="px-1 py-0.5 rounded bg-[#009B3A] text-white font-black text-[8px] tracking-tighter">IBK</span>
  </div>
);

export default function Ventas() {
  const LIMITE_DROPDOWN = 30;

  const { businessConfig } = useBusiness();
  const [productos, setProductos] = useState([]);

  // Estados de Búsqueda y Carrito
  const [busqueda, setBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [carrito, setCarrito] = useState(() => JSON.parse(localStorage.getItem('pos_carrito')) || []);
  const [tipoComprobante, setTipoComprobante] = useState(() => localStorage.getItem('pos_tipo_comprobante') || 'TICKET');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  const [montoRecibido, setMontoRecibido] = useState('');

  // Estados del Cliente y Envío
  const [cliente, setCliente] = useState(() => JSON.parse(localStorage.getItem('pos_cliente')) || { documento: '', nombre: '', correo: '', telefono: '' });
  const [metodoEnvio, setMetodoEnvio] = useState('NINGUNO');

  // Estados de UI y candados anti-spam
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const procesandoRef = useRef(false);
  const consultandoDocRef = useRef(false);
  const [ventaGenerada, setVentaGenerada] = useState(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  // Refs para cierre táctil confiable en tablets/celulares
  const buscadorRef = useRef(null);
  const vecinosRef = useRef(null);

  // Estados para autocompletado de vecinos en Fiados
  const [clientesFiado, setClientesFiado] = useState([]);
  const [showVecinosDropdown, setShowVecinosDropdown] = useState(false);

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');

  // Guardado automático en caché
  useEffect(() => localStorage.setItem('pos_carrito', JSON.stringify(carrito)), [carrito]);
  useEffect(() => localStorage.setItem('pos_tipo_comprobante', tipoComprobante), [tipoComprobante]);
  useEffect(() => localStorage.setItem('pos_cliente', JSON.stringify(cliente)), [cliente]);

  // Cierre de desplegables al tocar fuera (evita fallos de onBlur en tablets)
  useEffect(() => {
    const manejarClicExterno = (e) => {
      if (buscadorRef.current && !buscadorRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (vecinosRef.current && !vecinosRef.current.contains(e.target)) {
        setShowVecinosDropdown(false);
      }
    };
    document.addEventListener('mousedown', manejarClicExterno);
    return () => document.removeEventListener('mousedown', manejarClicExterno);
  }, []);

  // Cálculos de Facturación y Vuelto
  const totalPagado = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
  const igvPorcentaje = businessConfig?.impuestoPorcentaje || 18;
  const factorIgv = 1 + (igvPorcentaje / 100);
  const subtotalBase = tipoComprobante !== 'TICKET' ? (totalPagado / factorIgv) : totalPagado;
  const montoIgv = tipoComprobante !== 'TICKET' ? (totalPagado - subtotalBase) : 0;

  const montoRecibidoNum = parseFloat(montoRecibido);
  const tieneMontoRecibido = montoRecibido !== '' && !Number.isNaN(montoRecibidoNum) && montoRecibidoNum > 0;
  const vueltoCalculado = tieneMontoRecibido ? montoRecibidoNum - totalPagado : 0;

  // Cargar Catálogo y clientes en paralelo + limpiar productos ajenos a esta bodega
  const cargarCatalogo = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [resProductos, resClientes] = await Promise.all([
        axios.get('/productos', { headers }),
        axios.get('/fiados/clientes', { headers })
      ]);

      const disponibles = resProductos.data.filter(p => p.estado === true && p.stock > 0);
      setProductos(disponibles);
      setClientesFiado(resClientes.data);

      // Seguridad Multi-Bodega: filtramos el carrito en caché para que solo queden productos de esta tienda
      setCarrito(prevCarrito =>
        prevCarrito
          .filter(item => disponibles.some(p => p.id === item.id))
          .map(item => {
            const prodActual = disponibles.find(p => p.id === item.id);
            return {
              ...prodActual,
              cantidad: Math.min(item.cantidad, prodActual.stock)
            };
          })
      );
    } catch (error) {
      console.error('Error al cargar productos', error);
      toast.error('No se pudo cargar el inventario.', { id: 'pos-carga' });
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarCatalogo(); }, []);

  // Conexión Socket.io para sincronización multi-caja
  useEffect(() => {
    if (!usuario.id) return;
    socket.emit('unirse_caja', usuario.id);
    socket.on('carrito_actualizado', (carritoRemoto) => {
      setCarrito(carritoRemoto);
    });
    return () => {
      socket.off('carrito_actualizado');
    };
  }, [usuario.id]);

  // --- CONTROL DEL CARRITO ---
  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const itemExistente = prev.find(item => item.id === producto.id);
      let nuevoCarrito;

      if (itemExistente) {
        if (itemExistente.cantidad >= producto.stock) {
          toast.error('Límite de stock alcanzado para este producto.', { id: 'pos-stock' });
          return prev;
        }
        nuevoCarrito = prev.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      } else {
        nuevoCarrito = [...prev, { ...producto, cantidad: 1 }];
      }

      socket.emit('sincronizar_carrito', { usuarioId: usuario.id, carrito: nuevoCarrito });
      return nuevoCarrito;
    });
  };

  const actualizarCantidad = (id, delta) => {
    setCarrito(prev => {
      const nuevoCarrito = prev.map(item => {
        if (item.id === id) {
          const nuevaCantidad = item.cantidad + delta;
          if (nuevaCantidad > item.stock) {
            toast.error('Stock insuficiente en inventario.', { id: 'pos-stock' });
            return item;
          }
          return { ...item, cantidad: nuevaCantidad };
        }
        return item;
      }).filter(item => item.cantidad > 0);

      socket.emit('sincronizar_carrito', { usuarioId: usuario.id, carrito: nuevoCarrito });
      return nuevoCarrito;
    });
  };

  const vaciarCarrito = () => {
    setCarrito([]);
    setMontoRecibido('');
    socket.emit('sincronizar_carrito', { usuarioId: usuario.id, carrito: [] });
  };

  const cambiarTipoComprobante = (nuevoTipo) => {
    setTipoComprobante(nuevoTipo);
    if (nuevoTipo === 'BOLETA' && cliente.documento?.length > 8) {
      setCliente(prev => ({ ...prev, documento: prev.documento.slice(0, 8), nombre: '' }));
    }
    if (nuevoTipo === 'FIADO') {
      setMontoRecibido('');
    }
  };

  // --- LÓGICA DEL ESCÁNER DE CÓDIGO DE BARRAS ---
  useEffect(() => {
    let html5QrCode;
    let timerId;

    if (isScannerOpen) {
      timerId = setTimeout(() => {
        html5QrCode = new Html5Qrcode('reader-ventas');
        html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 100 } },
          async (decodedText) => {
            if (html5QrCode.isScanning) {
              await html5QrCode.stop();
              html5QrCode.clear();
            }
            setIsScannerOpen(false);

            const productoEncontrado = productos.find(p => p.codigo === decodedText);
            if (productoEncontrado) {
              agregarAlCarrito(productoEncontrado);
              toast.success(`${productoEncontrado.nombre} agregado al carrito.`, { id: 'pos-scan' });
            } else {
              toast.error(`El código ${decodedText} no existe en inventario o no tiene stock.`, { id: 'pos-scan' });
            }
          },
          () => { /* Ignoramos advertencias de enfoque */ }
        ).catch(err => {
          console.error('Error al iniciar cámara:', err);
          toast.error('Error al acceder a la cámara. Verifica los permisos.', { id: 'pos-scan' });
          setIsScannerOpen(false);
        });
      }, 200);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScannerOpen, productos]);

  // --- CONSULTA A RENIEC / SUNAT ---
  const buscarDocumento = async (numeroBuscar, tipoDoc) => {
    if (consultandoDocRef.current) return;
    consultandoDocRef.current = true;
    setIsLoadingDoc(true);

    try {
      const token = localStorage.getItem('token');
      const tipoConsulta = tipoDoc === 'FACTURA' ? 'ruc' : 'dni';

      const res = await axios.get(`/externa/consulta/${tipoConsulta}/${numeroBuscar}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      let nombreEncontrado = '';
      if (tipoConsulta === 'ruc') {
        nombreEncontrado = res.data.business_name || res.data.razonSocial || res.data.razon_social;
      } else {
        nombreEncontrado = res.data.full_name || `${res.data.first_name} ${res.data.first_last_name}`;
      }

      setCliente(prev => ({ ...prev, nombre: nombreEncontrado }));
      toast.success('Datos encontrados en padrón oficial.', { id: 'pos-doc' });
    } catch (error) {
      console.error(error);
      setCliente(prev => ({ ...prev, nombre: '' }));
      toast.error('Documento no encontrado en la base de datos.', { id: 'pos-doc' });
    } finally {
      consultandoDocRef.current = false;
      setIsLoadingDoc(false);
    }
  };

  // --- PROCESAMIENTO DE VENTA ---
  const handleProcesarVenta = async (esFiado = false) => {
    if (procesandoRef.current) return;
    if (carrito.length === 0) return toast.error('El carrito está vacío.', { id: 'pos-validacion' });

    if (esFiado) {
      if (!cliente.nombre.trim()) return toast.error('Ingrese el nombre del vecino para fiarle.', { id: 'pos-validacion' });
      if (!cliente.telefono || cliente.telefono.length !== 9 || !cliente.telefono.startsWith('9')) {
        return toast.error('El número de WhatsApp debe tener 9 dígitos y empezar con 9.', { id: 'pos-validacion' });
      }
    }

    if (tipoComprobante === 'FACTURA') {
      if (!cliente.documento || cliente.documento.length !== 11) return toast.error('Ingrese un RUC válido de 11 dígitos.', { id: 'pos-validacion' });
      if (!cliente.nombre.trim()) return toast.error('Ingrese la Razón Social.', { id: 'pos-validacion' });
    } else if (tipoComprobante === 'BOLETA') {
      if (!cliente.documento || cliente.documento.length !== 8) return toast.error('Ingrese un DNI válido de 8 dígitos.', { id: 'pos-validacion' });
      if (!cliente.nombre.trim()) return toast.error('Ingrese el Nombre del cliente.', { id: 'pos-validacion' });
    }

    if (tipoComprobante !== 'TICKET' && !esFiado) {
      if (metodoEnvio === 'CORREO') {
        const correoLimpio = (cliente.correo || '').trim();
        if (!correoLimpio || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
          return toast.error('Ingrese un correo electrónico válido para enviar el comprobante.', { id: 'pos-validacion' });
        }
      }
      if (metodoEnvio === 'WHATSAPP' && (!cliente.telefono || cliente.telefono.length !== 9 || !cliente.telefono.startsWith('9'))) {
        return toast.error('El número de WhatsApp debe tener 9 dígitos y empezar con 9.', { id: 'pos-validacion' });
      }
    }

    const metodoPagoFinal = esFiado ? 'FIADO' : metodoPago;

    procesandoRef.current = true;
    setIsProcessing(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        carrito: carrito.map(item => ({
          id: item.id,
          codigo: item.codigo,
          cantidad: item.cantidad,
          precioVenta: item.precioVenta,
          nombre: item.nombre
        })),
        tipoComprobante,
        metodoPago: metodoPagoFinal,
        subtotal: subtotalBase,
        igv: montoIgv,
        total: totalPagado,
        cliente: {
          ...cliente,
          nombre: (cliente.nombre || '').trim(),
          correo: (cliente.correo || '').trim()
        },
        metodoEnvio,
        esFiado
      };

      const res = await axios.post('/ventas', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Venta registrada con éxito.', { id: 'pos-exito' });

      setVentaGenerada({
        ...res.data.venta,
        id: res.data.venta.id,
        tipo: tipoComprobante,
        tipoComprobante: res.data.venta.tipoComprobante,
        numeroComprobante: res.data.venta.numeroComprobante,
        createdAt: res.data.venta.createdAt || new Date().toISOString(),
        metodoPago: metodoPagoFinal,
        subtotal: subtotalBase,
        igv: montoIgv,
        total: totalPagado,
        cliente: tipoComprobante === 'TICKET' ? 'Cliente Varios' : (cliente.nombre.trim() || 'Cliente Varios'),
        clienteNombre: tipoComprobante === 'TICKET' ? 'Cliente Varios' : (cliente.nombre.trim() || 'Cliente Varios'),
        documentoCliente: cliente.documento,
        clienteDocumento: cliente.documento,
        vendedor: { nombre: usuario.nombre || 'Cajero' },
        detalles: carrito.map((item) => ({
          id: item.id,
          cantidad: item.cantidad,
          subtotal: item.precioVenta * item.cantidad,
          producto: { nombre: item.nombre, codigo: item.codigo }
        })),
        metodoEnvio: tipoComprobante === 'TICKET' ? 'NINGUNO' : metodoEnvio,
        contactoEnvio: tipoComprobante === 'TICKET' ? '' : (metodoEnvio === 'CORREO' ? cliente.correo.trim() : cliente.telefono),
        enlacePdf: res.data.enlacePdf,
        nombreNegocio: res.data.nombreNegocio
      });

      // Limpiamos la caja
      setCarrito([]);
      setCliente({ documento: '', nombre: '', correo: '', telefono: '' });
      setMetodoEnvio('NINGUNO');
      setTipoComprobante('TICKET');
      setMetodoPago('EFECTIVO');
      setMontoRecibido('');
      socket.emit('sincronizar_carrito', { usuarioId: usuario.id, carrito: [] });
      cargarCatalogo();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Ocurrió un error al procesar la venta.', { id: 'pos-error' });
    } finally {
      procesandoRef.current = false;
      setIsProcessing(false);
    }
  };

  // Filtro Dinámico del Buscador (limitado a 30 filas en el dropdown para fluidez en tablets)
  const qBusqueda = busqueda.trim().toLowerCase();
  const productosBuscados = qBusqueda === ''
    ? productos
    : productos.filter(prod =>
        prod.nombre.toLowerCase().includes(qBusqueda) ||
        prod.codigo.toLowerCase().includes(qBusqueda)
      );
  const productosDropdown = productosBuscados.slice(0, LIMITE_DROPDOWN);

  // Soporte rápido de tecla Enter (lector de código de barras físico o coincidencia única)
  const handleEnterBuscador = (e) => {
    if (e.key !== 'Enter' || !qBusqueda) return;
    e.preventDefault();

    const coincidenciaExacta = productos.find(p => p.codigo.toLowerCase() === qBusqueda);
    if (coincidenciaExacta) {
      agregarAlCarrito(coincidenciaExacta);
      setBusqueda('');
      setShowDropdown(false);
      return;
    }

    if (productosBuscados.length === 1) {
      agregarAlCarrito(productosBuscados[0]);
      setBusqueda('');
      setShowDropdown(false);
    }
  };

  // Filtro inteligente de vecinos para autocompletar en Fiados
  const vecinosFiltrados = clientesFiado.filter(v =>
    v.nombre.toLowerCase().includes((cliente.nombre || '').toLowerCase()) ||
    (v.telefono && v.telefono.includes(cliente.nombre || ''))
  ).slice(0, LIMITE_DROPDOWN);

  const vecinoCoincidente = clientesFiado.find(
    v => v.nombre.toLowerCase() === (cliente.nombre || '').trim().toLowerCase()
  );

  return (
    <div className="flex flex-col gap-5 text-slate-800 pb-24 lg:pb-6 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Punto de Venta
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 truncate">
            Módulo de facturación y despacho rápido • Cajero: <span className="font-bold text-slate-900">{usuario.nombre || 'Activo'}</span>
          </p>
        </div>

        <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm text-slate-700 bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.05)] self-start sm:self-auto whitespace-nowrap shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15 shrink-0"></span>
          <span className="font-semibold text-slate-700">SUNAT / OSE En Línea</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-bold text-slate-900">{new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>

      {/* CONTENEDOR SIMÉTRICO DE 2 PANELES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-10.5rem)] items-stretch">
        
        {/* PANEL IZQUIERDO: CATÁLOGO Y CARRITO RESPONSIVE */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden min-h-[360px] sm:min-h-[420px] lg:min-h-0">
          
          {/* Barra superior de búsqueda */}
          <div className="p-4 sm:p-5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div ref={buscadorRef} className="relative flex-1 min-w-0">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FaSearch className="text-slate-400 text-sm" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar producto por nombre o escanear código..." 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleEnterBuscador}
                  className={`w-full pl-10 ${busqueda ? 'pr-9' : 'pr-4'} py-2.5 sm:py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-verde-pastel/30 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all`} 
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => { setBusqueda(''); setShowDropdown(false); }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <FaTimes size={13} />
                  </button>
                )}

                <AnimatePresence>
                  {showDropdown && qBusqueda && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] z-40 max-h-64 overflow-y-auto divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full"
                    >
                      {productosDropdown.length === 0 ? (
                        <div className="p-4 text-slate-600 text-sm font-medium text-center">
                          No se encontraron productos disponibles con ese criterio.
                        </div>
                      ) : (
                        <>
                          {productosDropdown.map(prod => (
                            <button
                              type="button"
                              key={prod.id}
                              onClick={() => { agregarAlCarrito(prod); setBusqueda(''); setShowDropdown(false); }}
                              className="w-full text-left px-4 py-3 hover:bg-verde-pastel/20 cursor-pointer flex justify-between items-center gap-3 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 line-clamp-2">{prod.nombre}</p>
                                <p className="text-xs text-slate-500 font-mono mt-0.5">Código: {prod.codigo}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-emerald-700 font-extrabold text-sm font-mono">S/ {prod.precioVenta.toFixed(2)}</p>
                                <span className="inline-block text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                                  Stock: {prod.stock} un.
                                </span>
                              </div>
                            </button>
                          ))}
                          {productosBuscados.length > LIMITE_DROPDOWN && (
                            <div className="px-4 py-2 bg-slate-50 text-center text-[11px] font-semibold text-slate-500">
                              Mostrando {LIMITE_DROPDOWN} de {productosBuscados.length} resultados. Escribe más letras para precisar.
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl text-sm transition-all shadow-2xs flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FaCamera className="text-emerald-900 text-base" />
                <span>Lector Cámara</span>
              </button>
            </div>
          </div>
          
          {/* Cuerpo del carrito: Tarjetas en Celular (1 col) / Tablet (2 cols) + Tabla en PC (>= 1024px) */}
          <div className="flex-1 overflow-auto bg-slate-50/40 lg:bg-white">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white">
                <div className="w-16 h-16 rounded-2xl bg-verde-pastel/30 text-emerald-700 flex items-center justify-center mb-4 shadow-2xs">
                  <FaBarcode className="text-3xl" />
                </div>
                <p className="text-base font-bold text-slate-800">Detalle de venta vacío</p>
                <p className="text-sm text-slate-500 font-medium mt-1 max-w-md">
                  Utilice el buscador superior o el botón de cámara para agregar productos a la operación actual.
                </p>
              </div>
            ) : (
              <>
                {/* VISTA CELULAR (1 col) Y TABLET VERTICAL (2 cols) */}
                <div className="lg:hidden p-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {carrito.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={item.nombre}>
                            {item.nombre}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="font-mono text-[11px] font-semibold text-slate-500">{item.codigo}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              item.stock <= 5 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                            }`}>
                              Disp: {item.stock} un.
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-semibold text-slate-400 block">Subtotal</span>
                          <span className="font-mono font-extrabold text-slate-900 text-base">
                            S/ {(item.precioVenta * item.cantidad).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <span className="text-xs font-mono font-semibold text-slate-600">
                          P. Unit: <strong className="text-slate-800">S/ {item.precioVenta.toFixed(2)}</strong>
                        </span>

                        <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => actualizarCantidad(item.id, -1)}
                            className={`p-2 rounded-lg transition-colors cursor-pointer ${
                              item.cantidad === 1 ? 'text-red-600 hover:bg-red-100/80' : 'text-slate-700 hover:bg-white'
                            }`}
                            title={item.cantidad === 1 ? 'Quitar producto' : 'Restar 1'}
                          >
                            {item.cantidad === 1 ? <FaTrash size={11} /> : <FaMinus size={11} />}
                          </button>
                          <span className="w-8 text-center text-sm font-extrabold text-slate-900">
                            {item.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => actualizarCantidad(item.id, 1)}
                            className="p-2 text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            title="Sumar 1"
                          >
                            <FaPlus size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* VISTA PC / LAPTOP (>= 1024px): Tabla clásica limpia */}
                <div className="hidden lg:block">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10">
                      <tr className="text-[11px] xl:text-xs font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Producto / Descripción</th>
                        <th className="py-3 px-3 text-right">P. Unit.</th>
                        <th className="py-3 px-3 text-center">Cantidad</th>
                        <th className="py-3 px-4 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {carrito.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                            {item.codigo}
                          </td>
                          <td className="py-3 px-4 max-w-[230px] xl:max-w-[300px]">
                            <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={item.nombre}>
                              {item.nombre}
                            </p>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Disponible: <span className={item.stock <= 5 ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>{item.stock} un.</span>
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700 text-sm whitespace-nowrap">
                            S/ {item.precioVenta.toFixed(2)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center">
                              <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-0.5 shadow-2xs">
                                <button 
                                  type="button"
                                  onClick={() => actualizarCantidad(item.id, -1)} 
                                  className={`p-2 rounded-lg transition-colors cursor-pointer ${item.cantidad === 1 ? 'text-red-600 hover:bg-red-100/80' : 'text-slate-700 hover:bg-white'}`}
                                >
                                  {item.cantidad === 1 ? <FaTrash size={11} /> : <FaMinus size={11} />}
                                </button>
                                <span className="w-8 text-center text-sm font-extrabold text-slate-900">
                                  {item.cantidad}
                                </span>
                                <button 
                                  type="button"
                                  onClick={() => actualizarCantidad(item.id, 1)} 
                                  className="p-2 text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
                                >
                                  <FaPlus size={11} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900 text-base whitespace-nowrap">
                            S/ {(item.precioVenta * item.cantidad).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Pie de tabla simétrico + botón rápido para vaciar */}
          <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-t border-slate-200/80 flex flex-wrap justify-between items-center gap-2 text-xs sm:text-sm text-slate-600 font-medium shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <span>Productos: <strong className="text-slate-900 font-bold">{carrito.length}</strong></span>
              <span>Unidades: <strong className="text-slate-900 font-bold">{carrito.reduce((acc, i) => acc + i.cantidad, 0)}</strong></span>
            </div>
            {carrito.length > 0 && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={vaciarCarrito}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <FaTrash size={10} /> Vaciar lista
              </button>
            )}
          </div>
        </div>

        {/* PANEL DERECHO: DATOS DEL COMPROBANTE Y COBRO */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
          
          {/* Cabecera compacta */}
          <div className="px-4 sm:px-5 py-3 bg-white border-b border-slate-100 flex justify-between items-center gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                <FaFileInvoice size={14} />
              </div>
              <h2 className="text-slate-900 font-bold text-sm sm:text-base tracking-tight truncate">
                Datos del Comprobante
              </h2>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 bg-verde-pastel/45 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
              IGV {igvPorcentaje}%
            </span>
          </div>

          {/* Cuerpo con barra deslizante moderna */}
          <div className="px-4 sm:px-5 py-3.5 space-y-3 bg-white flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-emerald-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            
            {/* 1. Selector de Tipo de Operación */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipo de Operación
              </label>
              <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-1">
                <button type="button" onClick={() => cambiarTipoComprobante('TICKET')} 
                  className={`py-1.5 px-1 text-[11px] xl:text-xs font-bold rounded-lg transition-all text-center leading-tight cursor-pointer ${tipoComprobante === 'TICKET' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Venta Rápida
                </button>
                <button type="button" onClick={() => cambiarTipoComprobante('BOLETA')} 
                  className={`py-1.5 px-1 text-[11px] xl:text-xs font-bold rounded-lg transition-all text-center leading-tight cursor-pointer ${tipoComprobante === 'BOLETA' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Boleta
                </button>
                <button type="button" onClick={() => cambiarTipoComprobante('FACTURA')} 
                  className={`py-1.5 px-1 text-[11px] xl:text-xs font-bold rounded-lg transition-all text-center leading-tight cursor-pointer ${tipoComprobante === 'FACTURA' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Factura
                </button>
                <button type="button" onClick={() => cambiarTipoComprobante('FIADO')} 
                  className={`py-1.5 px-1 text-[11px] xl:text-xs font-bold rounded-lg transition-all text-center leading-tight cursor-pointer ${tipoComprobante === 'FIADO' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-100/60'}`}>
                  Fiado
                </button>
              </div>
            </div>

            {/* 2. Selector de Medio de Pago */}
            {tipoComprobante !== 'FIADO' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Medio de Pago Recibido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('EFECTIVO')}
                    className={`py-2 px-1.5 rounded-xl text-[11px] xl:text-xs font-bold border transition-all flex flex-col 2xl:flex-row items-center justify-center gap-1 2xl:gap-1.5 cursor-pointer ${
                      metodoPago === 'EFECTIVO'
                        ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogoEfectivo />
                    <span className="whitespace-nowrap">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMetodoPago('YAPE_PLIN'); setMontoRecibido(''); }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] xl:text-xs font-bold border transition-all flex flex-col 2xl:flex-row items-center justify-center gap-1 2xl:gap-1.5 cursor-pointer ${
                      metodoPago === 'YAPE_PLIN'
                        ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosYapePlin />
                    <span className="whitespace-nowrap">Yape/Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMetodoPago('TRANSFERENCIA'); setMontoRecibido(''); }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] xl:text-xs font-bold border transition-all flex flex-col 2xl:flex-row items-center justify-center gap-1 2xl:gap-1.5 cursor-pointer ${
                      metodoPago === 'TRANSFERENCIA'
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosBancos />
                    <span className="whitespace-nowrap">Transf.</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Datos del Cliente */}
            {(tipoComprobante !== 'TICKET' || tipoComprobante === 'FIADO') && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                
                {tipoComprobante !== 'FIADO' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between gap-2">
                      <span>{tipoComprobante === 'FACTURA' ? 'Número de RUC *' : 'Número de DNI *'}</span>
                      <span className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded whitespace-nowrap">
                        Autocompletado SUNAT
                      </span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder={tipoComprobante === 'FACTURA' ? 'Ingrese 11 dígitos (Ej: 20...)' : 'Ingrese 8 dígitos'}
                      value={cliente.documento} 
                      onChange={e => {
                        const limit = tipoComprobante === 'FACTURA' ? 11 : 8;
                        const num = e.target.value.replace(/\D/g, '').slice(0, limit);
                        setCliente({ ...cliente, documento: num });
                        if (num.length === limit) {
                          buscarDocumento(num, tipoComprobante);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 outline-none text-sm font-mono font-semibold text-slate-900 transition-all" 
                    />
                  </div>
                )}
                
                {/* Campo de Nombre con Autocompletado si es FIADO */}
                <div ref={vecinosRef} className="relative">
                  <label className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between gap-2">
                    <span>
                      {tipoComprobante === 'FIADO' ? 'Nombre del Vecino / Cliente *' : (tipoComprobante === 'FACTURA' ? 'Razón Social *' : 'Nombre del Cliente *')}
                    </span>
                    {tipoComprobante === 'FIADO' && cliente.nombre.trim().length > 1 && (
                      vecinoCoincidente ? (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-800 bg-verde-pastel/45 px-2 py-0.5 rounded-md whitespace-nowrap">
                          <FaCheckCircle size={10} /> Vecino registrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                          <FaPlus size={9} /> Nuevo vecino
                        </span>
                      )
                    )}
                  </label>

                  <input 
                    type="text" 
                    required 
                    placeholder={isLoadingDoc ? 'Consultando padrón oficial...' : (tipoComprobante === 'FIADO' ? 'Escribe para buscar o registrar vecino...' : 'Nombre completo o Razón Social')}
                    value={cliente.nombre} 
                    onFocus={() => { if (tipoComprobante === 'FIADO') setShowVecinosDropdown(true); }}
                    onChange={e => {
                      const nuevoNombre = e.target.value;
                      const match = clientesFiado.find(v => v.nombre.toLowerCase() === nuevoNombre.trim().toLowerCase());
                      setCliente({
                        ...cliente,
                        id: match ? match.id : undefined,
                        nombre: nuevoNombre,
                        telefono: match ? (match.telefono || '') : cliente.telefono
                      });
                      if (tipoComprobante === 'FIADO') setShowVecinosDropdown(true);
                    }}
                    disabled={isLoadingDoc}
                    className={`w-full px-3 py-2 border rounded-xl outline-none text-sm font-medium transition-all ${isLoadingDoc ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50/70 focus:bg-white border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 text-slate-900'}`} 
                  />

                  {/* Lista desplegable de vecinos registrados */}
                  <AnimatePresence>
                    {tipoComprobante === 'FIADO' && showVecinosDropdown && vecinosFiltrados.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_12px_28px_rgba(15,23,42,0.12)] z-30 max-h-40 overflow-y-auto divide-y divide-slate-100"
                      >
                        {vecinosFiltrados.map(vecino => (
                          <button
                            type="button"
                            key={vecino.id}
                            onClick={() => {
                              setCliente({
                                ...cliente,
                                id: vecino.id,
                                nombre: vecino.nombre,
                                telefono: vecino.telefono || ''
                              });
                              setShowVecinosDropdown(false);
                            }}
                            className="w-full text-left px-3.5 py-2 hover:bg-verde-pastel/25 cursor-pointer flex justify-between items-center transition-colors gap-2"
                          >
                            <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2 min-w-0 truncate">
                              <FaUser size={11} className="text-slate-400 shrink-0" />
                              <span className="truncate">{vecino.nombre}</span>
                            </span>
                            <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded shrink-0">
                              {vecino.telefono || 'Sin número'}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {tipoComprobante === 'FIADO' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      <FaWhatsapp className="text-emerald-600 text-sm" /> Celular WhatsApp *
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="9 dígitos (Ej: 987654321)" 
                      value={cliente.telefono} 
                      onChange={e => {
                        const num = e.target.value.replace(/\D/g, '');
                        if (num.length > 0 && !num.startsWith('9')) return;
                        setCliente({ ...cliente, telefono: num.slice(0, 9) });
                      }}
                      className="w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 outline-none text-sm font-mono font-semibold text-slate-900 transition-all" 
                    />

                    {vecinoCoincidente && vecinoCoincidente.telefono && cliente.telefono && vecinoCoincidente.telefono !== cliente.telefono ? (
                      <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1.5 rounded-lg mt-1.5 flex items-center gap-1.5">
                        <FaCheckCircle className="text-amber-600 shrink-0" size={12} />
                        <span>Número modificado ({vecinoCoincidente.telefono} a {cliente.telefono}). Se actualizará al registrar el fiado.</span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        Si el vecino cambió de celular, edítalo aquí y se actualizará automáticamente.
                      </p>
                    )}
                  </div>
                )}

                {tipoComprobante !== 'FIADO' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Entrega de Comprobante
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                      <button type="button" onClick={() => setMetodoEnvio('NINGUNO')} 
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'NINGUNO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        Impresión
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('CORREO')} 
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'CORREO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        Correo
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('WHATSAPP')} 
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'WHATSAPP' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        WhatsApp
                      </button>
                    </div>

                    {metodoEnvio === 'CORREO' && (
                      <input type="email" required placeholder="cliente@correo.com" value={cliente.correo} onChange={e => setCliente({ ...cliente, correo: e.target.value })}
                        className="mt-2 w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-sm font-medium" />
                    )}
                    {metodoEnvio === 'WHATSAPP' && (
                      <input type="text" required placeholder="Celular WhatsApp (9 dígitos)" 
                        value={cliente.telefono} 
                        onChange={e => {
                          const num = e.target.value.replace(/\D/g, '');
                          if (num.length > 0 && !num.startsWith('9')) return;
                          setCliente({ ...cliente, telefono: num.slice(0, 9) });
                        }}
                        className="mt-2 w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-sm font-mono font-semibold" />
                    )}
                  </div>
                )}

              </div>
            )}

            {tipoComprobante === 'TICKET' && (
              <div className="p-3.5 bg-verde-pastel/20 border border-emerald-200/80 rounded-xl text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
                Emisión rápida de <strong>Venta Rápida</strong> con ticket interno para control inmediato de caja e inventario.
              </div>
            )}

            {/* Calculadora rápida de Vuelto (opcional, solo Efectivo) */}
            {tipoComprobante !== 'FIADO' && metodoPago === 'EFECTIVO' && carrito.length > 0 && (
              <div className="p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider shrink-0">
                    Paga con (S/):
                  </label>
                  <div className="relative w-28">
                    <input
                      type="number"
                      step="0.10"
                      min="0"
                      value={montoRecibido}
                      onChange={e => setMontoRecibido(e.target.value)}
                      placeholder={totalPagado.toFixed(2)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:border-emerald-500 outline-none text-right font-mono font-bold text-sm text-slate-900"
                    />
                  </div>
                </div>
                {tieneMontoRecibido && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-200/70 text-xs">
                    <span className="font-bold text-slate-600">
                      {vueltoCalculado >= 0 ? 'Vuelto a entregar:' : 'Falta completar:'}
                    </span>
                    <span className={`font-mono font-extrabold text-sm ${
                      vueltoCalculado >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      S/ {Math.abs(vueltoCalculado).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Pie Compacto de Totales y Botón de Cobro */}
          <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/70 shrink-0">
            {tipoComprobante !== 'TICKET' && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/80 text-xs text-slate-600 font-medium">
                <span>Gravada: <strong className="font-mono text-slate-800">S/ {subtotalBase.toFixed(2)}</strong></span>
                <span>IGV ({igvPorcentaje}%): <strong className="font-mono text-slate-800">S/ {montoIgv.toFixed(2)}</strong></span>
              </div>
            )}
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Importe Total:</span>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">S/ {totalPagado.toFixed(2)}</span>
            </div>

            <button 
              type="button"
              onClick={() => tipoComprobante === 'FIADO' ? handleProcesarVenta(true) : handleProcesarVenta(false)}
              disabled={carrito.length === 0 || isProcessing} 
              className={`w-full font-extrabold py-3 px-4 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm cursor-pointer ${
                tipoComprobante === 'FIADO' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'
              }`}
            >
              {isProcessing ? (
                <span>Procesando operación...</span>
              ) : tipoComprobante === 'FIADO' ? (
                <><FaUser size={14} /> Registrar Fiado (S/ {totalPagado.toFixed(2)})</>
              ) : (
                <><FaShoppingCart size={14} /> Procesar Venta (S/ {totalPagado.toFixed(2)})</>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DEL ESCÁNER CÁMARA */}
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 bg-slate-950/75 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 bg-white border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaCamera size={15} />
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Lector de Código de Barras
                  </h3>
                </div>
                <button type="button" onClick={() => setIsScannerOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <FaTimes size={18} />
                </button>
              </div>
              <div className="p-5 bg-slate-50 flex flex-col items-center">
                <div id="reader-ventas" className="w-full bg-black rounded-xl overflow-hidden border border-slate-300"></div>
                <p className="text-sm text-slate-600 font-medium mt-3 text-center">Enfoque el código de barras del producto frente a la cámara.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE VENTA EXITOSA CON VISTA PREVIA DEL COMPROBANTE */}
      <AnimatePresence>
        {ventaGenerada && (
          <div className="fixed inset-0 bg-slate-950/75 z-[80] flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className={`bg-white rounded-2xl w-full ${
                ventaGenerada.tipo === 'BOLETA' || ventaGenerada.tipo === 'FACTURA' ? 'max-w-lg' : 'max-w-sm'
              } overflow-hidden shadow-2xl border border-slate-200 flex flex-col my-auto max-h-[92vh]`}
            >
              {/* Cabecera del Modal */}
              <div className="bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-verde-pastel/40 text-emerald-700 flex items-center justify-center shrink-0">
                    <FaCheckCircle className="text-xl" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Operación Registrada</h2>
                    <p className="text-xs sm:text-sm text-slate-600 font-medium truncate">
                      {ventaGenerada.tipo === 'TICKET'
                        ? 'Venta Rápida emitida con éxito.'
                        : ventaGenerada.tipo === 'FIADO'
                        ? 'Crédito registrado correctamente.'
                        : `${ventaGenerada.tipo} Electrónica (${ventaGenerada.numeroComprobante})`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVentaGenerada(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer shrink-0"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              {/* Cuerpo: Vista Previa de Boleta/Factura o Resumen Simple */}
              {ventaGenerada.tipo === 'BOLETA' || ventaGenerada.tipo === 'FACTURA' ? (
                <div className="p-5 bg-slate-100 overflow-y-auto flex justify-center flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <ComprobanteDetallado venta={ventaGenerada} negocio={businessConfig} />
                </div>
              ) : (
                <div className="p-6 bg-slate-50/80 space-y-3 text-sm">
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                    <span className="text-slate-600 font-semibold">N° Operación:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      {ventaGenerada.numeroComprobante || `#000${ventaGenerada.id}`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                    <span className="text-slate-600 font-semibold">Cliente:</span>
                    <span className="text-slate-900 font-bold truncate max-w-[180px]">{ventaGenerada.cliente}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                    <span className="text-slate-600 font-semibold">Medio de Pago:</span>
                    <span className="text-slate-900 font-bold">
                      {ventaGenerada.metodoPago === 'YAPE_PLIN' ? 'Yape / Plin' : ventaGenerada.metodoPago}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-slate-800 font-extrabold uppercase">Total Cobrado:</span>
                    <span className="text-emerald-700 font-extrabold text-2xl font-mono">S/ {ventaGenerada.total.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Botones de Acción */}
              <div className="p-5 bg-white border-t border-slate-100 flex flex-col gap-2.5 shrink-0">
                <button 
                  type="button"
                  onClick={() => {
                    const width = 420;
                    const height = 720;
                    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
                    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
                    window.open(
                      `/ticket/${ventaGenerada.id}?imprimir=1`,
                      'Comprobante',
                      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
                    );
                  }}
                  className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm cursor-pointer shadow-2xs"
                >
                  <FaPrint size={15} /> Imprimir {ventaGenerada.tipo === 'TICKET' || ventaGenerada.tipo === 'FIADO' ? 'Ticket' : `${ventaGenerada.tipo} (Formato Limpio)`}
                </button>

                {ventaGenerada.metodoEnvio === 'WHATSAPP' && ventaGenerada.tipo !== 'TICKET' && (
                  <button 
                    type="button"
                    onClick={() => {
                      let saludo = `Hola *${ventaGenerada.cliente}*`;
                      if (ventaGenerada.tipo === 'FACTURA' && String(ventaGenerada.documentoCliente || '').startsWith('20')) {
                        saludo = `Hola equipo de *${ventaGenerada.cliente}*`;
                      }

                      const urlComprobantePropio = `${window.location.origin}/ticket/${ventaGenerada.id}`;
                      const listaItems = (ventaGenerada.detalles || [])
                        .map(d => `- ${d.cantidad}x ${d.producto?.nombre}: S/ ${Number(d.subtotal).toFixed(2)}`)
                        .join('\n');

                      const textoMensaje =
                        `${saludo}, gracias por su compra en *${ventaGenerada.nombreNegocio}*.\n\n` +
                        `*${ventaGenerada.tipo} ELECTRÓNICA: ${ventaGenerada.numeroComprobante}*\n` +
                        `${listaItems}\n` +
                        `*TOTAL PAGADO: S/ ${ventaGenerada.total.toFixed(2)}*\n\n` +
                        `Visualiza e imprime tu comprobante aquí:\n${urlComprobantePropio}`;

                      const numeroLimpio = ventaGenerada.contactoEnvio.replace(/[^0-9]/g, '');
                      const numeroFinal = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;

                      window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(textoMensaje)}`, '_blank');
                    }}
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm cursor-pointer"
                  >
                    <FaWhatsapp size={17} /> Enviar {ventaGenerada.tipo} por WhatsApp
                  </button>
                )}

                {ventaGenerada.metodoEnvio === 'CORREO' && ventaGenerada.tipo !== 'TICKET' && (
                  <div className="w-full bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold py-2 px-3 rounded-xl flex justify-center items-center gap-2 text-xs">
                    <FaEnvelope size={13} className="text-emerald-700 shrink-0" />
                    <span>Comprobante enviado al correo: <strong>{ventaGenerada.contactoEnvio}</strong></span>
                  </div>
                )}

                {ventaGenerada.enlacePdf && (
                  <a
                    href={ventaGenerada.enlacePdf}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-xs sm:text-sm"
                  >
                    <FaExternalLinkAlt size={12} /> Ver Comprobante Nubefact (SUNAT)
                  </a>
                )}

                <button 
                  type="button"
                  onClick={() => setVentaGenerada(null)}
                  className="w-full font-bold py-2.5 px-4 rounded-xl transition-colors text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  Nueva Operación
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}