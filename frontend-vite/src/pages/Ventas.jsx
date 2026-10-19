import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaShoppingCart, FaTrash, FaPlus, FaMinus, FaCamera, FaUser, FaFileInvoice, FaTimes, FaEnvelope, FaWhatsapp, FaPrint, FaCheckCircle, FaBarcode } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';
import { io } from 'socket.io-client';
import { useBusiness } from '../context/BusinessContext';

const socket = io(`https://proyecto-gestion-de-ventas-inteligente.onrender.com`);

const LogoEfectivo = () => (
  <div className="flex items-center justify-center w-8 h-6 rounded bg-emerald-700 text-white font-bold text-xs shadow-2xs shrink-0 border border-emerald-800">
    S/
  </div>
);

const LogosYapePlin = () => (
  <div className="flex items-center -space-x-1.5 shrink-0">
    {/* Logo Yape */}
    <div className="w-6 h-6 rounded-md bg-[#742384] text-white flex items-center justify-center font-black text-[11px] shadow-2xs border border-white z-10">
      y
    </div>
    {/* Logo Plin */}
    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#00A8E8] to-[#00E5FF] text-white flex items-center justify-center font-extrabold text-[9px] shadow-2xs border border-white">
      plin
    </div>
  </div>
);

const LogosBancos = () => (
  <div className="flex items-center gap-0.5 shrink-0">
    <span className="px-1.5 py-0.5 rounded bg-[#002A8D] text-white font-black text-[9px] tracking-tighter">BCP</span>
    <span className="px-1.5 py-0.5 rounded bg-[#009B3A] text-white font-black text-[9px] tracking-tighter">IBK</span>
  </div>
);

