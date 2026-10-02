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
      if (!token) return; 

      try {
        const url = `https://proyecto-gestion-de-ventas-inteligente.onrender.com/api/configuracion`;
        const res = await axios.get(url, {
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