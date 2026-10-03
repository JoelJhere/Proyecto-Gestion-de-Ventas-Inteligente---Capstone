import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export const crearVenta = async (req, res) => {
  // AÑADIDO: cliente y metodoEnvio para Nubefact
  const { carrito, tipoComprobante, subtotal, igv, total, cliente, metodoEnvio } = req.body;
  const vendedorId = req.user.id; 

  if (!carrito || carrito.length === 0) {
    return res.status(400).json({ message: 'El carrito está vacío' });
  }

  try {
    let tipoDocDB = 'SIN_COMPROBANTE';
    if (tipoComprobante === 'BOLETA') tipoDocDB = 'BOLETA';
    if (tipoComprobante === 'FACTURA') tipoDocDB = 'FACTURA';

    // 1. VALIDACIÓN PREVIA DE STOCK
    for (const item of carrito) {
      const productoDB = await prisma.producto.findUnique({ where: { id: item.id } });
      if (productoDB.stock < item.cantidad) {
        return res.status(400).json({ message: `Stock insuficiente para: ${item.nombre}` });
      }
    }

    let linkPdf = null;
    let linkXml = null;
    let correlativoFinal = `${tipoDocDB.charAt(0)}-${Date.now()}`; // Por defecto para TICKET SIMPLE

    // 2. INTEGRACIÓN CON NUBEFACT (SOLO BOLETAS Y FACTURAS)
    if (tipoComprobante !== 'TICKET') {
      
      // A) Obtener configuración y credenciales del negocio activo desde la BD
      const configNegocio = await prisma.businessConfig.findFirst();
      
      if (!configNegocio || !configNegocio.nubefactRuta || !configNegocio.nubefactToken) {
        return res.status(400).json({ message: 'El negocio no tiene configuradas las credenciales de facturación (Ruta y Token API).' });
      }

      // Obtener el último correlativo para seguir la secuencia
      const ultimaVenta = await prisma.venta.findFirst({
        where: { tipoComprobante: tipoDocDB },
        orderBy: { id: 'desc' }
      });
      
      let numeroCorrelativo = 1;
      if (ultimaVenta && ultimaVenta.numeroComprobante && ultimaVenta.numeroComprobante.includes('-')) {
        numeroCorrelativo = parseInt(ultimaVenta.numeroComprobante.split('-')[1]) + 1;
      }
      
      const serieDoc = tipoComprobante === 'FACTURA' ? 'F001' : 'B001';
      correlativoFinal = `${serieDoc}-${String(numeroCorrelativo).padStart(6, '0')}`;

      // Configuración del tipo de documento del cliente
      let tipoDocIdentidad = "-"; 
      if (tipoComprobante === 'FACTURA') tipoDocIdentidad = "6"; // 6 = RUC
      else if (cliente.documento && String(cliente.documento).length === 8) tipoDocIdentidad = "1"; // 1 = DNI

      const factorIgv = 1 + (configNegocio.impuestoPorcentaje / 100); 

      // Construir los items para Nubefact
      const itemsNubefact = carrito.map(item => {
        const precioUnitarioConIgv = parseFloat(item.precioVenta);
        const valorUnitarioSinIgv = precioUnitarioConIgv / factorIgv;
        const cantidad = parseInt(item.cantidad);
        
        return {
          "unidad_de_medida": "NIU",
          "codigo": item.codigo || item.id.toString(),
          "descripcion": item.nombre,
          "cantidad": cantidad,
          "valor_unitario": valorUnitarioSinIgv,
          "precio_unitario": precioUnitarioConIgv,
          "subtotal": valorUnitarioSinIgv * cantidad,
          "tipo_de_igv": "1", 
          "igv": (precioUnitarioConIgv * cantidad) - (valorUnitarioSinIgv * cantidad),
          "total": precioUnitarioConIgv * cantidad,
          "anticipo_regularizacion": "false"
        };
      });

      // JSON final que exige Nubefact
      const nubefactJSON = {
        "operacion": "generar_comprobante",
        "tipo_de_comprobante": tipoComprobante === 'FACTURA' ? "1" : "2",
        "serie": serieDoc,
        "numero": numeroCorrelativo,
        "sunat_transaction": "1", 
        "cliente_tipo_de_documento": tipoDocIdentidad,
        "cliente_numero_de_documento": cliente.documento || "00000000",
        "cliente_denominacion": cliente.nombre || "CLIENTE VARIOS",
        "cliente_email": (metodoEnvio === 'CORREO' && cliente.correo) ? cliente.correo : "",
        "fecha_de_emision": new Date().toISOString().split('T')[0],
        "moneda": "1", 
        "porcentaje_de_igv": configNegocio.impuestoPorcentaje,
        "total_gravada": parseFloat(subtotal),
        "total_igv": parseFloat(igv),
        "total": parseFloat(total),
        "enviar_automaticamente_a_la_sunat": "true",
        "enviar_automaticamente_al_cliente": (metodoEnvio === 'CORREO' && cliente.correo) ? "true" : "false",
        "items": itemsNubefact
      };

      try {
        // B) Petición con Credenciales Dinámicas
        const responseNube = await axios.post(
          configNegocio.nubefactRuta, 
          nubefactJSON, 
          { headers: { 'Authorization': `Bearer ${configNegocio.nubefactToken}` } }
        );

        linkPdf = responseNube.data.enlace_del_pdf;
        linkXml = responseNube.data.enlace_del_xml;
        
      } catch (nubeError) {
        console.error("Error desde Nubefact:", nubeError.response?.data?.errors || nubeError.message);
        throw new Error(`SUNAT/Nubefact rechazó el comprobante: ${nubeError.response?.data?.errors || 'Error de conexión'}`);
      }
    }

    // 3. GUARDAR EN NUESTRA BASE DE DATOS (Transacción)
    const nuevaVenta = await prisma.$transaction(async (tx) => {
      
      const venta = await tx.venta.create({
        data: {
          vendedorId: parseInt(vendedorId),
          tipoComprobante: tipoDocDB,
          numeroComprobante: correlativoFinal, // Usamos el correlativo real de Nubefact
          subtotal: parseFloat(subtotal),
          igv: parseFloat(igv),
          total: parseFloat(total),
        }
      });

      for (const item of carrito) {
        await tx.detalleVenta.create({
          data: {
            ventaId: venta.id,
            productoId: item.id,
            cantidad: item.cantidad,
            precioVenta: parseFloat(item.precioVenta),
            subtotal: parseFloat(item.precioVenta) * item.cantidad
          }
        });

        await tx.producto.update({
          where: { id: item.id },
          data: { stock: { decrement: item.cantidad } }
        });

        await tx.movimientoInventario.create({
          data: {
            productoId: item.id,
            tipo: 'VENTA',
            cantidad: item.cantidad,
            motivo: `Venta POS ${correlativoFinal}`
          }
        });
      }

      return venta;
    });

    res.status(201).json({ 
      message: 'Venta procesada con éxito', 
      venta: nuevaVenta,
      enlacePdf: linkPdf // Enviamos el link de SUNAT al Frontend
    });

  } catch (error) {
    console.error('Error procesando venta:', error);
    res.status(400).json({ message: error.message || 'Error interno al procesar la venta' });
  }
};