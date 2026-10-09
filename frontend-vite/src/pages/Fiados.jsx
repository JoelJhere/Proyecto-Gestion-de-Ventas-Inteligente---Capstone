import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaSearch, FaUser, FaWhatsapp, FaMoneyBillWave, FaCalendarAlt, FaCheckCircle, FaShoppingBag, FaFileInvoiceDollar, FaTimes, FaBell, FaExclamationTriangle } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext'; // <--- IMPORTANTE: Añadimos el contexto

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
      await axios.put(`/fiados/pagar/${modalCobro.id}`);
      toast.success(`Deuda de ${modalCobro.cliente.nombre} liquidada con éxito.`, { icon: '💰' });
      setFiados(prev => prev.filter(f => f.id !== modalCobro.id));
      setModalCobro(null);
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
      // Nota: Si usas la ruta sugerida arriba en tu backend
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

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-20 lg:pb-0 font-sans min-h-[calc(100vh-6rem)] relative">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-verde-pastel/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <FaFileInvoiceDollar className="text-verde-pastel" size={28} /> Fiados
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Administra las deudas pendientes de tus vecinos de confianza.</p>
        </div>
        
        <div className="relative w-full md:w-80 z-10">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FaSearch className="text-slate-400" />
          </div>
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={busqueda} 
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all shadow-sm font-medium text-sm" 
          />
        </div>
      </div>

      {/* LISTADO DE FIADOS */}
      <div className="flex-1 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <span className="animate-pulse text-lg font-bold">Cargando fiados pendientes...</span>
          </div>
        ) : (
          <AnimatePresence>
            {fiadosFiltrados.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-64 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <FaCheckCircle className="text-6xl mb-4 text-verde-pastel" />
                <p className="text-sm font-bold text-slate-500">¡Todo al día!</p>
                <p className="text-xs font-medium">No hay fiados pendientes de cobro.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {fiadosFiltrados.map((fiado) => {
                  const requiereAtencion = esFechaCumplida(fiado.fechaLimite);

                  return (
                    <motion.div 
                      key={fiado.id}
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`bg-white rounded-2xl transition-all flex flex-col overflow-hidden relative ${
                        requiereAtencion 
                          ? 'border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                          : 'border border-slate-200 shadow-sm hover:shadow-md hover:border-verde-pastel/50'
                      }`}
                    >
                      <div className={`h-1.5 w-full ${requiereAtencion ? 'bg-red-500' : 'bg-verde-pastel'}`}></div>
                      
                      <div className="p-5 flex-1">
                        
                        {/* Etiqueta de aviso principal */}
                        {requiereAtencion && (
                          <div className="mb-3 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-md flex items-center justify-center gap-1.5 animate-pulse text-center">
                            <FaExclamationTriangle size={12} className="shrink-0" /> 
                            ¡Requiere enviar recordatorio por WhatsApp!
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm">
                              <FaUser className="text-slate-400" /> {fiado.cliente.nombre}
                            </h3>
                            
                            <p className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                              <FaCalendarAlt /> Fió el: {new Date(fiado.createdAt).toLocaleDateString('es-PE')}
                            </p>
                            
                            {/* Insignia visual: Si ya se avisó X veces */}
                            {fiado.recordatorios > 0 && (
                              <span className="text-[9px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 mt-1.5 inline-flex items-center gap-1 uppercase tracking-wider">
                                <FaBell size={8} /> Avisado: {fiado.recordatorios} {fiado.recordatorios === 1 ? 'vez' : 'veces'}
                              </span>
                            )}

                            <button 
                              onClick={() => {
                                setModalPlazo(fiado);
                                const fechaBD = new Date(fiado.fechaLimite);
                                const localDateString = new Date(fechaBD.getTime() - (fechaBD.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                setNuevaFecha(localDateString);
                              }}
                              className={`text-[11px] font-bold mt-2 px-2 py-1 rounded-md border flex items-center gap-1 transition-colors group ${
                                requiereAtencion 
                                  ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' 
                                  : 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              <FaBell className={requiereAtencion ? 'text-red-500' : 'text-amber-500'} /> 
                              Aviso: {new Date(fiado.fechaLimite).toLocaleDateString('es-PE')}
                              <span className={`opacity-0 group-hover:opacity-100 transition-opacity ml-1 ${requiereAtencion ? 'text-red-800' : 'text-amber-700'}`}>✏️ Editar</span>
                            </button>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Deuda</span>
                            <span className="text-xl font-black text-red-500 tracking-tighter">S/ {fiado.monto.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                          <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-wider">
                            <FaShoppingBag className="text-slate-400" /> Productos Llevados
                          </p>
                          <ul className="text-xs text-slate-600 space-y-1.5 font-medium max-h-24 overflow-y-auto">
                            {fiado.venta.detalles.map(det => (
                              <li key={det.id} className="flex justify-between items-center bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                                <span className="truncate pr-2"><span className="text-slate-400 font-bold mr-1">{det.cantidad}x</span>{det.producto.nombre}</span>
                                <span className="font-mono text-slate-500 font-bold">S/{det.subtotal.toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                        <button 
                          onClick={() => handleWhatsApp(fiado)}
                          className="flex-1 bg-white border border-slate-200 hover:border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 font-extrabold py-3 px-2 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide shadow-sm"
                        >
                          Enviar <FaWhatsapp size={16} />
                        </button>
                        
                        <button 
                          onClick={() => setModalCobro(fiado)}
                          disabled={procesandoId === fiado.id}
                          className="flex-1 bg-neutral-950 hover:bg-neutral-800 text-white font-extrabold py-3 px-2 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-xs uppercase tracking-wide disabled:opacity-50"
                        >
                          {procesandoId === fiado.id ? 'Cargando...' : <><FaMoneyBillWave size={16} className="text-verde-pastel" /> Cobrar</>}
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
          <div className="fixed inset-0 bg-neutral-950/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="bg-amber-500 p-5 flex justify-between items-center text-white">
                <h3 className="font-extrabold flex items-center gap-2">
                  <FaBell /> Cambiar día de aviso
                </h3>
                <button onClick={() => setModalPlazo(null)} className="text-white/80 hover:text-white transition-colors">
                  <FaTimes size={18} />
                </button>
              </div>
              
              <form onSubmit={handleActualizarFecha} className="p-6 bg-slate-50">
                <p className="text-sm text-slate-600 font-medium mb-4">
                  El sistema volverá a alertarte para cobrarle a <strong className="text-slate-800">{modalPlazo.cliente.nombre}</strong> en la fecha seleccionada.
                </p>
                
                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Nueva fecha límite
                  </label>
                  <input 
                    type="date" 
                    required 
                    value={nuevaFecha} 
                    onChange={e => setNuevaFecha(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-slate-800 font-bold"
                  />
                </div>
                
                <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3.5 px-4 rounded-xl transition-all shadow-md text-sm uppercase tracking-wide">
                  Guardar Cambios
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CONFIRMACIÓN DE COBRO */}
      <AnimatePresence>
        {modalCobro && (
          <div className="fixed inset-0 bg-neutral-950/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col p-8 text-center"
            >
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <FaExclamationTriangle className="text-red-500 text-3xl" />
              </div>
              
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
                ¿Liquidar deuda?
              </h3>
              <p className="text-slate-500 font-medium text-sm leading-relaxed mb-8 px-2">
                Estás a punto de marcar como <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">PAGADA</span> la deuda de <strong className="text-slate-800">S/ {modalCobro.monto.toFixed(2)}</strong> del vecino <strong className="text-slate-800">{modalCobro.cliente.nombre}</strong>. Esta acción no se puede deshacer.
              </p>
              
              <div className="flex gap-3 mt-auto">
                <button 
                  onClick={() => setModalCobro(null)}
                  className="flex-1 py-3.5 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleLiquidar}
                  disabled={procesandoId === modalCobro.id}
                  className="flex-1 py-3.5 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-all shadow-md shadow-red-500/20 text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {procesandoId === modalCobro.id ? 'Cobrando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}