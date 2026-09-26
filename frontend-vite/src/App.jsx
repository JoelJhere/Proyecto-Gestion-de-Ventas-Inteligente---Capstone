import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Login from './pages/Login';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Productos from './pages/Productos';
import Proveedores from './pages/Proveedores';
import Ventas from './pages/Ventas';
import PlanCompras from './pages/PlanCompras';
import { BusinessProvider } from './context/BusinessContext';
import Configuracion from './pages/Configuracion';

axios.interceptors.response.use(
  (response) => response, 
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      alert('Tu sesión ha expirado por seguridad. Por favor, vuelve a iniciar sesión.');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const HistorialPlaceholder = () => (
  <div className="text-white"><h1 className="text-3xl font-bold text-dorado mb-4">Historial de Transacciones</h1></div>
);

const IAPlaceholder = () => (
  <div className="text-white"><h1 className="text-3xl font-bold text-dorado mb-4">Panel de Asistente IA</h1></div>
);

function App() {
  return (
  <BusinessProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* CORRECCIÓN: Layout pasa a ser un "hijo" (children) directo de ProtectedRoute */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          
          <Route path="/" element={<Navigate to="/ventas" replace />} />
          
          {/* Todas las rutas válidas del sistema */}
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/productos" element={<Productos />} />  
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/compras" element={<PlanCompras />} />
          <Route path="/historial" element={<HistorialPlaceholder />} />
          <Route path="/ia-panel" element={<IAPlaceholder />} />
          <Route path="/configuracion" element={<Configuracion />} />
          
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  </BusinessProvider>
  );
}

export default App;
