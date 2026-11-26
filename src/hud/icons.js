// Hotbar tool icons as inline SVG (cartoon style, no outlines).

export const TRASH_ICON = `<svg viewBox="7 8 86 66" aria-hidden="true">
  <!-- crushed soda can -->
  <g transform="rotate(28 66 34)">
    <path d="M53 18 Q66 13 79 18 L80 31 Q75 35 80 40 L78 54 Q66 59 54 54 L53 41 Q58 36 52 31 Z" fill="#e8483a"/>
    <path d="M53 31 Q58 36 53 41 L55 42 Q60 36 55 30 Z M79 31 Q74 35 79 40 L77 41 Q72 35 77 30 Z" fill="#b92f26"/>
    <path d="M57 24 L75 22 M58 47 L74 49 M62 33 L71 38 M64 41 L70 35" stroke="#f47a6c" stroke-width="2.4" stroke-linecap="round" fill="none"/>
    <path d="M54 44 L78 46" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.75"/>
    <ellipse cx="66" cy="17" rx="13" ry="5.2" fill="#d4dade"/>
    <ellipse cx="66" cy="17" rx="10" ry="3.6" fill="#b5bec4"/>
    <ellipse cx="69" cy="16.5" rx="3.6" ry="1.8" fill="#5d686f"/>
  </g>
  <!-- crumpled paper -->
  <path d="M14 40 L19 27 L29 22 L38 25 L44 34 L42 46 L34 53 L22 52 L15 47 Z" fill="#f3f2ee"/>
  <path d="M19 27 L26 36 L38 25 M26 36 L22 52 M26 36 L42 46 M15 47 L26 36 M34 33 L44 34" stroke="#c6c5bf" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
  <path d="M29 22 L38 25 L34 33 Z M26 36 L34 53 L42 46 Z" fill="#dcdbd5"/>
  <!-- banana peel -->
  <path d="M46 52 Q40 63 22 66 Q12 67 10 64 Q22 63 33 58 Q41 53 44 47 Z" fill="#f6cf3a"/>
  <path d="M48 52 Q60 60 76 64 Q86 66 88 63 Q76 60 64 54 Q55 49 50 46 Z" fill="#f6cf3a"/>
  <path d="M47 50 Q46 62 38 70 Q50 64 52 52 Z" fill="#f2bc2a"/>
  <path d="M44 47 Q46 42 50 46 Q50 51 47 53 Q44 52 44 47 Z" fill="#d8a020"/>
  <path d="M10 64 Q11 61 14 63 Z M88 63 Q87 60 84 62 Z" fill="#6b4a1a" stroke="#6b4a1a" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M22 64 Q34 61 42 53 M64 57 Q74 62 82 63" stroke="#fbe27c" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`

// Peanut-shaped kitchen sponge: darker side underneath, pitted top.
const PEANUT = 'M18 30 C14 14 34 6 46 15 C52 20 56 20 64 16 C80 8 96 22 90 40 C86 54 70 58 60 50 C54 46 50 46 42 50 C28 58 12 50 14 38 C14 35 17 33 18 30 Z'
export const SPONGE_ICON = `<svg viewBox="0 0 104 76" aria-hidden="true">
  <g transform="rotate(10 52 36)">
    <path d="${PEANUT}" transform="translate(0 11)" fill="#ee9420"/>
    <path d="M14 38 L14 49 M90 40 L90 51" stroke="#ee9420" stroke-width="2" fill="none"/>
    <path d="${PEANUT}" fill="#fdb747"/>
    <path d="${PEANUT}" fill="url(#hbSpongeGlow)"/>
    <g fill="#f39a2c">
      <circle cx="28" cy="22" r="2.6"/><circle cx="38" cy="19" r="2"/><circle cx="24" cy="32" r="2.2"/>
      <circle cx="34" cy="29" r="3"/><circle cx="44" cy="26" r="2"/><circle cx="29" cy="42" r="2.4"/>
      <circle cx="40" cy="38" r="2"/><circle cx="20" cy="41" r="1.7"/><circle cx="52" cy="32" r="2.3"/>
      <circle cx="58" cy="25" r="1.8"/><circle cx="66" cy="21" r="2.6"/><circle cx="76" cy="19" r="2"/>
      <circle cx="84" cy="27" r="2.4"/><circle cx="72" cy="30" r="3"/><circle cx="62" cy="38" r="2.2"/>
      <circle cx="80" cy="38" r="2.6"/><circle cx="71" cy="45" r="2"/><circle cx="50" cy="42" r="1.7"/>
      <circle cx="86" cy="45" r="1.6"/><circle cx="36" cy="47" r="1.6"/>
    </g>
  </g>
  <defs>
    <radialGradient id="hbSpongeGlow" cx="0.4" cy="0.3" r="0.7">
      <stop offset="0" stop-color="#ffd36e" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#ffd36e" stop-opacity="0"/>
    </radialGradient>
  </defs>
</svg>`

