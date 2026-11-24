import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaUserShield, FaLock, FaSpinner, FaStore, FaIdCard, 
  FaUserTie, FaCheckCircle, FaChartLine, FaRobot, 
  FaFileInvoiceDollar, FaEye, FaEyeSlash 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import TerminosModal from '../components/TerminosModal';

// --- COMPONENTE DE CAMPO DE TEXTO LIMPIO (CON VER/OCULTAR CONTRASEÑA OPCIONAL) ---
const InputField = ({
  icon: Icon,
  type,
  value,
  onChange,
  placeholder,
  disabled,
  required = true,
  esPassword = false
}) => {
  const [mostrar, setMostrar] = useState(false);
  const tipoFinal = esPassword ? (mostrar ? 'text' : 'password') : type;

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <Icon className="text-slate-400 group-focus-within:text-emerald-600 transition-colors duration-200 text-sm" />
      </div>
      <input
        type={tipoFinal}
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        required={required}
        className={`w-full pl-10 ${esPassword ? 'pr-10' : 'pr-3.5'} py-2 bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl focus:ring-3 focus:ring-verde-pastel/35 focus:border-emerald-500 outline-none transition-all text-slate-900 placeholder-slate-400 text-sm font-medium disabled:opacity-50`}
      />
      {esPassword && (
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setMostrar(prev => !prev)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer disabled:opacity-40"
          title={mostrar ? 'Ocultar contraseña' : 'Ver contraseña'}
        >
          {mostrar ? <FaEyeSlash size={15} /> : <FaEye size={15} />}
        </button>
      )}
    </div>
  );
};

