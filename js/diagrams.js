/**
 * Inline SVG diagrams (embedded — external .svg fails in <img> on GitHub Pages).
 */
(function (global) {
  "use strict";

  const FONT = 'font-family="Segoe UI, Arial, sans-serif"';

  const SYSTEM_ELEMENTS = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 300" width="520" height="300">
  <rect width="520" height="300" fill="#1a2332"/>
  <path d="M200 20 L260 20 L240 55 L220 55 Z" fill="#334155" stroke="#f59e0b"/>
  <text x="270" y="40" fill="#e2e8f0" font-size="13" ${FONT}>1. Воронка</text>
  <rect x="228" y="55" width="24" height="70" fill="#475569" stroke="#f59e0b"/>
  <text x="270" y="95" fill="#e2e8f0" font-size="13" ${FONT}>2. Стояк</text>
  <rect x="120" y="125" width="240" height="22" fill="#475569" stroke="#34d399"/>
  <text x="270" y="140" fill="#e2e8f0" font-size="13" ${FONT}>3. Коллектор</text>
  <rect x="160" y="147" width="16" height="35" fill="#64748b" stroke="#f59e0b"/>
  <rect x="252" y="147" width="16" height="35" fill="#64748b" stroke="#f59e0b"/>
  <text x="270" y="200" fill="#e2e8f0" font-size="13" ${FONT}>4. Питатель</text>
  <rect x="100" y="182" width="280" height="80" rx="4" fill="#243044" stroke="#94a3b8" stroke-dasharray="4"/>
  <text x="240" y="230" fill="#94a3b8" font-size="14" text-anchor="middle" ${FONT}>Отливка</text>
  <line x1="240" y1="20" x2="240" y2="182" stroke="#f59e0b" stroke-width="1.5"/>
  <polygon points="235,182 240,172 245,182" fill="#f59e0b"/>
</svg>`;

  const HEAD_SIDE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
  <rect width="480" height="320" fill="#1a2332"/>
  <rect x="40" y="30" width="400" height="260" fill="none" stroke="#475569" stroke-width="2"/>
  <line x1="40" y1="120" x2="440" y2="120" stroke="#64748b" stroke-dasharray="6"/>
  <text x="448" y="124" fill="#64748b" font-size="11" ${FONT}>разъём</text>
  <rect x="180" y="140" width="120" height="80" fill="#243044" stroke="#94a3b8"/>
  <line x1="60" y1="50" x2="60" y2="120" stroke="#f59e0b" stroke-width="2"/>
  <text x="68" y="88" fill="#f59e0b" font-size="14" font-weight="bold" ${FONT}>H&#8320;</text>
  <text x="68" y="104" fill="#94a3b8" font-size="10" ${FONT}>столб металла</text>
  <line x1="320" y1="140" x2="320" y2="220" stroke="#34d399" stroke-width="2"/>
  <text x="328" y="185" fill="#34d399" font-size="14" font-weight="bold" ${FONT}>C</text>
  <text x="328" y="201" fill="#94a3b8" font-size="10" ${FONT}>высота отливки</text>
  <line x1="380" y1="140" x2="380" y2="168" stroke="#60a5fa" stroke-width="2"/>
  <text x="388" y="158" fill="#60a5fa" font-size="14" font-weight="bold" ${FONT}>P</text>
  <text x="388" y="174" fill="#94a3b8" font-size="10" ${FONT}>до подвода</text>
  <rect x="230" y="120" width="20" height="20" fill="#64748b" stroke="#f59e0b"/>
  <text x="200" y="115" fill="#f59e0b" font-size="11" ${FONT}>питатель</text>
  <text x="40" y="300" fill="#e2e8f0" font-size="13" ${FONT}>Hr = H&#8320; &#8722; P &#8722; C/2</text>
</svg>`;

  const HEAD_TOP = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
  <rect width="480" height="320" fill="#1a2332"/>
  <rect x="40" y="30" width="400" height="260" fill="none" stroke="#475569" stroke-width="2"/>
  <rect x="160" y="100" width="160" height="120" fill="#243044" stroke="#94a3b8"/>
  <line x1="60" y1="50" x2="60" y2="220" stroke="#f59e0b" stroke-width="2"/>
  <text x="68" y="140" fill="#f59e0b" font-size="14" font-weight="bold" ${FONT}>H&#8320;</text>
  <rect x="230" y="80" width="20" height="20" fill="#64748b" stroke="#f59e0b"/>
  <text x="40" y="300" fill="#e2e8f0" font-size="13" ${FONT}>Hr = H&#8320;  (P = 0)</text>
</svg>`;

  const HEAD_SIPHON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
  <rect width="480" height="320" fill="#1a2332"/>
  <rect x="40" y="30" width="400" height="260" fill="none" stroke="#475569" stroke-width="2"/>
  <line x1="40" y1="120" x2="440" y2="120" stroke="#64748b" stroke-dasharray="6"/>
  <rect x="200" y="60" width="80" height="180" fill="#243044" stroke="#94a3b8"/>
  <line x1="60" y1="50" x2="60" y2="120" stroke="#f59e0b" stroke-width="2"/>
  <text x="68" y="88" fill="#f59e0b" font-size="14" font-weight="bold" ${FONT}>H&#8320;</text>
  <line x1="300" y1="120" x2="300" y2="240" stroke="#34d399" stroke-width="2"/>
  <text x="308" y="185" fill="#34d399" font-size="14" font-weight="bold" ${FONT}>C</text>
  <path d="M180 120 Q160 180 180 240" fill="none" stroke="#f59e0b" stroke-width="2"/>
  <text x="40" y="300" fill="#e2e8f0" font-size="13" ${FONT}>Hr = H&#8320; &#8722; C/2  (P = C)</text>
</svg>`;

  const HEAD_SYMMETRIC = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320" width="480" height="320">
  <rect width="480" height="320" fill="#1a2332"/>
  <rect x="40" y="30" width="400" height="260" fill="none" stroke="#475569" stroke-width="2"/>
  <line x1="40" y1="160" x2="440" y2="160" stroke="#64748b" stroke-dasharray="6"/>
  <rect x="180" y="120" width="120" height="80" fill="#243044" stroke="#94a3b8"/>
  <line x1="60" y1="50" x2="60" y2="160" stroke="#f59e0b" stroke-width="2"/>
  <text x="68" y="110" fill="#f59e0b" font-size="14" font-weight="bold" ${FONT}>H&#8320;</text>
  <line x1="320" y1="120" x2="320" y2="200" stroke="#34d399" stroke-width="2"/>
  <text x="328" y="165" fill="#34d399" font-size="14" font-weight="bold" ${FONT}>C</text>
  <text x="40" y="300" fill="#e2e8f0" font-size="13" ${FONT}>Hr = H&#8320; &#8722; C/8  (P = C/2)</text>
</svg>`;

  global.FoundryDiagrams = {
    system: SYSTEM_ELEMENTS,
    layouts: {
      side: HEAD_SIDE,
      top: HEAD_TOP,
      siphon: HEAD_SIPHON,
      symmetric: HEAD_SYMMETRIC,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
