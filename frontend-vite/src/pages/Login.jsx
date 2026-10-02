import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaUserShield, FaLock, FaSpinner } from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  // Validar si el usuario fue redirigido por caducidad de token
  const queryParams = new URLSearchParams(location.search);
  const sesionExpirada = queryParams.get('motivo') === 'expirado';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { businessConfig } = useBusiness();

  const [isLoading, setIsLoading] = useState(false);
  const [intentosFallidos, setIntentosFallidos] = useState(0);
  const [tiempoBloqueo, setTiempoBloqueo] = useState(0);

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

  // Estilos base para notificaciones del módulo de autenticación
  const toastStyle = {
    borderRadius: '12px',
    background: '#0a0a0a',
    color: '#fff',
    border: '1px solid #262626',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Bloquear múltiples peticiones simultáneas o si el usuario está penalizado
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
        // Incremento de penalización: 15s (3er intento), 20s (4to), etc.
        const penalizacion = nuevosIntentos * 5; 
        setTiempoBloqueo(penalizacion);
        toast.error(`Demasiados intentos. Bloqueo temporal de ${penalizacion} segundos.`, { style: toastStyle });
      } else {
        toast.error('Correo o contraseña incorrectos.', { style: toastStyle });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#092b1a] via-neutral-950 to-black relative overflow-hidden font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-neutral-950/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-md z-10 border border-neutral-800 hover:border-verde-pastel/30 transition-colors duration-500"
      >
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight flex items-center justify-center gap-3">
            <div className="w-4 h-4 rounded-full bg-verde-pastel shadow-[0_0_15px_rgba(167,243,208,0.5)]"></div>
            {businessConfig.nombre}
          </h1>
          <p className="text-neutral-500 font-bold tracking-widest text-[10px] uppercase">Sistema Inteligente POS</p>
        </div>

        {/* Banner fijo indicando que la sesión caducó por inactividad */}
        {sesionExpirada && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-4 rounded-xl mb-6 text-sm text-center shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          >
            <p className="font-bold mb-1">Tu sesión ha finalizado</p>
            <p className="text-amber-200/70 text-xs">Por tu seguridad, cerramos el sistema tras un periodo de inactividad. Ingresa tus datos para continuar.</p>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase tracking-widest">Correo Electrónico</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaUserShield className="text-neutral-500 group-focus-within:text-verde-pastel transition-colors duration-300" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={tiempoBloqueo > 0 || isLoading}
                className="w-full pl-11 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-1 focus:ring-verde-pastel focus:border-verde-pastel outline-none transition-all text-white placeholder-neutral-600 shadow-inner font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="admin@bodeganova.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase tracking-widest">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FaLock className="text-neutral-500 group-focus-within:text-verde-pastel transition-colors duration-300" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={tiempoBloqueo > 0 || isLoading}
                className="w-full pl-11 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-1 focus:ring-verde-pastel focus:border-verde-pastel outline-none transition-all text-white placeholder-neutral-600 shadow-inner font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              whileHover={tiempoBloqueo === 0 && !isLoading ? { scale: 1.02 } : {}}
              whileTap={tiempoBloqueo === 0 && !isLoading ? { scale: 0.98 } : {}}
              type="submit"
              disabled={tiempoBloqueo > 0 || isLoading}
              className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-neutral-950 font-extrabold text-lg py-4 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(167,243,208,0.15)] flex justify-center items-center gap-2 disabled:opacity-70 disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? (
                <><FaSpinner className="animate-spin" /> Verificando...</>
              ) : tiempoBloqueo > 0 ? (
                <><FaLock /> Bloqueado ({tiempoBloqueo}s)</>
              ) : (
                'Ingresar al Sistema'
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}