import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Buscar al usuario en la base de datos
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    // 2. Verificar si la cuenta está activa (Regla de negocio)
    if (!user.estado) return res.status(403).json({ message: 'Cuenta desactivada por el administrador' });

    // 3. Comparar la contraseña enviada con la encriptada
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Credenciales inválidas' });

    // 4. Generar Token (Firma digital para mantener la sesión abierta sin pedir clave a cada rato)
    // Nota: El 'secreto' lo leeremos del .env por seguridad
    const token = jwt.sign(
      { id: user.id, rol: user.rol }, 
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
        rol: user.rol
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error: error.message });
  }
};