// Raised open hand, fingers together, thumb out to the right.
export const HAND_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <g fill="#fcc430">
    <rect x="70" y="40" width="13" height="38" rx="6.5" transform="rotate(38 76 72)"/>
    <rect x="25" y="26" width="12" height="44" rx="6"/>
    <rect x="36" y="9" width="12.5" height="58" rx="6.25"/>
    <rect x="47.5" y="7" width="12.5" height="60" rx="6.25"/>
    <rect x="59" y="14" width="12" height="54" rx="6"/>
    <path d="M25 52 L71 52 L74 72 Q72 94 50 94 Q30 94 26 76 Z"/>
  </g>
  <path d="M36.5 34 L36.5 58 M48 22 L48 58 M59.5 26 L59.5 58" stroke="#eea12a" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <path d="M42 80 Q54 76 64 64" stroke="#eea12a" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`

// Upright vacuum: red body with a dust bag, grey nozzle, black handle.
export const VACUUM_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="55" y="6" width="8" height="40" rx="4" fill="#3b3b40" transform="rotate(14 59 26)"/>
  <rect x="50" y="3" width="20" height="9" rx="4.5" fill="#3b3b40" transform="rotate(14 60 7)"/>
  <path d="M38 34 Q52 28 60 36 L62 74 Q50 80 38 74 Z" fill="#e8473f"/>
  <path d="M42 40 Q52 36 57 42 L57 62 Q50 66 42 62 Z" fill="#ffd2a8"/>
  <path d="M44 46 H55 M44 52 H55 M44 58 H55" stroke="#e8a46d" stroke-width="2" stroke-linecap="round"/>
  <path d="M40 70 Q50 76 62 70" stroke="#b8302a" stroke-width="3" fill="none"/>
  <rect x="20" y="74" width="56" height="14" rx="7" fill="#8e9aa3"/>
  <rect x="22" y="84" width="52" height="5" rx="2.5" fill="#3b3b40"/>
  <circle cx="30" cy="90" r="5" fill="#3b3b40"/><circle cx="68" cy="90" r="5" fill="#3b3b40"/>
  <path d="M26 78 H58" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
</svg>`

// Mop: wooden stick, blue clamp, a fan of cream strings.
export const MOP_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="47" y="4" width="7" height="62" rx="3.5" fill="#c98b55" transform="rotate(18 50 35)"/>
  <rect x="26" y="58" width="28" height="10" rx="4" fill="#3d8be0" transform="rotate(18 40 63)"/>
  <g stroke="#f4ead2" stroke-width="5" stroke-linecap="round" fill="none">
    <path d="M24 68 Q16 80 12 92"/><path d="M30 70 Q26 82 24 94"/><path d="M36 72 Q36 84 38 95"/>
    <path d="M42 74 Q46 85 52 93"/><path d="M48 75 Q56 84 64 89"/>
  </g>
  <g stroke="#d9cba6" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8">
    <path d="M27 72 Q22 82 19 90"/><path d="M39 75 Q40 84 44 92"/>
  </g>
  <ellipse cx="38" cy="96" rx="26" ry="3" fill="#86bdf2" opacity="0.6"/>
</svg>`

// Toilet brush: teal handle, round white bristle head.
export const BRUSH_ICON = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <rect x="58" y="4" width="10" height="56" rx="5" fill="#2fb3a5" transform="rotate(28 63 32)"/>
  <circle cx="74" cy="10" r="6" fill="#1d7f78"/>
  <rect x="38" y="52" width="10" height="14" rx="3" fill="#8e9aa3" transform="rotate(28 43 59)"/>
  <ellipse cx="32" cy="74" rx="20" ry="17" fill="#f4f2ec" transform="rotate(28 32 74)"/>
  <g stroke="#d6d2c6" stroke-width="2.2" stroke-linecap="round">
    <path d="M18 66 L14 62"/><path d="M22 60 L19 55"/><path d="M30 57 L29 51"/><path d="M40 59 L43 54"/>
    <path d="M14 76 L9 76"/><path d="M16 86 L11 89"/><path d="M24 92 L22 97"/><path d="M36 92 L38 97"/><path d="M46 84 L51 86"/>
  </g>
  <circle cx="26" cy="70" r="3" fill="#fff"/>
</svg>`
