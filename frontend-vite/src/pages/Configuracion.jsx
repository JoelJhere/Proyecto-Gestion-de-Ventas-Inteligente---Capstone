import { useState, useEffect, useRef } from 'react';
import { 
  FaFileInvoice, FaSave, FaBuilding, FaPercentage, 
  FaEnvelope, FaPhone, FaReceipt, FaImage, 
  FaUpload, FaMapMarkerAlt, FaKey, FaLink 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

export default function Configuracion() {
  const { setBusinessConfig } = useBusiness(); 
  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    razonSocial: '', nombre: '', ruc: '', direccionFiscal: '', ciudad: '', departamento: '', telefono: '', email: '', mensajeTicket: '', impuestoPorcentaje: 18, logo: null,
    nubefactRuta: '', nubefactToken: ''
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

  const tieneCredencialesSunat = Boolean(formData.nubefactRuta?.trim() && formData.nubefactToken?.trim());

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-20 lg:pb-6 font-sans antialiased max-w-6xl mx-auto">
      
      {/* CABECERA PRINCIPAL (Jerarquía estilo Figma) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Configuración
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Administra la identidad legal, ubicación fiscal y parámetros de facturación electrónica SUNAT.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs sm:text-sm bg-white px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)] self-start sm:self-auto shrink-0">
          <span className={`w-2.5 h-2.5 rounded-full ${tieneCredencialesSunat ? 'bg-emerald-500 ring-4 ring-emerald-500/15' : 'bg-amber-500 ring-4 ring-amber-500/15'}`}></span>
          <span className="font-bold text-slate-800">
            {tieneCredencialesSunat ? 'Facturación SUNAT Configurada' : 'Token SUNAT Pendiente'}
          </span>
        </div>
      </div>

      {isLoadingData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] h-96"></div>
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] h-96"></div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          
          {/* FILA SUPERIOR SIMÉTRICA DE 2 COLUMNAS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            
            {/* TARJETA 1: IDENTIDAD LEGAL Y CONTACTO */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col">
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                  <FaBuilding size={18} />
                </div>
                <div>
                  <h2 className="text-slate-900 font-bold text-base sm:text-lg tracking-tight">
                    Identidad Legal y Contacto
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Datos oficiales que encabezan tus boletas y facturas.</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 bg-white flex-1 flex flex-col justify-between">
                
                {/* SECCIÓN DEL LOGO COMPACTA Y HORIZONTAL */}
                <div className="flex items-center gap-4 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
                  <div 
                    className="relative group cursor-pointer shrink-0" 
                    onClick={() => fileInputRef.current.click()}
                  >
                    <div className="w-16 h-16 rounded-2xl border-2 border-white shadow-sm overflow-hidden bg-white flex items-center justify-center">
                      {previewLogo ? (
                        <img src={previewLogo} alt="Logo Empresa" className="w-full h-full object-cover" />
                      ) : (
                        <FaImage className="text-slate-300 text-2xl" />
                      )}
                    </div>
                    <div className="absolute inset-0 bg-slate-950/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <FaUpload className="text-white text-sm" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900">Logotipo del Negocio</p>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Se mostrará en el menú lateral y comprobantes (PNG o JPG, máx. 2MB).
                    </p>
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current.click()} 
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-verde-pastel/45 hover:bg-verde-pastel px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <FaUpload size={11} /> {previewLogo ? 'Cambiar imagen' : 'Seleccionar archivo'}
                    </button>
                  </div>
                  <input type="file" accept="image/png, image/jpeg" ref={fileInputRef} onChange={handleLogoUpload} className="hidden" />
                </div>

                {/* FILA PAR: RUC + NOMBRE COMERCIAL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Número de RUC (11 dígitos) *
                    </label>
                    <input 
                      type="text" 
                      required 
                      value={formData.ruc} 
                      onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11)})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-mono font-bold text-sm transition-all" 
                      placeholder="Ej: 20123456789" 
                    />
                    <p className="text-[11px] text-amber-700 font-semibold mt-1">Debe iniciar con 10 o 20.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Nombre Comercial *
                    </label>
                    <input 
                      type="text" 
                      required 
                      value={formData.nombre} 
                      onChange={e => setFormData({...formData, nombre: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-semibold text-sm transition-all" 
                      placeholder="Ej: Bodega NOVA" 
                    />
                    <p className="text-[11px] text-slate-500 font-medium mt-1">Nombre visible en el sistema.</p>
                  </div>
                </div>

                {/* RAZÓN SOCIAL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Razón Social (Nombre Legal en SUNAT) *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.razonSocial} 
                    onChange={e => setFormData({...formData, razonSocial: e.target.value.toUpperCase()})} 
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-bold text-sm transition-all" 
                    placeholder="Ej: BODEGA NOVA S.A.C." 
                  />
                </div>

                {/* FILA PAR: TELÉFONO + CORREO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      <FaPhone className="text-emerald-600" size={11} /> Teléfono de Contacto *
                    </label>
                    <input 
                      type="text" 
                      required 
                      value={formData.telefono} 
                      onChange={e => setFormData({...formData, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-mono font-semibold text-sm transition-all" 
                      placeholder="Celular o Fijo (9 dígitos)" 
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      <FaEnvelope className="text-emerald-600" size={11} /> Correo Electrónico *
                    </label>
                    <input 
                      type="email" 
                      required 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-medium text-sm transition-all" 
                      placeholder="contacto@empresa.com" 
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* TARJETA 2: UBICACIÓN FISCAL Y PARÁMETROS DE EMISIÓN */}
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden flex flex-col">
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                  <FaFileInvoice size={18} />
                </div>
                <div>
                  <h2 className="text-slate-900 font-bold text-base sm:text-lg tracking-tight">
                    Ubicación Fiscal y Emisión
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">Dirección declarada en tu Ficha RUC e impuestos del comprobante.</p>
                </div>
              </div>
              
              <div className="p-6 space-y-4 bg-white flex-1 flex flex-col justify-between">
                
                {/* AVISO INFORMATIVO EN VERDE PASTEL */}
                <div className="bg-verde-pastel/20 border border-emerald-200/80 rounded-xl p-3.5">
                  <p className="text-xs sm:text-sm text-emerald-950 font-medium flex items-start gap-2.5 leading-relaxed">
                    <FaMapMarkerAlt className="text-emerald-700 mt-1 shrink-0" size={14} />
                    <span>
                      La dirección fiscal debe coincidir con la registrada en tu <strong>Ficha RUC de SUNAT</strong> para asegurar la validez de tus comprobantes.
                    </span>
                  </p>
                </div>

                {/* FILA PAR: DEPARTAMENTO + CIUDAD */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Departamento *
                    </label>
                    <input 
                      type="text" 
                      required 
                      value={formData.departamento} 
                      onChange={e => setFormData({...formData, departamento: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-medium text-sm transition-all" 
                      placeholder="Ej: Cajamarca" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Ciudad / Provincia *
                    </label>
                    <input 
                      type="text" 
                      required 
                      value={formData.ciudad} 
                      onChange={e => setFormData({...formData, ciudad: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-medium text-sm transition-all" 
                      placeholder="Ej: Cajamarca" 
                    />
                  </div>
                </div>

                {/* DIRECCIÓN FISCAL */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Dirección Fiscal Exacta *
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={formData.direccionFiscal} 
                    onChange={e => setFormData({...formData, direccionFiscal: e.target.value})} 
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-medium text-sm transition-all" 
                    placeholder="Ej: Jr. Los Pinos 123 - Urb. El Bosque" 
                  />
                </div>

                {/* FILA PAR: IMPUESTO IGV + LEYENDA DEL TICKET */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-2 border-t border-slate-100">
                  <div className="sm:col-span-4">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      <FaPercentage className="text-emerald-600" size={11} /> I.G.V. (%) *
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      required 
                      value={formData.impuestoPorcentaje} 
                      onChange={e => setFormData({...formData, impuestoPorcentaje: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-emerald-800 font-extrabold text-sm transition-all" 
                      placeholder="18" 
                    />
                  </div>

                  <div className="sm:col-span-8">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      <FaReceipt className="text-emerald-600" size={11} /> Leyenda al Pie del Comprobante
                    </label>
                    <input 
                      type="text" 
                      value={formData.mensajeTicket || ''} 
                      onChange={e => setFormData({...formData, mensajeTicket: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-medium text-sm transition-all" 
                      placeholder="Ej: ¡Gracias por su compra! Revise su vuelto." 
                    />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* TARJETA INFERIOR SIMÉTRICA: INTEGRACIÓN NUBEFACT API + BOTÓN GUARDAR */}
          <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FaKey size={17} />
                </div>
                <div>
                  <h2 className="text-slate-900 font-bold text-base sm:text-lg tracking-tight">
                    Credenciales de Facturación Electrónica (Nubefact / OSE SUNAT)
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Conecta la ruta API y el token de tu cuenta para emitir Boletas y Facturas electrónicas oficiales.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  <FaLink className="text-slate-400" size={11} /> Ruta (URL) de la API
                </label>
                <input 
                  type="text" 
                  value={formData.nubefactRuta || ''} 
                  onChange={e => setFormData({...formData, nubefactRuta: e.target.value})} 
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-800 text-xs sm:text-sm transition-all font-mono" 
                  placeholder="https://api.nubefact.com/api/v1/..." 
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  <FaKey className="text-slate-400" size={11} /> Token de Seguridad
                </label>
                <input 
                  type="password" 
                  value={formData.nubefactToken || ''} 
                  onChange={e => setFormData({...formData, nubefactToken: e.target.value})} 
                  className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-800 text-xs sm:text-sm transition-all font-mono" 
                  placeholder="••••••••••••••••••••••••••••••••••••" 
                />
              </div>
            </div>

            {/* PIE DE TARJETA CON EL BOTÓN DE GUARDAR */}
            <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500 font-medium">
                Los cambios se aplicarán de inmediato en todos los comprobantes y terminales de tu bodega.
              </p>
              <button 
                type="submit" 
                disabled={loading} 
                className="w-full sm:w-auto min-w-[220px] bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-3 px-6 rounded-xl transition-all shadow-2xs flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm cursor-pointer"
              >
                <FaSave size={16} /> {loading ? 'Guardando cambios...' : 'Guardar Configuración'}
              </button>
            </div>
          </div>

        </form>
      )}
    </div>
  );
}