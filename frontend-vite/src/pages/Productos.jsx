import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlus, FaEdit, FaBox, FaBarcode, FaTimes, FaSearch, FaCheck, FaCamera, FaPrint, FaBoxOpen } from 'react-icons/fa';
import axios from 'axios';
import Barcode from 'react-barcode';
import { Html5Qrcode } from 'html5-qrcode';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]); 
  const [busqueda, setBusqueda] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [stockProduct, setStockProduct] = useState(null);     
  const [barcodeView, setBarcodeView] = useState(null);

  // Estado para el escáner de código de barras
  const [scannerTarget, setScannerTarget] = useState(null);

  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
  const [stockData, setStockData] = useState({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const API_URL_PROD = `https://proyecto-gestion-de-ventas-inteligente.onrender.com/api/productos`;
  const API_URL_PROV = `https://proyecto-gestion-de-ventas-inteligente.onrender.com/api/proveedores`;

  // 1. Cargar Productos y Proveedores juntos
  const cargarDatos = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { headers: { Authorization: `Bearer ${token}` } };
      
      const [resProductos, resProveedores] = await Promise.all([
        axios.get(API_URL_PROD, headers),
        axios.get(API_URL_PROV, headers)
      ]);
      
      setProductos(resProductos.data);
      setProveedores(resProveedores.data);
    } catch (error) {
      console.error("Error al cargar datos:", error);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { cargarDatos(); }, []);


  // --- LÓGICA DEL ESCÁNER DE CÓDIGO DE BARRAS ---
  useEffect(() => {
    let html5QrCode;

    if (scannerTarget) {
      // 1. Usamos el motor puro, sin la interfaz prefabricada
      html5QrCode = new Html5Qrcode("reader");

      const iniciarCamara = async () => {
        try {
          // 2. Iniciamos la cámara automáticamente (facingMode: "environment" fuerza la cámara trasera)
          await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 100 } },
            async (decodedText) => {
              
              // 3. Al leer el código, apagamos la cámara inmediatamente
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
                html5QrCode.clear();
              }
              setScannerTarget(null);

              // 4. Lógica de búsqueda en las APIs
              if (scannerTarget === 'crear') {
                setFormData(prev => ({ ...prev, codigo: decodedText }));

                try {
                  const resFood = await axios.get(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`);
                  if (resFood.data.status === 1 && resFood.data.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resFood.data.product.product_name, codigo: decodedText }));
                    return;
                  }

                  const resBeauty = await axios.get(`https://world.openbeautyfacts.org/api/v0/product/${decodedText}.json`);
                  if (resBeauty.data.status === 1 && resBeauty.data.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resBeauty.data.product.product_name, codigo: decodedText }));
                    return;
                  }

                  const resProducts = await axios.get(`https://world.openproductsfacts.org/api/v0/product/${decodedText}.json`);
                  if (resProducts.data.status === 1 && resProducts.data.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resProducts.data.product.product_name, codigo: decodedText }));
                    return;
                  }

                  const resUpc = await axios.get(`https://api.upcitemdb.com/prod/trial/lookup?upc=${decodedText}`);
                  if (resUpc.data.items && resUpc.data.items.length > 0) {
                    setFormData(prev => ({ ...prev, nombre: resUpc.data.items[0].title, codigo: decodedText }));
                    return;
                  }
                } catch (error) {
                  console.log("Producto no encontrado en bases públicas. Requiere ingreso manual.", error);
                }

              } else if (scannerTarget === 'editar') {
                setEditingProduct(prev => ({ ...prev, codigo: decodedText }));
              } else if (scannerTarget === 'busqueda') {
                setBusqueda(decodedText);
              }
            },
            () => {
              // Ignoramos los errores continuos de enfoque mientras intenta leer
            }
          );
        } catch (error) {
          console.error("Error al iniciar la cámara:", error);
          alert("No se pudo iniciar la cámara. Verifica los permisos de tu navegador.");
        }
      };

      iniciarCamara();
    }

    // Limpieza de seguridad al cerrar el modal con la "X"
    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [scannerTarget]);

  // --- LÓGICA DE IMPRESIÓN DE ETIQUETA ---
  const handleImprimirEtiqueta = () => {
    const contenido = document.getElementById("area-impresion-barcode").innerHTML;
    const ventana = window.open('', 'PRINT', 'height=600,width=800');
    ventana.document.write(`
      <html>
        <head>
          <title>Imprimir Etiqueta</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .etiqueta { text-align: center; padding: 20px; border: 1px dashed #ccc; }
          </style>
        </head>
        <body>
          <div class="etiqueta">${contenido}</div>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    ventana.document.close();
  };

  // --- FUNCIONES CRUD ---
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const dataAEnviar = { ...formData, proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null };
      await axios.post(API_URL_PROD, dataAEnviar, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setIsCreateModalOpen(false);
      setFormData({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.message || 'Error al guardar'); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const dataAEnviar = { ...editingProduct, proveedorId: editingProduct.proveedorId ? parseInt(editingProduct.proveedorId) : null };
      await axios.put(`${API_URL_PROD}/${editingProduct.id}`, dataAEnviar, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setEditingProduct(null);
      cargarDatos();
    } catch (error) { alert(error.response?.data?.message || 'Error al actualizar'); }
  };

  const handleManageStock = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL_PROD}/${stockProduct.id}/stock`, stockData, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      setStockProduct(null);
      setStockData({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.message || 'Error al actualizar stock'); }
  };

  const toggleEstado = async (id, estadoActual) => {
    const accion = estadoActual ? 'descontinuar' : 'reactivar';
    const confirmado = window.confirm(`¿Estás seguro de que deseas ${accion} este producto?`);
    if (!confirmado) return;

    try {
      await axios.put(`${API_URL_PROD}/${id}/estado`, {}, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      cargarDatos();
    } catch (error) { alert(error.response?.data?.message || 'Error al cambiar estado'); }
  };

  const productosFiltrados = productos.filter(prod => 
    prod.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    prod.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

return (
    <div className="text-slate-950 pb-20 font-sans">
      
      {/* CABECERA Y BUSCADOR */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950 mb-1 tracking-tight flex items-center gap-3">
            <FaBoxOpen className="text-verde-pastel drop-shadow-md"/> Gestión de Productos
          </h1>
          <p className="text-slate-500 text-sm font-medium">Administra tu inventario, costos y precios.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400" />
            </div>
            
            <input 
              type="text" placeholder="Buscar por nombre o código..." 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm text-slate-800 transition-all shadow-sm font-medium" 
            />
            
            <button 
              onClick={() => setScannerTarget('busqueda')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-emerald-600 transition-colors"
              title="Escanear para buscar"
            >
              <FaCamera size={18} />
            </button>
          </div>
          
          {isAdmin && (
            <button onClick={() => setIsCreateModalOpen(true)} className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm whitespace-nowrap">
                <FaPlus size={14} /> Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[950px]">
            <thead>
              <tr className="bg-slate-950 text-slate-100 text-xs uppercase tracking-wider font-bold border-t-4 border-verde-pastel">
                <th className="p-4 whitespace-nowrap">Código</th>
                <th className="p-4 whitespace-nowrap">Producto</th>
                <th className="p-4 whitespace-nowrap">Proveedor</th>
                <th className="p-4 whitespace-nowrap">P. Compra</th>
                <th className="p-4 whitespace-nowrap">P. Venta</th>
                <th className="p-4 text-center whitespace-nowrap">Stock</th>
                <th className="p-4 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {productosFiltrados.length === 0 ? (
                <tr><td colSpan="7" className="p-12 text-center text-slate-500 font-medium">{busqueda ? 'No se encontraron productos.' : 'No hay productos registrados.'}</td></tr>
              ) : (
                productosFiltrados.map((prod) => (
                <tr key={prod.id} className={`transition-colors ${prod.estado ? 'hover:bg-slate-50' : 'opacity-50 bg-slate-50 grayscale'}`}>                  
                    <td className="p-4 text-slate-500 font-mono align-middle text-xs">{prod.codigo}</td>
                    <td className="p-4 font-semibold text-slate-800 align-middle min-w-[200px]">{prod.nombre}</td>
                    <td className="p-4 text-slate-600 align-middle">{prod.proveedor?.nombre || '-'}</td>
                    <td className="p-4 text-slate-600 align-middle">{prod.precioCompra ? `S/ ${prod.precioCompra.toFixed(2)}` : '-'}</td>
                    <td className="p-4 text-slate-950 font-bold align-middle">S/ {prod.precioVenta.toFixed(2)}</td>
                    <td className="p-4 text-center align-middle">
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${prod.stock <= (prod.stockMinimo || 5) ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                        {prod.stock}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                    <div className="flex justify-center gap-2">
                    <button onClick={() => setBarcodeView(prod)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Ver Código"><FaBarcode /></button>
                    
                    {prod.estado && (
                        <>
                        {isAdmin && (
                            <button onClick={() => setEditingProduct(prod)} className="p-2 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar Info"><FaEdit /></button>
                        )}
                        <button onClick={() => setStockProduct(prod)} className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors" title="Gestionar Stock"><FaBox /></button>
                        </>
                    )}

                    {isAdmin && (
                        <button 
                        onClick={() => toggleEstado(prod.id, prod.estado)}
                        className={`p-2 rounded-lg transition-colors ${prod.estado ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                        title={prod.estado ? 'Descontinuar Producto' : 'Activar Producto'}
                        >
                        {prod.estado ? <FaTimes /> : <FaCheck />}
                        </button>
                    )}
                    </div>
                </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DEL ESCÁNER DE CÁMARA */}
      <AnimatePresence>
        {scannerTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              className="flex flex-col w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
                <h3 className="text-white font-bold flex items-center gap-2 text-lg"><FaCamera className="text-verde-pastel" /> Escanear Empaque</h3>
                <button type="button" onClick={() => setScannerTarget(null)} className="text-slate-400 hover:text-white p-1 transition-colors"><FaTimes size={20}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col items-center justify-center">
                <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border border-slate-200 shadow-inner"></div>
                <p className="text-sm text-slate-500 text-center mt-6 font-medium">Apunta la cámara al código de barras. Se leerá automáticamente.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: NUEVO PRODUCTO */}
      <AnimatePresence>
        {isCreateModalOpen && !scannerTarget && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[80px] pb-6 px-4 sm:items-center sm:pt-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-2xl max-h-full sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Registrar Nuevo Producto</h2>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white p-1 transition-colors"><FaTimes size={20}/></button>
              </div>
              
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-white">
                  
                  <div className="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Código de Barras</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input type="text" value={formData.codigo} onChange={e => setFormData({...formData, codigo: e.target.value})} className="w-full p-3 bg-white border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 font-mono tracking-widest shadow-sm" placeholder="Dejar vacío para auto-generar"/>
                      <button type="button" onClick={() => setScannerTarget('crear')} className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-950 text-white rounded-lg transition-colors font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-sm">
                        <FaCamera /> Escanear
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500 mt-2">Si el producto no tiene código (ej. Papelotes), déjalo vacío y el sistema creará uno para imprimir.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nombre del Producto *</label>
                      <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Categoría</label>
                      <input type="text" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Proveedor</label>
                      <select value={formData.proveedorId} onChange={e => setFormData({...formData, proveedorId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium">
                        <option value="">Sin proveedor asignado</option>
                        {proveedores.map(prov => <option key={prov.id} value={prov.id}>{prov.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Stock Inicial</label>
                      <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Costo de Compra (S/)</label>
                      <input type="number" step="0.10" value={formData.precioCompra} onChange={e => setFormData({...formData, precioCompra: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Precio de Venta (S/) *</label>
                      <input type="number" step="0.10" required value={formData.precioVenta} onChange={e => setFormData({...formData, precioVenta: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-700 font-extrabold text-lg transition-all"/>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 border border-slate-300 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none">Guardar Producto</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDITAR PRODUCTO */}
      <AnimatePresence>
        {editingProduct && !scannerTarget && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[80px] pb-6 px-4 sm:items-center sm:pt-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-2xl max-h-full sm:max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Editar: <span className="text-verde-pastel font-mono text-base ml-2">{editingProduct.codigo}</span></h2>
                <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-white p-1 transition-colors"><FaTimes size={20}/></button>
              </div>

              <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Nombre del Producto *</label>
                      <input type="text" required value={editingProduct.nombre} onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Categoría</label>
                      <input type="text" value={editingProduct.categoria || ''} onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Proveedor</label>
                      <select value={editingProduct.proveedorId || ''} onChange={e => setEditingProduct({...editingProduct, proveedorId: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium">
                        <option value="">Sin proveedor asignado</option>
                        {proveedores.map(prov => <option key={prov.id} value={prov.id}>{prov.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Stock Actual (Lectura)</label>
                      <input type="number" disabled value={editingProduct.stock} className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-400 cursor-not-allowed font-medium" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Costo de Compra (S/)</label>
                      <input type="number" step="0.10" value={editingProduct.precioCompra || ''} onChange={e => setEditingProduct({...editingProduct, precioCompra: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Precio de Venta (S/) *</label>
                      <input type="number" step="0.10" required value={editingProduct.precioVenta} onChange={e => setEditingProduct({...editingProduct, precioVenta: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-emerald-700 font-extrabold text-lg transition-all"/>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 sm:p-5 border border-slate-300 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setEditingProduct(null)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none">Actualizar Info</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: GESTIONAR STOCK */}
      <AnimatePresence>
        {stockProduct && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              
              <div className="flex justify-between items-center p-4 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
                <h2 className="text-lg sm:text-xl font-extrabold text-white">Actualizar Stock</h2>
                <button type="button" onClick={() => setStockProduct(null)} className="text-slate-400 hover:text-white p-1 transition-colors"><FaTimes size={20}/></button>
              </div>

              <form onSubmit={handleManageStock} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-4 sm:p-6 flex-1 bg-white">
                  <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-sm text-slate-600 mb-1">Producto: <span className="font-bold text-slate-800">{stockProduct.nombre}</span></p>
                    <p className="text-sm text-slate-600">Stock Actual: <span className="font-bold text-emerald-700">{stockProduct.stock} unidades</span></p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Acción *</label>
                      <select required value={stockData.tipo} onChange={e => setStockData({...stockData, tipo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium">
                        <option value="ABASTECIMIENTO">Ingreso (+)</option>
                        <option value="DEVOLUCION">Devolución (+)</option>
                        <option value="AJUSTE_NEGATIVO">Merma (-)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Cantidad *</label>
                      <input type="number" required min="1" value={stockData.cantidad} onChange={e => setStockData({...stockData, cantidad: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">Motivo</label>
                      <input type="text" value={stockData.motivo} onChange={e => setStockData({...stockData, motivo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-slate-800 transition-all font-medium"/>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 border border-slate-300 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => setStockProduct(null)} className="w-full sm:w-auto px-5 py-4 sm:py-3 rounded-xl font-semibold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors shadow-sm">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-5 py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-all shadow-sm order-first sm:order-none">Confirmar Acción</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: VISOR DE ETIQUETA */}
      <AnimatePresence>
        {barcodeView && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm" onClick={() => setBarcodeView(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} 
              className="flex flex-col w-full max-w-sm max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden">
              
              <div className="bg-slate-950 border-t-4 border-verde-pastel p-4 sm:p-6 w-full text-center">
                <h3 className="text-white font-extrabold mb-1 truncate w-full text-lg">{barcodeView.nombre}</h3>
                <p className="text-verde-pastel font-semibold text-xs uppercase tracking-widest text-center">Etiqueta de Inventario</p>
              </div>
              
              <div className="p-6 sm:p-8 flex flex-col items-center">
                <div id="area-impresion-barcode" className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full flex flex-col items-center justify-center">
                  <Barcode value={barcodeView.codigo} background="#ffffff" lineColor="#0f172a" width={1.8} height={60} displayValue={true} margin={0} fontSize={14} />
                  <span style={{ marginTop: '8px', fontWeight: '800', fontSize: '14px', fontFamily: 'sans-serif', color: '#0f172a' }}>S/ {barcodeView.precioVenta.toFixed(2)}</span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full mt-8 shrink-0">
                  <button onClick={() => setBarcodeView(null)} className="w-full py-4 sm:py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold transition-colors shadow-sm text-sm">Cerrar</button>
                  <button onClick={handleImprimirEtiqueta} className="w-full py-4 sm:py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-bold transition-colors shadow-sm text-sm flex items-center justify-center gap-2 order-first sm:order-none">
                    <FaPrint /> Imprimir
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}