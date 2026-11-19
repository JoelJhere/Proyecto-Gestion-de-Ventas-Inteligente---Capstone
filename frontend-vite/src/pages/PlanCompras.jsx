import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaCheck, FaTimes, FaClipboardList, FaTruck, 
  FaCalendarAlt, FaTrash, FaSearch, FaInfoCircle, 
  FaExclamationTriangle, FaMoneyBillWave, FaChevronDown 
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
  const BLOQUE_CARGA = 30;

  const [planes, setPlanes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros y paginación progresiva (30 en 30)
  const [busquedaPlan, setBusquedaPlan] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS'); // TODOS | PENDIENTE | RECIBIDO
  const [limiteVisible, setLimiteVisible] = useState(BLOQUE_CARGA);

  // Candado síncrono anti-spam / doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accionEnCursoRef = useRef(false);

  // Control de Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [receivingPlan, setReceivingPlan] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [metodoPagoCompra, setMetodoPagoCompra] = useState('EFECTIVO');

  // Estados para los Buscadores Inteligentes dentro del Modal Crear
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

  // Formulario de Recepción
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
      console.error('Error al cargar datos de compras:', error);
      toast.error('Ocurrió un error al cargar los planes de compra.', { id: 'plan-carga' });
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDatos(); }, []);

  // --- LÓGICA DE FILTROS INTELIGENTES EN MODAL CREAR ---
  const proveedoresFiltrados = proveedores.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProv.toLowerCase()) || 
    (p.ruc && p.ruc.includes(busquedaProv))
  );

  // 1. Si hay un proveedor seleccionado, mostramos SOLO sus productos. Si no, mostramos todos.
  const productosDelProveedor = formData.proveedorId 
    ? productos.filter(p => p.proveedorId === parseInt(formData.proveedorId, 10))
    : productos;

  // 2. Aplicamos la búsqueda de texto sobre la lista resultante
  const productosFiltrados = productosDelProveedor.filter(p => 
    p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || 
    (p.codigo && p.codigo.toLowerCase().includes(busquedaProd.toLowerCase()))
  );

  const handleSelectProvider = (prov) => {
    setFormData(prev => ({ ...prev, proveedorId: prov.id }));
    setBusquedaProv(prov.nombre);
    setShowProvDropdown(false);
    setBusquedaProd('');
    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
  };

  const handleSelectProduct = (prod) => {
    setItemTemp(prev => ({ ...prev, productoId: prod.id, precioCompra: prod.precioCompra || '' }));
    setBusquedaProd(prod.nombre);
    setShowProdDropdown(false);

    // AUTO-COMPLETADO INTELIGENTE: Si no hay proveedor seleccionado, seleccionamos el del producto
    if (!formData.proveedorId && prod.proveedorId) {
      setFormData(prev => ({ ...prev, proveedorId: prod.proveedorId }));
      const provAsociado = proveedores.find(p => p.id === prod.proveedorId);
      if (provAsociado) {
        setBusquedaProv(provAsociado.nombre);
        toast.success(`Proveedor auto-completado: ${provAsociado.nombre}`, { id: 'plan-auto-prov' });
      }
    }
  };

  // --- LÓGICA DE CREACIÓN ---
  const agregarItemAlPlan = () => {
    const prodIdNum = parseInt(itemTemp.productoId, 10);
    const cantNum = parseInt(itemTemp.cantidadEsperada, 10);
    const costoNum = parseFloat(itemTemp.precioCompra);

    if (!prodIdNum) {
      return toast.error('Selecciona un producto de la lista desplegable.', { id: 'plan-item' });
    }
    if (Number.isNaN(cantNum) || cantNum <= 0) {
      return toast.error('Ingresa una cantidad válida mayor a 0.', { id: 'plan-item' });
    }
    if (Number.isNaN(costoNum) || costoNum < 0) {
      return toast.error('Ingresa un costo unitario válido.', { id: 'plan-item' });
    }

    const prodSeleccionado = productos.find(p => p.id === prodIdNum);

    setFormData(prev => {
      const yaExiste = prev.detalles.some(d => d.productoId === prodIdNum);
      if (yaExiste) {
        toast.success('Cantidad sumada al producto ya agregado en la orden.', { id: 'plan-item' });
        return {
          ...prev,
          detalles: prev.detalles.map(d =>
            d.productoId === prodIdNum
              ? { ...d, cantidadEsperada: d.cantidadEsperada + cantNum, precioCompra: costoNum }
              : d
          )
        };
      }

      return {
        ...prev,
        detalles: [
          ...prev.detalles,
          {
            productoId: prodIdNum,
            nombre: prodSeleccionado?.nombre || 'Producto',
            cantidadEsperada: cantNum,
            precioCompra: costoNum
          }
        ]
      };
    });

    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
    setBusquedaProd('');
  };

  const eliminarItemTemp = (index) => {
    setFormData(prev => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== index)
    }));
  };

  const totalEstimadoNuevoPlan = formData.detalles.reduce(
    (sum, d) => sum + d.cantidadEsperada * d.precioCompra,
    0
  );

  const cerrarModalCrear = () => {
    if (accionEnCursoRef.current) return;
    setIsCreateModalOpen(false);
    setFormData({ proveedorId: '', fechaEsperada: '', detalles: [] });
    setBusquedaProv('');
    setBusquedaProd('');
    setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
  };

  const handleCrearPlan = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current) return;

    if (!formData.proveedorId) {
      return toast.error('Por favor, selecciona un proveedor.', { id: 'plan-accion' });
    }
    if (formData.detalles.length === 0) {
      return toast.error('Agrega al menos un producto a la orden.', { id: 'plan-accion' });
    }

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.post('/planes-compra', formData);
      toast.success('Plan de compra creado exitosamente.', { id: 'plan-accion' });
      setIsCreateModalOpen(false);
      setFormData({ proveedorId: '', fechaEsperada: '', detalles: [] });
      setBusquedaProv('');
      setBusquedaProd('');
      setItemTemp({ productoId: '', cantidadEsperada: '', precioCompra: '' });
      cargarDatos();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el plan de compra.', { id: 'plan-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  // --- LÓGICA DE RECEPCIÓN ---
  const abrirModalRecibir = (plan) => {
    if (accionEnCursoRef.current) return;
    setReceivingPlan(plan);
    setMetodoPagoCompra('EFECTIVO');
    setDetallesRecibidos(
      (plan.detalles || []).map(d => ({
        detalleId: d.id,
        productoId: d.productoId,
        nombre: d.producto?.nombre || 'Producto',
        cantidadEsperada: d.cantidadEsperada,
        cantidadRecibida: d.cantidadEsperada,
        precioCompra: d.precioCompra
      }))
    );
  };

  const actualizarCantidadRecibida = (detalleId, valor) => {
    setDetallesRecibidos(prev => prev.map(item => {
      if (item.detalleId === detalleId) {
        if (valor === '') return { ...item, cantidadRecibida: '' };
        return { ...item, cantidadRecibida: Math.max(0, parseInt(valor, 10) || 0) };
      }
      return item;
    }));
  };

  // Total en tiempo real de lo que realmente llegó
  const totalRealCalculado = detallesRecibidos.reduce(
    (sum, item) => sum + ((parseInt(item.cantidadRecibida, 10) || 0) * parseFloat(item.precioCompra || 0)),
    0
  );

  const confirmarRecepcion = async () => {
    if (!receivingPlan || accionEnCursoRef.current) return;

    const detallesNormalizados = detallesRecibidos.map(item => ({
      ...item,
      cantidadRecibida: parseInt(item.cantidadRecibida, 10) || 0
    }));

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.put(`/planes-compra/${receivingPlan.id}/recibir`, {
        detallesRecibidos: detallesNormalizados,
        metodoPago: metodoPagoCompra
      });
      toast.success('Pedido recibido. Inventario y caja actualizados.', { id: 'plan-accion' });
      setConfirmDialog(false);
      setReceivingPlan(null);
      cargarDatos();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar la recepción.', { id: 'plan-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Filtros y paginación progresiva de los planes (30 en 30)
  const planesFiltrados = planes.filter(plan => {
    if (filtroEstado !== 'TODOS' && plan.estado !== filtroEstado) return false;
    const q = busquedaPlan.trim().toLowerCase();
    if (!q) return true;
    return (
      String(plan.id).includes(q) ||
      (plan.proveedor?.nombre || '').toLowerCase().includes(q) ||
      (plan.detalles || []).some(d => (d.producto?.nombre || '').toLowerCase().includes(q))
    );
  });

  const planesVisibles = planesFiltrados.slice(0, limiteVisible);
  const restantesPorCargar = planesFiltrados.length - planesVisibles.length;

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const planesPendientes = planes.filter(p => p.estado === 'PENDIENTE').length;
  const planesRecibidos = planes.filter(p => p.estado === 'RECIBIDO').length;
  const inversionTotal = planes.reduce(
    (acc, p) => acc + Number(p.estado === 'RECIBIDO' ? p.totalReal : p.totalEsperado || 0),
    0
  );

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL (Responsive para Tablet y Laptop) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Plan de Compras
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Gestiona las órdenes de pedido a tus proveedores y el ingreso de mercadería al almacén.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar proveedor, producto o #..." 
              value={busquedaPlan} 
              onChange={(e) => {
                setBusquedaPlan(e.target.value);
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className="w-full pl-11 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400" 
            />
            {busquedaPlan && (
              <button
                type="button"
                onClick={() => {
                  setBusquedaPlan('');
                  setLimiteVisible(BLOQUE_CARGA);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <FaTimes size={13} />
              </button>
            )}
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
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Pedidos Pendientes</p>
            <p className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${planesPendientes > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {planesPendientes}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FaClipboardList size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Pedidos Recibidos</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {planesRecibidos}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaTruck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Inversión en Compras</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              S/ {inversionTotal.toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaMoneyBillWave size={22} />
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS POR ESTADO */}
      {!isLoading && planes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'TODOS', label: `Todos (${planes.length})` },
            { id: 'PENDIENTE', label: `Pendientes (${planesPendientes})` },
            { id: 'RECIBIDO', label: `Recibidos (${planesRecibidos})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFiltroEstado(tab.id);
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                filtroEstado === tab.id
                  ? 'bg-verde-pastel text-emerald-950 border-emerald-300 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* LISTADO DE PLANES EN TARJETAS SIMÉTRICAS */}
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
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
          ) : planesFiltrados.length === 0 ? (
            <div className="col-span-full py-16 px-6 text-center bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.05)] flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-verde-pastel/35 text-emerald-800 flex items-center justify-center mb-4">
                <FaClipboardList className="text-3xl" />
              </div>
              <p className="text-base font-bold text-slate-800">
                {busquedaPlan.trim() || filtroEstado !== 'TODOS'
                  ? 'No se encontraron pedidos con ese filtro'
                  : 'No hay planes de compra registrados'}
              </p>
              <p className="text-sm text-slate-500 font-medium mt-1">
                {busquedaPlan.trim() || filtroEstado !== 'TODOS'
                  ? 'Prueba limpiar el buscador o cambiar el filtro de estado.'
                  : 'Comienza creando una nueva orden de pedido para abastecer tu inventario.'}
              </p>
            </div>
          ) : (
            planesVisibles.map((plan) => (
              <div 
                key={plan.id} 
                className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-[0_6px_28px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_32px_rgba(15,23,42,0.10)] transition-all flex flex-col justify-between h-full min-h-[17rem]"
              >
                <div>
                  {/* Cabecera de la tarjeta */}
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        plan.estado === 'RECIBIDO' 
                          ? 'bg-verde-pastel/40 text-emerald-800' 
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        <FaTruck size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-mono font-bold text-slate-400 block">
                          PEDIDO #{plan.id}
                        </span>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 line-clamp-2 leading-snug" title={plan.proveedor?.nombre}>
                          {plan.proveedor?.nombre || 'Proveedor'}
                        </h3>
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                      plan.estado === 'RECIBIDO' 
                        ? 'bg-verde-pastel/35 text-emerald-900 border-emerald-200' 
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                      {plan.estado}
                    </span>
                  </div>

                  {/* Fechas */}
                  <div className="flex flex-wrap gap-2 mb-4 text-xs text-slate-600 font-semibold">
                    <span className="inline-flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/70">
                      <FaCalendarAlt className="text-slate-400 shrink-0" size={11} /> 
                      Creado: {new Date(plan.fechaCreacion).toLocaleDateString('es-PE')}
                    </span>
                    {plan.fechaEsperada && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50/70 text-amber-800 px-2.5 py-1 rounded-lg border border-amber-200/70">
                        <FaCalendarAlt className="text-amber-500 shrink-0" size={11} /> 
                        Esperado: {new Date(plan.fechaEsperada).toLocaleDateString('es-PE')}
                      </span>
                    )}
                  </div>

                  {/* Lista de productos del pedido */}
                  <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 mb-4 space-y-2 max-h-32 overflow-y-auto pr-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {(plan.detalles || []).map((det) => (
                      <div key={det.id} className="flex justify-between text-xs sm:text-sm items-start gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-2xs">
                        <span className="text-slate-800 font-semibold line-clamp-2 leading-snug min-w-0" title={det.producto?.nombre}>
                          {det.producto?.nombre || 'Producto'}
                        </span>
                        <span className="text-slate-700 font-mono font-bold whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded text-xs shrink-0">
                          {det.cantidadRecibida > 0 ? `${det.cantidadRecibida}/` : ''}{det.cantidadEsperada} un.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pie de tarjeta con Total y Acción */}
                <div className="border-t border-slate-100 pt-4 flex justify-between items-center gap-3 mt-auto">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 font-semibold">
                      {plan.estado === 'RECIBIDO' ? 'Total Pagado' : 'Total Estimado'}
                    </p>
                    <p className="text-emerald-700 font-extrabold text-xl tracking-tight font-mono">
                      S/ {Number(plan.estado === 'RECIBIDO' ? plan.totalReal : plan.totalEsperado || 0).toFixed(2)}
                    </p>
                  </div>

                  {plan.estado === 'PENDIENTE' && (
                    <button 
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => abrirModalRecibir(plan)}
                      className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Recibir Pedido
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* PIE DE PAGINACIÓN PROGRESIVA (30 EN 30) */}
        {!isLoading && planesFiltrados.length > 0 && (
          <div className="px-5 py-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando <strong className="text-slate-800">{planesVisibles.length}</strong> de{' '}
              <strong className="text-slate-800">{planesFiltrados.length}</strong> pedido(s)
              {busquedaPlan.trim() || filtroEstado !== 'TODOS' ? ' filtrados' : ''}
            </p>

            {restantesPorCargar > 0 && (
              <button
                type="button"
                onClick={() => setLimiteVisible(prev => prev + BLOQUE_CARGA)}
                className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                <FaChevronDown size={11} />
                <span>
                  Cargar {Math.min(BLOQUE_CARGA, restantesPorCargar)} pedido{Math.min(BLOQUE_CARGA, restantesPorCargar) === 1 ? '' : 's'} más
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: CREAR PLAN DE COMPRA */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaClipboardList size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900">Nuevo Plan de Compra</h2>
                    <p className="text-xs text-slate-500 font-medium truncate">Selecciona el proveedor y agrega los productos a solicitar.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={cerrarModalCrear}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleCrearPlan} className="flex flex-col flex-1 min-h-0">
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  
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
                          className="w-full pl-10 pr-8 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm font-medium transition-all" 
                        />
                        {busquedaProv && (
                          <button
                            type="button"
                            onClick={() => {
                              setBusquedaProv('');
                              setFormData(prev => ({ ...prev, proveedorId: '' }));
                            }}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="Limpiar proveedor"
                          >
                            <FaTimes size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
                        <FaInfoCircle className="text-slate-400 shrink-0" size={11} /> Selecciona de la lista desplegable.
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
                                  <p className="text-sm font-bold text-slate-900 truncate">{p.nombre}</p>
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
                        onChange={e => setFormData({ ...formData, fechaEsperada: e.target.value })} 
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm font-medium transition-all" 
                      />
                      <p className="text-xs text-slate-500 mt-1 font-medium">Opcional. Ayuda a organizar tu calendario.</p>
                    </div>
                  </div>

                  {/* SECCIÓN 2: AGREGAR PRODUCTOS */}
                  <div className="p-4 sm:p-5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-4">
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
                          onChange={(e) => {
                            setBusquedaProd(e.target.value);
                            setItemTemp(prev => ({ ...prev, productoId: '' }));
                            setShowProdDropdown(true);
                          }}
                          onFocus={() => setShowProdDropdown(true)}
                          onBlur={() => setTimeout(() => setShowProdDropdown(false), 200)}
                          className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                        />
                        {busquedaProd && (
                          <button
                            type="button"
                            onClick={() => {
                              setBusquedaProd('');
                              setItemTemp(prev => ({ ...prev, productoId: '' }));
                            }}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                            title="Limpiar producto"
                          >
                            <FaTimes size={12} />
                          </button>
                        )}
                        <AnimatePresence>
                          {showProdDropdown && (
                            <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} 
                              className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.14)] max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {productosFiltrados.length === 0 ? (
                                <div className="p-3 text-xs text-slate-500 text-center">No se encontró producto</div>
                              ) : (
                                productosFiltrados.map(p => (
                                  <div key={p.id} onMouseDown={() => handleSelectProduct(p)} 
                                    className="px-3.5 py-2.5 hover:bg-verde-pastel/25 cursor-pointer flex justify-between items-center gap-2 transition-colors">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">{p.nombre}</p>
                                      <p className="text-xs text-slate-500 font-mono">{p.codigo}</p>
                                    </div>
                                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md text-slate-700 font-bold shrink-0">
                                      Stock: {p.stock}
                                    </span>
                                  </div>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="grid grid-cols-2 md:contents gap-2.5">
                        <div className="md:col-span-3">
                          <input 
                            type="number" 
                            placeholder="Cantidad" 
                            min="1" 
                            value={itemTemp.cantidadEsperada} 
                            onChange={e => setItemTemp({ ...itemTemp, cantidadEsperada: e.target.value })} 
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="Costo Unit. (S/)" 
                            min="0" 
                            value={itemTemp.precioCompra} 
                            onChange={e => setItemTemp({ ...itemTemp, precioCompra: e.target.value })} 
                            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/30" 
                          />
                        </div>
                      </div>

                      <div className="md:col-span-1">
                        <button 
                          type="button" 
                          onClick={agregarItemAlPlan} 
                          className="w-full h-full min-h-[42px] bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer text-sm"
                          title="Agregar producto a la lista"
                        >
                          <FaPlus />
                          <span className="md:hidden">Agregar producto</span>
                        </button>
                      </div>
                    </div>

                    {/* LISTA TEMPORAL DE ÍTEMS A PEDIR */}
                    {formData.detalles.length > 0 && (
                      <div className="mt-4 space-y-2 max-h-44 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-bold text-emerald-800">Resumen de la orden ({formData.detalles.length}):</p>
                          <p className="text-xs font-extrabold text-slate-800 font-mono">
                            Est.: S/ {totalEstimadoNuevoPlan.toFixed(2)}
                          </p>
                        </div>
                        {formData.detalles.map((det, idx) => (
                          <div key={idx} className="flex justify-between items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl text-sm border border-slate-200/80 shadow-2xs">
                            <span className="text-slate-900 font-bold line-clamp-2 leading-snug min-w-0">{det.nombre}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-700 font-mono font-semibold bg-slate-100 px-2.5 py-1 rounded-lg text-xs whitespace-nowrap">
                                {det.cantidadEsperada} × S/ {det.precioCompra.toFixed(2)}
                              </span>
                              <button 
                                type="button" 
                                onClick={() => eliminarItemTemp(idx)} 
                                className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                                title="Quitar producto"
                              >
                                <FaTrash size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={cerrarModalCrear}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || formData.detalles.length === 0}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <FaCheck size={13} /> {isSubmitting ? 'Guardando...' : 'Confirmar'}
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaTruck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900 truncate">Recepción de Mercadería</h2>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      Pedido #{receivingPlan.id} • {receivingPlan.proveedor?.nombre}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReceivingPlan(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/60 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <div className="bg-verde-pastel/20 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3">
                  <FaInfoCircle className="text-emerald-700 mt-0.5 shrink-0" size={15} />
                  <p className="text-xs sm:text-sm text-emerald-950 font-medium leading-relaxed">
                    Compara la cantidad solicitada con lo que realmente llegó. El importe final se descontará automáticamente del capital de la bodega.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {detallesRecibidos.map((item) => (
                    <div key={item.detalleId} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs gap-3 sm:gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-slate-900 text-sm font-bold line-clamp-2 leading-snug" title={item.nombre}>
                          {item.nombre}
                        </h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium flex flex-wrap items-center gap-1.5">
                          <span>Solicitado:</span>
                          <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                            {item.cantidadEsperada} un.
                          </span>
                          <span className="font-mono text-slate-600">(S/ {Number(item.precioCompra || 0).toFixed(2)} c/u)</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/80 shrink-0">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Llegaron:</span>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            min="0"
                            value={item.cantidadRecibida} 
                            onChange={(e) => actualizarCantidadRecibida(item.detalleId, e.target.value)}
                            className="w-20 py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-center text-emerald-800 font-extrabold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-verde-pastel/40 text-sm font-mono" 
                          />
                          <span className="text-xs font-bold text-slate-500">un.</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* RESUMEN DE PAGO AL PROVEEDOR CON LOGOS REALES (Responsive tablet/móvil) */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4 mt-4">
                  <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-100 pb-3">
                    <span className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider">
                      Total Real a Pagar al Proveedor:
                    </span>
                    <span className="text-2xl font-extrabold text-red-600 tracking-tight font-mono">
                      S/ {totalRealCalculado.toFixed(2)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      ¿Con qué medio de pago de la bodega se canceló este pedido?
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setMetodoPagoCompra('EFECTIVO')}
                        className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                          metodoPagoCompra === 'EFECTIVO'
                            ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogoEfectivo />
                        <span className="whitespace-nowrap">Efectivo</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setMetodoPagoCompra('YAPE_PLIN')}
                        className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                          metodoPagoCompra === 'YAPE_PLIN'
                            ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogosYapePlin />
                        <span className="whitespace-nowrap">Yape/Plin</span>
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setMetodoPagoCompra('TRANSFERENCIA')}
                        className={`py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                          metodoPagoCompra === 'TRANSFERENCIA'
                            ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <LogosBancos />
                        <span className="whitespace-nowrap">Transf.</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setReceivingPlan(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmDialog(true)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm flex items-center justify-center gap-2 order-first sm:order-none disabled:opacity-50 cursor-pointer"
                >
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
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmDialog(false)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  Revisar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={confirmarRecepcion}
                  className="flex-1 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? 'Procesando...' : 'Aceptar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}