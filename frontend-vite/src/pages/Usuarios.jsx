import { useState, useEffect, useRef } from 'react';
import { 
  FaUsers, FaPlus, FaEdit, FaCheck, FaTimes, 
  FaSearch, FaExclamationTriangle, FaUserShield,
  FaChevronDown, FaEye, FaEyeSlash
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Usuarios() {
  const BLOQUE_CARGA = 30;

  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [limiteVisible, setLimiteVisible] = useState(BLOQUE_CARGA);

  // Candado síncrono anti-spam / doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accionEnCursoRef = useRef(false);

  // Estados para los Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Usuario actual en sesión (para evitar que se suspenda a sí mismo)
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Datos del formulario
  const [formData, setFormData] = useState({ 
    id: null, 
    nombre: '', 
    email: '', 
    password: '', 
    rol: 'AYUDANTE', 
    estado: true 
  });

  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const res = await axios.get('/usuarios');
        setUsuarios(res.data);
      } catch (err) {
        console.error('Error al cargar empleados:', err);
        toast.error('Error al cargar la lista de empleados.', { id: 'user-carga' });
      } finally {
        setIsLoading(false);
      }
    };

    cargarUsuarios();
  }, []);

  const recargarTabla = async () => {
    try {
      const res = await axios.get('/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo actualizar la lista de empleados.', { id: 'user-carga' });
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const q = busqueda.toLowerCase();
    return (
      u.nombre.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.rol.toLowerCase().includes(q)
    );
  });

  const usuariosVisibles = usuariosFiltrados.slice(0, limiteVisible);
  const restantesPorCargar = usuariosFiltrados.length - usuariosVisibles.length;

  const abrirModalNuevo = () => {
    if (accionEnCursoRef.current) return;
    setModoEdicion(false);
    setMostrarPassword(false);
    setFormData({ id: null, nombre: '', email: '', password: '', rol: 'AYUDANTE', estado: true });
    setIsModalOpen(true);
  };

  const abrirModalEdicion = (usuario) => {
    if (accionEnCursoRef.current) return;
    setModoEdicion(true);
    setMostrarPassword(false);
    setFormData({ 
      id: usuario.id, 
      nombre: usuario.nombre, 
      email: usuario.email, 
      password: '', 
      rol: usuario.rol, 
      estado: usuario.estado 
    });
    setIsModalOpen(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current) return;

    const nombreLimpio = formData.nombre.trim();
    const emailLimpio = formData.email.trim().toLowerCase();
    const passwordLimpia = formData.password.trim();

    if (!nombreLimpio || !emailLimpio) {
      return toast.error('El nombre y el correo electrónico son obligatorios.', { id: 'user-accion' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      return toast.error('Ingresa un correo electrónico válido.', { id: 'user-accion' });
    }
    if (!modoEdicion && passwordLimpia.length < 6) {
      return toast.error('La contraseña inicial debe tener al menos 6 caracteres.', { id: 'user-accion' });
    }

    const payload = {
      ...formData,
      nombre: nombreLimpio,
      email: emailLimpio,
      password: passwordLimpia
    };

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      if (modoEdicion) {
        await axios.put(`/usuarios/${formData.id}`, payload);
        toast.success('Empleado actualizado correctamente.', { id: 'user-accion' });
      } else {
        await axios.post('/usuarios', payload);
        toast.success('Nuevo empleado registrado exitosamente.', { id: 'user-accion' });
      }
      setIsModalOpen(false);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al guardar.', { id: 'user-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const prepararToggleEstado = (usuario) => {
    if (accionEnCursoRef.current) return;
    if (usuario.id === currentUser.id) {
      return toast.error('No puedes suspender tu propia cuenta activa.', { id: 'user-accion' });
    }
    setConfirmDialog(usuario);
  };

  const ejecutarToggleEstado = async () => {
    if (!confirmDialog || accionEnCursoRef.current) return;
    const objetivo = confirmDialog;
    const nuevoEstado = !objetivo.estado;
    const accion = nuevoEstado ? 'reactivado' : 'suspendido';

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.put(`/usuarios/${objetivo.id}`, { 
        nombre: objetivo.nombre,
        rol: objetivo.rol,
        estado: nuevoEstado 
      });
      toast.success(`Acceso ${accion} correctamente.`, { id: 'user-accion' });
      setConfirmDialog(null);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'No se pudo cambiar el estado del usuario.', { id: 'user-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const totalAdmins = usuarios.filter(u => u.rol === 'ADMIN').length;
  const usuariosActivos = usuarios.filter(u => u.estado).length;

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL Y BUSCADOR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Usuarios
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Administra las cuentas de acceso, roles y permisos de tus cajeros y administradores.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por nombre, correo o rol..." 
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
          
          <button 
            type="button"
            onClick={abrirModalNuevo} 
            className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
          >
            <FaPlus size={13} /> Nuevo Empleado
          </button>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Total de Personal</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {usuarios.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaUsers size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Administradores</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {totalAdmins}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FaUserShield size={21} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Accesos Activos</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {usuariosActivos}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaCheck size={19} />
          </div>
        </div>
      </div>

      {/* LISTADO RESPONSIVE */}
      <div className="lg:bg-white lg:border lg:border-slate-200/90 lg:rounded-2xl lg:shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        
        {/* VISTA MÓVIL Y TABLET */}
        <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/90 animate-pulse space-y-2.5">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            ))
          ) : usuariosFiltrados.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-slate-500 font-medium text-sm">
              {busqueda ? 'No se encontraron colaboradores con ese criterio.' : 'No hay usuarios registrados.'}
            </div>
          ) : (
            usuariosVisibles.map((u) => (
              <div key={u.id} className={`p-4 space-y-3 rounded-2xl border border-slate-200/90 shadow-2xs ${u.estado ? 'bg-white' : 'opacity-60 bg-slate-50/70'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                      u.estado ? 'bg-verde-pastel/40 text-emerald-900' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={u.nombre}>
                          {u.nombre}
                        </p>
                        {u.id === currentUser.id && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-verde-pastel/50 text-emerald-950 border border-emerald-200 uppercase shrink-0">
                            Tú
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate mt-0.5" title={u.email}>
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => abrirModalEdicion(u)} 
                      className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40" 
                      title="Editar Empleado"
                    >
                      <FaEdit size={14} />
                    </button>
                    <button 
                      type="button"
                      disabled={isSubmitting || u.id === currentUser.id}
                      onClick={() => prepararToggleEstado(u)} 
                      className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                        u.estado 
                          ? 'text-red-500 hover:text-red-700 hover:bg-red-50' 
                          : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                      }`} 
                      title={u.id === currentUser.id ? 'Tu cuenta activa' : u.estado ? 'Suspender acceso' : 'Reactivar acceso'}
                    >
                      {u.estado ? <FaTimes size={14} /> : <FaCheck size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-100">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    u.rol === 'ADMIN' 
                      ? 'bg-amber-50 text-amber-800 border-amber-200' 
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}>
                    {u.rol}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    u.estado 
                      ? 'bg-verde-pastel/35 text-emerald-900 border-emerald-200' 
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {u.estado ? 'Permitido' : 'Suspendido'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* VISTA ESCRITORIO */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[680px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5 whitespace-nowrap">Colaborador / Nombre</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Correo Electrónico (Login)</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Nivel de Rol</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Estado de Acceso</th>
                <th className="py-3.5 px-5 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                [...Array(4)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="py-4 px-4"><div className="h-6 bg-slate-200 rounded-full w-20 mx-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div></td>
                    <td className="py-4 px-5 flex justify-center gap-2">
                      <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                      <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                    </td>
                  </tr>
                ))
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500 font-medium text-sm">
                    {busqueda ? 'No se encontraron colaboradores con ese criterio.' : 'No hay usuarios registrados.'}
                  </td>
                </tr>
              ) : (
                usuariosVisibles.map((u) => (
                  <tr key={u.id} className={`transition-colors ${u.estado ? 'hover:bg-slate-50/80' : 'opacity-55 bg-slate-50/60'}`}>
                    
                    <td className="py-3.5 px-5 align-middle max-w-[220px] lg:max-w-[280px]">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                          u.estado ? 'bg-verde-pastel/40 text-emerald-900' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={u.nombre}>
                            {u.nombre}
                          </span>
                          {u.id === currentUser.id && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-verde-pastel/50 text-emerald-950 border border-emerald-200 uppercase shrink-0">
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono font-medium align-middle text-xs sm:text-sm max-w-[220px]">
                      <span className="block truncate" title={u.email}>{u.email}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        u.rol === 'ADMIN' 
                          ? 'bg-amber-50 text-amber-800 border-amber-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {u.rol}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                        u.estado 
                          ? 'bg-verde-pastel/35 text-emerald-900 border-emerald-200' 
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {u.estado ? 'Permitido' : 'Suspendido'}
                      </span>
                    </td>

                    <td className="py-3.5 px-5 align-middle whitespace-nowrap">
                      <div className="flex justify-center gap-1.5">
                        <button 
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => abrirModalEdicion(u)} 
                          className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40" 
                          title="Editar Empleado"
                        >
                          <FaEdit size={14} />
                        </button>

                        <button 
                          type="button"
                          disabled={isSubmitting || u.id === currentUser.id}
                          onClick={() => prepararToggleEstado(u)} 
                          className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                            u.estado 
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50' 
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`} 
                          title={u.id === currentUser.id ? 'Tu cuenta activa' : u.estado ? 'Suspender acceso' : 'Reactivar acceso'}
                        >
                          {u.estado ? <FaTimes size={14} /> : <FaCheck size={14} />}
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE PAGINACIÓN PROGRESIVA (30 EN 30) */}
        {!isLoading && usuariosFiltrados.length > 0 && (
          <div className="mt-3.5 lg:mt-0 px-5 py-3.5 bg-white lg:bg-slate-50/80 border border-slate-200/90 lg:border-0 lg:border-t lg:border-slate-100 rounded-2xl lg:rounded-none flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-semibold text-slate-500">
              Mostrando <strong className="text-slate-800">{usuariosVisibles.length}</strong> de{' '}
              <strong className="text-slate-800">{usuariosFiltrados.length}</strong> colaborador(es)
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
                  Cargar {Math.min(BLOQUE_CARGA, restantesPorCargar)} colaborador{Math.min(BLOQUE_CARGA, restantesPorCargar) === 1 ? '' : 'es'} más
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODAL 0: CONFIRMAR SUSPENDER / REACTIVAR */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="p-6 text-center">
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${confirmDialog.estado ? 'bg-red-50 text-red-600' : 'bg-verde-pastel/40 text-emerald-800'}`}>
                  {confirmDialog.estado ? <FaExclamationTriangle size={26} /> : <FaCheck size={26} />}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  {confirmDialog.estado ? '¿Suspender acceso?' : '¿Reactivar acceso?'}
                </h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {confirmDialog.estado 
                    ? `El colaborador "${confirmDialog.nombre}" ya no podrá iniciar sesión en el sistema.` 
                    : `El colaborador "${confirmDialog.nombre}" volverá a tener acceso activo al sistema.`}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmDialog(null)} 
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={ejecutarToggleEstado} 
                  className={`flex-1 py-2.5 rounded-xl font-extrabold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    confirmDialog.estado ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'
                  }`}
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: CREAR / EDITAR EMPLEADO */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-lg max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaUsers size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-extrabold text-slate-900 truncate">
                      {modoEdicion ? 'Editar Datos del Empleado' : 'Registrar Nuevo Empleado'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium truncate">
                      Configura sus credenciales y permisos dentro de la bodega.
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 p-1 transition-colors cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleGuardar} noValidate className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre Completo *</label>
                    <input 
                      type="text" 
                      value={formData.nombre} 
                      onChange={e => setFormData({ ...formData, nombre: e.target.value })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="Ej: Juan Pérez" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Correo Electrónico (Usuario de acceso) *</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({ ...formData, email: e.target.value })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="juan@mibodega.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Contraseña {modoEdicion ? '(Dejar vacío para mantener la actual)' : '*'}
                    </label>
                    <div className="relative">
                      <input 
                        type={mostrarPassword ? 'text' : 'password'} 
                        value={formData.password} 
                        onChange={e => setFormData({ ...formData, password: e.target.value })} 
                        className="w-full pl-3.5 pr-11 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                        placeholder={modoEdicion ? '••••••••' : 'Mínimo 6 caracteres'} 
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPassword(prev => !prev)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                        title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {mostrarPassword ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nivel de Acceso (Rol) *</label>
                    <select 
                      value={formData.rol} 
                      onChange={e => setFormData({ ...formData, rol: e.target.value })} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-bold cursor-pointer"
                    >
                      <option value="AYUDANTE">AYUDANTE (Ventas, Fiados, Recepción de Compras)</option>
                      <option value="ADMIN">ADMIN (Control Total, Configuración y Usuarios)</option>
                    </select>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button 
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsModalOpen(false)} 
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : modoEdicion ? 'Guardar Cambios' : 'Registrar Empleado'}
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