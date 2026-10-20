import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaCheck, FaTimes, FaClipboardList, FaTruck, 
  FaCalendarAlt, FaTrash, FaSearch, FaInfoCircle, 
  FaExclamationTriangle, FaMoneyBillWave 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

// --- LOGOS REALES EN SVG PARA MÉTODOS DE PAGO ---
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

export default function PlanCompras() {
  const [planes, setPlanes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Control de Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [receivingPlan, setReceivingPlan] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [metodoPagoCompra, setMetodoPagoCompra] = useState('EFECTIVO');

  // Estados para los Buscadores Inteligentes
  const [busquedaProv, setBusquedaProv] = useState('');
  const [showProvDropdown, setShowProvDropdown] = useState(false);
  
  const [busquedaProd, setBusquedaProd] = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);

  // Formulario de Creación (Dueño)
  const [formData, setFormData] = useState({
    proveedorId: '',
    fechaEsperada: '',
    detalles: []
  });

  const [itemTemp, setItemTemp] = useState({ productoId: '', cantidadEsperada: '', precioCompra: '' });

  // Formulario de Recepción (Ayudante)
  const [detallesRecibidos, setDetallesRecibidos] = useState([]);

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const cargarDatos = async () => {
    setIsLoading(true);
    try {
      const [resPlanes, resProv, resProd] = await Promise.all([
        axios.get('/planes-compra'),
        axios.get('/proveedores'),
        axios.get('/productos')
      ]);

      setPlanes(resPlanes.data);
      setProveedores(resProv.data);
      setProductos(resProd.data);
    } catch (error) {
      console.error("Error al cargar datos de compras:", error);
      toast.error('Ocurrió un error al cargar los planes de compra.');
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDatos(); }, []);

  // --- LÓGICA DE FILTROS INTELIGENTES (Reglas del Profesor) ---
  const proveedoresFiltrados = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProv.toLowerCase()) || 
    (p.ruc && p.ruc.includes(busquedaProv))
  );

  // 1. Si hay un proveedor seleccionado, mostramos SOLO sus productos. Si no, mostramos todos.
  const productosDelProveedor = formData.proveedorId 
    ? productos.filter(p => p.proveedorId === parseInt(formData.proveedorId))
    : productos;

  // 2. Aplicamos la búsqueda de texto sobre la lista resultante
  const productosFiltrados = productosDelProveedor.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || 
    p.codigo.includes(busquedaProd)
  );

  const handleSelectProvider = (prov) => {
    setFormData({ ...formData, proveedorId: prov.id });
    setBusquedaProv(prov.nombre);
    setShowProvDropdown(false);
    setBusquedaProd('');
  };

  const handleSelectProduct = (prod) => {
    setItemTemp({ ...itemTemp, productoId: prod.id, precioCompra: prod.precioCompra || '' });
    setBusquedaProd(prod.nombre);
    setShowProdDropdown(false);

    // AUTO-COMPLETADO INTELIGENTE: Si no hay proveedor seleccionado, seleccionamos el del producto
    if (!formData.proveedorId && prod.proveedorId) {
      setFormData(prev => ({ ...prev, proveedorId: prod.proveedorId }));
      const provAsociado = proveedores.find(p => p.id === prod.proveedorId);
      if (provAsociado) {
        setBusquedaProv(provAsociado.nombre);
        toast.success(`Proveedor auto-completado: ${provAsociado.nombre}`, { icon: '🤖' });
      }
    }
  };

  // --- LÓGICA DE CREACIÓN ---
  const agregarItemAlPlan = () => {
    if (!itemTemp.productoId || !itemTemp.cantidadEsperada || !itemTemp.precioCompra) {
      return toast.error("Completa la cantidad y el costo antes de agregar.");
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
    
    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
    setBusquedaProd('');
  };

  const eliminarItemTemp = (index) => {
    const nuevosDetalles = formData.detalles.filter((_, i) => i !== index);
    setFormData({ ...formData, detalles: nuevosDetalles });
  };

  const handleCrearPlan = async (e) => {
    e.preventDefault();
    if (!formData.proveedorId) return toast.error("Por favor, selecciona un proveedor.");
    if (formData.detalles.length === 0) return toast.error("Agrega al menos un producto a la orden.");

    try {
      await axios.post('/planes-compra', formData);
      toast.success('Plan de compra creado exitosamente.');
      setIsCreateModalOpen(false);
      setFormData({ proveedorId: '', fechaEsperada: '', detalles: [] });
      setBusquedaProv('');
      cargarDatos();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el plan de compra');
    }
  };

  // Nueva función para limpiar todo el estado al cerrar el modal
  const cerrarModalCrear = () => {
    setIsCreateModalOpen(false);
    setFormData({ proveedorId: '', fechaEsperada: '', detalles: [] });
    setBusquedaProv('');
    setBusquedaProd('');
    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
  };

  // --- LÓGICA DE RECEPCIÓN ---
  const abrirModalRecibir = (plan) => {
    setReceivingPlan(plan);
    setMetodoPagoCompra('EFECTIVO');
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

  // Total en tiempo real de lo que realmente llegó
  const totalRealCalculado = detallesRecibidos.reduce(
    (sum, item) => sum + (parseInt(item.cantidadRecibida || 0) * parseFloat(item.precioCompra || 0)),
    0
  );

  const confirmarRecepcion = async () => {
    try {
      await axios.put(`/planes-compra/${receivingPlan.id}/recibir`, { 
        detallesRecibidos,
        metodoPago: metodoPagoCompra
      });
      toast.success("¡Pedido recibido! Inventario y caja actualizados.");
      setConfirmDialog(false);
      setReceivingPlan(null);
      cargarDatos();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar la recepción');
    }
  };

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const planesPendientes = planes.filter(p => p.estado === 'PENDIENTE').length;
  const planesRecibidos = planes.filter(p => p.estado === 'RECIBIDO').length;
  const inversionTotal = planes.reduce(
    (acc, p) => acc + (p.estado === 'RECIBIDO' ? p.totalReal : p.totalEsperado),
    0
  );

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-20 lg:pb-4 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL (Jerarquía limpia estilo Figma) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Plan de Compras
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Gestiona las órdenes de pedido a tus proveedores y el ingreso de mercadería al almacén.
          </p>
        </div>
        
        {isAdmin && (
          <button 
            type="button"
            onClick={() => setIsCreateModalOpen(true)} 
            className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus size={13} /> Nuevo Plan de Compra
          </button>
        )}
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS (Estilo Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Pedidos Pendientes</p>
            <p className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${planesPendientes > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {planesPendientes}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FaClipboardList size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Pedidos Recibidos</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {planesRecibidos}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaTruck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Inversión en Compras</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              S/ {inversionTotal.toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaMoneyBillWave size={22} />
          </div>
        </div>
      </div>

      {/* LISTADO DE PLANES EN TARJETAS SIMÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_6px_24px_rgba(15,23,42,0.05)] animate-pulse flex flex-col justify-between h-64">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div className="w-1/2 h-4 bg-slate-200 rounded"></div>
                  <div className="w-16 h-5 bg-slate-200 rounded-full"></div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="w-3/4 h-3 bg-slate-200 rounded"></div>
                  <div className="w-2/4 h-3 bg-slate-200 rounded"></div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-3 bg-slate-100 rounded"></div>
                  <div className="w-full h-3 bg-slate-100 rounded"></div>
                </div>
              </div>
              <div className="border-t border-slate-100 pt-4 flex justify-between items-end mt-2">
                <div className="w-24 h-6 bg-slate-200 rounded"></div>
                <div className="w-28 h-9 bg-slate-200 rounded-xl"></div>
              </div>
            </div>
          ))
        ) : planes.length === 0 ? (
          <div className="col-span-full py-16 px-6 text-center bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.05)] flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-verde-pastel/35 text-emerald-800 flex items-center justify-center mb-4">
              <FaClipboardList className="text-3xl" />
            </div>
            <p className="text-base font-bold text-slate-800">No hay planes de compra registrados</p>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Comienza creando una nueva orden de pedido para abastecer tu inventario.
            </p>
          </div>
        ) : (
          planes.map((plan) => (
            <div 
              key={plan.id} 
              className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-[0_6px_28px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_32px_rgba(15,23,42,0.10)] transition-all flex flex-col justify-between h-full min-h-[17rem]"
            >
              <div>
                {/* Cabecera de la tarjeta */}
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      plan.estado === 'RECIBIDO' 
                        ? 'bg-verde-pastel/40 text-emerald-800' 
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      <FaTruck size={17} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-mono font-bold text-slate-400 block">
                        PEDIDO #{plan.id}
                      </span>
                      <h3 className="text-base font-extrabold text-slate-900 truncate" title={plan.proveedor?.nombre}>
                        {plan.proveedor?.nombre}
                      </h3>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-bold border shrink-0 ${
                    plan.estado === 'RECIBIDO' 
                      ? 'bg-verde-pastel/35 text-emerald-900 border-emerald-200' 
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    {plan.estado}
                  </span>
                </div>

                {/* Fechas */}
                <div className="flex flex-wrap gap-3 mb-4 text-xs text-slate-600 font-semibold">
                  <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                    <FaCalendarAlt className="text-slate-400" size={11} /> 
                    Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-PE')}
                  </span>
                  {plan.fechaEsperada && (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50/70 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200/70">
                      <FaCalendarAlt className="text-amber-500" size={11} /> 
                      Esperado: {new Date(plan.fechaEsperada).toLocaleDateString('es-PE')}
                    </span>
                  )}
                </div>

                {/* Lista de productos del pedido */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 mb-4 space-y-2 max-h-32 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {plan.detalles.map((det) => (
                    <div key={det.id} className="flex justify-between text-xs sm:text-sm items-center bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-2xs">
                      <span className="text-slate-800 font-semibold truncate pr-2">{det.producto?.nombre}</span>
                      <span className="text-slate-700 font-mono font-bold whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {det.cantidadRecibida > 0 ? `${det.cantidadRecibida}/` : ''}{det.cantidadEsperada} un.
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pie de tarjeta con Total y Acción */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center mt-auto">
                <div>
                  <p className="text-xs text-slate-500 font-semibold">
                    {plan.estado === 'RECIBIDO' ? 'Total Pagado' : 'Total Estimado'}
                  </p>
                  <p className="text-emerald-700 font-extrabold text-xl tracking-tight">
                    S/ {(plan.estado === 'RECIBIDO' ? plan.totalReal : plan.totalEsperado).toFixed(2)}
                  </p>
                </div>

                {plan.estado === 'PENDIENTE' && (
                  <button 
                    type="button"
                    onClick={() => abrirModalRecibir(plan)}
                    className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-all shadow-2xs cursor-pointer"
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
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[80] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 my-8 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaClipboardList size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Nuevo Plan de Compra</h2>
                    <p className="text-xs text-slate-500 font-medium">Selecciona el proveedor y agrega los productos a solicitar.</p>
                  </div>
                </div>
                <button type="button" onClick={cerrarModalCrear} className="text-slate-400 hover:text-slate-700 transition-colors p-1"><FaTimes size={18}/></button>
              </div>

              <form onSubmit={handleCrearPlan} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  
                  {/* SECCIÓN 1: DATOS DEL PEDIDO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Buscador Dinámico de Proveedores */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Proveedor *</label>
                      <div className="relative">
                        <FaSearch className="absolute left-3.5 top-3 text-slate-400" size={14} />
                        <input 
                          type="text" 
                          placeholder="Buscar proveedor..." 
                          value={busquedaProv}
                          onChange={(e) => { 
                            const valor = e.target.value;
                            setBusquedaProv(valor); 
                            setShowProvDropdown(true);
                            if (valor === '') {
                              setFormData(prev => ({ ...prev, proveedorId: '' }));
                            }
                          }}
                          onFocus={() => setShowProvDropdown(true)}
                          onBlur={() => setTimeout(() => setShowProvDropdown(false), 200)}
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm font-medium transition-all" 
                        />
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                        <FaInfoCircle className="text-slate-400" size={11} /> Selecciona de la lista desplegable.
                      </p>

                      <AnimatePresence>
                        {showProvDropdown && (
                          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} 
                            className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] max-h-44 overflow-y-auto divide-y divide-slate-100">
                            {proveedoresFiltrados.length === 0 ? (
                              <div className="p-3 text-xs text-slate-500 text-center">No se encontraron proveedores</div>
                            ) : (
                              proveedoresFiltrados.map(p => (
                                <div key={p.id} onMouseDown={() => handleSelectProvider(p)} 
                                  className="px-3.5 py-2.5 hover:bg-verde-pastel/25 cursor-pointer transition-colors">
                                  <p className="text-sm font-bold text-slate-900">{p.nombre}</p>
                                  <p className="text-xs font-mono text-slate-500">RUC: {p.ruc || 'N/A'}</p>
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Fecha Esperada de Llegada</label>
                      <input 
                        type="date" 
                        value={formData.fechaEsperada} 
                        onChange={e => setFormData({...formData, fechaEsperada: e.target.value})} 
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm font-medium transition-all" 
                      />
                      <p className="text-xs text-slate-500 mt-1 font-medium">Opcional. Ayuda a organizar tu calendario.</p>
                    </div>
                  </div>

                  {/* SECCIÓN 2: AGREGAR PRODUCTOS */}
                  <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Productos del Pedido</h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">Busca el producto, define la cantidad solicitada y el costo unitario de compra.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 relative">
                      
                      {/* Buscador Dinámico de Productos */}
                      <div className="md:col-span-5 relative">
                        <FaSearch className="absolute left-3.5 top-3 text-slate-400" size={13} />
                        <input 
                          type="text" 
                          placeholder="Buscar producto..." 
                          value={busquedaProd}
                          onChange={(e) => { setBusquedaProd(e.target.value); setShowProdDropdown(true); }}
                          onFocus={() => setShowProdDropdown(true)}
                          onBlur={() => setTimeout(() => setShowProdDropdown(false), 200)}
                          className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                        />
                        <AnimatePresence>
                          {showProdDropdown && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} 
                              className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.14)] max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {productosFiltrados.length === 0 ? (
                                <div className="p-3 text-xs text-slate-500 text-center">No se encontró producto</div>
                              ) : (
                                productosFiltrados.map(p => (
                                  <div key={p.id} onMouseDown={() => handleSelectProduct(p)} 
                                    className="px-3.5 py-2.5 hover:bg-verde-pastel/25 cursor-pointer flex justify-between items-center transition-colors">
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">{p.nombre}</p>
                                      <p className="text-xs text-slate-500 font-mono">{p.codigo}</p>
                                    </div>
                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-bold">
                                      Stock: {p.stock}
                                    </span>
                                  </div>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="md:col-span-3">
                        <input 
                          type="number" 
                          placeholder="Cantidad" 
                          min="1" 
                          value={itemTemp.cantidadEsperada} 
                          onChange={e => setItemTemp({...itemTemp, cantidadEsperada: e.target.value})} 
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                        />
                      </div>
                      <div className="md:col-span-3">
                        <input 
                          type="number" 
                          step="0.10" 
                          placeholder="Costo Unit. (S/)" 
                          min="0" 
                          value={itemTemp.precioCompra} 
                          onChange={e => setItemTemp({...itemTemp, precioCompra: e.target.value})} 
                          className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                        />
                      </div>
                      <div className="md:col-span-1">
                        <button 
                          type="button" 
                          onClick={agregarItemAlPlan} 
                          className="w-full h-full min-h-[42px] bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold rounded-xl flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                          title="Agregar producto a la lista"
                        >
                          <FaPlus />
                        </button>
                      </div>
                    </div>

                    {/* LISTA TEMPORAL DE ÍTEMS A PEDIR */}
                    {formData.detalles.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                        <p className="text-xs font-bold text-emerald-800 mb-2">Resumen de la orden:</p>
                        {formData.detalles.map((det, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white px-4 py-2.5 rounded-xl text-sm border border-slate-200/80 shadow-2xs">
                            <span className="text-slate-900 font-bold">{det.nombre}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-700 font-semibold bg-slate-100 px-2.5 py-1 rounded-lg text-xs">
                                {det.cantidadEsperada} un. × S/ {det.precioCompra.toFixed(2)}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => eliminarItemTemp(idx)} 
                                className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <FaTrash size={13}/>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button type="button" onClick={cerrarModalCrear} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">
                    Cancelar
                  </button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none flex justify-center items-center gap-2 cursor-pointer">
                    <FaCheck size={13} /> Confirmar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RECIBIR PEDIDO (CON LOGOS REALES DE MÉTODO DE PAGO Y DESCUENTO DE CAJA) */}
      <AnimatePresence>
        {receivingPlan && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaTruck size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Recepción de Mercadería</h2>
                    <p className="text-xs text-slate-500 font-medium">Verifica las cantidades reales entregadas por el proveedor.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setReceivingPlan(null)} className="text-slate-400 hover:text-slate-700 transition-colors p-1"><FaTimes size={18}/></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/60 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="bg-verde-pastel/20 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3">
                  <FaInfoCircle className="text-emerald-700 mt-0.5 shrink-0" size={15} />
                  <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
                    Compara la cantidad solicitada con lo que realmente llegó. El importe final se descontará automáticamente del capital de la bodega.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {detallesRecibidos.map((item) => (
                    <div key={item.detalleId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs gap-4">
                      <div>
                        <h4 className="text-slate-900 text-sm font-bold">{item.nombre}</h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Solicitado: <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 ml-1">{item.cantidadEsperada} un.</span> 
                          <span className="ml-2 font-mono text-slate-600">(S/ {item.precioCompra.toFixed(2)} c/u)</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Llegaron:</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0"
                            value={item.cantidadRecibida} 
                            onChange={(e) => actualizarCantidadRecibida(item.detalleId, e.target.value)}
                            className="w-20 py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-center text-emerald-800 font-extrabold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 text-sm" 
                          />
                          <span className="text-xs font-bold text-slate-500">un.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RESUMEN DE PAGO AL PROVEEDOR CON LOGOS REALES */}
                <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 mt-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Total Real a Pagar al Proveedor:
                    </span>
                    <span className="text-2xl font-extrabold text-red-600 tracking-tight">
                      S/ {totalRealCalculado.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      ¿Con qué medio de pago de la bodega se canceló este pedido?
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setMetodoPagoCompra('EFECTIVO')}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          metodoPagoCompra === 'EFECTIVO'
                            ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogoEfectivo />
                        <span>Efectivo</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetodoPagoCompra('YAPE_PLIN')}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          metodoPagoCompra === 'YAPE_PLIN'
                            ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogosYapePlin />
                        <span>Yape / Plin</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMetodoPagoCompra('TRANSFERENCIA')}
                        className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          metodoPagoCompra === 'TRANSFERENCIA'
                            ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogosBancos />
                        <span>Transferencia</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                <button type="button" onClick={() => setReceivingPlan(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={() => setConfirmDialog(true)} className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm flex items-center justify-center gap-2 order-first sm:order-none cursor-pointer">
                  <FaCheck size={13} /> Confirmar Ingreso
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: CONFIRMACIÓN FINAL */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center mb-4">
                  <FaExclamationTriangle size={26} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  ¿Confirmar recepción?
                </h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Se sumará el stock al inventario y se descontarán <strong className="text-slate-900">S/ {totalRealCalculado.toFixed(2)}</strong> ({metodoPagoCompra === 'YAPE_PLIN' ? 'Yape/Plin' : metodoPagoCompra}) del capital de la bodega.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button type="button" onClick={() => setConfirmDialog(false)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm cursor-pointer">
                  Revisar
                </button>
                <button type="button" onClick={confirmarRecepcion} className="flex-1 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-colors text-sm cursor-pointer">
                  Aceptar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}