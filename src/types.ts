export interface MovimientoDetalle {
  fecha: string;
  monto: number;
  pagador_nombre_cuit: string;
}

export interface ComprobanteResultado {
  origen_billetera: string;
  fecha_periodo: string;
  monto_total_acumulado: number;
  detalle_movimientos: MovimientoDetalle[];
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
  entidad: 'Mercado Pago' | 'Ualá' | 'Naranja X' | 'Banco Galicia' | 'Santander' | 'Cuenta DNI';
  tipo: 'comprobante_individual' | 'extracto_mensual' | 'texto_crudo';
  descripcion: string;
  icono: string;
  datosEjemplo: {
    texto?: string;
    resultadoSimulado: ComprobanteResultado;
  };
}
