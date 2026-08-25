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
  Layers,
  Trash2,
  CreditCard,
  Receipt,
  ShoppingBag,
  Sparkles,
  Filter,
  RefreshCw,
  Building2,
  UserCheck,
  AlertCircle,
  FileCheck,
  Plus
} from 'lucide-react';
import { ItemHistorial, RegisteredClient, FacturaArca } from '../types';
import { formatCurrencyARS } from '../utils/formatters';
import { SubirFacturaArcaModal } from './SubirFacturaArcaModal';
import { FacturasArcaList } from './FacturasArcaList';

interface AdminPanelProps {
  historial: ItemHistorial[];
  registeredClients?: RegisteredClient[];
  facturasArca?: FacturaArca[];
  onToggleFacturado: (id: string, currentStatus: boolean) => Promise<void>;
  onDeleteItem: (id: string) => void;
  onResetClient: (email: string) => void;
  onRefresh?: () => void;
  onSaveFacturaArca?: (facturaData: Partial<FacturaArca>, markPendingAsFacturado?: boolean) => Promise<void>;
  onDeleteFacturaArca?: (id: string) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  historial,
  registeredClients = [],
  facturasArca = [],
  onToggleFacturado,
  onDeleteItem,
  onResetClient,
  onRefresh,
  onSaveFacturaArca,
  onDeleteFacturaArca,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendientes' | 'al_dia' | 'cupones' | 'lotes' | 'manuales' | 'arca'>('todos');
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<Record<string, boolean>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedClientForArca, setSelectedClientForArca] = useState<{
    email: string;
    nombre_comercio?: string;
    cuit?: string;
    pendingAmount?: number;
  } | null>(null);

  const handleManualRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const handleOpenArcaModal = (e: React.MouseEvent, client: { email: string; nombre_comercio?: string; cuit?: string; totalPendiente?: number }) => {
    e.stopPropagation();
    setSelectedClientForArca({
      email: client.email,
      nombre_comercio: client.nombre_comercio,
      cuit: client.cuit,
      pendingAmount: client.totalPendiente || 0,
    });
  };

  const handleSaveArcaSubmit = async (facturaData: Partial<FacturaArca>, markPending?: boolean) => {
    if (onSaveFacturaArca) {
      await onSaveFacturaArca(facturaData, markPending);
      setSuccessMsg(`Factura ARCA subida con éxito para ${facturaData.client_email}. ¡El cliente ya puede descargarla desde su perfil!`);
      setTimeout(() => setSuccessMsg(null), 6000);
    }
  };

  const handleSendReminder = async (e: React.MouseEvent, email: string, pendingAmount: number) => {
    e.stopPropagation();
    setSendingEmail((prev) => ({ ...prev, [email]: true }));
    try {
      const response = await fetch('/api/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pendingAmount }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSuccessMsg(`Recordatorio enviado con éxito a ${email}`);
        setTimeout(() => setSuccessMsg(null), 5000);
      } else {
        alert(data.error || 'Ocurrió un error al enviar el recordatorio.');
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al intentar enviar el recordatorio.');
    } finally {
      setSendingEmail((prev) => ({ ...prev, [email]: false }));
    }
  };

  // Group history by user_email AND include all registered clients even if they have 0 receipts
  const groupedClients = useMemo(() => {
    const clients: Record<
      string,
      {
        email: string;
        nombre_comercio?: string;
        cuit?: string;
        created_at?: string;
        items: ItemHistorial[];
        facturasArca: FacturaArca[];
        totalAcumulado: number;
        totalFacturado: number;
        totalPendiente: number;
        totalCupones: number;
        totalLotes: number;
      }
    > = {};

    // 1. Seed with registered clients (excluding accountant admin)
    registeredClients.forEach((rc) => {
      const emailKey = rc.email?.toLowerCase().trim();
      if (!emailKey || emailKey === 'ahilindalila94@gmail.com') return;

      clients[emailKey] = {
        email: emailKey,
        nombre_comercio: rc.nombre_comercio,
        cuit: rc.cuit,
        created_at: rc.created_at || rc.last_active,
        items: [],
        facturasArca: [],
        totalAcumulado: 0,
        totalFacturado: 0,
        totalPendiente: 0,
        totalCupones: 0,
        totalLotes: 0,
      };
    });

    // 2. Attach items from historial
    historial.forEach((item) => {
      const emailKey = item.user_email?.toLowerCase().trim() || 'cliente_invitado@cuentasclaras.com';
      if (emailKey === 'ahilindalila94@gmail.com') return;

      if (!clients[emailKey]) {
        clients[emailKey] = {
          email: emailKey,
          items: [],
          facturasArca: [],
          totalAcumulado: 0,
          totalFacturado: 0,
          totalPendiente: 0,
          totalCupones: 0,
          totalLotes: 0,
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

      const isCupon =
        item.resultado?.tipo_comprobante === 'cupon_individual' ||
        item.resultado?.detalle_movimientos?.some((m) => m.numero_cupon);
      const isLote =
        item.resultado?.tipo_comprobante === 'cierre_lote' ||
        item.resultado?.origen_billetera?.toLowerCase().includes('cierre de lote');

      if (isCupon) clients[emailKey].totalCupones += 1;
      if (isLote) clients[emailKey].totalLotes += 1;
    });

    // 3. Attach Facturas ARCA to respective clients
    facturasArca.forEach((f) => {
      const emailKey = f.client_email?.toLowerCase().trim();
      if (!emailKey || emailKey === 'ahilindalila94@gmail.com') return;

      if (!clients[emailKey]) {
        clients[emailKey] = {
          email: emailKey,
          items: [],
          facturasArca: [],
          totalAcumulado: 0,
          totalFacturado: 0,
          totalPendiente: 0,
          totalCupones: 0,
          totalLotes: 0,
        };
      }
      clients[emailKey].facturasArca.push(f);
    });

    return Object.values(clients).sort((a, b) => {
      // Prioritize clients with pending balance, then by total accumulated, then by email
      if (b.totalPendiente !== a.totalPendiente) {
        return b.totalPendiente - a.totalPendiente;
      }
      return b.totalAcumulado - a.totalAcumulado;
    });
  }, [historial, registeredClients, facturasArca]);

  // Filter grouped clients by search term and status/type filter
  const filteredClients = useMemo(() => {
    return groupedClients
      .map((c) => {
        const matchingItems = c.items.filter((item) => {
          if (statusFilter === 'todos' || statusFilter === 'pendientes' || statusFilter === 'al_dia') return true;
          const orig = (item.resultado?.origen_billetera || '').toLowerCase();
          const tipo = item.resultado?.tipo_comprobante || '';
          if (statusFilter === 'cupones')
            return tipo === 'cupon_individual' || item.resultado?.detalle_movimientos?.some((m) => m.numero_cupon);
          if (statusFilter === 'lotes') return tipo === 'cierre_lote' || orig.includes('cierre de lote');
          if (statusFilter === 'manuales')
            return tipo === 'factura_manual' || orig.includes('manual');
          if (statusFilter === 'arca') return true;
          return true;
        });

        return {
          ...c,
          filteredItems: matchingItems,
        };
      })
      .filter((c) => {
        const s = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !s ||
          c.email.toLowerCase().includes(s) ||
          (c.nombre_comercio && c.nombre_comercio.toLowerCase().includes(s)) ||
          (c.cuit && c.cuit.includes(s));

        if (!matchesSearch) return false;

        if (statusFilter === 'todos') return true;
        if (statusFilter === 'pendientes') return c.totalPendiente > 0;
        if (statusFilter === 'al_dia') return c.totalPendiente === 0;
        if (statusFilter === 'arca') return c.facturasArca.length > 0;
        
        // For specific type filters (cupones, lotes, manuales), client must have matching items
        return c.filteredItems.length > 0;
      });
  }, [groupedClients, searchTerm, statusFilter]);

  // Total Metrics for the admin
  const metrics = useMemo(() => {
    let totalGeneral = 0;
    let totalFacturado = 0;
    let totalPendiente = 0;
    const cantClientes = Math.max(
      groupedClients.length,
      registeredClients.filter((c) => c.email?.toLowerCase().trim() !== 'ahilindalila94@gmail.com').length
    );
    let cantClientesSinComprobantes = 0;

    groupedClients.forEach((c) => {
      totalGeneral += c.totalAcumulado;
      totalFacturado += c.totalFacturado;
      totalPendiente += c.totalPendiente;
      if (c.items.length === 0) {
        cantClientesSinComprobantes += 1;
      }
    });

    return {
      totalGeneral,
      totalFacturado,
      totalPendiente,
      cantClientes,
      cantClientesSinComprobantes,
      totalFacturasArca: facturasArca.length,
    };
  }, [groupedClients, registeredClients, facturasArca]);

  const toggleClientExpand = (email: string) => {
    setExpandedClients((prev) => ({
      ...prev,
      [email]: !prev[email],
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

  const getItemTypeBadge = (item: ItemHistorial) => {
    const orig = (item.resultado?.origen_billetera || '').toLowerCase();
    const tipo = item.resultado?.tipo_comprobante || '';
    if (tipo === 'cierre_lote' || orig.includes('cierre de lote')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200 flex items-center gap-1">
          <Receipt className="w-3 h-3" /> Cierre de Lote
        </span>
      );
    }
    if (tipo === 'cupon_individual' || item.resultado?.detalle_movimientos?.some((m) => m.numero_cupon)) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded-md border border-purple-200 flex items-center gap-1">
          <CreditCard className="w-3 h-3" /> Cupón POS / Tarjeta
        </span>
      );
    }
    if (tipo === 'factura_manual' || orig.includes('manual') || orig.includes('factura')) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-md border border-amber-200 flex items-center gap-1">
          <FileText className="w-3 h-3" /> Factura Manual
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
        {item.resultado?.origen_billetera || 'Comprobante'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-bold px-2 py-1 cursor-pointer"
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
              <span className="text-xs text-slate-500 font-medium font-mono">
                Visibilidad Total de Clientes & Comprobantes
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              Registro Integral de Clientes y Conciliación
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supervisá a todos los clientes registrados en la app, sus montos pendientes, cierres de lote y facturas cargadas.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search bar */}
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por email, comercio o CUIT..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9.5 pr-4 py-2 bg-slate-50 border border-slate-200 hover:border-slate-300 focus:border-purple-500 focus:bg-white text-xs font-semibold rounded-xl outline-hidden transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Refresh button */}
            {onRefresh && (
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="p-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl transition-all shadow-3xs flex items-center justify-center shrink-0 cursor-pointer"
                title="Actualizar clientes y comprobantes"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Global Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4.5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Clientes Registrados</p>
              <h4 className="text-lg font-black text-slate-800 mt-0.5">
                {metrics.cantClientes}{' '}
                {metrics.cantClientesSinComprobantes > 0 && (
                  <span className="text-xs font-semibold text-slate-400">
                    ({metrics.cantClientesSinComprobantes} nuevo{metrics.cantClientesSinComprobantes > 1 ? 's' : ''})
                  </span>
                )}
              </h4>
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
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total General</p>
              <h4 className="text-lg font-black text-slate-800 mt-0.5">{formatCurrencyARS(metrics.totalGeneral)}</h4>
            </div>
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar vista:
          </span>
          {[
            { id: 'todos', label: `Todos los Clientes (${metrics.cantClientes})` },
            { id: 'pendientes', label: '⏳ Con Pendientes' },
            { id: 'al_dia', label: '✓ Al Día / Nuevos' },
            { id: 'arca', label: `📄 Facturas ARCA (${metrics.totalFacturasArca || 0})` },
            { id: 'cupones', label: '💳 Cupones POS' },
            { id: 'lotes', label: '🧾 Cierres de Lote' },
            { id: 'manuales', label: '📝 Facturas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Clients Row Level Display */}
      <div className="space-y-4">
        {filteredClients.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800">No se encontraron clientes registrados</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Cuando un cliente cree su cuenta o cargue comprobantes, aparecerá automáticamente aquí en tu panel de contadora.
            </p>
          </div>
        ) : (
          filteredClients.map((client) => {
            const isExpanded = !!expandedClients[client.email];
            const itemsToShow = client.filteredItems || client.items;
            const hasZeroItems = client.items.length === 0;

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
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                      hasZeroItems 
                        ? 'bg-purple-50 text-purple-600 border-purple-200' 
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      <User className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xs sm:text-sm font-bold text-slate-800 leading-snug break-all">
                          {client.email}
                        </h3>
                        {client.nombre_comercio && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                            <Building2 className="w-2.5 h-2.5" /> {client.nombre_comercio}
                          </span>
                        )}
                        {client.cuit && (
                          <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-mono font-semibold">
                            CUIT: {client.cuit}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {hasZeroItems ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Nuevo Cliente Registrado (0 comprobantes)
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {client.items.length} comprobante(s)
                            </span>
                            {client.totalCupones > 0 && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                {client.totalCupones} cupón(es)
                              </span>
                            )}
                            {client.totalLotes > 0 && (
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                {client.totalLotes} lote(s)
                              </span>
                            )}
                          </>
                        )}

                        {(client.facturasArca || []).length > 0 && (
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <FileCheck className="w-3 h-3 text-emerald-600" />
                            {client.facturasArca.length} Factura(s) ARCA lista(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right space-y-0.5">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Pendiente</p>
                      <p
                        className={`text-sm sm:text-base font-black ${
                          client.totalPendiente > 0 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {client.totalPendiente > 0 
                          ? formatCurrencyARS(client.totalPendiente) 
                          : hasZeroItems 
                          ? '$0 (Sin carga)' 
                          : 'Todo al día ✓'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        id={`btn-upload-arca-${client.email}`}
                        type="button"
                        onClick={(e) => handleOpenArcaModal(e, client)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-extrabold tracking-wide flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                        title="Subir la Factura Oficial de ARCA emitida en PDF para que el cliente la descargue"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Subir Factura ARCA (PDF) 📄</span>
                      </button>

                      <button
                        id={`btn-remind-${client.email}`}
                        onClick={(e) => handleSendReminder(e, client.email, client.totalPendiente)}
                        disabled={sendingEmail[client.email]}
                        className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 disabled:bg-slate-100 disabled:text-slate-400 border border-purple-200/60 rounded-xl text-[10px] font-extrabold tracking-wide flex items-center gap-1 transition-all shadow-3xs active:scale-95 cursor-pointer"
                        title={hasZeroItems ? "Enviar recordatorio para que suba comprobantes" : "Enviar recordatorio de pendientes"}
                      >
                        {sendingEmail[client.email] ? (
                          <>
                            <span className="w-3 h-3 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin shrink-0"></span>
                            <span>Enviando...</span>
                          </>
                        ) : (
                          <span>Recordatorio ✉️</span>
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `¿Desea resetear o quitar al cliente ${client.email}? Se eliminarán sus registros.`
                            )
                          ) {
                            onResetClient(client.email);
                          }
                        }}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 rounded-xl text-[10px] font-extrabold tracking-wide flex items-center gap-1 transition-all shadow-3xs active:scale-95 cursor-pointer"
                        title="Eliminar y resetear todos los datos de este cliente"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        <span>Quitar 🗑️</span>
                      </button>

                      <div className="text-right hidden md:block">
                        <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">Acumulado</p>
                        <p className="text-xs font-semibold text-slate-600">
                          {formatCurrencyARS(client.totalAcumulado)}
                        </p>
                      </div>

                      <div className="p-1 rounded-lg bg-slate-100 text-slate-500">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Client Items list */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/40 p-5 space-y-6">
                    {/* ARCA Invoices Section for this Client */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-100 shadow-3xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">
                              Facturas Oficiales ARCA Emitidas ({(client.facturasArca || []).length})
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Archivos PDF que el cliente {client.email} visualiza y descarga directamente en su cuenta.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleOpenArcaModal(e, client)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-all shadow-3xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Subir Factura ARCA PDF</span>
                        </button>
                      </div>

                      <FacturasArcaList
                        facturas={client.facturasArca || []}
                        isAdmin={true}
                        onDeleteFactura={onDeleteFacturaArca}
                      />
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Comprobantes y Cierres de Lote de {client.email} ({itemsToShow.length})</span>
                      </h4>

                    {itemsToShow.length === 0 ? (
                      <div className="bg-white border border-dashed border-purple-200 rounded-xl p-6 text-center space-y-2">
                        <UserCheck className="w-6 h-6 text-purple-500 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">
                          Cliente registrado en la plataforma
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                          Este usuario creó su cuenta pero todavía no ha subido comprobantes, cupones o cierres de lote. Podés hacer clic en <strong>Enviar Recordatorio ✉️</strong> para solicitarle la carga del mes.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {itemsToShow.map((item, index) => {
                          const firstMov = item.resultado?.detalle_movimientos?.[0];
                          const isCupon =
                            item.resultado?.tipo_comprobante === 'cupon_individual' ||
                            firstMov?.numero_cupon ||
                            firstMov?.tarjeta;
                          const isLote =
                            item.resultado?.tipo_comprobante === 'cierre_lote' ||
                            (item.resultado?.origen_billetera || '').toLowerCase().includes('cierre de lote');

                          return (
                            <div
                              key={`${item.id || 'admin-item'}-${index}`}
                              className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs transition-all"
                            >
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  {getItemTypeBadge(item)}
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    Fecha / Período: {item.resultado?.fecha_periodo || 'N/A'}
                                  </span>
                                  {firstMov?.pagador_nombre_cuit && (
                                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">
                                      CUIT: {firstMov.pagador_nombre_cuit}
                                    </span>
                                  )}
                                </div>

                                <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 break-all">
                                  <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{item.nombreArchivo || firstMov?.concepto || 'Comprobante'}</span>
                                </h5>

                                {firstMov?.concepto && firstMov.concepto !== item.nombreArchivo && (
                                  <p className="text-[11px] text-slate-600 font-medium">
                                    Concepto: {firstMov.concepto}
                                  </p>
                                )}

                                {/* Specialized POS / Voucher information tags */}
                                {isCupon && (
                                  <div className="text-[11px] text-purple-900 bg-purple-50/80 px-2.5 py-1 rounded-lg border border-purple-100 flex flex-wrap items-center gap-2">
                                    <span>
                                      💳 Tarjeta: <strong>{firstMov?.tarjeta || 'POS / Terminal'}</strong>
                                    </span>
                                    {firstMov?.numero_cupon && (
                                      <>
                                        <span>•</span>
                                        <span>
                                          Cupón N°: <strong>{firstMov.numero_cupon}</strong>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                {isLote && (
                                  <div className="text-[11px] text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded-lg border border-indigo-100 flex flex-wrap items-center gap-2">
                                    <span>
                                      🧾 Lote N°: <strong>{firstMov?.numero_lote || 'N/A'}</strong>
                                    </span>
                                    {firstMov?.numero_terminal && (
                                      <>
                                        <span>•</span>
                                        <span>
                                          Terminal: <strong>{firstMov.numero_terminal}</strong>
                                        </span>
                                      </>
                                    )}
                                  </div>
                                )}

                                <p className="text-[10px] text-slate-400">
                                  Registrado el: {new Date(item.fechaAnalisis).toLocaleDateString('es-AR')}
                                </p>
                              </div>

                              <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                                <div className="text-left md:text-right">
                                  <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400">
                                    Monto del Comprobante
                                  </p>
                                  <p className="text-sm font-black text-slate-800">
                                    {formatCurrencyARS(item.resultado?.monto_total_acumulado || 0)}
                                  </p>
                                </div>

                                {/* Billing Checkbox / Switch & Delete Icon */}
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                                    <span
                                      className={`text-[10px] font-extrabold uppercase tracking-wide ${
                                        item.facturado ? 'text-emerald-700' : 'text-amber-700'
                                      }`}
                                    >
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
                                    className="p-2 bg-rose-50/50 hover:bg-rose-50 rounded-xl text-rose-500 hover:text-rose-700 border border-rose-100 hover:border-rose-200 transition-all active:scale-95 shrink-0 cursor-pointer"
                                    title="Eliminar este comprobante individual"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ARCA Invoice Upload Modal */}
      {selectedClientForArca && (
        <SubirFacturaArcaModal
          isOpen={true}
          clientEmail={selectedClientForArca.email}
          clientName={selectedClientForArca.nombre_comercio}
          clientCuit={selectedClientForArca.cuit}
          pendingAmount={selectedClientForArca.pendingAmount}
          onClose={() => setSelectedClientForArca(null)}
          onSave={handleSaveArcaSubmit}
          onSaveFactura={handleSaveArcaSubmit}
        />
      )}
    </div>
  );
};

