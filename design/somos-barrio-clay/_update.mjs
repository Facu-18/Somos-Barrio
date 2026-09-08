import { readFileSync, writeFileSync } from "node:fs";

const ICONS = {
  inicio: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  mercado: '<path d="M4 9.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M3 9.5 4.8 4.6A1 1 0 0 1 5.7 4h12.6a1 1 0 0 1 .9.6L21 9.5"/><path d="M9.5 20.5v-5h5v5"/>',
  comercios: '<rect x="3" y="7.5" width="18" height="13" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  foro: '<path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6C4.55 15.7 4 14.17 4 12.5c0-3.9 3.8-7 8.5-7s8 3.1 8 7Z"/>',
  eventos: '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"/>',
};
const LABELS = { inicio: "Inicio", mercado: "Mercado", comercios: "Comercios", foro: "Foro", eventos: "Eventos" };

function tab(key, active) {
  const inner = active
    ? `      <div class="clay-green" style="width:42px;height:32px;border-radius:13px;background:#7BC47F;display:flex;align-items:center;justify-content:center;color:#1F4A26">\n        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>\n      </div>\n      <span style="font-size:10px;font-weight:800;color:#3B7A41">${LABELS[key]}</span>`
    : `      <div style="width:42px;height:32px;display:flex;align-items:center;justify-content:center;color:#9A9188">\n        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>\n      </div>\n      <span style="font-size:10px;font-weight:600;color:#9A9188">${LABELS[key]}</span>`;
  return `    <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:70px">\n${inner}\n    </div>`;
}

function tabbar(active) {
  const items = ["inicio", "mercado", "comercios", "foro", "eventos"].map((k) => tab(k, k === active)).join("\n");
  return `  <div class="clay" style="position:absolute;left:16px;right:16px;bottom:24px;height:70px;background:#FAF8F5;border-radius:28px;display:flex;align-items:center;padding:0 4px">\n${items}\n  </div>\n\n</div>\n`;
}

const MARKER = '  <div class="clay" style="position:absolute;left:16px;right:16px;bottom:24px;';

const jobs = [
  { file: "Mercado.body.html", active: "mercado" },
  { file: "Foro.body.html", active: "foro" },
];

for (const { file, active } of jobs) {
  const src = readFileSync(file, "utf8");
  const at = src.indexOf(MARKER);
  if (at === -1) throw new Error(`marcador de tab bar no encontrado en ${file}`);
  writeFileSync(file, src.slice(0, at) + tabbar(active));
  console.log(`tab bar de 5 -> ${file}`);
}

const texts = {
  "Mercado.body.html": [
    ["Villa Crespo · 128 publicaciones", "Parque Liceo · 128 publicaciones"],
    ["Villa Crespo · hace 3 h", "Parque Liceo · hace 3 h"],
    ["Chacarita · ayer", "Parque Liceo · ayer"],
    ["Villa Crespo · hace 1 d", "Parque Liceo · hace 1 d"],
    ["Villa Crespo · hace 2 d", "Parque Liceo · hace 2 d"],
  ],
  "Foro.body.html": [
    ["Villa Crespo · 6 subforos", "Parque Liceo · 6 subforos"],
    ["Se cortó el agua en Padilla al 700, ¿a alguien más?", "Se cortó el agua en la zona norte, ¿a alguien más?"],
    ["Busco plomero de confianza por la zona de Vera", "Busco plomero de confianza acá en el barrio"],
  ],
  "Comercio.body.html": [
    ["Aguirre 1247 · Villa Crespo", "Los Álamos 1247 · Parque Liceo"],
  ],
  "Noticia.body.html": [
    ["Cortan Gurruchaga entre Castillo y Vera por el pluvial", "Cortes por la obra del pluvial hasta el viernes"],
    [
      "Aguas y Saneamiento empezó el recambio del conducto pluvial que corre por debajo de Gurruchaga. El corte total va de Castillo a Vera y se mantiene de 7 a 18 hasta el viernes.",
      "Aguas y Saneamiento empezó el recambio del conducto pluvial que corre por debajo de la avenida. El corte total se mantiene de 7 a 18 hasta el viernes.",
    ],
    [
      "Las líneas 106 y 168 desvían por Serrano y vuelven a su recorrido en Padilla. No hay cambios en las paradas de Corrientes.",
      "Las líneas que entran al barrio desvían por el boulevard y retoman su recorrido dos cuadras después. No hay cambios en las paradas de la avenida.",
    ],
    ["Los vecinos de la cuadra pueden pedir el permiso de acceso vehicular en la comuna.", "Los vecinos de la cuadra pueden pedir el permiso de acceso vehicular en el centro vecinal."],
  ],
};

for (const [file, pairs] of Object.entries(texts)) {
  let src = readFileSync(file, "utf8");
  for (const [from, to] of pairs) {
    if (!src.includes(from)) throw new Error(`no encontrado en ${file}: ${from.slice(0, 50)}`);
    src = src.split(from).join(to);
  }
  writeFileSync(file, src);
  console.log(`textos -> ${file}`);
}
