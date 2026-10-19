import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaRobot, FaPaperPlane, FaTrash, FaTimes, FaMinus, 
  FaExclamationTriangle, FaClock, FaWallet 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

export default function AsistenteIA() {
  const { businessConfig } = useBusiness();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const storageKey = `vendaia_chat_negocio_${user.negocioId || 'default'}`;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [resumenAlertas, setResumenAlertas] = useState({
    saldoCaja: 0,
    cantidadStockCritico: 0,
    cantidadFiadosVencidos: 0,
    totalPorCobrar: 0
  });

  const mensajeInicial = {
    role: 'model',
    text: `¡Hola ${user.nombre || 'equipo'}! Soy el asistente inteligente de ${businessConfig?.nombre || 'tu bodega'}. Puedo analizar tus ventas, decirte qué productos comprar según tu stock y caja, o revisar tus fiados. ¿Qué revisamos hoy?`
  };

  const [mensajes, setMensajes] = useState(() => {
    const guardado = localStorage.getItem(storageKey);
    return guardado ? JSON.parse(guardado) : [mensajeInicial];
  });

  // Referencia de los bordes de la pantalla para que la burbuja NUNCA se salga
  const constraintsRef = useRef(null);
  // Detector para diferenciar entre ARRASTRAR la bolita y HACER CLIC
  const isDraggingRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(mensajes));
  }, [mensajes, storageKey]);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, isOpen, isTyping]);

  // Cargar alertas en vivo para la insignia de la bolita y la cabecera del chat
  const cargarResumenAlertas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get('/ia/resumen', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResumenAlertas(res.data);
    } catch (err) {
      console.error('Error cargando resumen IA:', err);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarResumenAlertas();
  }, [isOpen]);

  const handleClickBurbuja = () => {
    if (isDraggingRef.current) return;
    setIsOpen(true);
  };

  const enviarConsulta = async (textoConsulta) => {
    const pregunta = (textoConsulta || input).trim();
    if (!pregunta || isTyping) return;

    const nuevosMensajes = [...mensajes, { role: 'user', text: pregunta }];
    setMensajes(nuevosMensajes);
    setInput('');
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/ia/chat', {
        mensaje: pregunta,
        historial: mensajes.slice(-6)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensajes(prev => [...prev, { role: 'model', text: res.data.respuesta }]);
      cargarResumenAlertas();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'No se pudo conectar con el asistente IA.');
      setMensajes(prev => [
        ...prev,
        { role: 'model', text: 'Ocurrió un problema de conexión al consultar los datos. Intenta nuevamente en unos segundos.' }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleLimpiarChat = () => {
    const reset = [{
      role: 'model',
      text: `Historial limpiado. ¿En qué más te puedo ayudar hoy con la gestión de ${businessConfig?.nombre || 'tu bodega'}?`
    }];
    setMensajes(reset);
    localStorage.setItem(storageKey, JSON.stringify(reset));
    toast.success('Conversación reiniciada');
  };

  const preguntasRapidas = [
    '¿Qué tal me fue en esta semana?',
    '¿Qué productos debería comprar pronto?',
    '¿Qué productos me dejan más ganancia?',
    '¿Quiénes me deben fiado actualmente?'
  ];

  const totalAlertas = resumenAlertas.cantidadStockCritico + resumenAlertas.cantidadFiadosVencidos;

  return (
    <>
      {/* JAULA INVISIBLE DE LÍMITES DE PANTALLA (Impide que la bolita salga de la ventana) */}
      <div ref={constraintsRef} className="fixed inset-4 pointer-events-none z-[94]" />

      {/* 1. BURBUJA CIRCULAR FLOTANTE Y ARRASTRABLE CON LÍMITES */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragElastic={0.08}
            dragMomentum={false}
            onDragStart={() => { isDraggingRef.current = true; }}
            onDragEnd={() => {
              setTimeout(() => { isDraggingRef.current = false; }, 150);
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClickBurbuja}
            title="Arrástrame o haz clic para hablar con VendaIA"
            className="fixed bottom-6 right-6 z-[95] cursor-grab active:cursor-grabbing select-none"
          >
            <div className="relative w-16 h-16 rounded-full bg-neutral-950 border-2 border-verde-pastel shadow-[0_8px_30px_rgba(0,0,0,0.45)] flex items-center justify-center group">
              {/* Efecto de pulso suave */}
              <span className="absolute inset-0 rounded-full bg-verde-pastel/20 animate-ping opacity-30 pointer-events-none"></span>
              
              <FaRobot className="text-verde-pastel text-2xl group-hover:rotate-12 transition-transform" />

              {/* Contador de alertas de la bodega */}
              {totalAlertas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-neutral-950 shadow-md">
                  {totalAlertas}
                </span>
              )}

              {/* Etiqueta flotante al pasar el mouse */}
              <div className="hidden md:block absolute right-20 bg-neutral-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-neutral-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                Asistente IA <span className="text-verde-pastel ml-1">(Arrástrame)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. VENTANA DE CHAT FLOTANTE */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[95] w-[calc(100vw-2rem)] sm:w-[410px] h-[580px] max-h-[85vh] bg-white rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.35)] border border-slate-200 flex flex-col overflow-hidden font-sans"
          >
            {/* CABECERA DEL CHAT */}
            <div className="bg-neutral-950 p-4 border-t-4 border-verde-pastel shrink-0">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/15 border border-verde-pastel/30 flex items-center justify-center text-verde-pastel shrink-0">
                    <FaRobot size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-extrabold text-sm flex items-center gap-1.5">
                      Asistente VendaIA
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-medium truncate max-w-[180px]">
                      {businessConfig?.nombre || 'Analítica en Tiempo Real'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleLimpiarChat}
                    title="Borrar historial del chat"
                    className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors"
                  >
                    <FaTrash size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    title="Minimizar a la burbuja"
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                  >
                    <FaMinus size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    title="Cerrar"
                    className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors"
                  >
                    <FaTimes size={15} />
                  </button>
                </div>
              </div>

              {/* BARRA DE ALERTAS RÁPIDAS DEL NEGOCIO */}
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2.5 border-t border-neutral-800/80 text-[10px]">
                <button
                  type="button"
                  onClick={() => enviarConsulta('¿Qué productos tienen stock crítico y debería comprar?')}
                  className="bg-neutral-900 hover:bg-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-amber-300 font-bold transition-colors truncate"
                >
                  <FaExclamationTriangle className="shrink-0" />
                  <span>{resumenAlertas.cantidadStockCritico} Stock Bajo</span>
                </button>
                <button
                  type="button"
                  onClick={() => enviarConsulta('¿Quiénes tienen fiados pendientes o vencidos?')}
                  className="bg-neutral-900 hover:bg-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-red-300 font-bold transition-colors truncate"
                >
                  <FaClock className="shrink-0" />
                  <span>{resumenAlertas.cantidadFiadosVencidos} Fiados Hoy</span>
                </button>
                <div className="bg-neutral-900 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-verde-pastel font-bold truncate">
                  <FaWallet className="shrink-0" />
                  <span>S/ {resumenAlertas.saldoCaja.toFixed(0)}</span>
                </div>
              </div>
            </div>

            {/* CUERPO DE MENSAJES */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {mensajes.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-neutral-950 text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs font-medium'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-xs shadow-sm flex items-center gap-2 text-xs text-slate-500 font-bold">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.15s]"></span>
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                    Analizando datos de tu bodega...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* SUGERENCIAS RÁPIDAS */}
            <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden shrink-0">
              {preguntasRapidas.map((pregunta, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={isTyping}
                  onClick={() => enviarConsulta(pregunta)}
                  className="text-[11px] font-bold bg-slate-100 hover:bg-verde-pastel/30 text-slate-700 hover:text-emerald-950 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-slate-200 shrink-0"
                >
                  {pregunta}
                </button>
              ))}
            </div>

            {/* CAJA DE TEXTO INFERIOR */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                enviarConsulta();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping}
                placeholder="Pregunta sobre tus ventas, stock o compras..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-medium"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
              >
                <FaPaperPlane size={14} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}