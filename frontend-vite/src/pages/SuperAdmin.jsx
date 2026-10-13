import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaServer, FaStore, FaUsers, FaChartLine, FaClock, FaSignOutAlt, FaMapMarkerAlt, FaPhoneAlt } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SuperAdmin() {
  const [negocios, setNegocios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarNegocios = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/master/negocios', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNegocios(res.data);
      } catch (error) {
        console.error(error);
        toast.error("Error de acceso al panel maestro.");
      } finally {
        setIsLoading(false);
      }
    };
    cargarNegocios();
  }, []);

  // Cerrar Sesión del Super Admin
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pos_config');
    navigate('/login');
  };

  // Función para calcular la antigüedad
  const calcularAntiguedad = (fechaRegistro) => {
    const inicio = new Date(fechaRegistro);
    const ahora = new Date();
    const diferenciaMs = ahora - inicio;
    
    const dias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
    
    if (dias === 0) return 'Nuevo (Hoy)';
    if (dias === 1) return '1 día';
    if (dias < 30) return `${dias} días`;
    
    const meses = Math.floor(dias / 30);
    if (meses === 1) return '1 mes';
    if (meses < 12) return `${meses} meses`;
    
    const anios = Math.floor(meses / 12);
    return `${anios} año${anios > 1 ? 's' : ''}`;
  };

  if (isLoading) return <div className="p-10 text-center text-white text-lg font-bold">Cargando Panel Maestro...</div>;

  return (
    <div className="flex flex-col gap-6 text-white pb-20 lg:pb-0 font-sans min-h-screen bg-black p-6">
      
      {/* HEADER TIPO MATRIX/HACKER */}
      <div className="flex justify-between items-center bg-neutral-950 p-6 border border-neutral-800 rounded-3xl shadow-2xl">
        <div>
          <h2 className="text-3xl font-black text-verde-pastel tracking-widest uppercase flex items-center gap-3">
            <FaServer /> Panel de Control Global
          </h2>
          <p className="text-neutral-500 text-sm mt-2 font-mono">Acceso Nivel: SUPER_ADMIN | Monitoreo de Inquilinos (SaaS)</p>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-4xl font-black text-white">{negocios.length}</p>
            <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">Bodegas Activas</p>
          </div>
          
          {/* BOTÓN CERRAR SESIÓN */}
          <div className="border-l border-neutral-800 pl-8">
            <button 
              onClick={handleLogout}
              className="bg-neutral-900 hover:bg-red-950/40 text-neutral-400 hover:text-red-400 border border-neutral-800 hover:border-red-900/50 font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 text-sm uppercase tracking-wider"
            >
              <FaSignOutAlt size={16} /> Salir
            </button>
          </div>
        </div>
      </div>

      {/* TABLA DE BODEGAS (LETRAS MÁS GRANDES Y MÁS DATOS) */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-widest font-bold border-b border-neutral-800">
                <th className="p-6 whitespace-nowrap">Datos del Negocio</th>
                <th className="p-6 whitespace-nowrap">Datos del Dueño</th>
                <th className="p-6 whitespace-nowrap text-center">Uso del Sistema</th>
                <th className="p-6 whitespace-nowrap text-center">Antigüedad</th>
                <th className="p-6 whitespace-nowrap text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="text-base font-medium text-neutral-300">
              {negocios.map((negocio) => (
                <tr key={negocio.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/80 transition-colors">
                  
                  {/* COLUMNA 1: NEGOCIO Y DIRECCIÓN */}
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-neutral-950 flex items-center justify-center text-verde-pastel border border-neutral-700 shadow-inner">
                        <FaStore size={22} />
                      </div>
                      <div>
                        <p className="font-extrabold text-white text-lg">{negocio.nombre}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-1">ID: TENANT_{negocio.id} | RUC: {negocio.ruc || 'N/A'}</p>
                        {negocio.direccionFiscal ? (
                          <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <FaMapMarkerAlt /> {negocio.ciudad}, {negocio.direccionFiscal}
                          </p>
                        ) : (
                          <p className="text-xs text-neutral-600 mt-1 flex items-center gap-1">
                            <FaMapMarkerAlt /> Dirección no configurada
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  {/* COLUMNA 2: DUEÑO, CORREO Y TELÉFONO */}
                  <td className="p-6">
                    <p className="font-bold text-white text-base">{negocio.usuarios[0]?.nombre || 'Sin Admin'}</p>
                    <p className="text-sm text-neutral-400 font-mono mt-1">{negocio.usuarios[0]?.email}</p>
                    {negocio.telefono && (
                      <p className="text-xs text-dorado mt-1 flex items-center gap-1">
                        <FaPhoneAlt /> {negocio.telefono}
                      </p>
                    )}
                  </td>
                  
                  {/* COLUMNA 3: MÉTRICAS DE USO */}
                  <td className="p-6">
                    <div className="flex justify-center gap-8">
                      <div className="text-center">
                        <p className="font-black text-white text-xl flex items-center justify-center gap-1">
                          <FaUsers className="text-blue-400 text-sm"/> {negocio._count.usuarios}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Usuarios</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-white text-xl flex items-center justify-center gap-1">
                          <FaChartLine className="text-emerald-400 text-sm"/> {negocio._count.ventas}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Ventas</p>
                      </div>
                    </div>
                  </td>

                  {/* COLUMNA 4: ANTIGÜEDAD */}
                  <td className="p-6 text-center">
                    <div className="inline-flex flex-col items-center justify-center gap-1 px-4 py-2 bg-neutral-950 rounded-xl border border-neutral-800">
                      <div className="flex items-center gap-2">
                        <FaClock className="text-neutral-500 text-sm" />
                        <span className="text-sm font-bold text-neutral-200">
                          {calcularAntiguedad(negocio.createdAt)}
                        </span>
                      </div>
                      <p className="text-[9px] text-neutral-500 uppercase tracking-widest">En el sistema</p>
                    </div>
                  </td>

                  {/* COLUMNA 5: ESTADO */}
                  <td className="p-6 text-center">
                    <span className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider ${negocio.estado ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                      {negocio.estado ? '🟢 Activo' : '🔴 Suspendido'}
                    </span>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}