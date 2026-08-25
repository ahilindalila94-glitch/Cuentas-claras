export interface MovimientoDetalle {
  fecha: string;
  monto: number;
  pagador_nombre_cuit: string;
  concepto?: string;
  // Specialized voucher & batch closing metadata
  tipo_operacion?: 'cupon_individual' | 'cierre_lote' | 'transferencia' | 'extracto' | 'factura_manual';
  tarjeta?: string; // ej: Visa, Mastercard, Cabal, Amex
  tipo_tarjeta?: 'Crédito' | 'Débito' | 'Prepaga' | string;
  numero_cupon?: string;
  cuotas?: number;
  numero_lote?: string;
  numero_terminal?: string;
  cantidad_cupones?: number;
  es_consumidor_final?: boolean;
}

export interface ComprobanteResultado {
  origen_billetera: string;
  fecha_periodo: string;
  monto_total_acumulado: number;
  detalle_movimientos: MovimientoDetalle[];
  tipo_comprobante?: 'cupon_individual' | 'cierre_lote' | 'transferencia' | 'extracto' | 'factura_manual';
  info_lote?: {
    numero_lote?: string;
    numero_terminal?: string;
    cantidad_cupones?: number;
    monto_lote?: number;
  };
  info_cupon?: {
    tarjeta?: string;
    tipo_tarjeta?: string;
    numero_cupon?: string;
    cuotas?: number;
    monto?: number;
  };
}

export interface ItemHistorial {
  id: string;
  nombreArchivo: string;
  tamanoArchivo?: number;
  tipoMime: string;
  fechaAnalisis: string;
  resultado: ComprobanteResultado;
  previewUrl?: string;
  rawJson: string;
  user_id?: string | null;
  user_email?: string | null;
  facturado?: boolean;
}

export type UserRole = 'admin_contadora' | 'cliente';

export interface AppUser {
  id: string;
  email: string;
  role: UserRole;
  isLocalSession?: boolean;
  created_at?: string;
}

export interface PresetSample {
  id: string;
  titulo: string;
  entidad: string;
  tipo: string;
  descripcion: string;
  icono: string;
  datosEjemplo: {
    texto?: string;
    resultadoSimulado: ComprobanteResultado;
  };
}
