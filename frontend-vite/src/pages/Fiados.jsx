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
      
      {/* HEADER BÚSQUEDA */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 bg-neutral-950 border-t-4 border-dorado flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <FaFileInvoiceDollar className="text-dorado" /> Fiados
            </h2>
            <p className="text-slate-400 text-xs mt-1">Administra las deudas pendientes de tus vecinos de confianza.</p>
          </div>
          
          <div className="relative w-full md:w-96">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar vecino..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:border-dorado focus:ring-1 focus:ring-dorado outline-none text-white transition-all shadow-inner font-medium text-sm" 
            />
          </div>
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
                <FaCheckCircle className="text-6xl mb-4 text-emerald-200" />
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
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden relative"
                  >
                    {/* Borde superior de color que indica peligro si ya pasó el tiempo (opcional a futuro) */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                    
                    <div className="p-5 flex-1">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 uppercase tracking-wide text-sm">
                            <FaUser className="text-amber-500" /> {fiado.cliente.nombre}
                          </h3>
                          <p className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1">
                            <FaCalendarAlt /> Fió el: {new Date(fiado.createdAt).toLocaleDateString('es-PE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Deuda</span>
                          <span className="text-xl font-black text-red-600 tracking-tighter">S/ {fiado.monto.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Resumen de Productos */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                        <p className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1 uppercase">
                          <FaShoppingBag /> Productos Llevados:
                        </p>
                        <ul className="text-xs text-slate-500 space-y-1 font-medium">
                          {fiado.venta.detalles.map(det => (
                            <li key={det.id} className="flex justify-between">
                              <span className="truncate pr-2">{det.cantidad}x {det.producto.nombre}</span>
                              <span className="font-mono text-slate-400">S/{det.subtotal.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
                      <a 
                        href={`https://wa.me/51${fiado.cliente.telefono}?text=Hola ${fiado.cliente.nombre}, te saludamos de la bodega. Te escribimos para recordarte que tienes un fiado pendiente de S/ ${fiado.monto.toFixed(2)}. ¡Te esperamos pronto!`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide"
                      >
                        <FaWhatsapp size={16} /> Enviar Recordatorio
                      </a>
                      
                      <button 
                        onClick={() => handleLiquidar(fiado.id, fiado.cliente.nombre)}
                        disabled={procesandoId === fiado.id}
                        className="w-full bg-gradient-to-r from-amber-500 to-[#d4af37] hover:from-amber-400 hover:to-yellow-500 text-white font-extrabold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 text-sm uppercase tracking-wide disabled:opacity-50"
                      >
                        {procesandoId === fiado.id ? 'Procesando...' : <><FaMoneyBillWave size={16} /> Liquidar (Cobrar)</>}
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