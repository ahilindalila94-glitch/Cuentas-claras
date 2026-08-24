import { ComprobanteResultado } from '../types';

export function formatCurrencyARS(amount: number): string {
  if (isNaN(amount)) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function exportToCSV(resultado: ComprobanteResultado, fileName = 'extracto_contable.csv') {
  const headers = ['Fecha', 'Billetera/Banco', 'Pagador / CUIT', 'Monto'];
  const rows = resultado.detalle_movimientos.map((m) => [
    `"${m.fecha}"`,
    `"${resultado.origen_billetera}"`,
    `"${m.pagador_nombre_cuit.replace(/"/g, '""')}"`,
    m.monto.toFixed(2),
  ]);

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows.map((r) => r.join(';')),
    ['', '', '"TOTAL ACUMULADO"', resultado.monto_total_acumulado.toFixed(2)].join(';')
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportCombinedToCSV(resultados: ComprobanteResultado[], fileName = 'libro_ingresos_combinado.csv') {
  const headers = ['Fecha', 'Origen Billetera / Banco', 'Período', 'Pagador / CUIT', 'Monto'];
  const rows: string[] = [];
  let granTotal = 0;

  resultados.forEach((res) => {
    res.detalle_movimientos.forEach((m) => {
      rows.push([
        `"${m.fecha}"`,
        `"${res.origen_billetera}"`,
        `"${res.fecha_periodo}"`,
        `"${m.pagador_nombre_cuit.replace(/"/g, '""')}"`,
        m.monto.toFixed(2),
      ].join(';'));
      granTotal += m.monto;
    });
  });

  const csvContent = '\uFEFF' + [
    headers.join(';'),
    ...rows,
    ['', '', '', '"GRAN TOTAL GENERAL"', granTotal.toFixed(2)].join(';')
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadJsonFile(data: any, fileName = 'resultado_comprobante.json') {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
