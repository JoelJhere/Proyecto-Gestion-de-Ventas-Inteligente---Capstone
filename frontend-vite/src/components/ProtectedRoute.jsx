import { Navigate } from 'react-router-dom';

// Función para leer la fecha de caducidad del Token JWT
const isTokenValid = (token) => {
  if (!token) return false;
  try {
    // El token JWT tiene 3 partes separadas por puntos. La del medio tiene la info (payload)
    const payload = JSON.parse(atob(token.split('.')[1]));
    // Multiplicamos por 1000 porque JWT usa segundos y JavaScript milisegundos
    return payload.exp * 1000 > Date.now();
  // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false; // Si el token está corrupto, lo declaramos inválido
  }
};

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  // Si no hay token o ya caducó, limpiamos la basura y lo mandamos al login
  if (!isTokenValid(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  return children;
}