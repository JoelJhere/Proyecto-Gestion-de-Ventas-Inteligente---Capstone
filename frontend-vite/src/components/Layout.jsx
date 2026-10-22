import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FaShoppingCart, FaBoxOpen, FaHistory, FaCog, FaSignOutAlt, 
  FaBars, FaTimes, FaTruck, FaClipboardList, FaFileInvoiceDollar, 
  FaStore, FaUsers, FaFileContract 
} from 'react-icons/fa';
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
    { path: '/ventas', icon: FaShoppingCart, label: 'Punto de Venta' },
    { path: '/fiados', icon: FaFileInvoiceDollar, label: 'Control de Fiados' },
    { path: '/productos', icon: FaBoxOpen, label: 'Gestion de Productos' },
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
    <div className="flex h-[100dvh] bg-slate-50 text-slate-900 overflow-hidden relative font-sans antialiased"> 
      
      {/* OVERLAY MÓVIL */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-30 md:hidden" 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* SIDEBAR BLANCO ESTILO FIGMA CON SELECCIÓN EN VERDE PASTEL */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-68 bg-white border-r border-slate-200/90 flex flex-col justify-between transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 shadow-[4px_0_24px_rgba(15,23,42,0.03)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* BLOQUE SUPERIOR: LOGO + CAJERO */}
        <div className="shrink-0">
          {/* CABECERA DEL NEGOCIO ALINEADA HORIZONTALMENTE (Estilo Figma) */}
          <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-3.5 relative">
            <button 
              onClick={() => setIsMobileMenuOpen(false)} 
              className="md:hidden absolute top-4 right-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <FaTimes size={18} />
            </button>
            
            {businessConfig?.logo ? (
              <img 
                src={businessConfig.logo} 
                alt="Logo" 
                className="w-11 h-11 rounded-xl object-cover bg-white border border-slate-200 shadow-2xs shrink-0" 
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-verde-pastel/60 border border-emerald-200 flex items-center justify-center shrink-0 shadow-2xs">
                <FaStore className="text-emerald-950 text-lg" />
              </div>
            )}

            <div className="min-w-0 flex-1 pr-6 md:pr-0">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug truncate" title={businessConfig?.nombre}>
                {businessConfig?.nombre || 'Cargando...'}
              </h2>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                Sistema de Gestión POS
              </p>
            </div>
          </div>

          {/* TARJETA DE CAJERO ACTIVO */}
          <div className="px-4 pt-4 pb-2">
            <div className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/70 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-verde-pastel/50 border border-emerald-200/80 flex items-center justify-center shrink-0">
                <span className="text-emerald-950 font-extrabold text-sm">
                  {user?.nombre?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Cajero Activo
                  </p>
                  <span className="text-[10px] font-bold text-emerald-800 bg-verde-pastel/40 px-1.5 py-0.2 rounded">
                    {user.rol}
                  </span>
                </div>
                <p className="font-bold text-sm truncate text-slate-800 mt-0.5">
                  {user.nombre}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN PRINCIPAL (Con mayor espacio y simetría vertical) */}
        <nav className="flex-1 px-4 py-3 space-y-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <p className="px-3 pb-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Módulos del Sistema
          </p>

          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            
            const isFiados = item.path === '/fiados';
            const showAlerta = isFiados && hayAlertasFiados;

            return (
              <Link key={item.path} to={item.path} onClick={handleNavigation} className="block">
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-between px-3.5 py-3 rounded-xl transition-all duration-200 relative ${
                    isActive 
                      ? 'bg-verde-pastel text-emerald-950 font-bold shadow-[0_4px_14px_rgba(167,243,208,0.5)]' 
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-semibold'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative shrink-0">
                      <Icon className={`text-[17px] transition-colors ${
                        isActive 
                          ? 'text-emerald-950' 
                          : showAlerta 
                            ? 'text-red-500 animate-pulse' 
                            : 'text-slate-400'
                      }`} />
                      
                      {showAlerta && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-white"></span>
                        </span>
                      )}
                    </div>
                    
                    <span className="text-sm tracking-tight truncate">
                      {item.label}
                    </span>
                  </div>

                  {showAlerta && (
                    <span className="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0">
                      Hoy
                    </span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* PIE DEL MENÚ: TÉRMINOS Y CONDICIONES + CERRAR SESIÓN */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarModalLectura(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-slate-600 hover:text-emerald-800 hover:bg-white rounded-xl transition-all text-xs font-semibold cursor-pointer border border-transparent hover:border-slate-200/80"
          >
            <FaFileContract className="text-emerald-600 shrink-0" size={14} />
            <span className="underline underline-offset-4 decoration-slate-300 hover:decoration-emerald-500">
              Términos y Condiciones
            </span>
          </button>

          <button 
            type="button"
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3.5 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50/80 rounded-xl transition-all text-sm font-bold cursor-pointer"
          >
            <FaSignOutAlt size={15} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* ÁREA CENTRAL */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">        
        <header className="md:hidden h-16 border-b border-slate-200 bg-white flex items-center px-4 justify-between z-20 relative shadow-2xs">
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="text-slate-800 p-2 focus:outline-none shrink-0"
          >
            <FaBars size={22} />
          </button>
          
          <div className="flex items-center gap-2.5 max-w-[70%] justify-center">
            {businessConfig?.logo ? (
              <img src={businessConfig.logo} alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-verde-pastel shrink-0"></div>
            )}
            <span className="font-extrabold text-slate-900 tracking-tight leading-tight text-sm text-left truncate">
              {businessConfig?.nombre || 'Cargando...'}
            </span>
          </div>
          
          <div className="w-8 shrink-0"></div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 md:p-7 overflow-y-auto"> 
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

      {/* 3. ASISTENTE IA FLOTANTE */}
      <AsistenteIA />
    </div>
  );
}