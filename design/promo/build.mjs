import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Arma el reel publicitario de Somos Barrio.
 *
 * Toma las vistas del canvas de diseño (design/somos-barrio-clay/*.body.html),
 * les marca los elementos que el reel "toca", y las embebe en un escenario
 * 9:16 que se auto-reproduce. Las vistas no se editan a mano acá: si cambian
 * en el canvas, se vuelve a correr este script.
 */

const SRC = join("..", "somos-barrio-clay");
const read = (name) => readFileSync(join(SRC, `${name}.body.html`), "utf8");

/** Marca un elemento como objetivo de tap. Falla si el ancla ya no existe. */
function tag(html, anchor, name, { first = false } = {}) {
  const at = html.indexOf(anchor);
  if (at === -1) throw new Error(`ancla no encontrada para "${name}": ${anchor.slice(0, 60)}`);
  if (!first && html.indexOf(anchor, at + 1) !== -1) {
    throw new Error(`ancla ambigua para "${name}" (usá first:true)`);
  }
  const open = html.lastIndexOf("<div", at);
  return `${html.slice(0, open + 4)} data-tap="${name}"${html.slice(open + 4)}`;
}

const screens = {
  login: read("Login"),
  inicio: tag(read("Main"), "position:absolute;right:22px;bottom:120px", "proponer"),
  noticia: tag(read("Noticia"), "display:flex;align-items:center;gap:8px;height:48px;padding:0 12px;color:#756C63", "guardar", { first: true }),
  mercado: tag(read("Mercado"), "position:absolute;right:24px;bottom:118px", "publicar"),
  comercio: tag(read("Comercio"), "flex-grow:1;height:66px;border-radius:22px;background:#7BC47F", "whatsapp"),
  foro: tag(read("Foro"), 'class="clay" style="background:#FAF8F5;border-radius:26px;padding:16px 18px;display:flex;gap:13px"', "hilo", { first: true }),
  eventos: tag(read("Eventos"), "height:36px;border-radius:999px;background:#7BC47F", "voy"),
};

/**
 * Guion. `dur` en ms, `beats` con `at` relativo al inicio de la escena.
 * tint tiñe el halo detrás del teléfono con el acento de esa sección.
 */
const scenes = [
  {
    screen: "login",
    tint: "green",
    dur: 3900,
    kicker: "Somos Barrio",
    headline: "Lo que pasa a la vuelta de tu casa",
    sub: "La app del barrio, hecha por los que viven en él.",
    beats: [],
  },
  {
    screen: "inicio",
    tint: "green",
    dur: 4800,
    kicker: "Novedades",
    headline: "Enterate antes de que sea rumor",
    sub: "Obras, cortes, seguridad y eventos de tu barrio, ordenados por categoría.",
    beats: [
      { at: 1500, type: "scroll", to: 140 },
      { at: 3400, type: "tap", target: "proponer" },
    ],
  },
  {
    screen: "noticia",
    tint: "terra",
    dur: 4300,
    kicker: "Cada nota",
    headline: "Con fecha y con quién la escribió",
    sub: "Nada de cadenas reenviadas: cada noticia tiene autor y hora.",
    beats: [
      { at: 1400, type: "scroll", to: 190 },
      { at: 3300, type: "tap", target: "guardar" },
    ],
  },
  {
    screen: "mercado",
    tint: "sky",
    dur: 4700,
    kicker: "Mercado",
    headline: "Lo que no usás, al vecino le sirve",
    sub: "Vendé, regalá o buscá algo sin salir de tu barrio.",
    beats: [
      { at: 1500, type: "scroll", to: 120 },
      { at: 3300, type: "tap", target: "publicar" },
    ],
  },
  {
    screen: "comercio",
    tint: "terra",
    dur: 4500,
    kicker: "Comercios",
    headline: "La esquina, a un toque",
    sub: "Horarios, reseñas de vecinos y WhatsApp directo al local.",
    beats: [
      { at: 1300, type: "scroll", to: 210 },
      { at: 3200, type: "tap", target: "whatsapp" },
    ],
  },
  {
    screen: "foro",
    tint: "green",
    dur: 4200,
    kicker: "Foro",
    headline: "Siempre hay un vecino que sabe",
    sub: "Preguntá por un plomero, un horario o qué fue ese ruido.",
    beats: [
      { at: 1400, type: "scroll", to: 110 },
      { at: 3100, type: "tap", target: "hilo" },
    ],
  },
  {
    screen: "eventos",
    tint: "sky",
    dur: 4400,
    kicker: "Eventos",
    headline: "Enterate antes, no después",
    sub: "Ferias, asambleas y cine en la plaza. Avisá si vas.",
    beats: [
      { at: 1400, type: "scroll", to: 90 },
      { at: 3100, type: "tap", target: "voy" },
    ],
  },
  {
    screen: "inicio",
    tint: "green",
    dur: 4600,
    kicker: "",
    headline: "Somos Barrio",
    sub: "Sumate al tuyo.",
    finale: true,
    beats: [],
  },
];

/**
 * Las reglas de relieve salen del mismo helmet que usa el canvas, para que el
 * reel no se desincronice del sistema. Van acotadas a .viewport: son el
 * lenguaje de la app, no del escenario.
 */
const clayRules = readFileSync(join(SRC, "_helmet.txt"), "utf8")
  .split("\n")
  .filter((line) => /^\s*\.clay/.test(line))
  .map((line) => `  .viewport ${line.trim()}`)
  .join("\n");

if (clayRules.split("\n").length < 7) throw new Error("faltan reglas .clay en el helmet");

const screenMarkup = Object.entries(screens)
  .map(([id, html]) => `<div class="screen" data-screen="${id}">\n${html}\n</div>`)
  .join("\n");

const page = `<title>Somos Barrio Reel</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Nunito:wght@400;500;600;700;800&display=swap">
<style>
  :root {
    --ground: #26221E;
    --ground-lift: #332E28;
    --cream: #F2F0EB;
    --cream-dim: #B8AFA3;
    --green: #7BC47F;
    --terra: #F0A868;
    --sky: #8FB8DE;
    --display: 'Bricolage Grotesque', 'Trebuchet MS', system-ui, sans-serif;
    --body: 'Nunito', 'Avenir Next Rounded', 'Trebuchet MS', system-ui, sans-serif;
  }

  /* Escenario deliberadamente oscuro y único: no sigue el tema del visor.
     Por eso pinta su propio fondo y todos sus colores de forma explícita. */
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--cream);
    font-family: var(--body);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .fit { position: fixed; inset: 0; overflow: hidden; background: var(--ground); }

  /* Lienzo fijo de 1080x1920 escalado por transform: la composición queda
     idéntica en cualquier pantalla, que es lo que hace que se grabe limpio.
     Va posicionado en absoluto: un elemento más grande que la ventana se
     desborda hacia arriba-izquierda si lo centra el layout. */
  .stage {
    width: 1080px; height: 1920px;
    position: absolute; left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    transform-origin: center center;
    display: flex; flex-direction: column;
    padding: 104px 84px 76px;
    overflow: hidden;
    background:
      radial-gradient(120% 70% at 50% 8%, #322C26 0%, rgba(50,44,38,0) 62%),
      var(--ground);
  }

  /* Halo detrás del teléfono; cambia de tono por sección. */
  .glow {
    position: absolute; left: 50%; top: 56%;
    width: 1180px; height: 1180px; margin: -590px 0 0 -590px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--tint, #7BC47F) 0%, rgba(0,0,0,0) 62%);
    opacity: .17;
    filter: blur(14px);
    transition: background 900ms ease, opacity 900ms ease;
    pointer-events: none;
  }

  .head { position: relative; min-height: 430px; }

  .kicker {
    font-family: var(--body);
    font-size: 26px; font-weight: 800;
    letter-spacing: .22em; text-transform: uppercase;
    color: var(--tint, #7BC47F);
    margin-bottom: 26px;
    min-height: 34px;
    transition: color 900ms ease;
  }

  .headline {
    font-family: var(--display);
    font-weight: 800;
    font-size: 92px; line-height: 1.02;
    letter-spacing: -.022em;
    margin: 0;
    text-wrap: balance;
    max-width: 15ch;
  }
  .headline .w { display: inline-block; overflow: hidden; vertical-align: bottom; padding-bottom: .08em; }
  .headline .w > span { display: inline-block; transform: translateY(112%); }
  .play .headline .w > span { animation: rise 760ms cubic-bezier(.16,1,.3,1) forwards; }
  @keyframes rise { to { transform: translateY(0); } }

  .sub {
    font-size: 30px; font-weight: 500; line-height: 1.45;
    color: var(--cream-dim);
    margin: 30px 0 0;
    max-width: 26ch;
    opacity: 0;
  }
  .play .sub { animation: fade 700ms 420ms ease forwards; }
  @keyframes fade { to { opacity: 1; } }

  .finale .headline { font-size: 128px; max-width: 12ch; }
  .finale .sub { font-size: 36px; color: var(--cream); }

  /* --- Teléfono --- */
  .phone-row { flex: 1; display: flex; justify-content: center; align-items: flex-start; }
  .phone {
    position: relative;
    transform: scale(1.22);
    transform-origin: top center;
  }
  .bezel {
    position: relative;
    width: 416px; height: 870px;
    padding: 13px;
    border-radius: 62px;
    background: linear-gradient(150deg, #4A443C 0%, #1D1A17 42%, #3B352E 100%);
    box-shadow:
      0 2px 0 rgba(255,255,255,.10) inset,
      0 44px 90px rgba(0,0,0,.55),
      0 12px 28px rgba(0,0,0,.45);
  }
  .viewport {
    position: relative;
    width: 390px; height: 844px;
    border-radius: 50px;
    overflow: hidden;
    background: #F2F0EB;
  }
  /* Recorte físico de cámara del equipo. No se dibuja barra de estado falsa:
     en un teléfono real la pinta el sistema encima. */
  .cutout {
    position: absolute; left: 50%; top: 26px; transform: translateX(-50%);
    width: 104px; height: 30px; border-radius: 999px;
    background: #17150F; z-index: 6;
  }

  /* Sistema clay, tomado del canvas de diseño. */
${clayRules}
  /* Los enlaces de la app son verdes; sin esto el navegador los pinta azules. */
  .viewport a { color: #4E8F54; text-decoration: none; }

  .screen { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
  .screen.on { opacity: 1; }
  .screen .flow { position: absolute; inset: 0; will-change: transform; }
  .screen .pin { position: absolute; inset: 0; }

  .screen.enter .flow { animation: slideIn 620ms cubic-bezier(.16,1,.3,1); }
  .screen.enter .pin { animation: fadeIn 520ms ease; }
  @keyframes slideIn { from { transform: translateX(46px); opacity: 0; } }
  @keyframes fadeIn { from { opacity: 0; } }

  .ripple {
    position: absolute; z-index: 7; pointer-events: none;
    width: 22px; height: 22px; margin: -11px 0 0 -11px;
    border-radius: 50%;
    background: rgba(31,74,38,.30);
    box-shadow: 0 0 0 2px rgba(31,74,38,.35);
    opacity: 0;
  }
  .ripple.go { animation: ripple 620ms cubic-bezier(.22,1,.36,1); }
  @keyframes ripple {
    0%   { opacity: .9; transform: scale(.4); }
    100% { opacity: 0;  transform: scale(4.6); }
  }
  [data-tap].press { transform: scale(.955); transition: transform 160ms ease; }

  /* --- Pie --- */
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 30px; padding-top: 40px; }
  .segs { display: flex; gap: 9px; flex: 1; }
  .seg { height: 5px; flex: 1; border-radius: 999px; background: rgba(242,240,235,.16); overflow: hidden; }
  .seg i { display: block; height: 100%; width: 0; background: var(--cream); border-radius: 999px; }
  .seg.done i { width: 100%; }
  .brand { font-family: var(--display); font-weight: 600; font-size: 27px; color: var(--cream-dim); white-space: nowrap; }

  /* --- Controles --- */
  /* Se desvanecen solos mientras corre para no ensuciar una grabación de
     pantalla, y vuelven al mover el mouse o tocar. */
  .controls {
    position: fixed; right: 16px; top: 16px; z-index: 20;
    display: flex; gap: 8px;
    opacity: 0; transition: opacity 420ms ease;
  }
  .controls.show, .controls:hover, .controls:focus-within { opacity: 1; }
  .controls button {
    font-family: var(--body); font-size: 14px; font-weight: 700;
    color: var(--cream); background: rgba(242,240,235,.11);
    border: 0; border-radius: 999px; padding: 11px 18px; cursor: pointer;
    min-height: 44px;
  }
  .controls button:hover { background: rgba(242,240,235,.2); }
  .controls button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .play .headline .w > span { animation: none; transform: none; }
    .play .sub { animation: none; opacity: 1; }
    .screen.enter .flow, .screen.enter .pin { animation: none; }
    .ripple.go { animation: none; }
    .glow { transition: none; }
  }
</style>

<div class="fit">
  <div class="stage" id="stage">
    <div class="glow" id="glow"></div>

    <header class="head" id="head">
      <div class="kicker" id="kicker"></div>
      <h1 class="headline" id="headline"></h1>
      <p class="sub" id="sub"></p>
    </header>

    <div class="phone-row">
      <div class="phone">
        <div class="bezel">
          <div class="viewport" id="viewport">
${screenMarkup}
            <div class="cutout"></div>
            <div class="ripple" id="ripple"></div>
          </div>
        </div>
      </div>
    </div>

    <footer class="foot">
      <div class="segs" id="segs"></div>
      <div class="brand">Somos Barrio</div>
    </footer>
  </div>
</div>

<div class="controls">
  <button id="toggle" type="button">Pausa</button>
  <button id="restart" type="button">Volver a empezar</button>
</div>

<script>
const SCENES = ${JSON.stringify(scenes)};
const TINTS = { green: '#7BC47F', terra: '#F0A868', sky: '#8FB8DE' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const stage = document.getElementById('stage');
const glow = document.getElementById('glow');
const head = document.getElementById('head');
const kickerEl = document.getElementById('kicker');
const headlineEl = document.getElementById('headline');
const subEl = document.getElementById('sub');
const ripple = document.getElementById('ripple');
const segsEl = document.getElementById('segs');
const toggleBtn = document.getElementById('toggle');

/* El lienzo es fijo; se escala para entrar entero en la ventana. */
function fitStage() {
  const k = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = 'translate(-50%, -50%) scale(' + k + ')';
}
addEventListener('resize', fitStage);
fitStage();

/*
 * Cada vista trae sus barras (tab bar, FAB) como hijos position:absolute.
 * Se separan en dos capas para poder desplazar el contenido sin arrastrar
 * las barras, igual que en la app real.
 */
const screens = {};
for (const el of document.querySelectorAll('.screen')) {
  const root = el.firstElementChild;
  const flow = document.createElement('div');
  const pin = document.createElement('div');
  flow.className = 'flow';
  pin.className = 'pin';
  for (const child of [...root.children]) {
    (child.style.position === 'absolute' ? pin : flow).appendChild(child);
  }
  root.remove();
  el.append(flow, pin);
  screens[el.dataset.screen] = { el, flow, pin, y: 0, target: 0, max: null };
}

SCENES.forEach(() => {
  const seg = document.createElement('div');
  seg.className = 'seg';
  seg.innerHTML = '<i></i>';
  segsEl.appendChild(seg);
});
const segs = [...segsEl.children];

function setCopy(scene) {
  kickerEl.textContent = scene.kicker || '';
  subEl.textContent = scene.sub;
  headlineEl.innerHTML = '';
  scene.headline.split(' ').forEach((word, i) => {
    const w = document.createElement('span');
    w.className = 'w';
    const inner = document.createElement('span');
    inner.textContent = word;
    inner.style.animationDelay = (i * 52) + 'ms';
    w.appendChild(inner);
    headlineEl.append(w, document.createTextNode(' '));
  });
}

let idx = -1;
let sceneT = 0;
let playing = true;
let fired = new Set();
let current = null;

function enterScene(i) {
  const scene = SCENES[i];
  idx = i;
  sceneT = 0;
  fired = new Set();

  glow.style.setProperty('--tint', TINTS[scene.tint]);
  stage.style.setProperty('--tint', TINTS[scene.tint]);
  head.classList.toggle('finale', !!scene.finale);

  if (current) current.el.classList.remove('on', 'enter');
  current = screens[scene.screen];
  current.y = 0;
  current.target = 0;
  current.flow.style.transform = 'translateY(0px)';
  current.el.classList.add('on');
  void current.el.offsetWidth;
  current.el.classList.add('enter');

  // Reinicia la animación de entrada del titular.
  stage.classList.remove('play');
  void stage.offsetWidth;
  setCopy(scene);
  stage.classList.add('play');

  segs.forEach((s, n) => {
    s.classList.toggle('done', n < i);
    if (n !== i) s.firstElementChild.style.width = n < i ? '100%' : '0';
  });
}

function tap(name) {
  const el = current.el.querySelector('[data-tap="' + name + '"]');
  if (!el) return;
  const box = el.getBoundingClientRect();
  const frame = current.el.getBoundingClientRect();
  const scale = frame.width / 390;
  ripple.style.left = ((box.left + box.width / 2 - frame.left) / scale) + 'px';
  ripple.style.top = ((box.top + box.height / 2 - frame.top) / scale) + 'px';
  ripple.classList.remove('go');
  void ripple.offsetWidth;
  ripple.classList.add('go');
  el.classList.add('press');
  setTimeout(() => el.classList.remove('press'), 220);
}

/** Cuánto se puede desplazar sin dejar la vista en blanco al pie. */
function maxScroll(s) {
  if (s.max === null) {
    const content = [...s.flow.children].reduce((h, c) => Math.max(h, c.offsetTop + c.offsetHeight), 0);
    s.max = Math.max(0, content - 844 + 130);
  }
  return s.max;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 80);
  last = now;

  if (playing) {
    sceneT += dt;
    const scene = SCENES[idx];

    for (const beat of scene.beats) {
      if (sceneT >= beat.at && !fired.has(beat)) {
        fired.add(beat);
        if (beat.type === 'tap') tap(beat.target);
        if (beat.type === 'scroll') current.target = Math.min(beat.to, maxScroll(current));
      }
    }

    segs[idx].firstElementChild.style.width = Math.min(100, (sceneT / scene.dur) * 100) + '%';
    if (sceneT >= scene.dur) enterScene((idx + 1) % SCENES.length);
  }

  if (current) {
    const ease = reduced ? 1 : 1 - Math.pow(0.0016, dt / 1000);
    current.y += (current.target - current.y) * ease;
    current.flow.style.transform = 'translateY(' + -current.y.toFixed(2) + 'px)';
  }

  requestAnimationFrame(frame);
}

const controls = document.querySelector('.controls');
let hideTimer;
function wake() {
  controls.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => controls.classList.remove('show'), 2600);
}
addEventListener('mousemove', wake);
addEventListener('touchstart', wake, { passive: true });
addEventListener('keydown', wake);
wake();

toggleBtn.addEventListener('click', () => {
  playing = !playing;
  toggleBtn.textContent = playing ? 'Pausa' : 'Reproducir';
});
document.getElementById('restart').addEventListener('click', () => {
  playing = true;
  toggleBtn.textContent = 'Pausa';
  enterScene(0);
});

enterScene(0);
requestAnimationFrame(frame);
</script>
`;

mkdirSync(".", { recursive: true });
writeFileSync("somos-barrio-reel.html", page);
console.log(`somos-barrio-reel.html — ${scenes.length} escenas, ${Object.keys(screens).length} vistas, ${(page.length / 1024).toFixed(0)} KB`);
console.log(`duración ${(scenes.reduce((a, s) => a + s.dur, 0) / 1000).toFixed(1)} s`);
