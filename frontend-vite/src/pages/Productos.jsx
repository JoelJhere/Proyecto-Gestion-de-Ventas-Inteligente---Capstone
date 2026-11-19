import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FaPlus, FaEdit, FaBox, FaBarcode, FaTimes, FaSearch, 
  FaCheck, FaCamera, FaPrint, FaBoxOpen, FaExclamationTriangle,
  FaPercentage, FaChevronDown, FaTruck
} from 'react-icons/fa';
import { useBusiness } from '../context/BusinessContext';
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

// Normalizador idéntico al del backend para detectar duplicados en tiempo real ("gaseosa de 150ml" === "gaseosa 150ml")
const normalizarTextoProducto = (texto = '') => {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(de|del|con|la|el|los|las|en|para|por)\b/g, ' ')
    .replace(/(\d+)\s+(ml|l|lt|lts|gr|g|kg|un|und|oz)\b/g, '$1$2')
    .replace(/[^a-z0-9.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Redondea a 1 decimal estándar (ej: 1.56 -> "1.60", 1.54 -> "1.50")
const redondearUnDecimal = (valor) => {
  const num = parseFloat(valor);
  if (Number.isNaN(num) || num <= 0) return '';
  return (Math.round((num + Number.EPSILON) * 10) / 10).toFixed(2);
};

// Sub-componente para filtrar y autocompletar categorías guardadas (locales y globales)
const SelectorCategoria = ({ categorias, valorActual, onChange }) => {
  const [abierto, setAbierto] = useState(false);
  const texto = valorActual || '';
  const filtradas = categorias.filter(c => c.toLowerCase().includes(texto.toLowerCase()));

  return (
    <div className="relative">
      <input
        type="text"
        value={texto}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
        placeholder="Ej: Bebidas, Abarrotes, Lácteos..."
        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"
      />
      {abierto && filtradas.length > 0 && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.12)] max-h-44 overflow-y-auto divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          {filtradas.map((cat, idx) => (
            <div
              key={idx}
              onMouseDown={() => { onChange(cat); setAbierto(false); }}
              className="px-3.5 py-2 hover:bg-verde-pastel/25 hover:text-emerald-950 cursor-pointer text-slate-800 text-sm font-semibold transition-colors flex items-center justify-between"
            >
              <span>{cat}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Categoría</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [categoriasGlobales, setCategoriasGlobales] = useState([]);
  const [productosGlobales, setProductosGlobales] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroProveedor, setFiltroProveedor] = useState('TODOS');
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  
  // Estados de carga (Skeleton)
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados de Modales y Autocompletado
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); 
  const [stockProduct, setStockProduct] = useState(null);     
  const [barcodeView, setBarcodeView] = useState(null);
  const [scannerTarget, setScannerTarget] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showSugerenciasNombre, setShowSugerenciasNombre] = useState(false);
  const [origenAutocompletado, setOrigenAutocompletado] = useState(null); // 'LOCAL' | 'GLOBAL' | null

  const [formData, setFormData] = useState({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
  const [stockData, setStockData] = useState({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });

  // Bloqueo inmediato anti-spam / doble clic para todas las acciones
  const [isSubmitting, setIsSubmitting] = useState(false);
  const accionEnCursoRef = useRef(false);

  // Control del cálculo bidireccional (+20% / ÷1.2): null | 'compra' | 'venta' | 'ambos'
  const [modoPrecioCrear, setModoPrecioCrear] = useState(null);
  const [modoPrecioEditar, setModoPrecioEditar] = useState('ambos');

  const { businessConfig, setBusinessConfig } = useBusiness();

  // Paginación progresiva en bloques de 30 productos (mantiene rápida la tablet y el celular)
  const BLOQUE_CARGA = 30;
  const [limiteVisible, setLimiteVisible] = useState(BLOQUE_CARGA);

  // Configuración del margen automático sincronizada desde la Base de Datos
  const autoMargenActivo =
    Boolean(businessConfig?.autoMargenActivo) && Number(businessConfig?.porcentajeGanancia) > 0;
  const porcentajeGanancia = Number(businessConfig?.porcentajeGanancia) || 0;
  const factorMargen = 1 + porcentajeGanancia / 100;

  // Estados del Modal de Configuración de Margen
  const [isMargenModalOpen, setIsMargenModalOpen] = useState(false);
  const [formMargen, setFormMargen] = useState({ activo: false, porcentaje: '' });

  const abrirModalMargen = () => {
    setFormMargen({
      activo: Boolean(businessConfig?.autoMargenActivo),
      porcentaje: businessConfig?.porcentajeGanancia ? String(businessConfig.porcentajeGanancia) : ''
    });
    setIsMargenModalOpen(true);
  };

  const handleGuardarMargen = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current) return;

    const pct = parseFloat(formMargen.porcentaje);
    if (formMargen.activo && (Number.isNaN(pct) || pct <= 0 || pct > 500)) {
      return toast.error('Ingresa un porcentaje de ganancia válido entre 1% y 500%.', { id: 'margen-accion' });
    }

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await axios.put('/configuracion/margen', {
        autoMargenActivo: formMargen.activo,
        porcentajeGanancia: formMargen.porcentaje
      });

      if (res.data?.config) {
        setBusinessConfig(res.data.config);
        localStorage.setItem('pos_config', JSON.stringify(res.data.config));
      }
      toast.success(res.data?.message || 'Configuración guardada.', { id: 'margen-accion' });
      setIsMargenModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'No se pudo guardar la configuración.', { id: 'margen-accion' });
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const abrirModalCrear = () => {
    setFormData({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
    setOrigenAutocompletado(null);
    setModoPrecioCrear(null);
    setIsCreateModalOpen(true);
  };

  const abrirModalEditar = (prod) => {
    setEditingProduct({ ...prod });
    if (prod.precioCompra && prod.precioVenta) setModoPrecioEditar('ambos');
    else if (prod.precioVenta) setModoPrecioEditar('venta');
    else if (prod.precioCompra) setModoPrecioEditar('compra');
    else setModoPrecioEditar(null);
  };

  // --- CÁLCULO AUTOMÁTICO BIDIRECCIONAL (CREAR) ---
  const handleCambioCompraCrear = (val) => {
    if (!autoMargenActivo) {
      setFormData(prev => ({ ...prev, precioCompra: val }));
      return;
    }

    if (val === '') {
      if (modoPrecioCrear === 'compra') {
        setModoPrecioCrear(null);
        setFormData(prev => ({ ...prev, precioCompra: '', precioVenta: '' }));
      } else {
        setFormData(prev => ({ ...prev, precioCompra: '' }));
        if (formData.precioVenta === '') setModoPrecioCrear(null);
      }
      return;
    }

    const num = parseFloat(val);
    if (modoPrecioCrear === null || modoPrecioCrear === 'compra') {
      setModoPrecioCrear('compra');
      const ventaSugerida = !Number.isNaN(num) && num > 0 ? redondearUnDecimal(num * factorMargen) : '';
      setFormData(prev => ({ ...prev, precioCompra: val, precioVenta: ventaSugerida }));
    } else {
      setModoPrecioCrear('ambos');
      setFormData(prev => ({ ...prev, precioCompra: val }));
    }
  };

  const handleCambioVentaCrear = (val) => {
    if (!autoMargenActivo) {
      setFormData(prev => ({ ...prev, precioVenta: val }));
      return;
    }

    if (val === '') {
      if (modoPrecioCrear === 'venta') {
        setModoPrecioCrear(null);
        setFormData(prev => ({ ...prev, precioVenta: '', precioCompra: '' }));
      } else {
        setFormData(prev => ({ ...prev, precioVenta: '' }));
        if (formData.precioCompra === '') setModoPrecioCrear(null);
      }
      return;
    }

    const num = parseFloat(val);
    if (modoPrecioCrear === null || modoPrecioCrear === 'venta') {
      setModoPrecioCrear('venta');
      const compraSugerida = !Number.isNaN(num) && num > 0 ? redondearUnDecimal(num / factorMargen) : '';
      setFormData(prev => ({ ...prev, precioVenta: val, precioCompra: compraSugerida }));
    } else {
      setModoPrecioCrear('ambos');
      setFormData(prev => ({ ...prev, precioVenta: val }));
    }
  };

  // --- CÁLCULO AUTOMÁTICO BIDIRECCIONAL (EDITAR) ---
  const handleCambioCompraEditar = (val) => {
    if (!autoMargenActivo) {
      setEditingProduct(prev => ({ ...prev, precioCompra: val }));
      return;
    }

    if (val === '') {
      if (modoPrecioEditar === 'compra') {
        setModoPrecioEditar(null);
        setEditingProduct(prev => ({ ...prev, precioCompra: '', precioVenta: '' }));
      } else {
        setEditingProduct(prev => ({ ...prev, precioCompra: '' }));
        if (!editingProduct?.precioVenta) setModoPrecioEditar(null);
      }
      return;
    }

    const num = parseFloat(val);
    if (modoPrecioEditar === null || modoPrecioEditar === 'compra') {
      setModoPrecioEditar('compra');
      const ventaSugerida = !Number.isNaN(num) && num > 0 ? redondearUnDecimal(num * factorMargen) : '';
      setEditingProduct(prev => ({ ...prev, precioCompra: val, precioVenta: ventaSugerida }));
    } else {
      setModoPrecioEditar('ambos');
      setEditingProduct(prev => ({ ...prev, precioCompra: val }));
    }
  };

  const handleCambioVentaEditar = (val) => {
    if (!autoMargenActivo) {
      setEditingProduct(prev => ({ ...prev, precioVenta: val }));
      return;
    }

    if (val === '') {
      if (modoPrecioEditar === 'venta') {
        setModoPrecioEditar(null);
        setEditingProduct(prev => ({ ...prev, precioVenta: '', precioCompra: '' }));
      } else {
        setEditingProduct(prev => ({ ...prev, precioVenta: '' }));
        if (!editingProduct?.precioCompra) setModoPrecioEditar(null);
      }
      return;
    }

    const num = parseFloat(val);
    if (modoPrecioEditar === null || modoPrecioEditar === 'venta') {
      setModoPrecioEditar('venta');
      const compraSugerida = !Number.isNaN(num) && num > 0 ? redondearUnDecimal(num / factorMargen) : '';
      setEditingProduct(prev => ({ ...prev, precioVenta: val, precioCompra: compraSugerida }));
    } else {
      setModoPrecioEditar('ambos');
      setEditingProduct(prev => ({ ...prev, precioVenta: val }));
    }
  };

  const usuario = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = usuario.rol === 'ADMIN';

  const cargarDatos = async () => {
    setIsLoading(true); 
    try {
      const [resProductos, resProveedores, resGlobal] = await Promise.all([
        axios.get('/productos'),
        axios.get('/proveedores'),
        axios.get('/productos/catalogo-global')
      ]);
      setProductos(resProductos.data);
      setProveedores(resProveedores.data);
      setCategoriasGlobales(resGlobal.data.categoriasGlobales || []);
      setProductosGlobales(resGlobal.data.productosGlobales || []);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      toast.error('Ocurrió un problema al cargar los datos');
    } finally {
      setIsLoading(false); 
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { cargarDatos(); }, []);

  // Verifica un código de barras (al escanear o escribir) respetando si el usuario ya llenó datos antes
  const procesarCodigoEnFormulario = async (codigoLimpio, desdeEscaner = false) => {
    if (!codigoLimpio) {
      setOrigenAutocompletado(null);
      return;
    }

    // 1. Verificar si ya existe en el inventario de ESTA bodega
    const existenteLocal = productos.find(p => p.codigo.toLowerCase() === codigoLimpio.toLowerCase());
    if (existenteLocal) {
      setOrigenAutocompletado('LOCAL');
      setFormData(prev => ({
        ...prev,
        codigo: codigoLimpio,
        nombre: prev.nombre.trim() !== '' ? prev.nombre : existenteLocal.nombre,
        categoria: prev.categoria.trim() !== '' ? prev.categoria : (existenteLocal.categoria || ''),
        precioCompra: prev.precioCompra !== '' ? prev.precioCompra : (existenteLocal.precioCompra || ''),
        precioVenta: prev.precioVenta !== '' ? prev.precioVenta : (existenteLocal.precioVenta || ''),
        proveedorId: prev.proveedorId !== '' ? prev.proveedorId : (existenteLocal.proveedorId || '')
      }));
      if (desdeEscaner) toast.error('Este código ya está registrado en tu inventario.');
      return;
    }

    // 2. Si el dueño YA escribió primero el nombre/datos y al final escanea el código, NO borramos sus datos
    if (formData.nombre.trim() !== '') {
      setOrigenAutocompletado(null);
      setFormData(prev => ({ ...prev, codigo: codigoLimpio }));
      if (desdeEscaner) toast.success('Código asignado. Tus datos ingresados se mantuvieron intactos.');
      return;
    }

    // 3. Buscar en el Catálogo Global (Productos escaneados en otras bodegas)
    const existenteGlobal = productosGlobales.find(p => p.codigo.toLowerCase() === codigoLimpio.toLowerCase());
    if (existenteGlobal) {
      setOrigenAutocompletado('GLOBAL');
      if (existenteGlobal.precioCompra || existenteGlobal.precioVenta) {
        setModoPrecioCrear('ambos');
      }
      setFormData(prev => ({
        ...prev,
        codigo: codigoLimpio,
        nombre: existenteGlobal.nombre,
        categoria: existenteGlobal.categoria || prev.categoria,
        precioCompra: existenteGlobal.precioCompra || prev.precioCompra,
        precioVenta: existenteGlobal.precioVenta || prev.precioVenta
      }));
      if (desdeEscaner) toast.success('Producto autocompletado desde el catálogo global');
      return;
    }

    setOrigenAutocompletado(null);

    // 4. Si se escaneó con cámara y no está en BD, consultar APIs internacionales
    if (desdeEscaner) {
      toast.success('Código escaneado. Buscando información...');
      try {
        const resFood = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigoLimpio}.json`).then(r => r.json());
        if (resFood.status === 1 && resFood.product.product_name) {
          setFormData(prev => ({ ...prev, codigo: codigoLimpio, nombre: prev.nombre || resFood.product.product_name }));
          return toast.success('Producto encontrado en la base de datos');
        }

        const resBeauty = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${codigoLimpio}.json`).then(r => r.json());
        if (resBeauty.status === 1 && resBeauty.product.product_name) {
          setFormData(prev => ({ ...prev, codigo: codigoLimpio, nombre: prev.nombre || resBeauty.product.product_name }));
          return toast.success('Producto encontrado en la base de datos');
        }

        const resProducts = await fetch(`https://world.openproductsfacts.org/api/v0/product/${codigoLimpio}.json`).then(r => r.json());
        if (resProducts.status === 1 && resProducts.product.product_name) {
          setFormData(prev => ({ ...prev, codigo: codigoLimpio, nombre: prev.nombre || resProducts.product.product_name }));
          return toast.success('Producto encontrado en la base de datos');
        }

        const resUpc = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigoLimpio}`).then(r => r.json());
        if (resUpc.items && resUpc.items.length > 0) {
          setFormData(prev => ({ ...prev, codigo: codigoLimpio, nombre: prev.nombre || resUpc.items[0].title }));
          return toast.success('Producto encontrado en la base de datos');
        }
        
        toast.error('Producto nuevo. Completa sus datos manualmente.');
      } catch (error) {
        console.log("Error consultando APIs externas:", error);
      }
    }
  };

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
                await procesarCodigoEnFormulario(decodedText, true);
              } else if (scannerTarget === 'editar') {
                setEditingProduct(prev => ({ ...prev, codigo: decodedText }));
                toast.success('Código escaneado exitosamente');
              } else if (scannerTarget === 'busqueda') {
                setBusqueda(decodedText);
                setLimiteVisible(BLOQUE_CARGA);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (accionEnCursoRef.current) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      const dataAEnviar = { ...formData, proveedorId: formData.proveedorId ? parseInt(formData.proveedorId) : null };
      await axios.post('/productos', dataAEnviar);
      
      toast.success('Producto registrado correctamente.', { id: 'prod-accion' });
      setIsCreateModalOpen(false);
      setOrigenAutocompletado(null);
      setModoPrecioCrear(null);
      setFormData({ codigo: '', nombre: '', categoria: '', precioCompra: '', precioVenta: '', stock: '', proveedorId: '' });
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al guardar el producto.', { id: 'prod-accion' }); 
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current || !editingProduct) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      const dataAEnviar = { ...editingProduct, proveedorId: editingProduct.proveedorId ? parseInt(editingProduct.proveedorId) : null };
      await axios.put(`/productos/${editingProduct.id}`, dataAEnviar);
      
      toast.success('Producto actualizado correctamente.', { id: 'prod-accion' });
      setEditingProduct(null);
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al actualizar el producto.', { id: 'prod-accion' }); 
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleManageStock = async (e) => {
    e.preventDefault();
    if (accionEnCursoRef.current || !stockProduct) return;

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.post(`/productos/${stockProduct.id}/stock`, stockData);
      toast.success('Inventario actualizado correctamente.', { id: 'prod-accion' });
      setStockProduct(null);
      setStockData({ tipo: 'ABASTECIMIENTO', cantidad: '', motivo: '' });
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al actualizar el inventario.', { id: 'prod-accion' }); 
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const prepararToggleEstado = (prod) => {
    if (accionEnCursoRef.current) return;
    setConfirmDialog(prod);
  };

  const ejecutarToggleEstado = async () => {
    if (!confirmDialog || accionEnCursoRef.current) return;
    const productoObjetivo = confirmDialog;
    const accion = productoObjetivo.estado ? 'descontinuado' : 'reactivado';

    accionEnCursoRef.current = true;
    setIsSubmitting(true);
    try {
      await axios.put(`/productos/${productoObjetivo.id}/estado`, {});
      toast.success(`Producto ${accion} exitosamente.`, { id: 'prod-accion' });
      setConfirmDialog(null);
      cargarDatos();
    } catch (error) { 
      toast.error(error.response?.data?.message || 'Error al cambiar el estado del producto.', { id: 'prod-accion' }); 
    } finally {
      accionEnCursoRef.current = false;
      setIsSubmitting(false);
    }
  };

  const productosFiltrados = productos.filter(prod => {
    // 1. Filtro por proveedor seleccionado
    if (filtroProveedor === 'SIN_PROVEEDOR') {
      if (prod.proveedorId) return false;
    } else if (filtroProveedor !== 'TODOS') {
      if (String(prod.proveedorId) !== String(filtroProveedor)) return false;
    }

    // 2. Filtro opcional de solo stock bajo (productos activos)
    if (soloStockBajo) {
      if (!prod.estado || prod.stock > (prod.stockMinimo || 5)) return false;
    }

    // 3. Buscador por nombre o código dentro de la selección actual
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return (
      prod.nombre?.toLowerCase().includes(q) ||
      prod.codigo?.toLowerCase().includes(q)
    );
  });

  const sinProveedorCount = productos.filter(p => !p.proveedorId).length;
  const hayFiltrosActivos = filtroProveedor !== 'TODOS' || soloStockBajo || busqueda.trim() !== '';
  const productosVisibles = productosFiltrados.slice(0, limiteVisible);
  const restantesPorCargar = productosFiltrados.length - productosVisibles.length;

  // Métricas en vivo para las tarjetas superiores estilo Figma
  const productosActivos = productos.filter(p => p.estado);
  const stockCriticoCount = productosActivos.filter(p => p.stock <= (p.stockMinimo || 5)).length;
  const valorizadoTotal = productosActivos.reduce((acc, p) => acc + (p.stock * p.precioVenta), 0);

  // 1. Verificar si el código escrito ya existe en el inventario local
  const productoCodigoEnInventario = formData.codigo.trim() !== ''
    ? productos.find(p => p.codigo.toLowerCase() === formData.codigo.trim().toLowerCase())
    : null;

  // 2. Verificar si el nombre escrito es un duplicado exacto normalizado ("gaseosa de 150ml" === "gaseosa 150ml")
  const nombreNormalizadoActual = normalizarTextoProducto(formData.nombre);
  const productoDuplicadoPorNombre = nombreNormalizadoActual.length >= 3
    ? productos.find(p => normalizarTextoProducto(p.nombre) === nombreNormalizadoActual)
    : null;

  // 3. Filtrar productos similares en el inventario para usarlos como plantilla rápida (ej. otro tamaño de gaseosa)
  const productosSimilaresPlantilla = formData.nombre.trim().length >= 2
    ? productos.filter(p => p.nombre.toLowerCase().includes(formData.nombre.trim().toLowerCase()))
    : [];

  // 4. Lista unificada de categorías (globales + locales de esta bodega)
  const listaCategoriasUnificadas = Array.from(
    new Set([
      ...categoriasGlobales,
      ...productos.map(p => p.categoria).filter(Boolean)
    ])
  ).sort();

  return (
    <div className="flex flex-col gap-6 text-slate-800 pb-24 lg:pb-6 font-sans antialiased">      

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
              placeholder={
                filtroProveedor === 'TODOS'
                  ? 'Buscar por nombre o código...'
                  : 'Buscar en este proveedor...'
              }
              value={busqueda} 
              onChange={(e) => {
                setBusqueda(e.target.value);
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className={`w-full pl-11 ${busqueda ? 'pr-20' : 'pr-12'} py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm text-slate-800 transition-all shadow-[0_2px_12px_rgba(15,23,42,0.04)] font-medium placeholder:text-slate-400`} 
            />

            <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
              {busqueda && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda('');
                    setLimiteVisible(BLOQUE_CARGA);
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <FaTimes size={13} />
                </button>
              )}
              <button 
                type="button"
                onClick={() => setScannerTarget('busqueda')}
                className="text-slate-400 hover:text-emerald-700 transition-colors p-1 cursor-pointer"
                title="Escanear código con cámara"
              >
                <FaCamera size={17} />
              </button>
            </div>
          </div>
          
          {isAdmin && (
            <div className="flex gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={abrirModalMargen}
                className={`flex-1 sm:flex-none py-2.5 px-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs sm:text-sm whitespace-nowrap cursor-pointer border ${
                  autoMargenActivo
                    ? 'bg-emerald-50 hover:bg-verde-pastel/40 text-emerald-900 border-emerald-300 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90 shadow-[0_2px_12px_rgba(15,23,42,0.04)]'
                }`}
                title="Configurar porcentaje automático de ganancia"
              >
                <FaPercentage size={12} className={autoMargenActivo ? 'text-emerald-700' : 'text-slate-400'} />
                <span>{autoMargenActivo ? `Margen: ${porcentajeGanancia}%` : 'Margen Auto'}</span>
              </button>

              <button 
                type="button"
                onClick={abrirModalCrear} 
                className="flex-1 sm:flex-none bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 font-extrabold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-2xs text-sm whitespace-nowrap cursor-pointer"
              >
                <FaPlus size={13} /> Nuevo Producto
              </button>
            </div>
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

      {/* BARRA DE FILTROS: PROVEEDOR + SOLO STOCK BAJO */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-[0_4px_18px_rgba(15,23,42,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <FaTruck className="text-emerald-700" size={13} />
            <span>Proveedor:</span>
          </div>

          <select
            value={filtroProveedor}
            onChange={(e) => {
              setFiltroProveedor(e.target.value);
              setLimiteVisible(BLOQUE_CARGA);
            }}
            className="w-full sm:w-72 px-3.5 py-2 bg-slate-50/80 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-sm font-semibold text-slate-800 cursor-pointer"
          >
            <option value="TODOS">Todos los proveedores ({productos.length})</option>
            {sinProveedorCount > 0 && (
              <option value="SIN_PROVEEDOR">Sin proveedor asignado ({sinProveedorCount})</option>
            )}
            {proveedores.map(prov => {
              const cantidadProv = productos.filter(p => p.proveedorId === prov.id).length;
              return (
                <option key={prov.id} value={String(prov.id)}>
                  {prov.nombre} ({cantidadProv})
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSoloStockBajo(prev => !prev);
              setLimiteVisible(BLOQUE_CARGA);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 cursor-pointer ${
              soloStockBajo
                ? 'bg-red-50 text-red-700 border-red-300 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FaExclamationTriangle size={11} className={soloStockBajo ? 'text-red-600' : 'text-slate-400'} />
            <span>Solo Stock Bajo ({stockCriticoCount})</span>
          </button>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={() => {
                setFiltroProveedor('TODOS');
                setSoloStockBajo(false);
                setBusqueda('');
                setLimiteVisible(BLOQUE_CARGA);
              }}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FaTimes size={11} /> Limpiar
            </button>
          )}
        </div>
      </div>

      {/* LISTADO RESPONSIVE: TARJETAS EN CELULAR/TABLET (< 1024px) + TABLA EN ESCRITORIO (>= 1024px) */}
      <div className="lg:bg-white lg:border lg:border-slate-200/90 lg:rounded-2xl lg:shadow-[0_6px_28px_rgba(15,23,42,0.06)] overflow-hidden">
        
        {/* VISTA CELULAR (1 col) Y TABLET VERTICAL (2 cols) */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200/90 animate-pulse space-y-2.5">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                <div className="h-8 bg-slate-100 rounded-lg w-full"></div>
              </div>
            ))
          ) : productosFiltrados.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200/90 p-10 text-center text-slate-500 font-medium text-sm">
              {hayFiltrosActivos
                ? 'No se encontraron productos con los filtros seleccionados.'
                : 'Aún no hay productos registrados en el catálogo.'}
            </div>
          ) : (
            productosVisibles.map((prod) => {
              const esStockBajo = prod.stock <= (prod.stockMinimo || 5);
              return (
                <div key={prod.id} className={`p-4 space-y-3 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col justify-between ${prod.estado ? 'bg-white' : 'opacity-55 bg-slate-50/70'}`}>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={prod.nombre}>
                          {prod.nombre}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="font-mono text-[11px] font-semibold text-slate-500">{prod.codigo}</span>
                          {prod.categoria && (
                            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                              {prod.categoria}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${
                        esStockBajo 
                          ? 'bg-red-50 text-red-700 border-red-200' 
                          : 'bg-verde-pastel/35 text-emerald-900 border-emerald-200'
                      }`}>
                        {prod.stock} un.
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-50/90 px-3 py-2 rounded-xl border border-slate-100 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-400 font-semibold block">Proveedor</span>
                        <span className="text-slate-700 font-semibold truncate block" title={prod.proveedor?.nombre || ''}>
                          {prod.proveedor?.nombre || 'Sin asignar'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <span className="text-slate-400 font-semibold block">Compra</span>
                          <span className="font-mono font-semibold text-slate-600">
                            {prod.precioCompra ? `S/ ${prod.precioCompra.toFixed(2)}` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-semibold block">Venta</span>
                          <span className="font-mono font-extrabold text-slate-900 text-sm">
                            S/ {prod.precioVenta.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button 
                      type="button"
                      onClick={() => setBarcodeView(prod)} 
                      className="p-2 text-slate-600 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg cursor-pointer" 
                      title="Ver Código"
                    >
                      <FaBarcode size={14} />
                    </button>
                    {prod.estado && (
                      <>
                        {isAdmin && (
                          <button 
                            type="button"
                            onClick={() => abrirModalEditar(prod)} 
                            className="p-2 text-amber-600 bg-white hover:bg-amber-50 border border-slate-200/80 rounded-lg cursor-pointer" 
                            title="Editar Producto"
                          >
                            <FaEdit size={14} />
                          </button>
                        )}
                        <button 
                          type="button"
                          onClick={() => setStockProduct(prod)} 
                          className="p-2 text-emerald-700 bg-white hover:bg-verde-pastel/30 border border-slate-200/80 rounded-lg cursor-pointer" 
                          title="Actualizar Stock"
                        >
                          <FaBox size={14} />
                        </button>
                      </>
                    )}
                    {isAdmin && (
                      <button 
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => prepararToggleEstado(prod)}
                        className={`p-2 bg-white border border-slate-200/80 rounded-lg cursor-pointer disabled:opacity-40 ${
                          prod.estado ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={prod.estado ? 'Descontinuar Producto' : 'Reactivar Producto'}
                      >
                        {prod.estado ? <FaTimes size={14} /> : <FaCheck size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* VISTA ESCRITORIO (>= 1024px): Tabla completa */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[740px]">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3.5 px-4 xl:px-5 whitespace-nowrap">Código</th>
                <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap">Producto / Categoría</th>
                <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap">Proveedor</th>
                <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap text-right">Costo Compra</th>
                <th className="py-3.5 px-3 xl:px-4 whitespace-nowrap text-right">Precio Venta</th>
                <th className="py-3.5 px-3 xl:px-4 text-center whitespace-nowrap">Existencias</th>
                <th className="py-3.5 px-4 xl:px-5 text-center whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {isLoading ? (
                [...Array(5)].map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-44"></div></td>
                    <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
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
                    {hayFiltrosActivos
                      ? 'No se encontraron productos con los filtros seleccionados.'
                      : 'Aún no hay productos registrados en el catálogo.'}
                  </td>
                </tr>
              ) : (
                productosVisibles.map((prod) => {
                  const esStockBajo = prod.stock <= (prod.stockMinimo || 5);
                  return (
                    <tr key={prod.id} className={`transition-colors ${prod.estado ? 'hover:bg-slate-50/80' : 'opacity-55 bg-slate-50/60'}`}>
                      <td className="py-3.5 px-4 xl:px-5 font-mono text-xs font-semibold text-slate-600 align-middle whitespace-nowrap">
                        {prod.codigo}
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 align-middle max-w-[200px] lg:max-w-[250px] xl:max-w-[300px]">
                        <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-snug" title={prod.nombre}>
                          {prod.nombre}
                        </p>
                        {prod.categoria && (
                          <span className="inline-block text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-0.5 max-w-full truncate">
                            {prod.categoria}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 text-slate-600 font-medium align-middle max-w-[140px] xl:max-w-[180px]">
                        <span className="block truncate" title={prod.proveedor?.nombre || ''}>
                          {prod.proveedor?.nombre || <span className="text-slate-400 text-xs">Sin asignar</span>}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 text-right font-mono text-slate-600 font-medium align-middle whitespace-nowrap">
                        {prod.precioCompra ? `S/ ${prod.precioCompra.toFixed(2)}` : '-'}
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 text-right font-mono text-slate-900 font-extrabold text-sm xl:text-base align-middle whitespace-nowrap">
                        S/ {prod.precioVenta.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 xl:px-4 text-center align-middle whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          esStockBajo 
                            ? 'bg-red-50 text-red-700 border-red-200' 
                            : 'bg-verde-pastel/35 text-emerald-900 border-emerald-200'
                        }`}>
                          {prod.stock} un.
                        </span>
                      </td>
                      <td className="py-3.5 px-4 xl:px-5 align-middle whitespace-nowrap">
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
                                  onClick={() => abrirModalEditar(prod)} 
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
                              disabled={isSubmitting}
                              onClick={() => prepararToggleEstado(prod)}
                              className={`p-2 bg-white border border-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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

        {/* PIE DE PAGINACIÓN PROGRESIVA CENTRADO Y CON ESPACIO (30 EN 30) */}
        {!isLoading && productosFiltrados.length > 0 && (
          <div className="mt-4 lg:mt-0 px-5 py-5 bg-white lg:bg-slate-50/80 border border-slate-200/90 lg:border-0 lg:border-t lg:border-slate-100 rounded-2xl lg:rounded-none shadow-2xs lg:shadow-none flex flex-col items-center justify-center gap-3 text-center">
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Mostrando <strong className="text-slate-800">{productosVisibles.length}</strong> de{' '}
              <strong className="text-slate-800">{productosFiltrados.length}</strong> producto(s)
              {hayFiltrosActivos ? ' filtrados' : ''}
            </p>

            {restantesPorCargar > 0 && (
              <button
                type="button"
                onClick={() => setLimiteVisible(prev => prev + BLOQUE_CARGA)}
                className="inline-flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold text-emerald-950 bg-verde-pastel hover:bg-[#86e6bb] px-6 py-2.5 rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                <FaChevronDown size={12} />
                <span>
                  Cargar {Math.min(BLOQUE_CARGA, restantesPorCargar)} producto{Math.min(BLOQUE_CARGA, restantesPorCargar) === 1 ? '' : 's'} más
                </span>
              </button>
            )}
          </div>
        )}
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
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setConfirmDialog(null)}
                  className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-100 transition-colors text-sm disabled:opacity-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={ejecutarToggleEstado}
                  className={`flex-1 py-2.5 rounded-xl font-extrabold transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                    confirmDialog.estado ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950'
                  }`}
                >
                  {isSubmitting ? 'Procesando...' : 'Confirmar'}
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
                <button 
                  type="button" 
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setOrigenAutocompletado(null);
                  }} 
                  className="text-slate-400 hover:text-slate-700 p-1 transition-colors"
                >
                  <FaTimes size={18}/>
                </button>
              </div>
              
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                  
                  {/* SECCIÓN DE CÓDIGO DE BARRAS CON DETECTOR DE INVENTARIO Y CATÁLOGO GLOBAL */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Código de Barras</label>
                      {origenAutocompletado === 'GLOBAL' && !productoCodigoEnInventario && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-verde-pastel/50 px-2.5 py-0.5 rounded-md">
                          <FaCheck size={10} /> Autocompletado del catálogo global
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input 
                        type="text" 
                        value={formData.codigo} 
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({ ...formData, codigo: val });
                          procesarCodigoEnFormulario(val.trim(), false);
                        }} 
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

                    {productoCodigoEnInventario ? (
                      <div className="mt-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-start gap-2 text-xs text-amber-900 font-semibold">
                          <FaExclamationTriangle className="text-amber-600 mt-0.5 shrink-0" size={13} />
                          <span>
                            Este código ya está en tu inventario como <strong>{productoCodigoEnInventario.nombre}</strong> (Stock: {productoCodigoEnInventario.stock} un.).
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreateModalOpen(false);
                            setStockProduct(productoCodigoEnInventario);
                          }}
                          className="text-xs font-extrabold text-emerald-900 bg-verde-pastel hover:bg-[#86e6bb] px-3 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer"
                        >
                          Sumar Stock
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-500 mt-1.5">
                        Si el producto no trae código impreso, déjalo en blanco y el sistema le creará uno propio para tu bodega.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* CAMPO DE NOMBRE CON PLANTILLA PARA OTROS TAMAÑOS Y DETECTOR ANTI-DUPLICADOS */}
                    <div className="col-span-1 md:col-span-2 relative">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Nombre / Descripción del Producto *
                        </label>
                        {productosSimilaresPlantilla.length > 0 && !productoDuplicadoPorNombre && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-verde-pastel/45 px-2.5 py-0.5 rounded-md">
                            <FaCheck size={9} /> {productosSimilaresPlantilla.length} similar(es) en tu inventario
                          </span>
                        )}
                      </div>

                      <input 
                        type="text" 
                        required 
                        value={formData.nombre} 
                        onFocus={() => setShowSugerenciasNombre(true)}
                        onBlur={() => setTimeout(() => setShowSugerenciasNombre(false), 200)}
                        onChange={e => {
                          setFormData({ ...formData, nombre: e.target.value });
                          setShowSugerenciasNombre(true);
                        }} 
                        placeholder="Ej: Inka Cola 600 ml, Leche Gloria 180 ml..."
                        className={`w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border rounded-xl outline-none text-slate-900 text-sm transition-all font-medium ${
                          productoDuplicadoPorNombre 
                            ? 'border-amber-400 focus:border-amber-500 focus:ring-3 focus:ring-amber-200/50' 
                            : 'border-slate-200 focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30'
                        }`}
                      />

                      {/* Alerta en tiempo real si escribe un nombre equivalente ("gaseosa de 150ml" vs "gaseosa 150ml") */}
                      {productoDuplicadoPorNombre && (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900 font-semibold">
                          <span className="flex items-center gap-2">
                            <FaExclamationTriangle className="text-amber-600 shrink-0" size={13} />
                            Ya tienes registrado este producto como &quot;<strong>{productoDuplicadoPorNombre.nombre}</strong>&quot; (Stock: {productoDuplicadoPorNombre.stock} un.). Si es otra presentación, cámbiale el tamaño o medida.
                          </span>
                        </div>
                      )}

                      {/* Lista desplegable para usar un producto existente como plantilla (ej. cambiar solo el tamaño) */}
                      <AnimatePresence>
                        {showSugerenciasNombre && productosSimilaresPlantilla.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-[0_12px_32px_rgba(15,23,42,0.14)] overflow-hidden"
                          >
                            <div className="px-3.5 py-2 bg-verde-pastel/35 border-b border-emerald-200/70 flex items-center justify-between">
                              <span className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wider">
                                Productos que ya están en tu inventario
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-800">
                                Clic para autocompletar base y cambiar tamaño
                              </span>
                            </div>
                            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
                              {productosSimilaresPlantilla.map(prod => (
                                <div
                                  key={prod.id}
                                  onMouseDown={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      // Conservamos intacto prev.codigo por si ya lo escaneó
                                      nombre: prod.nombre,
                                      categoria: prod.categoria || prev.categoria,
                                      proveedorId: prod.proveedorId || prev.proveedorId
                                    }));
                                    setShowSugerenciasNombre(false);
                                    toast.success('Base autocompletada. Ahora solo ajusta el tamaño o medida en el nombre.');
                                  }}
                                  className="px-3.5 py-2.5 hover:bg-verde-pastel/20 cursor-pointer flex items-center justify-between transition-colors"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">{prod.nombre}</p>
                                    <p className="text-xs text-slate-500">
                                      {prod.categoria || 'Sin categoría'} • Proveedor: {prod.proveedor?.nombre || 'Sin asignar'}
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                                    Usar plantilla
                                  </span>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoría</label>
                      <SelectorCategoria
                        categorias={listaCategoriasUnificadas}
                        valorActual={formData.categoria}
                        onChange={(cat) => setFormData({ ...formData, categoria: cat })}
                      />
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Costo de Compra Unit. (S/)</label>
                        {autoMargenActivo && modoPrecioCrear === 'venta' && formData.precioCompra && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-verde-pastel/45 px-1.5 py-0.5 rounded">
                            Auto (-{porcentajeGanancia}%)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.precioCompra}
                        onChange={e => handleCambioCompraCrear(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Precio de Venta al Público (S/) *</label>
                        {autoMargenActivo && modoPrecioCrear === 'compra' && formData.precioVenta && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-verde-pastel/45 px-2 py-0.5 rounded">
                            Sugerido +{porcentajeGanancia}% (editable)
                          </span>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={formData.precioVenta}
                        onChange={e => handleCambioVentaCrear(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-emerald-700 font-extrabold text-lg transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setOrigenAutocompletado(null);
                    }} 
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={Boolean(productoCodigoEnInventario) || isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Agregar'}
                  </button>
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
                    <p className="text-xs text-slate-500 font-medium">Actualiza el código de barras, precios, categoría o proveedor del producto.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><FaTimes size={18}/></button>
              </div>

              <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0">
                <div className="overflow-y-auto p-6 flex-1 bg-white space-y-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">

                  {/* SECCIÓN PARA ESCANEAR O REEMPLAZAR EL CÓDIGO DE BARRAS */}
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Código de Barras
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input 
                        type="text" 
                        value={editingProduct.codigo || ''} 
                        onChange={e => setEditingProduct({...editingProduct, codigo: e.target.value})} 
                        className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 font-mono text-sm font-semibold" 
                        placeholder="Código del producto"
                      />
                      <button 
                        type="button" 
                        onClick={() => setScannerTarget('editar')} 
                        className="w-full sm:w-auto px-4 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                      >
                        <FaCamera /> Escanear Nuevo
                      </button>
                    </div>

                    {productos.some(
                      p => p.id !== editingProduct.id && p.codigo.toLowerCase() === (editingProduct.codigo || '').trim().toLowerCase()
                    ) ? (
                      <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900 font-semibold">
                        <FaExclamationTriangle className="text-amber-600 shrink-0" size={13} />
                        <span>Este código ya pertenece a otro producto registrado en tu inventario.</span>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-500 mt-1.5">
                        Si el producto tenía un código interno (AJ-) y ahora cuenta con código de barras en su empaque, puedes escanearlo aquí.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Nombre del Producto *</label>
                      <input type="text" required value={editingProduct.nombre} onChange={e => setEditingProduct({...editingProduct, nombre: e.target.value})} className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Categoría</label>
                      <SelectorCategoria
                        categorias={listaCategoriasUnificadas}
                        valorActual={editingProduct.categoria || ''}
                        onChange={(cat) => setEditingProduct({...editingProduct, categoria: cat})}
                      />
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
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Costo Unitario (S/)</label>
                        {autoMargenActivo && editingProduct.precioVenta > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModoPrecioEditar('ambos');
                              setEditingProduct(prev => ({ ...prev, precioCompra: redondearUnDecimal(prev.precioVenta / factorMargen) }));
                            }}
                            className="text-[10px] font-bold text-emerald-800 bg-verde-pastel/45 hover:bg-verde-pastel px-2 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            Calcular (-{porcentajeGanancia}%)
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingProduct.precioCompra ?? ''}
                        onChange={e => handleCambioCompraEditar(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-sm transition-all font-medium"
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Precio Unitario de Venta (S/) *</label>
                        {autoMargenActivo && editingProduct.precioCompra > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModoPrecioEditar('ambos');
                              setEditingProduct(prev => ({ ...prev, precioVenta: redondearUnDecimal(prev.precioCompra * factorMargen) }));
                            }}
                            className="text-[10px] font-bold text-emerald-800 bg-verde-pastel/45 hover:bg-verde-pastel px-2 py-0.5 rounded transition-colors cursor-pointer"
                          >
                            Calcular +{porcentajeGanancia}%
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={editingProduct.precioVenta ?? ''}
                        onChange={e => handleCambioVentaEditar(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-emerald-700 font-extrabold text-lg transition-all"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 shrink-0 flex flex-col sm:flex-row justify-end gap-2.5">
                  <button type="button" onClick={() => setEditingProduct(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer">Cancelar</button>
                  <button 
                    type="submit" 
                    disabled={
                      isSubmitting ||
                      productos.some(
                        p => p.id !== editingProduct.id && p.codigo.toLowerCase() === (editingProduct.codigo || '').trim().toLowerCase()
                      )
                    }
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
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
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm order-first sm:order-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Actualizando...' : 'Actualizar'}
                  </button>
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

      {/* MODAL 5: CONFIGURACIÓN DE PORCENTAJE DE GANANCIA AUTOMÁTICO */}
      <AnimatePresence>
        {isMargenModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4 bg-white border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-verde-pastel/40 text-emerald-800 flex items-center justify-center shrink-0">
                    <FaPercentage size={17} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Auto-ayuda de Precios</h3>
                    <p className="text-xs text-slate-500 font-medium">Configura el margen de ganancia de tu bodega.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMargenModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                >
                  <FaTimes size={18} />
                </button>
              </div>

              <form onSubmit={handleGuardarMargen} className="p-6 space-y-5 bg-white overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">                {/* Explicación clara para cualquier dueño de bodega */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed space-y-1.5">
                  <p className="font-bold text-slate-800">¿Para qué sirve esta herramienta?</p>
                  <p>
                    Al registrar o editar un producto, te ayuda a calcular precios al instante usando el porcentaje de ganancia con el que trabaja tu bodega:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-600">
                    <li>Si ingresas primero tu <strong>Costo de Compra</strong>, calcula y sugiere el <strong>Precio de Venta</strong>.</li>
                    <li>Si ingresas primero el <strong>Precio de Venta</strong>, calcula automáticamente tu <strong>Costo de Compra</strong>.</li>
                  </ul>
                  <p className="text-[11px] text-slate-500 pt-0.5">
                    El resultado se redondea a un decimal y siempre podrás editar cualquier precio manualmente.
                  </p>
                </div>

                {/* Interruptor Activar / Desactivar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Activar cálculo automático</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {formMargen.activo ? 'Activado para todos tus dispositivos' : 'Desactivado (ingreso manual libre)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formMargen.activo}
                    onClick={() => setFormMargen(prev => ({ ...prev, activo: !prev.activo }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                      formMargen.activo ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        formMargen.activo ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Campo de porcentaje con símbolo % fijo */}
                <div className={formMargen.activo ? 'opacity-100' : 'opacity-60'}>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    ¿Con qué porcentaje de ganancia trabaja tu bodega? {formMargen.activo ? '*' : ''}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="500"
                      disabled={!formMargen.activo}
                      required={formMargen.activo}
                      value={formMargen.porcentaje}
                      onChange={e => setFormMargen(prev => ({ ...prev, porcentaje: e.target.value }))}
                      placeholder="Ej: 20"
                      className="w-full pl-4 pr-12 py-2.5 bg-slate-50/70 focus:bg-white border border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-3 focus:ring-verde-pastel/30 outline-none text-slate-900 text-base font-extrabold font-mono disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-0 inset-y-0 px-4 flex items-center bg-slate-100 border-l border-slate-200 rounded-r-xl text-sm font-extrabold text-slate-600 select-none">
                      %
                    </span>
                  </div>
                  {formMargen.activo && (!formMargen.porcentaje || parseFloat(formMargen.porcentaje) <= 0) && (
                    <p className="text-[11px] font-semibold text-amber-700 mt-1.5">
                      Debes ingresar un porcentaje mayor a 0 para activar esta opción.
                    </p>
                  )}
                </div>

                {/* Ejemplo en vivo mientras el dueño escribe su porcentaje */}
                {formMargen.activo && parseFloat(formMargen.porcentaje) > 0 && (() => {
                  const pctEjemplo = parseFloat(formMargen.porcentaje);
                  const factorEjemplo = 1 + pctEjemplo / 100;
                  const ventaEjemplo = redondearUnDecimal(2.5 * factorEjemplo);
                  const compraInversa = redondearUnDecimal(parseFloat(ventaEjemplo) / factorEjemplo);
                  return (
                    <div className="p-3.5 bg-verde-pastel/25 border border-emerald-200/80 rounded-xl text-xs text-emerald-950 space-y-1">
                      <p className="font-extrabold text-emerald-900">
                        Ejemplo en vivo con {pctEjemplo}% de ganancia:
                      </p>
                      <p>
                        • Si compras a <strong>S/ 2.50</strong> → sugerirá vender a <strong>S/ {ventaEjemplo}</strong>.
                      </p>
                      <p>
                        • Si vendes a <strong>S/ {ventaEjemplo}</strong> → calculará tu compra en <strong>S/ {compraInversa}</strong>.
                      </p>
                    </div>
                  );
                })()}

                <div className="pt-2 border-t border-slate-100 flex justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsMargenModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (formMargen.activo && (!formMargen.porcentaje || parseFloat(formMargen.porcentaje) <= 0 || parseFloat(formMargen.porcentaje) > 500))
                    }
                    className="px-6 py-2.5 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-2xs text-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
}