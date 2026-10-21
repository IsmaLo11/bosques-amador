/* Bosques Amador · Administración de ventas, pagos y lotes (Supabase).
   La seguridad real está en la base de datos (reglas por rol); esta página solo
   muestra u oculta botones según el rol del usuario. */
(function () {
  "use strict";

  const CONFIG = window.CONFIG || {};
  const sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const contenido = $("#contenido");

  /* ---------- Formatos ---------- */
  const dinero = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const dinero0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const dec2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n) => `${dec2.format(Number(n) * 100).replace(/\.00$/, "")}%`;
  const m2 = (n) => `${dec2.format(n)} m²`;
  const fecha = (s) => (s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—");
  const hoyISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const sumarDias = (iso, dias) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const slug = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
  const chip = (s) => `<span class="chip chip-${slug(s)}">${esc(s)}</span>`;
  const redondear = (n) => Math.round(Number(n) * 100) / 100;
  const suma = (lista, campo) => lista.reduce((t, x) => t + Number(x[campo] || 0), 0);

  /* ---------- Avisos ---------- */
  let toastTimer;
  function toast(mensaje, error = false) {
    const t = $("#toast");
    t.textContent = mensaje;
    t.classList.toggle("error", error);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), error ? 6000 : 3500);
  }

  const MENSAJES = {
    "Invalid login credentials": "Correo o contraseña incorrectos.",
    "Email not confirmed": "Este correo todavía no está confirmado.",
    ventas_una_activa_por_lote: "Ese lote ya tiene una venta activa.",
  };
  function textoError(e) {
    const m = e?.message || String(e);
    for (const [clave, texto] of Object.entries(MENSAJES)) if (m.includes(clave)) return texto;
    if (e?.code === "42501" || m.includes("row-level security")) return "No tienes permiso para hacer esto.";
    return m;
  }

  // Confirmación con ventana propia (en lugar de la del navegador)
  function confirmar(mensaje, textoBoton = "Sí, continuar") {
    return new Promise((resolver) => {
      const dlg = document.createElement("dialog");
      dlg.className = "dialogo";
      dlg.innerHTML = `<form method="dialog" class="form-pago">
        <p>${esc(mensaje)}</p>
        <div class="acciones">
          <button class="boton boton-texto" value="no">No</button>
          <button class="boton boton-peligro" value="si">${esc(textoBoton)}</button>
        </div></form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("close", () => { resolver(dlg.returnValue === "si"); dlg.remove(); });
      dlg.showModal();
    });
  }

  // Ejecuta una consulta de Supabase y lanza el error si lo hay.
  async function q(consulta) {
    const { data, error } = await consulta;
    if (error) throw error;
    return data;
  }

  /* ---------- Sesión ---------- */
  let perfil = null;
  const esAdmin = () => perfil?.rol === "admin";

  function mostrarEntrar(mensaje) {
    perfil = null;
    $("#vista-app").hidden = true;
    $("#vista-entrar").hidden = false;
    const err = $("#entrar-error");
    err.hidden = !mensaje;
    err.textContent = mensaje || "";
    setTimeout(() => $("#entrar-correo").focus(), 0);
  }

  async function entrarConSesion(usuario) {
    try {
      perfil = await q(sb.from("perfiles").select("nombre, rol, activo").eq("id", usuario.id).maybeSingle());
    } catch (e) {
      perfil = null;
    }
    if (!perfil || !perfil.activo || !["admin", "vendedor", "consulta"].includes(perfil.rol)) {
      await sb.auth.signOut();
      mostrarEntrar("Tu usuario todavía no tiene acceso. Pide a un administrador que te asigne un rol.");
      return;
    }
    $("#usuario-nombre").textContent = `${perfil.nombre} · ${perfil.rol}`;
    document.querySelectorAll("[data-solo-admin]").forEach((el) => (el.hidden = !esAdmin()));
    $("#vista-entrar").hidden = true;
    $("#vista-app").hidden = false;
    rutear();
  }

  $("#form-entrar").addEventListener("submit", async (e) => {
    e.preventDefault();
    const boton = $("#entrar-boton");
    boton.disabled = true;
    boton.textContent = "Entrando…";
    const { data, error } = await sb.auth.signInWithPassword({
      email: $("#entrar-correo").value.trim(),
      password: $("#entrar-clave").value,
    });
    boton.disabled = false;
    boton.textContent = "Entrar";
    $("#entrar-clave").value = "";
    if (error) { mostrarEntrar(textoError(error)); return; }
    await entrarConSesion(data.user);
  });

  $("#salir").addEventListener("click", async () => {
    await sb.auth.signOut();
    location.hash = "";
    mostrarEntrar();
  });

  /* ---------- Rutas ---------- */
  const RUTAS = { tablero: verTablero, ventas: verVentas, venta: verVenta, nueva: verNueva, lotes: verLotes };

  async function rutear() {
    if (!perfil) return;
    const [, ruta = "tablero", param] = (location.hash || "#/tablero").split("/");
    const fn = RUTAS[ruta] || verTablero;
    document.querySelectorAll(".menu a").forEach((a) =>
      a.toggleAttribute("aria-current", a.dataset.ruta === (ruta === "venta" ? "ventas" : ruta)));
    document.querySelectorAll(".menu a[aria-current]").forEach((a) => a.setAttribute("aria-current", "page"));
    contenido.innerHTML = `<p class="cargando">Cargando…</p>`;
    try {
      await fn(param);
    } catch (e) {
      contenido.innerHTML = `<p class="aviso aviso-error">No se pudo cargar: ${esc(textoError(e))}</p>`;
    }
    contenido.focus({ preventScroll: true });
  }
  window.addEventListener("hashchange", rutear);

  // Filas de tabla que llevan a otra pantalla
  contenido.addEventListener("click", (e) => {
    const fila = e.target.closest("tr[data-ir]");
    if (fila && !e.target.closest("button, a, input, select")) location.hash = fila.dataset.ir;
  });
  contenido.addEventListener("keydown", (e) => {
    const fila = e.target.closest("tr[data-ir]");
    if (fila && e.key === "Enter" && e.target === fila) location.hash = fila.dataset.ir;
  });

  const tarjeta = (titulo, valor, nota = "", alerta = false) =>
    `<div class="tarjeta${alerta ? " alerta" : ""}"><dt>${esc(titulo)}</dt><dd>${valor}</dd>${nota ? `<small>${nota}</small>` : ""}</div>`;

  /* =================================================================
     Tablero
     ================================================================= */
  async function verTablero() {
    const [cuentas, lotes, pendientes, comisiones] = await Promise.all([
      q(sb.from("v_estado_cuenta").select("*")),
      q(sb.from("lotes").select("numero, estado")),
      q(sb.from("v_pagos").select("id, venta_id, concepto, fecha_programada, saldo, estatus").neq("estatus", "pagado").order("fecha_programada").limit(500)),
      q(sb.from("v_comisiones").select("*").eq("estatus", "por pagar").order("venta_id")),
    ]);
    const activas = cuentas.filter((c) => c.estado !== "cancelada");
    const porVenta = new Map(activas.map((c) => [c.venta_id, c]));
    const proximos = pendientes.filter((p) => porVenta.has(p.venta_id)).slice(0, 12);
    const n = (edo) => lotes.filter((l) => l.estado === edo).length;
    const vencido = suma(activas, "vencido");

    contenido.innerHTML = `
      <div class="encabezado">
        <div><h1>Tablero</h1><p class="sutil">Al día de hoy, ${fecha(hoyISO())}.</p></div>
        ${esAdmin() ? `<a class="boton boton-tierra" href="#/nueva">Registrar una venta</a>` : ""}
      </div>
      <dl class="tarjetas">
        ${tarjeta("Cobrado", dinero0.format(suma(activas, "pagado")), `${activas.length} ${activas.length === 1 ? "venta activa" : "ventas activas"}`)}
        ${tarjeta("Por cobrar", dinero0.format(suma(activas, "saldo")))}
        ${tarjeta("Vencido", dinero0.format(vencido), ((n) => `${n} ${n === 1 ? "venta" : "ventas"} con atraso`)(activas.filter((c) => Number(c.vencido) > 0).length), vencido > 0)}
        ${tarjeta("Lotes disponibles", `${n("disponible")} de ${lotes.length}`, `${n("apartado")} apartados · ${n("vendido")} vendidos`)}
        ${tarjeta("Comisiones por pagar", dinero0.format(suma(comisiones, "monto")), `${comisiones.length} pendientes`)}
      </dl>

      <section class="seccion">
        <h2>Pagos vencidos y próximos</h2>
        <div class="tabla-caja">${proximos.length ? `
          <table>
            <thead><tr><th>Fecha</th><th>Lote</th><th>Cliente</th><th>Concepto</th><th class="num">Por cobrar</th><th>Estatus</th></tr></thead>
            <tbody>${proximos.map((p) => {
              const c = porVenta.get(p.venta_id);
              return `<tr class="clic" tabindex="0" data-ir="#/venta/${p.venta_id}">
                <td>${fecha(p.fecha_programada)}</td><td>${c.lote_numero}</td><td>${esc(c.cliente)}</td>
                <td>${esc(p.concepto)}</td><td class="num">${dinero.format(p.saldo)}</td><td>${chip(p.estatus)}</td></tr>`;
            }).join("")}</tbody>
          </table>` : `<p class="vacio">No hay pagos pendientes.</p>`}
        </div>
      </section>

      <section class="seccion">
        <h2>Comisiones por pagar</h2>
        <div class="tabla-caja">${comisiones.length ? `
          <table>
            <thead><tr><th>Lote</th><th>Vendedor</th><th>Parte</th><th class="num">Monto</th></tr></thead>
            <tbody>${comisiones.map((c) => `<tr class="clic" tabindex="0" data-ir="#/venta/${c.venta_id}">
              <td>${c.lote_numero}</td><td>${esc(c.vendedor)}</td><td>${c.parte === 1 ? "1a · enganche" : "2a · liquidación"}</td>
              <td class="num">${dinero.format(c.monto)}</td></tr>`).join("")}</tbody>
          </table>` : `<p class="vacio">No hay comisiones por pagar.</p>`}
        </div>
      </section>`;
  }

  /* =================================================================
     Ventas
     ================================================================= */
  let filtroVentas = "activas";

  async function verVentas() {
    const cuentas = await q(sb.from("v_estado_cuenta").select("*").order("venta_id", { ascending: false }));
    const pintar = () => {
      const lista = cuentas.filter((c) =>
        filtroVentas === "todas" ? true
          : filtroVentas === "atraso" ? c.estatus_cuenta === "con atraso"
          : c.estado !== "cancelada");
      $("#tabla-ventas").innerHTML = lista.length ? `
        <table>
          <thead><tr><th>Lote</th><th>Cliente</th><th>Vendedor</th><th>Esquema</th><th>Estado</th>
            <th class="num">Precio final</th><th class="num">Pagado</th><th class="num">Saldo</th><th class="num">Vencido</th>
            <th>Próximo pago</th><th>Cuenta</th></tr></thead>
          <tbody>${lista.map((c) => `<tr class="clic" tabindex="0" data-ir="#/venta/${c.venta_id}">
            <td><strong>${c.lote_numero}</strong></td><td>${esc(c.cliente)}</td><td>${esc(c.vendedor)}</td><td>${esc(c.esquema)}</td>
            <td>${chip(c.estado)}</td><td class="num">${dinero0.format(c.precio_final)}</td><td class="num">${dinero0.format(c.pagado)}</td>
            <td class="num">${dinero0.format(c.saldo)}</td><td class="num">${dinero0.format(c.vencido)}</td>
            <td>${fecha(c.proximo_pago)}</td><td>${chip(c.estatus_cuenta)}</td></tr>`).join("")}</tbody>
        </table>` : `<p class="vacio">No hay ventas con este filtro.</p>`;
    };
    contenido.innerHTML = `
      <div class="encabezado">
        <div><h1>Ventas</h1><p class="sutil">Toca una venta para ver su calendario, registrar pagos y sus comisiones.</p></div>
        <label>Mostrar
          <select id="filtro-ventas">
            <option value="activas">Activas</option>
            <option value="atraso">Con atraso</option>
            <option value="todas">Todas (incluye canceladas)</option>
          </select>
        </label>
      </div>
      <div class="tabla-caja" id="tabla-ventas"></div>`;
    const sel = $("#filtro-ventas");
    sel.value = filtroVentas;
    sel.addEventListener("change", () => { filtroVentas = sel.value; pintar(); });
    pintar();
  }

  /* ---------- Detalle de una venta ---------- */
  async function verVenta(id) {
    id = Number(id);
    const [cuentas, venta, pagos, recibidos, comisiones] = await Promise.all([
      q(sb.from("v_estado_cuenta").select("*").eq("venta_id", id)),
      q(sb.from("ventas").select("*").eq("id", id).maybeSingle()),
      q(sb.from("v_pagos").select("*").eq("venta_id", id).order("fecha_programada").order("id")),
      q(sb.from("pagos_recibidos").select("*").eq("venta_id", id).order("fecha_pago").order("id")),
      q(sb.from("v_comisiones").select("*").eq("venta_id", id).order("parte")),
    ]);
    const c = cuentas[0];
    if (!c || !venta) { contenido.innerHTML = `<p class="aviso aviso-error">No se encontró la venta.</p>`; return; }
    const activa = venta.estado !== "cancelada";
    const editar = esAdmin() && activa;
    const conceptoDe = new Map(pagos.map((p) => [p.id, p.concepto]));

    const telefono = String(c.cliente_telefono || "").replace(/\D/g, "");
    const wa = telefono && c.proximo_pago ? `https://wa.me/${telefono.length === 10 ? "52" + telefono : telefono}?text=${encodeURIComponent(
      `Hola ${c.cliente}, te recordamos tu próximo pago del lote ${c.lote_numero} de Bosques Amador: ${dinero.format(c.monto_proximo || 0)} con fecha ${fecha(c.proximo_pago)}. ¡Gracias!`)}` : "";

    contenido.innerHTML = `
      <p><a href="#/ventas">← Ventas</a></p>
      <div class="encabezado">
        <div>
          <h1>Lote ${c.lote_numero} · ${esc(c.cliente)}</h1>
          <p class="sutil">${esc(c.esquema)} &nbsp; ${chip(c.estado)} ${chip(c.estatus_cuenta)}</p>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          ${wa ? `<a class="boton boton-claro" href="${wa}" target="_blank" rel="noopener">Recordatorio por WhatsApp</a>` : ""}
          ${esAdmin() && activa && venta.estado !== "liquidada" ? `<button class="boton boton-peligro" type="button" id="cancelar-venta">Cancelar venta</button>` : ""}
        </div>
      </div>

      <dl class="datos">
        <div><dt>Cliente</dt><dd>${esc(c.cliente)}</dd></div>
        <div><dt>Teléfono</dt><dd>${esc(c.cliente_telefono || "—")}</dd></div>
        <div><dt>Vendedor</dt><dd>${esc(c.vendedor)}</dd></div>
        <div><dt>Superficie</dt><dd>${m2(c.superficie_m2)}</dd></div>
        <div><dt>Apartado</dt><dd>${fecha(c.fecha_apartado)}</dd></div>
        <div><dt>Contrato</dt><dd>${fecha(c.fecha_contrato)}</dd></div>
        <div><dt>Precio de lista</dt><dd>${dinero.format(venta.precio_lista)}</dd></div>
        <div><dt>Precio final</dt><dd>${dinero.format(c.precio_final)}</dd></div>
        <div><dt>Enganche</dt><dd>${dinero.format(c.enganche_monto)} (${pct(venta.enganche_pct)})</dd></div>
        <div><dt>Pagado</dt><dd>${dinero.format(c.pagado)}</dd></div>
        <div><dt>Saldo</dt><dd>${dinero.format(c.saldo)}</dd></div>
        <div><dt>Vencido</dt><dd>${dinero.format(c.vencido)}</dd></div>
        <div><dt>Próximo pago</dt><dd>${fecha(c.proximo_pago)}${c.monto_proximo ? ` · ${dinero.format(c.monto_proximo)}` : ""}</dd></div>
        ${venta.notas ? `<div><dt>Notas</dt><dd>${esc(venta.notas)}</dd></div>` : ""}
      </dl>

      <section class="seccion">
        <h2>Calendario de pagos</h2>
        <div class="tabla-caja">
          <table id="calendario">
            <thead><tr><th>Concepto</th><th>Fecha</th><th class="num">Programado</th><th class="num">Pagado</th><th class="num">Saldo</th><th>Estatus</th>${editar ? "<th></th>" : ""}</tr></thead>
            <tbody>${pagos.map((p) => `<tr data-pago="${p.id}">
              <td>${esc(p.concepto)}</td><td>${fecha(p.fecha_programada)}</td>
              <td class="num">${dinero.format(p.monto_programado)}</td><td class="num">${dinero.format(p.monto_pagado)}</td>
              <td class="num">${dinero.format(p.saldo)}</td><td>${chip(p.estatus)}</td>
              ${editar ? `<td>${Number(p.saldo) > 0.009 ? `<button class="boton boton-pino boton-chico" type="button" data-registrar="${p.id}" data-saldo="${p.saldo}">Registrar pago</button>` : ""}</td>` : ""}
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>

      <section class="seccion">
        <h2>Pagos recibidos</h2>
        <div class="tabla-caja">${recibidos.length ? `
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Monto</th><th>Forma</th><th>Referencia</th>${esAdmin() ? "<th></th>" : ""}</tr></thead>
            <tbody>${recibidos.map((r) => `<tr>
              <td>${fecha(r.fecha_pago)}</td><td>${esc(conceptoDe.get(r.pago_programado_id) || "")}</td>
              <td class="num">${dinero.format(r.monto)}</td><td>${esc(r.forma_pago)}</td><td>${esc(r.referencia || "")}</td>
              ${esAdmin() ? `<td><button class="boton boton-texto" type="button" data-borrar-pago="${r.id}">Borrar</button></td>` : ""}
            </tr>`).join("")}</tbody>
          </table>` : `<p class="vacio">Todavía no hay pagos registrados.</p>`}
        </div>
      </section>

      <section class="seccion">
        <h2>Comisión del vendedor</h2>
        <div class="tabla-caja">
          <table>
            <thead><tr><th>Parte</th><th>Condición</th><th class="num">Monto</th><th>¿Se cumplió?</th><th>Estatus</th><th>Pagada el</th>${esAdmin() ? "<th></th>" : ""}</tr></thead>
            <tbody>${comisiones.map((m) => `<tr>
              <td>${m.parte}a</td><td>${m.parte === 1 ? "Al completar el enganche" : "Al liquidar el cliente"}</td>
              <td class="num">${dinero.format(m.monto)}</td><td>${m.condicion_cumplida ? "Sí" : "No"}</td>
              <td>${chip(m.estatus)}</td><td>${fecha(m.fecha_pagada)}</td>
              ${esAdmin() ? `<td>${m.estatus === "por pagar" ? `<button class="boton boton-claro boton-chico" type="button" data-comision="${m.id}">Marcar pagada hoy</button>` : ""}</td>` : ""}
            </tr>`).join("")}</tbody>
          </table>
        </div>
      </section>`;

    // Registrar pago: ventana emergente con el formulario
    $("#calendario").addEventListener("click", (e) => {
      const b = e.target.closest("[data-registrar]");
      if (!b) return;
      const pago = pagos.find((p) => p.id === Number(b.dataset.registrar));
      const dlg = document.createElement("dialog");
      dlg.className = "dialogo";
      dlg.innerHTML = `<form class="form-pago" method="dialog">
        <h2>Registrar pago</h2>
        <p class="sutil">Lote ${c.lote_numero} · ${esc(pago.concepto)} · vence ${fecha(pago.fecha_programada)}<br>
          Por cobrar: <strong>${dinero.format(pago.saldo)}</strong></p>
        <div class="dos">
          <label>Fecha de pago <input type="date" name="fecha" value="${hoyISO()}" required></label>
          <label>Monto <input type="number" name="monto" min="0.01" step="0.01" value="${Number(pago.saldo).toFixed(2)}" required></label>
        </div>
        <div class="dos">
          <label>Forma <select name="forma"><option>transferencia</option><option>depósito</option><option>efectivo</option><option>cheque</option></select></label>
          <label>Referencia <input type="text" name="ref" placeholder="SPEI, folio o recibo"></label>
        </div>
        <p class="aviso aviso-error" data-error hidden></p>
        <div class="acciones">
          <button class="boton boton-texto" type="button" data-cerrar>Cancelar</button>
          <button class="boton boton-pino" type="submit">Guardar pago</button>
        </div>
      </form>`;
      document.body.appendChild(dlg);
      dlg.addEventListener("close", () => dlg.remove());
      dlg.showModal();
      const form = $("form", dlg);
      form.monto.select();
      $("[data-cerrar]", dlg).addEventListener("click", () => dlg.close());
      form.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const boton = $("button[type=submit]", form);
        boton.disabled = true;
        try {
          await q(sb.from("pagos_recibidos").insert({
            pago_programado_id: pago.id,
            fecha_pago: form.fecha.value,
            monto: redondear(form.monto.value),
            forma_pago: form.forma.value,
            referencia: form.ref.value.trim() || null,
          }));
          dlg.close();
          toast("Pago registrado.");
          await verVenta(id);
        } catch (err) {
          boton.disabled = false;
          const aviso = $("[data-error]", form);
          aviso.textContent = textoError(err);
          aviso.hidden = false;
        }
      });
    });

    contenido.querySelectorAll("[data-borrar-pago]").forEach((b) => b.addEventListener("click", async () => {
      if (!(await confirmar("¿Borrar este pago? El saldo y los estatus se recalculan solos.", "Sí, borrar"))) return;
      try {
        await q(sb.from("pagos_recibidos").delete().eq("id", Number(b.dataset.borrarPago)));
        toast("Pago borrado.");
        await verVenta(id);
      } catch (err) { toast(textoError(err), true); }
    }));

    contenido.querySelectorAll("[data-comision]").forEach((b) => b.addEventListener("click", async () => {
      try {
        await q(sb.from("comisiones").update({ fecha_pagada: hoyISO() }).eq("id", Number(b.dataset.comision)));
        toast("Comisión marcada como pagada.");
        await verVenta(id);
      } catch (err) { toast(textoError(err), true); }
    }));

    $("#cancelar-venta")?.addEventListener("click", async () => {
      if (!(await confirmar(`¿Cancelar la venta del lote ${c.lote_numero}? El lote vuelve a quedar disponible. Los pagos registrados se conservan en el historial.`, "Sí, cancelar venta"))) return;
      try {
        await q(sb.from("ventas").update({ estado: "cancelada" }).eq("id", id));
        toast("Venta cancelada; el lote quedó disponible.");
        await verVenta(id);
      } catch (err) { toast(textoError(err), true); }
    });
  }

  /* =================================================================
     Lotes
     ================================================================= */
  async function verLotes() {
    const lotes = await q(sb.from("lotes").select("*").order("numero"));
    contenido.innerHTML = `
      <div class="encabezado">
        <div><h1>Lotes</h1>
        <p class="sutil">${esAdmin() ? "Cambia el precio y presiona Guardar. El precio por m² se calcula solo. " : ""}El estado cambia solo con las ventas. Un precio nuevo aplica a ventas nuevas; las ya registradas conservan el suyo.</p></div>
      </div>
      <div class="tabla-caja">
        <table>
          <thead><tr><th>Lote</th><th>Zona</th><th class="num">Superficie</th><th class="num">Precio de lista</th><th class="num">Precio por m²</th><th>Estado</th>${esAdmin() ? "<th></th>" : ""}</tr></thead>
          <tbody>${lotes.map((l) => `<tr data-lote="${l.numero}">
            <td><strong>${l.numero}</strong></td>
            <td>${l.zona === "carretera" ? "Orilla de carretera" : "En medio del predio"}</td>
            <td class="num">${m2(l.superficie_m2)}</td>
            <td class="num">${esAdmin()
              ? `<input class="precio-input" type="number" min="0" step="1000" value="${Number(l.precio_lista)}" data-original="${Number(l.precio_lista)}" data-sup="${l.superficie_m2}" aria-label="Precio del lote ${l.numero}">`
              : dinero0.format(l.precio_lista)}</td>
            <td class="num" data-m2>${dinero.format(l.precio_m2)}</td>
            <td>${chip(l.estado)}</td>
            ${esAdmin() ? `<td><button class="boton boton-pino boton-chico" type="button" data-guardar disabled>Guardar</button></td>` : ""}
          </tr>`).join("")}</tbody>
        </table>
      </div>`;

    contenido.querySelectorAll(".precio-input").forEach((inp) => {
      const fila = inp.closest("tr");
      const boton = $("[data-guardar]", fila);
      inp.addEventListener("input", () => {
        const v = Number(inp.value);
        boton.disabled = !(v >= 0) || v === Number(inp.dataset.original) || inp.value === "";
        if (v > 0) $("[data-m2]", fila).textContent = dinero.format(redondear(v / Number(inp.dataset.sup)));
      });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !boton.disabled) boton.click(); });
      boton.addEventListener("click", async () => {
        boton.disabled = true;
        try {
          const [l] = await q(sb.from("lotes").update({ precio_lista: Number(inp.value) })
            .eq("numero", Number(fila.dataset.lote)).select("precio_lista, precio_m2"));
          if (!l) throw new Error("No tienes permiso para cambiar precios.");
          inp.dataset.original = Number(l.precio_lista);
          $("[data-m2]", fila).textContent = dinero.format(l.precio_m2);
          toast(`Lote ${fila.dataset.lote}: precio actualizado a ${dinero0.format(l.precio_lista)}.`);
        } catch (err) {
          boton.disabled = false;
          toast(textoError(err), true);
        }
      });
    });
  }

  /* =================================================================
     Nueva venta
     ================================================================= */
  async function verNueva() {
    if (!esAdmin()) {
      contenido.innerHTML = `<p class="aviso aviso-info">Solo un administrador puede registrar ventas.</p>`;
      return;
    }
    const [lotes, clientes, vendedores, esquemas, parametros] = await Promise.all([
      q(sb.from("lotes").select("*").eq("estado", "disponible").order("numero")),
      q(sb.from("clientes").select("id, nombre, telefono").order("nombre")),
      q(sb.from("vendedores").select("id, nombre, comision_pct").eq("activo", true).order("nombre")),
      q(sb.from("esquemas_pago").select("*").eq("activo", true).order("id")),
      q(sb.from("parametros").select("clave, valor")),
    ]);
    const P = Object.fromEntries(parametros.map((p) => [p.clave, Number(p.valor)]));
    const apartadoMonto = P.apartado_monto ?? 20000;
    const vigencia = P.apartado_vigencia_dias ?? 15;

    contenido.innerHTML = `
      <div class="encabezado">
        <div><h1>Nueva venta</h1>
        <p class="sutil">Al guardar, el sistema genera solo el calendario de pagos y las comisiones, y el lote pasa a "apartado".</p></div>
      </div>
      ${lotes.length ? "" : `<p class="aviso aviso-info">No hay lotes disponibles.</p>`}
      <form class="formulario" id="form-venta" ${lotes.length ? "" : "hidden"}>
        <div class="panel">
          <h2>Datos de la venta</h2>
          <label>Lote
            <select name="lote" required>
              <option value="">Elige un lote disponible</option>
              ${lotes.map((l) => `<option value="${l.numero}">Lote ${l.numero} · ${m2(l.superficie_m2)} · ${dinero0.format(l.precio_lista)}</option>`).join("")}
            </select>
          </label>

          <label>Cliente
            <select name="cliente" required>
              <option value="">Elige un cliente</option>
              <option value="nuevo">+ Cliente nuevo</option>
              ${clientes.map((c) => `<option value="${c.id}">${esc(c.nombre)}${c.telefono ? ` · ${esc(c.telefono)}` : ""}</option>`).join("")}
            </select>
          </label>
          <fieldset id="cliente-nuevo" hidden>
            <legend>Cliente nuevo</legend>
            <label>Nombre completo <input name="c_nombre" autocomplete="off"></label>
            <div class="dos">
              <label>Teléfono / WhatsApp <input name="c_tel" inputmode="tel" autocomplete="off"></label>
              <label>Correo <input name="c_correo" type="email" autocomplete="off"></label>
            </div>
          </fieldset>

          <label>Vendedor
            <select name="vendedor" required>
              <option value="">Elige un vendedor</option>
              <option value="nuevo">+ Vendedor nuevo</option>
              ${vendedores.map((v) => `<option value="${v.id}">${esc(v.nombre)} · ${pct(v.comision_pct)}</option>`).join("")}
            </select>
          </label>
          <fieldset id="vendedor-nuevo" hidden>
            <legend>Vendedor nuevo</legend>
            <div class="dos">
              <label>Nombre <input name="v_nombre" autocomplete="off"></label>
              <label>Teléfono <input name="v_tel" inputmode="tel" autocomplete="off"></label>
            </div>
            <label>Comisión (%) <input name="v_pct" type="number" min="0" max="20" step="0.1" value="4"></label>
          </fieldset>

          <label>Esquema de pago
            <select name="esquema" required>
              ${esquemas.map((e) => `<option value="${e.id}">${esc(e.nombre)}</option>`).join("")}
            </select>
          </label>

          <div class="dos">
            <label>Fecha del apartado <input type="date" name="apartado" value="${hoyISO()}" required></label>
            <label>Fecha de contrato <input type="date" name="contrato"></label>
          </div>
          <p class="nota" id="nota-contrato"></p>
          <label>Notas <textarea name="notas" rows="2" placeholder="Opcional"></textarea></label>
          <p class="aviso aviso-error" id="venta-error" hidden></p>
          <button class="boton boton-tierra" type="submit">Guardar venta y generar calendario</button>
        </div>

        <aside class="panel vista-previa" aria-live="polite">
          <h2>Vista previa</h2>
          <div id="previa"><p class="sutil">Elige un lote y un esquema.</p></div>
        </aside>
      </form>`;

    const form = $("#form-venta");
    const loteDe = (n) => lotes.find((l) => l.numero === Number(n));
    const esquemaDe = (id) => esquemas.find((e) => e.id === Number(id));
    const vendedorDe = (id) => vendedores.find((v) => v.id === Number(id));

    function previa() {
      const l = loteDe(form.lote.value), e = esquemaDe(form.esquema.value);
      const contrato = form.contrato.value || (form.apartado.value ? sumarDias(form.apartado.value, vigencia) : "");
      $("#nota-contrato").textContent = form.contrato.value ? "" : `Si la dejas vacía será el ${fecha(contrato)} (apartado + ${vigencia} días).`;
      if (!l || !e) { $("#previa").innerHTML = `<p class="sutil">Elige un lote y un esquema.</p>`; return; }
      const final = redondear(l.precio_lista * (1 + Number(e.incremento_pct)) * (1 - Number(e.descuento_pct)));
      const eng = redondear(final * Number(e.enganche_pct));
      const apartado = Math.min(apartadoMonto, eng);
      const saldo = redondear(final - eng);
      let pagos = "";
      if (e.tipo === "contado") pagos = `1 pago a la escritura de ${dinero.format(saldo)}`;
      else if (e.tipo === "mensual") pagos = `${e.num_pagos} mensualidades de ${dinero.format(redondear(saldo / e.num_pagos))}`;
      else {
        const porAnio = saldo / (e.num_pagos / e.meses_pago.length);
        const nombres = { 5: "mayo", 7: "julio", 12: "diciembre" };
        pagos = `${e.num_pagos} pagos: ` + e.meses_pago.map((m, i) => `${nombres[m] || "mes " + m} ${dinero.format(redondear(porAnio * e.reparto_pct[i]))}`).join(" · ");
      }
      const v = vendedorDe(form.vendedor.value);
      const pctCom = form.vendedor.value === "nuevo" ? Number(form.v_pct.value || 0) / 100 : Number(v?.comision_pct ?? 0.04);
      $("#previa").innerHTML = `<dl class="datos">
        <div><dt>Precio de lista</dt><dd>${dinero.format(l.precio_lista)}</dd></div>
        ${Number(e.incremento_pct) ? `<div><dt>Incremento por plazo</dt><dd>${pct(e.incremento_pct)}</dd></div>` : ""}
        ${Number(e.descuento_pct) ? `<div><dt>Descuento</dt><dd>${pct(e.descuento_pct)}</dd></div>` : ""}
        <div><dt>Precio final</dt><dd>${dinero.format(final)}</dd></div>
        <div><dt>${e.tipo === "contado" ? "Pago al contrato" : "Enganche"} (${pct(e.enganche_pct)})</dt><dd>${dinero.format(eng)}</dd></div>
        <div><dt>Apartado</dt><dd>${dinero.format(apartado)} · ${fecha(form.apartado.value)}</dd></div>
        <div><dt>Resto a la firma</dt><dd>${dinero.format(eng - apartado)} · ${fecha(contrato)}</dd></div>
        <div><dt>Después</dt><dd>${pagos}</dd></div>
        <div><dt>Comisión (${pct(pctCom)})</dt><dd>${dinero.format(redondear(l.precio_lista * pctCom))}</dd></div>
      </dl>
      <p class="nota">El calendario exacto lo genera la base de datos al guardar.</p>`;
    }

    form.addEventListener("input", previa);
    form.cliente.addEventListener("change", () => {
      const nuevo = form.cliente.value === "nuevo";
      $("#cliente-nuevo").hidden = !nuevo;
      form.c_nombre.required = nuevo;
      if (nuevo) form.c_nombre.focus();
    });
    form.vendedor.addEventListener("change", () => {
      const nuevo = form.vendedor.value === "nuevo";
      $("#vendedor-nuevo").hidden = !nuevo;
      form.v_nombre.required = nuevo;
      if (nuevo) form.v_nombre.focus();
      previa();
    });
    previa();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#venta-error");
      err.hidden = true;
      const boton = $("button[type=submit]", form);
      boton.disabled = true;
      try {
        let clienteId = Number(form.cliente.value);
        if (form.cliente.value === "nuevo") {
          const c = await q(sb.from("clientes").insert({
            nombre: form.c_nombre.value.trim(),
            telefono: form.c_tel.value.trim() || null,
            correo: form.c_correo.value.trim() || null,
          }).select("id").single());
          clienteId = c.id;
        }
        let vendedorId = Number(form.vendedor.value);
        if (form.vendedor.value === "nuevo") {
          const v = await q(sb.from("vendedores").insert({
            nombre: form.v_nombre.value.trim(),
            telefono: form.v_tel.value.trim() || null,
            comision_pct: Number(form.v_pct.value || 4) / 100,
          }).select("id").single());
          vendedorId = v.id;
        }
        const venta = await q(sb.from("ventas").insert({
          lote_numero: Number(form.lote.value),
          cliente_id: clienteId,
          vendedor_id: vendedorId,
          esquema_id: Number(form.esquema.value),
          fecha_apartado: form.apartado.value,
          fecha_contrato: form.contrato.value || null,
          notas: form.notas.value.trim() || null,
        }).select("id").single());
        toast("Venta registrada. Se generó su calendario de pagos.");
        location.hash = `#/venta/${venta.id}`;
      } catch (ex) {
        boton.disabled = false;
        err.textContent = textoError(ex);
        err.hidden = false;
      }
    });
  }

  /* ---------- Inicio ---------- */
  (async () => {
    const { data } = await sb.auth.getSession();
    if (data.session) await entrarConSesion(data.session.user);
    else mostrarEntrar();
  })();
  sb.auth.onAuthStateChange((evento) => { if (evento === "SIGNED_OUT" && perfil) mostrarEntrar(); });
})();
