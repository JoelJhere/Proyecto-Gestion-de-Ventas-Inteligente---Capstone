import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Productos from './pages/Productos';
import Proveedores from './pages/Proveedores';
import Ventas from './pages/Ventas';
import PlanCompras from './pages/PlanCompras';
import { BusinessProvider } from './context/BusinessContext';
import Configuracion from './pages/Configuracion';
import Fiados from './pages/Fiados';
import Historial from './pages/Historial';

// --- CONFIGURACIÓN GLOBAL DE AXIOS ---

// A. URL Base
axios.defaults.baseURL = 'https://proyecto-gestion-de-ventas-inteligente.onrender.com/api';

// B. Interceptor de peticiones: Inyecta el Token automáticamente a cada consulta.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response, 
  (error) => {
    if (error.config && error.config.url && error.config.url.includes('/auth/login')) {
      return Promise.reject(error);
    }
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('pos_config');
        window.location.href = '/login?motivo=expirado';
      }
    }
    return Promise.reject(error);
  }
);

const IAPlaceholder = () => <div className="text-white"><h1 className="text-3xl font-bold text-dorado mb-4">Panel de Asistente IA</h1></div>;

function App() {
  return (
  <BusinessProvider>
    {/* 2. Toaster Global: Funciona para toda la app, encima de todo */}
    <Toaster 
      position="top-center" 
      reverseOrder={false}
      containerStyle={{
        top: 80, 
      }}
      toastOptions={{
        style: {
          fontSize: '17px',
          padding: '16px 32px',
          maxWidth: '600px',
          borderRadius: '16px',
          fontWeight: '600',
          textAlign: 'center',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        },
        success: {
          duration: 3000,
          style: {
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0'
          },
        },
        error: {
          duration: 3500,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca'
          },
        }
      }}
    />
    
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Navigate to="/ventas" replace />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/productos" element={<Productos />} />  
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/fiados" element={<Fiados />} />
          <Route path="/compras" element={<PlanCompras />} />
          <Route path="/historial" element={<Historial />} />
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
