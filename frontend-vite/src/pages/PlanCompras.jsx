import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaCheck, FaTimes, FaClipboardList, FaTruck, FaCalendarAlt, FaTrash, FaSearch, FaInfoCircle } from 'react-icons/fa';
import axios from 'axios';

export default function PlanCompras() {
  const [planes, setPlanes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);

  // Control de Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [receivingPlan, setReceivingPlan] = useState(null);

  // Estados para los Buscadores Inteligentes
  const [busquedaProv, setBusquedaProv] = useState('');
  const [showProvDropdown, setShowProvDropdown] = useState(false);
  
  const [busquedaProd, setBusquedaProd] = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);

  // Formulario de Creación (Dueño)
  const [formData, setFormData] = useState({
    proveedorId: '',
    fechaEsperada: '',
    detalles: [] // [{ productoId, cantidadEsperada, precioCompra }]
  });

  const [itemTemp, setItemTemp] = useState({ productoId: '', cantidadEsperada: '', precioCompra: '' });

  // Formulario de Recepción (Ayudante)
  const [detallesRecibidos, setDetallesRecibidos] = useState([]);

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const API_URL_PLANES = `http://${window.location.hostname}:4000/api/planes-compra`;
  const API_URL_PROV = `http://${window.location.hostname}:4000/api/proveedores`;
  const API_URL_PROD = `http://${window.location.hostname}:4000/api/productos`;

  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { headers: { Authorization: `Bearer ${token}` } };

      const [resPlanes, resProv, resProd] = await Promise.all([
        axios.get(API_URL_PLANES, headers),
        axios.get(API_URL_PROV, headers),
        axios.get(API_URL_PROD, headers)
      ]);

      setPlanes(resPlanes.data);
      setProveedores(resProv.data);
      setProductos(resProd.data);
    } catch (error) {
      console.error("Error al cargar datos de compras:", error);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { cargarDatos(); }, []);

  // Filtros dinámicos para los dropdowns
  const proveedoresFiltrados = proveedores.filter(p => p.nombre.toLowerCase().includes(busquedaProv.toLowerCase()) || (p.ruc && p.ruc.includes(busquedaProv)));
  const productosFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || p.codigo.includes(busquedaProd));

  // --- LÓGICA DE CREACIÓN ---
  const agregarItemAlPlan = () => {
    if (!itemTemp.productoId || !itemTemp.cantidadEsperada || !itemTemp.precioCompra) {
      return alert("Completa la cantidad y el costo unitario antes de agregar el producto.");
    }
    const prodSeleccionado = productos.find(p => p.id === parseInt(itemTemp.productoId));
    
    setFormData({
      ...formData,
      detalles: [
        ...formData.detalles,
        {
          productoId: parseInt(itemTemp.productoId),
          nombre: prodSeleccionado?.nombre || 'Producto',
          cantidadEsperada: parseInt(itemTemp.cantidadEsperada),
          precioCompra: parseFloat(itemTemp.precioCompra)
        }
      ]
    });
    
    // Limpiamos los campos temporales
    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
    setBusquedaProd('');
  };

  const eliminarItemTemp = (index) => {
    const nuevosDetalles = formData.detalles.filter((_, i) => i !== index);
    setFormData({ ...formData, detalles: nuevosDetalles });
  };

  const handleCrearPlan = async (e) => {
    e.preventDefault();
    if (!formData.proveedorId) return alert("Por favor, selecciona un proveedor de la lista.");
    if (formData.detalles.length === 0) return alert("Agrega al menos un producto a la orden.");

    try {
      const token = localStorage.getItem('token');
      await axios.post(API_URL_PLANES, formData, { headers: { Authorization: `Bearer ${token}` } });
      
      setIsCreateModalOpen(false);
      setFormData({ proveedorId: '', fechaEsperada: '', detalles: [] });
      setBusquedaProv('');
      cargarDatos();
    } catch (error) {
      alert(error.response?.data?.message || 'Error al guardar el plan de compra');
    }
  };

  // --- LÓGICA DE RECEPCIÓN ---
  const abrirModalRecibir = (plan) => {
    setReceivingPlan(plan);
    setDetallesRecibidos(
      plan.detalles.map(d => ({
        detalleId: d.id,
        productoId: d.productoId,
        nombre: d.producto.nombre,
        cantidadEsperada: d.cantidadEsperada,
        cantidadRecibida: d.cantidadEsperada,
        precioCompra: d.precioCompra
      }))
    );
  };

  const actualizarCantidadRecibida = (detalleId, nuevaCantidad) => {
    setDetallesRecibidos(prev => prev.map(item => {
      if (item.detalleId === detalleId) {
        return { ...item, cantidadRecibida: Math.max(0, parseInt(nuevaCantidad) || 0) };
      }
      return item;
    }));
  };

  const confirmarRecepcion = async () => {
    const confirmado = window.confirm("¿Estás seguro de confirmar la llegada de este pedido? Esto sumará el stock al inventario de forma automática.");
    if (!confirmado) return;

    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL_PLANES}/${receivingPlan.id}/recibir`, { detallesRecibidos }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReceivingPlan(null);
      cargarDatos();
      alert("¡Pedido recibido con éxito! Inventario actualizado.");
    } catch (error) {
      alert(error.response?.data?.message || 'Error al procesar la recepción');
    }
  };

  return (
    <div className="text-slate-900 pb-20 font-sans">
      
      {/* CABECERA */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
            <FaClipboardList className="text-verde-pastel drop-shadow-md" /> Plan de Compras y Pedidos
          </h1>
          <p className="text-slate-500 text-sm font-medium">Gestiona los pedidos a proveedores y recepción de mercadería.</p>
        </div>
        
        {isAdmin && (
          <button onClick={() => setIsCreateModalOpen(true)} className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
              <FaPlus size={14} /> Nuevo Plan de Compra
          </button>
        )}
      </div>

      {/* LISTADO DE PLANES EN TARJETAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {planes.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm font-medium">
            No hay planes de compra registrados. Comienza creando un nuevo pedido.
          </div>
        ) : (
          planes.map((plan) => (
            <div key={plan.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-slate-400">PEDIDO #{plan.id}</span>
                    <h3 className="text-lg font-extrabold text-neutral-950 mt-0.5 flex items-center gap-2">
                      <FaTruck className="text-emerald-600 text-sm" /> {plan.proveedor?.nombre}
                    </h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold border ${
                    plan.estado === 'RECIBIDO' 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {plan.estado}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4 text-xs text-slate-500 font-medium">
                  <p className="flex items-center gap-2">
                    <FaCalendarAlt className="text-slate-400" /> Creado: {new Date(plan.fechaCreacion).toLocaleDateString()}
                  </p>
                  {plan.fechaEsperada && (
                    <p className="flex items-center gap-2">
                      <FaCalendarAlt className="text-amber-500" /> Esperado: {new Date(plan.fechaEsperada).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-100 pt-3 mb-4 space-y-2 max-h-40 overflow-y-auto pr-2">
                  {plan.detalles.map((det) => (
                    <div key={det.id} className="flex justify-between text-xs items-center">
                      <span className="text-slate-700 font-bold truncate pr-2">{det.producto?.nombre}</span>
                      <span className="text-slate-500 font-mono whitespace-nowrap bg-slate-50 px-2 py-0.5 rounded">
                        {det.cantidadRecibida > 0 ? `${det.cantidadRecibida}/` : ''}{det.cantidadEsperada} un.
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-between items-center mt-2">
                <div>
                  <p className="text-[10px] uppercase text-slate-500 tracking-wider font-bold">
                    {plan.estado === 'RECIBIDO' ? 'Total Real Pagado' : 'Total Estimado'}
                  </p>
                  <p className="text-emerald-700 font-black text-lg">
                    S/ {(plan.estado === 'RECIBIDO' ? plan.totalReal : plan.totalEsperado).toFixed(2)}
                  </p>
                </div>

                {plan.estado === 'PENDIENTE' && (
                  <button 
                    onClick={() => abrirModalRecibir(plan)}
                    className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-sm"
                  >
                    Recibir Pedido
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: CREAR PLAN DE COMPRA */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-neutral-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Nuevo Plan de Compra</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1"><FaTimes size={20}/></button>
              </div>
              <form onSubmit={handleCrearPlan} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  
                  {/* SECCIÓN 1: DATOS DEL PEDIDO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Buscador de Proveedores */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Proveedor *</label>
                      <div className="relative">
                        <FaSearch className="absolute left-3 top-3.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Escriba para buscar proveedor..." 
                          value={busquedaProv}
                          onChange={(e) => { setBusquedaProv(e.target.value); setShowProvDropdown(true); }}
                          onFocus={() => setShowProvDropdown(true)}
                          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all" 
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1.5 font-medium flex items-center gap-1"><FaInfoCircle/> Selecciona un proveedor de la lista desplegable.</p>

                      <AnimatePresence>
                        {showProvDropdown && busquedaProv && (
                          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} 
                            className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                            {proveedoresFiltrados.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">No se encontraron proveedores</div>
                            ) : (
                              proveedoresFiltrados.map(p => (
                                <div key={p.id} onClick={() => { setFormData({...formData, proveedorId: p.id}); setBusquedaProv(p.nombre); setShowProvDropdown(false); }} 
                                  className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                  <p className="text-sm font-bold text-slate-800">{p.nombre}</p>
                                  <p className="text-[10px] font-mono text-slate-500">RUC: {p.ruc || 'N/A'}</p>
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Fecha Esperada de Llegada</label>
                      <input type="date" value={formData.fechaEsperada} onChange={e => setFormData({...formData, fechaEsperada: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all" />
                      <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Opcional. Ayuda a organizar tu calendario.</p>
                    </div>
                  </div>

                  {/* SECCIÓN 2: AGREGAR PRODUCTOS */}
                  <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Agregar Productos al Pedido</h3>
                      <p className="text-[11px] text-slate-500 mt-1 font-medium">Busca el producto, define la cantidad que pedirás y a qué costo unitario.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 relative">
                      
                      {/* Buscador de Productos */}
                      <div className="md:col-span-5 relative">
                        <FaSearch className="absolute left-3 top-3.5 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Buscar producto..." 
                          value={busquedaProd}
                          onChange={(e) => { setBusquedaProd(e.target.value); setShowProdDropdown(true); }}
                          onFocus={() => setShowProdDropdown(true)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium outline-none focus:border-emerald-500" 
                        />
                        <AnimatePresence>
                          {showProdDropdown && busquedaProd && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} 
                              className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
                              {productosFiltrados.length === 0 ? (
                                <div className="p-3 text-xs text-slate-500 text-center">Producto no encontrado</div>
                              ) : (
                                productosFiltrados.map(p => (
                                  <div key={p.id} onClick={() => { setItemTemp({...itemTemp, productoId: p.id, precioCompra: p.precioCompra || ''}); setBusquedaProd(p.nombre); setShowProdDropdown(false); }} 
                                    className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex justify-between items-center">
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">{p.nombre}</p>
                                      <p className="text-[10px] text-slate-400 font-mono">{p.codigo}</p>
                                    </div>
                                    <span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-600 font-bold">Stock: {p.stock}</span>
                                  </div>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="md:col-span-3">
                        <input type="number" placeholder="Cant. Esperada" min="1" value={itemTemp.cantidadEsperada} onChange={e => setItemTemp({...itemTemp, cantidadEsperada: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium outline-none focus:border-emerald-500" />
                      </div>
                      <div className="md:col-span-3">
                        {/* Mejora: Placeholder claro para el Costo Unitario */}
                        <input type="number" step="0.10" placeholder="Costo Unit. (S/)" min="0" value={itemTemp.precioCompra} onChange={e => setItemTemp({...itemTemp, precioCompra: e.target.value})} className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 font-medium outline-none focus:border-emerald-500" />
                      </div>
                      <div className="md:col-span-1">
                        <button type="button" onClick={agregarItemAlPlan} className="w-full h-full min-h-[42px] bg-neutral-950 text-white font-bold rounded-lg flex items-center justify-center hover:bg-neutral-800 transition-colors"><FaPlus /></button>
                      </div>
                    </div>

                    {/* LISTA TEMPORAL DE ÍTEMS A PEDIR */}
                    {formData.detalles.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                        <p className="text-xs font-bold text-emerald-700 mb-2">Resumen de la orden:</p>
                        {formData.detalles.map((det, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white px-4 py-3 rounded-xl text-sm border border-emerald-100 shadow-sm">
                            <span className="text-slate-800 font-bold">{det.nombre}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded-md">{det.cantidadEsperada} un. a S/ {det.precioCompra.toFixed(2)} c/u</span>
                              <button type="button" onClick={() => eliminarItemTemp(idx)} className="text-red-400 hover:text-red-600 p-1 bg-red-50 rounded transition-colors"><FaTrash size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none flex justify-center items-center gap-2">
                    <FaCheck /> Confirmar Plan de Compra
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RECIBIR PEDIDO */}
      <AnimatePresence>
        {receivingPlan && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-neutral-950 border-t-4 border-verde-pastel shrink-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white">Recepción de Mercadería</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Verifica las cantidades reales que trajo el proveedor.</p>
                </div>
                <button onClick={() => setReceivingPlan(null)} className="text-slate-400 hover:text-white transition-colors p-1"><FaTimes size={20}/></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50">
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4 flex items-start gap-3">
                  <FaInfoCircle className="text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    Compara la cantidad que esperabas con lo que realmente llegó. Si llegó todo completo, solo haz clic en "Confirmar Ingreso". Si faltó mercancía, ajusta el número en la casilla "Llegaron".
                  </p>
                </div>

                {detallesRecibidos.map((item) => (
                  <div key={item.detalleId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
                    <div>
                      <h4 className="text-slate-800 text-sm font-extrabold">{item.nombre}</h4>
                      <p className="text-xs text-slate-500 mt-1 font-medium">Esperado: <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded ml-1">{item.cantidadEsperada} unidades</span> <span className="ml-2">(S/ {item.precioCompra.toFixed(2)} c/u)</span></p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Llegaron:</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min="0"
                          value={item.cantidadRecibida} 
                          onChange={(e) => actualizarCantidadRecibida(item.detalleId, e.target.value)}
                          className="w-20 p-2 bg-white border border-slate-300 rounded-lg text-center text-emerald-700 font-extrabold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm shadow-inner transition-all" 
                        />
                        <span className="text-xs font-bold text-slate-400">un.</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-5 border-t border-slate-100 bg-white shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                <button type="button" onClick={() => setReceivingPlan(null)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors shadow-sm">Cancelar</button>
                <button onClick={confirmarRecepcion} className="w-full sm:w-auto px-6 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 order-first sm:order-none">
                  <FaCheck /> Confirmar Ingreso
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}