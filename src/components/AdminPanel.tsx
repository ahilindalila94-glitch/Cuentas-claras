import React, { useState, useMemo } from 'react';
import { 
  User, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Mail, 
  FileText,
  TrendingUp,
  Briefcase,
  Layers,
  ArrowRight,
  Trash2
} from 'lucide-react';
import { ItemHistorial } from '../types';
import { formatCurrencyARS } from '../utils/formatters';

interface AdminPanelProps {
  historial: ItemHistorial[];
  onToggleFacturado: (id: string, currentStatus: boolean) => Promise<void>;
  onDeleteItem: (id: string) => void;
  onResetClient: (email: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  historial, 
  onToggleFacturado,
  onDeleteItem,
  onResetClient
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSendReminder = async (e: React.MouseEvent, email: string, pendingAmount: number) => {
    e.stopPropagation(); // Previene que se expanda/colapse la fila al hacer click en el botón
    setSendingEmail(prev => ({ ...prev, [email]: true }));
    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pendingAmount }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Recordatorio enviado a ${email}`);
        // Limpia el mensaje después de 5 segundos
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        alert(data.error || 'Ocurrió un error al enviar el recordatorio.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al intentar enviar el recordatorio.');
    } finally {
      setSendingEmail(prev => ({ ...prev, [email]: false }));
    }
  };

  // Group history by user_email
  const groupedClients = useMemo(() => {
    const clients: Record<string, {
      email: string;
      items: ItemHistorial[];
      totalAcumulado: number;
      totalFacturado: number;
      totalPendiente: number;
    }> = {};

    historial.forEach(item => {
      // If no user email is associated, attribute to "Cliente Invitado / Demo"
      const emailKey = item.user_email || 'cliente_invitado@contasimpl.com';
      
      if (!clients[emailKey]) {
        clients[emailKey] = {
          email: emailKey,
          items: [],
          totalAcumulado: 0,
          totalFacturado: 0,
          totalPendiente: 0
        };
      }

      const totalItem = item.resultado?.monto_total_acumulado || 0;
      clients[emailKey].items.push(item);
      clients[emailKey].totalAcumulado += totalItem;
      
      if (item.facturado) {
        clients[emailKey].totalFacturado += totalItem;
      } else {
        clients[emailKey].totalPendiente += totalItem;
      }
    });

    // Sort clients so the ones with more pending amount appear first
    return Object.values(clients).sort((a, b) => b.totalPendiente - a.totalPendiente);
  }, [historial]);

  // Filter grouped clients by search term
  const filteredClients = useMemo(() => {
    if (!searchTerm.trim()) return groupedClients;
    const term = searchTerm.toLowerCase();
    return groupedClients.filter(c => c.email.toLowerCase().includes(term));
  }, [groupedClients, searchTerm]);

  // Total Metrics for the admin
  const metrics = useMemo(() => {
    let totalGeneral = 0;
    let totalFacturado = 0;
    let totalPendiente = 0;
    let cantClientes = Object.keys(groupedClients).length;

    groupedClients.forEach(c => {
      totalGeneral += c.totalAcumulado;
      totalFacturado += c.totalFacturado;
      totalPendiente += c.totalPendiente;
    });

    return {
      totalGeneral,
      totalFacturado,
      totalPendiente,
      cantClientes
    };
  }, [groupedClients]);

  const toggleClientExpand = (email: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  const handleCheckboxChange = async (id: string, currentStatus: boolean) => {
    setUpdatingId(id);
    try {
      await onToggleFacturado(id, currentStatus);
    } catch (e) {
      console.error('Error actualizando facturación:', e);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold">
              {successMsg}
            </p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-500 hover:text-emerald-700 text-xs font-bold px-2 py-1"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Admin Title & Summary Cards */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 rounded-lg">
                Panel Contadora
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span className="text-xs text-slate-500 font-medium font-mono">Modo Administrador Activo</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Libro de Conciliación y Clientes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Administrá los extractos cargados por tus clientes, revisá montos pendientes y tildá como facturados.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por email del cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-purple-500 focus:bg-white text-xs font-semibold rounded-xl outline-hidden transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Clientes Totales</p>
              <h4 className="text-lg font-black text-slate-800 mt-0.5">{metrics.cantClientes}</h4>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Pendiente Facturar</p>
              <h4 className="text-lg font-black text-amber-700 mt-0.5">{formatCurrencyARS(metrics.totalPendiente)}</h4>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Facturado General</p>
              <h4 className="text-lg font-black text-emerald-700 mt-0.5">{formatCurrencyARS(metrics.totalFacturado)}</h4>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Acumulado</p>
              <h4 className="text-lg font-black text-slate-800 mt-0.5">{formatCurrencyARS(metrics.totalGeneral)}</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Clients Row Level Security Display */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
            <Mail className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No se encontraron clientes registrados</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cuando tus clientes inicien sesión y carguen extractos, aparecerán aquí agrupados con sus montos acumulados en tiempo real.
            </p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const isExpanded = !!expandedClients[client.email];
            return (
              <div 
                key={client.email}
                className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300/80 shadow-xs overflow-hidden transition-all"
              >
                {/* Client Header Card */}
                <div 
                  onClick={() => toggleClientExpand(client.email)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug break-all">
                        {client.email}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                          {client.items.length} extracto(s) cargado(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right space-y-0.5">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Pendiente</p>
                      <p className={`text-sm sm:text-base font-black ${client.totalPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {client.totalPendiente > 0 ? formatCurrencyARS(client.totalPendiente) : 'Todo al día ✓'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id={`btn-remind-${client.email}`}
                        onClick={(e) => handleSendReminder(e, client.email, client.totalPendiente)}
                        disabled={sendingEmail[client.email]}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:bg-slate-100 disabled:text-slate-400 border border-purple-200/60 rounded-xl text-[10px] font-extrabold tracking-wide flex items-center gap-1 transition-all shadow-3xs active:scale-95"
                        title="Enviar correo recordatorio de carga"
                      >
                        {sendingEmail[client.email] ? (
                          <>
                            <span className="w-3 h-3 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin shrink-0"></span>
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <>
                            <span>Enviar Recordatorio ✉️</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`¿Desea resetear todos los comprobantes del cliente ${client.email}? Se eliminarán definitivamente.`)) {
                            onResetClient(client.email);
                          }
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-[10px] font-extrabold tracking-wide flex items-center gap-1 transition-all shadow-3xs active:scale-95"
                        title="Eliminar y resetear todos los comprobantes de este cliente"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        <span>Resetear Cliente 🗑️</span>
                      </button>

                      <div className="text-right hidden md:block">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Acumulado</p>
                        <p className="text-xs font-semibold text-slate-600">{formatCurrencyARS(client.totalAcumulado)}</p>
                      </div>

                      <div className="p-1 rounded-lg bg-slate-100 text-slate-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Client Items list */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/30 p-5 space-y-3.5">
                    <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" />
                      <span>Desglose de Extractos Analizados</span>
                    </h4>

                    <div className="grid grid-cols-1 gap-3">
                      {client.items.map((item, index) => (
                        <div 
                          key={`${item.id || 'admin-item'}-${index}`}
                          className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs transition-all"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                                {item.resultado?.origen_billetera || 'Billetera'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Período: {item.resultado?.fecha_periodo || 'N/A'}
                              </span>
                            </div>
                            <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 break-all">
                              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{item.nombreArchivo}</span>
                            </h5>
                            <p className="text-[10px] text-slate-400">
                              Analizado el: {new Date(item.fechaAnalisis).toLocaleDateString('es-AR')}
                            </p>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                            <div className="text-left md:text-right">
                              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Monto del extracto</p>
                              <p className="text-sm font-black text-slate-800">
                                {formatCurrencyARS(item.resultado?.monto_total_acumulado || 0)}
                              </p>
                            </div>

                            {/* Billing Checkbox / Switch & Delete Icon */}
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                                <span className={`text-[10px] font-extrabold uppercase tracking-wide ${
                                  item.facturado ? 'text-emerald-700' : 'text-amber-700'
                                }`}>
                                  {item.facturado ? 'Facturado' : 'Pendiente'}
                                </span>
                                <label className="relative inline-flex items-center cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!item.facturado}
                                    disabled={updatingId === item.id}
                                    onChange={() => handleCheckboxChange(item.id, !!item.facturado)}
                                    className="sr-only peer"
                                  />
                                  <div className="w-9 h-5 bg-slate-200 hover:bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                </label>
                              </div>

                              <button
                                onClick={() => {
                                  if (window.confirm('¿Desea eliminar este comprobante individual?')) {
                                    onDeleteItem(item.id);
                                  }
                                }}
                                className="p-2 bg-rose-50/50 hover:bg-rose-50 rounded-xl text-rose-500 hover:text-rose-700 border border-rose-100 hover:border-rose-200 transition-all active:scale-95 shrink-0"
                                title="Eliminar este comprobante individual"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
