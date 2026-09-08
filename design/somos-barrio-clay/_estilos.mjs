import { readFileSync, writeFileSync } from "node:fs";

const FILE = "Estilos.body.html";
const MARKER = '      <div style="font-size:12px;font-weight:800;color:#8A827A;letter-spacing:.1em">COMPONENTES</div>';

const ICONS = {
  inicio: '<path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  mercado: '<path d="M4 9.5h16V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M3 9.5 4.8 4.6A1 1 0 0 1 5.7 4h12.6a1 1 0 0 1 .9.6L21 9.5"/><path d="M9.5 20.5v-5h5v5"/>',
  comercios: '<rect x="3" y="7.5" width="18" height="13" rx="2.5"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/><path d="M3 12.5h18"/>',
  foro: '<path d="M20.5 12.5c0 3.9-3.8 7-8.5 7-1 0-2-.15-2.9-.42L4 20.5l1.5-3.6C4.55 15.7 4 14.17 4 12.5c0-3.9 3.8-7 8.5-7s8 3.1 8 7Z"/>',
  eventos: '<rect x="3.5" y="5.5" width="17" height="15" rx="3"/><path d="M8 3.5v4M16 3.5v4M3.5 10.5h17"/>',
};
const LABELS = { inicio: "Inicio", mercado: "Mercado", comercios: "Comercios", foro: "Foro", eventos: "Eventos" };

const tab = (key, active) => {
  const inner = active
    ? `          <div class="clay-green" style="width:42px;height:32px;border-radius:13px;background:#7BC47F;display:flex;align-items:center;justify-content:center;color:#1F4A26">\n            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>\n          </div>\n          <span style="font-size:10px;font-weight:800;color:#3B7A41">${LABELS[key]}</span>`
    : `          <div style="width:42px;height:32px;display:flex;align-items:center;justify-content:center;color:#9A9188">\n            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[key]}</svg>\n          </div>\n          <span style="font-size:10px;font-weight:600;color:#9A9188">${LABELS[key]}</span>`;
  return `        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;width:70px">\n${inner}\n        </div>`;
};
const tabbar = ["inicio", "mercado", "comercios", "foro", "eventos"].map((k) => tab(k, k === "inicio")).join("\n");

