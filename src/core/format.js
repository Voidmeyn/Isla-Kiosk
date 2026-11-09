
const peso = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


export const money = (n) => `₱ ${peso.format(n)}`;

export const negMoney = (n) => `-₱ ${peso.format(n)}`;

export const php = (n) => `Php ${Number.isInteger(n) ? n : peso.format(n)}`;

export const phpFixed = (n) => `Php ${peso.format(n)}`;


export function initials(name = '') {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name;


export function maskId(id = '') {
  const d = String(id);
  if (d.length <= 4) return d;
  return `${d.slice(0, 2)}${'*'.repeat(Math.max(3, d.length - 4)).slice(0, 3)}${d.slice(-2)}`;
}


export function shortDate(iso) {
  const d = new Date(iso);
  const m = d.toLocaleString('en-US', { month: 'short' });
  return `${m} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
