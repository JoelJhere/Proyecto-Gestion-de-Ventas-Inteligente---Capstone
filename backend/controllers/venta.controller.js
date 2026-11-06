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
    if (tipoDocDB !== 'SIN_COMPROBANTE') {
      
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
        const nombreLimpio = cliente.nombre.trim();
        const telefonoLimpio = cliente.telefono.trim();

        // 1. Buscamos al vecino por ID o por su nombre exacto
        let clienteDB = null;
        if (cliente.id) {
          clienteDB = await tx.cliente.findFirst({
            where: { id: parseInt(cliente.id), negocioId: negocioId }
          });
        }

        if (!clienteDB) {
          clienteDB = await tx.cliente.findFirst({
            where: { 
              nombre: { equals: nombreLimpio, mode: 'insensitive' }, 
              negocioId: negocioId
            }
          });
        }

        // 2. Validamos que el celular no le pertenezca a OTRO vecino distinto
        const celularDeOtroVecino = await tx.cliente.findFirst({
          where: {
            negocioId: negocioId,
            telefono: telefonoLimpio,
            ...(clienteDB ? { id: { not: clienteDB.id } } : {})
          }
        });

        if (celularDeOtroVecino) {
          throw new Error(`El número ${telefonoLimpio} ya está registrado con otro vecino (${celularDeOtroVecino.nombre}).`);
        }
        
        // 3. Si es nuevo lo creamos; si ya existe y cambió de número, lo actualizamos
        if (!clienteDB) {
          clienteDB = await tx.cliente.create({
            data: { 
              nombre: nombreLimpio, 
              telefono: telefonoLimpio,
              negocioId: negocioId
            }
          });
        } else if (clienteDB.telefono !== telefonoLimpio || clienteDB.nombre !== nombreLimpio) {
          clienteDB = await tx.cliente.update({
            where: { id: clienteDB.id },
            data: {
              nombre: nombreLimpio,
              telefono: telefonoLimpio
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

    // 5. ENVÍO DE COMPROBANTE POR CORREO (API DE BREVO - FORMATO PROPIO VENDAIA)
    if (!esFiado && metodoEnvio === 'CORREO' && cliente.correo && tipoDocDB !== 'SIN_COMPROBANTE') {
      try {
        const remitenteOficial = process.env.EMAIL_USER;
        const frontendUrl = req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
        const urlTicketPropio = `${frontendUrl}/ticket/${nuevaVenta.id}`;
        const tituloDoc = tipoDocDB === 'FACTURA' ? 'FACTURA DE VENTA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
        const etiquetaDocCliente = tipoDocDB === 'FACTURA' ? 'RUC' : 'DNI';
        const fechaEmision = new Date(nuevaVenta.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' });

        const filasProductosHtml = carrito.map(item => {
          const cant = Number(item.cantidad) || 1;
          const pUnit = Number(item.precioVenta) || 0;
          const subItem = cant * pUnit;
          return `
            <tr>
              <td style="padding: 8px 4px; border-bottom: 1px dashed #e2e8f0; font-weight: bold; font-size: 13px;">${cant}</td>
              <td style="padding: 8px 4px; border-bottom: 1px dashed #e2e8f0; font-size: 13px;">${item.nombre}</td>
              <td style="padding: 8px 4px; border-bottom: 1px dashed #e2e8f0; text-align: right; font-size: 13px;">S/ ${pUnit.toFixed(2)}</td>
              <td style="padding: 8px 4px; border-bottom: 1px dashed #e2e8f0; text-align: right; font-weight: bold; font-size: 13px;">S/ ${subItem.toFixed(2)}</td>
            </tr>
          `;
        }).join('');

        const htmlTemplate = `
          <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 20px auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff; color: #0f172a;">
            <div style="padding: 24px 20px;">
              
              <!-- CABECERA EMISOR -->
              <div style="text-align: center; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; font-weight: 800;">${configNegocio.nombre || configNegocio.razonSocial}</h2>
                ${configNegocio.razonSocial ? `<p style="margin: 3px 0 0 0; font-size: 12px; color: #475569; text-transform: uppercase;">${configNegocio.razonSocial}</p>` : ''}
                ${configNegocio.ruc ? `<p style="margin: 4px 0 0 0; font-size: 13px; font-weight: bold;">RUC ${configNegocio.ruc}</p>` : ''}
                ${configNegocio.direccionFiscal ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">${configNegocio.direccionFiscal}</p>` : ''}
                ${configNegocio.telefono ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Tel: ${configNegocio.telefono}</p>` : ''}
              </div>

              <!-- RECUADRO SERIE Y CORRELATIVO -->
              <div style="border: 2px solid #0f172a; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 16px;">
                <p style="margin: 0; font-size: 12px; font-weight: 800;">${tituloDoc}</p>
                <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 900; font-family: monospace;">${correlativoFinal}</p>
              </div>

              <!-- DATOS DEL CLIENTE Y OPERACIÓN -->
              <div style="border-top: 1px dashed #94a3b8; border-bottom: 1px dashed #94a3b8; padding: 10px 0; font-size: 12px; margin-bottom: 14px;">
                <p style="margin: 3px 0;"><strong>Fecha de emisión:</strong> ${fechaEmision}</p>
                <p style="margin: 3px 0;"><strong>Cliente:</strong> ${cliente.nombre || 'CLIENTE VARIOS'}</p>
                ${cliente.documento ? `<p style="margin: 3px 0;"><strong>${etiquetaDocCliente}:</strong> ${cliente.documento}</p>` : ''}
                <p style="margin: 3px 0;"><strong>Moneda:</strong> Soles (PEN)</p>
                <p style="margin: 3px 0;"><strong>Medio de pago:</strong> ${metodoPago || 'EFECTIVO'}</p>
              </div>

              <!-- TABLA DE PRODUCTOS -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
                <thead>
                  <tr style="border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 6px 4px; text-align: left;">Cant.</th>
                    <th style="padding: 6px 4px; text-align: left;">Descripción</th>
                    <th style="padding: 6px 4px; text-align: right;">P. Unit</th>
                    <th style="padding: 6px 4px; text-align: right;">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasProductosHtml}
                </tbody>
              </table>

              <!-- TOTALES -->
              <div style="border-top: 1px solid #0f172a; padding-top: 10px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>Op. Gravada:</span>
                  <strong style="float: right;">S/ ${ parseFloat(subtotal).toFixed(2) }</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>IGV (${configNegocio.impuestoPorcentaje || 18}%):</span>
                  <strong style="float: right;">S/ ${ parseFloat(igv).toFixed(2) }</strong>
                </div>
                <div style="border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 16px; font-weight: 900;">
                  <span>TOTAL A PAGAR:</span>
                  <span style="float: right; color: #065f46;">S/ ${ parseFloat(total).toFixed(2) }</span>
                </div>
              </div>

              <!-- BOTÓN A COMPROBANTE WEB -->
              <div style="text-align: center; margin-top: 24px;">
                <a href="${urlTicketPropio}" target="_blank" style="background-color: #a7f3d0; color: #064e3b; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block; font-size: 14px;">
                  Ver e Imprimir Comprobante
                </a>
              </div>

              <!-- PIE DE PÁGINA VENDAIA -->
              <div style="text-align: center; margin-top: 20px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b;">
                <p style="margin: 0; font-weight: bold; color: #1e293b;">${configNegocio.mensajeTicket || '¡Gracias por su preferencia!'}</p>
                <p style="margin: 6px 0 0 0;">Comprobante generado por <strong style="color: #065f46;">VendaIA</strong></p>
                <p style="margin: 2px 0 0 0;">Sistema de gestión para bodegas y minimarkets</p>
              </div>

            </div>
          </div>
        `;

        const payloadBrevo = {
          sender: { name: nombreParaFrontend, email: remitenteOficial },
          to: [{ email: cliente.correo, name: cliente.nombre || 'Cliente' }],
          subject: `${tipoDocDB} ELECTRÓNICA ${correlativoFinal} - ${nombreParaFrontend}`,
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
  const ventaId = parseInt(req.params.id);

  if (Number.isNaN(ventaId)) {
    return res.status(400).json({ message: 'Identificador de venta inválido.' });
  }

  try {
    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        detalles: {
          include: {
            producto: { select: { nombre: true, codigo: true, unidadMedida: true } }
          }
        },
        vendedor: { select: { nombre: true } },
        negocio: {
          select: {
            nombre: true,
            razonSocial: true,
            ruc: true,
            direccionFiscal: true,
            ciudad: true,
            departamento: true,
            telefono: true,
            email: true,
            mensajeTicket: true,
            impuestoPorcentaje: true,
            logo: true
          }
        }
      }
    });

    if (!venta) {
      return res.status(404).json({ message: 'Comprobante no encontrado.' });
    }

    res.json(venta);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ message: 'Error interno al cargar el comprobante' });
  }
};