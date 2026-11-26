// Styles for the Upgrades / Hiring / Shop windows and the money HUD. Sizes are written in
// reference pixels with a `u` suffix (1u = one pixel of the 1920x991 reference screenshots);
// inject() turns `36u` into calc(var(--u) * 36px) and layout.js sets --u from the viewport, so
// the windows keep the reference proportions on every screen.

const CSS = /* css */ `
:root {
  --mw-teal: #2aa596; --mw-teal-d: #16756c; --mw-teal-dd: #0f5953;
  --mw-ink: #1b504b; --mw-desc: #2a7d74; --mw-cream: #fdf6e6;
  --mw-red: #e84a3f; --mw-gold: #f2bd3a; --mw-gold-d: #d9961a;
  --mw-font: 'Fredoka', 'Baloo 2', 'Arial Rounded MT Bold', system-ui, sans-serif;
}
.mw-layer { position: fixed; inset: 0; z-index: 1000; display: none; font-family: var(--mw-font); color: var(--mw-ink);
  touch-action: none; -webkit-user-select: none; user-select: none; }
.mw-layer.open, .mw-layer.closing { display: block; }
/* The money HUD hides while a window is open (the window has its own money pill). */
body:has(.mw-layer.open:not(.closing)) .mh-root { visibility: hidden; }
.mw-backdrop { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(8,40,40,.25), rgba(4,20,24,.55));
  animation: mw-fade .25s ease-out both; }
.mw-layer.closing .mw-backdrop { animation: mw-fade-out .2s ease-in both; }
.mw-stage { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 28u;
  padding: max(env(safe-area-inset-top), 64u) max(env(safe-area-inset-right), 12px) max(env(safe-area-inset-bottom), 12px) max(env(safe-area-inset-left), 12px); box-sizing: border-box; pointer-events: none; }
.mw-stage > * { pointer-events: auto; }

/* --- Window shell ----------------------------------------------------------------- */
.mw-win { position: relative; width: var(--mw-w, 1320u); height: var(--mw-h, 790u); flex: none;
  animation: mw-pop .5s cubic-bezier(.2,1.4,.4,1) both; transform-origin: 50% 40%; }
.mw-layer.closing .mw-win { animation: mw-unpop .2s ease-in both; }
.mw-frame { position: absolute; inset: 0; border-radius: 48u; padding: 20u;
  background: linear-gradient(180deg, #3cbcac 0%, #24998b 45%, #15736a 100%);
  box-shadow: 0 0 0 4u var(--mw-teal-dd), inset 0 5u 0 rgba(255,255,255,.35), inset 0 -6u 0 rgba(0,0,0,.18), 0 22u 50u rgba(0,0,0,.4); }
.mw-panel { position: relative; height: 100%; box-sizing: border-box; border-radius: 30u; background: var(--mw-cream);
  box-shadow: inset 0 0 0 4u #1f8a80, inset 0 0 0 9u var(--mw-cream), inset 0 0 0 11u #cdeadf, inset 0 8u 18u rgba(0,0,0,.06);
  display: flex; padding: 110u 40u 34u 40u; gap: 36u; overflow: hidden; }

.mw-ribbon { position: absolute; left: 50%; top: -60u; transform: translateX(-50%); height: 112u; min-width: 420u; padding: 0 70u;
  box-sizing: border-box; display: flex; align-items: center; justify-content: center; border-radius: 36u;
  background: linear-gradient(180deg, #f8786a 0%, #ec4d42 45%, #cf3a30 100%);
  box-shadow: 0 0 0 7u #fbe8cf, 0 0 0 11u var(--mw-teal-dd), inset 0 6u 0 rgba(255,255,255,.35), inset 0 -8u 0 rgba(0,0,0,.18), 0 10u 18u rgba(0,0,0,.25);
  animation: mw-drop .6s .08s cubic-bezier(.2,1.6,.4,1) both; z-index: 3; }
.mw-ribbon span { font-size: 76u; font-weight: 700; letter-spacing: 1u; color: #fff; line-height: 1;
  -webkit-text-stroke: 10u var(--mw-teal-dd); paint-order: stroke fill; text-shadow: 0 6u 0 var(--mw-teal-dd); }
.mw-ribbon .mw-spark { position: absolute; top: 50%; width: 74u; height: 74u; margin-top: -37u; animation: mw-twinkle 2.4s ease-in-out infinite; }
.mw-ribbon .mw-spark.l { left: -46u; }
.mw-ribbon .mw-spark.r { right: -46u; animation-delay: -1.2s; }

.mw-money { position: absolute; top: 16u; right: 136u; height: 66u; min-width: 250u; box-sizing: border-box; padding: 0 30u 0 82u;
  display: flex; align-items: center; border-radius: 22u; z-index: 3;
  background: linear-gradient(180deg, #fff8dc, #f6e3a2); box-shadow: 0 0 0 4u #e0a223, 0 0 0 7u #fff3cf, inset 0 -5u 0 rgba(200,140,20,.25);
  animation: mw-slide-r .45s .15s cubic-bezier(.2,1.3,.4,1) both; }
.mw-money .mw-coin { position: absolute; left: -16u; top: 50%; width: 82u; height: 82u; margin-top: -41u; filter: drop-shadow(0 4u 2u rgba(0,0,0,.2)); }
.mw-money b { font-size: 42u; font-weight: 700; color: var(--mw-ink); }
.mw-money.bump { animation: mw-bump .35s ease-out; }
.mw-money.short { animation: mw-shake .4s ease-in-out; box-shadow: 0 0 0 4u #e84a3f, 0 0 0 7u #fff3cf; }

.mw-close { position: absolute; top: -10u; right: -12u; width: 100u; height: 100u; border: 0; padding: 0; border-radius: 50%; cursor: pointer; z-index: 4;
  background: radial-gradient(circle at 50% 35%, #ff7d70, #e3443a 60%, #c0302a); touch-action: manipulation;
  box-shadow: 0 0 0 7u #fbe8cf, 0 0 0 11u #b23a33, inset 0 -6u 0 rgba(0,0,0,.2), 0 8u 14u rgba(0,0,0,.3);
  animation: mw-spin-in .5s .1s cubic-bezier(.2,1.4,.4,1) both; transition: transform .12s; }
.mw-close::before, .mw-close::after { content: ''; position: absolute; left: 50%; top: 50%; width: 58u; height: 16u; margin: -8u 0 0 -29u; border-radius: 8u;
  background: #fff; box-shadow: 0 0 0 4u #9c2d27; transform: rotate(45deg); }
.mw-close::after { transform: rotate(-45deg); box-shadow: none; }
.mw-close:hover { transform: scale(1.07) rotate(6deg); }
.mw-close:active { transform: scale(.92); }

/* --- Side tabs --------------------------------------------------------------------- */
.mw-tabs { display: flex; flex-direction: column; gap: 22u; flex: none; width: 176u; padding-top: 18u; }
.mw-tab { position: relative; height: 102u; border: 0; border-radius: 18u; cursor: pointer; font-family: inherit; padding: 6u 0 0;
  display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 0; touch-action: manipulation;
  background: linear-gradient(180deg, #b6eedd, #93dcc7); box-shadow: 0 0 0 4u #3ea597, 0 0 0 7u #e8f7f1, inset 0 -6u 0 rgba(30,110,100,.18);
  transition: transform .12s, filter .12s; animation: mw-rise .4s both; }
.mw-tab:nth-child(2) { animation-delay: .05s; } .mw-tab:nth-child(3) { animation-delay: .1s; }
.mw-tab i { width: 84u; height: 64u; display: block; }
.mw-tab b { font-size: 25u; font-weight: 700; color: var(--mw-ink); line-height: 1.25; padding-bottom: 6u; letter-spacing: .5u; }
.mw-tab.on { background: linear-gradient(180deg, #ffe46a, #fbc62a 60%, #f0aa14); box-shadow: 0 0 0 4u #df9614, 0 0 0 7u #fff1c4, inset 0 -6u 0 rgba(170,90,0,.25), 0 6u 12u rgba(200,130,0,.3); }
.mw-tab.on b { color: #2d3b2f; }
.mw-tab:hover { filter: brightness(1.05); transform: translateY(-2u); }
.mw-tab:active { transform: scale(.95); }

/* --- Body ---------------------------------------------------------------------------- */
.mw-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mw-head { display: flex; align-items: center; gap: 24u; height: 60u; margin: 0 0 22u; padding: 0 30u; flex: none; }
.mw-head::before, .mw-head::after { content: ''; flex: 1; height: 3u; background: #e5c27a; border-radius: 2u; }
.mw-head i { width: 40u; height: 40u; flex: none; animation: mw-twinkle 3s ease-in-out infinite; }
.mw-head i:last-of-type { animation-delay: -1.5s; }
.mw-head h2 { margin: 0; font-size: 50u; font-weight: 700; letter-spacing: .5u; color: var(--mw-ink); white-space: nowrap; }
.mw-head.anim h2 { animation: mw-title .35s ease-out both; }
.mw-list { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 6u 18u 18u 6u; margin-right: -22u; display: flex; flex-direction: column; gap: 28u;
  touch-action: pan-y; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #5cc2b4 transparent; }
.mw-list::-webkit-scrollbar { width: 9u; }
.mw-list::-webkit-scrollbar-thumb { background: #5cc2b4; border-radius: 9u; }
.mw-list::-webkit-scrollbar-track { background: transparent; }

/* --- Upgrade / staff rows ------------------------------------------------------------ */
.mw-row { position: relative; flex: none; min-height: 150u; box-sizing: border-box; border-radius: 26u; display: flex; align-items: center; gap: 22u;
  padding: 12u 20u; background: linear-gradient(180deg, #f6fbf8, #eaf5f0);
  box-shadow: 0 0 0 6u #34a898, 0 0 0 9u #fff, 0 0 0 11u #9fd6cb, 0 6u 10u 6u rgba(0,0,0,.06);
  animation: mw-row-in .42s cubic-bezier(.2,1.2,.4,1) both; animation-delay: calc(var(--i, 0) * 60ms + 120ms); }
.mw-row.locked { background: linear-gradient(180deg, #e4e8e7, #d6dcdb); box-shadow: 0 0 0 6u #b7c2c0, 0 0 0 9u #fff, 0 0 0 11u #cfd6d5; }
.mw-row.owned { background: linear-gradient(180deg, #f6fbf8, #e6f4ef); }
.mw-row.flash::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: radial-gradient(circle at 80% 50%, rgba(255,240,150,.85), rgba(255,255,255,0) 60%); animation: mw-flash .7s ease-out both; pointer-events: none; }
.mw-row.shake { animation: mw-shake .4s ease-in-out; }
.mw-art { flex: none; width: 192u; height: 124u; box-sizing: border-box; border-radius: 14u; background: #fdf3dc; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 5u #1f554f, inset 0 -6u 0 rgba(0,0,0,.05); padding: 8u 18u; }
.mw-row.locked .mw-art { background: #f6f1e6; }
.mw-art svg { width: 100%; height: 100%; transition: transform .25s; }
.mw-row:hover .mw-art svg { transform: scale(1.06) rotate(-2deg); }
.mw-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6u; }
.mw-info h3 { margin: 0; font-size: 37u; font-weight: 700; line-height: 1.05; color: var(--mw-ink); letter-spacing: .3u; }
.mw-info p { margin: 0; font-size: 20u; font-weight: 500; line-height: 1.3; color: var(--mw-desc); letter-spacing: -.25u; }
.mw-info p.small { font-size: 17u; }
.mw-row.locked .mw-info h3 { color: #2a4a47; }
.mw-chip { align-self: flex-start; font-size: 19u; font-weight: 700; color: #fff; background: #f08a24; border-radius: 12u; padding: 2u 12u; box-shadow: inset 0 -3u 0 rgba(0,0,0,.15); animation: mw-pulse 1.4s ease-in-out infinite; }
.mw-dots { display: flex; align-items: center; gap: 0; margin-top: 4u; }
.mw-dots span { width: 22u; height: 22u; border-radius: 50%; margin-right: 48u; background: radial-gradient(circle at 40% 35%, #d9dddd, #a8b0b0); box-shadow: 0 0 0 2u #8d9696, inset 0 -2u 0 rgba(0,0,0,.15); transition: background .3s; }
.mw-dots span.on { background: radial-gradient(circle at 40% 35%, #ffe680, #f2b51d); box-shadow: 0 0 0 2u #c4860c; animation: mw-pop-dot .4s cubic-bezier(.2,1.6,.4,1) both; }
.mw-dots em { margin-left: auto; font-style: normal; font-size: 23u; font-weight: 700; color: var(--mw-ink); white-space: nowrap; }
.mw-row.staff h3 { white-space: nowrap; }
.mw-row.staff .mw-info p { font-size: 23u; }
.mw-row.staff .mw-info p.small { font-size: 16u; }
.mw-dots.lv em { margin-left: 0; }
.mw-sep { flex: none; align-self: stretch; width: 2u; margin: 10u 0; background: #e2d6bb; }

/* --- Buttons ------------------------------------------------------------------------- */
.mw-btn { position: relative; flex: none; width: 232u; height: 94u; border: 0; border-radius: 26u; cursor: pointer; font-family: inherit; padding: 0 10u 8u;
  display: flex; align-items: center; justify-content: center; gap: 10u; overflow: hidden; touch-action: manipulation;
  color: #fff; font-weight: 700; font-size: 40u; line-height: 1;
  transition: transform .1s, filter .15s; }
.mw-btn > span { position: relative; -webkit-text-stroke: 7u var(--stroke); paint-order: stroke fill; text-shadow: 0 4u 0 var(--stroke); white-space: nowrap; }
.mw-btn.buy { --stroke: #1f6d2a; background: linear-gradient(180deg, #7fe07f 0%, #4cc757 50%, #33a842 100%); box-shadow: 0 0 0 4u #1d6b29, inset 0 -9u 0 #24872f, inset 0 5u 0 rgba(255,255,255,.4), 0 6u 10u rgba(0,0,0,.2); }
.mw-btn.have { --stroke: #12655c; background: linear-gradient(180deg, #5fd5c4 0%, #33b5a4 55%, #26998b 100%); box-shadow: 0 0 0 4u #0f6159, inset 0 -9u 0 #1b7f74, inset 0 5u 0 rgba(255,255,255,.4); cursor: default; }
.mw-btn.lock, .mw-btn.short { --stroke: #6c7676; background: linear-gradient(180deg, #d9dede 0%, #bfc6c6 60%, #aab3b3 100%); box-shadow: 0 0 0 4u #7f8a8a, inset 0 -9u 0 #8f9999, inset 0 5u 0 rgba(255,255,255,.5); }
.mw-btn.lock { padding-left: 64u; justify-content: center; text-align: center; }
.mw-btn.lock > span { white-space: nowrap; line-height: 1.05; -webkit-text-stroke-width: 5u; text-shadow: 0 3u 0 var(--stroke); }
.mw-btn.lock .mw-padlock { position: absolute; left: 14u; top: 50%; width: 56u; height: 62u; margin-top: -36u; }
.mw-btn.short { flex-direction: column; gap: 6u; font-size: 38u; padding-bottom: 14u; }
.mw-btn .mw-bar { position: absolute; left: 30u; right: 30u; bottom: 18u; height: 9u; border-radius: 6u; background: #d0d6d6; box-shadow: inset 0 1u 2u rgba(0,0,0,.15); overflow: hidden; }
.mw-btn .mw-bar i { display: block; height: 100%; width: 0; border-radius: inherit; background: linear-gradient(90deg, #ffd23d, #f5b419); transition: width .5s ease-out; }
.mw-btn.short > span { margin-top: -6u; }
.mw-btn.wait { --stroke: #8a5a10; background: linear-gradient(180deg, #ffe28a, #f5c242 60%, #e2a521); box-shadow: 0 0 0 4u #a8700c, inset 0 -9u 0 #c98d17, inset 0 5u 0 rgba(255,255,255,.45); font-size: 30u; cursor: default; }
.mw-btn.collect { --stroke: #8a5a10; background: linear-gradient(180deg, #fff09a, #ffd23d 55%, #f0aa14); box-shadow: 0 0 0 4u #a8700c, inset 0 -9u 0 #c98d17, inset 0 5u 0 rgba(255,255,255,.5); animation: mw-pulse 1s ease-in-out infinite; }
.mw-btn.buy::after, .mw-btn.collect::after { content: ''; position: absolute; top: 0; bottom: 0; width: 40%; left: -60%; transform: skewX(-20deg);
  background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.45), rgba(255,255,255,0)); animation: mw-shine 3.2s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 300ms); }
.mw-btn.buy:hover, .mw-btn.collect:hover { filter: brightness(1.06); transform: translateY(-2u); }
.mw-btn.buy:active, .mw-btn.collect:active, .mw-btn.short:active, .mw-btn.lock:active { transform: translateY(4u) scale(.97); }
.mw-btn.lock:active .mw-padlock, .mw-padlock.wiggle { animation: mw-wiggle .45s ease-in-out; }
.mw-btn.bought { animation: mw-bought .45s cubic-bezier(.2,1.5,.4,1); }

/* --- NEXT / THEN cards --------------------------------------------------------------- */
.mw-side { flex: none; width: 286u; display: flex; flex-direction: column; gap: 24u; align-self: center; margin-top: 40u; animation: mw-slide-l .55s .18s cubic-bezier(.2,1.2,.4,1) both; }
.mw-next { position: relative; box-sizing: border-box; border-radius: 22u; padding: 72u 18u 24u; text-align: center; background: #fdf6e6;
  box-shadow: 0 0 0 6u #f0c043, 0 0 0 10u #fff4d0, 0 0 0 13u #e3a92c, 0 12u 24u rgba(0,0,0,.3); }
.mw-next .mw-ribbon.small { top: -26u; height: 58u; min-width: 0; width: 214u; padding: 0; border-radius: 16u; animation-delay: .3s;
  box-shadow: 0 0 0 4u #fbe8cf, 0 0 0 7u #b03a31, inset 0 4u 0 rgba(255,255,255,.35), inset 0 -5u 0 rgba(0,0,0,.18); }
.mw-next .mw-ribbon.small span { font-size: 38u; -webkit-text-stroke-width: 7u; text-shadow: 0 3u 0 var(--mw-teal-dd); }
.mw-next .mw-ribbon.small .mw-spark { width: 40u; height: 40u; margin-top: -20u; }
.mw-next .mw-ribbon.small .mw-spark.l { left: -22u; } .mw-next .mw-ribbon.small .mw-spark.r { right: -22u; }
.mw-next .mw-medal { height: 192u; border-radius: 14u; background: #fdfaf2; box-shadow: 0 0 0 4u #1f554f; display: flex; align-items: center; justify-content: center; margin-bottom: 26u; }
.mw-next .mw-medal svg { width: 210u; height: 175u; animation: mw-float 3s ease-in-out infinite; }
.mw-next h4 { margin: 0 0 8u; font-size: 31u; white-space: nowrap; font-weight: 700; color: var(--mw-ink); line-height: 1.05; }
.mw-next .sub { margin: 0; font-size: 25u; color: var(--mw-desc); line-height: 1.2; padding-bottom: 12u; border-bottom: 2u solid #e5cfa6; }
.mw-next .hint { margin: 12u 0 12u; font-size: 18u; font-weight: 700; color: #7a2513; line-height: 1.2; }
.mw-prog { height: 20u; border-radius: 10u; background: #d8dbda; overflow: hidden; box-shadow: inset 0 2u 3u rgba(0,0,0,.12); }
.mw-prog i { display: block; height: 100%; width: 0; border-radius: inherit; background: linear-gradient(180deg, #4fcbb9, #2aa596); transition: width .6s cubic-bezier(.2,1,.4,1); }
.mw-next .mw-act { margin-top: 14u; width: 100%; height: 66u; font-size: 28u; border-radius: 18u; }
.mw-next .mw-act.short { font-size: 26u; }
.mw-next.done { animation: mw-bump .5s ease-out; }
.mw-then { position: relative; height: 140u; box-sizing: border-box; border-radius: 20u; display: flex; align-items: center; gap: 14u; padding: 0 18u;
  background: linear-gradient(180deg, #eef1f0, #dfe4e3); box-shadow: 0 0 0 5u #c3cbca, 0 0 0 8u #fff, 0 0 0 10u #d8dddc; }
.mw-then i { width: 110u; height: 92u; flex: none; animation: mw-wobble 3s ease-in-out infinite; }
.mw-then b { font-size: 44u; font-weight: 700; color: #a2abab; }

/* compact NEXT (phones): a row at the top of the list */
.mw-next-row { flex: none; display: flex; align-items: center; gap: 22u; padding: 16u 20u; border-radius: 22u; background: #fdf6e6;
  box-shadow: 0 0 0 5u #f0c043, 0 0 0 9u #fff4d0, 0 0 0 11u #e3a92c; animation: mw-row-in .4s .1s both; }
.mw-next-row .tag { flex: none; font-size: 26u; font-weight: 700; color: #fff; background: linear-gradient(180deg, #f8786a, #cf3a30); border-radius: 12u; padding: 6u 14u;
  -webkit-text-stroke: 5u var(--mw-teal-dd); paint-order: stroke fill; }
.mw-next-row i { width: 100u; height: 100u; flex: none; }
.mw-next-row .txt { flex: 1; min-width: 0; }
.mw-next-row h4 { margin: 0; font-size: 30u; color: var(--mw-ink); }
.mw-next-row .hint { margin: 4u 0 8u; font-size: 20u; font-weight: 700; color: #7a2513; }
.mw-next-row .mw-act { flex: none; width: 240u; height: 74u; font-size: 26u; }

/* --- Shop -------------------------------------------------------------------------------- */
.mw-win.shop .mw-panel { padding: 96u 36u 30u 50u; }
.mw-win.shop .mw-list { gap: 30u; padding: 34u 18u 18u 30u; margin-left: -26u; }
.mw-sec { flex: none; display: flex; align-items: center; gap: 24u; margin: 10u 0 6u; }
.mw-sec b { flex: none; width: 334u; height: 62u; border-radius: 14u; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 36u; font-weight: 700;
  -webkit-text-stroke: 6u var(--mw-teal-dd); paint-order: stroke fill; text-shadow: 0 3u 0 var(--mw-teal-dd);
  background: linear-gradient(180deg, #3cbcac, #1d8378); box-shadow: 0 0 0 4u #0f5953, 0 0 0 7u #d7efe8, inset 0 4u 0 rgba(255,255,255,.3); animation: mw-rise .35s both; }
.mw-sec::after { content: ''; flex: 1; height: 3u; background: #e5c27a; border-radius: 2u; }
.mw-grid { flex: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 30u; }
.mw-grid.two { grid-template-columns: repeat(2, 1fr); }
.mw-card { position: relative; min-height: 142u; box-sizing: border-box; border-radius: 20u; display: flex; align-items: center; gap: 12u; padding: 10u 12u;
  background: linear-gradient(180deg, #fffaf0, #fbf1dc); --edge: #e9b545; --edge2: #fff2cc;
  box-shadow: 0 0 0 5u var(--edge), 0 0 0 8u var(--edge2), 0 0 0 10u var(--edge), 0 6u 10u 8u rgba(0,0,0,.05);
  animation: mw-row-in .42s cubic-bezier(.2,1.2,.4,1) both; animation-delay: calc(var(--i, 0) * 45ms + 120ms); }
.mw-card.now { --edge: #35a898; --edge2: #e6f6f1; background: linear-gradient(180deg, #f6fcf9, #e9f6f1); }
.mw-card.cash { --edge: #5bc06a; --edge2: #e9f8e6; background: linear-gradient(180deg, #fbfdf6, #eef8e8); }
.mw-card.owned { filter: saturate(.85); }
.mw-card .mw-art { width: 128u; height: 112u; box-shadow: none; background: transparent; padding: 0; }
.mw-card .mw-info { gap: 2u; }
.mw-card h3 { font-size: 30u; white-space: nowrap; }
.mw-card p { font-size: 24u; font-style: italic; white-space: nowrap; }
.mw-card p.small { white-space: normal; line-height: 1.2; }
.mw-card p.small { font-size: 15u; }
.mw-card .mw-btn { width: 208u; height: 52u; font-size: 28u; border-radius: 20u; margin-top: 8u; padding-bottom: 6u; }
.mw-card .mw-btn > span { -webkit-text-stroke-width: 6u; text-shadow: 0 3u 0 var(--stroke); }
.mw-card .mw-btn.have { font-size: 24u; }
.mw-card .mw-btn.wait { font-size: 22u; }
.mw-card .mw-btn.short { flex-direction: row; font-size: 24u; padding-bottom: 6u; }
.mw-card .mw-btn.short .mw-bar { left: 18u; right: 18u; bottom: 8u; height: 6u; }
.mw-card .mw-btn.collect { font-size: 22u; }
.mw-card .count { position: absolute; right: 16u; top: 12u; font-size: 18u; font-weight: 700; color: #fff; background: #2aa596; border-radius: 10u; padding: 2u 10u; }
.mw-ribbon-tag { position: absolute; left: -16u; top: -26u; z-index: 2; height: 46u; padding: 0 22u; display: flex; align-items: center; transform: rotate(-12deg);
  background: linear-gradient(180deg, #f2584b, #c9342b); border-radius: 6u; box-shadow: 0 0 0 3u #fbe8cf, 0 0 0 5u #8c241e, 0 4u 6u rgba(0,0,0,.25); animation: mw-tag-wobble 2.6s ease-in-out infinite; }
.mw-ribbon-tag span { font-size: 28u; font-weight: 700; color: #fff; -webkit-text-stroke: 5u #8c241e; paint-order: stroke fill; letter-spacing: 1u; }
.mw-ribbon-tag::before, .mw-ribbon-tag::after { content: ''; position: absolute; top: 6u; width: 18u; height: 40u; background: #a92a22; z-index: -1; }
.mw-ribbon-tag::before { left: -10u; transform: skewY(20deg); } .mw-ribbon-tag::after { right: -10u; transform: skewY(-20deg); }
.mw-card.mid .mw-ribbon-tag { left: -24u; }
.mw-card.empire { grid-column: 1 / -1; min-height: 146u; }
.mw-card.empire .gifts { display: flex; gap: 34u; margin-left: auto; padding-right: 24u; }
.mw-card.empire .gift { display: flex; flex-direction: column; align-items: center; gap: 4u; width: 116u; }
.mw-card.empire .gift i { width: 84u; height: 70u; animation: mw-float 3s ease-in-out infinite; }
.mw-card.empire .gift:nth-child(2) i { animation-delay: -.7s; } .mw-card.empire .gift:nth-child(3) i { animation-delay: -1.4s; } .mw-card.empire .gift:nth-child(4) i { animation-delay: -2.1s; }
.mw-card.empire .gift b { font-size: 34u; font-weight: 700; color: #2aa596; }

/* --- Coin burst + floating numbers -------------------------------------------------- */
.mw-fx { position: fixed; inset: 0; pointer-events: none; z-index: 1010; }
.mw-fx .coin { position: absolute; width: 34px; height: 34px; margin: -17px 0 0 -17px; will-change: transform, opacity; }
.mw-fx .float { position: absolute; transform: translate(-50%, -50%); font-family: var(--mw-font); font-weight: 700; font-size: 26px; color: #fff;
  -webkit-text-stroke: 5px #1f6d2a; paint-order: stroke fill; animation: mw-float-up 1.1s ease-out both; white-space: nowrap; }
.mw-fx .float.minus { -webkit-text-stroke-color: #9c2d27; }
.mw-fx .confetti { position: absolute; width: 10px; height: 14px; border-radius: 2px; will-change: transform, opacity; }

/* --- HUD: money pill + side buttons + toasts ------------------------------------------ */
.mh-root { position: fixed; inset: 0; pointer-events: none; z-index: 40; font-family: var(--mw-font); --u: 0.6; }
.mh-money { position: absolute; top: max(env(safe-area-inset-top), 14px); right: max(env(safe-area-inset-right), 14px); height: 70u; min-width: 205u; box-sizing: border-box;
  padding: 0 26u 0 84u; display: flex; align-items: center; justify-content: flex-end; border-radius: 35u; pointer-events: auto; cursor: pointer;
  background: linear-gradient(180deg, #ffffff, #f4f1e8); box-shadow: 0 0 0 3u #d9d3c2, inset 0 -5u 0 rgba(0,0,0,.06), 0 5u 10u rgba(0,0,0,.2); }
.mh-money .mw-coin { position: absolute; left: -16u; top: 50%; width: 80u; height: 80u; margin-top: -40u; filter: drop-shadow(0 4u 2u rgba(0,0,0,.25)); }
.mh-money b { font-size: 48u; font-weight: 700; color: #fff4c8; -webkit-text-stroke: 8u #3b2a12; paint-order: stroke fill; text-shadow: 0 3u 0 #3b2a12; letter-spacing: .5u; }
.mh-money.bump { animation: mw-bump .35s ease-out; }
.mh-money.bump .mw-coin { animation: mw-coin-spin .5s ease-out; }
.mh-side { position: absolute; right: 12px; top: 140px; display: flex; flex-direction: column; gap: 32u; pointer-events: auto; }
.mh-btn { position: relative; width: 110u; height: 110u; border: 0; padding: 0; border-radius: 50%; cursor: pointer; touch-action: manipulation; font-family: inherit; --ink: #0f4a45;
  background: radial-gradient(circle at 50% 30%, #6fe0cf, #2fb3a2 55%, #1d8a7d); transition: transform .12s; animation: mw-rise .5s both;
  box-shadow: 0 0 0 5u #eafff9, 0 0 0 9u var(--ink), inset 0 -8u 0 rgba(0,0,0,.18), inset 0 6u 0 rgba(255,255,255,.35), 0 6u 12u rgba(0,0,0,.3); }
.mh-btn:nth-child(2) { animation-delay: .08s; } .mh-btn:nth-child(3) { animation-delay: .16s; }
.mh-btn.shop { --ink: #8a1e16; background: radial-gradient(circle at 50% 30%, #ff9a6e, #f2553c 55%, #c9301f); box-shadow: 0 0 0 5u #fff1e8, 0 0 0 9u var(--ink), inset 0 -8u 0 rgba(0,0,0,.18), inset 0 6u 0 rgba(255,255,255,.35), 0 6u 12u rgba(0,0,0,.3); }
.mh-btn.staff { --ink: #3a1f6b; background: radial-gradient(circle at 50% 30%, #b28cf2, #7b4fd0 55%, #5a33a8); box-shadow: 0 0 0 5u #f3ecff, 0 0 0 9u var(--ink), inset 0 -8u 0 rgba(0,0,0,.18), inset 0 6u 0 rgba(255,255,255,.35), 0 6u 12u rgba(0,0,0,.3); }
.mh-btn i { position: absolute; left: 14u; right: 14u; top: 8u; height: 74u; display: block; }
.mh-btn i svg { width: 100%; height: 100%; }
.mh-btn b { position: absolute; left: -24u; right: -24u; bottom: -4u; font-size: 27u; font-weight: 700; color: #fff; -webkit-text-stroke: 7u var(--ink); paint-order: stroke fill; letter-spacing: .3u; }
.mh-btn:hover { transform: translateY(-3u) rotate(-4deg); }
.mh-btn:active { transform: scale(.92); }
.mh-btn .key { position: absolute; left: -22u; top: -22u; width: 40u; height: 40u; border-radius: 10u; background: #17403c; box-shadow: 0 0 0 3u #fff; color: #fff;
  font-size: 30u; font-weight: 700; display: flex; align-items: center; justify-content: center; -webkit-text-stroke: 4u #0a2422; paint-order: stroke fill; }
.mh-btn .dot { position: absolute; right: -10u; top: -10u; min-width: 36u; height: 36u; padding: 0 6u; box-sizing: border-box; border-radius: 18u; background: #e8382d; box-shadow: 0 0 0 3u #fff;
  color: #fff; font-size: 22u; font-weight: 700; display: none; align-items: center; justify-content: center; animation: mw-pulse 1.2s ease-in-out infinite; }
.mh-btn.alert .dot { display: flex; }
@media (pointer: coarse) { .mh-btn .key { display: none; } }
.mh-toast { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); padding: 18u 36u; border-radius: 24u; background: #fdf6e6; text-align: center;
  box-shadow: 0 0 0 5u #f0c043, 0 0 0 9u #fff4d0, 0 0 0 11u #e3a92c, 0 10u 20u rgba(0,0,0,.3); animation: mw-toast 3.6s ease-in-out both; }
.mh-toast b { display: block; font-size: 34u; color: var(--mw-ink); }
.mh-toast span { font-size: 24u; color: var(--mw-desc); }

/* --- Responsive layouts (layout.js sets data-mode) ---------------------------------- */
.mw-layer[data-mode="compact"] .mw-side, .mw-layer[data-mode="portrait"] .mw-side { display: none; }
.mw-layer[data-mode="wide"] .mw-next-row { display: none; }
.mw-layer[data-mode="compact"] .mw-panel { padding-top: 84u; padding-bottom: 22u; }
.mw-layer[data-mode="compact"] .mw-tabs { gap: 14u; padding-top: 4u; }
.mw-layer[data-mode="compact"] .mw-tab { height: 84u; }
.mw-layer[data-mode="compact"] .mw-tab i { height: 48u; }
.mw-layer[data-mode="compact"] .mw-head { margin-bottom: 12u; height: 52u; }
.mw-layer[data-mode="compact"] .mw-next-row { padding: 10u 16u; }
.mw-layer[data-mode="compact"] .mw-next-row i { width: 76u; height: 76u; }
.mw-layer[data-mode="compact"] .mw-next-row .hint { margin: 2u 0 6u; }
.mw-layer[data-mode="portrait"] .mw-panel { flex-direction: column; padding: 150u 26u 26u; gap: 18u; }
.mw-layer[data-mode="portrait"] .mw-tabs { flex-direction: row; width: auto; padding: 8u 6u 0; gap: 22u; }
.mw-layer[data-mode="portrait"] .mw-tab { flex: 1; height: 92u; }
.mw-layer[data-mode="portrait"] .mw-money { top: 76u; right: 40u; min-width: 200u; }
.mw-layer[data-mode="portrait"] .mw-win.shop .mw-panel { padding-top: 150u; }
.mw-layer[data-mode="portrait"] .mw-row { flex-wrap: wrap; gap: 14u 20u; padding: 16u; }
.mw-layer[data-mode="portrait"] .mw-art { width: 160u; height: 110u; }
.mw-layer[data-mode="portrait"] .mw-info { flex-basis: calc(100% - 190u); }
.mw-layer[data-mode="portrait"] .mw-sep { display: none; }
.mw-layer[data-mode="portrait"] .mw-row > .mw-btn { width: 100%; height: 84u; }
.mw-layer[data-mode="portrait"] .mw-info h3 { font-size: 34u; }
.mw-layer[data-mode="portrait"] .mw-info p { font-size: 25u; }
.mw-layer[data-mode="portrait"] .mw-info p.small { font-size: 21u; }
.mw-layer[data-mode="portrait"] .mw-dots span { margin-right: 26u; }
.mw-layer[data-mode="portrait"] .mw-grid { grid-template-columns: 1fr; }
.mw-layer[data-mode="portrait"] .mw-card.empire { flex-wrap: wrap; }
.mw-layer[data-mode="portrait"] .mw-card.empire .gifts { margin: 0 auto; padding: 0; gap: 14u; }
.mw-layer[data-mode="portrait"] .mw-ribbon { min-width: 360u; padding: 0 50u; }
.mw-layer[data-mode="portrait"] .mw-ribbon span { font-size: 64u; }
.mw-layer[data-mode="portrait"] .mw-head h2 { font-size: 40u; }
.mw-layer[data-mode="portrait"] .mw-next-row { flex-wrap: wrap; }
.mw-layer[data-mode="portrait"] .mw-next-row .mw-act { width: 100%; }

/* --- Keyframes ------------------------------------------------------------------------- */
@keyframes mw-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes mw-fade-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes mw-pop { 0% { opacity: 0; transform: scale(.55) translateY(40px) } 60% { opacity: 1; transform: scale(1.04) } 100% { transform: scale(1) } }
@keyframes mw-unpop { to { opacity: 0; transform: scale(.82) translateY(24px) } }
@keyframes mw-drop { 0% { opacity: 0; transform: translateX(-50%) translateY(-80px) scale(.7) } 100% { opacity: 1; transform: translateX(-50%) } }
@keyframes mw-slide-r { from { opacity: 0; transform: translateX(60px) } to { opacity: 1; transform: none } }
@keyframes mw-slide-l { from { opacity: 0; transform: translateX(80px) } to { opacity: 1; transform: none } }
@keyframes mw-spin-in { from { opacity: 0; transform: scale(.2) rotate(-180deg) } to { opacity: 1; transform: none } }
@keyframes mw-rise { from { opacity: 0; transform: translateY(20px) scale(.9) } to { opacity: 1; transform: none } }
@keyframes mw-row-in { from { opacity: 0; transform: translateY(26px) scale(.96) } to { opacity: 1; transform: none } }
@keyframes mw-title { from { opacity: 0; transform: translateY(-10px) scale(.9) } to { opacity: 1; transform: none } }
@keyframes mw-twinkle { 0%, 100% { transform: scale(1) rotate(0) } 50% { transform: scale(1.18) rotate(20deg) } }
@keyframes mw-shine { 0%, 70% { left: -60% } 100% { left: 130% } }
@keyframes mw-bump { 0% { transform: scale(1) } 35% { transform: scale(1.14) } 100% { transform: scale(1) } }
@keyframes mw-shake { 0%, 100% { transform: translateX(0) } 20% { transform: translateX(-10px) } 40% { transform: translateX(9px) } 60% { transform: translateX(-6px) } 80% { transform: translateX(4px) } }
@keyframes mw-wiggle { 0%, 100% { transform: rotate(0) } 25% { transform: rotate(-16deg) } 50% { transform: rotate(13deg) } 75% { transform: rotate(-7deg) } }
@keyframes mw-bought { 0% { transform: scale(.8) } 60% { transform: scale(1.1) } 100% { transform: scale(1) } }
@keyframes mw-flash { from { opacity: 1 } to { opacity: 0 } }
@keyframes mw-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.05) } }
@keyframes mw-pop-dot { from { transform: scale(0) } to { transform: scale(1) } }
@keyframes mw-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes mw-wobble { 0%, 100% { transform: rotate(-4deg) } 50% { transform: rotate(4deg) } }
@keyframes mw-tag-wobble { 0%, 100% { transform: rotate(-12deg) } 50% { transform: rotate(-9deg) scale(1.04) } }
@keyframes mw-float-up { 0% { opacity: 0; transform: translate(-50%, -30%) scale(.6) } 15% { opacity: 1; transform: translate(-50%, -60%) scale(1.15) } 100% { opacity: 0; transform: translate(-50%, -230%) scale(1) } }
@keyframes mw-coin-spin { from { transform: rotateY(0) } to { transform: rotateY(360deg) } }
@keyframes mw-toast { 0% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(.8) } 10%, 85% { opacity: 1; transform: translateX(-50%) } 100% { opacity: 0; transform: translateX(-50%) translateY(-20px) } }
@media (prefers-reduced-motion: reduce) { .mw-layer *, .mh-root * { animation-duration: .01ms !important; animation-iteration-count: 1 !important; } }
`

let injected = false
export function injectStyles() {
  if (injected) return
  injected = true
  const css = CSS.replace(/(?<![\w#.-])(-?\d*\.?\d+)u(?![\w-])/g, (_, n) => `calc(var(--u) * ${n}px)`)
  const el = document.createElement('style')
  el.id = 'motel-windows-css'
  el.textContent = css
  document.head.appendChild(el)
}
