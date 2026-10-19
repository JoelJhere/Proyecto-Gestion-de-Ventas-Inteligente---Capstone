import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaShoppingCart, FaBoxOpen, FaHistory, FaCog, FaSignOutAlt, FaBars, FaTimes, FaTruck, FaClipboardList, FaFileInvoiceDollar, FaStore, FaUsers, FaFileContract } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import TerminosModal from './TerminosModal';
import AsistenteIA from './AsistenteIA';

export default function Layout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hayAlertasFiados, setHayAlertasFiados] = useState(false); 
  
  const location = useLocation();
  const { businessConfig, setBusinessConfig } = useBusiness();
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));

  // Estados para el Modal de Términos y Condiciones
  const [mostrarModalObligatorio, setMostrarModalObligatorio] = useState(
    () => user.rol !== 'SUPER_ADMIN' && user.terminosAceptados === false
  );
  const [mostrarModalLectura, setMostrarModalLectura] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('pos_config');
    localStorage.removeItem('pos_carrito');
    localStorage.removeItem('pos_cliente');
    localStorage.removeItem('pos_tipo_comprobante');
    // Cierre forzado para destruir la memoria (SaaS Seguro)
    window.location.href = '/login';
  };

  // Cuando un empleado nuevo acepta los términos por primera vez
  const handleAceptarTerminosObligatorios = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('/usuarios/aceptar-terminos', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const usuarioActualizado = { ...user, terminosAceptados: true };
      localStorage.setItem('user', JSON.stringify(usuarioActualizado));
      setUser(usuarioActualizado);
      setMostrarModalObligatorio(false);
      toast.success('Términos y condiciones aceptados.');
    } catch (error) {
      console.error("Error al aceptar términos:", error);
      toast.error('No se pudo guardar la aceptación. Intenta nuevamente.');
    }
  };

  const todosLosItems = [
    { path: '/ventas', icon: FaShoppingCart, label: 'Nueva Venta' },
    { path: '/fiados', icon: FaFileInvoiceDollar, label: 'Fiados' },
    { path: '/productos', icon: FaBoxOpen, label: 'Productos' },
    { path: '/proveedores', icon: FaTruck, label: 'Proveedores' },
    { path: '/compras', icon: FaClipboardList, label: 'Plan de Compras' },
    { path: '/historial', icon: FaHistory, label: 'Historial y Finanzas' },
    { path: '/configuracion', icon: FaCog, label: 'Configuración', soloAdmin: true },
    { path: '/usuarios', icon: FaUsers, label: 'Usuarios', soloAdmin: true },
  ];

  // Filtramos el menú según el rol (los ayudantes no ven Configuración ni Usuarios)
  const menuItems = todosLosItems.filter(item => !item.soloAdmin || user.rol === 'ADMIN');

  const handleNavigation = () => setIsMobileMenuOpen(false);
  const mainRef = useRef(null);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTo(0, 0);
  }, [location.pathname]);

  // FORZAR CARGA DE CONFIGURACIÓN AL ENTRAR SI ESTÁ VACÍA
  useEffect(() => {
    const fetchConfigSeguridad = async () => {
      if (!businessConfig || !businessConfig.nombre) {
        try {
          const token = localStorage.getItem('token');
          if (!token) return;
          const res = await axios.get('/configuracion', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data) {
            setBusinessConfig(res.data);
            localStorage.setItem('pos_config', JSON.stringify(res.data));
          }
        } catch (error) {
          console.error("Error forzando carga de configuración en Layout:", error);
        }
      }
    };
    fetchConfigSeguridad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lógica para detectar si hay Fiados que necesitan enviarse por WhatsApp hoy
  useEffect(() => {
    const verificarAlertas = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get('/fiados', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        
        const requiereCobro = res.data.some(f => {
          const limite = new Date(f.fechaLimite);
          limite.setHours(0, 0, 0, 0);
          return limite <= hoy && f.estado === 'PENDIENTE';
        });
        
        setHayAlertasFiados(requiereCobro);
      } catch (error) {
        console.error("Error verificando alertas de fiados:", error);
      }
    };

    verificarAlertas();
  }, [location.pathname]);

  return (
    <div className="flex h-[100dvh] bg-slate-50 text-slate-950 overflow-hidden relative font-sans"> 
      
      {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-neutral-950 border-r border-neutral-900 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* LOGO EN SIDEBAR */}
        <div className="py-3.5 flex flex-col items-center justify-center px-4 border-b border-neutral-800/50 text-center gap-1.5 relative shrink-0">
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 text-neutral-400 hover:text-white"><FaTimes size={20} /></button>
          
          {businessConfig?.logo ? (
            <img src={businessConfig.logo} alt="Logo" className="w-11 h-11 rounded-xl object-cover bg-white shadow-sm" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-verde-pastel shadow-[0_0_15px_rgba(167,243,208,0.4)] flex items-center justify-center">
              <FaStore className="text-neutral-950 text-xs" />
            </div>
          )}
          <h2 className="text-base font-extrabold text-white tracking-tight leading-tight break-words w-full">
            {businessConfig?.nombre || 'Cargando...'}
          </h2>
        </div>

        {/* USUARIO */}
        <div className="px-5 py-3 border-b border-neutral-800/50 bg-neutral-900/30 shrink-0">
          <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1.5 font-bold">Cajero Activo</p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-verde-pastel/10 border border-verde-pastel/20 flex items-center justify-center shrink-0">
              <span className="text-verde-pastel font-bold text-sm">{user?.nombre?.charAt(0) || 'U'}</span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm truncate text-white">{user.nombre}</p>
              <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider">{user.rol}</p>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN (Sin barra de scroll visible y con altura compacta) */}
        <nav className="flex-1 px-4 py-2.5 space-y-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            const isFiados = item.path === '/fiados';
            const showAlerta = isFiados && hayAlertasFiados;

            return (
              <Link key={item.path} to={item.path} onClick={handleNavigation}>
                <motion.div whileTap={{ scale: 0.98 }}
                  className={`flex flex-col px-4 py-2 rounded-lg transition-all duration-200 relative ${
                    isActive 
                      ? 'bg-verde-pastel/10 border-l-4 border-verde-pastel shadow-lg shadow-verde-pastel/5' 
                      : 'hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <Icon className={`text-base ${isActive ? 'text-verde-pastel' : 'text-neutral-500'} ${showAlerta && !isActive ? 'text-red-400 animate-pulse' : ''}`} />
                      
                      {showAlerta && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                      )}
                    </div>
                    
                    <span className={`text-sm tracking-wide font-medium ${isActive ? 'text-verde-pastel font-semibold' : 'text-neutral-400 hover:text-neutral-200'}`}>
                      {item.label}
                    </span>
                  </div>
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* PIE DEL MENÚ: TÉRMINOS Y CONDICIONES + CERRAR SESIÓN */}
        <div className="p-3 border-t border-neutral-800/50 space-y-1 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarModalLectura(true)}
            className="w-full flex items-center gap-3 px-4 py-2 text-neutral-400 hover:text-verde-pastel hover:bg-neutral-900 rounded-lg transition-colors text-xs font-medium cursor-pointer"
          >
            <FaFileContract className="text-verde-pastel/80 shrink-0" size={14} />
            <span className="underline underline-offset-4 decoration-neutral-700 hover:decoration-verde-pastel">
              Términos y Condiciones
            </span>
          </button>

          <button 
            type="button"
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-4 py-2 text-rosado-pastel/90 hover:text-rosado-pastel hover:bg-rosado-pastel/10 rounded-lg transition-colors text-sm font-semibold"
          >
            <FaSignOutAlt /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">        
        <header className="md:hidden h-16 border-b border-slate-200 bg-white flex items-center px-4 justify-between z-20 relative shadow-sm">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-800 p-2 focus:outline-none shrink-0"><FaBars size={22} /></button>
          
          <div className="flex items-center gap-2 max-w-[65%] justify-center">
            {businessConfig?.logo ? (
              <img src={businessConfig.logo} alt="Logo" className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full bg-verde-pastel shrink-0"></div>
            )}
            <span className="font-extrabold text-slate-950 tracking-tight leading-tight text-sm text-left break-words line-clamp-2">
              {businessConfig?.nombre || 'Cargando...'}
            </span>
          </div>
          
          <div className="w-8 shrink-0"></div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 md:p-8 overflow-y-auto"> 
          <Outlet />
        </main>
      </div>

      {/* 1. MODAL OBLIGATORIO (Solo salta en el primer inicio de sesión de un empleado nuevo) */}
      <TerminosModal
        isOpen={mostrarModalObligatorio}
        modoObligatorio={true}
        onAccept={handleAceptarTerminosObligatorios}
        onDecline={handleLogout}
      />

      {/* 2. MODAL DE LECTURA (Cuando hacen clic en "Términos y Condiciones" en el menú lateral) */}
      <TerminosModal
        isOpen={mostrarModalLectura}
        modoObligatorio={false}
        onClose={() => setMostrarModalLectura(false)}
      />
      <AsistenteIA />
    </div>
  );
}