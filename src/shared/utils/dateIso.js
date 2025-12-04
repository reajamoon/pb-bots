export function toIso(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  const mdy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/; // MM/DD/YYYY
  const ymd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/; // YYYY-MM-DD
  const md = /^(\d{1,2})\/(\d{1,2})$/; // MM/DD (privacy)
  if (mdy.test(s)) {
    const [, m, d, y] = s.match(mdy);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (ymd.test(s)) {
    const [, y, m, d] = s.match(ymd);
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (md.test(s)) {
    const [, m, d] = s.match(md);
    return `1900-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}