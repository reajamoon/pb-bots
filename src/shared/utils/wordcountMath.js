function getDelta(row) {
  if (!row) return 0;
  if (typeof row.delta === 'number' && Number.isFinite(row.delta)) return row.delta;
  const start = (typeof row.countStart === 'number' && Number.isFinite(row.countStart)) ? row.countStart : 0;
  const end = (typeof row.countEnd === 'number' && Number.isFinite(row.countEnd)) ? row.countEnd : 0;
  return end - start;
}

function sumNet(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  return rows.reduce((acc, r) => acc + getDelta(r), 0);
}

function sumPositive(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  return rows.reduce((acc, r) => {
    const d = getDelta(r);
    return acc + (d > 0 ? d : 0);
  }, 0);
}

function maxDelta(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  return rows.reduce((max, r) => {
    const d = getDelta(r);
    return d > max ? d : max;
  }, 0);
}

export {
  getDelta,
  sumNet,
  sumPositive,
  maxDelta,
};
