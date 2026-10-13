import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// --- 1. REGISTRO DE UN NUEVO NEGOCIO (SAAS) ---
export const registrarNegocio = async (req, res) => {
  const { nombreNegocio, ruc, nombreDuenio, email, password } = req.body;

  try {
    // A. Validar que el correo no exista ya en todo el sistema
    const usuarioExistente = await prisma.user.findUnique({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'Este correo electrónico ya está registrado.' });
    }

    // B. Encriptar la contraseña del dueño
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // C. Crear el Negocio y el Usuario Administrador en una sola transacción
    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Crear el Negocio
      const nuevoNegocio = await tx.negocio.create({
        data: {
          nombre: nombreNegocio,
          ruc: ruc || "",
          // La configuración inicial por defecto se crea sola gracias al schema
        }
      });

      // 2. Crear al usuario dueño y amarrarlo al negocio creado
      const nuevoAdmin = await tx.user.create({
        data: {
          nombre: nombreDuenio,
          email: email,
          password: hashedPassword,
          rol: 'ADMIN', // El dueño creador siempre es ADMIN
          negocioId: nuevoNegocio.id,
          terminosAceptados: true // El dueño acepta los términos al crear su negocio
        }
      });

      return { nuevoNegocio, nuevoAdmin };
    });

    res.status(201).json({ 
      message: 'Negocio registrado exitosamente. Ya puedes iniciar sesión.',
      negocio: resultado.nuevoNegocio.nombre
    });

  } catch (error) {
    console.error('Error al registrar negocio:', error);
    res.status(500).json({ message: 'Error interno al registrar el negocio.' });
  }
};

// --- 2. LOGIN (CON SOPORTE MULTI-TENANT) ---
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar al usuario y traer los datos de su negocio
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { negocio: true } // Traemos el negocio para verificar su estado
    });
    
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });

    // 2. Reglas de negocio (Cuenta Activa)
    if (!user.estado) return res.status(403).json({ message: 'Tu cuenta ha sido desactivada por el administrador de tu bodega.' });
    
    // Regla SaaS: Si la bodega entera fue suspendida (por falta de pago), nadie entra.
    if (user.rol !== 'SUPER_ADMIN' && user.negocio && !user.negocio.estado) {
      return res.status(403).json({ message: 'El acceso a este negocio ha sido suspendido temporalmente. Contacte a soporte.' });
    }

    // 3. Comparar la contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas.' });

    // 4. Generar Token (Ahora inyectamos el negocioId como el ADN de la sesión)
    const token = jwt.sign(
      { 
        id: user.id, 
        rol: user.rol,
        negocioId: user.negocioId 
      }, 
      process.env.JWT_SECRET || 'secreto_super_seguro_aj', 
      { expiresIn: '12h' }
    );

    res.json({
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        negocioId: user.negocioId,
        terminosAceptados: user.terminosAceptados,
        nombreNegocio: user.negocio ? user.negocio.nombre : 'Panel Central' // Si es SUPER_ADMIN dice Panel Central
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
};