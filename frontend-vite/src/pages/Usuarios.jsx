import { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaCheck, FaTimes, FaSearch, FaExclamationTriangle } from 'react-icons/fa';
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

  return (
    <div className="text-slate-950 pb-20 font-sans">
      
      {/* CABECERA Y BUSCADOR (Idéntico a Productos.jsx) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950 mb-1 tracking-tight flex items-center gap-3">
            <FaUsers className="text-verde-pastel drop-shadow-md" /> Equipo de Trabajo
          </h1>
          <p className="text-slate-500 text-sm font-medium">Gestiona los accesos de tus ayudantes y administradores.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar por nombre o correo..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-800 transition-all shadow-sm font-medium" 
            />
          </div>
          
          <button 
            onClick={abrirModalNuevo} 
            className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap"
          >
            <FaPlus size={14} /> Nuevo Empleado
          </button>
        </div>
      </div>

      {/* TABLA PRINCIPAL (Diseño idéntico a Productos.jsx) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[750px]">
            <thead>
              <tr className="bg-slate-950 text-slate-100 text-xs uppercase tracking-wider font-bold border-t-4 border-verde-pastel">
                <th className="p-4 whitespace-nowrap">Nombre</th>
                <th className="p-4 whitespace-nowrap">Correo Electrónico</th>
                <th className="p-4 text-center whitespace-nowrap">Rol</th>
                <th className="p-4 text-center whitespace-nowrap">Estado (Acceso)</th>
                <th className="p-4 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                // SKELETON LOADER
                [...Array(4)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="p-4"><div className="h-6 bg-slate-200 rounded-full w-20 mx-auto"></div></td>
                    <td className="p-4"><div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div></td>
                    <td className="p-4 flex justify-center gap-2">
                      <div className="h-8 w-8 bg-slate-200 rounded"></div>
                      <div className="h-8 w-8 bg-slate-200 rounded"></div>
                    </td>
                  </tr>
                ))
              ) : usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-slate-500 font-medium">
                    {busqueda ? 'No se encontraron empleados con esa búsqueda.' : 'No hay empleados registrados.'}
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((u) => (
                  <tr key={u.id} className={`transition-colors ${u.estado ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50 grayscale'}`}>
                    
                    <td className="p-4 font-semibold text-slate-800 align-middle">
                      {u.nombre}
                      {u.id === currentUser.id && (
                        <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">Tú</span>
                      )}
                    </td>

                    <td className="p-4 text-slate-500 font-mono align-middle text-xs">{u.email}</td>

                    <td className="p-4 text-center align-middle">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        u.rol === 'ADMIN' 
                          ? 'bg-amber-50 text-amber-700 border-amber-200' 
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {u.rol}
                      </span>
                    </td>

                    <td className="p-4 text-center align-middle">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        u.estado 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {u.estado ? 'Permitido' : 'Suspendido'}
                      </span>
                    </td>

                    <td className="p-4 align-middle">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => abrirModalEdicion(u)} 
                          className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                          title="Editar"
                        >
                          <FaEdit />
                        </button>

                        <button 
                          onClick={() => prepararToggleEstado(u)} 
                          className={`p-2 rounded-lg transition-colors ${u.estado ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`} 
                          title={u.estado ? 'Suspender acceso' : 'Reactivar acceso'}
                        >
                          {u.estado ? <FaTimes /> : <FaCheck />}
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

      {/* MODAL 0: CONFIRMAR SUSPENDER / REACTIVAR (Igual a Productos.jsx) */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center">
                <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmDialog.estado ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
                  {confirmDialog.estado ? <FaExclamationTriangle size={30} /> : <FaCheck size={30} />}
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">
                  {confirmDialog.estado ? '¿Suspender empleado?' : '¿Reactivar empleado?'}
                </h3>
                <p className="text-sm text-slate-500">
                  {confirmDialog.estado 
                    ? `El usuario "${confirmDialog.nombre}" ya no podrá iniciar sesión en el sistema.` 
                    : `El usuario "${confirmDialog.nombre}" volverá a tener acceso al sistema.`}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setConfirmDialog(null)} 
                  className="flex-1 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={ejecutarToggleEstado} 
                  className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors ${confirmDialog.estado ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: CREAR / EDITAR EMPLEADO (Con el diseño exacto de Productos.jsx) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[80px] pb-6 px-4 sm:items-center sm:pt-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-xl max-h-full sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                  {modoEdicion ? 'Editar Empleado' : 'Nuevo Empleado'}
                </h2>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="text-slate-400 hover:text-white p-1 transition-colors"
                >
                  <FaTimes size={20}/>
                </button>
              </div>

              <form onSubmit={handleGuardar} noValidate className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-white">
                  <div className="grid grid-cols-1 gap-4 sm:gap-5">
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nombre Completo *</label>
                      <input 
                        type="text" 
                        value={formData.nombre} 
                        onChange={e => setFormData({...formData, nombre: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium" 
                        placeholder="Ej: Juan Pérez" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Correo Electrónico (Login) *</label>
                      <input 
                        type="email" 
                        value={formData.email} 
                        onChange={e => setFormData({...formData, email: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium" 
                        placeholder="juan@mibodega.com" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">
                        Contraseña {modoEdicion ? '(Dejar vacío para mantener la actual)' : '*'}
                      </label>
                      <input 
                        type="password" 
                        value={formData.password} 
                        onChange={e => setFormData({...formData, password: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium" 
                        placeholder="••••••••" 
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nivel de Acceso (Rol) *</label>
                      <select 
                        value={formData.rol} 
                        onChange={e => setFormData({...formData, rol: e.target.value})} 
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium cursor-pointer"
                      >
                        <option value="AYUDANTE">AYUDANTE (Ventas, Fiados, Recepción de Compras)</option>
                        <option value="ADMIN">ADMIN (Control Total, Configuración y Usuarios)</option>
                      </select>
                    </div>

                  </div>
                </div>

                <div className="p-4 sm:p-5 border-t border-slate-300 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none"
                  >
                    {modoEdicion ? 'Actualizar' : 'Guardar'}
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