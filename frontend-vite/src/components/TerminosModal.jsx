import { motion, AnimatePresence } from 'framer-motion';
import { FaShieldAlt, FaCheck, FaTimes, FaFileContract } from 'react-icons/fa';

export default function TerminosModal({ 
  isOpen, 
  modoObligatorio = false, // true = muestra Aceptar/Rechazar | false = solo muestra Cerrar (modo lectura)
  onAccept, 
  onDecline, 
  onClose 
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="flex flex-col w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 font-sans"
          >
            {/* CABECERA CON FRANJA SUPERIOR VERDE PASTEL */}
            <div className="flex justify-between items-center p-5 sm:p-6 bg-slate-950 border-t-4 border-verde-pastel shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-verde-pastel/10 border border-verde-pastel/30 flex items-center justify-center text-verde-pastel shrink-0">
                  <FaFileContract size={20} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                    Términos y Condiciones de Uso
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Política de Privacidad y Normativa Legal del Sistema POS SaaS
                  </p>
                </div>
              </div>

              {!modoObligatorio && (
                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
                >
                  <FaTimes size={20} />
                </button>
              )}
            </div>

            {/* CUERPO DEL DOCUMENTO LEGAL (CON SCROLL) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-slate-700 text-sm leading-relaxed bg-white">
              
              {modoObligatorio && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs font-semibold flex items-start gap-3">
                  <FaShieldAlt className="text-emerald-600 text-lg shrink-0 mt-0.5" />
                  <p>
                    Bienvenido al sistema. Antes de acceder a las operaciones de tu negocio, es obligatorio leer y aceptar los presentes Términos y Condiciones de Uso y Privacidad.
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  1. Naturaleza del Servicio y Aislamiento Multi-Negocio (SaaS)
                </h3>
                <p>
                  La plataforma provee un sistema de Punto de Venta (POS) y gestión de inventario en la nube bajo arquitectura Multi-Inquilino (SaaS). Los productos, precios, proveedores, ventas y carteras de clientes registrados pertenecen exclusivamente a cada negocio afiliado y se mantienen lógicamente aislados.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  2. Protección de Datos Personales (Ley N° 29733 - Perú)
                </h3>
                <p>
                  En cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales del Perú), el usuario declara conocer y aceptar que los datos recolectados durante la operación comercial (números de DNI/RUC consultados mediante integración RENIEC/SUNAT, nombres, correos electrónicos para el envío de comprobantes y números telefónicos de WhatsApp para avisos de cobranza o fiados) se utilizan <strong>única y exclusivamente</strong> para la emisión de documentos tributarios y la gestión operativa autorizada por el propio negocio. Queda estrictamente prohibida su divulgación o comercialización a terceros.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  3. Emisión de Comprobantes Electrónicos (SUNAT / OSE / PSE)
                </h3>
                <p>
                  La emisión de Boletas de Venta y Facturas Electrónicas se realiza a través de las credenciales de integración API (Nubefact) configuradas por el titular del negocio. El administrador del establecimiento es el único responsable legal y tributario ante la SUNAT por la veracidad de su RUC, series, porcentajes de IGV y operaciones declaradas.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  4. Responsabilidad de Usuarios, Administradores y Ayudantes
                </h3>
                <p>
                  Las credenciales de acceso son personales e intransferibles. Toda venta, ajuste de inventario, registro de crédito ("fiado") o liquidación de deuda queda registrada en el historial del sistema asociada al usuario que ejecutó la operación. El usuario se compromete a hacer un uso ético, transparente y diligente de la plataforma.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  5. Procesamiento Automatizado y Asistencia con IA
                </h3>
                <p>
                  El sistema recopila métricas históricas de rotación de stock, abastecimiento y ventas dentro del propio negocio con el fin de generar reportes, alertas de stock mínimo y sugerencias inteligentes mediante módulos de Inteligencia Artificial para optimizar las compras del establecimiento.
                </p>
              </div>

              <div>
                <h3 className="font-extrabold text-slate-950 text-base mb-1">
                  6. Disponibilidad y Suspensión del Servicio
                </h3>
                <p>
                  El administrador general de la plataforma (`SUPER_ADMIN`) monitorea únicamente indicadores globales de operatividad (estado del negocio, cantidad de usuarios y volumen transaccional) sin alterar la contabilidad interna del comercio, reservándose el derecho de suspender el acceso ante incumplimientos de las condiciones comerciales o uso fraudulento del software.
                </p>
              </div>

            </div>

            {/* PIE DEL MODAL (BOTONES SEGÚN EL MODO) */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 shrink-0 flex flex-col sm:flex-row justify-end items-center gap-3">
              {modoObligatorio ? (
                <>
                  <button
                    type="button"
                    onClick={onDecline}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold text-slate-600 bg-white border border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <FaTimes size={14} /> Rechazar y Salir
                  </button>
                  <button
                    type="button"
                    onClick={onAccept}
                    className="w-full sm:w-auto px-6 py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-sm text-sm flex items-center justify-center gap-2 order-first sm:order-none"
                  >
                    <FaCheck size={14} /> Aceptar y Continuar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-8 py-3 bg-verde-pastel hover:bg-[#86e6bb] text-emerald-950 rounded-xl font-extrabold transition-all shadow-sm text-sm"
                >
                  Entendido
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}