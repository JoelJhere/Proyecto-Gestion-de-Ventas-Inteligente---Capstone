import jwt from 'jsonwebtoken';

// 1. VERIFICAR TOKEN Y ASIGNAR NEGOCIO (Para cualquier empleado o dueño)
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(403).json({ message: 'Acceso denegado. No hay token de seguridad.' });
  }

  try {
    const token = authHeader.split(" ")[1]; 
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_super_seguro_aj');
    
    req.user = decoded; 
    
    next(); 
  } catch (error) {
    return res.status(401).json({ message: 'Sesión expirada o token inválido.' });
  }
};

// 2. VERIFICAR SI ES EL DUEÑO DE LA BODEGA
export const esAdmin = (req, res, next) => {
  // El SUPER_ADMIN también tiene permisos de ADMIN en todo el sistema
  if (req.user.rol !== 'ADMIN' && req.user.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Acceso restringido. Solo el administrador del negocio puede realizar esta acción.' });
  }
  next();
};

// 3. NUEVO: VERIFICAR SI ES EL CREADOR DEL SOFTWARE (SaaS)
export const esSuperAdmin = (req, res, next) => {
  if (req.user.rol !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Acceso ultra-restringido. Solo el creador de la plataforma puede entrar aquí.' });
  }
  next();
};