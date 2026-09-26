import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

// 1. Creamos el contexto
const BusinessContext = createContext();

// 2. Creamos el proveedor que envolverá nuestra aplicación
export const BusinessProvider = ({ children }) => {
  const [businessConfig, setBusinessConfig] = useState({
    nombre: 'Bodega NOVA',
    ruc: '',
  });

  useEffect(() => {
    // Al declarar la función DENTRO del useEffect, ESLint deja de quejarse
    const cargarConfiguracion = async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `http://${window.location.hostname}:4000/api/configuracion`;
        
        const config = {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        };

        const res = await axios.get(url, config);
        if (res.data) {
          setBusinessConfig(res.data);
        }
      } catch (error) {
        console.error("Error al cargar configuración global:", error);
      }
    };

    cargarConfiguracion();
  }, []); // El array vacío asegura que se ejecute solo una vez al cargar la app

  return (
    <BusinessContext.Provider value={{ businessConfig, setBusinessConfig }}>
      {children}
    </BusinessContext.Provider>
  );
};

// 3. Hook personalizado
// eslint-disable-next-line react-refresh/only-export-components
export const useBusiness = () => useContext(BusinessContext);