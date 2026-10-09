import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { FaSearch, FaFileExcel, FaEye, FaFilePdf, FaCalendarAlt, FaHistory, FaChartLine, FaShoppingBag, FaReceipt, FaFileInvoice, FaTimes, FaExternalLinkAlt } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext'; // 1. Importamos tu configuración de negocio

export default function Historial() {
  const [ventas, setVentas] = useState([]);
  const [resumen, setResumen] = useState({ totalIngresos: 0, cantidadOperaciones: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const { businessConfig } = useBusiness(); // Extraemos los datos para el ticket falso

  // Paginación y Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('MES'); 
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  const [paginaActual, setPaginaActual] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const limiteCarga = 25;

  // Modales
  const [modalDetalles, setModalDetalles] = useState(null);
  const [visorComprobante, setVisorComprobante] = useState(null); // 2. Ahora guarda toda la venta para dibujar la réplica

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
        'Nombre del Cliente': venta.clienteNombre || 'Cliente Varios',
        'Documento': (venta.clienteDocumento && venta.clienteDocumento !== '00000000') ? venta.clienteDocumento : 'Anónimo',
        'Atendido por': venta.vendedor?.nombre || 'Desconocido',
        'Subtotal (S/)': parseFloat(venta.subtotal),
        'IGV (S/)': parseFloat(venta.igv),
        'Total (S/)': parseFloat(venta.total)
      }));

      const hoja = XLSX.utils.json_to_sheet(dataExcel);
      const anchosDeColumna = [
        { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, 
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

      {/* TARJETAS DE RESUMEN */}
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

      {/* TABLA DE HISTORIAL */}
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
                    <td className="p-4 text-right whitespace-nowrap">
                      <p className="font-black text-emerald-600 text-base">S/ {venta.total.toFixed(2)}</p>
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex justify-center items-center gap-2">
                        {/* Botón Ojito (Detalles rápidos) */}
                        <button 
                          onClick={() => setModalDetalles(venta)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-2 rounded-lg transition-colors border border-slate-200" title="Ver Detalles de Productos"
                        >
                          <FaEye size={16} />
                        </button>
                        
                        {/* Botón Comprobante (Carga la réplica o el ticket) */}
                        <button 
                          onClick={() => {
                            if (venta.enlacePdf) {
                              setVisorComprobante(venta); // Abrimos nuestro modal de réplica
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

      {/* MODAL 1: DETALLES DE PRODUCTOS (EL OJITO) */}
      <AnimatePresence>
        {modalDetalles && (
          <div className="fixed inset-0 bg-neutral-950/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
              <div className="bg-neutral-950 p-5 flex justify-between items-center text-white border-b-4 border-verde-pastel">
                <div>
                  <h3 className="font-extrabold text-lg flex items-center gap-2 uppercase tracking-wide"><FaShoppingBag className="text-verde-pastel" /> Productos Vendidos</h3>
                  <p className="text-xs text-slate-400 font-mono mt-1">OP: {modalDetalles.numeroComprobante || `#000${modalDetalles.id}`}</p>
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
              {/* Barra superior de herramientas */}
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

              {/* Contenedor gris simulando el visor de PDF */}
              <div className="flex-1 bg-neutral-800 w-full flex items-start justify-center p-8 overflow-y-auto">
                
                {/* RÉPLICA EXACTA DEL TICKET DE NUBEFACT */}
                <div className="bg-white text-black font-sans w-[80mm] shadow-2xl p-4 shrink-0 mx-auto leading-tight">
                  
                  {/* Datos Empresa */}
                  <div className="text-center mb-3">
                    <h1 className="font-extrabold uppercase text-[13px]">{businessConfig.razonSocial || businessConfig.nombre}</h1>
                    <p className="text-[12px] font-bold leading-none">-</p>
                    <p className="text-[12px] font-bold leading-none mb-1">- - - - -</p>
                    <p className="text-[12px] font-bold">RUC {businessConfig.ruc}</p>
                    <p className="text-[13px] font-bold mt-1 uppercase">
                      {visorComprobante.tipoComprobante === 'FACTURA' ? 'FACTURA DE VENTA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA'}
                    </p>
                    <p className="text-[13px] font-bold">{visorComprobante.numeroComprobante}</p>
                  </div>

                  {/* Datos Cliente y Emisión */}
                  <div className="text-[11px] mb-3">
                    <p className="font-bold">ADQUIRIENTE</p>
                    <p className="uppercase">{visorComprobante.tipoComprobante === 'FACTURA' ? 'RUC:' : 'DNI:'} {visorComprobante.clienteDocumento}</p>
                    <p className="uppercase">{visorComprobante.clienteNombre}</p>
                    <p><span className="font-bold">FECHA EMISIÓN:</span> {new Date(visorComprobante.createdAt).toLocaleDateString('es-PE')}</p>
                    <p><span className="font-bold">MONEDA:</span> SOLES</p>
                    <p><span className="font-bold">IGV:</span> {businessConfig.impuestoPorcentaje || '18.00'} %</p>
                  </div>

                  {/* Tabla de Productos */}
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

                  {/* Totales (CORREGIDO: Alineación perfecta con tabla) */}
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

                  {/* Simulador de importe en letras */}
                  <div className="border-t border-b border-gray-300 py-1 mb-2 text-center text-[10px] font-bold text-gray-500 uppercase">
                     IMPORTE EN LETRAS: (VER PDF ORIGINAL)
                  </div>

                  {/* Footer Text */}
                  <div className="text-center text-[10px] leading-tight">
                    <p>Representación impresa de la {visorComprobante.tipoComprobante === 'FACTURA' ? 'FACTURA' : 'BOLETA'} DE VENTA ELECTRÓNICA, visita</p>
                    <p className="font-bold mt-0.5">www.nubefact.com/{businessConfig.ruc}</p>
                    
                    {/* Placeholder QR */}
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