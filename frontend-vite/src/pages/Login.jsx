import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserShield, FaLock, FaSpinner, FaStore, FaIdCard, FaUserTie } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

// --- COMPONENTES VISUALES ---
  const InputField = ({ icon: Icon, type, value, onChange, placeholder, disabled, required = true }) => (
    <div className="relative group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Icon className="text-neutral-500 group-focus-within:text-verde-pastel transition-colors duration-300" />
      </div>
      <input
        type={type} value={value} onChange={onChange} disabled={disabled} placeholder={placeholder} required={required}
        className="w-full pl-11 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-1 focus:ring-verde-pastel focus:border-verde-pastel outline-none transition-all text-white placeholder-neutral-600 shadow-inner text-sm font-medium disabled:opacity-50"
      />
    </div>
  );

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Validar si el usuario fue redirigido por caducidad de token
  const queryParams = new URLSearchParams(location.search);
  const sesionExpirada = queryParams.get('motivo') === 'expirado';

  const { businessConfig } = useBusiness();

  // Estados Generales
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // Alterna entre Login y Registro
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
    background: '#0a0a0a',
    color: '#fff',
    border: '1px solid #262626',
  };

  // --- FUNCIÓN DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (isLoading || tiempoBloqueo > 0) return;

    setIsLoading(true);
    try {
      const res = await axios.post('/auth/login', { email, password });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      setIntentosFallidos(0);
      toast.success('¡Sesión iniciada correctamente!', { style: toastStyle, iconTheme: { primary: '#a7f3d0', secondary: '#000' } });
      
      setTimeout(() => navigate('/ventas'), 1000);
      
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

    // Mini validación de RUC
    if (regRuc && regRuc.length !== 11) {
      return toast.error('El RUC debe tener exactamente 11 dígitos.', { style: toastStyle });
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
      
      toast.success(res.data.message, { style: toastStyle, iconTheme: { primary: '#a7f3d0', secondary: '#000' } });
      
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
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#092b1a] via-neutral-950 to-black relative overflow-hidden font-sans px-4 py-8">
      
      {/* Selector superior para cambiar entre Login y Registro */}
      <div className="absolute top-8 w-full max-w-xs mx-auto flex bg-neutral-900/50 p-1 rounded-full border border-neutral-800 backdrop-blur-md z-20">
        <button 
          onClick={() => setIsRegistering(false)}
          className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${!isRegistering ? 'bg-verde-pastel text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}
        >
          Iniciar Sesión
        </button>
        <button 
          onClick={() => setIsRegistering(true)}
          className={`flex-1 py-2 text-xs font-bold rounded-full transition-all ${isRegistering ? 'bg-dorado text-black shadow-md' : 'text-neutral-400 hover:text-white'}`}
        >
          Crear Bodega
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!isRegistering ? (
          
          /* ========================================= */
          /* ============= VISTA DE LOGIN ============ */
          /* ========================================= */
          <motion.div 
            key="login"
            initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} transition={{ duration: 0.3 }}
            className="bg-neutral-950/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-md z-10 border border-neutral-800 hover:border-verde-pastel/30 transition-colors duration-500 mt-12"
          >
            <div className="text-center mb-10">
              <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight flex items-center justify-center gap-3">
                <div className="w-4 h-4 rounded-full bg-verde-pastel shadow-[0_0_15px_rgba(167,243,208,0.5)]"></div>
                {businessConfig.nombre || 'Bodega NOVA'}
              </h1>
              <p className="text-neutral-500 font-bold tracking-widest text-[10px] uppercase">Sistema Inteligente POS</p>
            </div>

            {sesionExpirada && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-4 rounded-xl mb-6 text-sm text-center">
                <p className="font-bold mb-1">Tu sesión ha finalizado</p>
                <p className="text-amber-200/70 text-xs">Ingresa tus datos para continuar.</p>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase tracking-widest">Correo Electrónico</label>
                <InputField icon={FaUserShield} type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={tiempoBloqueo > 0 || isLoading} placeholder="admin@mibodega.com" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase tracking-widest">Contraseña</label>
                <InputField icon={FaLock} type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={tiempoBloqueo > 0 || isLoading} placeholder="••••••••" />
              </div>

              <div className="pt-4">
                <button type="submit" disabled={tiempoBloqueo > 0 || isLoading}
                  className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-neutral-950 font-extrabold text-base py-4 px-4 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  {isLoading ? <><FaSpinner className="animate-spin" /> Verificando...</> : tiempoBloqueo > 0 ? <><FaLock /> Bloqueado ({tiempoBloqueo}s)</> : 'Ingresar al Sistema'}
                </button>
              </div>
            </form>
          </motion.div>

        ) : (

          /* ========================================= */
          /* ========== VISTA DE REGISTRO SAAS ======= */
          /* ========================================= */
          <motion.div 
            key="registro"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }}
            className="bg-neutral-950/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-lg z-10 border border-neutral-800 hover:border-dorado/30 transition-colors duration-500 mt-12"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-white mb-2 tracking-tight flex items-center justify-center gap-2">
                <FaStore className="text-dorado" /> Registra tu Bodega
              </h2>
              <p className="text-neutral-500 font-medium text-xs">Crea tu cuenta de administrador en segundos y comienza a vender hoy mismo.</p>
            </div>

            <form onSubmit={handleRegistro} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase">Nombre de Bodega *</label>
                  <InputField icon={FaStore} type="text" value={regNombreNegocio} onChange={e => setRegNombreNegocio(e.target.value)} disabled={isLoading} placeholder="Ej: Bodega Don Pepe" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase">RUC (Opcional)</label>
                  <InputField icon={FaIdCard} type="text" value={regRuc} onChange={e => setRegRuc(e.target.value.replace(/\D/g, ''))} disabled={isLoading} placeholder="11 dígitos" required={false} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase">Nombre del Dueño *</label>
                <InputField icon={FaUserTie} type="text" value={regNombreDuenio} onChange={e => setRegNombreDuenio(e.target.value)} disabled={isLoading} placeholder="Tu nombre completo" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase">Correo Administrador *</label>
                <InputField icon={FaUserShield} type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)} disabled={isLoading} placeholder="correo@ejemplo.com" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase">Crea tu Contraseña *</label>
                <InputField icon={FaLock} type="password" value={regPassword} onChange={e => setRegPassword(e.target.value)} disabled={isLoading} placeholder="Mínimo 6 caracteres" />
              </div>

              {/* TÉRMINOS Y CONDICIONES (Punto 2 requerido) */}
              <div className="py-2 flex items-start gap-3">
                <input type="checkbox" required className="mt-1 w-4 h-4 rounded border-neutral-700 bg-neutral-900 accent-dorado cursor-pointer" />
                <p className="text-xs text-neutral-400 leading-tight">
                  Al registrarte, aceptas nuestros <a href="#" className="text-dorado hover:underline font-bold">Términos y Condiciones</a> y la Política de Privacidad de datos del sistema POS.
                </p>
              </div>

              <div className="pt-2">
                <button type="submit" disabled={isLoading}
                  className="w-full bg-dorado hover:bg-yellow-400 text-neutral-950 font-extrabold text-base py-4 px-4 rounded-xl transition-all flex justify-center items-center gap-2 disabled:opacity-70 disabled:bg-neutral-700 disabled:text-neutral-400"
                >
                  {isLoading ? <><FaSpinner className="animate-spin" /> Creando cuenta...</> : 'Crear Bodega e Iniciar Sesión'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}