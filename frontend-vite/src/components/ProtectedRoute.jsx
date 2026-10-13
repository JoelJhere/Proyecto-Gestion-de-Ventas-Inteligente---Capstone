import { Navigate, useLocation } from 'react-router-dom';

// Función para leer la fecha de caducidad del Token JWT
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false; 
  }
};

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const location = useLocation();

  // 1. Validar expiración del token
  if (!isTokenValid(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  // 2. REGLA SAAS: Super Admin aislado
  if (user.rol === 'SUPER_ADMIN' && location.pathname !== '/master') {
    return <Navigate to="/master" replace />;
  }
  
  // 3. REGLA SAAS: Dueños/Ayudantes no pueden ver el Panel Maestro
  if (user.rol !== 'SUPER_ADMIN' && location.pathname === '/master') {
    return <Navigate to="/ventas" replace />;
  }

  return children;
}