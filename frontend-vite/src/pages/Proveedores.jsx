import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaTimes, FaSearch, FaTruck } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function Proveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
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
      console.error("Error al cargar proveedores:", error);
      toast.error('Ocurrió un problema al cargar los proveedores');
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarProveedores(); }, []);

  // Función validadora para RUC/DNI y formato de teléfono peruano (fijos y móviles)
  const validarFormulario = (datos) => {
    const docRegex = /^(?:\d{8}|\d{11})$/;
    if (!docRegex.test(datos.ruc)) {
      toast.error('El documento debe tener exactamente 8 dígitos (DNI) o 11 dígitos (RUC).');
      return false;
    }

    if (datos.telefono) {
      const tel = datos.telefono;
      // Regla Celular: Si empieza con 9, debe tener exactamente 9 dígitos
      if (tel.startsWith('9')) {
        if (tel.length !== 9) {
          toast.error('El número de celular debe tener exactamente 9 dígitos.');
          return false;
        }
      } 
      // Regla Fijo: Si no empieza con 9, es fijo (6 dígitos provincia, 7 Lima, o 9 con código de área como 076)
      else {
        if (tel.length !== 6 && tel.length !== 7 && tel.length !== 9) {
          toast.error('El teléfono fijo debe tener 6 o 7 dígitos (o 9 si incluye el código de área).');
          return false;
        }
      }
    }

    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!validarFormulario(formData)) return;

    try {
      await axios.post('/proveedores', formData);
      toast.success('Proveedor registrado correctamente');
      setIsCreateModalOpen(false);
      setFormData({ nombre: '', ruc: '', telefono: '' });
      cargarProveedores();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al guardar el proveedor'); 
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!validarFormulario(editingProveedor)) return;

    try {
      await axios.put(`/proveedores/${editingProveedor.id}`, editingProveedor);
      toast.success('Proveedor actualizado correctamente');
      setEditingProveedor(null);
      cargarProveedores();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al actualizar el proveedor'); 
    }
  };

  const proveedoresFiltrados = proveedores.filter(prov => 
    prov.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    (prov.ruc && prov.ruc.includes(busqueda))
  );

  return (
    <div className="text-slate-900 pb-20 font-sans">
      
      {/* CABECERA Y BUSCADOR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-neutral-950 mb-1 tracking-tight flex items-center gap-3">
            <FaTruck className="text-verde-pastel drop-shadow-md" /> Proveedores
          </h1>
          <p className="text-slate-500 text-sm font-medium">Gestiona los contactos que surten el negocio.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400" />
            </div>
            <input 
              type="text" placeholder="Buscar por nombre o RUC..." 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-800 transition-all shadow-sm font-medium" 
            />
          </div>
          {isAdmin && (
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
                <FaPlus size={14} /> Nuevo Proveedor
            </button>
          )}
        </div>
      </div>
      
      {/* TABLA PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-neutral-950 text-white text-xs uppercase tracking-wider font-bold border-t-4 border-verde-pastel">
                <th className="p-4 whitespace-nowrap w-1/3">Empresa / Nombre</th>
                <th className="p-4 whitespace-nowrap w-1/4">RUC / DNI</th>
                <th className="p-4 whitespace-nowrap w-1/4">Teléfono de Contacto</th>
                {isAdmin && <th className="p-4 text-center whitespace-nowrap">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                // SKELETON LOADER (Animación de carga)
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="p-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    {isAdmin && (
                      <td className="p-4 flex justify-center">
                        <div className="h-8 w-8 bg-slate-200 rounded"></div>
                      </td>
                    )}
                  </tr>
                ))
              ) : proveedoresFiltrados.length === 0 ? (
                <tr><td colSpan={isAdmin ? "4" : "3"} className="p-12 text-center text-slate-500 font-medium">{busqueda ? 'No se encontraron proveedores.' : 'No hay proveedores registrados.'}</td></tr>
              ) : (
                proveedoresFiltrados.map((prov) => (
                <tr key={prov.id} className="hover:bg-slate-50 transition-colors">                  
                    <td className="p-4 font-extrabold text-slate-800 align-middle">{prov.nombre}</td>
                    <td className="p-4 text-slate-500 font-mono align-middle">{prov.ruc || '-'}</td>
                    <td className="p-4 text-slate-600 font-medium align-middle">{prov.telefono || '-'}</td>
                    {isAdmin && (
                      <td className="p-4 align-middle">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setEditingProveedor(prov)} className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar Proveedor"><FaEdit /></button>
                        </div>
                      </td>
                    )}
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* MODAL 1: NUEVO PROVEEDOR */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-neutral-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Nuevo Proveedor</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition-colors p-1"><FaTimes size={20}/></button>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nombre o Razón Social *</label>
                    <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium" placeholder="Ej: Distribuidora Gloria S.A."/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">RUC / DNI *</label>
                    {/* Filtro en tiempo real: Solo permite ingresar números y máximo 11 caracteres */}
                    <input type="text" required value={formData.ruc} onChange={e => setFormData({...formData, ruc: e.target.value.replace(/\D/g, '').slice(0, 11)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium font-mono" placeholder="Ej: 20100152356 o 76543210"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Teléfono / Fijo / WhatsApp</label>
                    {/* Filtro en tiempo real: Solo números, máximo 9 caracteres */}
                    <input type="text" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium font-mono" placeholder="Ej: 987654321 o 076123456"/>
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none">Guardar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* MODAL 2: EDITAR PROVEEDOR */}
      <AnimatePresence>
        {editingProveedor && (
          <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-neutral-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Editar Proveedor</h2>
                <button onClick={() => setEditingProveedor(null)} className="text-slate-400 hover:text-white transition-colors p-1"><FaTimes size={20}/></button>
              </div>
              <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0">
                <div className="p-6 overflow-y-auto space-y-5 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nombre o Razón Social *</label>
                    <input type="text" required value={editingProveedor.nombre} onChange={e => setEditingProveedor({...editingProveedor, nombre: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">RUC / DNI *</label>
                    <input type="text" required value={editingProveedor.ruc || ''} onChange={e => setEditingProveedor({...editingProveedor, ruc: e.target.value.replace(/\D/g, '').slice(0, 11)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium font-mono"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Teléfono / Fijo / WhatsApp</label>
                    <input type="text" value={editingProveedor.telefono || ''} onChange={e => setEditingProveedor({...editingProveedor, telefono: e.target.value.replace(/\D/g, '').slice(0, 9)})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium font-mono"/>
                  </div>
                </div>
                <div className="p-5 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setEditingProveedor(null)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none">Actualizar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}