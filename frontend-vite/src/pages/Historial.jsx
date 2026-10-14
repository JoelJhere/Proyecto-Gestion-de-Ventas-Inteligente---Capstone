import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { 
  FaSearch, FaFileExcel, FaEye, FaFilePdf, FaCalendarAlt, FaHistory, 
  FaChartLine, FaShoppingBag, FaReceipt, FaFileInvoice, FaTimes, 
  FaExternalLinkAlt, FaWallet, FaArrowUp, FaArrowDown, FaPlus, FaMinus, 
  FaMoneyBillWave, FaMobileAlt, FaUniversity 
} from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';

export default function Historial() {
  const [pestanaActiva, setPestanaActiva] = useState('VENTAS'); // 'VENTAS' o 'CAJA'
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.rol === 'ADMIN';

  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState({ totalIngresos: 0, cantidadOperaciones: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { businessConfig } = useBusiness();

  // Paginación y Filtros de Ventas
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('MES'); 
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  const [paginaActual, setPaginaActual] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const limiteCarga = 25;

  // Modales de Ventas
  const [modalDetalles, setModalDetalles] = useState(null);
  const [visorComprobante, setVisorComprobante] = useState(null);

  // --- ESTADOS DE FLUJO DE CAJA Y GRÁFICO (FASE 3) ---
  const [datosCaja, setDatosCaja] = useState({
    saldoCaja: 0,
    resumenCaja: { totalIngresosCaja: 0, totalEgresosCaja: 0, netoEfectivo: 0, netoDigital: 0 },
    movimientos: []
  });
  const [isLoadingCaja, setIsLoadingCaja] = useState(false);
  const [modalMovimiento, setModalMovimiento] = useState(null); // 'INGRESO' o 'EGRESO'
  const [formCaja, setFormCaja] = useState({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: '' });
  const [puntoHover, setPuntoHover] = useState(null);

  const formatearMetodoPago = (metodo) => {
    if (metodo === 'YAPE_PLIN') return 'Yape / Plin';
    if (metodo === 'TRANSFERENCIA') return 'Transferencia';
    if (metodo === 'FIADO') return 'Fiado (Crédito)';
    return 'Efectivo';
  };

  const BadgeMetodoPago = ({ metodo }) => {
    if (metodo === 'YAPE_PLIN') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <FaMobileAlt size={10} /> Yape / Plin
        </span>
      );
    }
    if (metodo === 'TRANSFERENCIA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <FaUniversity size={10} /> Transferencia
        </span>
      );
    }
    if (metodo === 'FIADO') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Fiado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <FaMoneyBillWave size={10} /> Efectivo
      </span>
    );
  };

  const calcularFechasFiltro = useCallback((tipo) => {
    const hoy = new Date();
    const formato = (fecha) => fecha.toISOString().split('T')[0];
    let inicio = '';
    let fin = formato(hoy);

    if (tipo === 'HOY') {
      inicio = fin;
    } else if (tipo === 'SEMANA') {
      const semanaPasada = new Date(hoy);
      semanaPasada.setDate(hoy.getDate() - 7);
      inicio = formato(semanaPasada);
    } else if (tipo === 'MES') {
      const mesPasado = new Date(hoy);
      mesPasado.setMonth(hoy.getMonth() - 1);
      inicio = formato(mesPasado);
    } else if (tipo === 'ANIO') {
      const inicioAnio = new Date(hoy.getFullYear(), 0, 1);
      inicio = formato(inicioAnio);
    }

    return { inicio, fin };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    cargarHistorial(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo, busqueda, fechaInicio, fechaFin]);

  const cargarFlujoCaja = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingCaja(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/historial/caja', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDatosCaja(res.data);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el flujo de caja.');
    } finally {
      setIsLoadingCaja(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (pestanaActiva === 'CAJA') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarFlujoCaja();
    }
  }, [pestanaActiva, cargarFlujoCaja]);

  const cargarHistorial = async (resetear = false) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const paginaACargar = resetear ? 1 : paginaActual + 1;

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
          limite: limiteCarga,
          busqueda,
          fechaInicio: fInicio,
          fechaFin: fFin
        }
      });

      if (resetear) {
        setVentas(res.data.datos);
        setPaginaActual(1);
      } else {
        setVentas(prev => [...prev, ...res.data.datos]);
        setPaginaActual(paginaACargar);
      }

      setResumen(res.data.resumen);
      setHayMas(res.data.paginacion.hayMas);

    } catch (error) {
      console.error(error);
      toast.error('No se pudo cargar el historial de ventas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAplicarFiltroRapido = (tipo) => {
    setFiltroActivo(tipo);
    if (tipo !== 'CUSTOM') {
      setFechaInicio('');
      setFechaFin('');
    }
  };

  const handleGuardarMovimientoCaja = async (e) => {
    e.preventDefault();
    if (!formCaja.monto || parseFloat(formCaja.monto) <= 0) {
      return toast.error('Ingresa un monto válido mayor a 0.');
    }
    if (!formCaja.descripcion.trim()) {
      return toast.error('Ingresa una descripción para este movimiento.');
    }

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/historial/caja/movimiento', {
        tipo: modalMovimiento,
        categoria: formCaja.categoria || (modalMovimiento === 'INGRESO' ? 'CAPITAL_INICIAL' : 'GASTO_PERSONAL'),
        monto: formCaja.monto,
        metodoPago: formCaja.metodoPago,
        descripcion: formCaja.descripcion
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success(res.data.message);
      setModalMovimiento(null);
      setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: '' });
      cargarFlujoCaja();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al registrar movimiento.');
    }
  };

  const handleExportarExcel = async () => {
    const toastId = toast.loading('Generando reporte Excel...');
    
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
          busqueda,
          fechaInicio: fInicio,
          fechaFin: fFin
        }
      });

      const ventasExportar = res.data.datos;

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
        'Subtotal (S/)': parseFloat(venta.subtotal),
        'IGV (S/)': parseFloat(venta.igv),
        'Total (S/)': parseFloat(venta.total)
      }));

      const hoja = XLSX.utils.json_to_sheet(dataExcel);
      const anchosDeColumna = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 18 },
        { wch: 35 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, 
        { wch: 12 }, { wch: 15 }
      ];
      hoja['!cols'] = anchosDeColumna;

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

      const nombreArchivo = `Historial_Ventas_${filtroActivo}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(libro, nombreArchivo);

      toast.success('¡Excel exportado con éxito!', { id: toastId });

    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Ocurrió un error al generar el archivo Excel.', { id: toastId });
    }
  };

  const IconoComprobante = ({ tipo }) => {
    if (tipo === 'FACTURA') return <FaFileInvoice className="text-blue-500" title="Factura" />;
    if (tipo === 'BOLETA') return <FaReceipt className="text-orange-500" title="Boleta" />;
    return <FaShoppingBag className="text-slate-400" title="Ticket Simple" />;
  };

  // --- PREPARACIÓN DE PUNTOS PARA EL GRÁFICO ESTILO BITCOIN / TRADING ---
  const puntosGrafico = [...datosCaja.movimientos].reverse();
  const anchoSvg = 850;
  const altoSvg = 240;
  const padX = 35;
  const padY = 25;

  const valoresSaldo = puntosGrafico.map(p => p.saldoResultante);
  const minSaldo = valoresSaldo.length > 0 ? Math.min(...valoresSaldo, 0) : 0;
  const maxSaldo = valoresSaldo.length > 0 ? Math.max(...valoresSaldo, 100) : 100;
  const rangoSaldo = maxSaldo - minSaldo === 0 ? 100 : maxSaldo - minSaldo;

  const coordenadas = puntosGrafico.map((punto, idx) => {
    const x = puntosGrafico.length === 1 
      ? anchoSvg / 2 
      : padX + (idx / (puntosGrafico.length - 1)) * (anchoSvg - padX * 2);
    const y = altoSvg - padY - ((punto.saldoResultante - minSaldo) / rangoSaldo) * (altoSvg - padY * 2);
    return { x, y, ...punto };
  });

  const lineaPath = coordenadas.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = coordenadas.length > 0 
    ? `${lineaPath} L ${coordenadas[coordenadas.length - 1].x} ${altoSvg - padY} L ${coordenadas[0].x} ${altoSvg - padY} Z` 
    : '';

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-20 lg:pb-0 font-sans min-h-[calc(100vh-6rem)] relative">
      
      {/* HEADER & SELECTOR DE PESTAÑAS */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-verde-pastel/10 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <FaHistory className="text-verde-pastel" size={28} /> Historial y Finanzas
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Revisa todas las transacciones y el capital en tiempo real de tu bodega.</p>
        </div>

        {isAdmin && (
          <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 z-10 shrink-0">
            <button
              type="button"
              onClick={() => setPestanaActiva('VENTAS')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                pestanaActiva === 'VENTAS'
                  ? 'bg-neutral-950 text-verde-pastel shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FaReceipt /> Comprobantes de Venta
            </button>
            <button
              type="button"
              onClick={() => setPestanaActiva('CAJA')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 ${
                pestanaActiva === 'CAJA'
                  ? 'bg-neutral-950 text-verde-pastel shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FaChartLine /> Flujo de Caja y Capital
            </button>
          </div>
        )}
      </div>

      {pestanaActiva === 'VENTAS' ? (
        <>
          {/* TARJETAS DE RESUMEN DE VENTAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 z-10">
                <FaChartLine className="text-emerald-600 text-xl" />
              </div>
              <div className="z-10">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ingresos del Filtro</p>
                <p className="text-2xl font-black text-slate-800">S/ {resumen.totalIngresos.toFixed(2)}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] z-0"><FaChartLine size={100} /></div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0 z-10">
                <FaShoppingBag className="text-blue-600 text-xl" />
              </div>
              <div className="z-10">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ventas Realizadas</p>
                <p className="text-2xl font-black text-slate-800">{resumen.cantidadOperaciones}</p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-[0.03] z-0"><FaShoppingBag size={100} /></div>
            </motion.div>
          </div>

          {/* CONTROLES Y FILTROS */}
          <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col xl:flex-row justify-between gap-4">
              <div className="relative w-full xl:w-1/3">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaSearch className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar cliente o comprobante..." 
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-verde-pastel focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium text-sm" 
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {['HOY', 'SEMANA', 'MES', 'ANIO', 'CUSTOM'].map(filtro => (
                  <button
                    key={filtro}
                    onClick={() => handleAplicarFiltroRapido(filtro)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors border ${
                      filtroActivo === filtro 
                        ? 'bg-neutral-950 text-white border-neutral-950' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {filtro === 'ANIO' ? 'AÑO' : filtro === 'CUSTOM' ? 'PERSONALIZADO' : filtro}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleExportarExcel}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide shrink-0 shadow-sm hover:shadow"
              >
                <FaFileExcel size={16} /> Exportar
              </button>
            </div>

            <AnimatePresence>
              {filtroActivo === 'CUSTOM' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="flex items-center gap-3 pt-3 border-t border-slate-100 overflow-hidden"
                >
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><FaCalendarAlt/> Desde:</label>
                    <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-verde-pastel" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500 flex items-center gap-1"><FaCalendarAlt/> Hasta:</label>
                    <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="p-2 border border-slate-200 rounded-lg text-sm bg-slate-50 outline-none focus:border-verde-pastel" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* TABLA DE HISTORIAL DE VENTAS */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-white text-[10px] uppercase tracking-widest font-bold border-t-4 border-verde-pastel">
                    <th className="p-4 whitespace-nowrap">Fecha y Hora</th>
                    <th className="p-4 whitespace-nowrap">Comprobante</th>
                    <th className="p-4 whitespace-nowrap">Cliente / Documento</th>
                    <th className="p-4 whitespace-nowrap text-center">Método de Pago</th>
                    <th className="p-4 whitespace-nowrap text-right">Total</th>
                    <th className="p-4 text-center whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700">
                  {ventas.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No se encontraron ventas para estos filtros.
                      </td>
                    </tr>
                  ) : (
                    ventas.map((venta) => (
                      <tr key={venta.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <p className="font-bold text-slate-800 text-sm">{new Date(venta.createdAt).toLocaleDateString('es-PE')}</p>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">{new Date(venta.createdAt).toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'})}</p>
                        </td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <IconoComprobante tipo={venta.tipoComprobante} />
                            <div>
                              <p className="font-bold text-slate-800 text-sm">
                                {venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'TICKET SIMPLE' : venta.tipoComprobante}
                              </p>
                              <p className="text-xs text-slate-500 font-mono mt-0.5">{venta.numeroComprobante || 'TICKET INTERNO'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 max-w-[200px] truncate">
                          <p className="font-bold text-slate-800 text-sm truncate" title={venta.clienteNombre}>
                            {venta.clienteNombre || 'Cliente Varios'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {venta.clienteDocumento && venta.clienteDocumento !== "00000000" ? `Doc: ${venta.clienteDocumento}` : 'Cliente Anónimo'}
                          </p>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <BadgeMetodoPago metodo={venta.metodoPago} />
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <p className="font-black text-emerald-600 text-base">S/ {venta.total.toFixed(2)}</p>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <div className="flex justify-center items-center gap-2">
                            <button 
                              onClick={() => setModalDetalles(venta)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors border border-slate-200" title="Ver Detalles de Productos"
                            >
                              <FaEye size={16} />
                            </button>
                            
                            <button 
                              onClick={() => {
                                if (venta.enlacePdf) {
                                  setVisorComprobante(venta);
                                } else {
                                  const width = 400; const height = 600;
                                  const left = (window.innerWidth / 2) - (width / 2);
                                  const top = (window.innerHeight / 2) - (height / 2);
                                  window.open(`/ticket/${venta.id}`, 'Ticket', `width=${width},height=${height},top=${top},left=${left}`);
                                }
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg transition-colors border border-red-100" title="Ver Comprobante"
                            >
                              <FaFilePdf size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {isLoading && <div className="p-4 text-center text-sm font-bold text-slate-400 animate-pulse">Cargando ventas...</div>}
            {hayMas && !isLoading && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <button onClick={() => cargarHistorial(false)} className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-neutral-950 px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm hover:shadow transition-all">
                  Cargar más ventas...
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ================= PESTAÑA 2: FLUJO DE CAJA Y GRÁFICO ESTILO TRADING ================= */
        <div className="space-y-6">
          
          {/* TARJETAS FINANCIERAS Y ACCIONES DE CAPITAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-neutral-950 text-white p-6 rounded-2xl border-t-4 border-verde-pastel shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <FaWallet className="text-verde-pastel" /> Capital Disponible en Bodega
                </p>
                <p className="text-4xl font-black text-white mt-2 tracking-tight">
                  S/ {datosCaja.saldoCaja.toFixed(2)}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs font-semibold text-neutral-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <FaArrowUp size={10} /> Ingresos: S/ {datosCaja.resumenCaja.totalIngresosCaja.toFixed(2)}
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <FaArrowDown size={10} /> Compras/Gastos: S/ {datosCaja.resumenCaja.totalEgresosCaja.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: 'Capital inicial / Inyección de caja', categoria: 'CAPITAL_INICIAL' });
                    setModalMovimiento('INGRESO');
                  }}
                  className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <FaPlus size={12} /> Ingresar Capital
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormCaja({ monto: '', metodoPago: 'EFECTIVO', descripcion: '', categoria: 'GASTO_PERSONAL' });
                    setModalMovimiento('EGRESO');
                  }}
                  className="bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 font-extrabold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
                >
                  <FaMinus size={12} /> Registrar Gasto / Retiro
                </button>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center gap-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desglose de Movimientos</p>
              <div className="flex justify-between items-center p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FaMoneyBillWave className="text-emerald-600" /> Efectivo en Caja
                </span>
                <span className="font-black text-emerald-700 text-sm">S/ {datosCaja.resumenCaja.netoEfectivo.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50/70 rounded-xl border border-purple-100">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <FaMobileAlt className="text-purple-600" /> Yape / Plin / Banco
                </span>
                <span className="font-black text-purple-700 text-sm">S/ {datosCaja.resumenCaja.netoDigital.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* GRÁFICO DE CURVA FINANCIERA ESTILO BITCOIN / TRADING */}
          <div className="bg-neutral-950 p-6 rounded-2xl border border-neutral-800 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-2">
              <div>
                <h3 className="text-white font-extrabold text-base flex items-center gap-2">
                  <FaChartLine className="text-verde-pastel" /> Curva de Evolución de Capital en Tiempo Real
                </h3>
                <p className="text-xs text-neutral-400">Cada subida refleja ventas o cobros de fiados; cada bajada refleja compras a proveedores o retiros.</p>
              </div>
              {puntoHover && (
                <div className="bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-xl text-xs text-white flex items-center gap-3">
                  <span className="text-neutral-400 font-mono">{new Date(puntoHover.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  <span className={puntoHover.tipo === 'INGRESO' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                    {puntoHover.tipo === 'INGRESO' ? '+' : '-'} S/ {puntoHover.monto.toFixed(2)}
                  </span>
                  <span className="text-verde-pastel font-black">Saldo: S/ {puntoHover.saldoResultante.toFixed(2)}</span>
                </div>
              )}
            </div>

            {coordenadas.length === 0 ? (
              <div className="h-52 flex flex-col items-center justify-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
                <p className="text-sm font-medium">Aún no hay movimientos en la caja. Haz clic en &quot;Ingresar Capital&quot; o realiza una venta para iniciar la curva.</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${anchoSvg} ${altoSvg}`} className="w-full h-60 overflow-visible">
                  <defs>
                    <linearGradient id="tradingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Líneas guía horizontales */}
                  {[0.2, 0.5, 0.8].map((ratio, idx) => (
                    <line
                      key={idx}
                      x1={padX}
                      y1={ altoSvg * ratio }
                      x2={anchoSvg - padX}
                      y2={ altoSvg * ratio }
                      stroke="#262626"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Área sombreada bajo la curva */}
                  {coordenadas.length > 1 && (
                    <path d={areaPath} fill="url(#tradingGradient)" />
                  )}

                  {/* Línea principal de tendencia */}
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

                  {/* Puntos interactivos */}
                  {coordenadas.map((pt) => (
                    <g key={pt.id} onMouseEnter={() => setPuntoHover(pt)} onMouseLeave={() => setPuntoHover(null)} className="cursor-pointer">
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r="6"
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

          {/* TABLA DE LIBRO DIARIO DE CAJA */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-950 text-white text-[10px] uppercase tracking-widest font-bold border-t-4 border-verde-pastel">
                    <th className="p-4 whitespace-nowrap">Fecha y Hora</th>
                    <th className="p-4 whitespace-nowrap">Concepto / Descripción</th>
                    <th className="p-4 whitespace-nowrap text-center">Método</th>
                    <th className="p-4 whitespace-nowrap text-right">Movimiento</th>
                    <th className="p-4 whitespace-nowrap text-right">Saldo en Caja</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                  {isLoadingCaja ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400">Cargando movimientos...</td></tr>
                  ) : datosCaja.movimientos.length === 0 ? (
                    <tr><td colSpan="5" className="p-8 text-center text-slate-400">Sin movimientos registrados.</td></tr>
                  ) : (
                    datosCaja.movimientos.map((mov) => (
                      <tr key={mov.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <p className="font-bold text-slate-800 text-sm">{new Date(mov.createdAt).toLocaleDateString('es-PE')}</p>
                          <p className="text-xs text-slate-500">{new Date(mov.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="p-4">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 mr-2">
                            {mov.categoria.replace('_', ' ')}
                          </span>
                          <span className="font-bold text-slate-800">{mov.descripcion}</span>
                        </td>
                        <td className="p-4 text-center whitespace-nowrap">
                          <BadgeMetodoPago metodo={mov.metodoPago} />
                        </td>
                        <td className={`p-4 text-right font-black whitespace-nowrap ${mov.tipo === 'INGRESO' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {mov.tipo === 'INGRESO' ? '+' : '-'} S/ {mov.monto.toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-black text-slate-900 whitespace-nowrap">
                          S/ {mov.saldoResultante.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA INGRESAR CAPITAL O REGISTRAR GASTO PERSONAL */}
      <AnimatePresence>
        {modalMovimiento && (
          <div className="fixed inset-0 bg-slate-950/60 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="bg-slate-950 p-5 flex justify-between items-center text-white border-t-4 border-verde-pastel">
                <h3 className="font-extrabold text-lg flex items-center gap-2">
                  {modalMovimiento === 'INGRESO' ? (
                    <><FaPlus className="text-verde-pastel" /> Ingresar Capital a Caja</>
                  ) : (
                    <><FaMinus className="text-red-400" /> Registrar Gasto o Retiro</>
                  )}
                </h3>
                <button type="button" onClick={() => setModalMovimiento(null)} className="text-slate-400 hover:text-white">
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleGuardarMovimientoCaja} noValidate className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Monto (S/) *</label>
                  <input
                    type="number"
                    step="0.10"
                    value={formCaja.monto}
                    onChange={(e) => setFormCaja({ ...formCaja, monto: e.target.value })}
                    placeholder="0.00"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-lg font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Billetera / Medio *</label>
                  <select
                    value={formCaja.metodoPago}
                    onChange={(e) => setFormCaja({ ...formCaja, metodoPago: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 outline-none font-bold text-sm text-slate-800"
                  >
                    <option value="EFECTIVO">Efectivo (Cajón de la Bodega)</option>
                    <option value="YAPE_PLIN">Yape / Plin</option>
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">Motivo / Descripción *</label>
                  <input
                    type="text"
                    value={formCaja.descripcion}
                    onChange={(e) => setFormCaja({ ...formCaja, descripcion: e.target.value })}
                    placeholder={modalMovimiento === 'INGRESO' ? 'Ej: Dinero inicial de apertura' : 'Ej: Retiro personal, pago de luz, almuerzo...'}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 outline-none text-sm font-medium text-slate-800"
                  />
                </div>

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalMovimiento(null)}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={`px-6 py-2.5 rounded-xl font-extrabold text-sm shadow-sm ${
                      modalMovimiento === 'INGRESO'
                        ? 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'
                        : 'bg-red-500 hover:bg-red-600 text-white'
                    }`}
                  >
                    Confirmar
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
          <div className="fixed inset-0 bg-neutral-950/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-neutral-950 p-5 flex justify-between items-center text-white border-b-4 border-verde-pastel">
                <div>
                  <h3 className="font-extrabold text-lg flex items-center gap-2 uppercase tracking-wide"><FaShoppingBag className="text-verde-pastel" /> Productos Vendidos</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    OP: {modalDetalles.numeroComprobante || `#000${modalDetalles.id}`} | Pago: {formatearMetodoPago(modalDetalles.metodoPago)}
                  </p>
                </div>
                <button onClick={() => setModalDetalles(null)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-all"><FaTimes size={18} /></button>
              </div>
              <div className="p-0 bg-slate-50 max-h-[60vh] overflow-y-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead className="bg-slate-100 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 font-bold text-slate-500 text-xs tracking-wider">CANT</th>
                      <th className="py-3 px-4 font-bold text-slate-500 text-xs tracking-wider">PRODUCTO</th>
                      <th className="py-3 px-4 font-bold text-slate-500 text-xs tracking-wider text-right">SUBTOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalDetalles.detalles.map((item) => (
                      <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-700">{item.cantidad}</td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-800">{item.producto.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono">Cód: {item.producto.codigo}</p>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600 whitespace-nowrap">S/ {item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white p-5 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total de esta venta</span>
                <span className="text-2xl font-black text-slate-900 tracking-tighter">S/ {modalDetalles.total.toFixed(2)}</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: RÉPLICA DEL COMPROBANTE NUBEFACT (VISTA PREVIA HTML) */}
      <AnimatePresence>
        {visorComprobante && (
          <div className="fixed inset-0 bg-neutral-950/90 z-[90] flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-4xl min-h-[85vh] bg-neutral-900 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col border border-neutral-800 my-8"
            >
              <div className="bg-neutral-950 p-4 flex justify-between items-center border-b border-neutral-800 shrink-0 sticky top-0 z-10">
                <h3 className="text-white font-bold flex items-center gap-2 text-sm uppercase tracking-widest">
                  <FaFilePdf className="text-red-500 text-lg" /> Vista Previa del Comprobante
                </h3>
                <div className="flex gap-2">
                  <a href={visorComprobante.enlacePdf} target="_blank" rel="noreferrer" className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                    <FaExternalLinkAlt size={12} /> Abrir Original (SUNAT)
                  </a>
                  <button onClick={() => setVisorComprobante(null)} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                    <FaTimes size={14} /> Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-neutral-800 w-full flex items-start justify-center p-8 overflow-y-auto">
                <div className="bg-white text-black font-sans w-[80mm] shadow-2xl p-4 shrink-0 mx-auto leading-tight">
                  <div className="text-center mb-3">
                    <h1 className="font-extrabold uppercase text-[13px]">{businessConfig.razonSocial || businessConfig.nombre}</h1>
                    <p className="text-[12px] font-bold leading-none">-</p>
                    <p className="text-[12px] font-bold leading-none mb-1">- - -</p>
                    <p className="text-[12px] font-bold">RUC {businessConfig.ruc}</p>
                    <p className="text-[13px] font-bold mt-1 uppercase">
                      {visorComprobante.tipoComprobante === 'FACTURA' ? 'FACTURA DE VENTA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}
                    </p>
                    <p className="text-[13px] font-bold">{visorComprobante.numeroComprobante}</p>
                  </div>

                  <div className="text-[11px] mb-3">
                    <p className="font-bold">ADQUIRIENTE</p>
                    <p className="uppercase">{visorComprobante.tipoComprobante === 'FACTURA' ? 'RUC:' : 'DNI:'} {visorComprobante.clienteDocumento}</p>
                    <p className="uppercase">{visorComprobante.clienteNombre}</p>
                    <p><span className="font-bold">FECHA EMISIÓN:</span> {new Date(visorComprobante.createdAt).toLocaleDateString('es-PE')}</p>
                    <p><span className="font-bold">MÉTODO PAGO:</span> {formatearMetodoPago(visorComprobante.metodoPago).toUpperCase()}</p>
                    <p><span className="font-bold">MONEDA:</span> SOLES</p>
                    <p><span className="font-bold">IGV:</span> {businessConfig.impuestoPorcentaje || '18.00'} %</p>
                  </div>

                  <table className="w-full text-left text-[11px] mb-2 border-t border-b border-dashed border-black py-1">
                    <thead>
                      <tr>
                        <th className="py-1 font-bold">[ CANT. ] DESCRIPCIÓN</th>
                        <th className="py-1 font-bold text-right">P/U</th>
                        <th className="py-1 font-bold text-right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="align-top">
                      {visorComprobante.detalles.map(det => (
                        <tr key={det.id}>
                          <td className="py-1 pr-1">
                            <span className="font-bold">[ {det.cantidad} ]</span> NIU {det.producto.nombre}
                          </td>
                          <td className="py-1 text-right">{(det.subtotal / det.cantidad).toFixed(3)}</td>
                          <td className="py-1 text-right">{det.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="w-full flex justify-end text-[11px] font-bold mb-2">
                    <table className="text-right border-collapse">
                      <tbody>
                        <tr>
                          <td className="pr-4 py-0.5">GRAVADA</td>
                          <td className="pr-2 py-0.5">S/</td>
                          <td className="py-0.5 w-12">{visorComprobante.subtotal.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="pr-4 py-0.5">IGV</td>
                          <td className="pr-2 py-0.5">S/</td>
                          <td className="py-0.5">{visorComprobante.igv.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td className="pr-4 py-0.5">TOTAL</td>
                          <td className="pr-2 py-0.5">S/</td>
                          <td className="py-0.5">{visorComprobante.total.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-b border-gray-300 py-1 mb-2 text-center text-[10px] font-bold text-gray-500 uppercase">
                     IMPORTE EN LETRAS: (VER PDF ORIGINAL)
                  </div>

                  <div className="text-center text-[10px] leading-tight">
                    <p>Representación impresa de la {visorComprobante.tipoComprobante === 'FACTURA' ? 'FACTURA' : 'BOLETA'} DE VENTA ELECTRÓNICA, visita</p>
                    <p className="font-bold mt-0.5">www.nubefact.com/{businessConfig.ruc}</p>
                    
                    <div className="mt-3 border border-gray-300 w-24 h-24 mx-auto flex items-center justify-center p-1 opacity-70">
                       <span className="text-gray-400 font-bold">QR SUNAT</span>
                    </div>
                    
                    <p className="mt-2 text-[9px] text-gray-500">Emitido desde el Sistema POS</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}