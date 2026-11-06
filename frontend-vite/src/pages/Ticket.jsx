import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { FaPrint, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';
import ComprobanteDetallado from '../components/ComprobanteDetallado';
import { NOMBRE_SISTEMA, dinero, etiquetaMetodoPago, tipoDocumento } from '../utils/comprobante';

export default function Ticket() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const imprimirAlAbrir = searchParams.get('imprimir') === '1';

  const [venta, setVenta] = useState(null);
  const [error, setError] = useState(false);
  const { businessConfig } = useBusiness();

  // Prioriza los datos de la bodega que vienen con la venta; el contexto solo es respaldo
  const negocio = venta?.negocio || businessConfig || {};

  // Boleta y factura usan el comprobante detallado; ventas rápidas y fiados, el ticket simple
  const esDetallado = venta ? tipoDocumento(venta).clave !== 'TICKET' : false;

  useEffect(() => {
    const cargarTicket = async () => {
      try {
        const res = await axios.get(`/ventas/${id}`);
        setVenta(res.data);
      } catch (err) {
        console.error('Error cargando ticket', err);
        setError(true);
      }
    };
    cargarTicket();
  }, [id]);

  useEffect(() => {
    if (!venta || !imprimirAlAbrir) return;
    const temporizador = setTimeout(() => window.print(), 500);
    return () => clearTimeout(temporizador);
  }, [venta, imprimirAlAbrir]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <FaExclamationCircle className="text-red-400" size={32} />
        <p className="text-sm font-bold text-slate-700">No se pudo cargar el comprobante.</p>
        <p className="text-xs text-slate-500">Verifica tu conexión o vuelve a abrirlo desde el historial.</p>
      </div>
    );
  }

  if (!venta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
          <span className="w-5 h-5 rounded-full border-2 border-verde-pastel border-t-emerald-600 animate-spin" />
          Cargando comprobante...
        </div>
      </div>
    );
  }

  // ================= BOLETA / FACTURA: COMPROBANTE DETALLADO + IMPRIMIR =================
  if (esDetallado) {
    return (
      <div className="min-h-screen bg-slate-100 py-6 px-3 print:p-0 print:bg-white flex flex-col items-center font-sans antialiased">
        <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>

        <div className="w-[80mm] max-w-full mb-4 flex gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
          >
            <FaPrint size={14} /> Imprimir
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="px-4 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl text-sm border border-slate-200 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <FaTimes size={13} /> Cerrar
          </button>
        </div>

        <ComprobanteDetallado venta={venta} negocio={negocio} />
      </div>
    );
  }

  // ================= VENTA RÁPIDA / FIADO: TICKET SIMPLE (SIN BOTÓN) =================
  const fecha = new Date(venta.createdAt);

  return (
    <div className="bg-gray-100 min-h-screen py-8 print:p-0 print:bg-white flex flex-col items-center">
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>

      <div className="bg-white text-black font-mono text-xs w-[80mm] max-w-full shadow-xl p-4 print:shadow-none print:p-0 print:w-full print:m-0 border border-gray-200 print:border-none">

        {/* CABECERA DEL NEGOCIO */}
        <div className="text-center mb-4 border-b border-black pb-4 border-dashed">
          <h1 className="text-xl font-black uppercase mb-1">{negocio.nombre}</h1>
          {negocio.razonSocial && <p>{negocio.razonSocial}</p>}
          {negocio.ruc && <p>RUC: {negocio.ruc}</p>}
          {negocio.direccionFiscal && <p>{negocio.direccionFiscal}</p>}
          {negocio.telefono && <p>Tel: {negocio.telefono}</p>}
        </div>

        {/* DATOS DEL TICKET */}
        <div className="mb-4 text-left">
          <h2 className="font-bold text-center text-sm mb-2 border-b border-black pb-2">TICKET DE VENTA</h2>
          <p><strong>N° Op:</strong> {venta.numeroComprobante || `#000${venta.id}`}</p>
          <p>
            <strong>Fecha:</strong> {fecha.toLocaleDateString('es-PE')}{' '}
            {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p><strong>Cajero:</strong> {venta.vendedor?.nombre || '-'}</p>
          <p><strong>Pago:</strong> {etiquetaMetodoPago(venta.metodoPago).toUpperCase()}</p>
          <p className="mt-1"><strong>Cliente:</strong> {venta.clienteNombre || 'Cliente Varios'}</p>
          {venta.clienteDocumento && venta.clienteDocumento !== '00000000' && (
            <p><strong>Doc:</strong> {venta.clienteDocumento}</p>
          )}
        </div>

        {/* PRODUCTOS */}
        <table className="w-full text-left mb-4 border-t border-black border-dashed pt-2 mt-2">
          <thead>
            <tr className="border-b border-black pb-1">
              <th className="font-bold w-12 pb-1">CANT</th>
              <th className="font-bold pb-1">DESCRIPCIÓN</th>
              <th className="font-bold text-right pb-1">TOTAL</th>
            </tr>
          </thead>
          <tbody className="align-top">
            {venta.detalles?.map((det) => (
              <tr key={det.id}>
                <td className="pt-2">{det.cantidad}</td>
                <td className="pt-2 pr-2">{det.producto?.nombre || 'Producto'}</td>
                <td className="pt-2 text-right">S/ {dinero(det.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* TOTAL */}
        <div className="border-t border-black border-dashed pt-2 text-right mb-6">
          <p className="text-sm">TOTAL A PAGAR:</p>
          <p className="text-xl font-black">S/ {dinero(venta.total)}</p>
        </div>

        {/* PIE */}
        <div className="text-center text-[10px] border-t border-black border-dashed pt-4">
          <p>{negocio.mensajeTicket || '¡Gracias por su preferencia!'}</p>
          <p className="mt-2">Generado por {NOMBRE_SISTEMA}</p>
        </div>

      </div>
    </div>
  );
}