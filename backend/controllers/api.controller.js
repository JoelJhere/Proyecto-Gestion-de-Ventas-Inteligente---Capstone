import axios from 'axios';

export const consultarDocumento = async (req, res) => {
  const { tipo, numero } = req.params; // 'dni' o 'ruc'

  if (!numero || (tipo !== 'dni' && tipo !== 'ruc')) {
    return res.status(400).json({ message: 'Parámetros inválidos' });
  }

  try {
    const token = process.env.APIS_PERU_TOKEN;
    const url = tipo === 'dni' 
      ? `https://api.apis.net.pe/v2/reniec/dni?numero=${numero}`
      : `https://api.apis.net.pe/v2/sunat/ruc?numero=${numero}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error consultando API externa:', error.response?.data || error.message);
    res.status(404).json({ message: 'Documento no encontrado o error de conexión' });
  }
};