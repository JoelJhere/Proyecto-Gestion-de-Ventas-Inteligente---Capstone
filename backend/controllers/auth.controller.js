import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RUC_REGEX = /^(10|20)\d{9}$/;

const esPasswordSegura = (pass = '') =>
  typeof pass === 'string' &&
  pass.length >= 8 &&
  /[A-Z]/.test(pass) &&
  /\d/.test(pass);

// --- 1. REGISTRO DE UN NUEVO NEGOCIO (SAAS) ---
export const registrarNegocio = async (req, res) => {
  const { nombreNegocio, ruc, nombreDuenio, email, password } = req.body;

  const nombreNegocioLimpio = (nombreNegocio || '').trim();
  const nombreDuenioLimpio = (nombreDuenio || '').trim();
  const emailLimpio = (email || '').trim().toLowerCase();
  const rucLimpio = String(ruc || '').replace(/\D/g, '').trim();

  if (!nombreNegocioLimpio || !nombreDuenioLimpio || !emailLimpio || !password) {
    return res.status(400).json({ message: 'Completa todos los campos obligatorios.' });
  }

  if (!EMAIL_REGEX.test(emailLimpio)) {
    return res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
  }

  if (rucLimpio && !RUC_REGEX.test(rucLimpio)) {
    return res.status(400).json({ message: 'El RUC debe tener 11 dígitos e iniciar con 10 o 20.' });
  }

  if (!esPasswordSegura(password)) {
    return res.status(400).json({
      message: 'La contraseña debe tener al menos 8 caracteres, una letra mayúscula y un número.'
    });
  }

  try {
    // A. Validar que el correo no exista ya en todo el sistema (sin distinguir mayúsculas)
    const usuarioExistente = await prisma.user.findFirst({
      where: { email: { equals: emailLimpio, mode: 'insensitive' } }
    });
    if (usuarioExistente) {
      return res.status(400).json({ message: 'Este correo electrónico ya está registrado.' });
    }

    // B. Encriptar la contraseña del dueño
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // C. Crear el Negocio y el Usuario Administrador en una sola transacción
    const resultado = await prisma.$transaction(async (tx) => {
      const nuevoNegocio = await tx.negocio.create({
        data: {
          nombre: nombreNegocioLimpio,
          ruc: rucLimpio
        }
      });

      const nuevoAdmin = await tx.user.create({
        data: {
          nombre: nombreDuenioLimpio,
          email: emailLimpio,
          password: hashedPassword,
          rol: 'ADMIN',
          negocioId: nuevoNegocio.id,
          terminosAceptados: true
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

  const emailLimpio = (email || '').trim().toLowerCase();
  if (!emailLimpio || !password) {
    return res.status(400).json({ message: 'Ingresa tu correo y contraseña.' });
  }

  try {
    // 1. Buscar al usuario (compatible con correos antiguos que tengan mayúsculas)
    const user = await prisma.user.findFirst({
      where: { email: { equals: emailLimpio, mode: 'insensitive' } },
      include: { negocio: true }
    });

    if (!user) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    // 2. Verificar contraseña antes de revelar el estado de la cuenta
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
    }

    // 3. Reglas de negocio (Cuenta y Bodega Activas)
    if (!user.estado) {
      return res.status(403).json({
        message: 'Tu cuenta ha sido desactivada por el administrador de tu bodega.'
      });
    }

    if (user.rol !== 'SUPER_ADMIN' && user.negocio && !user.negocio.estado) {
      return res.status(403).json({
        message: 'El acceso a este negocio ha sido suspendido temporalmente. Contacte a soporte.'
      });
    }

    // 4. Generar Token con negocioId como aislamiento Multi-Tenant
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
        nombreNegocio: user.negocio ? user.negocio.nombre : 'Panel Central'
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
};