import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { FaUserShield, FaLock } from 'react-icons/fa';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`http://${window.location.hostname}:4000/api/auth/login`, {
        email,
        password
      });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      navigate('/ventas');
      
    } catch (err) {
      setError(err.response?.data?.message || 'Error al conectar con el servidor');
    }
  };

  return (
    // 1. FONDO: Gradiente oscuro inmersivo (mantenemos el toque verde oscuro de fondo)
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#092b1a] via-neutral-950 to-black relative overflow-hidden font-sans">
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        // 2. TARJETA: Negro puro corporativo (neutral-950) con bordes que reaccionan al hover
        className="bg-neutral-950/80 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-[0_0_40px_rgba(0,0,0,0.8)] w-full max-w-md z-10 border border-neutral-800 hover:border-verde-pastel/30 transition-colors duration-500"
      >
        <div className="text-center mb-10">
          {/* LOGO: Actualizado a Bodega NOVA */}
          <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight flex items-center justify-center gap-3">
            <div className="w-4 h-4 rounded-full bg-verde-pastel shadow-[0_0_15px_rgba(167,243,208,0.5)]"></div>
            Bodega NOVA
          </h1>
          <p className="text-neutral-500 font-bold tracking-widest text-[10px] uppercase">Sistema Inteligente POS</p>
        </div>

        {/* ALERTA DE ERROR */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            className="bg-rosado-pastel/10 border-l-4 border-rosado-pastel text-rosado-pastel px-4 py-3 rounded-lg mb-6 text-sm font-bold"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-bold text-neutral-500 mb-2 uppercase tracking-widest">Correo Electrónico</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                {/* ICONO: Se ilumina en verde pastel al hacer clic en el input */}
                <FaUserShield className="text-neutral-500 group-focus-within:text-verde-pastel transition-colors duration-300" />
              </div>
              {/* INPUT: Fondo neutral, sin colores hardcodeados */}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-1 focus:ring-verde-pastel focus:border-verde-pastel outline-none transition-all text-white placeholder-neutral-600 shadow-inner font-medium"
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
                className="w-full pl-11 pr-4 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:ring-1 focus:ring-verde-pastel focus:border-verde-pastel outline-none transition-all text-white placeholder-neutral-600 shadow-inner font-medium"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              // BOTÓN PRINCIPAL: Verde pastel sólido, letras oscuras
              className="w-full bg-verde-pastel hover:bg-[#86e6bb] text-neutral-950 font-extrabold text-lg py-4 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(167,243,208,0.15)]"
            >
              Ingresar al Sistema
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}