import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { useBusiness } from '../context/BusinessContext';

export default function Ticket() {
  const { id } = useParams();
  const [venta, setVenta] = useState(null);
  const { businessConfig } = useBusiness();

  useEffect(() => {
    const cargarTicket = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`/ventas/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setVenta(res.data);
        
        // Esperamos medio segundo para que renderice y mandamos a imprimir
        setTimeout(() => {
          window.print();
        }, 500);

      } catch (error) {
        console.error("Error cargando ticket", error);
      }
    };
    cargarTicket();
  }, [id]);

  if (!venta) return <div className="p-10 text-center font-mono">Cargando ticket...</div>;

  return (
    <div className="bg-white text-black font-mono text-xs w-[80mm] mx-auto p-4 print:p-0 print:w-full print:m-0" style={{ margin: '0 auto' }}>
      
      {/* CABECERA DEL NEGOCIO */}
      <div className="text-center mb-4 border-b border-black pb-4 border-dashed">
        <h1 className="text-xl font-black uppercase mb-1">{businessConfig.nombre}</h1>
        <p>{businessConfig.razonSocial}</p>
        <p>RUC: {businessConfig.ruc}</p>
        <p>{businessConfig.direccionFiscal}</p>
        <p>Tel: {businessConfig.telefono}</p>
      </div>

      {/* DATOS DEL COMPROBANTE */}
      <div className="mb-4 text-left">
        <h2 className="font-bold text-center text-sm mb-2 border-b border-black pb-2">
          {venta.tipoComprobante === 'SIN_COMPROBANTE' ? 'TICKET DE VENTA' : venta.tipoComprobante}
        </h2>
        <p><strong>N° Op:</strong> {venta.numeroComprobante || `#000${venta.id}`}</p>
        <p><strong>Fecha:</strong> {new Date(venta.createdAt).toLocaleDateString('es-PE')} {new Date(venta.createdAt).toLocaleTimeString('es-PE', {hour: '2-digit', minute:'2-digit'})}</p>
        <p><strong>Cajero:</strong> {venta.vendedor?.nombre}</p>
        <p className="mt-1"><strong>Cliente:</strong> {venta.clienteNombre || 'Cliente Varios'}</p>
        {venta.clienteDocumento && venta.clienteDocumento !== '00000000' && (
          <p><strong>Doc:</strong> {venta.clienteDocumento}</p>
        )}
      </div>

      {/* DETALLES DE PRODUCTOS */}
      <table className="w-full text-left mb-4 border-t border-black border-dashed pt-2 mt-2">
        <thead>
          <tr className="border-b border-black pb-1">
            <th className="font-bold w-12 pb-1">CANT</th>
            <th className="font-bold pb-1">DESCRIPCIÓN</th>
            <th className="font-bold text-right pb-1">TOTAL</th>
          </tr>
        </thead>
        <tbody className="align-top">
          {venta.detalles.map(det => (
            <tr key={det.id}>
              <td className="pt-2">{det.cantidad}</td>
              <td className="pt-2 pr-2">{det.producto.nombre}</td>
              <td className="pt-2 text-right">S/ {det.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="border-t border-black border-dashed pt-2 text-right mb-6">
        <p className="text-sm">TOTAL A PAGAR:</p>
        <p className="text-xl font-black">S/ {venta.total.toFixed(2)}</p>
      </div>

      {/* PIE DE PÁGINA */}
      <div className="text-center text-[10px] border-t border-black border-dashed pt-4">
        <p>{businessConfig.mensajeTicket || '¡Gracias por su preferencia!'}</p>
        <p className="mt-2">Generado por Sistema POS V2.0</p>
      </div>
      
    </div>
  );
}