// Reglas equilibradas de seguridad para nuevas contraseñas (sin símbolos complicados en tablet)
const evaluarPassword = (pass = '') => ({
  minLongitud: pass.length >= 8,
  tieneMayuscula: /[A-Z]/.test(pass),
  tieneNumero: /\d/.test(pass)
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Validar si el usuario fue redirigido por caducidad de token
  const queryParams = new URLSearchParams(location.search);
  const sesionExpirada = queryParams.get('motivo') === 'expirado';

  // Estados Generales + Candado síncrono anti-doble clic
  const [isLoading, setIsLoading] = useState(false);
  const accionEnCursoRef = useRef(false);
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

  const reglasPass = evaluarPassword(regPassword);
  const passwordRegSegura = reglasPass.minLongitud && reglasPass.tieneMayuscula && reglasPass.tieneNumero;

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
    if (accionEnCursoRef.current || isLoading || tiempoBloqueo > 0) return;

    const emailLimpio = email.trim().toLowerCase();
    if (!emailLimpio || !password.trim()) {
      return toast.error('Ingresa tu correo y contraseña.', { id: 'auth-login', style: toastStyle });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      return toast.error('Ingresa un correo electrónico válido.', { id: 'auth-login', style: toastStyle });
    }

    accionEnCursoRef.current = true;
    setIsLoading(true);
    try {
      const res = await axios.post('/auth/login', { email: emailLimpio, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      setIntentosFallidos(0);
      toast.success('¡Sesión iniciada correctamente!', {
        id: 'auth-login',
        style: toastStyle,
        iconTheme: { primary: '#a7f3d0', secondary: '#0f172a' }
      });
      
      setTimeout(() => {
        if (res.data.user.rol === 'SUPER_ADMIN') {
          navigate('/master');
        } else {
          navigate('/ventas');
        }
      }, 650);
    } catch (err) {
      console.error('Fallo de autenticación interno:', err);
      const nuevosIntentos = intentosFallidos + 1;
      setIntentosFallidos(nuevosIntentos);

      if (nuevosIntentos >= 3) {
        const penalizacion = nuevosIntentos * 5;
        setTiempoBloqueo(penalizacion);
        toast.error(`Demasiados intentos. Bloqueo temporal de ${penalizacion} segundos.`, {
          id: 'auth-login',
          style: toastStyle
        });
      } else {
        toast.error(err.response?.data?.message || 'Correo o contraseña incorrectos.', {
          id: 'auth-login',
          style: toastStyle
        });
      }
      accionEnCursoRef.current = false;
      setIsLoading(false);
    }
  };

  // --- FUNCIÓN DE REGISTRO DE NUEVA BODEGA ---
  const handleRegistro = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current || isLoading) return;

    const nombreNegocioLimpio = regNombreNegocio.trim();
    const nombreDuenioLimpio = regNombreDuenio.trim();
    const emailLimpio = regEmail.trim().toLowerCase();
    const rucLimpio = regRuc.trim();

    if (!nombreNegocioLimpio || !nombreDuenioLimpio || !emailLimpio || !regPassword) {
      return toast.error('Completa todos los campos obligatorios.', { id: 'auth-reg', style: toastStyle });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLimpio)) {
      return toast.error('Ingresa un correo electrónico válido.', { id: 'auth-reg', style: toastStyle });
    }

    if (rucLimpio) {
      if (rucLimpio.length !== 11) {
        return toast.error('El RUC debe tener exactamente 11 dígitos.', { id: 'auth-reg', style: toastStyle });
      }
      if (!rucLimpio.startsWith('10') && !rucLimpio.startsWith('20')) {
        return toast.error('El RUC debe iniciar con 10 o 20.', { id: 'auth-reg', style: toastStyle });
      }
    }

    if (!passwordRegSegura) {
      return toast.error(
        'La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un número.',
        { id: 'auth-reg', style: toastStyle }
      );
    }

    if (!aceptoTerminos) {
      return toast.error('Debes aceptar los Términos y Condiciones para registrar tu bodega.', {
        id: 'auth-reg',
        style: toastStyle
      });
    }

    accionEnCursoRef.current = true;
    setIsLoading(true);
    try {
      const payload = {
        nombreNegocio: nombreNegocioLimpio,
        ruc: rucLimpio,
        nombreDuenio: nombreDuenioLimpio,
        email: emailLimpio,
        password: regPassword
      };

      const res = await axios.post('/auth/registro-saas', payload);
      
      toast.success(res.data.message || 'Bodega registrada con éxito.', {
        id: 'auth-reg',
        style: toastStyle,
        iconTheme: { primary: '#a7f3d0', secondary: '#0f172a' }
      });
      
      // Auto-llenar el login y regresar a la vista de login
      setEmail(emailLimpio);
      setPassword(regPassword);
      setIsRegistering(false);
    } catch (err) {
      console.error('Error al registrar:', err);
      toast.error(err.response?.data?.message || 'Ocurrió un error al registrar el negocio.', {
        id: 'auth-reg',
        style: toastStyle
      });
    } finally {
      accionEnCursoRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-[#e6faef] via-slate-50 to-[#d5f5e5] relative overflow-x-hidden font-sans antialiased px-4 py-3 sm:py-5">
      
      {/* Formas suaves decorativas de fondo */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-verde-pastel/45 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />

      {/* CONTENEDOR CENTRAL COMPACTO (Sin scroll vertical en laptop/PC) */}
      <div className="w-full max-w-[920px] bg-white rounded-3xl shadow-[0_20px_55px_rgba(15,23,42,0.10)] border border-white/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 z-10">
        
        {/* ================= MITAD IZQUIERDA: PANEL VISUAL COMPACTO ================= */}
        <div className="lg:col-span-5 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 lg:p-7 flex flex-col justify-between relative overflow-hidden">
          
          <div className="absolute -top-14 -right-14 w-52 h-52 rounded-full bg-verde-pastel/15 blur-xl pointer-events-none" />
          <div className="absolute bottom-8 -left-14 w-48 h-48 rounded-full bg-emerald-400/15 blur-xl pointer-events-none" />

          {/* Logo e Identidad */}
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-xs px-3.5 py-1.5 rounded-2xl border border-white/15 mb-4">
              <div className="w-7 h-7 rounded-lg bg-verde-pastel text-emerald-950 flex items-center justify-center font-black">
                <FaStore size={14} />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Venda<span className="text-verde-pastel">IA</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold leading-snug tracking-tight text-white">
              Gestión inteligente para tu bodega en un solo lugar.
            </h1>
            <p className="text-emerald-100/85 text-xs sm:text-[13px] font-medium mt-2 leading-relaxed">
              Controla ventas, inventario, fiados y facturación electrónica SUNAT con apoyo de Inteligencia Artificial.
            </p>
          </div>

          {/* Tarjetas ilustrativas (ocultas en celular para priorizar el formulario, visibles en PC/laptop) */}
          <div className="hidden lg:block relative z-10 space-y-2.5 my-5">
            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaFileInvoiceDollar size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Punto de Venta y Fiados</p>
                <p className="text-[11px] text-emerald-100/80 leading-snug">Boletas, facturas SUNAT y avisos por WhatsApp.</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaChartLine size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Control de Caja e Inventario</p>
                <p className="text-[11px] text-emerald-100/80 leading-snug">Flujo de capital en vivo, lector de barras y compras.</p>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-verde-pastel text-emerald-950 flex items-center justify-center shrink-0">
                <FaRobot size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Asistente VendaIA Integrado</p>
                <p className="text-[11px] text-emerald-100/80 leading-snug">Consulta tus ganancias y alertas de stock al instante.</p>
              </div>
            </div>
          </div>

          {/* Pie del panel izquierdo */}
          <div className="hidden lg:flex relative z-10 pt-3 border-t border-white/15 items-center justify-between text-[11px] text-emerald-100/80 font-medium">
            <span className="flex items-center gap-1.5">
              <FaCheckCircle className="text-verde-pastel" /> Plataforma Multi-Bodega
            </span>
            <span>Perú • SUNAT</span>
          </div>
        </div>

        {/* ================= MITAD DERECHA: FORMULARIO COMPACTO ================= */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:px-10 lg:py-7 bg-white flex flex-col justify-center">
          
          {/* Selector superior integrado */}
          <div className="w-full max-w-[280px] mx-auto flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 mb-5">
            <button 
              type="button"
              disabled={isLoading}
              onClick={() => setIsRegistering(false)}
              className={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer disabled:opacity-60 ${
                !isRegistering 
                  ? 'bg-verde-pastel text-emerald-950 shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Iniciar Sesión
            </button>
            <button 
              type="button"
              disabled={isLoading}
              onClick={() => setIsRegistering(true)}
              className={`flex-1 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer disabled:opacity-60 ${
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
                initial={{ opacity: 0, x: -16 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: 16 }} 
                transition={{ duration: 0.2 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-5 text-center sm:text-left">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Bienvenido de nuevo
                  </h2>
                  <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
                    Ingresa tus credenciales para acceder al panel de tu bodega.
                  </p>
                </div>

                {sesionExpirada && (
                  <motion.div 
                    initial={{ opacity: 0, y: -6 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2.5 rounded-xl mb-4 text-xs"
                  >
                    <p className="font-bold">Tu sesión ha finalizado por seguridad</p>
                    <p className="text-amber-700 mt-0.5">Vuelve a ingresar tus datos para continuar trabajando.</p>
                  </motion.div>
                )}

                <form onSubmit={handleLogin} noValidate className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
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
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Contraseña
                    </label>
                    <InputField 
                      icon={FaLock} 
                      type="password"
                      esPassword
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      disabled={tiempoBloqueo > 0 || isLoading} 
                      placeholder="••••••••" 
                    />
                  </div>

                  <div className="pt-1">
                    <button 
                      type="submit" 
                      disabled={tiempoBloqueo > 0 || isLoading}
                      className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-sm py-3 px-5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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

                <p className="text-center text-xs text-slate-500 font-medium mt-5">
                  ¿Aún no tienes una cuenta para tu negocio?{' '}
                  <button 
                    type="button" 
                    disabled={isLoading}
                    onClick={() => setIsRegistering(true)}
                    className="text-emerald-700 hover:text-emerald-900 font-bold underline underline-offset-4 cursor-pointer"
                  >
                    Registra tu bodega aquí
                  </button>
                </p>
              </motion.div>

            ) : (

              /* ========== VISTA DE REGISTRO SAAS COMPACTA Y SEGURA ======= */
              <motion.div 
                key="registro"
                initial={{ opacity: 0, x: 16 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -16 }} 
                transition={{ duration: 0.2 }}
                className="w-full max-w-md mx-auto"
              >
                <div className="mb-4 text-center sm:text-left">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center sm:justify-start gap-2">
                    <span className="w-7 h-7 rounded-lg bg-verde-pastel/50 text-emerald-900 flex items-center justify-center text-xs">
                      <FaStore />
                    </span>
                    Registra tu Bodega
                  </h2>
                  <p className="text-slate-500 font-medium text-xs mt-0.5">
                    Crea tu cuenta de administrador y comienza a vender hoy mismo.
                  </p>
                </div>

                <form onSubmit={handleRegistro} noValidate className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
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
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        RUC (Opcional)
                      </label>
                      <InputField 
                        icon={FaIdCard} 
                        type="text" 
                        value={regRuc} 
                        onChange={e => setRegRuc(e.target.value.replace(/\D/g, '').slice(0, 11))} 
                        disabled={isLoading} 
                        placeholder="11 dígitos (10 o 20...)" 
                        required={false} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
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
                      <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                        Correo Admin *
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
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Crea tu Contraseña *
                    </label>
                    <InputField 
                      icon={FaLock} 
                      type="password"
                      esPassword
                      value={regPassword} 
                      onChange={e => setRegPassword(e.target.value)} 
                      disabled={isLoading} 
                      placeholder="Ej: Bodega2026" 
                    />

                    {/* Indicadores compactos de contraseña segura en vivo */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {[
                        { ok: reglasPass.minLongitud, texto: '8+ caracteres' },
                        { ok: reglasPass.tieneMayuscula, texto: '1 mayúscula' },
                        { ok: reglasPass.tieneNumero, texto: '1 número' }
                      ].map((regla, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                            regla.ok
                              ? 'bg-verde-pastel/40 text-emerald-900 border-emerald-300'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          <FaCheckCircle
                            size={9}
                            className={regla.ok ? 'text-emerald-600' : 'text-slate-300'}
                          />
                          {regla.texto}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* TÉRMINOS Y CONDICIONES INTERACTIVOS */}
                  <div className="pt-0.5 flex items-start gap-2">
                    <input 
                      type="checkbox" 
                      checked={aceptoTerminos}
                      onChange={(e) => setAceptoTerminos(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 accent-emerald-600 cursor-pointer shrink-0" 
                    />
                    <p className="text-[11px] text-slate-600 leading-snug font-medium">
                      Al registrarte, aceptas nuestros{' '}
                      <button
                        type="button"
                        onClick={() => setIsTerminosOpen(true)}
                        className="text-emerald-700 hover:text-emerald-900 font-bold underline underline-offset-4 decoration-emerald-400 cursor-pointer transition-colors"
                      >
                        Términos y Condiciones y la Política de Privacidad
                      </button>{' '}
                      del sistema POS.
                    </p>
                  </div>

                  <div className="pt-1">
                    <button 
                      type="submit" 
                      disabled={isLoading}
                      className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold text-sm py-3 px-5 rounded-xl transition-all shadow-xs flex justify-center items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
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