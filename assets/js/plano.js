/* Bosques Amador: plano interactivo, videos de fondo y datos de contacto.
   Dibuja los lotes sobre el plano, permite zoom/arrastre, búsqueda y filtros,
   y muestra la ficha del lote seleccionado. */
(function () {
  "use strict";

  const CONFIG = window.CONFIG || {};
  const LOTES = window.LOTES || [];
  const AREA = window.AREA_COMUN || [];
  const NS = "http://www.w3.org/2000/svg";
  const VB = { x: 195, y: 60, w: 650, h: 645 }; // Recorte del plano (coordenadas del PDF)

  const $ = (sel) => document.querySelector(sel);
  const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: CONFIG.moneda || "MXN", maximumFractionDigits: 0 });
  const num = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ESTADOS = { disponible: "Disponible", apartado: "Apartado", vendido: "Vendido" };
  const ZONAS = { carretera: "A orilla de carretera y con calle", medio: "En medio del predio" };
  const NOTAS = { 9: "Colinda con el área común de bosque.", 19: "Colinda con el área común de bosque." };

  LOTES.forEach((l) => (l.id = String(l.numero)));
  const porId = new Map(LOTES.map((l) => [l.id, l]));
  const porM2 = (l) => Math.round(l.precio / l.superficie);

  /* ---------- Contacto ---------- */
  const whatsappUrl = (msg) =>
    CONFIG.whatsapp ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}` : null;
  const MENSAJE_GENERAL = "Hola, vi la página de Bosques Amador en Zacatlán y me interesa un lote. ¿Me dan información y agendamos una visita?";

  function configurarContacto() {
    const wa = whatsappUrl(MENSAJE_GENERAL);
    const cw = $("#c-whatsapp"), ct = $("#c-telefono"), cc = $("#c-correo"), flot = $("#whatsapp-flotante");
    if (wa) { cw.href = wa; flot.href = wa; flot.hidden = false; } else cw.hidden = true;
    if (CONFIG.telefono) { ct.href = "tel:+52" + CONFIG.telefono.replace(/\s+/g, ""); ct.textContent = "Llamar al " + CONFIG.telefono; } else ct.hidden = true;
    if (CONFIG.correo) { cc.href = "mailto:" + CONFIG.correo; cc.textContent = CONFIG.correo; } else cc.hidden = true;
    if (CONFIG.mapaUrl) $("#abrir-mapa").href = CONFIG.mapaUrl;
  }

  /* ---------- Videos de fondo: se cargan solo cuando se ven ---------- */
  function configurarVideos() {
    const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const videos = document.querySelectorAll("video[data-src]");
    const movil = matchMedia("(max-width: 700px)").matches;
    // En celular se usan versiones verticales (más nítidas en pantallas altas)
    if (movil) videos.forEach((v) => { if (v.dataset.posterMovil) v.poster = v.dataset.posterMovil; });
    if (sinMovimiento) return; // se queda la imagen fija (poster)
    const cargar = (v) => {
      if (!v.src) { v.src = (movil && v.dataset.srcMovil) || v.dataset.src; }
      const p = v.play(); if (p) p.catch(() => {});
    };
    if (!("IntersectionObserver" in window)) { videos.forEach(cargar); return; }
    const io = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => { if (e.isIntersecting) cargar(e.target); else e.target.pause(); });
    }, { rootMargin: "200px 0px" });
    videos.forEach((v) => io.observe(v));

    const iframe = $("#mapa-google");
    if (iframe && CONFIG.mapaEmbed) {
      const io2 = new IntersectionObserver((es) => {
        if (es[0].isIntersecting) { iframe.src = CONFIG.mapaEmbed; io2.disconnect(); }
      }, { rootMargin: "400px 0px" });
      io2.observe(iframe);
    }
  }

  /* ---------- Datos resumidos ---------- */
  function resumen() {
    const disp = LOTES.filter((l) => l.estado === "disponible");
    const base = disp.length ? disp : LOTES;
    const minSup = Math.min(...LOTES.map((l) => l.superficie));
    const maxSup = Math.max(...LOTES.map((l) => l.superficie));
    const desde = Math.min(...base.map((l) => l.precio));

    $("[data-dato=total]").textContent = LOTES.length;
    $("[data-dato=min]").textContent = `${Math.floor(minSup)} m²`;
    $("[data-dato=desde]").textContent = dinero.format(desde);
    $("[data-dato=max]").textContent = `${new Intl.NumberFormat("es-MX").format(Math.floor(maxSup))} m²`;

    $("#resumen").innerHTML = `
      <div><dt>Disponibles</dt><dd>${disp.length} de ${LOTES.length}</dd></div>
      <div><dt>Superficies</dt><dd>${num.format(minSup)} a ${num.format(maxSup)} m²</dd></div>
      <div><dt>Precio desde</dt><dd>${dinero.format(desde)}</dd></div>`;

    const ol = $("#zonas-lista");
    Object.entries(ZONAS).forEach(([z, nombre]) => {
      const ls = LOTES.filter((l) => l.zona === z);
      const nums = ls.map((l) => l.numero);
      const d = ls.filter((l) => l.estado === "disponible").length;
      const li = document.createElement("li");
      li.innerHTML = `<button type="button" data-zona="${z}">
        <span class="z-nombre">${nombre}</span>
        <span class="z-rango">Lotes ${Math.min(...nums)} al ${Math.max(...nums)}</span>
        <span class="z-disp">${d} disp.</span></button>`;
      ol.appendChild(li);
    });
    ol.addEventListener("click", (e) => {
      const b = e.target.closest("[data-zona]");
      if (!b) return;
      enfocarCaja(cajaDe(LOTES.filter((l) => l.zona === b.dataset.zona).map((l) => l.poly)), 1.15);
      document.getElementById("mapa").scrollIntoView({ behavior: suave(), block: "center" });
    });
  }

  /* ---------- Dibujo ---------- */
  const svg = $("#mapa-svg");
  const capa = $("#capa-lotes");
  const capaArea = $("#capa-area");
  const nodos = new Map();
  let areaNodo = null;

  function dibujar() {
    const frag = document.createDocumentFragment();
    LOTES.forEach((l) => {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "lote");
      g.dataset.id = l.id;
      g.dataset.estado = l.estado;
      const p = document.createElementNS(NS, "polygon");
      p.setAttribute("points", l.poly.map((q) => q.join(",")).join(" "));
      p.setAttribute("tabindex", "0");
      p.setAttribute("role", "button");
      p.setAttribute("aria-label", `Lote ${l.numero}, ${num.format(l.superficie)} metros cuadrados, ${ESTADOS[l.estado]}`);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", l.centro[0]);
      t.setAttribute("y", l.centro[1]);
      t.textContent = l.numero;
      g.append(p, t);
      frag.appendChild(g);
      nodos.set(l.id, g);
    });
    capa.appendChild(frag);

    if (AREA.length) {
      areaNodo = document.createElementNS(NS, "polygon");
      areaNodo.setAttribute("class", "area-poly");
      areaNodo.setAttribute("points", AREA.map((q) => q.join(",")).join(" "));
      areaNodo.setAttribute("tabindex", "0");
      areaNodo.setAttribute("role", "button");
      areaNodo.setAttribute("aria-label", "Área común: una hectárea de bosque con senderos, asadores y palapas");
      capaArea.appendChild(areaNodo);
    }
  }

  /* ---------- Lotes simulados sobre la foto del predio ----------
     Foto: cuadro del segundo 40 del video del dron (H_orbita), en pixeles del 4K original.
     Las coordenadas del plano se proyectan con una transformación de perspectiva definida
     por las dos líneas de arbolitos que limitan los lotes 10 al 28:
     - 2a línea (orilla de los lotes 10 al 19), desde la calle principal hasta el bosque.
     - 3a línea (orilla de los lotes 20 al 28 y 19), antes de las dos líneas blancas.
     Con eso los lotes 1 al 9 quedan entre la carretera y la 1a línea de arbolitos.
     El área común es el bosque de la parte de abajo. */
  const ESQUINAS_PLANO = [[674, 149], [806, 202], [488, 614], [376, 539]];
  const ESQUINAS_FOTO = [[1865, 405], [2410, 370], [2560, 920], [1670, 890]];
  const AREA_FOTO = [[930, 1040], [1250, 955], [1660, 905], [2560, 935], [2900, 900], [2900, 1500], [700, 1500], [700, 1180]];

  function perspectiva(de, a) {
    // Resuelve los 8 coeficientes de la homografía (eliminación de Gauss).
    const m = [];
    de.forEach(([x, y], i) => {
      const [u, v] = a[i];
      m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    });
    for (let c = 0; c < 8; c++) {
      let piv = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      [m[c], m[piv]] = [m[piv], m[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = m[r][c] / m[c][c];
        for (let k = c; k < 9; k++) m[r][k] -= f * m[c][k];
      }
    }
    const h = m.map((fila, i) => fila[8] / fila[i]);
    return ([x, y]) => {
      const w = h[6] * x + h[7] * y + 1;
      return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
    };
  }

  function dibujarFoto() {
    const capaFoto = $("#foto-lotes"), capaFotoArea = $("#foto-area");
    if (!capaFoto) return;
    const proyectar = perspectiva(ESQUINAS_PLANO, ESQUINAS_FOTO);
    const puntos = (poly) => poly.map((q) => proyectar(q).map((n) => n.toFixed(1)).join(",")).join(" ");

    LOTES.forEach((l) => {
      const a = document.createElementNS(NS, "a");
      a.setAttribute("href", `#lote-${l.id}`);
      a.setAttribute("class", "foto-lote");
      a.setAttribute("aria-label", `Lote ${l.numero}, ${ESTADOS[l.estado]}. Ver en el plano`);
      a.dataset.estado = l.estado;
      const p = document.createElementNS(NS, "polygon");
      p.setAttribute("points", puntos(l.poly));
      const [cx, cy] = proyectar(l.centro);
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", cx.toFixed(1));
      t.setAttribute("y", cy.toFixed(1));
      // El número se ajusta a lo alto del lote en la foto (los de arriba se ven más angostos).
      const ys = l.poly.map((q) => proyectar(q)[1]);
      t.setAttribute("font-size", Math.round(Math.min(Math.max((Math.max(...ys) - Math.min(...ys)) * 0.62, 20), 44)));
      t.textContent = l.numero;
      a.append(p, t);
      capaFoto.appendChild(a);
    });

    {
      const g = document.createElementNS(NS, "g");
      g.setAttribute("class", "foto-area");
      const p = document.createElementNS(NS, "polygon");
      p.setAttribute("points", AREA_FOTO.map((q) => q.join(",")).join(" "));
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", 1800);
      t.setAttribute("y", 1240);
      t.textContent = "Área común · senderos";
      g.append(p, t);
      capaFotoArea.appendChild(g);
    }
  }

  /* ---------- Vista (zoom y arrastre) ---------- */
  const vista = { ...VB };
  const ZOOM_MAX = 6;

  function aplicarVista() {
    svg.setAttribute("viewBox", `${vista.x} ${vista.y} ${vista.w} ${vista.h}`);
    svg.classList.toggle("zoom", VB.w / vista.w > 1.01);
  }

  function limitar() {
    vista.w = Math.min(Math.max(vista.w, VB.w / ZOOM_MAX), VB.w);
    vista.h = vista.w * (VB.h / VB.w);
    vista.x = Math.min(Math.max(vista.x, VB.x), VB.x + VB.w - vista.w);
    vista.y = Math.min(Math.max(vista.y, VB.y), VB.y + VB.h - vista.h);
  }

  function puntoSvg(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    const esc = Math.min(r.width / vista.w, r.height / vista.h);
    const ox = (r.width - vista.w * esc) / 2, oy = (r.height - vista.h * esc) / 2;
    return { x: vista.x + (clientX - r.left - ox) / esc, y: vista.y + (clientY - r.top - oy) / esc, esc };
  }

  function zoomEn(factor, cx, cy) {
    const nw = Math.min(Math.max(vista.w / factor, VB.w / ZOOM_MAX), VB.w);
    const f = nw / vista.w;
    vista.x = cx - (cx - vista.x) * f;
    vista.y = cy - (cy - vista.y) * f;
    vista.w = nw;
    limitar();
    aplicarVista();
  }

  let animacion = null;
  const suave = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

  function animarA(dest) {
    cancelAnimationFrame(animacion);
    if (suave() === "auto") { Object.assign(vista, dest); limitar(); aplicarVista(); return; }
    const ini = { ...vista }, t0 = performance.now(), dur = 420;
    const paso = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      vista.x = ini.x + (dest.x - ini.x) * e; vista.y = ini.y + (dest.y - ini.y) * e;
      vista.w = ini.w + (dest.w - ini.w) * e; vista.h = ini.h + (dest.h - ini.h) * e;
      aplicarVista();
      if (p < 1) animacion = requestAnimationFrame(paso);
    };
    animacion = requestAnimationFrame(paso);
  }

  function cajaDe(polys) {
    const xs = [], ys = [];
    polys.forEach((poly) => poly.forEach(([x, y]) => { xs.push(x); ys.push(y); }));
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }

  function enfocarCaja(c, margen) {
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    let w = Math.max((c.x1 - c.x0) * margen, ((c.y1 - c.y0) * margen * VB.w) / VB.h);
    w = Math.min(Math.max(w, VB.w / ZOOM_MAX), VB.w);
    const h = (w * VB.h) / VB.w;
    const dest = { x: cx - w / 2, y: cy - h / 2, w, h };
    dest.x = Math.min(Math.max(dest.x, VB.x), VB.x + VB.w - w);
    dest.y = Math.min(Math.max(dest.y, VB.y), VB.y + VB.h - h);
    animarA(dest);
  }

  function enfocarLote(l) {
    const c = cajaDe([l.poly]);
    const pad = 70;
    enfocarCaja({ x0: c.x0 - pad, y0: c.y0 - pad, x1: c.x1 + pad, y1: c.y1 + pad }, 1);
  }

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    cancelAnimationFrame(animacion);
    const p = puntoSvg(e.clientX, e.clientY);
    zoomEn(Math.exp(-e.deltaY * 0.0018), p.x, p.y);
  }, { passive: false });

  const punteros = new Map();
  let arrastre = null, movido = false, pellizco = null;

  svg.addEventListener("pointerdown", (e) => {
    cancelAnimationFrame(animacion);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    movido = false;
    if (punteros.size === 1) arrastre = { x: e.clientX, y: e.clientY, vx: vista.x, vy: vista.y };
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      pellizco = { d: Math.hypot(a.x - b.x, a.y - b.y), w: vista.w };
      arrastre = null;
    }
  });

  svg.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) { mostrarTooltip(e); return; }
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pellizco && punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const centro = puntoSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomEn(vista.w / (pellizco.w * (pellizco.d / d)), centro.x, centro.y);
      movido = true;
      return;
    }
    if (arrastre) {
      const dx = e.clientX - arrastre.x, dy = e.clientY - arrastre.y;
      if (!movido && Math.hypot(dx, dy) < 6) return;
      // Sin zoom, el arrastre con un dedo debe desplazar la página, no el plano.
      if (e.pointerType !== "mouse" && !svg.classList.contains("zoom")) return;
      if (!movido) { svg.setPointerCapture(e.pointerId); svg.classList.add("arrastrando"); ocultarTooltip(); }
      movido = true;
      const esc = puntoSvg(0, 0).esc;
      vista.x = arrastre.vx - dx / esc;
      vista.y = arrastre.vy - dy / esc;
      limitar();
      aplicarVista();
    }
  });

  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) pellizco = null;
    if (punteros.size === 0) { arrastre = null; svg.classList.remove("arrastrando"); }
  };
  svg.addEventListener("pointerup", soltar);
  svg.addEventListener("pointercancel", soltar);
  svg.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") ocultarTooltip(); });

  $("#zoom-mas").addEventListener("click", () => zoomEn(1.6, vista.x + vista.w / 2, vista.y + vista.h / 2));
  $("#zoom-menos").addEventListener("click", () => zoomEn(1 / 1.6, vista.x + vista.w / 2, vista.y + vista.h / 2));
  $("#zoom-reset").addEventListener("click", () => animarA({ ...VB }));

  /* ---------- Tooltip ---------- */
  const tip = $("#tooltip");
  const mapa = $("#mapa");

  function mostrarTooltip(e) {
    if (e.pointerType && e.pointerType !== "mouse") return;
    const g = e.target.closest(".lote, .area-poly");
    if (!g) { ocultarTooltip(); return; }
    if (g.classList.contains("lote")) {
      const l = porId.get(g.dataset.id);
      tip.innerHTML = `<strong>Lote ${l.numero}</strong><span>${num.format(l.superficie)} m² · ${dinero.format(l.precio)}</span><span class="tip-${l.estado}">${ESTADOS[l.estado]}</span>`;
    } else {
      tip.innerHTML = `<strong>Área común</strong><span>Bosque, senderos, asadores y palapas</span>`;
    }
    const r = mapa.getBoundingClientRect();
    tip.hidden = false;
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 16;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > r.width - 8) x = e.clientX - r.left - tw - 14;
    if (y + th > r.height - 8) y = e.clientY - r.top - th - 12;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }
  function ocultarTooltip() { tip.hidden = true; }

  /* ---------- Selección y ficha ---------- */
  let seleccionado = null;
  const ficha = $("#ficha");

  function limpiarSeleccion() {
    if (seleccionado) nodos.get(seleccionado)?.classList.remove("activo");
    areaNodo?.classList.remove("activo");
    seleccionado = null;
  }

  const fichaFlotante = matchMedia("(max-width: 960px)");
  let scrollGuardado = null;

  function fijarPagina() {
    if (!fichaFlotante.matches || scrollGuardado !== null) return;
    scrollGuardado = window.scrollY;
    document.body.style.top = `-${scrollGuardado}px`;
    document.body.classList.add("pagina-fija");
  }

  function soltarPagina() {
    if (scrollGuardado === null) return;
    document.body.classList.remove("pagina-fija");
    document.body.style.top = "";
    document.documentElement.style.scrollBehavior = "auto";
    window.scrollTo(0, scrollGuardado);
    document.documentElement.style.scrollBehavior = "";
    scrollGuardado = null;
  }

  function abrirPanel(id) {
    ["#ficha-vacia", "#ficha-lote", "#ficha-area"].forEach((s) => ($(s).hidden = s !== id));
    ficha.classList.add("abierta");
    document.body.classList.add("ficha-abierta");
    fijarPagina();
  }

  function seleccionar(id, { enfocar = false, desdeHash = false } = {}) {
    const l = porId.get(id);
    if (!l) { cerrarFicha(); return; }
    limpiarSeleccion();
    seleccionado = id;
    const g = nodos.get(id);
    g.classList.add("activo");
    g.parentNode.appendChild(g);

    $("#f-zona").textContent = ZONAS[l.zona];
    $("#f-numero").textContent = l.numero;
    const est = $("#f-estado");
    est.textContent = ESTADOS[l.estado];
    est.className = `estado estado-${l.estado}`;
    $("#f-superficie").textContent = `${num.format(l.superficie)} m²`;
    $("#f-ubicacion").textContent = l.zona === "carretera" ? "Frente a carretera" : "En medio del predio";
    $("#f-precio").textContent = dinero.format(l.precio);
    $("#f-precio-nota").textContent = `Equivale a ${dinero.format(porM2(l))} por m²`;
    const nota = $("#f-nota");
    nota.hidden = !NOTAS[l.numero];
    nota.textContent = NOTAS[l.numero] || "";

    const wa = $("#f-whatsapp");
    const url = whatsappUrl(`Hola, me interesa el Lote ${l.numero} (${num.format(l.superficie)} m²) de Bosques Amador en Zacatlán. ¿Me pueden dar más información?`);
    wa.hidden = l.estado === "vendido";
    if (url) { wa.href = url; wa.target = "_blank"; } else { wa.href = "#contacto"; wa.removeAttribute("target"); }

    abrirPanel("#ficha-lote");
    if (!desdeHash) history.replaceState(null, "", `#lote-${l.id}`);
    if (enfocar) enfocarLote(l);
  }

  function seleccionarArea({ enfocar = false } = {}) {
    limpiarSeleccion();
    areaNodo?.classList.add("activo");
    abrirPanel("#ficha-area");
    if (enfocar) enfocarCaja(cajaDe([AREA]), 1.15);
  }

  function cerrarFicha() {
    limpiarSeleccion();
    $("#ficha-vacia").hidden = false;
    $("#ficha-lote").hidden = true;
    $("#ficha-area").hidden = true;
    ficha.classList.remove("abierta");
    document.body.classList.remove("ficha-abierta");
    soltarPagina();
    if (location.hash.startsWith("#lote-")) history.replaceState(null, "", "#plano");
  }

  svg.addEventListener("click", (e) => {
    if (movido) return;
    const g = e.target.closest(".lote");
    if (g) { if (g.dataset.id === seleccionado) cerrarFicha(); else seleccionar(g.dataset.id); return; }
    if (e.target.closest(".area-poly")) { areaNodo.classList.contains("activo") ? cerrarFicha() : seleccionarArea(); }
  });
  svg.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const g = e.target.closest(".lote");
    if (g) { e.preventDefault(); seleccionar(g.dataset.id, { enfocar: true }); return; }
    if (e.target.closest(".area-poly")) { e.preventDefault(); seleccionarArea({ enfocar: true }); }
  });

  $("#ficha-cerrar").addEventListener("click", cerrarFicha);
  $("#area-cerrar").addEventListener("click", cerrarFicha);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ficha.classList.contains("abierta")) cerrarFicha(); });

  document.querySelectorAll("[data-ver-area]").forEach((a) =>
    a.addEventListener("click", () => setTimeout(() => seleccionarArea({ enfocar: true }), 350)));

  $("#f-compartir").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    const url = location.href.split("#")[0] + `#lote-${seleccionado}`;
    try { await navigator.clipboard.writeText(url); b.textContent = "Enlace copiado"; }
    catch { b.textContent = url; }
    setTimeout(() => (b.textContent = "Copiar enlace a este lote"), 2200);
  });

  /* ---------- Búsqueda y filtros ---------- */
  const buscar = $("#buscar");
  buscar.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = buscar.value.trim().toLowerCase().replace(/^lote\s*/, "");
    const l = porId.get(String(parseInt(v, 10)));
    if (l) { seleccionar(l.id, { enfocar: true }); buscar.setCustomValidity(""); }
    else { buscar.setCustomValidity(`No existe ese número de lote. Los lotes van del 1 al ${LOTES.length}.`); buscar.reportValidity(); }
  });
  buscar.addEventListener("input", () => buscar.setCustomValidity(""));

  const PRUEBAS = {
    todos: () => true,
    disponible: (l) => l.estado === "disponible",
    carretera: (l) => l.zona === "carretera",
    medio: (l) => l.zona === "medio",
  };
  document.querySelector(".filtros").addEventListener("click", (e) => {
    const b = e.target.closest("[data-filtro]");
    if (!b) return;
    document.querySelectorAll("[data-filtro]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const prueba = PRUEBAS[b.dataset.filtro];
    const hay = b.dataset.filtro !== "todos";
    LOTES.forEach((l) => {
      const g = nodos.get(l.id);
      g.classList.toggle("atenuado", !prueba(l));
      g.classList.toggle("resaltado", hay && prueba(l));
    });
  });

  /* ---------- Barra superior ---------- */
  const barra = $("#barra");
  const marcarBarra = () => barra.classList.toggle("solida", window.scrollY > 40);
  window.addEventListener("scroll", marcarBarra, { passive: true });

  /* ---------- Inicio ---------- */
  configurarContacto();
  configurarVideos();
  dibujar();
  dibujarFoto();
  resumen();
  aplicarVista();
  marcarBarra();

  function desdeHash() {
    const m = location.hash.match(/^#lote-(\d+)$/);
    if (m && porId.has(m[1])) {
      // Primero se baja al plano y luego se abre la ficha (en celular la ficha fija la página).
      document.documentElement.style.scrollBehavior = "auto";
      document.getElementById("plano").scrollIntoView();
      document.documentElement.style.scrollBehavior = "";
      seleccionar(m[1], { enfocar: true, desdeHash: true });
    }
  }
  window.addEventListener("hashchange", desdeHash);
  desdeHash();
})();
