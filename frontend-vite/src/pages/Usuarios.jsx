import { useState, useEffect } from 'react';
import { FaUsers, FaPlus, FaEdit, FaBan, FaCheck, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para el Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  
  // Datos del formulario
  const [formData, setFormData] = useState({ id: null, nombre: '', email: '', password: '', rol: 'AYUDANTE', estado: true });

  useEffect(() => {
    // Definimos la función de carga dentro del useEffect para evitar advertencias de dependencias
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

  // Función manual para recargar la tabla después de crear/editar
  const recargarTabla = async () => {
    try {
      const res = await axios.get('/usuarios');
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
    }
  };

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
    if (!formData.nombre || !formData.email) return toast.error('Nombre y Correo son obligatorios');
    if (!modoEdicion && !formData.password) return toast.error('La contraseña inicial es obligatoria para nuevos usuarios');

    try {
      if (modoEdicion) {
        await axios.put(`/usuarios/${formData.id}`, formData);
        toast.success('Empleado actualizado correctamente');
      } else {
        await axios.post('/usuarios', formData);
        toast.success('Nuevo empleado registrado');
      }
      setIsModalOpen(false);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al guardar');
    }
  };

  const handleAlternarEstado = async (id, estadoActual) => {
    const nuevoEstado = !estadoActual;
    const accion = nuevoEstado ? 'reactivado' : 'suspendido';
    
    try {
      await axios.put(`/usuarios/${id}`, { estado: nuevoEstado });
      toast.success(`Acceso ${accion} correctamente.`);
      recargarTabla();
    } catch (err) {
      console.error(err);
      toast.error('No se pudo cambiar el estado.');
    }
  };

  return (
    <div className="text-slate-900 pb-20 font-sans max-w-6xl mx-auto">
      
      {/* CABECERA (Estilo alineado con Productos) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
            <FaUsers className="text-verde-pastel drop-shadow-md" /> Equipo de Trabajo
          </h1>
          <p className="text-slate-500 text-sm font-medium">Gestiona los accesos de tus ayudantes y administradores.</p>
        </div>
        <button 
          onClick={abrirModalNuevo}
          className="bg-verde-pastel hover:bg-[#86e6bb] text-neutral-950 font-extrabold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 uppercase tracking-wider text-sm"
        >
          <FaPlus /> Nuevo Ayudante
        </button>
      </div>

      {/* TABLA DE USUARIOS (Diseño "VendaIA") */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Encabezado oscuro con contraste verde pastel (Igual que en Productos) */}
              <tr className="bg-neutral-950 text-white text-[11px] uppercase tracking-widest font-black">
                <th className="p-5 whitespace-nowrap">Nombre y Correo</th>
                <th className="p-5 whitespace-nowrap text-center">Rol</th>
                <th className="p-5 whitespace-nowrap text-center">Estado (Acceso)</th>
                <th className="p-5 whitespace-nowrap text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700">
              {isLoading ? (
                <tr><td colSpan="4" className="p-10 text-center text-slate-400">Cargando equipo...</td></tr>
              ) : usuarios.length === 0 ? (
                <tr><td colSpan="4" className="p-10 text-center text-slate-400">No tienes ayudantes registrados.</td></tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!u.estado ? 'opacity-60 bg-slate-50' : ''}`}>
                    
                    <td className="p-5">
                      <p className="font-extrabold text-slate-900 text-base">{u.nombre}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</p>
                    </td>

                    <td className="p-5 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${u.rol === 'ADMIN' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-200 text-slate-700 border border-slate-300'}`}>
                        {u.rol}
                      </span>
                    </td>

                    <td className="p-5 text-center">
                      <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1 w-fit mx-auto ${u.estado ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                        {u.estado ? <><FaCheck /> Permitido</> : <><FaBan /> Suspendido</>}
                      </span>
                    </td>

                    <td className="p-5">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => abrirModalEdicion(u)} className="p-2.5 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors border border-slate-200" title="Editar">
                          <FaEdit size={16} />
                        </button>
                        <button 
                          onClick={() => handleAlternarEstado(u.id, u.estado)} 
                          className={`p-2.5 rounded-lg transition-colors border ${u.estado ? 'bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600 border-slate-200' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-600 border-slate-200'}`} 
                          title={u.estado ? "Suspender Acceso" : "Reactivar Acceso"}
                        >
                          {u.estado ? <FaBan size={16} /> : <FaCheck size={16} />}
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

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm" />
            
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white rounded-3xl shadow-2xl w-full max-w-lg z-10 overflow-hidden border border-slate-200">
              
              <div className="bg-neutral-950 px-6 py-4 flex justify-between items-center border-b-4 border-verde-pastel">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <FaUsers className="text-verde-pastel" /> {modoEdicion ? 'Editar Empleado' : 'Registrar Ayudante'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-white transition-colors"><FaTimes size={20} /></button>
              </div>

              <form onSubmit={handleGuardar} className="p-6 space-y-5">
                
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Nombre Completo *</label>
                  <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-verde-pastel/20 outline-none text-slate-800 font-bold transition-all" placeholder="Ej: Juan Pérez" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Correo para Iniciar Sesión *</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-verde-pastel/20 outline-none text-slate-800 font-medium transition-all" placeholder="juan@mibodega.com" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">
                    Contraseña {modoEdicion ? '(Dejar en blanco para no cambiar)' : '*'}
                  </label>
                  <input type="password" required={!modoEdicion} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-verde-pastel/20 outline-none text-slate-800 font-medium transition-all" placeholder="••••••••" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase">Nivel de Acceso (Rol) *</label>
                  <select value={formData.rol} onChange={e => setFormData({...formData, rol: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-verde-pastel/20 outline-none text-slate-800 font-bold transition-all cursor-pointer">
                    <option value="AYUDANTE">AYUDANTE (Solo Ventas y Productos)</option>
                    <option value="ADMIN">ADMIN (Acceso Total y Configuración)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="bg-neutral-950 hover:bg-neutral-800 text-verde-pastel font-extrabold py-3 px-8 rounded-xl transition-all shadow-md uppercase tracking-wider text-sm">
                    Guardar
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