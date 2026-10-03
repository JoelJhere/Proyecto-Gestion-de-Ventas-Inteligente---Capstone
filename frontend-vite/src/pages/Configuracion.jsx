import { useState, useEffect, useRef } from 'react';
import { FaStore, FaFileInvoice, FaSave, FaBuilding, FaPercentage, FaEnvelope, FaPhone, FaReceipt, FaImage, FaUpload } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

export default function Configuracion() {
  const { setBusinessConfig } = useBusiness(); 
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // Ref para el input de archivo (oculto por diseño)
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    nombre: '', ruc: '', direccion: '', telefono: '', email: '', mensajeTicket: '', impuestoPorcentaje: 18, logo: null
  });

  const [previewLogo, setPreviewLogo] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      setIsLoadingData(true);
      try {
        const res = await axios.get('/configuracion');
        setFormData(res.data);
        if (res.data.logo) {
          setPreviewLogo(res.data.logo);
        }
      } catch (error) {
        console.error("Error al cargar configuración:", error);
        toast.error('Ocurrió un problema al cargar la configuración.');
      } finally {
        setIsLoadingData(false);
      }
    };
    cargarDatos();
  }, []);

  // Manejo de la subida de imagen y conversión a Base64 para vista previa
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('El logo no debe superar los 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result);
        setFormData({ ...formData, logo: reader.result }); // Se guarda en Base64 para enviar al backend
      };
      reader.readAsDataURL(file);
    }
  };

  // Función validadora estricta de documentos y teléfono
  const validarConfiguracion = (datos) => {
    const docRegex = /^(?:\d{8}|\d{11})$/;
    if (!docRegex.test(datos.ruc)) {
      toast.error('El documento debe tener exactamente 8 dígitos (DNI) o 11 dígitos (RUC).');
      return false;
    }

    if (datos.telefono) {
      const tel = datos.telefono;
      if (tel.startsWith('9') && tel.length !== 9) {
        toast.error('El número de celular debe tener exactamente 9 dígitos.');
        return false;
      } else if (!tel.startsWith('9') && tel.length !== 6 && tel.length !== 7 && tel.length !== 9) {
        toast.error('El teléfono fijo debe tener 6 o 7 dígitos (o 9 si incluye código de área).');
        return false;
      }
    }

    if (datos.impuestoPorcentaje < 0 || datos.impuestoPorcentaje > 100) {
      toast.error('El impuesto debe ser un valor válido entre 0 y 100.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarConfiguracion(formData)) return;

    setLoading(true);
    try {
      const res = await axios.put('/configuracion', formData);
      setBusinessConfig(res.data.config || res.data); // Actualiza globalmente el nombre y logo
      toast.success('¡Configuración actualizada con éxito!');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900 pb-20 font-sans max-w-5xl mx-auto">
      
      {/* CABECERA */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
          <FaStore className="text-verde-pastel drop-shadow-md" /> Configuración
        </h1>
        <p className="text-slate-500 text-sm font-medium">Administra los datos principales, facturación y logo de tu negocio.</p>
      </div>

      {isLoadingData ? (
        // ESQUELETO DE CARGA
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-96">
             <div className="h-6 w-1/2 bg-slate-200 rounded mb-6"></div>
             <div className="h-24 w-24 bg-slate-200 rounded-full mx-auto mb-6"></div>
             <div className="space-y-4">
               <div className="h-10 w-full bg-slate-200 rounded-xl"></div>
               <div className="h-10 w-full bg-slate-200 rounded-xl"></div>
             </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-96">
             <div className="h-6 w-1/2 bg-slate-200 rounded mb-6"></div>
             <div className="space-y-4">
               <div className="h-10 w-full bg-slate-200 rounded-xl"></div>
               <div className="h-10 w-full bg-slate-200 rounded-xl"></div>
               <div className="h-20 w-full bg-slate-200 rounded-xl"></div>
             </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TARJETA 1: PERFIL Y LOGO */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-neutral-950 px-6 py-4 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-white font-extrabold flex items-center gap-2">
                  <FaBuilding className="text-verde-pastel" /> Perfil de la Empresa
                </h2>
              </div>
              
              <div className="p-6 space-y-5 bg-slate-50 flex-1">
                
                {/* SECCIÓN DEL LOGO */}
                <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl bg-white hover:bg-slate-50 transition-colors">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current.click()}>
                    <div className="w-24 h-24 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-100 flex items-center justify-center">
                      {previewLogo ? (
                        <img src={previewLogo} alt="Logo Empresa" className="w-full h-full object-cover" />
                      ) : (
                        <FaImage className="text-slate-300 text-4xl" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <FaUpload className="text-white text-xl" />
                    </div>
                  </div>
                  <button type="button" onClick={() => fileInputRef.current.click()} className="mt-3 text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest">
                    {previewLogo ? 'Cambiar Logo' : 'Subir Logo'}
                  </button>
                  <p className="text-[10px] text-slate-400 mt-1">Formato PNG o JPG. Máximo 2MB.</p>
                  <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Nombre Comercial *</label>
                  <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-bold transition-all shadow-sm" 
                    placeholder="Ej: Bodega NOVA" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">RUC / DNI *</label>
                  {/* Filtro en tiempo real: Solo números, max 11 dígitos */}
                  <input type="text" required value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11)})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-mono transition-all shadow-sm" 
                    placeholder="Ej: 20123456789 o 76543210" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaPhone/> Teléfono</label>
                    <input type="text" value={formData.telefono || ''} onChange={e => setFormData({...formData, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-mono transition-all shadow-sm" 
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
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Dirección Fiscal / Ciudad *</label>
                  <input type="text" required value={formData.direccion || ''} onChange={e => setFormData({...formData, direccion: e.target.value})} 
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
                  <textarea rows="3" value={formData.mensajeTicket || ''} onChange={e => setFormData({...formData, mensajeTicket: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm resize-none" 
                    placeholder="Ej: ¡Gracias por su compra! Vuelva pronto." />
                </div>
              </div>
            </div>

          </div>

          {/* BOTÓN GUARDAR */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-center mt-6">
              <button type="submit" disabled={loading} 
                  className="w-full sm:w-72 bg-neutral-950 hover:bg-neutral-800 text-verde-pastel font-extrabold py-4 px-8 rounded-xl transition-all shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider text-sm">
                  <FaSave size={18} /> {loading ? 'Guardando...' : 'Guardar'}
              </button>
          </div>

        </form>
      )}
    </div>
  );
}