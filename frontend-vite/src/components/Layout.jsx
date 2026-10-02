import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaShoppingCart, FaBoxOpen, FaHistory, FaRobot, FaCog, FaSignOutAlt, FaBars, FaTimes, FaTruck, FaClipboardList } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { businessConfig } = useBusiness();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuItems = [
    { path: '/ventas', icon: FaShoppingCart, label: 'Nueva Venta' },
    { path: '/productos', icon: FaBoxOpen, label: 'Productos' },
    { path: '/proveedores', icon: FaTruck, label: 'Proveedores' },
    { path: '/compras', icon: FaClipboardList, label: 'Plan de Compras' },
    { path: '/historial', icon: FaHistory, label: 'Historial' },
    { path: '/ia-panel', icon: FaRobot, label: 'Asistente IA' },
    { path: '/configuracion', icon: FaCog, label: 'Configuración' },
  ];

  const handleNavigation = () => setIsMobileMenuOpen(false);
  const mainRef = useRef(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] bg-slate-50 text-slate-950 overflow-hidden relative font-sans"> 
      
      {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR: Negro puro (Neutral-950) sin tonos azules */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-neutral-950 border-r border-neutral-900 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* LOGO EN SIDEBAR */}
        <div className="py-6 flex flex-col items-center justify-center px-4 border-b border-neutral-800/50 text-center gap-3 relative">
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 text-neutral-400 hover:text-white"><FaTimes size={20} /></button>
          
          {businessConfig.logo ? (
            <img src={businessConfig.logo} alt="Logo" className="w-14 h-14 rounded-xl object-cover bg-white shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-verde-pastel shadow-[0_0_15px_rgba(167,243,208,0.4)]"></div>
          )}
          <h2 className="text-xl font-extrabold text-white tracking-tight leading-tight break-words w-full">
            {businessConfig.nombre}
          </h2>
        </div>

        {/* USUARIO */}
        <div className="px-6 py-6 border-b border-neutral-800/50 bg-neutral-900/30">
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-3 font-bold">Cajero Activo</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-verde-pastel/10 border border-verde-pastel/20 flex items-center justify-center">
              <span className="text-verde-pastel font-bold text-lg">{user?.nombre?.charAt(0) || 'U'}</span>
            </div>
            <div>
              <p className="font-bold text-sm truncate text-white">{user.nombre}</p>
              <p className="text-[11px] text-neutral-400 font-medium uppercase tracking-wider">{user.rol}</p>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link key={item.path} to={item.path} onClick={handleNavigation}>
                <motion.div whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-verde-pastel/10 text-verde-pastel border-l-4 border-verde-pastel font-semibold shadow-lg shadow-verde-pastel/5' 
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 font-medium'
                  }`}
                >
                  <Icon className={`text-lg ${isActive ? 'text-verde-pastel' : 'text-neutral-500'}`} />
                  <span className="text-sm tracking-wide">{item.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <div className="p-4 border-t border-neutral-800/50">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rosado-pastel/90 hover:text-rosado-pastel hover:bg-rosado-pastel/10 rounded-lg transition-colors text-sm font-semibold">
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">        
        <header className="md:hidden h-16 border-b border-slate-200 bg-white flex items-center px-4 justify-between z-20 relative shadow-sm">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-800 p-2 focus:outline-none shrink-0"><FaBars size={22} /></button>
          
          <div className="flex items-center gap-2 max-w-[65%] justify-center">
            {businessConfig.logo ? (
              <img src={businessConfig.logo} alt="Logo" className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-verde-pastel shrink-0"></div>
            )}
            <span className="font-extrabold text-slate-950 tracking-tight leading-tight text-sm text-left break-words line-clamp-2">
              {businessConfig.nombre}
            </span>
          </div>
          
          <div className="w-8 shrink-0"></div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 md:p-8 overflow-y-auto"> 
          <Outlet />
        </main>
      </div>
    </div>
  );
}