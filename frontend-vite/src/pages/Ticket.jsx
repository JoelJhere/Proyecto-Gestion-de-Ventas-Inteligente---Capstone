import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { FaPrint, FaTimes, FaExclamationCircle } from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';
import {
  NOMBRE_SISTEMA,
  dinero,
  etiquetaMetodoPago,
  tipoDocumento,
  tipoDocCliente,
  calcularTotales,
  generarTextoQR,
  numeroALetras
} from '../utils/comprobante';

// Fila "etiqueta ..... valor" usada en los datos del comprobante
const Fila = ({ etiqueta, children }) => (
  <div className="flex justify-between gap-3">
    <span className="font-semibold text-slate-500 shrink-0">{etiqueta}</span>
    <span className="font-semibold text-right break-words min-w-0">{children}</span>
  </div>
);

export default function Ticket() {
  const { id } = useParams();
  const [venta, setVenta] = useState(null);
  const [error, setError] = useState(false);
  const { businessConfig } = useBusiness();
  // Prioriza los datos de la bodega que vienen con la venta; el contexto solo es respaldo
  const negocio = venta?.negocio || businessConfig || {};

  useEffect(() => {
    const cargarTicket = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/ventas/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVenta(res.data);
      } catch (err) {
        console.error('Error cargando ticket', err);
        setError(true);
      }
    };
    cargarTicket();
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <FaExclamationCircle className="text-red-400" size={32} />
        <p className="text-sm font-bold text-slate-700">No se pudo cargar el comprobante.</p>
        <p className="text-xs text-slate-500">Verifica tu conexión o vuelve a abrirlo desde el historial.</p>
        <button
          type="button"
          onClick={() => window.close()}
          className="mt-2 px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-100 cursor-pointer"
        >
          Cerrar ventana
        </button>
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

  // ---------- Datos derivados ----------
  const doc = tipoDocumento(venta);
  const esTicket = doc.clave === 'TICKET';
  const tasaIgv = Number(negocio.impuestoPorcentaje) || 18;
  const { gravada, igv, total } = calcularTotales(venta, tasaIgv);
  const fecha = new Date(venta.createdAt);
  const tieneDocCliente = venta.clienteDocumento && venta.clienteDocumento !== '00000000';
  const docCliente = tipoDocCliente(venta.clienteDocumento);
  const esCredito = venta.metodoPago === 'FIADO';
  const textoQR = doc.codigoSunat ? generarTextoQR(venta, negocio.ruc, igv) : null;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-3 print:p-0 print:bg-white flex flex-col items-center font-sans antialiased">
      {/* Tamaño de papel para impresoras térmicas de 80mm */}
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>

      {/* Barra de acciones (no se imprime) */}
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

      {/* Papel del comprobante */}
      <div className="bg-white text-slate-900 w-[80mm] max-w-full overflow-hidden rounded-xl border border-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.10)] print:w-full print:rounded-none print:border-0 print:shadow-none">
        <div className="h-1.5 bg-verde-pastel print:hidden" />

        <div className="px-4 py-5 text-[11px] leading-snug tabular-nums">
          {/* EMISOR */}
          <header className="text-center">
            {negocio.logo && (
              <img
                src={negocio.logo}
                alt=""
                className="h-12 mx-auto mb-2 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <h1 className="text-[15px] font-extrabold uppercase leading-tight">{negocio.nombre || negocio.razonSocial}</h1>
            {negocio.razonSocial && negocio.razonSocial !== negocio.nombre && (
              <p className="font-semibold uppercase text-slate-600 mt-0.5">{negocio.razonSocial}</p>
            )}
            {negocio.ruc && <p className="font-bold mt-1">RUC {negocio.ruc}</p>}
            {negocio.direccionFiscal && <p className="text-slate-600">{negocio.direccionFiscal}</p>}
            {(negocio.ciudad || negocio.departamento) && (
              <p className="text-slate-600">{[negocio.ciudad, negocio.departamento].filter(Boolean).join(' - ')}</p>
            )}
            {negocio.telefono && <p className="text-slate-600">Tel: {negocio.telefono}</p>}
          </header>

          {/* TIPO Y NÚMERO DE DOCUMENTO */}
          <div className="mt-3 border-2 border-slate-900 rounded-lg py-2 px-2 text-center">
            <p className="text-[12px] font-extrabold tracking-wide">{doc.titulo}</p>
            <p className="text-[15px] font-black font-mono mt-0.5">
              {venta.numeroComprobante || `#000${venta.id}`}
            </p>
          </div>

          {/* DATOS DE LA OPERACIÓN */}
          <section className="mt-3 pt-3 border-t border-dashed border-slate-400 space-y-0.5">
            <Fila etiqueta="Fecha de emisión">
              {fecha.toLocaleDateString('es-PE')} {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
            </Fila>
            <Fila etiqueta="Atendido por">{venta.vendedor?.nombre || '-'}</Fila>
            <Fila etiqueta="Moneda">Soles (PEN)</Fila>
            <Fila etiqueta="Forma de pago">
              {esCredito ? 'Crédito (Fiado)' : `Contado - ${etiquetaMetodoPago(venta.metodoPago)}`}
            </Fila>
          </section>

          {/* CLIENTE */}
          <section className="mt-3 pt-3 border-t border-dashed border-slate-400">
            <p className="font-extrabold text-emerald-800 print:text-slate-900 mb-1">
              {esTicket ? 'Cliente' : 'Adquiriente'}
            </p>
            <p className="font-bold uppercase">{venta.clienteNombre || 'Cliente varios'}</p>
            {tieneDocCliente && (
              <p className="font-semibold">
                {docCliente.etiqueta}: {venta.clienteDocumento}
              </p>
            )}
            {venta.clienteDireccion && <p className="text-slate-600">{venta.clienteDireccion}</p>}
          </section>

          {/* DETALLE */}
          <table className="w-full mt-3 text-left">
            <thead>
              <tr className="border-y border-slate-900 text-[10px]">
                <th className="py-1 w-8 font-bold">Cant.</th>
                <th className="py-1 font-bold">Descripción</th>
                <th className="py-1 text-right font-bold">P. unit.</th>
                <th className="py-1 text-right font-bold">Importe</th>
              </tr>
            </thead>
            <tbody className="align-top divide-y divide-dashed divide-slate-200">
              {venta.detalles?.map((det) => {
                const cantidad = Number(det.cantidad) || 1;
                const subtotal = Number(det.subtotal) || 0;
                return (
                  <tr key={det.id}>
                    <td className="py-1.5 font-bold">{det.cantidad}</td>
                    <td className="py-1.5 pr-1 break-words">{det.producto?.nombre || 'Producto'}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{dinero(subtotal / cantidad)}</td>
                    <td className="py-1.5 text-right font-bold whitespace-nowrap">{dinero(subtotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* TOTALES */}
          <section className="mt-1 pt-2 border-t border-slate-900 space-y-0.5">
            {!esTicket && (
              <>
                <Fila etiqueta="Op. gravada">S/ {dinero(gravada)}</Fila>
                <Fila etiqueta={`IGV (${tasaIgv}%)`}>S/ {dinero(igv)}</Fila>
              </>
            )}
            <div className="flex justify-between items-center mt-1.5 pt-2 border-t border-dashed border-slate-400">
              <span className="text-[12px] font-extrabold">Total a pagar</span>
              <span className="text-[19px] font-black font-mono">S/ {dinero(total)}</span>
            </div>
          </section>

          {/* IMPORTE EN LETRAS */}
          <p className="mt-2 py-1.5 border-y border-slate-300 text-center text-[10px] font-bold uppercase">
            Son: {numeroALetras(total)}
          </p>

          {/* PIE */}
          <footer className="mt-4 text-center text-[10px] text-slate-600 leading-tight">
            {textoQR && (
              <div className="flex justify-center mb-2">
                <QRCodeSVG value={textoQR} size={96} level="M" />
              </div>
            )}

            {esTicket ? (
              <p>Solicite su boleta o factura electrónica en caja.</p>
            ) : (
              <p>Representación impresa de la {doc.titulo.toLowerCase()}.</p>
            )}

            <p className="mt-1.5 font-semibold text-slate-800 text-[11px]">
              {negocio.mensajeTicket || '¡Gracias por su preferencia!'}
            </p>

            <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300">
              <p>Comprobante generado por</p>
              <p className="font-extrabold text-[12px] text-emerald-800 print:text-slate-900">{NOMBRE_SISTEMA}</p>
              <p>Sistema de gestión para bodegas y minimarkets</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}