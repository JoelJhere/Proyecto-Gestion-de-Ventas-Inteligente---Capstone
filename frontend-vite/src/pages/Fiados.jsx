import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  FaSearch, FaUser, FaWhatsapp, FaMoneyBillWave, FaCalendarAlt, 
  FaCheckCircle, FaShoppingBag, FaFileInvoiceDollar, FaTimes, 
  FaBell, FaExclamationTriangle 
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

export default function Fiados() {
  const [fiados, setFiados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

  // Traemos el nombre del negocio configurado
  const { businessConfig } = useBusiness();

  // Estados para modales
  const [modalPlazo, setModalPlazo] = useState(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [modalCobro, setModalCobro] = useState(null);
  const [metodoPagoCobro, setMetodoPagoCobro] = useState('EFECTIVO');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    cargarFiados();
  }, []);

  const cargarFiados = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/fiados');
      setFiados(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar la lista de fiados.');
    } finally {
      setIsLoading(false);
    }
  };

  const esFechaCumplida = (fechaLimite) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const limite = new Date(fechaLimite);
    limite.setHours(0, 0, 0, 0);
    return limite <= hoy; 
  };

  const handleLiquidar = async () => {
    if (!modalCobro) return;
    
    setProcesandoId(modalCobro.id);
    try {
      await axios.put(`/fiados/pagar/${modalCobro.id}`, { metodoPago: metodoPagoCobro });
      toast.success(`Deuda de ${modalCobro.cliente.nombre} liquidada y sumada a caja.`, { icon: '💰' });
      setFiados(prev => prev.filter(f => f.id !== modalCobro.id));
      setModalCobro(null);
      setMetodoPagoCobro('EFECTIVO');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setProcesandoId(null);
    }
  };

  // Función MEJORADA: Envía el WhatsApp dinámico y actualiza la BD
  const handleWhatsApp = async (fiado) => {
    const numeroLimpio = fiado.cliente.telefono.replace(/[^0-9]/g, '');
    const numeroFinal = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;
    const nombreLocal = businessConfig?.nombre || 'la bodega';
    
    const mensaje = `Hola ${fiado.cliente.nombre},\nTe saludamos de *${nombreLocal}*.\n\nTe escribimos para recordarte que tienes una cuenta pendiente por S/ ${fiado.monto.toFixed(2)}.\n\nPor favor, acércate para regularizarlo. Gracias por tu preferencia.`;
    
    // 1. Abrimos WhatsApp inmediatamente para evitar bloqueos de pop-up
    window.open(`https://wa.me/${numeroFinal}?text=${encodeURIComponent(mensaje)}`, '_blank');

    // 2. Avisamos al backend que se envió, para que sume 1 día y cuente el aviso
    try {
      await axios.put(`/fiados/avisar/${fiado.id}`);
      
      toast.success('Aviso registrado. Se postergó la alerta para mañana.', { icon: '📅' });
      
      // 3. Actualizamos la pantalla al instante (sin recargar)
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
      toast.error('Se abrió WhatsApp, pero no se pudo registrar en el sistema.');
    }
  };

  const handleActualizarFecha = async (e) => {
    e.preventDefault();
    try {
      const fechaLocalString = `${nuevaFecha}T12:00:00.000Z`;

      await axios.put(`/fiados/plazo/${modalPlazo.id}`, { nuevaFecha: fechaLocalString });
      toast.success('Día de aviso actualizado correctamente', { icon: '📅' });
      
      setFiados(prev => prev.map(f => f.id === modalPlazo.id ? { ...f, fechaLimite: fechaLocalString } : f));
      setModalPlazo(null);
    } catch (error) {
      console.error(error);
      toast.error('Error al actualizar la fecha.');
    }
  };

  const fiadosFiltrados = fiados.filter(f => 
    f.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const totalDeudaGeneral = fiados.reduce((acc, f) => acc + f.monto, 0);
  const cantidadVencidosHoy = fiados.filter(f => esFechaCumplida(f.fechaLimite)).length;

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-20 lg:pb-4 font-sans antialiased min-h-[calc(100vh-6rem)] relative">
      
      {/* CABECERA PRINCIPAL (Jerarquía limpia estilo Figma) */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Control de Fiados y Créditos
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Administra las cuentas por cobrar y recordatorios de pago de tus clientes.
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FaSearch className="text-slate-400 text-sm" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar vecino o cliente por nombre..." 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium text-sm placeholder:text-slate-400" 
          />
        </div>
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS (Inspiradas en el Panel de Control de Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Total por Cobrar</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              S/ {totalDeudaGeneral.toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaFileInvoiceDollar size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Clientes con Crédito</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {fiados.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaUser size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Requieren Aviso Hoy</p>
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
      <div className="flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.05)] text-slate-500">
            <span className="animate-pulse text-base font-bold">Cargando cuentas por cobrar...</span>
          </div>
        ) : (
          <AnimatePresence>
            {fiadosFiltrados.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-72 flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.05)]">
                <div className="w-16 h-16 rounded-2xl bg-verde-pastel/35 text-emerald-700 flex items-center justify-center mb-4">
                  <FaCheckCircle className="text-3xl" />
                </div>
                <p className="text-lg font-bold text-slate-800">¡Todas las cuentas están al día!</p>
                <p className="text-sm text-slate-500 font-medium mt-1">No se encontraron deudas pendientes de cobro en este momento.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {fiadosFiltrados.map((fiado) => {
                  const requiereAtencion = esFechaCumplida(fiado.fechaLimite);

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
                      <div className="p-6 flex-1 flex flex-col">
                        
                        {/* Alerta de vencimiento limpia */}
                        {requiereAtencion && (
                          <div className="mb-4 bg-red-50 border border-red-200/80 text-red-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center gap-2">
                            <FaExclamationTriangle size={13} className="text-red-600 shrink-0" /> 
                            <span>Plazo cumplido • Enviar recordatorio</span>
                          </div>
                        )}

                        {/* Cabecera de la tarjeta: Cliente y Monto */}
                        <div className="flex justify-between items-start gap-3 mb-4">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 ${
                              requiereAtencion ? 'bg-red-50 text-red-600' : 'bg-verde-pastel/40 text-emerald-900'
                            }`}>
                              {fiado.cliente.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-bold text-slate-900 text-base truncate" title={fiado.cliente.nombre}>
                                {fiado.cliente.nombre}
                              </h3>
                              <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                <FaCalendarAlt className="text-slate-400" size={11} /> 
                                Registrado: {new Date(fiado.createdAt).toLocaleDateString('es-PE')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold text-slate-500 block">Deuda Total</span>
                            <span className="text-2xl font-extrabold text-red-600 tracking-tight">
                              S/ {fiado.monto.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Etiquetas de fecha de aviso y contador de recordatorios */}
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                          <button 
                            type="button"
                            onClick={() => {
                              setModalPlazo(fiado);
                              const fechaBD = new Date(fiado.fechaLimite);
                              const localDateString = new Date(fechaBD.getTime() - (fechaBD.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                              setNuevaFecha(localDateString);
                            }}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                              requiereAtencion 
                                ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' 
                                : 'text-amber-800 bg-amber-50/80 border-amber-200 hover:bg-amber-100/80'
                            }`}
                          >
                            <FaBell className={requiereAtencion ? 'text-red-500' : 'text-amber-600'} size={11} /> 
                            <span>Cobrar el: <strong>{new Date(fiado.fechaLimite).toLocaleDateString('es-PE')}</strong></span>
                            <span className="underline ml-1 text-[11px] opacity-80">Cambiar</span>
                          </button>

                          {fiado.recordatorios > 0 && (
                            <span className="text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/80 inline-flex items-center gap-1">
                              Avisado {fiado.recordatorios} {fiado.recordatorios === 1 ? 'vez' : 'veces'}
                            </span>
                          )}
                        </div>

                        {/* Lista de productos llevados con scroll moderno */}
                        <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/70 mt-auto">
                          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                            <FaShoppingBag className="text-emerald-700" size={12} /> Productos en esta cuenta
                          </p>
                          <ul className="text-xs sm:text-sm text-slate-700 space-y-1.5 font-medium max-h-28 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                            {fiado.venta.detalles.map(det => (
                              <li key={det.id} className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-slate-200/60 shadow-2xs">
                                <span className="truncate pr-2 text-slate-800">
                                  <strong className="text-emerald-800 font-bold mr-1.5">{det.cantidad}x</strong>
                                  {det.producto.nombre}
                                </span>
                                <span className="font-mono text-slate-900 font-bold shrink-0">
                                  S/ {det.subtotal.toFixed(2)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Botones de Acción Inferiores */}
                      <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex gap-3">
                        <button 
                          type="button"
                          onClick={() => handleWhatsApp(fiado)}
                          className="flex-1 bg-white border border-slate-200/90 hover:border-[#25D366] text-slate-700 hover:text-[#1DA851] hover:bg-emerald-50/40 font-bold py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-2xs cursor-pointer"
                        >
                          <FaWhatsapp size={17} className="text-[#25D366]" /> Recordar
                        </button>
                        
                        <button 
                          type="button"
                          onClick={() => {
                            setMetodoPagoCobro('EFECTIVO');
                            setModalCobro(fiado);
                          }}
                          disabled={procesandoId === fiado.id}
                          className="flex-1 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-3 rounded-xl transition-all shadow-2xs flex items-center justify-center gap-2 text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
                        >
                          {procesandoId === fiado.id ? 'Cargando...' : <><FaMoneyBillWave size={15} /> Cobrar Deuda</>}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
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
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <FaBell size={16} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Programar fecha de aviso
                  </h3>
                </div>
                <button onClick={() => setModalPlazo(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <FaTimes size={18} />
                </button>
              </div>
              
              <form onSubmit={handleActualizarFecha} className="p-6 bg-white space-y-4">
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
                    min={new Date().toISOString().split('T')[0]} 
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-bold text-sm"
                  />
                </div>
                
                <div className="flex gap-2.5 pt-2">
                  <button 
                    type="button"
                    onClick={() => setModalPlazo(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl transition-all shadow-2xs text-sm cursor-pointer"
                  >
                    Guardar Fecha
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE COBRO CON LOGOS REALES (EFECTIVO, YAPE/PLIN, BANCOS) */}
      <AnimatePresence>
        {modalCobro && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 flex flex-col p-6 sm:p-7"
            >
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 bg-verde-pastel/40 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                  <FaMoneyBillWave className="text-2xl" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    Liquidar Cuenta por Cobrar
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    El importe ingresará automáticamente a la caja.
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 flex justify-between items-center">
                <div>
                  <span className="text-xs font-semibold text-slate-500 block">Cliente / Vecino</span>
                  <span className="text-sm font-bold text-slate-900">{modalCobro.cliente.nombre}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">Monto a Cobrar</span>
                  <span className="text-xl font-extrabold text-emerald-700">S/ {modalCobro.monto.toFixed(2)}</span>
                </div>
              </div>

              {/* SELECTOR DE MÉTODO DE PAGO CON LOGOS REALES */}
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  ¿Con qué medio de pago canceló el cliente?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setMetodoPagoCobro('EFECTIVO')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPagoCobro === 'EFECTIVO'
                        ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogoEfectivo />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPagoCobro('YAPE_PLIN')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPagoCobro === 'YAPE_PLIN'
                        ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosYapePlin />
                    <span>Yape/Plin</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMetodoPagoCobro('TRANSFERENCIA')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      metodoPagoCobro === 'TRANSFERENCIA'
                        ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <LogosBancos />
                    <span>Transf.</span>
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3 mt-auto">
                <button 
                  type="button"
                  onClick={() => setModalCobro(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={handleLiquidar}
                  disabled={procesandoId === modalCobro.id}
                  className="flex-1 py-3 px-4 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold rounded-xl transition-all shadow-xs text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {procesandoId === modalCobro.id ? 'Registrando...' : 'Confirmar Cobro'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}