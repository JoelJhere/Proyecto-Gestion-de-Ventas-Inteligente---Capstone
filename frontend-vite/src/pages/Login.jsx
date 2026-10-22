import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUserShield, FaLock, FaSpinner, FaStore, FaIdCard, 
  FaUserTie, FaCheckCircle, FaChartLine, FaRobot, FaFileInvoiceDollar 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import TerminosModal from '../components/TerminosModal';

// --- COMPONENTE DE CAMPO DE TEXTO LIMPIO ---
const InputField = ({ icon: Icon, type, value, onChange, placeholder, disabled, required = true }) => (
  <div className="relative group">
    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
      <Icon className="text-slate-400 group-focus-within:text-emerald-600 transition-colors duration-200 text-sm" />
    </div>
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      required={required}
      className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl focus:ring-3 focus:ring-verde-pastel/35 focus:border-emerald-500 outline-none transition-all text-slate-900 placeholder-slate-400 text-sm font-medium disabled:opacity-50"
    />
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Validar si el usuario fue redirigido por caducidad de token
  const queryParams = new URLSearchParams(location.search);
  const sesionExpirada = queryParams.get('motivo') === 'expirado';

  // Estados Generales
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [tiempoBloqueo, setTiempoBloqueo] = useState(0);

  // Estados de Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de Registro SaaS
  const [regNombreNegocio, setRegNombreNegocio] = useState('');
  const [regRuc, setRegRuc] = useState('');
  const [regNombreDuenio, setRegNombreDuenio] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  const [isTerminosOpen, setIsTerminosOpen] = useState(false);

  // Sistema de cuenta regresiva para bloqueos de seguridad
  useEffect(() => {
    let timer;
    if (tiempoBloqueo > 0) {
      timer = setInterval(() => {
        setTiempoBloqueo((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [tiempoBloqueo]);

  const toastStyle = {
    borderRadius: '12px',
    background: '#0f172a',
    color: '#fff',
    border: '1px solid #334155',
  };

  // --- FUNCIÓN DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading || tiempoBloqueo > 0) return;

    if (!email.trim() || !password.trim()) {
      return toast.error('Ingresa tu correo y contraseña.', { style: toastStyle });
    }

    setIsLoading(true);
    try {
      const res = await axios.post('/auth/login', { email, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      setIntentosFallidos(0);
      toast.success('¡Sesión iniciada correctamente!', { style: toastStyle, iconTheme: { primary: '#a7f3d0', secondary: '#0f172a' } });
      
      setTimeout(() => {
        if (res.data.user.rol === 'SUPER_ADMIN') {
          navigate('/master');
        } else {
          navigate('/ventas');
        }
      }, 1000);
      
    } catch (err) {
      console.error("Fallo de autenticación interno:", err);
      const nuevosIntentos = intentosFallidos + 1;
      setIntentosFallidos(nuevosIntentos);

      if (nuevosIntentos >= 3) {
        const penalizacion = nuevosIntentos * 5; 
        setTiempoBloqueo(penalizacion);
        toast.error(`Demasiados intentos. Bloqueo temporal de ${penalizacion} segundos.`, { style: toastStyle });
      } else {
        toast.error(err.response?.data?.message || 'Correo o contraseña incorrectos.', { style: toastStyle });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNCIÓN DE REGISTRO DE NUEVA BODEGA ---
  const handleRegistro = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (!regNombreNegocio.trim() || !regNombreDuenio.trim() || !regEmail.trim() || !regPassword.trim()) {
      return toast.error('Completa todos los campos obligatorios.', { style: toastStyle });
    }

    if (regRuc && regRuc.length !== 11) {
      return toast.error('El RUC debe tener exactamente 11 dígitos.', { style: toastStyle });
    }

    if (regPassword.length < 6) {
      return toast.error('La contraseña debe tener al menos 6 caracteres.', { style: toastStyle });
    }

    if (!aceptoTerminos) {
      return toast.error('Debes aceptar los Términos y Condiciones para registrar tu bodega.', { style: toastStyle });
    }

    setIsLoading(true);
    try {
      const payload = {
        nombreNegocio: regNombreNegocio,
        ruc: regRuc,
        nombreDuenio: regNombreDuenio,
        email: regEmail,
        password: regPassword
      };

      const res = await axios.post('/auth/registro-saas', payload);
      
      toast.success(res.data.message, { style: toastStyle, iconTheme: { primary: '#a7f3d0', secondary: '#0f172a' } });
      
      // Auto-llenar el login y regresar a la vista de login
      setEmail(regEmail);
      setPassword(regPassword);
      setIsRegistering(false);
      
    } catch (err) {
      console.error("Error al registrar:", err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al registrar el negocio.', { style: toastStyle });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e6faef] via-slate-50 to-[#d5f5e5] relative overflow-hidden font-sans antialiased px-4 py-8">
      
      {/* Formas suaves decorativas de fondo (Mezcla de Blanco y Verde Pastel) */}
      <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-verde-pastel/45 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />

      {/* CONTENEDOR CENTRAL MITAD Y MITAD (Inspirado en tu 3ra imagen) */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_20px_60px_rgba(15,23,42,0.10)] border border-white/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10">
        
        {/* ================= MITAD IZQUIERDA: PANEL VISUAL E ILUSTRATIVO ================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          
          {/* Ondas y círculos decorativos estilo la 3ra imagen */}
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-verde-pastel/15 blur-xl pointer-events-none" />
          <div className="absolute bottom-10 -left-16 w-56 h-56 rounded-full bg-emerald-400/15 blur-xl pointer-events-none" />

          {/* Logo e Identidad */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-xs px-4 py-2 rounded-2xl border border-white/15 mb-6">
              <div className="w-8 h-8 rounded-xl bg-verde-pastel text-emerald-950 flex items-center justify-center font-black">
                <FaStore size={16} />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">
                Venda<span className="text-verde-pastel">IA</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight text-white">
              Gestión inteligente para tu bodega en un solo lugar.
            </h1>
            <p className="text-emerald-100/85 text-sm font-medium mt-3 leading-relaxed">
              Controla tus ventas, inventario, cuentas por cobrar y facturación electrónica con apoyo de Inteligencia Artificial.
            </p>
          </div>

          {/* Tarjetas ilustrativas del sistema POS */}
          <div className="relative z-10 space-y-3 my-8">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaFileInvoiceDollar size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Punto de Venta y Fiados</p>
                <p className="text-xs text-emerald-100/80">Boletas, facturas SUNAT y avisos por WhatsApp.</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaChartLine size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Control de Caja e Inventario</p>
                <p className="text-xs text-emerald-100/80">Flujo de capital en vivo, lector de barras y compras.</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaRobot size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Asistente VendaIA Integrado</p>
                <p className="text-xs text-emerald-100/80">Consulta tus ganancias y alertas de stock al instante.</p>
              </div>
            </div>
          </div>

          {/* Pie del panel izquierdo */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex items-center justify-between text-xs text-emerald-100/80 font-medium">
            <span className="flex items-center gap-1.5">
              <FaCheckCircle className="text-verde-pastel" /> Plataforma Multi-Bodega
            </span>
            <span>Perú • SUNAT</span>
          </div>
        </div>

        {/* ================= MITAD DERECHA: FORMULARIO DE LOGIN / REGISTRO ================= */}
        <div className="lg:col-span-7 p-7 sm:p-10 md:p-12 bg-white flex flex-col justify-center">
          
          {/* Selector superior integrado (Sin encimarse con el formulario) */}
          <div className="w-full max-w-xs mx-auto flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 mb-7">
            <button 
              type="button"
              onClick={() => setIsRegistering(false)}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                !isRegistering 
                  ? 'bg-verde-pastel text-emerald-950 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button 
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                isRegistering 
                  ? 'bg-verde-pastel text-emerald-950 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Crear Bodega
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!isRegistering ? (
              
              /* ============= VISTA DE LOGIN ============ */
              <motion.div 
                key="login"
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 20 }} 
                transition={{ duration: 0.22 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-7 text-center sm:text-left">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    Bienvenido de nuevo
                  </h2>
                  <p className="text-slate-500 font-medium text-sm mt-1">
                    Ingresa tus credenciales para acceder al panel de tu bodega.
                  </p>
                </div>

                {sesionExpirada && (
                  <motion.div 
                    initial={{ opacity: 0, y: -8 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl mb-5 text-xs sm:text-sm"
                  >
                    <p className="font-bold">Tu sesión ha finalizado por seguridad</p>
                    <p className="text-amber-700 text-xs mt-0.5">Vuelve a ingresar tus datos para continuar trabajando.</p>
                  </motion.div>
                )}

                <form onSubmit={handleLogin} noValidate className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Correo Electrónico
                    </label>
                    <InputField 
                      icon={FaUserShield} 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      disabled={tiempoBloqueo > 0 || isLoading} 
                      placeholder="admin@mibodega.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Contraseña
                    </label>
                    <InputField 
                      icon={FaLock} 
                      type="password" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      disabled={tiempoBloqueo > 0 || isLoading} 
                      placeholder="••••••••" 
                    />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={tiempoBloqueo > 0 || isLoading}
                      className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-sm sm:text-base py-3.5 px-5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isLoading ? (
                        <><FaSpinner className="animate-spin" /> Verificando acceso...</>
                      ) : tiempoBloqueo > 0 ? (
                        <><FaLock /> Bloqueado temporalmente ({tiempoBloqueo}s)</>
                      ) : (
                        'Ingresar al Sistema'
                      )}
                    </button>
                  </div>
                </form>

                <p className="text-center text-xs text-slate-500 font-medium mt-6">
                  ¿Aún no tienes una cuenta para tu negocio?{' '}
                  <button 
                    type="button" 
                    onClick={() => setIsRegistering(true)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline underline-offset-4 cursor-pointer"
                  >
                    Registra tu bodega aquí
                  </button>
                </p>
              </motion.div>

            ) : (

              /* ========== VISTA DE REGISTRO SAAS (BIEN ESPACIADA Y SIMÉTRICA) ======= */
              <motion.div 
                key="registro"
                initial={{ opacity: 0, x: 20 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -20 }} 
                transition={{ duration: 0.22 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-5 text-center sm:text-left">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2.5">
                    <span className="w-8 h-8 rounded-lg bg-verde-pastel/50 text-emerald-900 flex items-center justify-center text-sm">
                      <FaStore />
                    </span>
                    Registra tu Bodega
                  </h2>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1">
                    Crea tu cuenta de administrador en segundos y comienza a vender hoy mismo.
                  </p>
                </div>

                <form onSubmit={handleRegistro} noValidate className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        Nombre de Bodega *
                      </label>
                      <InputField 
                        icon={FaStore} 
                        type="text" 
                        value={regNombreNegocio} 
                        onChange={e => setRegNombreNegocio(e.target.value)} 
                        disabled={isLoading} 
                        placeholder="Ej: Bodega Don Pepe" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        RUC (Opcional)
                      </label>
                      <InputField 
                        icon={FaIdCard} 
                        type="text" 
                        value={regRuc} 
                        onChange={e => setRegRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} 
                        disabled={isLoading} 
                        placeholder="11 dígitos" 
                        required={false} 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Nombre del Dueño *
                    </label>
                    <InputField 
                      icon={FaUserTie} 
                      type="text" 
                      value={regNombreDuenio} 
                      onChange={e => setRegNombreDuenio(e.target.value)} 
                      disabled={isLoading} 
                      placeholder="Tu nombre completo" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Correo Administrador *
                    </label>
                    <InputField 
                      icon={FaUserShield} 
                      type="email" 
                      value={regEmail} 
                      onChange={e => setRegEmail(e.target.value)} 
                      disabled={isLoading} 
                      placeholder="correo@ejemplo.com" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Crea tu Contraseña *
                    </label>
                    <InputField 
                      icon={FaLock} 
                      type="password" 
                      value={regPassword} 
                      onChange={e => setRegPassword(e.target.value)} 
                      disabled={isLoading} 
                      placeholder="Mínimo 6 caracteres" 
                    />
                  </div>

                  {/* TÉRMINOS Y CONDICIONES INTERACTIVOS */}
                  <div className="pt-1 flex items-start gap-2.5">
                    <input 
                      type="checkbox" 
                      checked={aceptoTerminos}
                      onChange={(e) => setAceptoTerminos(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-slate-300 accent-emerald-600 cursor-pointer shrink-0" 
                    />
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      Al registrarte, aceptas nuestros{' '}
                      <button
                        type="button"
                        onClick={() => setIsTerminosOpen(true)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold underline underline-offset-4 decoration-emerald-400 cursor-pointer transition-colors"
                      >
                        Términos y Condiciones y la Política de Privacidad
                      </button>{' '}
                      de datos del sistema POS.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-sm sm:text-base py-3.5 px-5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-60 cursor-pointer"
                    >
                      {isLoading ? (
                        <><FaSpinner className="animate-spin" /> Creando cuenta...</>
                      ) : (
                        'Crear Bodega e Iniciar Sesión'
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>

      {/* VENTANA FLOTANTE DE TÉRMINOS Y CONDICIONES (DESDE EL REGISTRO) */}
      <TerminosModal 
        isOpen={isTerminosOpen}
        modoObligatorio={false}
        onClose={() => {
          setAceptoTerminos(true);
          setIsTerminosOpen(false);
        }}
      />
    </div>
  );
}