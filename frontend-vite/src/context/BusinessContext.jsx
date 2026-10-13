import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const BusinessContext = createContext();

export const BusinessProvider = ({ children }) => {
  const [businessConfig, setBusinessConfig] = useState(() => {
    const configGuardada = localStorage.getItem('pos_config');
    return configGuardada ? JSON.parse(configGuardada) : { nombre: '', ruc: '' };
  });

  useEffect(() => {
    const cargarConfiguracion = async () => {
      const token = localStorage.getItem('token');
      const userStr = localStorage.getItem('user');
      
      if (!token || !userStr) return; 
      
      const user = JSON.parse(userStr);

      // REGLA SAAS: Si es el creador (SUPER_ADMIN), no buscamos configuración de bodega
      if (user.rol === 'SUPER_ADMIN') {
        setBusinessConfig({ nombre: 'Panel Maestro SaaS', ruc: '' });
        return;
      }

      try {
        // Usamos solo la ruta relativa porque Axios ya tiene la baseURL en App.jsx
        const res = await axios.get('/configuracion', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.data) {
          setBusinessConfig(res.data);
          localStorage.setItem('pos_config', JSON.stringify(res.data));
        }
      } catch (error) {
        console.error("Error al cargar configuración global:", error);
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