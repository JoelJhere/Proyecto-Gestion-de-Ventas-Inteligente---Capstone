import { QRCodeSVG } from 'qrcode.react';
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

// Fila "etiqueta ..... valor"
const Fila = ({ etiqueta, children }) => (
  <div className="flex justify-between gap-3">
    <span className="font-semibold text-slate-500 shrink-0">{etiqueta}</span>
    <span className="font-semibold text-right break-words min-w-0">{children}</span>
  </div>
);

// Comprobante detallado (80 mm) para BOLETA y FACTURA.
// Se usa en la ventana /ticket/:id y en la Vista Previa del Historial.
export default function ComprobanteDetallado({ venta, negocio }) {
  const emisor = negocio || {};
  const doc = tipoDocumento(venta);
  const tasaIgv = Number(emisor.impuestoPorcentaje) || 18;
  const { gravada, igv, total } = calcularTotales(venta, tasaIgv);
  const fecha = new Date(venta.createdAt);
  const tieneDocCliente = venta.clienteDocumento && venta.clienteDocumento !== '00000000';
  const docCliente = tipoDocCliente(venta.clienteDocumento);
  const esCredito = venta.metodoPago === 'FIADO';
  const textoQR = doc.codigoSunat ? generarTextoQR(venta, emisor.ruc, igv) : null;

  return (
    <div className="bg-white text-slate-900 w-[80mm] max-w-full shrink-0 overflow-hidden rounded-xl border border-slate-200 shadow-[0_12px_40px_rgba(15,23,42,0.10)] print:w-full print:rounded-none print:border-0 print:shadow-none">
      <div className="px-4 py-5 text-[11px] leading-snug tabular-nums">
        {/* EMISOR */}
        <header className="text-center">
          {emisor.logo && (
            <img
              src={emisor.logo}
              alt=""
              className="h-12 mx-auto mb-2 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <h1 className="text-[15px] font-extrabold uppercase leading-tight">{emisor.nombre || emisor.razonSocial}</h1>
          {emisor.razonSocial && emisor.razonSocial !== emisor.nombre && (
            <p className="font-semibold uppercase text-slate-600 mt-0.5">{emisor.razonSocial}</p>
          )}
          {emisor.ruc && <p className="font-bold mt-1">RUC {emisor.ruc}</p>}
          {emisor.direccionFiscal && <p className="text-slate-600">{emisor.direccionFiscal}</p>}
          {(emisor.ciudad || emisor.departamento) && (
            <p className="text-slate-600">{[emisor.ciudad, emisor.departamento].filter(Boolean).join(' - ')}</p>
          )}
          {emisor.telefono && <p className="text-slate-600">Tel: {emisor.telefono}</p>}
        </header>

        {/* TIPO Y NÚMERO */}
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

        {/* ADQUIRIENTE */}
        <section className="mt-3 pt-3 border-t border-dashed border-slate-400">
          <p className="font-extrabold text-emerald-800 print:text-slate-900 mb-1">Adquiriente</p>
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
          <Fila etiqueta="Op. gravada">S/ {dinero(gravada)}</Fila>
          <Fila etiqueta={`IGV (${tasaIgv}%)`}>S/ {dinero(igv)}</Fila>
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

          <p>Representación impresa de la {doc.titulo.toLowerCase()}.</p>

          <p className="mt-1.5 font-semibold text-slate-800 text-[11px]">
            {emisor.mensajeTicket || '¡Gracias por su preferencia!'}
          </p>

          <div className="mt-3 pt-2.5 border-t border-dashed border-slate-300">
            <p>Comprobante generado por</p>
            <p className="font-extrabold text-[12px] text-emerald-800 print:text-slate-900">{NOMBRE_SISTEMA}</p>
            <p>Sistema de gestión para bodegas y minimarkets</p>
          </div>
        </footer>
      </div>
    </div>
  );
}