import { useState, useEffect, useRef } from 'react';
import { FaStore, FaFileInvoice, FaSave, FaBuilding, FaPercentage, FaEnvelope, FaPhone, FaReceipt, FaImage, FaUpload, FaMapMarkerAlt } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

export default function Configuracion() {
  const { setBusinessConfig } = useBusiness(); 
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    razonSocial: '', nombre: '', ruc: '', direccionFiscal: '', ciudad: '', departamento: '', telefono: '', email: '', mensajeTicket: '', impuestoPorcentaje: 18, logo: null
  });

  const [previewLogo, setPreviewLogo] = useState(null);

  useEffect(() => {
    const cargarDatos = async () => {
      setIsLoadingData(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/configuracion', { headers: { Authorization: `Bearer ${token}` } });
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
        setFormData({ ...formData, logo: reader.result }); 
      };
      reader.readAsDataURL(file);
    }
  };

  const validarConfiguracion = (datos) => {
    // Validación estricta SUNAT: RUC de 11 dígitos, empieza con 10 o 20
    const rucStr = String(datos.ruc);
    if (rucStr.length !== 11) {
      toast.error('El RUC debe tener exactamente 11 dígitos.');
      return false;
    }
    if (!rucStr.startsWith('10') && !rucStr.startsWith('20')) {
      toast.error('El RUC de la empresa debe iniciar con 10 o 20.');
      return false;
    }

    if (!datos.razonSocial.trim()) {
      toast.error('La Razón Social es obligatoria para la facturación electrónica.');
      return false;
    }

    if (!datos.telefono || !datos.email) {
      toast.error('El teléfono y correo son obligatorios como datos de contacto en la factura.');
      return false;
    }

    if (!datos.departamento || !datos.ciudad || !datos.direccionFiscal) {
      toast.error('Debe completar todos los datos de ubicación (Departamento, Ciudad y Dirección).');
      return false;
    }

    if (datos.impuestoPorcentaje < 0 || datos.impuestoPorcentaje > 100) {
      toast.error('El impuesto IGV debe ser un valor válido.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validarConfiguracion(formData)) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.put('/configuracion', formData, { headers: { Authorization: `Bearer ${token}` } });
      setBusinessConfig(res.data.config || res.data); 
      toast.success('¡Configuración actualizada y lista para SUNAT!', { icon: '🏛️' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-slate-900 pb-20 font-sans max-w-6xl mx-auto">
      
      {/* CABECERA */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
          <FaStore className="text-verde-pastel drop-shadow-md" /> Configuración
        </h1>
        <p className="text-slate-500 text-sm font-medium">Administra la identidad legal y los datos de facturación exigidos por SUNAT.</p>
      </div>

      {isLoadingData ? (
        // ESQUELETO DE CARGA
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-96"></div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm h-96"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* TARJETA 1: IDENTIDAD LEGAL Y CONTACTO */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-neutral-950 px-6 py-4 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-white font-extrabold flex items-center gap-2">
                  <FaBuilding className="text-verde-pastel" /> Identidad Legal y Contacto
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
                  <p className="text-[10px] text-slate-400 mt-1 text-center">Aparecerá en la cabecera de tus comprobantes.<br/>Formato PNG o JPG. Máximo 2MB.</p>
                  <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">RUC de la Empresa (11 dígitos) *</label>
                  <input type="text" required value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11)})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-mono transition-all shadow-sm" 
                    placeholder="Ej: 20123456789" />
                  <p className="text-[10px] text-amber-600 font-bold mt-1">Obligatorio. Debe iniciar con 10 o 20 para emitir facturas.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Razón Social (Nombre Legal) *</label>
                  <input type="text" required value={formData.razonSocial} onChange={e => setFormData({...formData, razonSocial: e.target.value.toUpperCase()})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-bold transition-all shadow-sm" 
                    placeholder="Ej: BODEGA NOVA S.A.C." />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Nombre Comercial (Para el público) *</label>
                  <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                    placeholder="Ej: Bodega NOVA" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-200">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaPhone/> Teléfono *</label>
                    <input type="text" required value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-mono transition-all shadow-sm" 
                      placeholder="Celular o Fijo" />
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaEnvelope/> Correo *</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                      placeholder="correo@empresa.com" />
                  </div>
                </div>
              </div>
            </div>

            {/* TARJETA 2: UBICACIÓN Y FACTURACIÓN */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="bg-neutral-950 px-6 py-4 border-t-4 border-emerald-500 shrink-0">
                <h2 className="text-white font-extrabold flex items-center gap-2">
                  <FaFileInvoice className="text-emerald-400" /> Ubicación y Emisión
                </h2>
              </div>
              
              <div className="p-6 space-y-5 bg-slate-50 flex-1">
                
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-2">
                  <p className="text-xs text-blue-800 font-medium flex items-start gap-2">
                    <FaMapMarkerAlt className="mt-0.5 shrink-0" />
                    La dirección fiscal debe coincidir exactamente con la registrada en su Ficha RUC de SUNAT para evitar rechazos en sus facturas.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Departamento *</label>
                    <input type="text" required value={formData.departamento} onChange={e => setFormData({...formData, departamento: e.target.value})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                      placeholder="Ej: Cajamarca" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Ciudad / Provincia *</label>
                    <input type="text" required value={formData.ciudad} onChange={e => setFormData({...formData, ciudad: e.target.value})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                      placeholder="Ej: Cajamarca" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Dirección Fiscal Exacta *</label>
                  <input type="text" required value={formData.direccionFiscal} onChange={e => setFormData({...formData, direccionFiscal: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm" 
                    placeholder="Ej: Jr. Los Pinos 123 - Urb. El Bosque" />
                </div>

                <div className="pt-4 border-t border-slate-200 mt-2">
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaPercentage/> Impuesto (IGV) % *</label>
                  <input type="number" step="0.1" required value={formData.impuestoPorcentaje} onChange={e => setFormData({...formData, impuestoPorcentaje: e.target.value})} 
                    className="w-full md:w-1/2 p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-700 font-extrabold transition-all shadow-sm" 
                    placeholder="18" />
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Porcentaje aplicado por defecto a los productos.</p>
                </div>

                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"><FaReceipt/> Leyenda final del Comprobante</label>
                  <textarea rows="3" value={formData.mensajeTicket || ''} onChange={e => setFormData({...formData, mensajeTicket: e.target.value})} 
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-medium transition-all shadow-sm resize-none" 
                    placeholder="Ej: ¡Gracias por su compra! Revise sus productos antes de retirarse." />
                </div>
              </div>
            </div>
          </div>

          {/* CAMPOS PARA NUBEFACT */}
                <div className="pt-4 border-t border-slate-200 mt-2 space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <p className="text-xs text-indigo-800 font-bold mb-1">Integración SUNAT (Nubefact API)</p>
                    <p className="text-[10px] text-indigo-600">Pegue aquí sus credenciales de integración para habilitar la facturación electrónica automática.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Ruta (URL) API *</label>
                    <input type="text" value={formData.nubefactRuta || ''} onChange={e => setFormData({...formData, nubefactRuta: e.target.value})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-800 text-xs transition-all shadow-sm font-mono" 
                      placeholder="https://api.nubefact.com/api/v1/..." />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Token de Seguridad *</label>
                    <input type="password" value={formData.nubefactToken || ''} onChange={e => setFormData({...formData, nubefactToken: e.target.value})} 
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none text-slate-800 text-xs transition-all shadow-sm font-mono" 
                      placeholder="••••••••••••••••••••••••••••••" />
                  </div>
                </div>

          {/* BOTÓN GUARDAR */}
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex justify-center mt-6">
              <button type="submit" disabled={loading} 
                  className="w-full sm:w-80 bg-neutral-950 hover:bg-neutral-800 text-verde-pastel font-extrabold py-4 px-8 rounded-xl transition-all shadow-[0_4px_15px_rgba(0,0,0,0.1)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed uppercase tracking-wider text-sm">
                  <FaSave size={18} /> {loading ? 'Guardando...' : 'Guardar'}
              </button>
          </div>

        </form>
      )}
    </div>
  );
}