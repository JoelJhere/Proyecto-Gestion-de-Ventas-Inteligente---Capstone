import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaSearch, FaFileExcel, FaEye, FaFilePdf, FaCalendarAlt, FaHistory, FaChartLine, FaShoppingBag, FaReceipt, FaFileInvoice } from 'react-icons/fa';
import * as XLSX from 'xlsx';

export default function Historial() {
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState({ totalIngresos: 0, cantidadOperaciones: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Estados de Paginación y Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('MES'); // HOY, SEMANA, MES, ANIO, CUSTOM
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  const [paginaActual, setPaginaActual] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const limiteCarga = 25;

  // Función para calcular las fechas según el botón rápido seleccionado
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

  // Efecto principal para cargar datos cuando cambian los filtros o la página
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    cargarHistorial(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroActivo, busqueda, fechaInicio, fechaFin]);

  const cargarHistorial = async (resetear = false) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const paginaACargar = resetear ? 1 : paginaActual + 1;

      // Si no es un filtro personalizado, calculamos las fechas automáticamente
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

  const handleExportarExcel = async () => {
    // Mostramos un toast de carga porque si hay miles de ventas tomará un segundo
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

      // 1. Mapear datos (Corrigiendo el problema de los NULLs en documentos antiguos)
      const dataExcel = ventasExportar.map(venta => ({
        'Fecha': new Date(venta.createdAt).toLocaleDateString('es-PE'),
        'Hora': new Date(venta.createdAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        'Tipo de Comprobante': venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'TICKET SIMPLE' : venta.tipoComprobante,
        'N° Comprobante': venta.numeroComprobante || 'TICKET INTERNO',
        'Nombre del Cliente': venta.clienteNombre || 'Cliente Varios',
        'Documento': (venta.clienteDocumento && venta.clienteDocumento !== '00000000') ? venta.clienteDocumento : 'Anónimo',
        'Atendido por': venta.vendedor?.nombre || 'Desconocido',
        'Subtotal (S/)': parseFloat(venta.subtotal),
        'IGV (S/)': parseFloat(venta.igv),
        'Total (S/)': parseFloat(venta.total)
      }));

      // 2. Convertir JSON a Hoja de cálculo
      const hoja = XLSX.utils.json_to_sheet(dataExcel);

      // --- 3. MEJORA VISUAL: AUTO-AJUSTE DEL ANCHO DE COLUMNAS ---
      const anchosDeColumna = [
        { wch: 12 }, // A: Fecha
        { wch: 10 }, // B: Hora
        { wch: 20 }, // C: Tipo de Comprobante
        { wch: 20 }, // D: N° Comprobante
        { wch: 35 }, // E: Nombre del Cliente (Más ancho para razones sociales largas)
        { wch: 15 }, // F: Documento
        { wch: 20 }, // G: Atendido por
        { wch: 15 }, // H: Subtotal (S/)
        { wch: 12 }, // I: IGV (S/)
        { wch: 15 }  // J: Total (S/)
      ];
      hoja['!cols'] = anchosDeColumna; // Se inyecta la configuración de ancho a la hoja

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Historial');

      // Descargamos el archivo
      const nombreArchivo = `Historial_Ventas_${filtroActivo}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(libro, nombreArchivo);

      toast.success('¡Excel exportado con éxito!', { id: toastId });

    } catch (error) {
      console.error('Error al exportar Excel:', error);
      toast.error('Ocurrió un error al generar el archivo Excel.', { id: toastId });
    }
  };

  // Iconos de comprobantes
  const IconoComprobante = ({ tipo }) => {
    if (tipo === 'FACTURA') return <FaFileInvoice className="text-blue-500" title="Factura" />;
    if (tipo === 'BOLETA') return <FaReceipt className="text-orange-500" title="Boleta" />;
    return <FaShoppingBag className="text-slate-400" title="Ticket Simple" />;
  };

  return (
    <div className="flex flex-col gap-6 text-slate-900 pb-20 lg:pb-0 font-sans min-h-[calc(100vh-6rem)] relative">
      
      {/* HEADER & TITULO */}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-verde-pastel/10 rounded-full blur-2xl pointer-events-none"></div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <FaHistory className="text-verde-pastel" size={28} /> Historial
          </h2>
          <p className="text-slate-500 text-sm mt-1 font-medium">Revisa y filtra todas las transacciones de tu negocio.</p>
        </div>
      </div>

      {/* TARJETAS DE RESUMEN (TOP) */}
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
          
          {/* Barra de Búsqueda */}
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

          {/* Filtros Rápidos */}
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

          {/* Botón Excel */}
          <button 
            onClick={handleExportarExcel}
            className="bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wide shrink-0 shadow-sm hover:shadow"
          >
            <FaFileExcel size={16} /> Exportar
          </button>
        </div>

        {/* Selector de Fechas Personalizado (Aparece solo si elige CUSTOM) */}
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

      {/* TABLA DE HISTORIAL (DISEÑO PRODUCTOS) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-white text-[10px] uppercase tracking-widest font-bold">
                <th className="p-4 rounded-tl-xl whitespace-nowrap">Fecha y Hora</th>
                <th className="p-4 whitespace-nowrap">Comprobante</th>
                <th className="p-4 whitespace-nowrap">Cliente / Documento</th>
                <th className="p-4 whitespace-nowrap text-right">Total</th>
                <th className="p-4 rounded-tr-xl text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium text-slate-700">
              {ventas.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">
                    No se encontraron ventas para estos filtros.
                  </td>
                </tr>
              ) : (
                ventas.map((venta) => (
                  <tr key={venta.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 whitespace-nowrap">
                      <p className="font-bold text-slate-800 text-sm">
                        {new Date(venta.createdAt).toLocaleDateString('es-PE')}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        {new Date(venta.createdAt).toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <IconoComprobante tipo={venta.tipoComprobante} />
                        <div>
                          <p className="font-bold text-slate-800 text-sm">
                            {venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'TICKET SIMPLE' : venta.tipoComprobante}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            {venta.numeroComprobante || 'TICKET INTERNO'}
                          </p>
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
                    <td className="p-4 text-right whitespace-nowrap">
                      <p className="font-black text-emerald-600 text-base">S/ {venta.total.toFixed(2)}</p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex justify-center items-center gap-2">
                        <button 
                          onClick={() => toast.success('Modal de Detalles programado para FASE 4', { icon: '👁️' })}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors border border-slate-200" title="Ver Detalles de Productos"
                        >
                          <FaEye size={16} />
                        </button>
                        
                        <button 
                          onClick={() => toast.success('Vista Previa PDF programada para FASE 4', { icon: '📄' })}
                          disabled={!venta.enlacePdf}
                          className="bg-red-50 hover:bg-red-100 text-red-500 p-2 rounded-lg transition-colors border border-red-100 disabled:opacity-40 disabled:cursor-not-allowed" title="Ver Comprobante PDF"
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

        {/* Botón Cargar Más (Paginación Ligera) */}
        {isLoading && (
          <div className="p-4 text-center text-sm font-bold text-slate-400 animate-pulse">Cargando ventas...</div>
        )}
        
        {hayMas && !isLoading && (
          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button 
              onClick={() => cargarHistorial(false)}
              className="text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-neutral-950 px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm hover:shadow transition-all"
            >
              Cargar más ventas...
            </button>
          </div>
        )}
      </div>

    </div>
  );
}