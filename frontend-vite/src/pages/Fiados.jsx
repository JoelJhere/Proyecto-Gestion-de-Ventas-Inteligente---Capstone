import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  FaSearch, FaUser, FaWhatsapp, FaMoneyBillWave, FaCalendarAlt, 
  FaCheckCircle, FaShoppingBag, FaFileInvoiceDollar, FaTimes, 
  FaBell, FaExclamationTriangle, FaTrash, FaEdit, FaChevronDown
} from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';

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

const obtenerFechaHoyLocal = () => {
  const hoy = new Date();
  return new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000).toISOString().split('T')[0];
};

export default function Fiados() {
  const BLOQUE_CARGA = 30;

  const [fiados, setFiados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);
  const [avisandoId, setAvisandoId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Candado síncrono anti-spam / doble clic
  const accionEnCursoRef = useRef(false);

  // Paginación progresiva (30 en 30)
  const [limiteVisible, setLimiteVisible] = useState(BLOQUE_CARGA);
  const [limiteDirectorio, setLimiteDirectorio] = useState(BLOQUE_CARGA);

  // Traemos el nombre del negocio configurado
  const { businessConfig } = useBusiness();

  // Estados para modales
  const [modalPlazo, setModalPlazo] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [modalCobro, setModalCobro] = useState(null);
  const [metodoPagoCobro, setMetodoPagoCobro] = useState('EFECTIVO');

  // Estados para el Directorio de Vecinos
  const [clientesDirectorio, setClientesDirectorio] = useState([]);
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');
  const [modalDirectorio, setModalDirectorio] = useState(false);
  const [nuevoVecino, setNuevoVecino] = useState({ id: null, nombre: '', telefono: '' });
  const [vecinoAEliminar, setVecinoAEliminar] = useState(null);

  const cargarFiados = async () => {
    setIsLoading(true);
    try {
      const [resFiados, resClientes] = await Promise.all([
        axios.get('/fiados'),
        axios.get('/fiados/clientes')
      ]);
      setFiados(resFiados.data);
      setClientesDirectorio(resClientes.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la lista de fiados.', { id: 'fiado-carga' });
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarFiados(); }, []);

  const handleConfirmarEliminarVecino = async () => {
    if (!vecinoAEliminar || accionEnCursoRef.current) return;
    const objetivo = vecinoAEliminar;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.delete(`/fiados/clientes/${objetivo.id}`);
      toast.success('Vecino eliminado del directorio correctamente.', { id: 'fiado-accion' });
      if (nuevoVecino.id === objetivo.id) {
        setNuevoVecino({ id: null, nombre: '', telefono: '' });
      }
      setVecinoAEliminar(null);
      cargarFiados();
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo eliminar al vecino.', { id: 'fiado-accion' });
      setVecinoAEliminar(null);
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGuardarVecino = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current) return;

    if (!nuevoVecino.nombre.trim()) {
      return toast.error('Ingresa el nombre del vecino.', { id: 'fiado-accion' });
    }
    if (!nuevoVecino.telefono || nuevoVecino.telefono.length !== 9 || !nuevoVecino.telefono.startsWith('9')) {
      return toast.error('El celular debe tener 9 dígitos y empezar con 9.', { id: 'fiado-accion' });
    }

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      if (nuevoVecino.id) {
        await axios.put(`/fiados/clientes/${nuevoVecino.id}`, nuevoVecino);
        toast.success('Datos del vecino actualizados.', { id: 'fiado-accion' });
      } else {
        await axios.post('/fiados/clientes', nuevoVecino);
        toast.success('Vecino registrado para autocompletado en ventas.', { id: 'fiado-accion' });
      }
      setNuevoVecino({ id: null, nombre: '', telefono: '' });
      cargarFiados();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar vecino.', { id: 'fiado-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const esFechaCumplida = (fechaLimite) => {
    if (!fechaLimite) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(fechaLimite);
    limite.setHours(0, 0, 0, 0);
    return limite <= hoy;
  };

  const handleLiquidar = async () => {
    if (!modalCobro || accionEnCursoRef.current) return;
    const cuentaObjetivo = modalCobro;

    accionEnCursoRef.current = true;
    setProcesandoId(cuentaObjetivo.id);
    try {
      await axios.put(`/fiados/pagar/${cuentaObjetivo.id}`, { metodoPago: metodoPagoCobro });
      toast.success(`Deuda de ${cuentaObjetivo.cliente.nombre} liquidada y sumada a caja.`, { id: 'fiado-accion' });

      setFiados(prev => prev.filter(f => f.id !== cuentaObjetivo.id));
      // Actualizamos el contador de deudas activas en el directorio local al instante
      setClientesDirectorio(prev =>
        prev.map(c =>
          c.id === cuentaObjetivo.cliente?.id && c._count?.fiados > 0
            ? { ...c, _count: { ...c._count, fiados: c._count.fiados - 1 } }
            : c
        )
      );
      setModalCobro(null);
      setMetodoPagoCobro('EFECTIVO');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar el pago.', { id: 'fiado-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setProcesandoId(null);
    }
  };

  // Envía el recordatorio por WhatsApp con el desglose de productos y actualiza la BD
  const handleWhatsApp = async (fiado) => {
    if (accionEnCursoRef.current) return;

    const telefonoRaw = fiado.cliente?.telefono || '';
    const numeroLimpio = telefonoRaw.replace(/[^0-9]/g, '');
    if (!numeroLimpio) {
      return toast.error('Este cliente no tiene un número de WhatsApp registrado.', { id: 'fiado-accion' });
    }

    accionEnCursoRef.current = true;
    setAvisandoId(fiado.id);

    const numeroFinal = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;
    const nombreLocal = businessConfig?.nombre || 'la bodega';
    const fechaRegistro = new Date(fiado.createdAt).toLocaleDateString('es-PE');

    const listaProductos = (fiado.venta?.detalles || [])
      .map(det => `- ${det.cantidad}x ${det.producto?.nombre || 'Producto'}: S/ ${Number(det.subtotal).toFixed(2)}`)
      .join('\n');

    const mensaje =
      `Hola *${fiado.cliente.nombre}*, te saludamos de *${nombreLocal}*.\n\n` +
      `Te escribimos para recordarte que tienes una cuenta pendiente del día *${fechaRegistro}*:\n\n` +
      `*DETALLE DE PRODUCTOS:*\n` +
      `${listaProductos}\n\n` +
      `*TOTAL A PAGAR: S/ ${Number(fiado.monto).toFixed(2)}*\n\n` +
      `Por favor, acércate al local para regularizarlo. ¡Gracias por tu preferencia!`;

    // 1. Abrimos WhatsApp inmediatamente para evitar bloqueos de pop-up
    window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');

    // 2. Avisamos al backend que se envió, para que sume 1 día y cuente el aviso
    try {
      await axios.put(`/fiados/avisar/${fiado.id}`);
      toast.success('Aviso registrado. Se postergó la alerta para mañana.', { id: 'fiado-accion' });

      setFiados(prev => prev.map(f => {
        if (f.id === fiado.id) {
          const manana = new Date();
          manana.setDate(manana.getDate() + 1);
          return { ...f, fechaLimite: manana.toISOString(), recordatorios: (f.recordatorios || 0) + 1 };
        }
        return f;
      }));
    } catch (error) {
      console.error('Error al registrar aviso en BD:', error);
      toast.error('Se abrió WhatsApp, pero no se pudo registrar en el sistema.', { id: 'fiado-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setAvisandoId(null);
    }
  };

  const handleActualizarFecha = async (e) => {
    e.preventDefault();
    if (!modalPlazo || accionEnCursoRef.current) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      const fechaLocalString = `${nuevaFecha}T12:00:00.000Z`;
      await axios.put(`/fiados/plazo/${modalPlazo.id}`, { nuevaFecha: fechaLocalString });
      toast.success('Día de aviso actualizado correctamente.', { id: 'fiado-accion' });
      
      setFiados(prev => prev.map(f => f.id === modalPlazo.id ? { ...f, fechaLimite: fechaLocalString } : f));
      setModalPlazo(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error al actualizar la fecha.', { id: 'fiado-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Filtros y paginación progresiva (30 en 30)
  const fiadosFiltrados = fiados.filter(f => {
    const q = busqueda.toLowerCase();
    return (
      f.cliente.nombre.toLowerCase().includes(q) ||
      (f.cliente.telefono && f.cliente.telefono.includes(q))
    );
  });
  const fiadosVisibles = fiadosFiltrados.slice(0, limiteVisible);
  const restantesFiados = fiadosFiltrados.length - fiadosVisibles.length;

  const vecinosFiltrados = clientesDirectorio.filter(v => {
    const q = busquedaDirectorio.toLowerCase();
    return (
      v.nombre.toLowerCase().includes(q) ||
      (v.telefono && v.telefono.includes(q))
    );
  });
  const vecinosVisibles = vecinosFiltrados.slice(0, limiteDirectorio);
  const restantesVecinos = vecinosFiltrados.length - vecinosVisibles.length;

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const totalDeudaGeneral = fiados.reduce((acc, f) => acc + f.monto, 0);
  const cantidadVencidosHoy = fiados.filter(f => esFechaCumplida(f.fechaLimite)).length;

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased min-h-[calc(100vh-6rem)] relative">
      
      {/* CABECERA PRINCIPAL (Responsive para Tablet y Laptop) */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Control de Fiados
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Administra las cuentas por cobrar y recordatorios de pago de tus clientes.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar vecino por nombre o celular..." 
              value={busqueda} 
              onChange={(e) => {
                setBusqueda(e.target.value);
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className="w-full pl-11 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium text-sm placeholder:text-slate-400" 
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => {
                  setBusqueda('');
                  setLimiteVisible(BLOQUE_CARGA);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <FaTimes size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setNuevoVecino({ id: null, nombre: '', telefono: '' });
              setBusquedaDirectorio('');
              setLimiteDirectorio(BLOQUE_CARGA);
              setModalDirectorio(true);
            }}
            className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
          >
            <FaUser size={13} /> Directorio de Vecinos ({clientesDirectorio.length})
          </button>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Total por Cobrar</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              S/ {totalDeudaGeneral.toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaFileInvoiceDollar size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Clientes con Crédito</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {fiados.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaUser size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Requieren Aviso Hoy</p>
            <p className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${cantidadVencidosHoy > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {cantidadVencidosHoy}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${cantidadVencidosHoy > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
            <FaBell size={20} />
          </div>
        </div>
      </div>

      {/* LISTADO DE TARJETAS DE FIADOS */}
      <div className="flex-1 flex flex-col gap-5">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/90 animate-pulse space-y-4">
                <div className="flex justify-between">
                  <div className="h-10 w-40 bg-slate-200 rounded-xl"></div>
                  <div className="h-10 w-20 bg-slate-200 rounded-xl"></div>
                </div>
                <div className="h-24 bg-slate-100 rounded-xl"></div>
                <div className="flex gap-3">
                  <div className="h-10 flex-1 bg-slate-200 rounded-xl"></div>
                  <div className="h-10 flex-1 bg-slate-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {fiadosFiltrados.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-72 flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.05)]">
                <div className="w-16 h-16 rounded-2xl bg-verde-pastel/35 text-emerald-700 flex items-center justify-center mb-4">
                  <FaCheckCircle className="text-3xl" />
                </div>
                <p className="text-lg font-bold text-slate-800">
                  {busqueda.trim() ? 'No se encontraron cuentas con ese criterio' : '¡Todas las cuentas están al día!'}
                </p>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {busqueda.trim()
                    ? 'Intenta buscar con otro nombre o número de celular.'
                    : 'No se encontraron deudas pendientes de cobro en este momento.'}
                </p>
              </motion.div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
                  {fiadosVisibles.map((fiado) => {
                    const requiereAtencion = esFechaCumplida(fiado.fechaLimite);
                    const estaCobrando = procesandoId === fiado.id;
                    const estaAvisando = avisandoId === fiado.id;

                    return (
                      <motion.div 
                        key={fiado.id}
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`bg-white rounded-2xl transition-all flex flex-col justify-between overflow-hidden border ${
                          requiereAtencion 
                            ? 'border-red-300 shadow-[0_8px_28px_rgba(239,68,68,0.10)]' 
                            : 'border-slate-200/90 shadow-[0_6px_28px_rgba(15,23,42,0.06)] hover:shadow-[0_10px_32px_rgba(15,23,42,0.10)]'
                        }`}
                      >
                        <div className="p-5 sm:p-6 flex-1 flex flex-col">
                          
                          {/* Alerta de vencimiento limpia */}
                          {requiereAtencion && (
                            <div className="mb-4 bg-red-50 border border-red-200/80 text-red-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-2">
                              <FaExclamationTriangle size={13} className="text-red-600 shrink-0" /> 
                              <span>Plazo cumplido • Enviar recordatorio</span>
                            </div>
                          )}

                          {/* Cabecera de la tarjeta: Cliente y Monto */}
                          <div className="flex justify-between items-start gap-3 mb-4">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                                requiereAtencion ? 'bg-red-50 text-red-600' : 'bg-verde-pastel/40 text-emerald-900'
                              }`}>
                                {fiado.cliente.nombre.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 leading-snug" title={fiado.cliente.nombre}>
                                  {fiado.cliente.nombre}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                  <FaCalendarAlt className="text-slate-400 shrink-0" size={11} /> 
                                  <span>{new Date(fiado.createdAt).toLocaleDateString('es-PE')}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <span className="text-[11px] font-semibold text-slate-500 block">Deuda Total</span>
                              <span className="text-xl sm:text-2xl font-extrabold text-red-600 tracking-tight font-mono">
                                S/ {Number(fiado.monto).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Etiquetas de fecha de aviso y contador de recordatorios */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <button 
                              type="button"
                              disabled={isSubmitting || Boolean(procesandoId)}
                              onClick={() => {
                                setModalPlazo(fiado);
                                const fechaBD = new Date(fiado.fechaLimite || new Date());
                                const localDateString = new Date(fechaBD.getTime() - (fechaBD.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                setNuevaFecha(localDateString);
                              }}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                                requiereAtencion 
                                  ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' 
                                  : 'text-amber-800 bg-amber-50/80 border-amber-200 hover:bg-amber-100/80'
                              }`}
                            >
                              <FaBell className={requiereAtencion ? 'text-red-500' : 'text-amber-600'} size={11} /> 
                              <span>Cobrar el: <strong>{fiado.fechaLimite ? new Date(fiado.fechaLimite).toLocaleDateString('es-PE') : 'Sin fecha'}</strong></span>
                              <span className="underline ml-1 text-[11px] opacity-80">Cambiar</span>
                            </button>

                            {fiado.recordatorios > 0 && (
                              <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/80 inline-flex items-center gap-1">
                                Avisado {fiado.recordatorios} {fiado.recordatorios === 1 ? 'vez' : 'veces'}
                              </span>
                            )}
                          </div>

                          {/* Lista de productos llevados con scroll moderno y control de nombres largos */}
                          <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 mt-auto">
                            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                              <FaShoppingBag className="text-emerald-700" size={12} /> Productos en esta cuenta
                            </p>
                            <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 font-medium max-h-32 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                              {(fiado.venta?.detalles || []).map(det => (
                                <li key={det.id} className="flex justify-between items-start gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
                                  <span className="line-clamp-2 text-slate-800 leading-snug min-w-0" title={det.producto?.nombre}>
                                    <strong className="text-emerald-800 font-bold mr-1.5">{det.cantidad}x</strong>
                                    {det.producto?.nombre || 'Producto'}
                                  </span>
                                  <span className="font-mono text-slate-900 font-bold shrink-0 whitespace-nowrap">
                                    S/ {Number(det.subtotal).toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Botones de Acción Inferiores */}
                        <div className="px-5 sm:px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex gap-2.5 sm:gap-3">
                          <button 
                            type="button"
                            disabled={estaAvisando || estaCobrando}
                            onClick={() => handleWhatsApp(fiado)}
                            className="flex-1 bg-white border border-slate-200/90 hover:border-[#25D366] text-slate-700 hover:text-[#1DA851] hover:bg-emerald-50/40 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                          >
                            <FaWhatsapp size={16} className="text-[#25D366] shrink-0" />
                            <span>{estaAvisando ? 'Registrando...' : 'Recordar'}</span>
                          </button>
                          
                          <button 
                            type="button"
                            onClick={() => {
                              if (accionEnCursoRef.current) return;
                              setMetodoPagoCobro('EFECTIVO');
                              setModalCobro(fiado);
                            }}
                            disabled={estaCobrando || estaAvisando}
                            className="flex-1 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-3 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                          >
                            {estaCobrando ? 'Procesando...' : <><FaMoneyBillWave size={14} className="shrink-0" /> Cobrar Deuda</>}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* PIE DE PAGINACIÓN PROGRESIVA (30 EN 30) */}
                <div className="px-5 py-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Mostrando <strong className="text-slate-800">{fiadosVisibles.length}</strong> de{' '}
                    <strong className="text-slate-800">{fiadosFiltrados.length}</strong> cuenta(s) pendiente(s)
                    {busqueda.trim() ? ' encontradas' : ''}
                  </p>

                  {restantesFiados > 0 && (
                    <button
                      type="button"
                      onClick={() => setLimiteVisible(prev => prev + BLOQUE_CARGA)}
                      className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
                    >
                      <FaChevronDown size={11} />
                      <span>
                        Cargar {Math.min(BLOQUE_CARGA, restantesFiados)} cuenta{Math.min(BLOQUE_CARGA, restantesFiados) === 1 ? '' : 's'} más
                      </span>
                    </button>
                  )}
                </div>
              </>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* MODAL PARA CAMBIAR FECHA DE AVISO */}
      <AnimatePresence>
        {modalPlazo && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <FaBell size={16} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Programar fecha de aviso
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setModalPlazo(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>
              
              <form onSubmit={handleActualizarFecha} className="p-6 bg-white space-y-4 overflow-y-auto">
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  El sistema activará la alerta de cobro para <strong className="text-slate-900">{modalPlazo.cliente.nombre}</strong> en la fecha que selecciones:
                </p>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nueva fecha límite
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={nuevaFecha} 
                    onChange={e => setNuevaFecha(e.target.value)}
                    min={obtenerFechaHoyLocal()} 
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-bold text-sm"
                  />
                </div>
                
                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setModalPlazo(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl transition-all shadow-2xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Fecha'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE COBRO (EFECTIVO, YAPE/PLIN, BANCOS) */}
      <AnimatePresence>
        {modalCobro && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col p-6 sm:p-7"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 bg-verde-pastel/40 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                  <FaMoneyBillWave className="text-2xl" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                    Liquidar Cuenta por Cobrar
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">
                    El importe ingresará automáticamente a la caja.
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-slate-500 block">Cliente / Vecino</span>
                  <span className="text-sm font-bold text-slate-900 line-clamp-2">{modalCobro.cliente.nombre}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-semibold text-slate-500 block">Monto a Cobrar</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono">S/ {Number(modalCobro.monto).toFixed(2)}</span>
                </div>
              </div>

              {/* SELECTOR DE MÉTODO DE PAGO CON LOGOS REALES (Responsive móvil/tablet) */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  ¿Con qué medio de pago canceló el cliente?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={procesandoId === modalCobro.id}
                    onClick={() => setMetodoPagoCobro('EFECTIVO')}
                    className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer disabled:opacity-60 ${
                      metodoPagoCobro === 'EFECTIVO'
                        ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogoEfectivo />
                    <span className="whitespace-nowrap">Efectivo</span>
                  </button>

                  <button
                    type="button"
                    disabled={procesandoId === modalCobro.id}
                    onClick={() => setMetodoPagoCobro('YAPE_PLIN')}
                    className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer disabled:opacity-60 ${
                      metodoPagoCobro === 'YAPE_PLIN'
                        ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosYapePlin />
                    <span className="whitespace-nowrap">Yape/Plin</span>
                  </button>

                  <button
                    type="button"
                    disabled={procesandoId === modalCobro.id}
                    onClick={() => setMetodoPagoCobro('TRANSFERENCIA')}
                    className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer disabled:opacity-60 ${
                      metodoPagoCobro === 'TRANSFERENCIA'
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosBancos />
                    <span className="whitespace-nowrap">Transf.</span>
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 mt-auto">
                <button 
                  type="button"
                  disabled={procesandoId === modalCobro.id}
                  onClick={() => setModalCobro(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleLiquidar}
                  disabled={procesandoId === modalCobro.id}
                  className="flex-1 py-3 px-4 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold rounded-xl transition-all shadow-xs text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {procesandoId === modalCobro.id ? 'Procesando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE DIRECTORIO DE VECINOS */}
      <AnimatePresence>
        {modalDirectorio && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaUser size={17} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-slate-900 text-base truncate">Directorio de Vecinos</h3>
                    <p className="text-xs text-slate-500 font-medium truncate">Se autocompletarán automáticamente en el Punto de Venta.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalDirectorio(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              {/* Formulario para agregar o editar vecino */}
              <form onSubmit={handleGuardarVecino} className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-200/80 space-y-3 shrink-0">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {nuevoVecino.id ? 'Editar datos del vecino seleccionado' : 'Registrar nuevo vecino'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <input
                    type="text"
                    placeholder="Nombre completo del vecino"
                    value={nuevoVecino.nombre}
                    onChange={e => setNuevoVecino({ ...nuevoVecino, nombre: e.target.value })}
                    className="sm:col-span-5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Celular (9 dígitos)"
                    value={nuevoVecino.telefono}
                    onChange={e => {
                      let num = e.target.value.replace(/\D/g, '');
                      if (num.length > 0 && !num.startsWith('9')) return;
                      setNuevoVecino({ ...nuevoVecino, telefono: num.slice(0, 9) });
                    }}
                    className="sm:col-span-4 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-semibold outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="sm:col-span-3 py-2.5 px-4 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold rounded-xl text-xs sm:text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : nuevoVecino.id ? 'Actualizar' : 'Agregar'}
                  </button>
                </div>
                {nuevoVecino.id && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setNuevoVecino({ id: null, nombre: '', telefono: '' })}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancelar edición
                  </button>
                )}
              </form>

              {/* Buscador interno del directorio */}
              {clientesDirectorio.length > 5 && (
                <div className="px-4 sm:px-5 pt-3.5 pb-1 bg-white shrink-0">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <FaSearch className="text-slate-400 text-xs" />
                    </div>
                    <input
                      type="text"
                      placeholder="Filtrar vecino registrado..."
                      value={busquedaDirectorio}
                      onChange={e => {
                        setBusquedaDirectorio(e.target.value);
                        setLimiteDirectorio(BLOQUE_CARGA);
                      }}
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium outline-none focus:border-emerald-500"
                    />
                    {busquedaDirectorio && (
                      <button
                        type="button"
                        onClick={() => {
                          setBusquedaDirectorio('');
                          setLimiteDirectorio(BLOQUE_CARGA);
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Limpiar filtro"
                      >
                        <FaTimes size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de todos los vecinos registrados (Paginada 30 en 30) */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-2.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                {vecinosFiltrados.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-8 font-medium">
                    {busquedaDirectorio.trim()
                      ? 'No se encontraron vecinos con ese filtro.'
                      : 'Aún no hay vecinos registrados en el directorio.'}
                  </p>
                ) : (
                  <>
                    {vecinosVisibles.map(vecino => {
                      const tieneDeudaPendiente = (vecino._count?.fiados || 0) > 0;
                      return (
                        <div key={vecino.id} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50/70 transition-colors gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-verde-pastel/40 text-emerald-900 font-bold text-sm flex items-center justify-center shrink-0">
                              {vecino.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="text-sm font-bold text-slate-900 truncate max-w-full" title={vecino.nombre}>
                                  {vecino.nombre}
                                </p>
                                {tieneDeudaPendiente && (
                                  <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                                    Con deuda activa
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-mono text-slate-500 flex items-center gap-1 mt-0.5">
                                <FaWhatsapp className="text-emerald-600 shrink-0" size={11} />
                                <strong className="text-emerald-700">{vecino.telefono || 'No registrado'}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => setNuevoVecino({ id: vecino.id, nombre: vecino.nombre, telefono: vecino.telefono || '' })}
                              className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                              title="Editar vecino"
                            >
                              <FaEdit size={14} />
                            </button>
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={() => {
                                if (tieneDeudaPendiente) {
                                  return toast.error(`No puedes eliminar a "${vecino.nombre}" porque tiene una deuda pendiente.`, { id: 'fiado-accion' });
                                }
                                setVecinoAEliminar(vecino);
                              }}
                              className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${
                                tieneDeudaPendiente
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-red-500 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title={tieneDeudaPendiente ? 'Tiene deuda pendiente' : 'Eliminar vecino'}
                            >
                              <FaTrash size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {restantesVecinos > 0 && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setLimiteDirectorio(prev => prev + BLOQUE_CARGA)}
                          className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
                        >
                          <FaChevronDown size={11} />
                          <span>
                            Cargar {Math.min(BLOQUE_CARGA, restantesVecinos)} vecino{Math.min(BLOQUE_CARGA, restantesVecinos) === 1 ? '' : 's'} más
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR VECINO */}
      <AnimatePresence>
        {vecinoAEliminar && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-6 text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                  <FaExclamationTriangle size={24} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  ¿Eliminar vecino del directorio?
                </h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  Se eliminará a <strong className="text-slate-900">{vecinoAEliminar.nombre}</strong> ({vecinoAEliminar.telefono}) de la lista de autocompletado.
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setVecinoAEliminar(null)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmarEliminarVecino}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-extrabold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}