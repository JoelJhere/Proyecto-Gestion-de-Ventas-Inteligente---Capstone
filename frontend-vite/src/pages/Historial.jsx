import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  FaSearch, FaFileExcel, FaEye, FaFilePdf, FaCalendarAlt, 
  FaChartLine, FaShoppingBag, FaReceipt, FaFileInvoice, 
  FaTimes, FaExternalLinkAlt, FaWallet, FaArrowUp, 
  FaArrowDown, FaPlus, FaMinus, FaPrint, FaChevronDown
} from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';
import ComprobanteDetallado from '../components/ComprobanteDetallado';

// --- LOGOS REALES EN SVG PARA MÉTODOS DE PAGO ---
const LogoEfectivo = () => (
  <div className="flex items-center justify-center w-6 h-4 rounded bg-emerald-700 text-white font-bold text-[10px] shadow-2xs shrink-0 border border-emerald-800">
    S/
  </div>
);

const LogosYapePlin = () => (
  <div className="flex items-center -space-x-1 shrink-0">
    <div className="w-4 h-4 rounded bg-[#742384] text-white flex items-center justify-center font-black text-[9px] shadow-2xs border border-white z-10">
      y
    </div>
    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-[#00A8E8] to-[#00E5FF] text-white flex items-center justify-center font-extrabold text-[7px] shadow-2xs border border-white">
      plin
    </div>
  </div>
);

const LogosBancos = () => (
  <div className="flex items-center gap-0.5 shrink-0">
    <span className="px-1 py-0.5 rounded bg-[#002A8D] text-white font-black text-[7px] tracking-tighter">BCP</span>
    <span className="px-1 py-0.5 rounded bg-[#009B3A] text-white font-black text-[7px] tracking-tighter">IBK</span>
  </div>
);

const BadgeMetodoPago = ({ metodo }) => {
  if (metodo === 'YAPE_PLIN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200/80 whitespace-nowrap">
        <LogosYapePlin /> Yape / Plin
      </span>
    );
  }
  if (metodo === 'TRANSFERENCIA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200/80 whitespace-nowrap">
        <LogosBancos /> Transferencia
      </span>
    );
  }
  if (metodo === 'FIADO') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80 whitespace-nowrap">
        Crédito / Fiado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-verde-pastel/30 text-emerald-950 border border-emerald-200/80 whitespace-nowrap">
      <LogoEfectivo /> Efectivo
    </span>
  );
};

const IconoComprobante = ({ tipo }) => {
  if (tipo === 'FACTURA') {
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0" title="Factura">
        <FaFileInvoice size={15} />
      </div>
    );
  }
  if (tipo === 'BOLETA') {
    return (
      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0" title="Boleta">
        <FaReceipt size={15} />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-xl bg-verde-pastel/35 text-emerald-800 flex items-center justify-center shrink-0" title="Venta Rápida">
      <FaShoppingBag size={14} />
    </div>
  );
};

// Convierte una fecha a YYYY-MM-DD respetando la hora local de Perú (evita salto de día después de las 7 PM)
const formatoFechaLocal = (fecha) => {
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().split('T')[0];
};

