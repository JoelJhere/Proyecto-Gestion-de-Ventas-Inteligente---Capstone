import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth.routes.js';
import productoRoutes from './routes/producto.routes.js';
import proveedorRoutes from './routes/proveedor.routes.js';
import planCompraRoutes from './routes/planCompra.routes.js';
import configRoutes from './routes/config.routes.js';
import ventaRoutes from './routes/venta.routes.js';

const app = express();
const prisma = new PrismaClient();

// 1. Crear servidor HTTP y conectarle Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // Permite que cualquier dispositivo en la red se conecte
});

// 2. Middlewares base
app.use(cors());
app.use(express.json());

// 3. Rutas Modulares
app.use('/api/auth', authRoutes); 
app.use('/api/productos', productoRoutes); 
app.use('/api/proveedores', proveedorRoutes); 
app.use('/api/planes-compra', planCompraRoutes); 
app.use('/api/configuracion', configRoutes);
app.use('/api/ventas', ventaRoutes);
app.get('/api/status', (req, res) => {
  res.json({ mensaje: 'Servidor del POS Abarrotes AJ funcionando correctamente' });
});

// 4. Lógica de WebSockets (El Túnel con Salas Privadas)
io.on('connection', (socket) => {
  
  // A. Cuando un cajero entra, lo metemos a su propia "sala"
  socket.on('unirse_caja', (usuarioId) => {
    const salaPrivada = `caja_usuario_${usuarioId}`;
    socket.join(salaPrivada);
  });

  // B. Cuando alguien modifica la boleta, se la enviamos a su clon (celular/PC)
  socket.on('sincronizar_carrito', ({ usuarioId, carrito }) => {
    // socket.to() le envía los datos a la otra pantalla de la misma sala
    socket.to(`caja_usuario_${usuarioId}`).emit('carrito_actualizado', carrito);
  });

  socket.on('disconnect', () => {
    // Se limpia solo al cerrar la pestaña
  });
});

// 5. Encender el servidor ÚNICO (server.listen, NO app.listen)
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor HTTP y WebSockets corriendo juntos en el puerto ${PORT}`);
});