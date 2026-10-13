import { useState, useEffect } from 'react';
import { FaServer, FaStore, FaUsers, FaChartLine, FaClock } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SuperAdmin() {
  const [negocios, setNegocios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cargarNegocios = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/master/negocios', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setNegocios(res.data);
      // eslint-disable-next-line no-unused-vars
      } catch (error) {
        toast.error("Error de acceso al panel maestro.");
      } finally {
        setIsLoading(false);
      }
    };
    cargarNegocios();
  }, []);

  // Función para calcular el tiempo desde el registro
  const calcularTiempoUso = (fechaRegistro) => {
    const inicio = new Date(fechaRegistro);
    const ahora = new Date();
    const diferenciaMs = ahora - inicio;
    
    const dias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
    
    if (dias === 0) return 'Hoy';
    if (dias === 1) return 'Hace 1 día';
    if (dias < 30) return `Hace ${dias} días`;
    
    const meses = Math.floor(dias / 30);
    if (meses === 1) return 'Hace 1 mes';
    if (meses < 12) return `Hace ${meses} meses`;
    
    const anios = Math.floor(meses / 12);
    return `Hace ${anios} año${anios > 1 ? 's' : ''}`;
  };

  if (isLoading) return <div className="p-10 text-center text-white">Cargando Panel Maestro...</div>;

  return (
    <div className="flex flex-col gap-6 text-white pb-20 lg:pb-0 font-sans min-h-[calc(100vh-6rem)] bg-black p-4">
      
      {/* HEADER TIPO MATRIX/HACKER */}
      <div className="flex justify-between items-center bg-neutral-950 p-6 border border-neutral-800 rounded-2xl shadow-xl">
        <div>
          <h2 className="text-2xl font-black text-verde-pastel tracking-widest uppercase flex items-center gap-3">
            <FaServer /> Panel de Control Global (SaaS)
          </h2>
          <p className="text-neutral-500 text-sm mt-1 font-mono">Acceso Nivel: SUPER_ADMIN | Monitoreo de Inquilinos</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-white">{negocios.length}</p>
          <p className="text-xs text-neutral-500 uppercase tracking-widest font-bold">Bodegas Activas</p>
        </div>
      </div>

      {/* TABLA DE BODEGAS */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl overflow-hidden flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 text-[10px] uppercase tracking-widest font-bold border-b border-neutral-800">
                <th className="p-5 whitespace-nowrap">Bodega</th>
                <th className="p-5 whitespace-nowrap">Dueño (Admin)</th>
                <th className="p-5 whitespace-nowrap text-center">Uso del Sistema</th>
                <th className="p-5 whitespace-nowrap text-center">Tiempo Activo</th>
                <th className="p-5 whitespace-nowrap text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-neutral-300">
              {negocios.map((negocio) => (
                <tr key={negocio.id} className="border-b border-neutral-800/50 hover:bg-neutral-800 transition-colors">
                  
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-verde-pastel border border-neutral-700">
                        <FaStore size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-base">{negocio.nombre}</p>
                        <p className="text-[10px] text-neutral-500 font-mono mt-0.5">ID: TENANT_{negocio.id} | RUC: {negocio.ruc || 'N/A'}</p>
                        <p className="text-[10px] text-dorado mt-0.5">Registrado el {new Date(negocio.createdAt).toLocaleDateString('es-PE')}</p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-5">
                    <p className="font-bold text-white text-sm">{negocio.usuarios[0]?.nombre || 'Sin Admin'}</p>
                    <p className="text-xs text-neutral-500 font-mono mt-0.5">{negocio.usuarios[0]?.email}</p>
                  </td>
                  
                  <td className="p-5">
                    <div className="flex justify-center gap-6">
                      <div className="text-center">
                        <p className="font-black text-white text-lg flex items-center justify-center gap-1"><FaUsers className="text-blue-400 text-xs"/> {negocio._count.usuarios}</p>
                        <p className="text-[9px] uppercase tracking-widest text-neutral-500">Usuarios</p>
                      </div>
                      <div className="text-center">
                        <p className="font-black text-white text-lg flex items-center justify-center gap-1"><FaChartLine className="text-emerald-400 text-xs"/> {negocio._count.ventas}</p>
                        <p className="text-[9px] uppercase tracking-widest text-neutral-500">Ventas</p>
                      </div>
                    </div>
                  </td>

                  {/* NUEVA COLUMNA: TIEMPO ACTIVO */}
                  <td className="p-5 text-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-950 rounded-lg border border-neutral-800">
                      <FaClock className="text-neutral-500 text-xs" />
                      <span className="text-xs font-bold text-neutral-300">
                        {calcularTiempoUso(negocio.createdAt)}
                      </span>
                    </div>
                  </td>

                  <td className="p-5 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${negocio.estado ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                      {negocio.estado ? 'Activo' : 'Suspendido'}
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