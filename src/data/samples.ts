import { PresetSample } from '../types';

export const SAMPLES: PresetSample[] = [
  {
    id: 'mp-transfer-1',
    titulo: 'Comprobante Mercado Pago (Transferencia Recibida)',
    entidad: 'Mercado Pago',
    tipo: 'comprobante_individual',
    descripcion: 'Comprobante digital típico de transferencia recibida vía CVU/Alias.',
    icono: 'Smartphone',
    datosEjemplo: {
      texto: `MERCADO PAGO
¡Recibiste una transferencia!
$ 48.750,00

De: Juan Ignacio Rossi
CUIT/CUIL: 20-38491029-4
Banco/Billetera: Banco Santander Río
CBU/CVU de origen: 0720000000000000000000
Motivo: Varios
Fecha de operación: 14 de Agosto de 2026 a las 10:42 hs.
Código de transferencia: #MP-98410294719`,
      resultadoSimulado: {
        origen_billetera: "Mercado Pago",
        fecha_periodo: "2026-08-14 10:42",
        monto_total_acumulado: 48750.00,
        detalle_movimientos: [
          {
            fecha: "2026-08-14 10:42",
            monto: 48750.00,
            pagador_nombre_cuit: "Juan Ignacio Rossi - CUIT 20-38491029-4"
          }
        ]
      }
    }
  },
  {
    id: 'nx-summary-2',
    titulo: 'Extracto Naranja X (Semanal de Cobros)',
    entidad: 'Naranja X',
    tipo: 'extracto_mensual',
    descripcion: 'Resumen de transferencias entrantes acumuladas en cuenta remunerada Naranja X.',
    icono: 'Zap',
    datosEjemplo: {
      texto: `NARANJA X - RESUMEN DE INGRESOS
Titular: María Sol Pereyra
Período: 01/08/2026 al 07/08/2026
Cuenta CVU: 0000003100094827103948

MOVIMIENTOS DE INGRESO:
- 01/08/2026 09:15 | Transferencia recibida de Roberto Gómez (CUIT 20-29182394-1) | +$ 32.500,00
- 03/08/2026 16:40 | Transferencia recibida de Distribuidora Norte SRL (CUIT 30-71829304-8) | +$ 115.000,00
- 05/08/2026 11:20 | Transferencia recibida de Lucas Mateo Benítez (CUIT 23-41092839-9) | +$ 18.200,00
- 07/08/2026 19:05 | Acreditación inmediata de Luciana Morales (CUIT 27-35918273-3) | +$ 44.300,00`,
      resultadoSimulado: {
        origen_billetera: "Naranja X",
        fecha_periodo: "2026-08-01 al 2026-08-07",
        monto_total_acumulado: 210000.00,
        detalle_movimientos: [
          {
            fecha: "2026-08-01 09:15",
            monto: 32500.00,
            pagador_nombre_cuit: "Roberto Gómez (CUIT 20-29182394-1)"
          },
          {
            fecha: "2026-08-03 16:40",
            monto: 115000.00,
            pagador_nombre_cuit: "Distribuidora Norte SRL (CUIT 30-71829304-8)"
          },
          {
            fecha: "2026-08-05 11:20",
            monto: 18200.00,
            pagador_nombre_cuit: "Lucas Mateo Benítez (CUIT 23-41092839-9)"
          },
          {
            fecha: "2026-08-07 19:05",
            monto: 44300.00,
            pagador_nombre_cuit: "Luciana Morales (CUIT 27-35918273-3)"
          }
        ]
      }
    }
  },
  {
    id: 'uala-transfer-3',
    titulo: 'Comprobante Ualá (Cobro Recibido)',
    entidad: 'Ualá',
    tipo: 'comprobante_individual',
    descripcion: 'Acreditación instantánea de transferencia vía CVU en Ualá.',
    icono: 'CreditCard',
    datosEjemplo: {
      texto: `Ualá Argentina
¡Te enviaron plata!
Monto recibido: $ 85.600,00
Emisor: SERVICIOS INTEGRALES DEL CENTRO S.A.
CUIT: 30-70982341-2
Fecha y hora: 18/08/2026 - 14:15:30
Concepto: FACTURA_B_0004-00019283
Nro de Operación: UAL-938201948`,
      resultadoSimulado: {
        origen_billetera: "Ualá",
        fecha_periodo: "2026-08-18 14:15",
        monto_total_acumulado: 85600.00,
        detalle_movimientos: [
          {
            fecha: "2026-08-18 14:15",
            monto: 85600.00,
            pagador_nombre_cuit: "SERVICIOS INTEGRALES DEL CENTRO S.A. - CUIT 30-70982341-2"
          }
        ]
      }
    }
  },
  {
    id: 'galicia-statement-4',
    titulo: 'Extracto Bancario Galicia (Créditos & Transferencias)',
    entidad: 'Banco Galicia',
    tipo: 'extracto_mensual',
    descripcion: 'Extracto de cuenta corriente bancaria con múltiples acreditaciones por transferencias 3.0 y CBU.',
    icono: 'Building2',
    datosEjemplo: {
      texto: `BANCO GALICIA S.A. - EXTRACTO DE CUENTA CORRIENTE EN PESOS
Nro Cuenta: 4001928-3 089-1 | Período: 01/08/2026 al 15/08/2026
Titular: ESTUDIO CONTABLE & ASOCIADOS SRL (CUIT 30-71625341-9)

DETALLE DE CRÉDITOS Y TRANSFERENCIAS RECIBIDAS:
02/08/2026 | CRED. TRANSF. INMEDIATA DE ESTEBAN QUITO CUIT 20-33445566-7 | +$ 150.000,00
06/08/2026 | TRANSF. INTERBANCARIA DE VALERIA SOSA CUIL 27-39201928-5 | +$ 67.400,00
09/08/2026 | COBRO TRANSF 3.0 QR PAGADOR NO IDENTIFICADO | +$ 28.950,00
12/08/2026 | CREDITO TRANSFERENCIA MPAGO - FEDERICO ALVAREZ CUIT 20-41829471-0 | +$ 94.000,00
15/08/2026 | ACREDITACION JUDICIAL / DEP. DE HONORARIOS DR. MARTIN FIERRO CUIT 20-18928374-1 | +$ 310.000,00`,
      resultadoSimulado: {
        origen_billetera: "Banco Galicia",
        fecha_periodo: "2026-08-01 al 2026-08-15",
        monto_total_acumulado: 650350.00,
        detalle_movimientos: [
          {
            fecha: "2026-08-02",
            monto: 150000.00,
            pagador_nombre_cuit: "ESTEBAN QUITO - CUIT 20-33445566-7"
          },
          {
            fecha: "2026-08-06",
            monto: 67400.00,
            pagador_nombre_cuit: "VALERIA SOSA - CUIL 27-39201928-5"
          },
          {
            fecha: "2026-08-09",
            monto: 28950.00,
            pagador_nombre_cuit: "No identificado (QR Pagador)"
          },
          {
            fecha: "2026-08-12",
            monto: 94000.00,
            pagador_nombre_cuit: "FEDERICO ALVAREZ - CUIT 20-41829471-0 (Mercado Pago)"
          },
          {
            fecha: "2026-08-15",
            monto: 310000.00,
            pagador_nombre_cuit: "DR. MARTIN FIERRO - CUIT 20-18928374-1"
          }
        ]
      }
    }
  }
];
