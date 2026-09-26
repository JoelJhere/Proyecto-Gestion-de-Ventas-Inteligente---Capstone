import { useState, useEffect } from 'react';
import { FaStore, FaFileInvoice, FaSave, FaBuilding, FaPercentage, FaEnvelope, FaPhone, FaReceipt } from 'react-icons/fa';
import axios from 'axios';
import { useBusiness } from '../context/BusinessContext';

export default function Configuracion() {
  const { setBusinessConfig } = useBusiness(); // Traemos la función para actualizar toda la app
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '', ruc: '', direccion: '', telefono: '', email: '', mensajeTicket: '', impuestoPorcentaje: 18
  });

  const API_URL = `http://${window.location.hostname}:4000/api/configuracion`;

  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
        setFormData(res.data);
      } catch (error) {
        console.error("Error al cargar configuración:", error);
      }
    };
    cargarDatos();
  }, [API_URL]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put(API_URL, formData, { headers: { Authorization: `Bearer ${token}` } });
      
      // Magia pura: Actualizamos el estado global, lo que cambiará el nombre en toda la app sin recargar
      setBusinessConfig(res.data.config); 
      
      alert('¡Configuración actualizada con éxito!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error al actualizar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900 pb-20 font-sans max-w-5xl mx-auto">
      
      {/* CABECERA */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
          <FaStore className="text-verde-pastel drop-shadow-md" /> Configuración del Negocio
        </h1>
        <p className="text-slate-500 text-sm font-medium">Administra los datos principales, facturación y preferencias de tu punto de venta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* TARJETA 1: DATOS PRINCIPALES */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-neutral-950 px-6 py-4 border-t-4 border-verde-pastel shrink-0">
              <h2 className="text-white font-extrabold flex items-center gap-2">
                <FaBuilding className="text-verde-pastel" /> Perfil de la Empresa
              </h2>
            </div>
            
            <div className="p-6 space-y-5 bg-slate-50 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Nombre Comercial *</label>
                <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} 
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-bold transition-all shadow-sm" 
                  placeholder="Ej: Bodega NOVA" />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">RUC *</label>
                <input type="text" required value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value})} 
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                  placeholder="Ej: 20123456789" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaPhone/> Teléfono</label>
                  <input type="text" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                    placeholder="Opcional" />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaEnvelope/> Correo</label>
                  <input type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                    placeholder="Opcional" />
                </div>
              </div>
            </div>
          </div>

          {/* TARJETA 2: FACTURACIÓN Y TICKETS */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-neutral-950 px-6 py-4 border-t-4 border-emerald-500 shrink-0">
              <h2 className="text-white font-extrabold flex items-center gap-2">
                <FaFileInvoice className="text-emerald-400" /> Facturación y Comprobantes
              </h2>
            </div>
            
            <div className="p-6 space-y-5 bg-slate-50 flex-1">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Dirección Fiscal / Cuidad</label>
                <input type="text" value={formData.direccion || ''} onChange={e => setFormData({...formData, direccion: e.target.value})} 
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                  placeholder="Ej: Av. Principal 123, Cajamarca" />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaPercentage/> Impuesto (IGV) % *</label>
                <input type="number" step="0.1" required value={formData.impuestoPorcentaje} onChange={e => setFormData({...formData, impuestoPorcentaje: e.target.value})} 
                  className="w-full md:w-1/2 p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-700 font-extrabold transition-all shadow-sm" 
                  placeholder="18" />
              </div>

              <div>
                <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaReceipt/> Mensaje al final del Ticket</label>
                <textarea rows="2" value={formData.mensajeTicket || ''} onChange={e => setFormData({...formData, mensajeTicket: e.target.value})} 
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm resize-none" 
                  placeholder="Ej: ¡Gracias por su compra! Vuelva pronto." />
              </div>
            </div>
          </div>

        </div>

        {/* BOTÓN GUARDAR (PANEL INFERIOR FLOTANTE) */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-center mt-6">
            <button type="submit" disabled={loading} 
                className="w-full sm:w-72 bg-neutral-950 hover:bg-neutral-800 text-verde-pastel font-extrabold py-3.5 px-8 rounded-xl transition-all shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider text-sm">
                <FaSave size={18} /> {loading ? 'Guardando...' : 'Guardar Configuración'}
            </button>
        </div>

      </form>
    </div>
  );
}