export default function Ventas() {
  const { businessConfig } = useBusiness();
  const [productos, setProductos] = useState([]);
  
  // Estados de Búsqueda y Carrito
  const [busqueda, setBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [carrito, setCarrito] = useState(() => JSON.parse(localStorage.getItem('pos_carrito')) || []);
  const [tipoComprobante, setTipoComprobante] = useState(() => localStorage.getItem('pos_tipo_comprobante') || 'TICKET');
  const [metodoPago, setMetodoPago] = useState('EFECTIVO');
  
  // Estados del Cliente y Envío
  const [cliente, setCliente] = useState(() => JSON.parse(localStorage.getItem('pos_cliente')) || { documento: '', nombre: '', correo: '', telefono: '' });
  const [metodoEnvio, setMetodoEnvio] = useState('NINGUNO');

  // Estados de UI
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ventaGenerada, setVentaGenerada] = useState(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');

  // Guardado automático en caché
  useEffect(() => localStorage.setItem('pos_carrito', JSON.stringify(carrito)), [carrito]);
  useEffect(() => localStorage.setItem('pos_tipo_comprobante', tipoComprobante), [tipoComprobante]);
  useEffect(() => localStorage.setItem('pos_cliente', JSON.stringify(cliente)), [cliente]);

  // Cálculos de Facturación
  const totalPagado = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
  const igvPorcentaje = businessConfig.impuestoPorcentaje || 18;
  const factorIgv = 1 + (igvPorcentaje / 100); 
  const subtotalBase = tipoComprobante !== 'TICKET' ? (totalPagado / factorIgv) : totalPagado;
  const montoIgv = tipoComprobante !== 'TICKET' ? (totalPagado - subtotalBase) : 0;

  // Cargar Catálogo y limpiar productos del carrito que no pertenezcan a esta bodega
  const cargarCatalogo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/productos', { headers: { Authorization: `Bearer ${token}` } });
      const disponibles = res.data.filter(p => p.estado === true && p.stock > 0);
      setProductos(disponibles);

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
      console.error("Error al cargar productos", error);
      toast.error("No se pudo cargar el inventario.");
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
          toast.error("Límite de stock alcanzado para este producto.");
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
      let nuevoCarrito = prev.map(item => {
        if (item.id === id) {
          const nuevaCantidad = item.cantidad + delta;
          if (nuevaCantidad > item.stock) {
            toast.error("Stock insuficiente en inventario.");
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

  // --- LÓGICA DEL ESCÁNER DE CÓDIGO DE BARRAS ---
  useEffect(() => {
    let html5QrCode;
    if (isScannerOpen) {
      setTimeout(() => {
        html5QrCode = new Html5Qrcode("reader-ventas");
        html5QrCode.start(
          { facingMode: "environment" }, 
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
              toast.success(`${productoEncontrado.nombre} agregado al carrito.`);
            } else {
              toast.error(`El código ${decodedText} no existe en inventario o no tiene stock.`);
            }
          },
          () => { /* Ignoramos advertencias de enfoque */ }
        ).catch(err => {
          console.error("Error al iniciar cámara:", err);
          toast.error("Error al acceder a la cámara. Verifica los permisos.");
          setIsScannerOpen(false);
        });
      }, 200);
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScannerOpen, productos]);

  // --- CONSULTA A RENIEC / SUNAT ---
  const buscarDocumento = async (numeroBuscar, tipoDoc) => {
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
      toast.success('Datos encontrados', { icon: '🔍' });

    } catch (error) {
      console.error(error);
      setCliente(prev => ({ ...prev, nombre: '' }));
      toast.error('Documento no encontrado en la base de datos.');
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // --- PROCESAMIENTO DE VENTA ---
  const handleProcesarVenta = async (esFiado = false) => {
    if (carrito.length === 0) return toast.error('El carrito está vacío.');

    if (esFiado) {
      if (!cliente.nombre.trim()) return toast.error('Ingrese el nombre del vecino para fiarle.');
      if (!cliente.telefono || cliente.telefono.length !== 9 || !cliente.telefono.startsWith('9')) {
        return toast.error('El número de WhatsApp debe tener 9 dígitos y empezar con 9.');
      }
    }

    if (tipoComprobante === 'FACTURA') {
      if (!cliente.documento || cliente.documento.length !== 11) return toast.error('Ingrese un RUC válido de 11 dígitos.');
      if (!cliente.nombre.trim()) return toast.error('Ingrese la Razón Social.');
    } else if (tipoComprobante === 'BOLETA') {
      if (!cliente.documento || cliente.documento.length !== 8) return toast.error('Ingrese un DNI válido de 8 dígitos.');
      if (!cliente.nombre.trim()) return toast.error('Ingrese el Nombre del cliente.');
    }

    if (tipoComprobante !== 'TICKET' && !esFiado) {
      if (metodoEnvio === 'CORREO' && !cliente.correo.trim()) return toast.error('Ingrese el correo electrónico para enviar el comprobante.');
      if (metodoEnvio === 'WHATSAPP' && (!cliente.telefono || cliente.telefono.length !== 9 || !cliente.telefono.startsWith('9'))) {
        return toast.error('El número de WhatsApp debe tener 9 dígitos y empezar con 9.');
      }
    }

    const metodoPagoFinal = esFiado ? 'FIADO' : metodoPago;

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
        cliente,
        metodoEnvio,
        esFiado
      };

      const res = await axios.post('/ventas', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('¡Venta registrada con éxito!', { icon: '✅' });
      
      setVentaGenerada({
        id: res.data.venta.id,
        tipo: tipoComprobante,
        metodoPago: metodoPagoFinal,
        total: totalPagado,
        cliente: tipoComprobante === 'TICKET' ? 'Cliente Varios' : (cliente.nombre || 'Cliente Varios'),
        documentoCliente: cliente.documento,
        metodoEnvio: tipoComprobante === 'TICKET' ? 'NINGUNO' : metodoEnvio,
        contactoEnvio: tipoComprobante === 'TICKET' ? '' : (metodoEnvio === 'CORREO' ? cliente.correo : cliente.telefono),
        enlacePdf: res.data.enlacePdf,
        nombreNegocio: res.data.nombreNegocio
      });

      // Limpiamos la caja
      setCarrito([]);
      setCliente({ documento: '', nombre: '', correo: '', telefono: '' });
      setMetodoEnvio('NINGUNO');
      setTipoComprobante('TICKET');
      setMetodoPago('EFECTIVO');
      socket.emit('sincronizar_carrito', { usuarioId: usuario.id, carrito: [] });
      cargarCatalogo();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Ocurrió un error al procesar la venta.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtro Dinámico del Buscador
  const productosBuscados = busqueda.trim() === '' ? productos : productos.filter(prod => 
    prod.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    prod.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 text-slate-800 pb-16 lg:pb-0 font-sans">
      
      {/* CABECERA ESTILO ADMINLTE / ERP (Miga de pan y estado de terminal) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            Punto de Venta (POS)
          </h1>
          <p className="text-xs text-slate-500">
            Módulo de facturación y despacho rápido • Cajero: <span className="font-semibold text-slate-700">{usuario.nombre || 'Activo'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>SUNAT / OSE En Línea</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-semibold text-slate-700">{new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL DIVIDIDO */}
      <div className="flex flex-col lg:flex-row gap-5 lg:h-[calc(100vh-9.5rem)]">
        
        {/* PANEL IZQUIERDO: CATÁLOGO Y TABLA DE DETALLE DE VENTA */}
        <div className="flex-1 flex flex-col bg-white border border-slate-300 border-t-4 border-t-verde-pastel rounded-md shadow-xs overflow-hidden min-h-[460px] lg:min-h-0">
          
          {/* Barra de búsqueda sobria y limpia */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="flex gap-2.5">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FaSearch className="text-slate-400 text-sm" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar producto por descripción o lector de código de barras..." 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-md focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm text-slate-800 transition-all" 
                />

                <AnimatePresence>
                  {showDropdown && busqueda && (
                    <motion.div initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 3 }} 
                      className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-md shadow-lg z-40 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {productosBuscados.length === 0 ? (
                        <div className="p-3.5 text-slate-500 text-xs text-center">No se encontraron productos disponibles con ese criterio.</div>
                      ) : (
                        productosBuscados.map(prod => (
                          <div key={prod.id} onMouseDown={() => { agregarAlCarrito(prod); setBusqueda(''); setShowDropdown(false); }} 
                            className="px-3.5 py-2.5 hover:bg-emerald-50/60 cursor-pointer flex justify-between items-center transition-colors">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{prod.nombre}</p>
                              <p className="text-[11px] text-slate-500 font-mono">Cód: {prod.codigo}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-700 font-bold text-sm">S/ {prod.precioVenta.toFixed(2)}</p>
                              <p className="text-[11px] text-slate-500">Disp: {prod.stock} un.</p>
                            </div>
                          </div>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <FaCamera className="text-verde-pastel text-sm" /> <span className="hidden sm:inline">Lector Cámara</span>
              </button>
            </div>
          </div>
          
          {/* Tabla de ítems estilo sistema comercial (AdminLTE / Bsale) */}
          <div className="flex-1 overflow-y-auto bg-white">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <FaBarcode className="text-5xl mb-3 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">Detalle de venta vacío</p>
                <p className="text-xs text-slate-400 mt-0.5">Utilice el buscador superior o el lector de código de barras para agregar ítems.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                  <tr className="text-[11px] font-bold text-slate-600 uppercase">
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Producto / Descripción</th>
                    <th className="py-2.5 px-3 text-right">P. Unit</th>
                    <th className="py-2.5 px-3 text-center">Cantidad</th>
                    <th className="py-2.5 px-4 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {carrito.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {item.codigo}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 text-sm">{item.nombre}</p>
                        <p className="text-[11px] text-slate-500">
                          Stock disp: <span className={item.stock <= 5 ? "text-red-600 font-semibold" : "text-emerald-700 font-semibold"}>{item.stock}</span>
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        S/ {item.precioVenta.toFixed(2)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center">
                          <div className="inline-flex items-center border border-slate-300 rounded-md bg-white">
                            <button 
                              type="button"
                              onClick={() => actualizarCantidad(item.id, -1)} 
                              className={`p-1.5 transition-colors ${item.cantidad === 1 ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                              {item.cantidad === 1 ? <FaTrash size={11} /> : <FaMinus size={11} />}
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-800 border-x border-slate-200 py-1">
                              {item.cantidad}
                            </span>
                            <button 
                              type="button"
                              onClick={() => actualizarCantidad(item.id, 1)} 
                              className="p-1.5 text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                              <FaPlus size={11} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        S/ {(item.precioVenta * item.cantidad).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla con conteo de ítems */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs text-slate-600 shrink-0">
            <span>Ítems en lista: <strong>{carrito.length}</strong></span>
            <span>Unidades totales: <strong>{carrito.reduce((acc, i) => acc + i.cantidad, 0)}</strong></span>
          </div>
        </div>

        {/* PANEL DERECHO: COMPROBANTE, PAGO Y LIQUIDACIÓN */}
        <div className="w-full lg:w-[380px] bg-white border border-slate-300 border-t-4 border-t-emerald-600 rounded-md shadow-xs flex flex-col h-fit">
          
          {/* Cabecera limpia estilo AdminLTE */}
          <div className="px-5 py-3.5 bg-white border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-slate-800 font-bold text-sm flex items-center gap-2">
              <FaFileInvoice className="text-emerald-600" /> Datos del Comprobante
            </h2>
            <span className="text-[11px] font-semibold text-emerald-800 bg-verde-pastel/50 px-2 py-0.5 rounded border border-emerald-200">
              IGV {igvPorcentaje}%
            </span>
          </div>

          <div className="p-5 space-y-4 bg-white">
            
            {/* 1. Selector de Tipo de Comprobante */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tipo de Operación</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200">
                <button type="button" onClick={() => setTipoComprobante('TICKET')} 
                  className={`py-1.5 text-xs font-semibold rounded transition-all ${tipoComprobante === 'TICKET' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
                  Venta Rápida
                </button>
                <button type="button" onClick={() => setTipoComprobante('BOLETA')} 
                  className={`py-1.5 text-xs font-semibold rounded transition-all ${tipoComprobante === 'BOLETA' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
                  Boleta
                </button>
                <button type="button" onClick={() => setTipoComprobante('FACTURA')} 
                  className={`py-1.5 text-xs font-semibold rounded transition-all ${tipoComprobante === 'FACTURA' ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80' : 'text-slate-600 hover:text-slate-900'}`}>
                  Factura
                </button>
                <button type="button" onClick={() => setTipoComprobante('FIADO')} 
                  className={`py-1.5 text-xs font-semibold rounded transition-all ${tipoComprobante === 'FIADO' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-50'}`}>
                  Crédito/Fiar
                </button>
              </div>
            </div>

            {/* 2. Selector de Método de Pago con Logos Reales (Yape / Plin / Bancos) */}
            {tipoComprobante !== 'FIADO' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Medio de Pago Recibido</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('EFECTIVO')}
                    className={`p-2 rounded-md text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      metodoPago === 'EFECTIVO'
                        ? 'bg-emerald-50/70 border-emerald-600 text-emerald-950 ring-1 ring-emerald-600'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <LogoEfectivo />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago('YAPE_PLIN')}
                    className={`p-2 rounded-md text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      metodoPago === 'YAPE_PLIN'
                        ? 'bg-purple-50/70 border-[#742384] text-purple-950 ring-1 ring-[#742384]'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <LogosYapePlin />
                    <span>Yape / Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago('TRANSFERENCIA')}
                    className={`p-2 rounded-md text-xs font-semibold border transition-all flex flex-col items-center justify-center gap-1.5 ${
                      metodoPago === 'TRANSFERENCIA'
                        ? 'bg-blue-50/70 border-blue-600 text-blue-950 ring-1 ring-blue-600'
                        : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <LogosBancos />
                    <span>Transferencia</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Datos del Cliente / Adquiriente */}
            {(tipoComprobante !== 'TICKET' || tipoComprobante === 'FIADO') && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                
                {tipoComprobante !== 'FIADO' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{tipoComprobante === 'FACTURA' ? 'Número de RUC *' : 'Número de DNI *'}</span>
                      <span className="text-[10px] text-emerald-700 font-normal">Consulta RENIEC/SUNAT</span>
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder={tipoComprobante === 'FACTURA' ? '11 dígitos (Ej: 20...)' : '8 dígitos'}
                      value={cliente.documento} 
                      onChange={e => {
                        const limit = tipoComprobante === 'FACTURA' ? 11 : 8;
                        const num = e.target.value.replace(/\D/g, '').slice(0, limit);
                        setCliente({...cliente, documento: num});
                        if (num.length === limit) {
                          buscarDocumento(num, tipoComprobante);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm font-mono" 
                    />
                  </div>
                )}
                
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    {tipoComprobante === 'FIADO' ? 'Nombre del Cliente (Vecino) *' : (tipoComprobante === 'FACTURA' ? 'Razón Social *' : 'Nombre del Cliente *')}
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isLoadingDoc ? 'Consultando padrón oficial...' : (tipoComprobante === 'FIADO' ? 'Nombre completo o referencia' : 'Nombre o Razón Social')}
                    value={cliente.nombre} 
                    onChange={e => setCliente({...cliente, nombre: e.target.value})}
                    disabled={isLoadingDoc}
                    className={`w-full px-3 py-2 border rounded-md outline-none text-sm transition-colors ${isLoadingDoc ? 'bg-slate-100 border-slate-200 text-slate-400' : 'bg-white border-slate-300 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-slate-900'}`} 
                  />
                </div>

                {tipoComprobante === 'FIADO' && (
                  <div>
                    <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                      <FaWhatsapp className="text-emerald-600" /> Teléfono Celular (WhatsApp) *
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="9 dígitos (Ej: 987654321)" 
                      value={cliente.telefono} 
                      onChange={e => {
                        let num = e.target.value.replace(/\D/g, '');
                        if (num.length > 0 && !num.startsWith('9')) return; 
                        setCliente({...cliente, telefono: num.slice(0, 9)});
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none text-sm font-mono" 
                    />
                  </div>
                )}

                {tipoComprobante !== 'FIADO' && (
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                      Entrega de Comprobante
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-md border border-slate-200 mb-2">
                      <button type="button" onClick={() => setMetodoEnvio('NINGUNO')} 
                        className={`py-1 text-xs font-semibold rounded transition-all ${metodoEnvio === 'NINGUNO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}>
                        Impresión
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('CORREO')} 
                        className={`py-1 text-xs font-semibold rounded transition-all ${metodoEnvio === 'CORREO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}>
                        Correo
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('WHATSAPP')} 
                        className={`py-1 text-xs font-semibold rounded transition-all ${metodoEnvio === 'WHATSAPP' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}>
                        WhatsApp
                      </button>
                    </div>

                    {metodoEnvio === 'CORREO' && (
                      <input type="email" required placeholder="cliente@correo.com" value={cliente.correo} onChange={e => setCliente({...cliente, correo: e.target.value})}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:border-emerald-600 outline-none text-sm" />
                    )}
                    {metodoEnvio === 'WHATSAPP' && (
                      <input type="text" required placeholder="Celular WhatsApp (9 dígitos)" 
                        value={cliente.telefono} 
                        onChange={e => {
                          let num = e.target.value.replace(/\D/g, '');
                          if (num.length > 0 && !num.startsWith('9')) return;
                          setCliente({...cliente, telefono: num.slice(0, 9)});
                        }}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md focus:border-emerald-600 outline-none text-sm font-mono" />
                    )}
                  </div>
                )}

              </div>
            )}

            {tipoComprobante === 'TICKET' && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600">
                Emisión rápida de <strong>Venta Rápida</strong> para control de caja e inventario (no declarable a SUNAT).
              </div>
            )}
          </div>

          {/* 4. Resumen de Importes y Botón de Cobro */}
          <div className="p-5 border-t border-slate-200 bg-slate-50 rounded-b-md mt-auto">
            {tipoComprobante !== 'TICKET' && (
              <div className="space-y-1 mb-3 pb-3 border-b border-slate-200 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Op. Gravada (Subtotal):</span>
                  <span className="font-mono font-semibold">S/ {subtotalBase.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>I.G.V. ({igvPorcentaje}%):</span>
                  <span className="font-mono font-semibold">S/ {montoIgv.toFixed(2)}</span>
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-baseline mb-4">
              <span className="text-xs font-bold text-slate-700 uppercase">Importe Total:</span>
              <span className="text-2xl font-black text-slate-900 font-mono">S/ {totalPagado.toFixed(2)}</span>
            </div>

            <button 
              type="button"
              onClick={() => tipoComprobante === 'FIADO' ? handleProcesarVenta(true) : handleProcesarVenta(false)}
              disabled={carrito.length === 0 || isProcessing} 
              className={`w-full font-bold py-3 px-4 rounded-md transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm ${
                tipoComprobante === 'FIADO' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 border border-emerald-300'
              }`}
            >
              {isProcessing ? (
                <span>Procesando operación...</span>
              ) : tipoComprobante === 'FIADO' ? (
                <><FaUser size={14} /> Registrar Cuenta por Cobrar (Fiado)</>
              ) : (
                <><FaShoppingCart size={14} /> Emitir Comprobante (S/ {totalPagado.toFixed(2)})</>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* MODAL DEL ESCÁNER CÁMARA */}
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 bg-slate-950/80 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-white rounded-md border border-slate-300 shadow-xl overflow-hidden"
            >
              <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FaCamera className="text-verde-pastel" /> Lector de Código de Barras
                </h3>
                <button onClick={() => setIsScannerOpen(false)} className="text-slate-400 hover:text-white">
                  <FaTimes />
                </button>
              </div>
              <div className="p-4 bg-slate-50 flex flex-col items-center">
                <div id="reader-ventas" className="w-full bg-black rounded overflow-hidden border border-slate-300"></div>
                <p className="text-xs text-slate-500 mt-3 text-center">Enfoque el código de barras del empaque frente a la cámara.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL DE VENTA EXITOSA (ESTILO COMPROBANTE EMPRESARIAL) --- */}
      <AnimatePresence>
        {ventaGenerada && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white rounded-md w-full max-w-sm overflow-hidden shadow-xl border border-slate-300 flex flex-col"
            >
              <div className="bg-white p-5 border-b border-slate-200 border-t-4 border-t-emerald-600 flex items-center gap-3">
                <FaCheckCircle className="text-emerald-600 text-2xl shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Operación Registrada</h2>
                  <p className="text-xs text-slate-500">
                    {ventaGenerada.tipo === 'TICKET' ? 'Nota de Venta Interna' : `${ventaGenerada.tipo} Electrónica`} emitida correctamente.
                  </p>
                </div>
              </div>

              <div className="p-5 bg-slate-50 space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">N° Operación:</span>
                  <span className="text-slate-900 font-mono font-bold">#000{ventaGenerada.id}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Cliente:</span>
                  <span className="text-slate-800 font-semibold truncate max-w-[180px]">{ventaGenerada.cliente}</span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-200">
                  <span className="text-slate-500 font-semibold">Medio de Pago:</span>
                  <span className="text-slate-800 font-bold">
                    {ventaGenerada.metodoPago === 'YAPE_PLIN' ? 'Yape / Plin' : ventaGenerada.metodoPago}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-700 font-bold uppercase">Total Cobrado:</span>
                  <span className="text-emerald-700 font-black text-xl font-mono">S/ {ventaGenerada.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-2">
                {ventaGenerada.metodoEnvio === 'WHATSAPP' && ventaGenerada.tipo !== 'TICKET' && (
                  <button 
                    onClick={() => {
                      let saludo = `Hola *${ventaGenerada.cliente}*`;
                      if (ventaGenerada.tipo === 'FACTURA' && ventaGenerada.documentoCliente) {
                        if (String(ventaGenerada.documentoCliente).startsWith('20')) {
                          saludo = `Hola equipo de *${ventaGenerada.cliente}*`;
                        }
                      }

                      const textoMensaje = `${saludo},\nGracias por su compra en *${ventaGenerada.nombreNegocio}*.\n\nAquí tiene el enlace directo para descargar su comprobante electrónico:\n${ventaGenerada.enlacePdf}\n\n¡Gracias por su preferencia!`;
                      const numeroLimpio = ventaGenerada.contactoEnvio.replace(/[^0-9]/g, '');
                      const numeroFinal = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;

                      window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(textoMensaje)}`, '_blank');
                    }}
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-2.5 px-4 rounded-md transition-colors flex justify-center items-center gap-2 text-xs"
                  >
                    <FaWhatsapp size={16} /> Enviar Comprobante por WhatsApp
                  </button>
                )}

                {ventaGenerada.metodoEnvio === 'CORREO' && ventaGenerada.tipo !== 'TICKET' && (
                  <button 
                    onClick={() => window.open(ventaGenerada.enlacePdf, '_blank')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-md transition-colors flex justify-center items-center gap-2 text-xs"
                  >
                    <FaEnvelope size={14} /> Abrir PDF / Correo Enviado
                  </button>
                )}

                {ventaGenerada.metodoEnvio === 'NINGUNO' && (
                  <button 
                    onClick={() => {
                      if (ventaGenerada.enlacePdf) {
                        window.open(ventaGenerada.enlacePdf, '_blank');
                      } else {
                        window.open(`/ticket/${ventaGenerada.id}`, '_blank', 'width=400,height=600');
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-4 rounded-md transition-colors flex justify-center items-center gap-2 text-xs"
                  >
                    <FaPrint size={14} /> Imprimir {ventaGenerada.tipo === 'TICKET' ? 'Ticket' : ventaGenerada.tipo}
                  </button>
                )}
                
                <button 
                  onClick={() => setVentaGenerada(null)}
                  className="w-full font-semibold py-2.5 px-4 rounded-md transition-colors text-xs bg-slate-100 hover:bg-slate-200 text-slate-700"
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