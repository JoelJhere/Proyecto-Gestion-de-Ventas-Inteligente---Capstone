import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaSearch, FaShoppingCart, FaTrash, FaPlus, FaMinus, FaCamera, FaReceipt, FaUser, FaFileInvoice, FaIdCard, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { io } from 'socket.io-client';
import { useBusiness } from '../context/BusinessContext';

const socket = io(`http://${window.location.hostname}:4000`);

export default function Ventas() {
  const { businessConfig } = useBusiness();
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  
  const [carrito, setCarrito] = useState(() => JSON.parse(localStorage.getItem('pos_carrito')) || []);
  const [tipoComprobante, setTipoComprobante] = useState(() => localStorage.getItem('pos_tipo_comprobante') || 'TICKET');
  const [cliente, setCliente] = useState(() => JSON.parse(localStorage.getItem('pos_cliente')) || { documento: '', nombre: '', correo: '', telefono: '' });

  useEffect(() => localStorage.setItem('pos_carrito', JSON.stringify(carrito)), [carrito]);
  useEffect(() => localStorage.setItem('pos_tipo_comprobante', tipoComprobante), [tipoComprobante]);
  useEffect(() => localStorage.setItem('pos_cliente', JSON.stringify(cliente)), [cliente]);

  const totalPagado = carrito.reduce((sum, item) => sum + (item.precioVenta * item.cantidad), 0);
  const igvPorcentaje = businessConfig.impuestoPorcentaje || 18;
  const factorIgv = 1 + (igvPorcentaje / 100); 
  const subtotalBase = tipoComprobante !== 'TICKET' ? (totalPagado / factorIgv) : totalPagado;
  const montoIgv = tipoComprobante !== 'TICKET' ? (totalPagado - subtotalBase) : 0;

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const API_URL = `http://${window.location.hostname}:4000/api/productos`;

  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
        setProductos(res.data.filter(p => p.estado === true && p.stock > 0));
      } catch (error) {
        console.error("Error al cargar productos", error);
      }
    };
    cargarCatalogo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // --- LÓGICA DEL ESCÁNER CORREGIDA ---
  useEffect(() => {
    let html5QrCode;

    if (isScannerOpen) {
      // Le damos 200ms a React para que dibuje el <div id="reader-ventas"> en la pantalla antes de encender la cámara
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
              // eslint-disable-next-line react-hooks/immutability
              agregarAlCarrito(productoEncontrado);
            } else {
              alert(`El código ${decodedText} no existe en tu inventario.`);
            }
          },
          () => { /* Ignoramos advertencias de enfoque */ }
        ).catch(err => {
          console.error("Error al iniciar cámara:", err);
          alert("Error al acceder a la cámara. Verifica los permisos de tu navegador.");
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

  const agregarAlCarrito = (producto) => {
    setCarrito(prev => {
      const itemExistente = prev.find(item => item.id === producto.id);
      let nuevoCarrito;
      
      if (itemExistente) {
        if (itemExistente.cantidad >= producto.stock) {
          alert("Límite de stock alcanzado para este producto.");
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
            alert("Límite de stock alcanzado.");
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

  const productosBuscados = busqueda.trim() === '' ? [] : productos.filter(prod => 
    prod.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    prod.codigo.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 text-slate-900 pb-20 lg:pb-0 font-sans lg:h-[calc(100vh-6rem)] relative">
      
      <div className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm relative min-h-[500px] lg:min-h-0">
        <div className="p-4 sm:p-5 bg-neutral-950 border-t-4 border-verde-pastel shrink-0">
          <h2 className="text-xl font-extrabold text-white mb-4 tracking-tight flex items-center gap-2">
            <FaShoppingCart className="text-verde-pastel" /> Boleta de Venta
          </h2>
          
          <div className="flex gap-3">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaSearch className="text-slate-400" />
              </div>
              <input 
                type="text" 
                placeholder="Busca un producto..." 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all shadow-sm font-medium" 
              />

              <AnimatePresence>
                {busqueda && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} 
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl z-40 max-h-60 overflow-y-auto">
                    {productosBuscados.length === 0 ? (
                      <div className="p-4 text-slate-500 text-sm text-center font-medium">No hay coincidencias en inventario</div>
                    ) : (
                      productosBuscados.map(prod => (
                        <div key={prod.id} onClick={() => { agregarAlCarrito(prod); setBusqueda(''); }} className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors">
                          <div>
                            <p className="text-sm font-bold text-slate-800">{prod.nombre}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{prod.codigo}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-700 font-extrabold text-sm">S/ {prod.precioVenta.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Stock: {prod.stock}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setIsScannerOpen(true)}
              className="bg-neutral-950 hover:bg-neutral-900 text-white font-bold px-5 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <FaCamera className="text-verde-pastel" /> <span className="hidden sm:inline">Escanear</span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          <AnimatePresence>
            {carrito.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-slate-400">
                <FaReceipt className="text-6xl mb-4 text-slate-300" />
                <p className="text-sm font-medium">La boleta está vacía. Escanea o busca productos arriba.</p>
              </motion.div>
            ) : (
              carrito.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-4 rounded-xl mb-3 border border-slate-200 hover:border-dorado/50 shadow-sm transition-all gap-3 sm:gap-4"
                >
                  {/* Bloque 1: Detalles del Producto */}
                  <div className="flex-1">
                    <h4 className="text-slate-900 text-sm font-bold mb-2">{item.nombre}</h4>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide">
                      <span className="text-slate-500 font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                        CÓD: {item.codigo}
                      </span>
                      <span className="text-slate-500 font-semibold bg-slate-50 border border-slate-100 px-2 py-1 rounded-md">
                        Unit: <strong className="text-slate-700">S/ {item.precioVenta.toFixed(2)}</strong>
                      </span>
                      <span className={`font-bold px-2 py-1 rounded-md border ${item.stock < 5 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        Stock Total: {item.stock}
                      </span>
                    </div>
                  </div>
                  
                  {/* CONTENEDOR PARA MÓVIL: Agrupa cantidad y subtotal en la misma fila inferior */}
                  <div className="flex flex-row justify-between items-center w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 mt-1 sm:mt-0 gap-4">
                    
                    {/* Bloque 2: Controles de Cantidad (Botones más grandes para fácil toque en celular) */}
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0">
                      <button onClick={() => actualizarCantidad(item.id, -1)} 
                        className={`p-2 rounded transition-colors ${item.cantidad === 1 ? 'text-red-500 hover:bg-red-100' : 'text-slate-600 hover:bg-slate-200'}`}>
                        {item.cantidad === 1 ? <FaTrash size={12} /> : <FaMinus size={12} />}
                      </button>
                      <span className="w-10 text-center text-sm font-black text-slate-800">{item.cantidad}</span>
                      <button onClick={() => actualizarCantidad(item.id, 1)} 
                        className="p-2 text-slate-600 hover:bg-slate-200 rounded transition-colors">
                        <FaPlus size={12} />
                      </button>
                    </div>

                    {/* Bloque 3: Subtotal de la línea */}
                    <div className="text-right min-w-[90px] shrink-0 sm:border-l border-slate-100 sm:pl-4">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Subtotal</p>
                      <p className="text-emerald-600 font-black text-lg">S/ {(item.precioVenta * item.cantidad).toFixed(2)}</p>
                    </div>

                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full lg:w-1/3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-fit">
        <div className="bg-neutral-950 px-6 py-4 border-t-4 border-dorado shrink-0">
          <h2 className="text-white font-extrabold text-lg flex items-center gap-2">
            <FaFileInvoice className="text-dorado" /> Detalles de Facturación
          </h2>
        </div>

        <div className="p-6 flex-1 space-y-6 bg-slate-50">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Tipo de Venta</label>
            <div className="flex bg-slate-200 p-1 rounded-lg">
              <button onClick={() => setTipoComprobante('TICKET')} 
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${tipoComprobante === 'TICKET' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Simple
              </button>
              <button onClick={() => setTipoComprobante('BOLETA')} 
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${tipoComprobante === 'BOLETA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Boleta
              </button>
              <button onClick={() => setTipoComprobante('FACTURA')} 
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${tipoComprobante === 'FACTURA' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Factura
              </button>
            </div>
          </div>

          {tipoComprobante !== 'TICKET' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <FaIdCard/> {tipoComprobante === 'FACTURA' ? 'RUC *' : 'DNI *'}
                </label>

                <input type="text" required placeholder={`Ingresa el ${tipoComprobante === 'FACTURA' ? 'RUC' : 'DNI'}`}
                  value={cliente.documento} onChange={e => setCliente({...cliente, documento: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:border-dorado focus:ring-1 focus:ring-dorado outline-none text-sm" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide flex items-center gap-1">
                  <FaUser/> {tipoComprobante === 'FACTURA' ? 'Razón Social *' : 'Nombre Completo *'}
                </label>
                <input type="text" required placeholder={`Ingresa ${tipoComprobante === 'FACTURA' ? 'la razón social' : 'el nombre'}`}
                  value={cliente.nombre} onChange={e => setCliente({...cliente, nombre: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:border-dorado focus:ring-1 focus:ring-dorado outline-none text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <input type="email" placeholder="Correo (Opcional)" value={cliente.correo} onChange={e => setCliente({...cliente, correo: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:border-dorado focus:ring-1 focus:ring-dorado outline-none text-xs" />
                 <input type="text" placeholder="WhatsApp (Opcional)" value={cliente.telefono} onChange={e => setCliente({...cliente, telefono: e.target.value})}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg focus:border-dorado focus:ring-1 focus:ring-dorado outline-none text-xs" />
              </div>
            </div>
          )}

          {tipoComprobante === 'TICKET' && (
             <div className="p-4 border border-dashed border-slate-300 bg-slate-100 rounded-xl text-center">
               <p className="text-slate-500 text-sm font-medium">Venta rápida sin comprobante de SUNAT. El sistema generará un ticket de control interno.</p>
             </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-white rounded-b-2xl">
          {tipoComprobante !== 'TICKET' && (
            <>
              <div className="flex justify-between text-sm text-slate-500 mb-2 font-medium">
                <span>Op. Gravadas (Base):</span>
                <span>S/ {subtotalBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 mb-4 font-medium">
                <span>IGV ({igvPorcentaje}%):</span>
                <span>S/ {montoIgv.toFixed(2)}</span>
              </div>
            </>
          )}
          
          <div className="flex justify-between items-center mb-6">
            <span className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Total a Pagar:</span>
            <span className="text-3xl font-black text-neutral-950 tracking-tighter">S/ {totalPagado.toFixed(2)}</span>
          </div>

          <button disabled={carrito.length === 0} 
            className="w-full bg-verde-pastel hover:bg-emerald-400 text-neutral-950 font-extrabold py-4 px-6 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide text-sm">
            <FaShoppingCart size={16} /> Procesar Venta
          </button>
        </div>
      </div>

      {/* --- EL NUEVO MODAL DEL ESCÁNER CÁMARA --- */}
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              <h3 className="text-white text-lg font-bold mb-4 uppercase tracking-widest text-center">
                Apunta al Código de Barras
              </h3>
              
              {/* ESTE ES EL DIV CRÍTICO QUE FALTABA */}
              <div 
                id="reader-ventas" 
                className="w-full bg-black rounded-2xl overflow-hidden border-2 border-verde-pastel shadow-[0_0_20px_rgba(167,243,208,0.3)]"
              ></div>
              
              <button 
                onClick={() => setIsScannerOpen(false)}
                className="mt-8 bg-red-500/10 border border-red-500/50 text-red-400 hover:bg-red-500 hover:text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center gap-2"
              >
                <FaTimes /> Cancelar Escáner
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}