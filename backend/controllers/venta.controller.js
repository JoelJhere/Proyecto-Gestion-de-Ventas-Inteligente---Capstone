import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export const crearVenta = async (req, res) => {
  const { carrito, tipoComprobante, metodoPago, subtotal, igv, total, cliente, metodoEnvio, esFiado } = req.body;  const vendedorId = req.user.id; 
  const negocioId = req.user.negocioId;

  // 1. OBTENEMOS LA CONFIGURACIÓN DEL NEGOCIO ESPECÍFICO
  const configNegocio = await prisma.negocio.findUnique({
    where: { id: negocioId }
  });
  
  if (!configNegocio) {
    return res.status(404).json({ message: 'Error crítico: No se encontró la configuración de tu bodega.' });
  }

  const nombreParaFrontend = configNegocio.nombre || 'nuestro local';

  if (!carrito || carrito.length === 0) {
    return res.status(400).json({ message: 'El carrito está vacío' });
  }

  // Validación de seguridad para Fiados
  if (esFiado && (!cliente.nombre || !cliente.telefono)) {
    return res.status(400).json({ message: 'Para fiar es obligatorio ingresar el Nombre y el WhatsApp del vecino.' });
  }

  try {
    let tipoDocDB = 'SIN_COMPROBANTE';
    if (!esFiado) {
      if (tipoComprobante === 'BOLETA') tipoDocDB = 'BOLETA';
      if (tipoComprobante === 'FACTURA') tipoDocDB = 'FACTURA';
    }

    // 2. VALIDACIÓN PREVIA DE STOCK (Asegurando que el producto pertenece al negocio)
    for (const item of carrito) {
      const productoDB = await prisma.producto.findUnique({ 
        where: { id: item.id } 
      });
      if (!productoDB || productoDB.negocioId !== negocioId) {
        return res.status(400).json({ message: `Producto inválido o no pertenece a tu inventario: ${item.nombre}` });
      }
      if (productoDB.stock < item.cantidad) {
        return res.status(400).json({ message: `Stock insuficiente para: ${item.nombre}` });
      }
    }

    let linkPdf = null;
    let linkXml = null;
    let correlativoFinal = esFiado ? `FIADO-${Date.now()}` : `${tipoDocDB.charAt(0)}-${Date.now()}`;

    // 3. INTEGRACIÓN CON NUBEFACT (CON AUTO-SINCRONIZACIÓN DE CORRELATIVO)
    if (tipoComprobante !== 'TICKET' && !esFiado) {
      
      const rutaNubefact = configNegocio.nubefactRuta?.trim();
      const tokenNubefact = configNegocio.nubefactToken?.trim();

      if (!rutaNubefact || !tokenNubefact) {
        return res.status(400).json({ message: 'Tu bodega no tiene configuradas las credenciales de facturación electrónica (API Nubefact).' });
      }

      const ultimaVenta = await prisma.venta.findFirst({
        where: { 
          tipoComprobante: tipoDocDB,
          negocioId: negocioId
        },
        orderBy: { id: 'desc' }
      });
      
      let numeroCorrelativo = 1; 
      
      if (ultimaVenta && ultimaVenta.numeroComprobante && ultimaVenta.numeroComprobante.includes('-')) {
        const numeroExtraido = parseInt(ultimaVenta.numeroComprobante.split('-')[1]);
        if (!isNaN(numeroExtraido) && String(numeroExtraido).length <= 8) {
          numeroCorrelativo = numeroExtraido + 1;
        }
      }
      
      const serieDoc = tipoComprobante === 'FACTURA' ? 'F001' : 'B001';

      let tipoDocIdentidad = "-"; 
      if (tipoComprobante === 'FACTURA') tipoDocIdentidad = "6"; 
      else if (cliente.documento && String(cliente.documento).length === 8) tipoDocIdentidad = "1"; 

      const factorIgv = 1 + (configNegocio.impuestoPorcentaje / 100); 

      const itemsNubefact = carrito.map(item => {
        const precioUnitarioConIgv = parseFloat(item.precioVenta);
        const valorUnitarioSinIgv = precioUnitarioConIgv / factorIgv;
        const cantidad = parseInt(item.cantidad);
        const subtotalItem = valorUnitarioSinIgv * cantidad;
        const totalItem = precioUnitarioConIgv * cantidad;
        const igvItem = totalItem - subtotalItem;
        
        return {
          "unidad_de_medida": "NIU",
          "codigo": item.codigo || item.id.toString(),
          "descripcion": item.nombre,
          "cantidad": cantidad,
          "valor_unitario": Number(valorUnitarioSinIgv.toFixed(6)),
          "precio_unitario": Number(precioUnitarioConIgv.toFixed(2)),
          "subtotal": Number(subtotalItem.toFixed(2)),
          "tipo_de_igv": "1", 
          "igv": Number(igvItem.toFixed(2)),
          "total": Number(totalItem.toFixed(2)),
          "anticipo_regularizacion": "false"
        };
      });

      // Fecha actual en zona horaria de Perú (evita que a las 7pm cambie al día siguiente)
      const fechaPeru = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

      // Bucle inteligente: si el correlativo ya existe en Nubefact, avanza al siguiente disponible
      let emitidoConExito = false;
      let intentos = 0;

      while (!emitidoConExito && intentos < 50) {
        correlativoFinal = `${serieDoc}-${String(numeroCorrelativo).padStart(6, '0')}`;

        const nubefactJSON = {
          "operacion": "generar_comprobante",
          "tipo_de_comprobante": tipoComprobante === 'FACTURA' ? "1" : "2",
          "serie": serieDoc,
          "numero": numeroCorrelativo,
          "sunat_transaction": "1", 
          "cliente_tipo_de_documento": tipoDocIdentidad,
          "cliente_numero_de_documento": cliente.documento || "00000000",
          "cliente_denominacion": cliente.nombre || "CLIENTE VARIOS",
          "cliente_email": "", 
          "fecha_de_emision": fechaPeru,
          "moneda": "1", 
          "porcentaje_de_igv": configNegocio.impuestoPorcentaje,
          "total_gravada": Number(parseFloat(subtotal).toFixed(2)),
          "total_igv": Number(parseFloat(igv).toFixed(2)),
          "total": Number(parseFloat(total).toFixed(2)),
          "enviar_automaticamente_a_la_sunat": "true",
          "enviar_automaticamente_al_cliente": "false",
          "items": itemsNubefact
        };

        try {
          const responseNube = await axios.post(
            rutaNubefact, 
            nubefactJSON, 
            { headers: { 'Authorization': `Bearer ${tokenNubefact}` } }
          );

          linkPdf = responseNube.data.enlace_del_pdf;
          linkXml = responseNube.data.enlace_del_xml;
          emitidoConExito = true;

        } catch (nubeError) {
          const mensajeError = String(nubeError.response?.data?.errors || nubeError.message);
          
          if (mensajeError.toLowerCase().includes('ya existe')) {
            numeroCorrelativo++;
            intentos++;
          } else {
            console.error("Error desde Nubefact:", mensajeError);
            throw new Error(`SUNAT/Nubefact rechazó el comprobante: ${mensajeError}`);
          }
        }
      }

      if (!emitidoConExito) {
        throw new Error('No se pudo sincronizar el número correlativo con Nubefact tras varios intentos.');
      }
    }

    // 4. GUARDAR EN NUESTRA BASE DE DATOS LOCAL (Transacción)
    const nuevaVenta = await prisma.$transaction(async (tx) => {
      
      let clienteIdDb = null;
      if (esFiado) {
        let clienteDB = await tx.cliente.findFirst({
          where: { 
            nombre: cliente.nombre, 
            telefono: cliente.telefono,
            negocioId: negocioId
          }
        });
        
        if (!clienteDB) {
          clienteDB = await tx.cliente.create({
            data: { 
              nombre: cliente.nombre, 
              telefono: cliente.telefono,
              negocioId: negocioId
            }
          });
        }
        clienteIdDb = clienteDB.id;
      }

      const nombreFinal = (cliente && cliente.nombre && cliente.nombre.trim() !== '') ? cliente.nombre : "CLIENTES VARIOS";
      const documentoFinal = (cliente && cliente.documento && cliente.documento.trim() !== '') ? cliente.documento : "00000000";

      const metodoPagoDB = esFiado ? 'FIADO' : (metodoPago || 'EFECTIVO');

      const venta = await tx.venta.create({
        data: {
          negocioId: negocioId,
          vendedorId: parseInt(vendedorId),
          tipoComprobante: tipoDocDB,
          metodoPago: metodoPagoDB,
          numeroComprobante: correlativoFinal,
          subtotal: parseFloat(subtotal),
          igv: parseFloat(igv),
          total: parseFloat(total),
          clienteNombre: nombreFinal,
          clienteDocumento: documentoFinal,
          enlacePdf: linkPdf
        }
      });

      if (esFiado) {
        const fechaLimitePago = new Date();
        fechaLimitePago.setDate(fechaLimitePago.getDate() + 3);

        await tx.cuentaPorCobrar.create({
          data: {
            clienteId: clienteIdDb,
            ventaId: venta.id,
            monto: parseFloat(total),
            estado: 'PENDIENTE',
            fechaLimite: fechaLimitePago
          }
        });
      }

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
            motivo: esFiado ? `Fiado POS ${correlativoFinal}` : `Venta POS ${correlativoFinal}`
          }
        });
      }

      // ACTUALIZAR SALDO DE CAJA Y REGISTRAR MOVIMIENTO (Solo si no es fiado) 
      if (!esFiado) {
        const negocioActualizado = await tx.negocio.update({
          where: { id: negocioId },
          data: { saldoCaja: { increment: parseFloat(total) } }
        });

        await tx.movimientoCaja.create({
          data: {
            negocioId: negocioId,
            tipo: 'INGRESO',
            categoria: 'VENTA',
            monto: parseFloat(total),
            saldoResultante: negocioActualizado.saldoCaja,
            metodoPago: metodoPagoDB,
            descripcion: `Venta ${correlativoFinal} (${nombreFinal})`
          }
        });
      }

      return venta;
    });

    // 5. ENVÍO DE COMPROBANTE POR CORREO (API DE BREVO)
    if (!esFiado && metodoEnvio === 'CORREO' && cliente.correo && linkPdf) {
      try {
        const remitenteOficial = process.env.EMAIL_USER; 

        const htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-w: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #092b1a; padding: 20px; text-align: center; border-bottom: 4px solid #a7f3d0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">¡Gracias por tu compra!</h1>
            </div>
            <div style="padding: 30px; background-color: #ffffff; color: #334155;">
              <p style="font-size: 16px;">Hola <strong>${cliente.nombre || 'Cliente'}</strong>,</p>
              <p style="font-size: 16px;">Adjuntamos el enlace para que puedas visualizar y descargar tu comprobante electrónico de manera segura emitido por <strong>${nombreParaFrontend}</strong>.</p>
              
              <div style="background-color: #f8fafc; border-left: 4px solid #d4af37; padding: 15px; margin: 25px 0;">
                <p style="margin: 0; font-size: 14px; color: #64748b;">Total pagado:</p>
                <p style="margin: 5px 0 0 0; font-size: 24px; font-weight: bold; color: #0f172a;">S/ ${parseFloat(total).toFixed(2)}</p>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <a href="${linkPdf}" target="_blank" style="background-color: #a7f3d0; color: #064e3b; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 16px;">
                  📄 Ver Comprobante PDF
                </a>
              </div>
            </div>
          </div>
        `;

        const payloadBrevo = {
          sender: { name: nombreParaFrontend, email: remitenteOficial },
          to: [{ email: cliente.correo, name: cliente.nombre || 'Cliente' }],
          subject: `Tu comprobante electrónico de ${nombreParaFrontend} ya está listo`,
          htmlContent: htmlTemplate
        };

        axios.post('https://api.brevo.com/v3/smtp/email', payloadBrevo, {
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          }
        }).catch(err => console.error("Error desde Brevo:", err.response?.data || err.message));

      } catch (emailError) {
        console.error("Error al preparar el envío del correo con Brevo:", emailError);
      }
    }

    res.status(201).json({ 
      message: esFiado ? 'Fiado registrado correctamente' : 'Venta procesada con éxito', 
      venta: nuevaVenta,
      enlacePdf: linkPdf,
      nombreNegocio: nombreParaFrontend
    });

  } catch (error) {
    console.error('Error procesando venta/fiado:', error);
    res.status(400).json({ message: error.message || 'Error interno al procesar' });
  }
};

export const obtenerVentaPorId = async (req, res) => {
  const { id } = req.params;
  const negocioId = req.user.negocioId;

  try {
    const venta = await prisma.venta.findUnique({
      where: { id: parseInt(id) },
      include: {
        detalles: { include: { producto: true } },
        vendedor: { select: { nombre: true } }
      }
    });

    if (!venta || venta.negocioId !== negocioId) {
      return res.status(404).json({ message: 'Venta no encontrada o no pertenece a su bodega.' });
    }

    res.json(venta);
  } catch (error) {
    console.error("Error al obtener venta:", error);
    res.status(500).json({ message: 'Error interno al cargar el ticket' });
  }
};