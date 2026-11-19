import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaTimes, FaSearch, 
  FaTruck, FaIdCard, FaPhoneAlt, FaChevronDown 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Proveedores() {
  const BLOQUE_CARGA = 30;

  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [limiteVisible, setLimiteVisible] = useState(BLOQUE_CARGA);

  // Candado anti-spam / doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accionEnCursoRef = useRef(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', ruc: '', telefono: '' });

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const cargarProveedores = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/proveedores');
      setProveedores(res.data);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Ocurrió un problema al cargar los proveedores.', { id: 'prov-carga' });
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarProveedores(); }, []);

  // Validador de RUC/DNI y formato de teléfono peruano (fijos y móviles)
  const validarFormulario = (datos) => {
    if (!datos.nombre || !datos.nombre.trim()) {
      toast.error('Ingresa el nombre o razón social del proveedor.', { id: 'prov-accion' });
      return false;
    }

    const docRegex = /^(?:\d{8}|\d{11})$/;
    if (!docRegex.test(datos.ruc || '')) {
      toast.error('El documento debe tener exactamente 8 dígitos (DNI) o 11 dígitos (RUC).', { id: 'prov-accion' });
      return false;
    }

    if (datos.telefono) {
      const tel = datos.telefono;
      if (tel.startsWith('9')) {
        if (tel.length !== 9) {
          toast.error('El número de celular debe tener exactamente 9 dígitos.', { id: 'prov-accion' });
          return false;
        }
      } else {
        if (tel.length !== 6 && tel.length !== 7 && tel.length !== 9) {
          toast.error('El teléfono fijo debe tener 6 o 7 dígitos (o 9 si incluye el código de área).', { id: 'prov-accion' });
          return false;
        }
      }
    }

    return true;
  };

  const abrirModalCrear = () => {
    setFormData({ nombre: '', ruc: '', telefono: '' });
    setIsCreateModalOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current) return;
    if (!validarFormulario(formData)) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.post('/proveedores', formData);
      toast.success('Proveedor registrado correctamente.', { id: 'prov-accion' });
      setIsCreateModalOpen(false);
      setFormData({ nombre: '', ruc: '', telefono: '' });
      cargarProveedores();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al guardar el proveedor.', { id: 'prov-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current || !editingProveedor) return;
    if (!validarFormulario(editingProveedor)) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.put(`/proveedores/${editingProveedor.id}`, editingProveedor);
      toast.success('Proveedor actualizado correctamente.', { id: 'prov-accion' });
      setEditingProveedor(null);
      cargarProveedores();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al actualizar el proveedor.', { id: 'prov-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const proveedoresFiltrados = proveedores.filter(prov => {
    const q = busqueda.toLowerCase();
    return (
      prov.nombre.toLowerCase().includes(q) ||
      (prov.ruc && prov.ruc.includes(busqueda)) ||
      (prov.telefono && prov.telefono.includes(busqueda))
    );
  });

  const proveedoresVisibles = proveedoresFiltrados.slice(0, limiteVisible);
  const restantesPorCargar = proveedoresFiltrados.length - proveedoresVisibles.length;

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const empresasConRuc = proveedores.filter(p => p.ruc && p.ruc.length === 11).length;
  const conTelefono = proveedores.filter(p => p.telefono && p.telefono.trim() !== '').length;

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL (Responsive para Tablet y Laptop) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Proveedores
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Gestiona las distribuidoras y contactos comerciales que abastecen tu bodega.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por empresa, RUC o teléfono..." 
              value={busqueda} 
              onChange={(e) => {
                setBusqueda(e.target.value);
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className="w-full pl-11 pr-9 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400" 
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
          {isAdmin && (
            <button 
              type="button"
              onClick={abrirModalCrear} 
              className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
            >
              <FaPlus size={13} /> Nuevo Proveedor
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Total de Proveedores</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {proveedores.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaTruck size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Empresas con RUC</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {empresasConRuc}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaIdCard size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Con Teléfono Activo</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {conTelefono}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FaPhoneAlt size={19} />
          </div>
        </div>
      </div>
      
      {/* LISTADO RESPONSIVE: TARJETAS EN CELULAR + TABLA CONTROLADA EN TABLET/PC */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        
        {/* VISTA MÓVIL (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2.5">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            ))
          ) : proveedoresFiltrados.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-medium text-sm">
              {busqueda ? 'No se encontraron proveedores con ese criterio.' : 'Aún no hay proveedores registrados en el sistema.'}
            </div>
          ) : (
            proveedoresVisibles.map((prov) => (
              <div key={prov.id} className="p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-verde-pastel/40 text-emerald-900 font-bold text-sm flex items-center justify-center shrink-0">
                      {prov.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={prov.nombre}>
                        {prov.nombre}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        {prov.ruc ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-600">
                            <span className="text-[10px] font-sans font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                              {prov.ruc.length === 11 ? 'RUC' : 'DNI'}
                            </span>
                            {prov.ruc}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Sin documento</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isAdmin && (
                    <button 
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setEditingProveedor({ ...prov })} 
                      className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors shrink-0 disabled:opacity-40 cursor-pointer" 
                      title="Editar Proveedor"
                    >
                      <FaEdit size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-100">
                  <span className="text-slate-500 font-semibold">Teléfono de contacto</span>
                  {prov.telefono ? (
                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-800">
                      <FaPhoneAlt size={10} className="text-emerald-600" /> {prov.telefono}
                    </span>
                  ) : (
                    <span className="text-slate-400">Sin teléfono</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* VISTA TABLET Y ESCRITORIO (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5 whitespace-nowrap w-2/5">Empresa / Razón Social</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-1/4">Documento (RUC / DNI)</th>
                <th className="py-3.5 px-4 whitespace-nowrap w-1/4">Teléfono de Contacto</th>
                {isAdmin && <th className="py-3.5 px-5 text-center whitespace-nowrap">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    {isAdmin && (
                      <td className="py-4 px-5 flex justify-center">
                        <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                      </td>
                    )}
                  </tr>
                ))
              ) : proveedoresFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? '4' : '3'} className="p-12 text-center text-slate-500 font-medium text-sm">
                    {busqueda ? 'No se encontraron proveedores con ese criterio.' : 'Aún no hay proveedores registrados en el sistema.'}
                  </td>
                </tr>
              ) : (
                proveedoresVisibles.map((prov) => (
                  <tr key={prov.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-5 align-middle max-w-[240px] lg:max-w-[340px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-verde-pastel/40 text-emerald-900 font-bold text-sm flex items-center justify-center shrink-0">
                          {prov.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={prov.nombre}>
                          {prov.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                      {prov.ruc ? (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                            {prov.ruc.length === 11 ? 'RUC' : 'DNI'}
                          </span>
                          <span className="font-mono font-semibold text-slate-700 text-xs sm:text-sm">{prov.ruc}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">No registrado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold font-mono text-xs sm:text-sm align-middle whitespace-nowrap">
                      {prov.telefono ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/70 text-emerald-800 border border-emerald-200/60">
                          <FaPhoneAlt size={11} className="text-emerald-600" /> {prov.telefono}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-sans font-normal text-xs">Sin teléfono</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-5 align-middle text-center">
                        <button 
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setEditingProveedor({ ...prov })} 
                          className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center disabled:opacity-40" 
                          title="Editar Proveedor"
                        >
                          <FaEdit size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE PAGINACIÓN PROGRESIVA (30 EN 30) */}
        {!isLoading && proveedoresFiltrados.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando <strong className="text-slate-800">{proveedoresVisibles.length}</strong> de{' '}
              <strong className="text-slate-800">{proveedoresFiltrados.length}</strong> proveedor(es)
              {busqueda.trim() ? ' encontrados' : ''}
            </p>

            {restantesPorCargar > 0 && (
              <button
                type="button"
                onClick={() => setLimiteVisible(prev => prev + BLOQUE_CARGA)}
                className="inline-flex items-center gap-2 text-xs font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-4 py-2 rounded-xl transition-colors shadow-2xs cursor-pointer"
              >
                <FaChevronDown size={11} />
                <span>
                  Cargar {Math.min(BLOQUE_CARGA, restantesPorCargar)} proveedor{Math.min(BLOQUE_CARGA, restantesPorCargar) === 1 ? '' : 'es'} más
                </span>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* MODAL 1: NUEVO PROVEEDOR */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaTruck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900">Nuevo Proveedor</h2>
                    <p className="text-xs text-slate-500 font-medium truncate">Ingresa los datos fiscales y de contacto del distribuidor.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleCreate} noValidate className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-white">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre o Razón Social *</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.nombre} 
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="Ej: Distribuidora Gloria S.A."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">RUC (11 dígitos) o DNI (8 dígitos) *</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.ruc} 
                      onChange={e => setFormData({ ...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-semibold font-mono" 
                      placeholder="Ej: 20100152356 o 76543210"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Teléfono / Fijo / WhatsApp</label>
                    <input 
                      type="text" 
                      value={formData.telefono} 
                      onChange={e => setFormData({ ...formData, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-semibold font-mono" 
                      placeholder="Ej: 987654321 o 076123456"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* MODAL 2: EDITAR PROVEEDOR */}
      <AnimatePresence>
        {editingProveedor && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaEdit size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900">Editar Proveedor</h2>
                    <p className="text-xs text-slate-500 font-medium truncate">Modifica la razón social, RUC/DNI o teléfono de contacto.</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingProveedor(null)}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdate} noValidate className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-white">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre o Razón Social *</label>
                    <input 
                      type="text" 
                      required 
                      value={editingProveedor.nombre} 
                      onChange={e => setEditingProveedor({ ...editingProveedor, nombre: e.target.value })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">RUC (11 dígitos) o DNI (8 dígitos) *</label>
                    <input 
                      type="text" 
                      required 
                      value={editingProveedor.ruc || ''} 
                      onChange={e => setEditingProveedor({ ...editingProveedor, ruc: e.target.value.replace(/\D/g, '').slice(0, 11) })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-semibold font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Teléfono / Fijo / WhatsApp</label>
                    <input 
                      type="text" 
                      value={editingProveedor.telefono || ''} 
                      onChange={e => setEditingProveedor({ ...editingProveedor, telefono: e.target.value.replace(/\D/g, '').slice(0, 9) })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-semibold font-mono"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setEditingProveedor(null)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}