import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const BusinessContext = createContext();

export const BusinessProvider = ({ children }) => {
  // 1. Buscamos en la memoria local antes de poner el valor por defecto
  const [businessConfig, setBusinessConfig] = useState(() => {
    const configGuardada = localStorage.getItem('pos_config');
    return configGuardada ? JSON.parse(configGuardada) : { nombre: '', ruc: '' };
  });

  useEffect(() => {
    const cargarConfiguracion = async () => {
      const token = localStorage.getItem('token');
      if (!token) return; 

      try {
        const url = `http://${window.location.hostname}:4000/api/configuracion`;
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data) {
          setBusinessConfig(res.data);
          // 2. Guardamos la configuración real en la memoria del navegador
          localStorage.setItem('pos_config', JSON.stringify(res.data));
        }
      } catch (error) {
        console.error("Error al cargar configuración global:", error);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('pos_config'); // Limpiamos la config al expirar sesión
          
          if (!window.location.pathname.includes('/login')) {
            alert("Tu sesión ha expirado por seguridad. Por favor, vuelve a iniciar sesión.");
            window.location.href = '/login';
          }
        }
      }
    };

    cargarConfiguracion();
  }, []); 

  return (
    <BusinessContext.Provider value={{ businessConfig, setBusinessConfig }}>
      {children}
    </BusinessContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useBusiness = () => useContext(BusinessContext);