export default function Historial() {
  const BLOQUE_CARGA = 30;

  const [pestanaActiva, setPestanaActiva] = useState('VENTAS'); // 'VENTAS' o 'CAJA'
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.rol === 'ADMIN';

  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState({ totalIngresos: 0, cantidadOperaciones: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { businessConfig } = useBusiness();

  // Paginación y Filtros de Ventas
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('MES');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const [paginaActual, setPaginaActual] = useState(1);
  const [hayMas, setHayMas] = useState(false);

  // Modales de Ventas
  const [modalDetalles, setModalDetalles] = useState(null);
  const [visorComprobante, setVisorComprobante] = useState(null);

  // Candados síncronos anti-spam / doble clic
  const [isSubmittingCaja, setIsSubmittingCaja] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const accionCajaRef = useRef(false);
  const exportandoRef = useRef(false);
  const cargandoMasRef = useRef(false);

  // --- ESTADOS DE FLUJO DE CAJA Y GRÁFICO ---
  const [datosCaja, setDatosCaja] = useState({
    saldoCaja: 0,
    resumenCaja: { totalIngresosCaja: 0, totalEgresosCaja: 0, netoEfectivo: 0, netoDigital: 0 },
    movimientos: []
  });
  const [isLoadingCaja, setIsLoadingCaja] = useState(false);
  const [filtroTipoCaja, setFiltroTipoCaja] = useState('TODOS'); // 'TODOS' | 'INGRESO' | 'EGRESO'
  const [limiteCaja, setLimiteCaja] = useState(BLOQUE_CARGA);
  const [modalMovimiento, setModalMovimiento] = useState(null); // 'INGRESO' o 'EGRESO'
  const [formCaja, setFormCaja] = useState({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: '' });
  const [puntoHover, setPuntoHover] = useState(null);

  // Debounce del buscador (limpiando espacios sobrantes del teclado táctil)
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const formatearMetodoPago = (metodo) => {
    if (metodo === 'YAPE_PLIN') return 'Yape / Plin';
    if (metodo === 'TRANSFERENCIA') return 'Transferencia';
    if (metodo === 'FIADO') return 'Fiado (Crédito)';
    return 'Efectivo';
  };

  const abrirTicket = (ventaId, autoImprimir = false) => {
    const width = 420;
    const height = 720;
    const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
    const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
    const url = autoImprimir ? `/ticket/${ventaId}?imprimir=1` : `/ticket/${ventaId}`;
    window.open(
      url,
      'Comprobante',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes`
    );
  };

  const calcularFechasFiltro = useCallback((tipo) => {
    const hoy = new Date();
    let inicio = '';
    const fin = formatoFechaLocal(hoy);

    if (tipo === 'HOY') {
      inicio = fin;
    } else if (tipo === 'SEMANA') {
      const semanaPasada = new Date(hoy);
      semanaPasada.setDate(hoy.getDate() - 7);
      inicio = formatoFechaLocal(semanaPasada);
    } else if (tipo === 'MES') {
      const mesPasado = new Date(hoy);
      mesPasado.setMonth(hoy.getMonth() - 1);
      inicio = formatoFechaLocal(mesPasado);
    } else if (tipo === 'ANIO') {
      const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
      inicio = formatoFechaLocal(inicioAnio);
    }

    return { inicio, fin };
  }, []);

  const cargarHistorial = useCallback(async (resetear = false, paginaSiguiente = 1) => {
    if (!resetear && cargandoMasRef.current) return;
    if (!resetear) cargandoMasRef.current = true;
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token');
      const paginaACargar = resetear ? 1 : paginaSiguiente;

      let fInicio = fechaInicio;
      let fFin = fechaFin;

      if (filtroActivo !== 'CUSTOM') {
        const fechas = calcularFechasFiltro(filtroActivo);
        fInicio = fechas.inicio;
        fFin = fechas.fin;
      }

      const res = await axios.get('/historial', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          pagina: paginaACargar,
          limite: BLOQUE_CARGA,
          busqueda: busquedaDebounced,
          fechaInicio: fInicio,
          fechaFin: fFin
        }
      });

      if (resetear) {
        setVentas(res.data.datos || []);
        setPaginaActual(1);
      } else {
        setVentas(prev => [...prev, ...(res.data.datos || [])]);
        setPaginaActual(paginaACargar);
      }

      setResumen(res.data.resumen || { totalIngresos: 0, cantidadOperaciones: 0 });
      setHayMas(Boolean(res.data.paginacion?.hayMas));
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el historial de ventas.', { id: 'hist-carga' });
    } finally {
      cargandoMasRef.current = false;
      setIsLoading(false);
    }
  }, [BLOQUE_CARGA, busquedaDebounced, calcularFechasFiltro, fechaFin, fechaInicio, filtroActivo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarHistorial(true, 1);
  }, [cargarHistorial]);

  const cargarFlujoCaja = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingCaja(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/historial/caja', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDatosCaja(res.data);
      setLimiteCaja(BLOQUE_CARGA);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el flujo de caja.', { id: 'hist-caja-carga' });
    } finally {
      setIsLoadingCaja(false);
    }
  }, [BLOQUE_CARGA, isAdmin]);

  useEffect(() => {
    if (pestanaActiva === 'CAJA') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarFlujoCaja();
    }
  }, [pestanaActiva, cargarFlujoCaja]);

  const handleAplicarFiltroRapido = (tipo) => {
    setFiltroActivo(tipo);
    if (tipo !== 'CUSTOM') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  const handleGuardarMovimientoCaja = async (e) => {
    e.preventDefault();
    if (accionCajaRef.current || !modalMovimiento) return;

    const montoNum = parseFloat(formCaja.monto);
    if (!formCaja.monto || Number.isNaN(montoNum) || montoNum <= 0) {
      return toast.error('Ingresa un monto válido mayor a 0.', { id: 'hist-accion' });
    }
    if (!formCaja.descripcion.trim()) {
      return toast.error('Ingresa una descripción para este movimiento.', { id: 'hist-accion' });
    }

    accionCajaRef.current = true;
    setIsSubmittingCaja(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/historial/caja/movimiento', {
        tipo: modalMovimiento,
        categoria: formCaja.categoria || (modalMovimiento === 'INGRESO' ? 'CAPITAL_INICIAL' : 'GASTO_PERSONAL'),
        monto: montoNum,
        metodoPago: formCaja.metodoPago,
        descripcion: formCaja.descripcion.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(res.data.message || 'Movimiento registrado correctamente.', { id: 'hist-accion' });
      setModalMovimiento(null);
      setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: '' });
      cargarFlujoCaja();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar movimiento.', { id: 'hist-accion' });
    } finally {
      accionCajaRef.current = false;
      setIsSubmittingCaja(false);
    }
  };

  const handleExportarExcel = async () => {
    if (exportandoRef.current) return;
    exportandoRef.current = true;
    setIsExporting(true);
    const toastId = toast.loading('Generando reporte Excel...', { id: 'hist-excel' });

    try {
      const token = localStorage.getItem('token');

      let fInicio = fechaInicio;
      let fFin = fechaFin;
      if (filtroActivo !== 'CUSTOM') {
        const fechas = calcularFechasFiltro(filtroActivo);
        fInicio = fechas.inicio;
        fFin = fechas.fin;
      }

      const res = await axios.get('/historial', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          pagina: 1,
          limite: 10000,
          busqueda: busquedaDebounced,
          fechaInicio: fInicio,
          fechaFin: fFin
        }
      });

      const ventasExportar = res.data.datos || [];

      if (ventasExportar.length === 0) {
        toast.error('No hay datos para exportar con estos filtros.', { id: toastId });
        return;
      }

      const dataExcel = ventasExportar.map(venta => ({
        'Fecha': new Date(venta.createdAt).toLocaleDateString('es-PE'),
        'Hora': new Date(venta.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        'Tipo de Comprobante': venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'TICKET SIMPLE' : venta.tipoComprobante,
        'N° Comprobante': venta.numeroComprobante || 'TICKET INTERNO',
        'Método de Pago': formatearMetodoPago(venta.metodoPago),
        'Nombre del Cliente': venta.clienteNombre || 'Cliente Varios',
        'Documento': (venta.clienteDocumento && venta.clienteDocumento !== '00000000') ? venta.clienteDocumento : 'Anónimo',
        'Atendido por': venta.vendedor?.nombre || 'Desconocido',
        'Subtotal (S/)': parseFloat(venta.subtotal || 0),
        'IGV (S/)': parseFloat(venta.igv || 0),
        'Total (S/)': parseFloat(venta.total || 0)
      }));

      const hoja = XLSX.utils.json_to_sheet(dataExcel);
      hoja['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
        { wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }
      ];

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

      const nombreArchivo = `Historial_Ventas_${filtroActivo}_${Date.now()}.xlsx`;
      XLSX.writeFile(libro, nombreArchivo);

      toast.success('Reporte Excel exportado con éxito.', { id: toastId });
    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Ocurrió un error al generar el archivo Excel.', { id: toastId });
    } finally {
      exportandoRef.current = false;
      setIsExporting(false);
    }
  };

  // Restantes aproximados para el botón "Cargar más" en Ventas
  const totalOperaciones = resumen.cantidadOperaciones || ventas.length;
  const restantesVentas = Math.max(0, totalOperaciones - ventas.length);
  const cantidadProximaCargaVentas = restantesVentas > 0 ? Math.min(BLOQUE_CARGA, restantesVentas) : BLOQUE_CARGA;

  // --- FILTRO Y PAGINACIÓN PROGRESIVA DEL LIBRO DIARIO DE CAJA (30 EN 30) ---
  const todosMovimientosCaja = datosCaja.movimientos || [];
  const totalIngresosMovs = todosMovimientosCaja.filter(m => m.tipo === 'INGRESO').length;
  const totalEgresosMovs = todosMovimientosCaja.filter(m => m.tipo === 'EGRESO').length;
  const movimientosFiltrados = filtroTipoCaja === 'TODOS'
    ? todosMovimientosCaja
    : todosMovimientosCaja.filter(m => m.tipo === filtroTipoCaja);
  const movimientosVisibles = movimientosFiltrados.slice(0, limiteCaja);
  const restantesCaja = movimientosFiltrados.length - movimientosVisibles.length;

  // --- PREPARACIÓN DE PUNTOS PARA EL GRÁFICO ESTILO TRADING ---
  const puntosGrafico = [...todosMovimientosCaja].reverse();
  const anchoSvg = 850;
  const altoSvg = 240;
  const padX = 35;
  const padY = 25;

  const valoresSaldo = puntosGrafico.map(p => Number(p.saldoResultante || 0));
  const minSaldo = valoresSaldo.length > 0 ? Math.min(...valoresSaldo, 0) : 0;
  const maxSaldo = valoresSaldo.length > 0 ? Math.max(...valoresSaldo, 100) : 100;
  const rangoSaldo = maxSaldo - minSaldo === 0 ? 100 : maxSaldo - minSaldo;

  const coordenadas = puntosGrafico.map((punto, idx) => {
    const x = puntosGrafico.length === 1
      ? anchoSvg / 2
      : padX + (idx / (puntosGrafico.length - 1)) * (anchoSvg - padX * 2);
    const y = altoSvg - padY - ((Number(punto.saldoResultante || 0) - minSaldo) / rangoSaldo) * (altoSvg - padY * 2);
    return { x, y, ...punto };
  });

  const lineaPath = coordenadas.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = coordenadas.length > 0
    ? `${lineaPath} L ${coordenadas[coordenadas.length - 1].x} ${altoSvg - padY} L ${coordenadas[0].x} ${altoSvg - padY} Z`
    : '';

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased min-h-[calc(100vh-6rem)] relative">
      
      {/* CABECERA PRINCIPAL Y SELECTOR DE PESTAÑAS */}
      <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Historial y Finanzas
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Audita todas las transacciones emitidas y supervisa el flujo de capital de tu bodega.
          </p>
        </div>

        {isAdmin && (
          <div className="flex bg-white p-1.5 rounded-xl border border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)] w-full sm:w-auto self-start lg:self-auto shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setPestanaActiva('VENTAS')}
              className={`flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                pestanaActiva === 'VENTAS'
                  ? 'bg-verde-pastel text-emerald-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FaReceipt size={13} /> Comprobantes
            </button>
            <button
              type="button"
              onClick={() => setPestanaActiva('CAJA')}
              className={`flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                pestanaActiva === 'CAJA'
                  ? 'bg-verde-pastel text-emerald-950 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FaChartLine size={13} /> Flujo de Caja
            </button>
          </div>
        )}
      </div>

      {pestanaActiva === 'VENTAS' ? (
        <>
          {/* 2 TARJETAS DE RESUMEN DE VENTAS SIMÉTRICAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Ingresos del Periodo Filtrado</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight font-mono">
                  S/ {Number(resumen.totalIngresos || 0).toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-verde-pastel/40 text-emerald-800 rounded-xl flex items-center justify-center shrink-0">
                <FaChartLine size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-500 truncate">Operaciones Registradas</p>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
                  {resumen.cantidadOperaciones || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <FaShoppingBag size={20} />
              </div>
            </div>
          </div>

          {/* CONTROLES, BUSCADOR Y FILTROS DE FECHA */}
          <div className="bg-white p-4 sm:p-5 border border-slate-200/90 rounded-2xl shadow-[0_6px_24px_rgba(15,23,42,0.05)] space-y-4">
            <div className="flex flex-col xl:flex-row justify-between gap-3.5">
              <div className="relative w-full xl:w-1/3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaSearch className="text-slate-400 text-sm" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar cliente, DNI/RUC o N° comprobante..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-11 pr-9 py-2.5 bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-800 transition-all font-medium text-sm placeholder:text-slate-400" 
                />
                {busqueda && (
                  <button
                    type="button"
                    onClick={() => setBusqueda('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Limpiar búsqueda"
                  >
                    <FaTimes size={13} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70">
                {['HOY', 'SEMANA', 'MES', 'ANIO', 'CUSTOM'].map(filtro => (
                  <button
                    key={filtro}
                    type="button"
                    onClick={() => handleAplicarFiltroRapido(filtro)}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      filtroActivo === filtro 
                        ? 'bg-verde-pastel text-emerald-950 shadow-2xs' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {filtro === 'ANIO' ? 'AÑO' : filtro === 'CUSTOM' ? 'PERSONALIZADO' : filtro}
                  </button>
                ))}
              </div>

              <button 
                type="button"
                disabled={isExporting}
                onClick={handleExportarExcel}
                className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shrink-0 shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FaFileExcel size={16} />
                <span>{isExporting ? 'Generando...' : 'Exportar Excel'}</span>
              </button>
            </div>

            <AnimatePresence>
              {filtroActivo === 'CUSTOM' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="grid grid-cols-1 sm:grid-cols-2 lg:flex items-center gap-3 pt-3 border-t border-slate-100 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
                      <FaCalendarAlt className="text-emerald-600" /> Desde:
                    </label>
                    <input
                      type="date"
                      value={fechaInicio}
                      max={fechaFin || formatoFechaLocal(new Date())}
                      onChange={e => setFechaInicio(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 shrink-0">
                      <FaCalendarAlt className="text-emerald-600" /> Hasta:
                    </label>
                    <input
                      type="date"
                      value={fechaFin}
                      min={fechaInicio || undefined}
                      max={formatoFechaLocal(new Date())}
                      onChange={e => setFechaFin(e.target.value)}
                      className="flex-1 sm:flex-none px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:bg-white outline-none focus:border-emerald-500 font-medium"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* LISTADO RESPONSIVE: TARJETAS EN CELULAR (1 col) Y TABLET (2 cols) + TABLA EN PC (>= 1024px) */}
          <div className="lg:bg-white lg:border lg:border-slate-200/90 lg:rounded-2xl lg:shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden flex-1 flex flex-col">
            
            {/* VISTA CELULAR (1 col) Y TABLET VERTICAL (2 cols) */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {isLoading && ventas.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/90 animate-pulse space-y-3">
                    <div className="flex justify-between gap-2">
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                    </div>
                    <div className="h-12 bg-slate-100 rounded-xl w-full"></div>
                    <div className="flex justify-end gap-2">
                      <div className="h-8 bg-slate-100 rounded-lg w-20"></div>
                      <div className="h-8 bg-slate-100 rounded-lg w-28"></div>
                    </div>
                  </div>
                ))
              ) : ventas.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-slate-500 font-medium text-sm">
                  No se encontraron transacciones registradas para este periodo.
                </div>
              ) : (
                ventas.map((venta) => (
                  <div key={venta.id} className="p-4 space-y-3 rounded-2xl border border-slate-200/90 shadow-2xs bg-white flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <IconoComprobante tipo={venta.tipoComprobante} />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 text-sm leading-snug">
                              {venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'Venta Rápida' : venta.tipoComprobante}
                            </p>
                            <p className="text-xs text-slate-500 font-mono truncate">
                              {venta.numeroComprobante || `#000${venta.id}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-extrabold text-emerald-700 font-mono text-base">
                            S/ {Number(venta.total || 0).toFixed(2)}
                          </p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {new Date(venta.createdAt).toLocaleDateString('es-PE')} • {new Date(venta.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-100">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug" title={venta.clienteNombre}>
                            {venta.clienteNombre || 'Cliente Varios'}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {venta.clienteDocumento && venta.clienteDocumento !== '00000000' ? `Doc: ${venta.clienteDocumento}` : 'Sin documento'}
                          </p>
                        </div>
                        <BadgeMetodoPago metodo={venta.metodoPago} />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setModalDetalles(venta)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg cursor-pointer"
                      >
                        <FaEye size={13} /> Detalle
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (venta.enlacePdf) {
                            setVisorComprobante(venta);
                          } else {
                            abrirTicket(venta.id, false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-white hover:bg-red-50 border border-slate-200/80 rounded-lg cursor-pointer"
                      >
                        <FaFilePdf size={13} /> Comprobante
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* VISTA ESCRITORIO (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 xl:px-5 whitespace-nowrap">Fecha y Hora</th>
                    <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap">Comprobante</th>
                    <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap">Cliente / Documento</th>
                    <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap text-center">Medio de Pago</th>
                    <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap text-right">Importe Total</th>
                    <th className="py-3.5 px-4 xl:px-5 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {isLoading && ventas.length === 0 ? (
                    [...Array(5)].map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-40"></div></td>
                        <td className="py-4 px-4"><div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
                        <td className="py-4 px-5 flex justify-center gap-2">
                          <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                          <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                        </td>
                      </tr>
                    ))
                  ) : ventas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">
                        No se encontraron transacciones registradas para este periodo.
                      </td>
                    </tr>
                  ) : (
                    ventas.map((venta) => (
                      <tr key={venta.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 xl:px-5 whitespace-nowrap">
                          <p className="font-bold text-slate-900 text-sm">{new Date(venta.createdAt).toLocaleDateString('es-PE')}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{new Date(venta.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="py-3.5 px-3 xl:px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <IconoComprobante tipo={venta.tipoComprobante} />
                            <div>
                              <p className="font-bold text-slate-900 text-sm">
                                {venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'Venta Rápida' : venta.tipoComprobante}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{venta.numeroComprobante || `#000${venta.id}`}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 xl:px-4 max-w-[200px] lg:max-w-[240px]">
                          <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={venta.clienteNombre}>
                            {venta.clienteNombre || 'Cliente Varios'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {venta.clienteDocumento && venta.clienteDocumento !== '00000000' ? `Doc: ${venta.clienteDocumento}` : 'Sin documento'}
                          </p>
                        </td>
                        <td className="py-3.5 px-3 xl:px-4 text-center whitespace-nowrap">
                          <BadgeMetodoPago metodo={venta.metodoPago} />
                        </td>
                        <td className="py-3.5 px-3 xl:px-4 text-right whitespace-nowrap">
                          <p className="font-extrabold text-emerald-700 font-mono text-base">S/ {Number(venta.total || 0).toFixed(2)}</p>
                        </td>
                        <td className="py-3.5 px-4 xl:px-5 text-center whitespace-nowrap">
                          <div className="flex justify-center items-center gap-2">
                            <button 
                              type="button"
                              onClick={() => setModalDetalles(venta)}
                              className="bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 p-2 rounded-lg transition-colors border border-slate-200/80 cursor-pointer" 
                              title="Ver Detalles de Productos"
                            >
                              <FaEye size={15} />
                            </button>
                            
                            <button 
                              type="button"
                              onClick={() => {
                                if (venta.enlacePdf) {
                                  setVisorComprobante(venta);
                                } else {
                                  abrirTicket(venta.id, false);
                                }
                              }}
                              className="bg-white hover:bg-red-50 text-red-500 hover:text-red-600 p-2 rounded-lg transition-colors border border-slate-200/80 cursor-pointer" 
                              title="Ver Comprobante o Ticket"
                            >
                              <FaFilePdf size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {isLoading && ventas.length > 0 && (
              <div className="p-5 text-center text-xs sm:text-sm font-bold text-slate-400 animate-pulse">
                Cargando más transacciones...
              </div>
            )}

            {/* PIE DE PAGINACIÓN CENTRADO Y CON ESPACIO (30 EN 30) */}
            {!isLoading && ventas.length > 0 && (
              <div className="mt-4 lg:mt-0 px-5 py-5 bg-white lg:bg-slate-50/80 border border-slate-200/90 lg:border-0 lg:border-t lg:border-slate-100 rounded-2xl lg:rounded-none shadow-2xs lg:shadow-none flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  Mostrando <strong className="text-slate-800">{ventas.length}</strong> de{' '}
                  <strong className="text-slate-800">{totalOperaciones}</strong> operación(es)
                </p>

                {hayMas && (
                  <button 
                    type="button"
                    disabled={isLoading}
                    onClick={() => cargarHistorial(false, paginaActual + 1)} 
                    className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-6 py-2.5 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                  >
                    <FaChevronDown size={12} />
                    <span>
                      Cargar {cantidadProximaCargaVentas} operación{cantidadProximaCargaVentas === 1 ? '' : 'es'} más
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        /* ================= PESTAÑA 2: FLUJO DE CAJA Y GRÁFICO ESTILO TRADING ================= */
        <div className="space-y-6">
          
          {/* TARJETAS FINANCIERAS Y ACCIONES DE CAPITAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_6px_28px_rgba(15,23,42,0.06)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                  <FaWallet size={23} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-500">
                    Capital Disponible en Bodega
                  </p>
                  <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1 tracking-tight font-mono">
                    S/ {Number(datosCaja.saldoCaja || 0).toFixed(2)}
                  </p>
                  <div className="flex flex-wrap gap-2.5 mt-2.5 text-xs font-bold">
                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <FaArrowUp size={10} /> Ingresos: S/ {Number(datosCaja.resumenCaja?.totalIngresosCaja || 0).toFixed(2)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">
                      <FaArrowDown size={10} /> Egresos: S/ {Number(datosCaja.resumenCaja?.totalEgresosCaja || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-2.5 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  disabled={isSubmittingCaja}
                  onClick={() => {
                    setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: 'Capital inicial / Inyección de caja', categoria: 'CAPITAL_INICIAL' });
                    setModalMovimiento('INGRESO');
                  }}
                  className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                >
                  <FaPlus size={12} /> Ingresar Capital
                </button>
                <button
                  type="button"
                  disabled={isSubmittingCaja}
                  onClick={() => {
                    setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: 'GASTO_PERSONAL' });
                    setModalMovimiento('EGRESO');
                  }}
                  className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap"
                >
                  <FaMinus size={12} /> Registrar Gasto
                </button>
              </div>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-[0_6px_28px_rgba(15,23,42,0.06)] flex flex-col justify-center gap-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Desglose por Medio</p>
              <div className="flex justify-between items-center p-3 bg-verde-pastel/20 rounded-xl border border-emerald-200/70 gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <LogoEfectivo /> Efectivo en Caja
                </span>
                <span className="font-extrabold font-mono text-emerald-800 text-sm whitespace-nowrap">
                  S/ {Number(datosCaja.resumenCaja?.netoEfectivo || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50/60 rounded-xl border border-purple-200/70 gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                  <LogosYapePlin /> Yape / Plin / Banco
                </span>
                <span className="font-extrabold font-mono text-purple-900 text-sm whitespace-nowrap">
                  S/ {Number(datosCaja.resumenCaja?.netoDigital || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* GRÁFICO DE CURVA FINANCIERA ESTILO TRADING */}
          <div className="bg-neutral-950 p-5 sm:p-6 rounded-2xl border border-neutral-800 shadow-[0_8px_30px_rgba(15,23,42,0.12)]">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
              <div>
                <h3 className="text-white font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <FaChartLine className="text-verde-pastel shrink-0" /> Curva de Evolución de Capital en Tiempo Real
                </h3>
                <p className="text-xs text-neutral-400 font-medium mt-0.5">
                  Toca o pasa el cursor por cada punto para ver el detalle de cada movimiento.
                </p>
              </div>
              {puntoHover && (
                <div className="bg-neutral-900 border border-neutral-700 px-3.5 py-1.5 rounded-xl text-xs text-white flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                  <span className="text-neutral-400 font-mono">
                    {new Date(puntoHover.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                  <span className={puntoHover.tipo === 'INGRESO' ? 'text-emerald-400 font-bold font-mono' : 'text-red-400 font-bold font-mono'}>
                    {puntoHover.tipo === 'INGRESO' ? '+' : '-'} S/ {Number(puntoHover.monto || 0).toFixed(2)}
                  </span>
                  <span className="text-verde-pastel font-extrabold font-mono">
                    Saldo: S/ {Number(puntoHover.saldoResultante || 0).toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {coordenadas.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-neutral-400 border border-dashed border-neutral-800 rounded-xl p-4 text-center">
                <p className="text-sm font-medium">Aún no hay movimientos en la caja. Haz clic en "Ingresar Capital" o realiza una venta para iniciar la curva.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} className="w-full min-w-[540px] h-56 sm:h-60 overflow-visible">
                  <defs>
                    <linearGradient id="tradingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {[0.2, 0.5, 0.8].map((ratio, idx) => (
                    <line
                      key={idx}
                      x1={padX}
                      y1={altoSvg * ratio}
                      x2={anchoSvg - padX}
                      y2={altoSvg * ratio}
                      stroke="#262626"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  ))}

                  {coordenadas.length > 1 && (
                    <path d={areaPath} fill="url(#tradingGradient)" />
                  )}

                  {coordenadas.length > 1 && (
                    <path
                      d={lineaPath}
                      fill="none"
                      stroke="#a7f3d0"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {coordenadas.map((pt) => (
                    <g
                      key={pt.id}
                      onMouseEnter={() => setPuntoHover(pt)}
                      onMouseLeave={() => setPuntoHover(null)}
                      onClick={() => setPuntoHover(pt)}
                      className="cursor-pointer"
                    >
                      <circle cx={pt.x} cy={pt.y} r="14" fill="transparent" />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={puntoHover?.id === pt.id ? '8' : '6'}
                        fill={pt.tipo === 'INGRESO' ? '#10b981' : '#ef4444'}
                        stroke="#0a0a0a"
                        strokeWidth="2"
                      />
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>

          {/* FILTROS RÁPIDOS DEL LIBRO DIARIO DE CAJA */}
          {!isLoadingCaja && todosMovimientosCaja.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'TODOS', label: `Todos (${todosMovimientosCaja.length})`, activoClase: 'bg-verde-pastel text-emerald-950 border-emerald-300 shadow-2xs' },
                { id: 'INGRESO', label: `Ingresos (${totalIngresosMovs})`, activoClase: 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs' },
                { id: 'EGRESO', label: `Egresos (${totalEgresosMovs})`, activoClase: 'bg-red-50 text-red-700 border-red-300 shadow-2xs' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setFiltroTipoCaja(tab.id);
                    setLimiteCaja(BLOQUE_CARGA);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    filtroTipoCaja === tab.id
                      ? tab.activoClase
                      : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* LIBRO DIARIO DE CAJA: TARJETAS EN CELULAR (1 col) Y TABLET (2 cols) + TABLA EN PC (>= 1024px) */}
          <div className="lg:bg-white lg:border lg:border-slate-200/90 lg:rounded-2xl lg:shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
            
            {/* VISTA CELULAR (1 col) Y TABLET VERTICAL (2 cols) */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {isLoadingCaja ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/90 animate-pulse space-y-2.5">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                    <div className="h-6 bg-slate-100 rounded-lg w-1/2"></div>
                  </div>
                ))
              ) : movimientosFiltrados.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-slate-500 text-sm font-medium">
                  Sin movimientos financieros registrados para este filtro.
                </div>
              ) : (
                movimientosVisibles.map((mov) => (
                  <div key={mov.id} className="p-4 space-y-3 rounded-2xl border border-slate-200/90 shadow-2xs bg-white flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 mb-1">
                          {(mov.categoria || '').replace(/_/g, ' ')}
                        </span>
                        <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={mov.descripcion}>
                          {mov.descripcion}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`font-mono font-extrabold text-sm ${mov.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {mov.tipo === 'INGRESO' ? '+' : '-'} S/ {Number(mov.monto || 0).toFixed(2)}
                        </p>
                        <p className="text-[11px] font-mono font-bold text-slate-500 mt-0.5">
                          Saldo: S/ {Number(mov.saldoResultante || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">
                        {new Date(mov.createdAt).toLocaleDateString('es-PE')} • {new Date(mov.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <BadgeMetodoPago metodo={mov.metodoPago} />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* VISTA ESCRITORIO (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[720px]">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-5 whitespace-nowrap">Fecha y Hora</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Concepto / Descripción</th>
                    <th className="py-3.5 px-4 whitespace-nowrap text-center">Medio</th>
                    <th className="py-3.5 px-4 whitespace-nowrap text-right">Movimiento</th>
                    <th className="py-3.5 px-5 whitespace-nowrap text-right">Saldo Resultante</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                  {isLoadingCaja ? (
                    [...Array(4)].map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-56"></div></td>
                        <td className="py-4 px-4"><div className="h-6 bg-slate-200 rounded-full w-24 mx-auto"></div></td>
                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
                        <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
                      </tr>
                    ))
                  ) : movimientosFiltrados.length === 0 ? (
                    <tr><td colSpan="5" className="p-10 text-center text-slate-500">Sin movimientos financieros registrados para este filtro.</td></tr>
                  ) : (
                    movimientosVisibles.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          <p className="font-bold text-slate-900 text-sm">{new Date(mov.createdAt).toLocaleDateString('es-PE')}</p>
                          <p className="text-xs text-slate-500">{new Date(mov.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="py-3.5 px-4 max-w-[260px] xl:max-w-[380px]">
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 mb-1">
                            {(mov.categoria || '').replace(/_/g, ' ')}
                          </span>
                          <p className="font-bold text-slate-900 line-clamp-2 leading-snug" title={mov.descripcion}>
                            {mov.descripcion}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <BadgeMetodoPago metodo={mov.metodoPago} />
                        </td>
                        <td className={`py-3.5 px-4 text-right font-mono font-extrabold whitespace-nowrap ${mov.tipo === 'INGRESO' ? 'text-emerald-700' : 'text-red-600'}`}>
                          {mov.tipo === 'INGRESO' ? '+' : '-'} S/ {Number(mov.monto || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                          S/ {Number(mov.saldoResultante || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* PIE DE PAGINACIÓN CENTRADO Y CON ESPACIO (30 EN 30) */}
            {!isLoadingCaja && movimientosFiltrados.length > 0 && (
              <div className="mt-4 lg:mt-0 px-5 py-5 bg-white lg:bg-slate-50/80 border border-slate-200/90 lg:border-0 lg:border-t lg:border-slate-100 rounded-2xl lg:rounded-none shadow-2xs lg:shadow-none flex flex-col items-center justify-center gap-3 text-center">
                <p className="text-xs sm:text-sm font-semibold text-slate-500">
                  Mostrando <strong className="text-slate-800">{movimientosVisibles.length}</strong> de{' '}
                  <strong className="text-slate-800">{movimientosFiltrados.length}</strong> movimiento(s)
                  {filtroTipoCaja !== 'TODOS' ? ' filtrados' : ''}
                </p>

                {restantesCaja > 0 && (
                  <button
                    type="button"
                    onClick={() => setLimiteCaja(prev => prev + BLOQUE_CARGA)}
                    className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-6 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
                  >
                    <FaChevronDown size={12} />
                    <span>
                      Cargar {Math.min(BLOQUE_CARGA, restantesCaja)} movimiento{Math.min(BLOQUE_CARGA, restantesCaja) === 1 ? '' : 's'} más
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL PARA INGRESAR CAPITAL O REGISTRAR GASTO PERSONAL */}
      <AnimatePresence>
        {modalMovimiento && (
          <div className="fixed inset-0 bg-slate-950/70 z-[90] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    modalMovimiento === 'INGRESO' ? 'bg-verde-pastel/40 text-emerald-800' : 'bg-red-50 text-red-600'
                  }`}>
                    {modalMovimiento === 'INGRESO' ? <FaPlus size={16} /> : <FaMinus size={16} />}
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-slate-900 truncate">
                    {modalMovimiento === 'INGRESO' ? 'Ingresar Capital a Caja' : 'Registrar Gasto o Retiro'}
                  </h3>
                </div>
                <button
                  type="button"
                  disabled={isSubmittingCaja}
                  onClick={() => setModalMovimiento(null)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleGuardarMovimientoCaja} noValidate className="p-6 space-y-4 bg-white overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Monto (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formCaja.monto}
                    onChange={(e) => setFormCaja({ ...formCaja, monto: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-xl font-extrabold text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Billetera / Medio *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isSubmittingCaja}
                      onClick={() => setFormCaja({ ...formCaja, metodoPago: 'EFECTIVO' })}
                      className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                        formCaja.metodoPago === 'EFECTIVO'
                          ? 'bg-verde-pastel/25 border-emerald-500 text-emerald-950 shadow-2xs ring-1 ring-emerald-500/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <LogoEfectivo />
                      <span className="whitespace-nowrap">Efectivo</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingCaja}
                      onClick={() => setFormCaja({ ...formCaja, metodoPago: 'YAPE_PLIN' })}
                      className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                        formCaja.metodoPago === 'YAPE_PLIN'
                          ? 'bg-purple-50/80 border-[#742384] text-purple-950 shadow-2xs ring-1 ring-[#742384]/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <LogosYapePlin />
                      <span className="whitespace-nowrap">Yape/Plin</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingCaja}
                      onClick={() => setFormCaja({ ...formCaja, metodoPago: 'TRANSFERENCIA' })}
                      className={`py-2.5 px-1.5 rounded-xl text-[11px] sm:text-xs font-bold border transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 cursor-pointer ${
                        formCaja.metodoPago === 'TRANSFERENCIA'
                          ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-2xs ring-1 ring-blue-500/40'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <LogosBancos />
                      <span className="whitespace-nowrap">Transf.</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Motivo / Descripción *</label>
                  <input
                    type="text"
                    value={formCaja.descripcion}
                    onChange={(e) => setFormCaja({ ...formCaja, descripcion: e.target.value })}
                    placeholder={modalMovimiento === 'INGRESO' ? 'Ej: Dinero inicial de apertura' : 'Ej: Retiro personal, pago de luz, almuerzo...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm font-medium text-slate-900"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={isSubmittingCaja}
                    onClick={() => setModalMovimiento(null)}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 text-sm disabled:opacity-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCaja}
                    className={`px-6 py-2.5 rounded-xl font-extrabold text-sm shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                      modalMovimiento === 'INGRESO'
                        ? 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    {isSubmittingCaja ? 'Procesando...' : 'Confirmar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: DETALLES DE PRODUCTOS (EL OJITO) */}
      <AnimatePresence>
        {modalDetalles && (
          <div className="fixed inset-0 bg-slate-950/70 z-[80] flex items-center justify-center p-4 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 15 }} 
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaShoppingBag size={17} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-extrabold text-base text-slate-900">Detalle de Productos</h3>
                    <p className="text-xs text-slate-500 font-mono truncate">
                      OP: {modalDetalles.numeroComprobante || `#000${modalDetalles.id}`} • {formatearMetodoPago(modalDetalles.metodoPago)}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => setModalDetalles(null)} className="text-slate-400 hover:text-slate-700 p-1 transition-all cursor-pointer">
                  <FaTimes size={18} />
                </button>
              </div>

              <div className="p-0 bg-white flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-50/90 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 sm:px-5 font-bold text-slate-600 text-xs uppercase tracking-wider">Cant.</th>
                      <th className="py-3 px-3 sm:px-4 font-bold text-slate-600 text-xs uppercase tracking-wider">Producto</th>
                      <th className="py-3 px-4 sm:px-5 font-bold text-slate-600 text-xs uppercase tracking-wider text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(modalDetalles.detalles || []).map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 sm:px-5 font-extrabold text-slate-800 align-top">{item.cantidad}</td>
                        <td className="py-3 px-3 sm:px-4">
                          <p className="font-bold text-slate-900 line-clamp-2 leading-snug">{item.producto?.nombre || 'Producto'}</p>
                          <p className="text-xs text-slate-500 font-mono">Cód: {item.producto?.codigo || '-'}</p>
                        </td>
                        <td className="py-3 px-4 sm:px-5 text-right font-mono font-extrabold text-emerald-700 whitespace-nowrap align-top">
                          S/ {Number(item.subtotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-slate-50/80 px-6 py-4 border-t border-slate-200/80 flex justify-between items-center shrink-0">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Importe Total</span>
                <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
                  S/ {Number(modalDetalles.total || 0).toFixed(2)}
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: VISTA PREVIA DE BOLETA / FACTURA */}
      <AnimatePresence>
        {visorComprobante && (
          <div className="fixed inset-0 bg-neutral-950/90 z-[90] flex flex-col items-center justify-center p-3 sm:p-4 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl max-h-[92vh] bg-neutral-900 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col border border-neutral-800 my-auto"
            >
              <div className="bg-neutral-950 p-4 flex flex-wrap gap-3 justify-between items-center border-b border-neutral-800 shrink-0">
                <h3 className="text-white font-bold flex items-center gap-2 text-xs sm:text-sm uppercase tracking-widest">
                  <FaFilePdf className="text-red-500 text-lg shrink-0" /> Vista Previa del Comprobante
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => abrirTicket(visorComprobante.id, true)}
                    className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <FaPrint size={12} /> Imprimir
                  </button>
                  <a
                    href={visorComprobante.enlacePdf}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
                  >
                    <FaExternalLinkAlt size={12} /> Abrir Original (SUNAT)
                  </a>
                  <button
                    type="button"
                    onClick={() => setVisorComprobante(null)}
                    className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <FaTimes size={14} /> Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-neutral-800 w-full flex items-start justify-center p-4 sm:p-8 overflow-y-auto">
                <ComprobanteDetallado venta={visorComprobante} negocio={businessConfig} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}