const block = `      <div style="font-size:12px;font-weight:800;color:#8A827A;letter-spacing:.1em">COMPONENTES</div>

      <div style="display:flex;gap:12px">
        <div class="clay-green" style="flex-grow:1;height:56px;border-radius:999px;background:#7BC47F;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#1F4A26">Primario</div>
        <div class="clay" style="flex-grow:1;height:56px;border-radius:999px;background:#FAF8F5;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#756C63">Secundario</div>
      </div>

      <div class="clay" style="height:56px;border-radius:999px;background:#FAF8F5;display:flex;align-items:center;justify-content:center;gap:9px;color:#B4553F">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12h9"/></svg>
        <span style="font-size:16px;font-weight:700">Destructivo</span>
      </div>

      <div class="clay-sunk" style="height:56px;background:#EDEAE3;border-radius:20px;display:flex;align-items:center;gap:11px;padding:0 18px">
        <span style="display:flex;color:#8A827A;flex-shrink:0"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></span>
        <span style="font-size:15px;font-weight:500;color:#9A9188">Buscar en el barrio</span>
      </div>

      <div class="clay-sunk" style="height:54px;background:#EDEAE3;border-radius:999px;display:flex;align-items:center;padding:5px">
        <div class="clay" style="flex-grow:1;height:44px;border-radius:999px;background:#FAF8F5;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:800;color:#3B3733">Próximos</div>
        <div style="flex-grow:1;height:44px;display:flex;align-items:center;justify-content:center;font-size:14.5px;font-weight:600;color:#8A827A">Pasados</div>
      </div>

      <div style="display:flex;align-items:center;gap:10px">
        <div class="clay" style="height:44px;background:#FAF8F5;border-radius:999px;padding:0 20px;display:flex;align-items:center;font-size:14px;font-weight:700;color:#3B3733">Activo</div>
        <div style="height:44px;background:#EBE8E1;border-radius:999px;padding:0 18px;display:flex;align-items:center;font-size:14px;font-weight:600;color:#756C63">Inactivo</div>
        <div class="clay-sm" style="width:44px;height:44px;border-radius:50%;background:#DFEEE0;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#2F5C34">JU</div>
        <div class="clay-green" style="height:52px;border-radius:999px;background:#7BC47F;display:flex;align-items:center;gap:8px;padding:0 20px;color:#1F4A26">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5h3.2L18.4 8.8a1.6 1.6 0 0 0 0-2.3l-1-1a1.6 1.6 0 0 0-2.3 0L4.5 16.3z"/></svg>
          <span style="font-size:14px;font-weight:800">FAB extendido</span>
        </div>
      </div>

      <div class="clay" style="background:#FAF8F5;border-radius:28px;padding:18px 20px;display:flex;flex-direction:column;gap:9px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="background:#E2ECF6;color:#3E6288;font-size:11px;font-weight:800;padding:6px 13px;border-radius:999px">Eventos</span>
          <span style="font-size:12px;font-weight:700;color:#8A827A">ayer</span>
        </div>
        <div style="font-size:19px;font-weight:700;line-height:1.28;color:#3B3733">Card de contenido</div>
        <div style="font-size:14px;font-weight:400;line-height:1.5;color:#756C63">Radio 28, padding 18–20, sombra elevada. Nunca anidar una card dentro de otra.</div>
      </div>

      <div class="clay" style="height:70px;background:#FAF8F5;border-radius:28px;display:flex;align-items:center;padding:0 4px">
${tabbar}
      </div>

      <div style="font-size:12.5px;font-weight:600;color:#8A827A">Altura mínima de toque 44 px. El botón primario lleva texto verde oscuro (#1F4A26), no blanco: sobre #7BC47F el blanco queda en 2:1. El destructivo va sobre superficie clara con texto #B4553F, nunca como barra roja llena.</div>
    </div>

  </div>

  <div style="display:flex;flex-direction:column;gap:16px">
    <div style="font-size:12px;font-weight:800;color:#8A827A;letter-spacing:.1em">ESTADO VACÍO</div>
    <div style="display:flex;gap:34px;align-items:flex-start">

      <div class="clay-sunk" style="width:300px;border-radius:28px;background:#EDEAE3;padding:34px 26px;display:flex;flex-direction:column;align-items:center;gap:16px">
        <div class="clay" style="width:88px;height:88px;border-radius:32px;background:#FAF8F5;display:flex;align-items:center;justify-content:center;color:#A8C3A9">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18.5 4.5h-13a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h11a1.5 1.5 0 0 0 1.5-1.5V5.5a1 1 0 0 0-.5-1Z"/><path d="M7.5 8h8M7.5 11.5h8M7.5 15h5"/></svg>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:7px">
          <div style="font-size:18px;font-weight:800;color:#3B3733;text-align:center">Todavía no hay novedades</div>
          <div style="font-size:14px;font-weight:400;line-height:1.55;color:#8A827A;text-align:center">Sé la primera persona en contar algo que pasa en el barrio.</div>
        </div>
        <div class="clay-green" style="height:50px;border-radius:999px;background:#7BC47F;display:flex;align-items:center;padding:0 24px;font-size:14.5px;font-weight:800;color:#1F4A26;margin-top:2px">Proponer una nota</div>
      </div>

      <div style="display:flex;flex-direction:column;gap:14px;padding-top:6px;flex-grow:1">
        <div style="font-size:14.5px;font-weight:700;color:#3B3733">Tres piezas, siempre en este orden</div>
        <div style="font-size:13.5px;font-weight:400;line-height:1.6;color:#756C63">1. Ícono en tile clay elevado, trazo fino y color apagado — nunca una ilustración grande.<br>2. Qué pasa, en una línea afirmativa. Sin “Error” ni “No se encontraron resultados”.<br>3. Qué hacer: un botón primario con la acción concreta. Si no hay acción posible, se omite.</div>
        <div style="font-size:13.5px;font-weight:400;line-height:1.6;color:#756C63;padding-top:2px">Bloque centrado a ~30% de la altura, no en el medio exacto: queda más cerca del pulgar y no compite con el header.</div>
        <div style="display:flex;flex-direction:column;gap:6px;padding-top:6px">
          <div style="font-size:12.5px;font-weight:700;color:#3B3733">Copys por pantalla</div>
          <div style="font-size:13px;font-weight:400;line-height:1.7;color:#756C63">Eventos · “No hay eventos próximos” + “Organizá el primero”<br>Mercado · “Todavía nadie publicó nada” + “Publicar algo”<br>Foro · “Este subforo está vacío” + “Abrir un tema”</div>
        </div>
      </div>

    </div>
  </div>

</div>
`;

const src = readFileSync(FILE, "utf8");
const at = src.indexOf(MARKER);
if (at === -1) throw new Error("marcador COMPONENTES no encontrado");
let out = src.slice(0, at) + block;
out = out.replace("height:1240px", "height:1500px");
if (!out.includes("height:1500px")) throw new Error("no se pudo ajustar la altura");
writeFileSync(FILE, out);
console.log("Estilos.body.html actualizado");
