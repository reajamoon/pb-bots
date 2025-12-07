import sharp from 'sharp';

function svgEscape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderHunterCardPNG({ user, points, completed, narratives }) {
  const username = svgEscape(user.username);
  const badgeNo = svgEscape(String(user.id).slice(-6));
  // Show latest 12 completed hunts
  const completedItems = completed.slice(0, 12);
  const completedMore = completed.length > 12 ? completed.length - 12 : 0;
  const completedGroups = completedItems.length
    ? completedItems.map((c, idx) => {
        const y = 15 + idx * 24; // start below pill label
        const name = svgEscape(c);
        return `
          <g transform="translate(0, ${y})">
            <rect x="0" y="0" width="16" height="16" rx="2" fill="#ffffff" stroke="#7f1d1d" stroke-width="2"/>
            <path d="M3,8 l4,4 l8,-8" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <text x="24" y="14" font-family="'Segoe UI', Arial" font-size="18" fill="#0b1a2b">${name}</text>
          </g>
        `;
      }).join('')
    : '<text x="0" y="16" font-family="\'Segoe UI\', Arial" font-size="18" fill="#6b7280">None yet</text>';
  const completedMoreLine = completedItems.length && completedMore
    ? `<text x="24" y="${16 + completedItems.length * 24}" font-family="'Segoe UI', Arial" font-size="16" fill="#2f51b6">+${completedMore} more completed…</text>`
    : '';
  const avatarUrl = user.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true });
  const avatarUrlEsc = svgEscape(avatarUrl);
  let avatarHref = avatarUrlEsc;
  try {
    const res = await fetch(avatarUrl);
    if (res.ok) {
      const mime = res.headers.get('content-type') || 'image/png';
      const ab = await res.arrayBuffer();
      const base64 = Buffer.from(ab).toString('base64');
      avatarHref = `data:${mime};base64,${base64}`;
    }
  } catch {}

  const ongoingAll = narratives.filter(n => n.status !== 'completed');
  const ongoingMore = ongoingAll.length > 3 ? (ongoingAll.length - 3) : 0;
  // Show only non-completed narratives under Ongoing Hunts, capped at 3 lines
  const lines = ongoingAll.slice(0, 3).map((n, idx) => {
    const total = n.total ?? 0;
    const done = n.done ?? 0;
    const pct = total > 0 ? Math.min(1, done / total) : 0;
    const w = Math.round(320 * pct);
    const name = svgEscape(n.name);
    const y = 10 + idx * 28; // start below the pill label, with per-item spacing
    return `
      <g transform="translate(0, ${y})">
        <rect x="60" y="0" width="16" height="16" rx="2" fill="#ffffff" stroke="#374151" stroke-width="2"/>
        <text x="84" y="14" font-family="'Segoe UI', Arial" font-size="18" fill="#0b1a2b">${name} — ${done}/${total}</text>
        <rect x="84" y="18" width="320" height="10" rx="2" fill="#d1d5db"/>
        <rect x="84" y="18" width="${w}" height="10" rx="2" fill="#2f51b6"/>
      </g>
    `;
  }).join('');
  const ongoingMoreLine = ongoingMore
    ? `<text x="84" y="112" font-family="'Segoe UI', Arial" font-size="16" fill="#2f51b6">+${ongoingMore} more ongoing…</text>`
    : '';

  const scallops = Array.from({ length: 36 }).map((_, i) => {
    const angle = (i / 36) * Math.PI * 2;
    const cx = 500 + Math.cos(angle) * 380;
    const cy = 330 + Math.sin(angle) * 240;
    return `<circle cx="${cx}" cy="${cy}" r="16" fill="#cbe0ff" opacity="0.8"/>`;
  }).join('');

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="660">
    <defs>
      <clipPath id="avatarClip"><rect x="740" y="360" width="200" height="240" rx="8"/></clipPath>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0b1a2b" flood-opacity="0.35"/>
      </filter>
      <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#28407a"/>
        <stop offset="100%" stop-color="#1b2a55"/>
      </linearGradient>
      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff7c0"/>
        <stop offset="50%" stop-color="#e0b84e"/>
        <stop offset="100%" stop-color="#b8871a"/>
      </linearGradient>
      <clipPath id="ongoingClip"><rect x="0" y="-12" width="620" height="120"/></clipPath>
    </defs>
    <rect x="0" y="0" width="1000" height="660" rx="26" fill="#ffffff"/>
    <rect x="16" y="16" width="968" height="628" rx="22" fill="#e8eef7" stroke="#243b6b" stroke-width="3"/>
    <!-- Slot -->
    <rect x="460" y="24" width="88" height="18" rx="9" fill="#2f2f2f" filter="url(#shadow)"/>
    <!-- Scalloped border motif -->
    ${scallops}
    <rect x="70" y="52" width="860" height="80" rx="8" fill="url(#blueGrad)"/>
    <text x="500" y="104" font-family="Impact, 'Segoe UI', Arial" font-size="46" font-weight="700" fill="#ffffff" text-anchor="middle">DEPARTMENT OF INVESTIGATION</text>
    <!-- Photo -->
    <image href="${avatarHref}" x="740" y="360" width="200" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>
    <rect x="740" y="360" width="200" height="240" rx="8" fill="none" stroke="#2f51b6" stroke-width="4"/>
    <!-- Big FBI -->
    <text x="500" y="320" text-anchor="middle" font-family="Impact, 'Segoe UI', Arial" font-size="200" font-weight="900" fill="#0b1a2b">FBI</text>
    <!-- Certification text centered below FBI -->
    <text x="500" y="350" text-anchor="middle" font-family="'Segoe UI', Arial" font-size="20" fill="#0b1a2b">
      <tspan x="500" dy="0">THIS CERTIFIES THAT THE SIGNATURE</tspan>
      <tspan x="500" dy="20">AND PHOTOGRAPH HEREON IS AN APPOINTED</tspan>
    </text>

    <!-- Hunt Points chip-->
    <g transform="translate(703,259) rotate(17,125,55)" filter="url(#shadow)">
      <rect x="0" y="0" width="260" height="110" rx="18" fill="url(#goldGrad)"/>
      <rect x="0" y="0" width="260" height="110" rx="18" fill="none" stroke="#8a6a14" stroke-width="2" opacity="0.8"/>
      <text x="130" y="34" text-anchor="middle" font-family="Impact, 'Segoe UI', Arial" font-size="18" fill="#0f0f0dff" opacity="0.95">HUNT POINTS</text>
      <text x="130" y="82" text-anchor="middle" font-family="Impact, 'Segoe UI', Arial" font-size="56" font-weight="800" fill="#202236ff" filter="url(#innerShadow)">${points}</text>
    </g>

    <!-- Completed block: styled label + multi-line list with red-checked boxes;  -->
    <g transform="translate(50,180)">
      <rect x="0" y="-24" width="150" height="32" rx="16" fill="#8a6a14" opacity="0.9"/>
      <text x="75" y="-2" text-anchor="middle" font-family="Impact, 'Segoe UI', Arial" font-size="16" fill="#0f0f0d">COMPLETED</text>
      ${completedGroups}
      ${completedMoreLine}
    </g>

    <!-- Ongoing hunts raised and clipped to keep within area -->
    <g transform="translate(300,430)">
      <rect x="0" y="-30" width="200" height="32" rx="16" fill="#1b2a55" opacity="0.95"/>
      <text x="100" y="-8" text-anchor="middle" font-family="Impact, 'Segoe UI', Arial" font-size="18" fill="#ffffff">ONGOING HUNTS</text>
      <g clip-path="url(#ongoingClip)">
        ${lines}
      </g>
      ${ongoingMoreLine}
    </g>

    <!-- Bottom row: SPECIAL AGENT next to signature line, baseline-aligned -->
    <g>
      <text x="70" y="610" font-family="Impact, 'Segoe UI', Arial" font-size="24" fill="#2f51b6">SPECIAL AGENT</text>
      <line x1="220" y1="610" x2="960" y2="610" stroke="#0b1a2b" stroke-width="2"/>
      <text x="300" y="610" font-family="'Cedarville Cursive', 'Brush Script MT', 'Segoe Script', 'Comic Sans MS', cursive" font-size="40" fill="#243b6b" opacity="0.85" transform="skewX(-8)" dominant-baseline="alphabetic">${username}</text>
    </g>

    <!-- Footer agency line under Special Agent & signature; centered to the span from label start (x=70) to signature end (x=960) -->
    <text x="515" y="633" text-anchor="middle" font-family="'Segoe UI', Arial" font-size="18" fill="#2f51b6" textLength="890" lengthAdjust="spacing" style="letter-spacing:0.3px">OF THE PROFOUND BOND HUNTERS NETWORK, INTERNATIONAL DEPARTMENT OF BULLSHIT</text>
  </svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return png;
}
