import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaRobot, FaPaperPlane, FaTrash, FaTimes, FaExclamationTriangle,
  FaClock, FaWallet, FaPlus, FaMinus, FaGripHorizontal
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useBusiness } from '../context/BusinessContext';

const MIN_W = 310;
const MAX_W = 580;
const MIN_H = 380;
const MAX_H = 700;
const PASO_W = 55;
const PASO_H = 65;
const MARGEN_PANTALLA = 12;

const clamp = (valor, min, max) => Math.max(min, Math.min(max, valor));

const leerJsonSeguro = (clave, fallback) => {
  try {
    const raw = localStorage.getItem(clave);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export default function AsistenteIA() {
  const { businessConfig } = useBusiness();
  const user = leerJsonSeguro('user', {});
  const storageKey = `vendaia_chat_negocio_${user.negocioId || 'default'}`;

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720
  }));

  const tamanoBurbuja = viewport.w < 640 ? 52 : 60;

  // Posición persistente de la burbuja (coordenadas top/left)
  const [posBurbuja, setPosBurbuja] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const h = typeof window !== 'undefined' ? window.innerHeight : 720;
    const bSize = w < 640 ? 52 : 60;
    const guardada = leerJsonSeguro('vendaia_pos', null);
    if (guardada && typeof guardada.x === 'number' && typeof guardada.y === 'number') {
      return {
        x: clamp(guardada.x, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, w - bSize - MARGEN_PANTALLA)),
        y: clamp(guardada.y, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, h - bSize - MARGEN_PANTALLA))
      };
    }
    return {
      x: Math.max(MARGEN_PANTALLA, w - bSize - 20),
      y: Math.max(MARGEN_PANTALLA, h - bSize - 20)
    };
  });

  // Tamaño persistente del chat (con límites mínimos y máximos seguros)
  const [chatSize, setChatSize] = useState(() => {
    const guardado = leerJsonSeguro('vendaia_size', null);
    if (guardado && typeof guardado.w === 'number' && typeof guardado.h === 'number') {
      return {
        w: clamp(guardado.w, MIN_W, MAX_W),
        h: clamp(guardado.h, MIN_H, MAX_H)
      };
    }
    return { w: 390, h: 520 };
  });

  const [chatPos, setChatPos] = useState({ x: 20, y: 20 });
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
    const guardado = leerJsonSeguro(storageKey, null);
    return Array.isArray(guardado) && guardado.length > 0 ? guardado : [mensajeInicial];
  });

  // Refs para gestos táctiles/mouse y candado anti-doble envío
  const enviandoRef = useRef(false);
  const chatEndRef = useRef(null);
  const dragBurbujaRef = useRef(null);
  const dragChatRef = useRef(null);
  const resizeChatRef = useRef(null);
  const chatMovidoManualRef = useRef(false);

  // Dimensiones efectivas del chat adaptadas al viewport actual
  const maxWViewport = Math.max(MIN_W, Math.min(MAX_W, viewport.w - MARGEN_PANTALLA * 2));
  const maxHViewport = Math.max(MIN_H, Math.min(MAX_H, viewport.h - MARGEN_PANTALLA * 2));
  const anchoEfectivo = Math.min(chatSize.w, viewport.w - MARGEN_PANTALLA * 2);
  const altoEfectivo = Math.min(chatSize.h, viewport.h - MARGEN_PANTALLA * 2);

  // Mantiene burbuja y chat dentro de la pantalla al rotar tablet o redimensionar navegador
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const bSize = w < 640 ? 52 : 60;
      setViewport({ w, h });
      setPosBurbuja(prev => ({
        x: clamp(prev.x, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, w - bSize - MARGEN_PANTALLA)),
        y: clamp(prev.y, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, h - bSize - MARGEN_PANTALLA))
      }));
      setChatPos(prev => ({
        x: clamp(prev.x, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, w - Math.min(chatSize.w, w - MARGEN_PANTALLA * 2) - MARGEN_PANTALLA)),
        y: clamp(prev.y, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, h - Math.min(chatSize.h, h - MARGEN_PANTALLA * 2) - MARGEN_PANTALLA))
      }));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chatSize.w, chatSize.h]);

  // Cerrar el chat con tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(mensajes));
    } catch {
      // Ignorar si el almacenamiento del navegador está lleno
    }
  }, [mensajes, storageKey]);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, isOpen, isTyping]);

  // Cargar alertas en vivo para la insignia de la bolita y la cabecera del chat
  const cargarResumenAlertas = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    let activo = true;
    const token = localStorage.getItem('token');
    if (!token) return;

    axios.get('/ia/resumen', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => {
        if (activo) setResumenAlertas(res.data);
      })
      .catch((err) => {
        console.error('Error cargando resumen IA:', err);
      });

    return () => {
      activo = false;
    };
  }, [isOpen]);

  // Calcula dónde abrir el chat justo en la zona donde se movió la burbuja (sin salirse de pantalla)
  const abrirChatDesdeBurbuja = (posicionActual) => {
    const w = Math.min(chatSize.w, viewport.w - MARGEN_PANTALLA * 2);
    const h = Math.min(chatSize.h, viewport.h - MARGEN_PANTALLA * 2);

    const centroX = posicionActual.x + tamanoBurbuja / 2;
    const centroY = posicionActual.y + tamanoBurbuja / 2;

    const xIdeal = centroX > viewport.w / 2
      ? posicionActual.x + tamanoBurbuja - w
      : posicionActual.x;

    const yIdeal = centroY > viewport.h / 2
      ? posicionActual.y + tamanoBurbuja - h
      : posicionActual.y;

    setChatPos({
      x: clamp(xIdeal, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.w - w - MARGEN_PANTALLA)),
      y: clamp(yIdeal, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.h - h - MARGEN_PANTALLA))
    });
    chatMovidoManualRef.current = false;
    setIsOpen(true);
  };

  const cerrarChat = () => {
    if (chatMovidoManualRef.current) {
      // Si el usuario movió la ventana abierta, la burbuja aparece en la esquina cercana donde dejó el chat
      const centroChatX = chatPos.x + anchoEfectivo / 2;
      const centroChatY = chatPos.y + altoEfectivo / 2;
      const nuevaPos = {
        x: clamp(
          centroChatX > viewport.w / 2 ? chatPos.x + anchoEfectivo - tamanoBurbuja : chatPos.x,
          MARGEN_PANTALLA,
          Math.max(MARGEN_PANTALLA, viewport.w - tamanoBurbuja - MARGEN_PANTALLA)
        ),
        y: clamp(
          centroChatY > viewport.h / 2 ? chatPos.y + altoEfectivo - tamanoBurbuja : chatPos.y,
          MARGEN_PANTALLA,
          Math.max(MARGEN_PANTALLA, viewport.h - tamanoBurbuja - MARGEN_PANTALLA)
        )
      };
      setPosBurbuja(nuevaPos);
      localStorage.setItem('vendaia_pos', JSON.stringify(nuevaPos));
    }
    setIsOpen(false);
  };

  // --- GESTOS DE ARRASTRE DE LA BURBUJA (Mouse + Touch sin saltos) ---
  const onBurbujaPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragBurbujaRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: posBurbuja.x,
      originY: posBurbuja.y,
      actualX: posBurbuja.x,
      actualY: posBurbuja.y,
      movio: false
    };
  };

  const onBurbujaPointerMove = (e) => {
    const drag = dragBurbujaRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.movio && Math.hypot(dx, dy) > 5) {
      drag.movio = true;
    }

    if (drag.movio) {
      const nx = clamp(drag.originX + dx, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.w - tamanoBurbuja - MARGEN_PANTALLA));
      const ny = clamp(drag.originY + dy, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.h - tamanoBurbuja - MARGEN_PANTALLA));
      drag.actualX = nx;
      drag.actualY = ny;
      setPosBurbuja({ x: nx, y: ny });
    }
  };

  const onBurbujaPointerUp = (e) => {
    const drag = dragBurbujaRef.current;
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragBurbujaRef.current = null;

    if (drag.movio) {
      localStorage.setItem('vendaia_pos', JSON.stringify({ x: drag.actualX, y: drag.actualY }));
    } else {
      abrirChatDesdeBurbuja({ x: drag.actualX, y: drag.actualY });
    }
  };

  // --- GESTOS DE ARRASTRE DE LA CABECERA DEL CHAT ---
  const onChatHeaderPointerDown = (e) => {
    if (e.target.closest('button')) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragChatRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: chatPos.x,
      originY: chatPos.y
    };
  };

  const onChatHeaderPointerMove = (e) => {
    const drag = dragChatRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 3) {
      chatMovidoManualRef.current = true;
    }
    setChatPos({
      x: clamp(drag.originX + dx, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.w - anchoEfectivo - MARGEN_PANTALLA)),
      y: clamp(drag.originY + dy, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.h - altoEfectivo - MARGEN_PANTALLA))
    });
  };

  const onChatHeaderPointerUp = (e) => {
    if (!dragChatRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragChatRef.current = null;
  };

  // --- REDIMENSIONAR CON BOTONES (-) Y (+) ---
  const ajustarTamanoChat = (direccion) => {
    const nuevoW = clamp(chatSize.w + direccion * PASO_W, MIN_W, maxWViewport);
    const nuevoH = clamp(chatSize.h + direccion * PASO_H, MIN_H, maxHViewport);
    const wFinal = Math.min(nuevoW, viewport.w - MARGEN_PANTALLA * 2);
    const hFinal = Math.min(nuevoH, viewport.h - MARGEN_PANTALLA * 2);

    // Mantiene el anclaje hacia el borde más cercano para que no salte fuera de pantalla al agrandar
    setChatPos(prev => {
      const ancladoDerecha = prev.x + anchoEfectivo / 2 > viewport.w / 2;
      const ancladoAbajo = prev.y + altoEfectivo / 2 > viewport.h / 2;
      const nx = ancladoDerecha ? prev.x + (anchoEfectivo - wFinal) : prev.x;
      const ny = ancladoAbajo ? prev.y + (altoEfectivo - hFinal) : prev.y;
      return {
        x: clamp(nx, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.w - wFinal - MARGEN_PANTALLA)),
        y: clamp(ny, MARGEN_PANTALLA, Math.max(MARGEN_PANTALLA, viewport.h - hFinal - MARGEN_PANTALLA))
      };
    });

    const siguiente = { w: nuevoW, h: nuevoH };
    setChatSize(siguiente);
    localStorage.setItem('vendaia_size', JSON.stringify(siguiente));
  };

  // --- REDIMENSIONAR ARRASTRANDO LA ESQUINA INFERIOR DERECHA ---
  const onResizePointerDown = (e) => {
    e.stopPropagation();
    if (e.button !== undefined && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeChatRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: anchoEfectivo,
      startH: altoEfectivo
    };
  };

  const onResizePointerMove = (e) => {
    const rs = resizeChatRef.current;
    if (!rs) return;
    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;
    const limiteW = Math.min(MAX_W, viewport.w - chatPos.x - MARGEN_PANTALLA);
    const limiteH = Math.min(MAX_H, viewport.h - chatPos.y - MARGEN_PANTALLA);

    setChatSize({
      w: clamp(Math.round(rs.startW + dx), MIN_W, Math.max(MIN_W, limiteW)),
      h: clamp(Math.round(rs.startH + dy), MIN_H, Math.max(MIN_H, limiteH))
    });
  };

  const onResizePointerUp = (e) => {
    if (!resizeChatRef.current) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resizeChatRef.current = null;
    localStorage.setItem('vendaia_size', JSON.stringify(chatSize));
  };

  const puedeReducir = anchoEfectivo > MIN_W + 4 || altoEfectivo > MIN_H + 4;
  const puedeAgrandar = anchoEfectivo < maxWViewport - 4 || altoEfectivo < maxHViewport - 4;

  const formatearTextoIA = (texto) => {
    if (!texto) return null;

    const textoLimpio = texto
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*\*\s+/gm, '• ');

    const partes = textoLimpio.split(/(\*\*.*?\*\*)/g);

    return partes.map((parte, i) => {
      if (parte.startsWith('**') && parte.endsWith('**')) {
        return (
          <strong key={i} className="font-extrabold text-slate-950">
            {parte.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{parte.replace(/\*\*/g, '')}</span>;
    });
  };

  const enviarConsulta = async (textoConsulta) => {
    if (enviandoRef.current || isTyping) return;
    const pregunta = (textoConsulta || input).trim();
    if (!pregunta) return;

    const historialPrevio = mensajes.slice(-6);
    setMensajes(prev => [...prev, { role: 'user', text: pregunta }]);
    setInput('');
    enviandoRef.current = true;
    setIsTyping(true);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/ia/chat', {
        mensaje: pregunta,
        historial: historialPrevio
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setMensajes(prev => [...prev, { role: 'model', text: res.data.respuesta }]);
      cargarResumenAlertas();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'No se pudo conectar con el asistente IA.', { id: 'ia-chat' });
      setMensajes(prev => [
        ...prev,
        { role: 'model', text: 'Ocurrió un problema de conexión al consultar los datos. Intenta nuevamente en unos segundos.' }
      ]);
    } finally {
      enviandoRef.current = false;
      setIsTyping(false);
    }
  };

  const handleLimpiarChat = () => {
    if (enviandoRef.current) return;
    const reset = [{
      role: 'model',
      text: `Historial limpiado. ¿En qué más te puedo ayudar hoy con la gestión de ${businessConfig?.nombre || 'tu bodega'}?`
    }];
    setMensajes(reset);
    localStorage.setItem(storageKey, JSON.stringify(reset));
    toast.success('Conversación reiniciada.', { id: 'ia-chat' });
  };

  const preguntasRapidas = [
    '¿Qué tal me fue en esta semana?',
    '¿Qué productos debería comprar pronto?',
    '¿Qué productos me dejan más ganancia?',
    '¿Quiénes me deben fiado actualmente?'
  ];

  const totalAlertas = (resumenAlertas.cantidadStockCritico || 0) + (resumenAlertas.cantidadFiadosVencidos || 0);
  const esModoCompacto = anchoEfectivo <= 345;

  return (
    <>
      {/* 1. BURBUJA CIRCULAR FLOTANTE Y ARRASTRABLE (Mantiene su posición exacta) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            key="burbuja-ia"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            onPointerDown={onBurbujaPointerDown}
            onPointerMove={onBurbujaPointerMove}
            onPointerUp={onBurbujaPointerUp}
            style={{
              left: posBurbuja.x,
              top: posBurbuja.y,
              width: tamanoBurbuja,
              height: tamanoBurbuja
            }}
            title="Arrástrame o haz clic para hablar con VendaIA"
            className="fixed z-[95] cursor-grab active:cursor-grabbing select-none touch-none"
          >
            <div className="relative w-full h-full rounded-full bg-neutral-950 border-2 border-verde-pastel shadow-[0_8px_28px_rgba(0,0,0,0.42)] flex items-center justify-center group hover:scale-105 active:scale-95 transition-transform">
              <span className="absolute inset-0 rounded-full bg-verde-pastel/20 animate-ping opacity-30 pointer-events-none"></span>

              <FaRobot className="text-verde-pastel text-xl sm:text-2xl group-hover:rotate-12 transition-transform" />

              {totalAlertas > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center border-2 border-neutral-950 shadow-md">
                  {totalAlertas > 99 ? '99+' : totalAlertas}
                </span>
              )}

              <div
                className={`hidden md:block absolute ${
                  posBurbuja.x > viewport.w / 2 ? 'right-full mr-3' : 'left-full ml-3'
                } bg-neutral-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-neutral-800 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg`}
              >
                Asistente IA <span className="text-verde-pastel ml-1">(Arrástrame)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. VENTANA DE CHAT FLOTANTE (Se abre donde estaba la burbuja + movible + redimensionable) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="ventana-ia"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.18 }}
            style={{
              left: chatPos.x,
              top: chatPos.y,
              width: anchoEfectivo,
              height: altoEfectivo
            }}
            className="fixed z-[95] bg-white rounded-2xl shadow-[0_18px_55px_rgba(0,0,0,0.34)] border border-slate-200 flex flex-col overflow-hidden font-sans"
          >
            {/* CABECERA ARRASTRABLE CON CONTROLES (-) (+) DE TAMAÑO */}
            <div
              onPointerDown={onChatHeaderPointerDown}
              onPointerMove={onChatHeaderPointerMove}
              onPointerUp={onChatHeaderPointerUp}
              className="bg-neutral-950 px-3.5 py-3 border-t-4 border-verde-pastel shrink-0 cursor-move select-none touch-none"
            >
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-verde-pastel/15 border border-verde-pastel/30 flex items-center justify-center text-verde-pastel shrink-0">
                    <FaRobot size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5">
                      <span className="truncate">
                        {esModoCompacto ? 'VendaIA' : `Asistente de ${businessConfig?.nombre || 'tu bodega'}`}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                    </h3>
                    <p className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 truncate">
                      <FaGripHorizontal size={10} className="text-neutral-500 shrink-0" />
                      <span className="truncate">Arrastra para mover</span>
                    </p>
                  </div>
                </div>

                {/* Controles: Reducir (-), Agrandar (+), Limpiar y Cerrar */}
                <div className="flex items-center gap-1 shrink-0">
                  <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 mr-0.5">
                    <button
                      type="button"
                      disabled={!puedeReducir}
                      onClick={() => ajustarTamanoChat(-1)}
                      title="Reducir tamaño del chat"
                      className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FaMinus size={10} />
                    </button>
                    <button
                      type="button"
                      disabled={!puedeAgrandar}
                      onClick={() => ajustarTamanoChat(1)}
                      title="Agrandar tamaño del chat"
                      className="p-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <FaPlus size={10} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleLimpiarChat}
                    title="Borrar historial del chat"
                    className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaTrash size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={cerrarChat}
                    title="Minimizar asistente"
                    className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <FaTimes size={14} />
                  </button>
                </div>
              </div>

              {/* BARRA DE ALERTAS RÁPIDAS DEL NEGOCIO */}
              <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-neutral-800/80 text-[10px]">
                <button
                  type="button"
                  disabled={isTyping}
                  onClick={() => enviarConsulta('¿Qué productos tienen stock crítico y debería comprar?')}
                  title="Consultar productos con stock bajo"
                  className="bg-neutral-900 hover:bg-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-amber-300 font-bold transition-colors truncate cursor-pointer disabled:opacity-50"
                >
                  <FaExclamationTriangle className="shrink-0" />
                  <span className="truncate">
                    {resumenAlertas.cantidadStockCritico || 0} {esModoCompacto ? 'Stock' : 'Stock Bajo'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isTyping}
                  onClick={() => enviarConsulta('¿Quiénes tienen fiados pendientes o vencidos?')}
                  title="Consultar fiados pendientes"
                  className="bg-neutral-900 hover:bg-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-red-300 font-bold transition-colors truncate cursor-pointer disabled:opacity-50"
                >
                  <FaClock className="shrink-0" />
                  <span className="truncate">
                    {resumenAlertas.cantidadFiadosVencidos || 0} {esModoCompacto ? 'Fiados' : 'Fiados Hoy'}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isTyping}
                  onClick={() => enviarConsulta('¿Cómo va mi saldo de caja y mis ingresos recientes?')}
                  title="Consultar capital y flujo de caja"
                  className="bg-neutral-900 hover:bg-neutral-800 px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 text-verde-pastel font-bold transition-colors truncate cursor-pointer disabled:opacity-50"
                >
                  <FaWallet className="shrink-0" />
                  <span className="truncate">S/ {Number(resumenAlertas.saldoCaja || 0).toFixed(0)}</span>
                </button>
              </div>
            </div>

            {/* CUERPO DE MENSAJES */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              {mensajes.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[86%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed whitespace-pre-line shadow-2xs break-words ${
                      msg.role === 'user'
                        ? 'bg-neutral-950 text-white rounded-br-xs font-medium'
                        : 'bg-white text-slate-700 border border-slate-200 rounded-bl-xs font-medium'
                    }`}
                  >
                    {msg.role === 'user' ? msg.text : formatearTextoIA(msg.text)}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-2xl rounded-bl-xs shadow-2xs flex items-center gap-2 text-xs text-slate-500 font-bold">
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
                  className="text-[11px] font-bold bg-slate-100 hover:bg-verde-pastel/30 text-slate-700 hover:text-emerald-950 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border border-slate-200 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {pregunta}
                </button>
              ))}
            </div>

            {/* CAJA DE TEXTO INFERIOR + TIRADOR DE ESQUINA PARA REDIMENSIONAR */}
            <div className="relative bg-white border-t border-slate-200 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  enviarConsulta();
                }}
                className="p-2.5 pr-4 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isTyping}
                  placeholder="Pregunta sobre ventas, stock o caja..."
                  className="flex-1 min-w-0 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 font-medium"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="p-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-2xs cursor-pointer"
                  title="Enviar pregunta"
                >
                  <FaPaperPlane size={13} />
                </button>
              </form>

              {/* Tirador discreto en esquina inferior derecha para redimensionar arrastrando */}
              <div
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                title="Arrastra para cambiar el tamaño del chat"
                className="hidden sm:flex absolute bottom-0.5 right-0.5 w-4 h-4 cursor-nwse-resize items-end justify-end p-0.5 touch-none select-none opacity-45 hover:opacity-100 transition-opacity"
              >
                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-slate-500">
                  <path d="M9 1L1 9M9 5L5 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}