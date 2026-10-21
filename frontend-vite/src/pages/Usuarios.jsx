import { useState, useEffect } from 'react';
import { 
  FaUsers, FaPlus, FaEdit, FaCheck, FaTimes, 
  FaSearch, FaExclamationTriangle, FaUserShield 
} from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  
  // Estados para los Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
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
      setIsLoading(true);
      try {
        const res = await axios.get('/usuarios');
        setUsuarios(res.data);
      } catch (err) {
        console.error("Error al cargar empleados:", err);
        toast.error('Error al cargar la lista de empleados.');
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
    }
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.rol.toLowerCase().includes(busqueda.toLowerCase())
  );

  const abrirModalNuevo = () => {
    setModoEdicion(false);
    setFormData({ id: null, nombre: '', email: '', password: '', rol: 'AYUDANTE', estado: true });
    setIsModalOpen(true);
  };

  const abrirModalEdicion = (usuario) => {
    setModoEdicion(true);
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
    if (!formData.nombre.trim() || !formData.email.trim()) {
      return toast.error('El nombre y el correo electrónico son obligatorios.');
    }
    if (!modoEdicion && !formData.password.trim()) {
      return toast.error('La contraseña inicial es obligatoria para nuevos usuarios.');
    }

    try {
      if (modoEdicion) {
        await axios.put(`/usuarios/${formData.id}`, formData);
        toast.success('Empleado actualizado correctamente');
      } else {
        await axios.post('/usuarios', formData);
        toast.success('Nuevo empleado registrado exitosamente');
      }
      setIsModalOpen(false);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al guardar');
    }
  };

  const prepararToggleEstado = (usuario) => {
    if (usuario.id === currentUser.id) {
      return toast.error('No puedes suspender tu propia cuenta activa.');
    }
    setConfirmDialog(usuario);
  };

  const ejecutarToggleEstado = async () => {
    if (!confirmDialog) return;
    const nuevoEstado = !confirmDialog.estado;
    const accion = nuevoEstado ? 'reactivado' : 'suspendido';
    
    try {
      await axios.put(`/usuarios/${confirmDialog.id}`, { 
        nombre: confirmDialog.nombre,
        rol: confirmDialog.rol,
        estado: nuevoEstado 
      });
      toast.success(`Acceso ${accion} correctamente.`);
      setConfirmDialog(null);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'No se pudo cambiar el estado del usuario.');
    }
  };

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const totalAdmins = usuarios.filter(u => u.rol === 'ADMIN').length;
  const usuariosActivos = usuarios.filter(u => u.estado).length;

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-20 lg:pb-4 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL Y BUSCADOR (Estilo Figma) */}
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
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400" 
            />
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

      {/* TARJETAS DE RESUMEN SIMÉTRICAS (Estilo Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Total de Personal</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {usuarios.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaUsers size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Administradores</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {totalAdmins}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FaUserShield size={21} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Accesos Activos</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {usuariosActivos}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaCheck size={19} />
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL CON SOMBRA FLOTANTE SUAVE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
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
                usuariosFiltrados.map((u) => (
                  <tr key={u.id} className={`transition-colors ${u.estado ? 'hover:bg-slate-50/80' : 'opacity-55 bg-slate-50/60'}`}>
                    
                    <td className="py-3.5 px-5 align-middle">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl font-bold text-sm flex items-center justify-center shrink-0 ${
                          u.estado ? 'bg-verde-pastel/40 text-emerald-900' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {u.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{u.nombre}</span>
                          {u.id === currentUser.id && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-verde-pastel/50 text-emerald-950 border border-emerald-200 uppercase">
                              Tú
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 font-mono font-medium align-middle text-xs sm:text-sm">
                      {u.email}
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
                          onClick={() => abrirModalEdicion(u)} 
                          className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer" 
                          title="Editar Empleado"
                        >
                          <FaEdit size={14} />
                        </button>

                        <button 
                          type="button"
                          onClick={() => prepararToggleEstado(u)} 
                          className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer ${
                            u.estado 
                              ? 'text-red-500 hover:text-red-700 hover:bg-red-50' 
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`} 
                          title={u.estado ? 'Suspender acceso' : 'Reactivar acceso'}
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
                  onClick={() => setConfirmDialog(null)} 
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={ejecutarToggleEstado} 
                  className={`flex-1 py-2.5 rounded-xl font-extrabold transition-colors text-sm cursor-pointer ${confirmDialog.estado ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'}`}
                >
                  Confirmar
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaUsers size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {modoEdicion ? 'Editar Datos del Empleado' : 'Registrar Nuevo Empleado'}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                      Configura sus credenciales y permisos dentro de la bodega.
                    </p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                >
                  <FaTimes size={18}/>
                </button>
              </div>

              <form onSubmit={handleGuardar} noValidate className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre Completo *</label>
                    <input 
                      type="text" 
                      value={formData.nombre} 
                      onChange={e => setFormData({...formData, nombre: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="Ej: Juan Pérez" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Correo Electrónico (Usuario de acceso) *</label>
                    <input 
                      type="email" 
                      value={formData.email} 
                      onChange={e => setFormData({...formData, email: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="juan@mibodega.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Contraseña {modoEdicion ? '(Dejar vacío para mantener la actual)' : '*'}
                    </label>
                    <input 
                      type="password" 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" 
                      placeholder="••••••••" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nivel de Acceso (Rol) *</label>
                    <select 
                      value={formData.rol} 
                      onChange={e => setFormData({...formData, rol: e.target.value})} 
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
                    onClick={() => setIsModalOpen(false)} 
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none cursor-pointer"
                  >
                    {modoEdicion ? 'Guardar Cambios' : 'Registrar Empleado'}
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