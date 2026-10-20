import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaBox, FaBarcode, FaTimes, FaSearch, 
  FaCheck, FaCamera, FaPrint, FaBoxOpen, FaExclamationTriangle 
} from 'react-icons/fa';
import axios from 'axios';
import toast from 'react-hot-toast';
import Barcode from 'react-barcode';
import { Html5Qrcode } from 'html5-qrcode';

// Sub-componente dinámico para buscar y seleccionar proveedores (Definido afuera para evitar bugs visuales)
const SelectorProveedor = ({ proveedores, valorActual, onChange }) => {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const proveedorSeleccionado = proveedores.find(p => p.id === parseInt(valorActual));
  const textoMostrar = abierto ? busqueda : (proveedorSeleccionado ? proveedorSeleccionado.nombre : '');
  const filtrados = proveedores.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium cursor-text"
        placeholder={proveedorSeleccionado ? proveedorSeleccionado.nombre : "Buscar proveedor..."}
        value={textoMostrar}
        onFocus={() => { setAbierto(true); setBusqueda(''); }}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); }}
      />
      {abierto && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] max-h-48 overflow-y-auto divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <div
            className="px-3.5 py-2.5 hover:bg-slate-50 cursor-pointer text-slate-500 text-xs font-bold uppercase tracking-wider"
            onClick={() => { onChange(''); setAbierto(false); }}
          >
            Sin proveedor asignado
          </div>
          {filtrados.length > 0 ? filtrados.map(prov => (
            <div
              key={prov.id}
              className="px-3.5 py-2.5 hover:bg-verde-pastel/25 hover:text-emerald-950 cursor-pointer text-slate-800 text-sm font-semibold transition-colors"
              onClick={() => { onChange(prov.id); setAbierto(false); }}
            >
              {prov.nombre}
            </div>
          )) : (
            <div className="p-3 text-slate-400 text-xs font-medium text-center">No se encontraron proveedores</div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  
  // Estados de carga (Skeleton)
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [stockProduct, setStockProduct] = useState(null);     
  const [barcodeView, setBarcodeView] = useState(null);
  const [scannerTarget, setScannerTarget] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
  const [stockData, setStockData] = useState({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const cargarDatos = async () => {
    setIsLoading(true); 
    try {
      const [resProductos, resProveedores] = await Promise.all([
        axios.get('/productos'),
        axios.get('/proveedores')
      ]);
      setProductos(resProductos.data);
      setProveedores(resProveedores.data);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      toast.error('Ocurrió un problema al cargar los datos');
    } finally {
      setIsLoading(false); 
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDatos(); }, []);

  useEffect(() => {
    let html5QrCode;

    if (scannerTarget) {
      html5QrCode = new Html5Qrcode("reader");

      const iniciarCamara = async () => {
        try {
          await html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 10, qrbox: { width: 250, height: 100 } },
            async (decodedText) => {
              
              if (html5QrCode.isScanning) {
                await html5QrCode.stop();
                html5QrCode.clear();
              }
              setScannerTarget(null);

              if (scannerTarget === 'crear') {
                setFormData(prev => ({ ...prev, codigo: decodedText }));
                toast.success('Código escaneado. Buscando información...');

                try {
                  const resFood = await fetch(`https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`).then(r => r.json());
                  if (resFood.status === 1 && resFood.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resFood.product.product_name, codigo: decodedText }));
                    return toast.success('Producto encontrado en la base de datos');
                  }

                  const resBeauty = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${decodedText}.json`).then(r => r.json());
                  if (resBeauty.status === 1 && resBeauty.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resBeauty.product.product_name, codigo: decodedText }));
                    return toast.success('Producto encontrado en la base de datos');
                  }

                  const resProducts = await fetch(`https://world.openproductsfacts.org/api/v0/product/${decodedText}.json`).then(r => r.json());
                  if (resProducts.status === 1 && resProducts.product.product_name) {
                    setFormData(prev => ({ ...prev, nombre: resProducts.product.product_name, codigo: decodedText }));
                    return toast.success('Producto encontrado en la base de datos');
                  }

                  const resUpc = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${decodedText}`).then(r => r.json());
                  if (resUpc.items && resUpc.items.length > 0) {
                    setFormData(prev => ({ ...prev, nombre: resUpc.items[0].title, codigo: decodedText }));
                    return toast.success('Producto encontrado en la base de datos');
                  }
                  
                  toast.error('Producto no encontrado. Requiere ingreso manual.');
                } catch (error) {
                  console.log("Error consultando APIs externas:", error);
                }

              } else if (scannerTarget === 'editar') {
                setEditingProduct(prev => ({ ...prev, codigo: decodedText }));
                toast.success('Código escaneado exitosamente');
              } else if (scannerTarget === 'busqueda') {
                setBusqueda(decodedText);
                toast.success('Buscando producto...');
              }
            },
            () => { /* Ignorar advertencias */ }
          );
        } catch (error) {
          console.error("Error al iniciar la cámara:", error);
          toast.error("No se pudo iniciar la cámara. Verifica los permisos de tu navegador.");
        }
      };

      iniciarCamara();
    }

    return () => {
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch(console.error);
      }
    };
  }, [scannerTarget]);

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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const dataAEnviar = { ...formData, proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null };
      await axios.post('/productos', dataAEnviar);
      
      toast.success('Producto registrado correctamente');
      setIsCreateModalOpen(false);
      setFormData({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al guardar el producto'); 
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const dataAEnviar = { ...editingProduct, proveedorId: editingProduct.proveedorId ? parseInt(editingProduct.proveedorId) : null };
      await axios.put(`/productos/${editingProduct.id}`, dataAEnviar);
      
      toast.success('Producto actualizado correctamente');
      setEditingProduct(null);
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al actualizar el producto'); 
    }
  };

  const handleManageStock = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/productos/${stockProduct.id}/stock`, stockData);
      toast.success('Inventario actualizado');
      setStockProduct(null);
      setStockData({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al actualizar el inventario'); 
    }
  };

  const prepararToggleEstado = (prod) => {
    setConfirmDialog(prod);
  };

  const ejecutarToggleEstado = async () => {
    if (!confirmDialog) return;
    const accion = confirmDialog.estado ? 'descontinuar' : 'reactivar';
    try {
      await axios.put(`/productos/${confirmDialog.id}/estado`, {});
      toast.success(`Producto ${accion}do exitosamente`);
      setConfirmDialog(null);
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al cambiar estado del producto'); 
    }
  };

  const productosFiltrados = productos.filter(prod => 
    prod.nombre?.toLowerCase().includes(busqueda.toLowerCase()) || 
    prod.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const productosActivos = productos.filter(p => p.estado);
  const stockCriticoCount = productosActivos.filter(p => p.stock <= (p.stockMinimo || 5)).length;
  const valorizadoTotal = productosActivos.reduce((acc, p) => acc + (p.stock * p.precioVenta), 0);

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-20 lg:pb-4 font-sans antialiased">
      
      {/* CABECERA PRINCIPAL (Jerarquía limpia estilo Figma) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Gestion de Productos
          </h1>
          <p className="text-sm text-slate-600 font-medium mt-1">
            Administra tus existencias, costos de compra, precios de venta y etiquetas de código de barras.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <FaSearch className="text-slate-400 text-sm" />
            </div>
            
            <input 
              type="text" 
              placeholder="Buscar por nombre o código..." 
              value={busqueda} 
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-11 pr-12 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400" 
            />
            
            <button 
              type="button"
              onClick={() => setScannerTarget('busqueda')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
              title="Escanear código con cámara"
            >
              <FaCamera size={17} />
            </button>
          </div>
          
          {isAdmin && (
            <button 
              type="button"
              onClick={() => setIsCreateModalOpen(true)} 
              className="bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
            >
              <FaPlus size={13} /> Nuevo Producto
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE RESUMEN SIMÉTRICAS (Estilo Figma) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Productos Activos</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {productosActivos.length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
            <FaBoxOpen size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Stock Bajo / Crítico</p>
            <p className={`text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight ${stockCriticoCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stockCriticoCount}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${stockCriticoCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
            <FaExclamationTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_6px_24px_rgba(15,23,42,0.05)] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">Valorizado en Venta</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">
              S/ {valorizadoTotal.toFixed(2)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FaBarcode size={22} />
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL CON SOMBRA FLOTANTE SUAVE */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[920px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-5 whitespace-nowrap">Código</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Producto / Categoría</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Proveedor</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Costo Compra</th>
                <th className="py-3.5 px-4 whitespace-nowrap text-right">Precio Venta</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Existencias</th>
                <th className="py-3.5 px-5 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                    <td className="py-4 px-4"><div className="h-6 bg-slate-200 rounded-full w-14 mx-auto"></div></td>
                    <td className="py-4 px-5 flex justify-center gap-2">
                      <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                      <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                      <div className="h-8 w-8 bg-slate-200 rounded-lg"></div>
                    </td>
                  </tr>
                ))
              ) : productosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-slate-500 font-medium text-sm">
                    {busqueda ? 'No se encontraron productos con ese criterio de búsqueda.' : 'Aún no hay productos registrados en el catálogo.'}
                  </td>
                </tr>
              ) : (
                productosFiltrados.map((prod) => {
                  const esStockBajo = prod.stock <= (prod.stockMinimo || 5);
                  return (
                    <tr key={prod.id} className={`transition-colors ${prod.estado ? 'hover:bg-slate-50/80' : 'opacity-55 bg-slate-50/60'}`}>
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-600 align-middle whitespace-nowrap">
                        {prod.codigo}
                      </td>
                      <td className="py-3.5 px-4 align-middle min-w-[220px]">
                        <p className="font-bold text-slate-900 text-sm">{prod.nombre}</p>
                        {prod.categoria && (
                          <span className="inline-block text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5">
                            {prod.categoria}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium align-middle">
                        {prod.proveedor?.nombre || <span className="text-slate-400 text-xs">Sin asignar</span>}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 font-medium align-middle whitespace-nowrap">
                        {prod.precioCompra ? `S/ ${prod.precioCompra.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-900 font-extrabold text-base align-middle whitespace-nowrap">
                        S/ {prod.precioVenta.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                          esStockBajo 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-verde-pastel/35 text-emerald-900 border-emerald-200'
                        }`}>
                          {prod.stock} un.
                        </span>
                      </td>
                      <td className="py-3.5 px-5 align-middle whitespace-nowrap">
                        <div className="flex justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setBarcodeView(prod)} 
                            className="p-2 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg transition-colors cursor-pointer" 
                            title="Ver Código"
                          >
                            <FaBarcode size={14} />
                          </button>
                          
                          {prod.estado && (
                            <>
                              {isAdmin && (
                                <button 
                                  type="button"
                                  onClick={() => setEditingProduct(prod)} 
                                  className="p-2 text-amber-600 hover:text-amber-700 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg transition-colors cursor-pointer" 
                                  title="Editar Producto"
                                >
                                  <FaEdit size={14} />
                                </button>
                              )}
                              <button 
                                type="button"
                                onClick={() => setStockProduct(prod)} 
                                className="p-2 text-emerald-700 hover:text-emerald-800 bg-white hover:bg-verde-pastel/30 border border-slate-200/80 rounded-lg transition-colors cursor-pointer" 
                                title="Actualizar Stock"
                              >
                                <FaBox size={14} />
                              </button>
                            </>
                          )}

                          {isAdmin && (
                            <button 
                              type="button"
                              onClick={() => prepararToggleEstado(prod)}
                              className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer ${
                                prod.estado 
                                  ? 'text-red-500 hover:text-red-700 hover:bg-red-50' 
                                  : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                              }`}
                              title={prod.estado ? 'Descontinuar Producto' : 'Reactivar Producto'}
                            >
                              {prod.estado ? <FaTimes size={14} /> : <FaCheck size={14} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 0: CONFIRMAR ESTADO */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200">
              <div className="p-6 text-center">
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4 ${confirmDialog.estado ? 'bg-red-50 text-red-600' : 'bg-verde-pastel/40 text-emerald-800'}`}>
                  {confirmDialog.estado ? <FaExclamationTriangle size={26} /> : <FaCheck size={26} />}
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">
                  {confirmDialog.estado ? '¿Descontinuar producto?' : '¿Reactivar producto?'}
                </h3>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">
                  {confirmDialog.estado 
                    ? `El producto "${confirmDialog.nombre}" dejará de mostrarse en el Punto de Venta.` 
                    : `El producto "${confirmDialog.nombre}" volverá a estar habilitado para la venta.`}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button type="button" onClick={() => setConfirmDialog(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={ejecutarToggleEstado} className={`flex-1 py-2.5 rounded-xl font-extrabold transition-colors text-sm cursor-pointer ${confirmDialog.estado ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'}`}>
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ESCÁNER DE CÁMARA GLOBAL PARA PRODUCTOS */}
      <AnimatePresence>
        {scannerTarget && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} 
              className="flex flex-col w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaCamera size={16} />
                  </div>
                  <h3 className="text-slate-900 font-bold text-base">Escanear Código de Empaque</h3>
                </div>
                <button type="button" onClick={() => setScannerTarget(null)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><FaTimes size={18}/></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col items-center justify-center">
                <div id="reader" className="w-full bg-black rounded-xl overflow-hidden border border-slate-300 shadow-inner"></div>
                <p className="text-sm text-slate-600 text-center mt-4 font-medium">Apunta la cámara al código de barras del producto.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: NUEVO PRODUCTO */}
      <AnimatePresence>
        {isCreateModalOpen && !scannerTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaBoxOpen size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">Nuevo Producto</h2>
                    <p className="text-xs text-slate-500 font-medium">Completa los datos para añadirlo al catálogo de tu bodega.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><FaTimes size={18}/></button>
              </div>
              
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Código de Barras</label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input 
                        type="text" 
                        value={formData.codigo} 
                        onChange={e => setFormData({...formData, codigo: e.target.value})} 
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-mono text-sm font-semibold" 
                        placeholder="Dejar vacío para generar código automático"
                      />
                      <button 
                        type="button" 
                        onClick={() => setScannerTarget('crear')} 
                        className="w-full sm:w-auto px-4 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <FaCamera /> Escanear
                      </button>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-1.5">Si el producto no trae código impreso, déjalo en blanco y el sistema le creará uno.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre / Descripción del Producto *</label>
                      <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoría</label>
                      <input type="text" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})} placeholder="Ej: Bebidas, Abarrotes, Lácteos..." className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Proveedor Asociado</label>
                      <SelectorProveedor 
                        proveedores={proveedores} 
                        valorActual={formData.proveedorId} 
                        onChange={(id) => setFormData({...formData, proveedorId: id})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Stock Inicial</label>
                      <input type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="0" className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Costo de Compra Unit. (S/)</label>
                      <input type="number" step="0.10" value={formData.precioCompra} onChange={e => setFormData({...formData, precioCompra: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium" placeholder="0.00"/>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Precio de Venta al Público (S/) *</label>
                      <input type="number" step="0.10" required value={formData.precioVenta} onChange={e => setFormData({...formData, precioVenta: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-emerald-700 font-extrabold text-lg transition-all" placeholder="0.00"/>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button type="button" onClick={() => setIsCreateModalOpen(false)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none cursor-pointer">Guardar Producto</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: EDITAR PRODUCTO */}
      <AnimatePresence>
        {editingProduct && !scannerTarget && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaEdit size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      Editar Producto <span className="text-emerald-800 font-mono text-xs bg-verde-pastel/40 px-2.5 py-0.5 rounded-md">{editingProduct.codigo}</span>
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">Actualiza los precios, categoría o proveedor del producto.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><FaTimes size={18}/></button>
              </div>

              <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre del Producto *</label>
                      <input type="text" required value={editingProduct.nombre} onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoría</label>
                      <input type="text" value={editingProduct.categoria || ''} onChange={e => setEditingProduct({...editingProduct, categoria: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Proveedor</label>
                      <SelectorProveedor 
                        proveedores={proveedores} 
                        valorActual={editingProduct.proveedorId} 
                        onChange={(id) => setEditingProduct({...editingProduct, proveedorId: id})} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Stock Actual (Solo Lectura)</label>
                      <input type="number" disabled value={editingProduct.stock} className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed font-bold text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Costo Unitario (S/)</label>
                      <input type="number" step="0.10" value={editingProduct.precioCompra || ''} onChange={e => setEditingProduct({...editingProduct, precioCompra: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Precio Unitario de Venta (S/) *</label>
                      <input type="number" step="0.10" required value={editingProduct.precioVenta} onChange={e => setEditingProduct({...editingProduct, precioVenta: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-emerald-700 font-extrabold text-lg transition-all"/>
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button type="button" onClick={() => setEditingProduct(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none cursor-pointer">Guardar Cambios</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: GESTIONAR STOCK */}
      <AnimatePresence>
        {stockProduct && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
              className="flex flex-col w-full max-w-md max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              
              <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center">
                    <FaBox size={17} />
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900">Actualizar Stock</h2>
                </div>
                <button type="button" onClick={() => setStockProduct(null)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><FaTimes size={18}/></button>
              </div>

              <form onSubmit={handleManageStock} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-4">
                  <div className="p-4 bg-verde-pastel/25 rounded-xl border border-emerald-200/80 flex justify-between items-center">
                    <div>
                      <p className="text-xs font-semibold text-slate-600">Producto seleccionado</p>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{stockProduct.nombre}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-600">Actual</p>
                      <p className="text-lg font-extrabold text-emerald-800">{stockProduct.stock} un.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Tipo de Movimiento *</label>
                    <select required value={stockData.tipo} onChange={e => setStockData({...stockData, tipo: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-bold">
                      <option value="ABASTECIMIENTO">Ingreso / Abastecimiento (+)</option>
                      <option value="DEVOLUCION">Devolución de Cliente (+)</option>
                      <option value="AJUSTE_NEGATIVO">Merma / Ajuste Negativo (-)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Cantidad de Unidades *</label>
                    <input type="number" required min="1" value={stockData.cantidad} onChange={e => setStockData({...stockData, cantidad: e.target.value})} placeholder="Ej: 10" className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-bold"/>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Motivo u Observación</label>
                    <input type="text" value={stockData.motivo} onChange={e => setStockData({...stockData, motivo: e.target.value})} placeholder="Opcional (Ej: Reposición de tienda)" className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button type="button" onClick={() => setStockProduct(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">Cancelar</button>
                  <button type="submit" className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none cursor-pointer">Confirmar Ajuste</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: VISOR DE ETIQUETA DE CÓDIGO DE BARRAS */}
      <AnimatePresence>
        {barcodeView && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs" onClick={() => setBarcodeView(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} 
              className="flex flex-col w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                  <FaBarcode size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-slate-900 font-extrabold truncate text-base">{barcodeView.nombre}</h3>
                  <p className="text-slate-500 font-medium text-xs">Etiqueta lista para impresión</p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50/60 flex flex-col items-center">
                <div id="area-impresion-barcode" className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs w-full flex flex-col items-center justify-center">
                  <Barcode value={barcodeView.codigo} background="#ffffff" lineColor="#0f172a" width={1.8} height={60} displayValue={true} margin={0} fontSize={14} />
                  <span style={{ marginTop: '8px', fontWeight: '800', fontSize: '15px', fontFamily: 'sans-serif', color: '#0f172a' }}>
                    S/ {barcodeView.precioVenta.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex gap-2.5 w-full mt-6">
                  <button type="button" onClick={() => setBarcodeView(null)} className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold transition-colors text-sm cursor-pointer">
                    Cerrar
                  </button>
                  <button type="button" onClick={handleImprimirEtiqueta} className="flex-1 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-colors shadow-2xs text-sm flex items-center justify-center gap-2 cursor-pointer">
                    <FaPrint size={14} /> Imprimir
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