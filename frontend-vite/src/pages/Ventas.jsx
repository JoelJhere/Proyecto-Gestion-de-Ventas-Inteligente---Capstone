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
    <div className="flex flex-col gap-6 text-slate-800 pb-16 lg:pb-2 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL (Inspirada en la jerarquía de Figma) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Punto de Venta (POS)
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Módulo de facturación y despacho rápido • Cajero: <span className="font-bold text-slate-900">{usuario.nombre || 'Activo'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 text-sm text-slate-700 bg-white px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.05)] self-start sm:self-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15"></span>
          <span className="font-semibold text-slate-700">SUNAT / OSE En Línea</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-bold text-slate-900">{new Date().toLocaleDateString('es-PE')}</span>
        </div>
      </div>

      {/* CONTENEDOR SIMÉTRICO DE 2 PANELES CON SOMBRA ESTILO FIGMA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-9.5rem)] items-stretch">
        
        {/* PANEL IZQUIERDO (7 COLUMNAS): CATÁLOGO Y TABLA DE VENTA */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden min-h-[480px] lg:min-h-0">
          
          {/* Barra superior de búsqueda */}
          <div className="p-5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaSearch className="text-slate-400 text-base" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar producto por nombre o escanear código de barras..." 
                  value={busqueda} 
                  onChange={(e) => { setBusqueda(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-4 focus:ring-verde-pastel/30 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400 transition-all" 
                />

                <AnimatePresence>
                  {showDropdown && busqueda && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} 
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] z-40 max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {productosBuscados.length === 0 ? (
                        <div className="p-4 text-slate-600 text-sm font-medium text-center">No se encontraron productos disponibles con ese criterio.</div>
                      ) : (
                        productosBuscados.map(prod => (
                          <div key={prod.id} onMouseDown={() => { agregarAlCarrito(prod); setBusqueda(''); setShowDropdown(false); }} 
                            className="px-4 py-3 hover:bg-verde-pastel/20 cursor-pointer flex justify-between items-center transition-colors">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{prod.nombre}</p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">Código: {prod.codigo}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-emerald-700 font-extrabold text-sm">S/ {prod.precioVenta.toFixed(2)}</p>
                              <span className="inline-block text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                                Stock: {prod.stock} un.
                              </span>
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
                className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold px-5 py-3 rounded-xl text-sm transition-all shadow-2xs flex items-center justify-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FaCamera className="text-emerald-900 text-base" />
                <span>Lector Cámara</span>
              </button>
            </div>
          </div>
          
          {/* Cuerpo de la tabla de productos */}
          <div className="flex-1 overflow-y-auto bg-white">
            {carrito.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-verde-pastel/30 text-emerald-700 flex items-center justify-center mb-4 shadow-2xs">
                  <FaBarcode className="text-3xl" />
                </div>
                <p className="text-base font-bold text-slate-800">Detalle de venta vacío</p>
                <p className="text-sm text-slate-500 font-medium mt-1 max-w-md">
                  Utilice el buscador superior o el botón de cámara para agregar productos a la operación actual.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10">
                  <tr className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Código</th>
                    <th className="py-3.5 px-4">Producto / Descripción</th>
                    <th className="py-3.5 px-4 text-right">Precio Unit.</th>
                    <th className="py-3.5 px-4 text-center">Cantidad</th>
                    <th className="py-3.5 px-5 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {carrito.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {item.codigo}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 text-sm">{item.nombre}</p>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Disponible: <span className={item.stock <= 5 ? "text-red-600 font-bold" : "text-emerald-700 font-bold"}>{item.stock} un.</span>
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                        S/ {item.precioVenta.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center">
                          <div className="inline-flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1 shadow-2xs">
                            <button 
                              type="button"
                              onClick={() => actualizarCantidad(item.id, -1)} 
                              className={`p-2 rounded-lg transition-colors ${item.cantidad === 1 ? 'text-red-600 hover:bg-red-100/80' : 'text-slate-700 hover:bg-white'}`}
                            >
                              {item.cantidad === 1 ? <FaTrash size={12} /> : <FaMinus size={12} />}
                            </button>
                            <span className="w-9 text-center text-sm font-extrabold text-slate-900">
                              {item.cantidad}
                            </span>
                            <button 
                              type="button"
                              onClick={() => actualizarCantidad(item.id, 1)} 
                              className="p-2 text-slate-700 hover:bg-white rounded-lg transition-colors"
                            >
                              <FaPlus size={12} />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-extrabold text-slate-900 text-base whitespace-nowrap">
                        S/ {(item.precioVenta * item.cantidad).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie de tabla simétrico */}
          <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/80 flex justify-between items-center text-sm text-slate-600 font-medium shrink-0">
            <span>Productos en lista: <strong className="text-slate-900 font-bold">{carrito.length}</strong></span>
            <span>Unidades totales: <strong className="text-slate-900 font-bold">{carrito.reduce((acc, i) => acc + i.cantidad, 0)}</strong></span>
          </div>
        </div>

        {/* PANEL DERECHO: DATOS DEL COMPROBANTE Y COBRO */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
          
          {/* Cabecera compacta */}
          <div className="px-5 py-3 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                <FaFileInvoice size={15} />
              </div>
              <h2 className="text-slate-900 font-bold text-base tracking-tight">
                Datos del Comprobante
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-verde-pastel/45 px-2.5 py-0.5 rounded-full">
              IGV {igvPorcentaje}%
            </span>
          </div>

          {/* Cuerpo con todo visible y barra deslizante moderna, delgada y sin flechas */}
          <div className="px-5 py-3.5 space-y-3 bg-white flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 hover:[&::-webkit-scrollbar-thumb]:bg-emerald-300 [&::-webkit-scrollbar-thumb]:rounded-full">
            
            {/* 1. Selector de Tipo de Operación*/}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Tipo de Operación
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-1">
                <button type="button" onClick={() => setTipoComprobante('TICKET')} 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${tipoComprobante === 'TICKET' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Venta Rápida
                </button>
                <button type="button" onClick={() => setTipoComprobante('BOLETA')} 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${tipoComprobante === 'BOLETA' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Boleta
                </button>
                <button type="button" onClick={() => setTipoComprobante('FACTURA')} 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${tipoComprobante === 'FACTURA' ? 'bg-verde-pastel text-emerald-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                  Factura
                </button>
                <button type="button" onClick={() => setTipoComprobante('FIADO')} 
                  className={`flex-1 py-1.5 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${tipoComprobante === 'FIADO' ? 'bg-amber-500 text-white shadow-2xs' : 'text-amber-700 hover:bg-amber-100/60'}`}>
                  Fiado
                </button>
              </div>
            </div>

            {/* 2. Selector de Medio de Pago en formato horizontal compacto */}
            {tipoComprobante !== 'FIADO' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Medio de Pago Recibido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPago('EFECTIVO')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPago === 'EFECTIVO'
                        ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogoEfectivo />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago('YAPE_PLIN')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPago === 'YAPE_PLIN'
                        ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosYapePlin />
                    <span>Yape/Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPago('TRANSFERENCIA')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPago === 'TRANSFERENCIA'
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosBancos />
                    <span>Transf.</span>
                  </button>
                </div>
              </div>
            )}

            {/* 3. Datos del Cliente */}
            {(tipoComprobante !== 'TICKET' || tipoComprobante === 'FIADO') && (
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                
                {tipoComprobante !== 'FIADO' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{tipoComprobante === 'FACTURA' ? 'Número de RUC *' : 'Número de DNI *'}</span>
                      <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
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
                        setCliente({...cliente, documento: num});
                        if (num.length === limit) {
                          buscarDocumento(num, tipoComprobante);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 outline-none text-sm font-mono font-semibold text-slate-900 transition-all" 
                    />
                  </div>
                )}
                
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    {tipoComprobante === 'FIADO' ? 'Nombre del Vecino / Cliente *' : (tipoComprobante === 'FACTURA' ? 'Razón Social *' : 'Nombre del Cliente *')}
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder={isLoadingDoc ? 'Consultando padrón oficial...' : (tipoComprobante === 'FIADO' ? 'Nombre completo o referencia' : 'Nombre completo o Razón Social')}
                    value={cliente.nombre} 
                    onChange={e => setCliente({...cliente, nombre: e.target.value})}
                    disabled={isLoadingDoc}
                    className={`w-full px-3 py-2 border rounded-xl outline-none text-sm font-medium transition-all ${isLoadingDoc ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50/70 focus:bg-white border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 text-slate-900'}`} 
                  />
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
                        let num = e.target.value.replace(/\D/g, '');
                        if (num.length > 0 && !num.startsWith('9')) return; 
                        setCliente({...cliente, telefono: num.slice(0, 9)});
                      }}
                      className="w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 outline-none text-sm font-mono font-semibold text-slate-900 transition-all" 
                    />
                  </div>
                )}

                {tipoComprobante !== 'FIADO' && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1 block">
                      Entrega de Comprobante
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
                      <button type="button" onClick={() => setMetodoEnvio('NINGUNO')} 
                        className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'NINGUNO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        Impresión
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('CORREO')} 
                        className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'CORREO' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        Correo
                      </button>
                      <button type="button" onClick={() => setMetodoEnvio('WHATSAPP')} 
                        className={`py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${metodoEnvio === 'WHATSAPP' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}>
                        WhatsApp
                      </button>
                    </div>

                    {metodoEnvio === 'CORREO' && (
                      <input type="email" required placeholder="cliente@correo.com" value={cliente.correo} onChange={e => setCliente({...cliente, correo: e.target.value})}
                        className="mt-2 w-full px-3 py-2 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-sm font-medium" />
                    )}
                    {metodoEnvio === 'WHATSAPP' && (
                      <input type="text" required placeholder="Celular WhatsApp (9 dígitos)" 
                        value={cliente.telefono} 
                        onChange={e => {
                          let num = e.target.value.replace(/\D/g, '');
                          if (num.length > 0 && !num.startsWith('9')) return;
                          setCliente({...cliente, telefono: num.slice(0, 9)});
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
          </div>

          {/* 4. Pie Compacto de Totales y Botón de Cobro */}
          <div className="px-5 py-3.5 border-t border-slate-200/80 bg-slate-50/70 shrink-0">
            {tipoComprobante !== 'TICKET' && (
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200/80 text-xs text-slate-600 font-medium">
                <span>Gravada: <strong className="font-mono text-slate-800">S/ {subtotalBase.toFixed(2)}</strong></span>
                <span>IGV ({igvPorcentaje}%): <strong className="font-mono text-slate-800">S/ {montoIgv.toFixed(2)}</strong></span>
              </div>
            )}
            
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">Importe Total:</span>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">S/ {totalPagado.toFixed(2)}</span>
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
              <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
                <h3 className="text-base font-bold flex items-center gap-2.5">
                  <FaCamera className="text-verde-pastel" /> Lector de Código de Barras
                </h3>
                <button onClick={() => setIsScannerOpen(false)} className="text-slate-400 hover:text-white">
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

      {/* MODAL DE VENTA EXITOSA */}
      <AnimatePresence>
        {ventaGenerada && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="bg-white p-6 border-b border-slate-100 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-700 flex items-center justify-center shrink-0">
                  <FaCheckCircle className="text-2xl" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Operación Registrada</h2>
                  <p className="text-sm text-slate-600 font-medium">
                    {ventaGenerada.tipo === 'TICKET' ? 'Venta Rápida' : `${ventaGenerada.tipo} Electrónica`} emitida con éxito.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-slate-50/80 space-y-3 text-sm">
                <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80">
                  <span className="text-slate-600 font-semibold">N° Operación:</span>
                  <span className="text-slate-900 font-mono font-bold">#000{ventaGenerada.id}</span>
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
                  <span className="text-emerald-700 font-extrabold text-2xl">S/ {ventaGenerada.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="p-5 bg-white border-t border-slate-100 flex flex-col gap-2.5">
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
                    className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm"
                  >
                    <FaWhatsapp size={18} /> Enviar Comprobante por WhatsApp
                  </button>
                )}

                {ventaGenerada.metodoEnvio === 'CORREO' && ventaGenerada.tipo !== 'TICKET' && (
                  <button 
                    onClick={() => window.open(ventaGenerada.enlacePdf, '_blank')}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm"
                  >
                    <FaEnvelope size={15} /> Abrir PDF / Correo Enviado
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
                    className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-3 px-4 rounded-xl transition-colors flex justify-center items-center gap-2 text-sm"
                  >
                    <FaPrint size={15} /> Imprimir {ventaGenerada.tipo === 'TICKET' ? 'Ticket' : ventaGenerada.tipo}
                  </button>
                )}
                
                <button 
                  onClick={() => setVentaGenerada(null)}
                  className="w-full font-bold py-3 px-4 rounded-xl transition-colors text-sm bg-slate-100 hover:bg-slate-200 text-slate-700"
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