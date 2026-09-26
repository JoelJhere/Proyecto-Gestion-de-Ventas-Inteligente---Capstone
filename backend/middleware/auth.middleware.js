import jwt from 'jsonwebtoken';

// 1. Verificar si el usuario tiene una sesión activa (Para cualquier empleado o dueño)
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(403).json({ message: 'Acceso denegado. No hay token de seguridad.' });
  }

  try {
    const token = authHeader.split(" ")[1]; 
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_aj');
    
    // Guardamos los datos del usuario (id y rol) para saber quién está haciendo la petición
    req.user = decoded; 
    next(); // Permite que la ruta continúe ejecutándose
  } catch (error) {
    return res.status(401).json({ message: 'Sesión expirada o token inválido.' });
  }
};

// 2. Verificar si el usuario es específicamente el Dueño (Admin)
export const esAdmin = (req, res, next) => {
  if (req.user.rol !== 'ADMIN') {
    return res.status(403).json({ message: 'Acceso restringido. Solo el dueño de Abarrotes AJ puede realizar esta acción.' });
  }
  next();
};