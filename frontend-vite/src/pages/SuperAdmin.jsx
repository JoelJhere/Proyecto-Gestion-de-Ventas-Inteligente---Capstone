import { useState, useEffect } from 'react';
import { 
  FaServer, FaStore, FaUsers, FaChartLine, FaClock, 
  FaSignOutAlt, FaMapMarkerAlt, FaPhoneAlt, FaSearch 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function SuperAdmin() {
  const [negocios, setNegocios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

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
    window.location.href = '/login';
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

  const negociosFiltrados = negocios.filter((n) =>
    n.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.ruc?.includes(busqueda) ||
    n.usuarios?.[0]?.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    n.usuarios?.[0]?.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Métricas globales para las tarjetas estilo Figma
  const totalUsuariosGlobal = negocios.reduce((acc, n) => acc + (n._count?.usuarios || 0), 0);
  const totalVentasGlobal = negocios.reduce((acc, n) => acc + (n._count?.ventas || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased pb-16">
      
      {/* BARRA SUPERIOR EJECUTIVA */}
      <header className="bg-white border-b border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-verde-pastel text-emerald-950 flex items-center justify-center shadow-2xs shrink-0">
              <FaServer size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Panel de Control Global
                </h1>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-verde-pastel/50 text-emerald-950 border border-emerald-200">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Administración y monitoreo centralizado de bodegas afiliadas (SaaS Multi-Tenant)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15"></span>
              <span>Servidor Activo</span>
            </div>

            <button 
              type="button"
              onClick={handleLogout}
              className="bg-white hover:bg-red-50 text-red-600 border border-slate-200/90 hover:border-red-200 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center gap-2 text-xs sm:text-sm shadow-2xs cursor-pointer"
            >
              <FaSignOutAlt size={15} /> Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-7 space-y-6">
        
        {/* 3 TARJETAS DE RESUMEN GLOBAL SIMÉTRICAS (Estilo Figma) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Bodegas Afiliadas</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {negocios.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
              <FaStore size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Usuarios Totales</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {totalUsuariosGlobal}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <FaUsers size={22} />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Ventas Procesadas</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                {totalVentasGlobal}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FaChartLine size={20} />
            </div>
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y TÍTULO DE TABLA */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
              Directorio de Inquilinos (Tenants)
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Supervisa los negocios registrados, sus propietarios y su nivel de actividad.
            </p>
          </div>

          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            <input 
              type="text" 
              placeholder="Buscar bodega, RUC o propietario..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400" 
            />
          </div>
        </div>

        {/* TABLA DE BODEGAS CON SOMBRA FLOTANTE SUAVE */}
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6 whitespace-nowrap">Datos del Negocio</th>
                  <th className="py-3.5 px-5 whitespace-nowrap">Propietario / Administrador</th>
                  <th className="py-3.5 px-5 whitespace-nowrap text-center">Actividad en Plataforma</th>
                  <th className="py-3.5 px-5 whitespace-nowrap text-center">Antigüedad</th>
                  <th className="py-3.5 px-6 whitespace-nowrap text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {isLoading ? (
                  [...Array(4)].map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-5 px-6"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="py-5 px-5"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                      <td className="py-5 px-5"><div className="h-6 bg-slate-200 rounded w-28 mx-auto"></div></td>
                      <td className="py-5 px-5"><div className="h-6 bg-slate-200 rounded w-24 mx-auto"></div></td>
                      <td className="py-5 px-6"><div className="h-6 bg-slate-200 rounded-full w-20 mx-auto"></div></td>
                    </tr>
                  ))
                ) : negociosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-12 text-center text-slate-500 font-medium text-sm">
                      {busqueda ? 'No se encontraron bodegas con ese criterio de búsqueda.' : 'Aún no hay negocios registrados en la plataforma.'}
                    </td>
                  </tr>
                ) : (
                  negociosFiltrados.map((negocio) => (
                    <tr key={negocio.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* COLUMNA 1: NEGOCIO Y DIRECCIÓN */}
                      <td className="py-4 px-6 align-middle">
                        <div className="flex items-start gap-3.5">
                          <div className="w-11 h-11 rounded-xl bg-verde-pastel/40 text-emerald-900 flex items-center justify-center shrink-0 font-extrabold text-base mt-0.5">
                            {negocio.nombre?.charAt(0)?.toUpperCase() || <FaStore size={18} />}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-base">{negocio.nombre}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/80">
                                ID #{negocio.id}
                              </span>
                              <span className="text-xs font-mono font-semibold text-slate-500">
                                RUC: {negocio.ruc || 'Sin configurar'}
                              </span>
                            </div>
                            {negocio.direccionFiscal ? (
                              <p className="text-xs text-slate-500 font-medium mt-1.5 flex items-center gap-1.5">
                                <FaMapMarkerAlt className="text-emerald-600 shrink-0" size={11} /> 
                                <span>{negocio.ciudad ? `${negocio.ciudad} • ` : ''}{negocio.direccionFiscal}</span>
                              </p>
                            ) : (
                              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                                <FaMapMarkerAlt className="text-slate-300 shrink-0" size={11} /> 
                                <span>Dirección fiscal pendiente</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* COLUMNA 2: DUEÑO, CORREO Y TELÉFONO */}
                      <td className="py-4 px-5 align-middle">
                        <p className="font-bold text-slate-900 text-sm">
                          {negocio.usuarios[0]?.nombre || 'Sin Administrador'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {negocio.usuarios[0]?.email || '-'}
                        </p>
                        {negocio.telefono && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-800 bg-verde-pastel/30 px-2.5 py-0.5 rounded-md border border-emerald-200/70 mt-1.5">
                            <FaPhoneAlt size={10} className="text-emerald-700" /> {negocio.telefono}
                          </span>
                        )}
                      </td>
                      
                      {/* COLUMNA 3: MÉTRICAS DE USO */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex justify-center items-center gap-3">
                          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center min-w-[85px]">
                            <p className="font-extrabold text-slate-900 text-base flex items-center justify-center gap-1.5">
                              <FaUsers className="text-blue-600 text-xs" /> {negocio._count.usuarios}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                              Usuarios
                            </p>
                          </div>

                          <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-center min-w-[85px]">
                            <p className="font-extrabold text-slate-900 text-base flex items-center justify-center gap-1.5">
                              <FaChartLine className="text-emerald-600 text-xs" /> {negocio._count.ventas}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mt-0.5">
                              Ventas
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* COLUMNA 4: ANTIGÜEDAD */}
                      <td className="py-4 px-5 text-center align-middle whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
                          <FaClock className="text-slate-400 text-xs" />
                          <span className="text-xs font-bold text-slate-700">
                            {calcularAntiguedad(negocio.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* COLUMNA 5: ESTADO */}
                      <td className="py-4 px-6 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          negocio.estado 
                            ? 'bg-verde-pastel/35 text-emerald-950 border-emerald-200' 
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          <span className={`w-2 h-2 rounded-full ${negocio.estado ? 'bg-emerald-600' : 'bg-red-500'}`}></span>
                          {negocio.estado ? 'Activo' : 'Suspendido'}
                        </span>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}