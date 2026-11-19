import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster, ToastBar, useToasterStore } from 'react-hot-toast';
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
import Ticket from './pages/Ticket';
import SuperAdmin from './pages/SuperAdmin';
import Usuarios from './pages/Usuarios';

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
      const rutaActual = window.location.pathname;
      // Evitamos redirigir al login si el cliente está viendo su comprobante público
      if (!rutaActual.includes('/login') && !rutaActual.startsWith('/ticket')) {
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

// Evita que las notificaciones se apilen hacia abajo si alguien presiona un botón varias veces
function LimitadorToasts({ max = 1 }) {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= max)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts, max]);

  return null;
}

function App() {
  return (
  <BusinessProvider>
    {/* 2. Toaster Global: Funciona para toda la app, encima de todo */}
    <LimitadorToasts max={1} />
    <Toaster 
      position="top-center" 
      reverseOrder={false}
      gutter={8}
      containerStyle={{
        top: 24,
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 5000,
        style: {
          fontSize: '15px',
          padding: '14px 22px',
          maxWidth: '520px',
          borderRadius: '14px',
          fontWeight: '600',
          textAlign: 'left',
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
          cursor: 'pointer',
        },
        success: {
          duration: 4500,
          style: {
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
          },
        },
        error: {
          duration: 6500,
          style: {
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
          },
        },
      }}
    >
      {(t) => (
        <div onClick={() => toast.dismiss(t.id)} title="Clic para cerrar">
          <ToastBar toast={t} />
        </div>
      )}
    </Toaster>
    
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/master" element={<ProtectedRoute><SuperAdmin /></ProtectedRoute>} />
        
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
          <Route path="/usuarios" element={<Usuarios />} />
        </Route>

        <Route path="/ticket/:id" element={<Ticket />} />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  </BusinessProvider>
  );
}

export default App;
