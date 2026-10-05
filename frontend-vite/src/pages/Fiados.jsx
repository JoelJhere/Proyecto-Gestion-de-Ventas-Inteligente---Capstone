import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaSearch, FaUser, FaWhatsapp, FaMoneyBillWave, FaCalendarAlt, FaCheckCircle, FaShoppingBag, FaFileInvoiceDollar } from 'react-icons/fa';

export default function Fiados() {
  const [fiados, setFiados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [procesandoId, setProcesandoId] = useState(null);

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

  const handleLiquidar = async (id, nombreVecino) => {
    setProcesandoId(id);
    try {
      await axios.put(`/fiados/pagar/${id}`);
      toast.success(`Deuda de ${nombreVecino} liquidada con éxito.`, { icon: '💰' });
      // Quitamos el fiado de la lista visualmente sin tener que recargar toda la página
      setFiados(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al procesar el pago.');
    } finally {
      setProcesandoId(null);
    }
  };

  const fiadosFiltrados = fiados.filter(f => 
    f.cliente.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-20 lg:pb-0 font-sans min-h-[calc(100vh-6rem)]">
      
      {/* HEADER LIMPIO (ESTILO PRODUCTOS) */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        {/* Decoración sutil en la esquina */}
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
                {fiadosFiltrados.map((fiado) => (
                  <motion.div 
                    key={fiado.id}
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-verde-pastel/50 transition-all flex flex-col overflow-hidden relative"
                  >
                    {/* Borde superior verde pastel */}
                    <div className="h-1.5 w-full bg-verde-pastel"></div>
                    
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm">
                            <FaUser className="text-slate-400" /> {fiado.cliente.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1">
                            <FaCalendarAlt /> Fió el: {new Date(fiado.createdAt).toLocaleDateString('es-PE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Deuda</span>
                          <span className="text-xl font-black text-red-500 tracking-tighter">S/ {fiado.monto.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Resumen de Productos */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <p className="text-[11px] font-bold text-slate-500 mb-2 flex items-center gap-1 uppercase tracking-wider">
                          <FaShoppingBag className="text-slate-400" /> Productos Llevados
                        </p>
                        <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                          {fiado.venta.detalles.map(det => (
                            <li key={det.id} className="flex justify-between items-center bg-white px-2 py-1.5 rounded-lg border border-slate-100 shadow-sm">
                              <span className="truncate pr-2"><span className="text-slate-400 font-bold mr-1">{det.cantidad}x</span>{det.producto.nombre}</span>
                              <span className="font-mono text-slate-500 font-bold">S/{det.subtotal.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
                      <a 
                        href={`https://wa.me/51${fiado.cliente.telefono}?text=Hola ${fiado.cliente.nombre}, te saludamos de la bodega. Te escribimos para recordarte que tienes un fiado pendiente de S/ ${fiado.monto.toFixed(2)}. ¡Te esperamos pronto!`}
                        target="_blank"
                        rel="noreferrer"
                        title="Enviar Recordatorio por WhatsApp"
                        className="bg-white border border-slate-200 hover:border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 font-bold p-3 rounded-xl transition-all flex items-center justify-center shrink-0"
                      >
                        <FaWhatsapp size={20} />
                      </a>
                      
                      <button 
                        onClick={() => handleLiquidar(fiado.id, fiado.cliente.nombre)}
                        disabled={procesandoId === fiado.id}
                        className="flex-1 bg-neutral-950 hover:bg-neutral-800 text-white font-extrabold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm uppercase tracking-wide disabled:opacity-50"
                      >
                        {procesandoId === fiado.id ? 'Procesando...' : <><FaMoneyBillWave size={16} className="text-verde-pastel" /> Cobrar</>}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}