-- =====================================================================
-- Bosques Amador · Base de datos de ventas y cobranza (Supabase)
-- Ejecutar UNA vez en Supabase: SQL Editor → New query → pegar todo → Run.
-- Crea tablas, cálculos automáticos, reglas de seguridad y datos base
-- (parámetros, esquemas de pago y los 28 lotes).
-- Se ejecuta todo o nada: si algo falla, no se guarda ningún cambio.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Fecha de hoy en México (los vencimientos se calculan contra esta fecha)
-- ---------------------------------------------------------------------
create or replace function public.hoy()
returns date language sql stable
as $$ select (now() at time zone 'America/Mexico_City')::date $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.parametros (
  clave        text primary key,
  valor        numeric not null,
  descripcion  text
);

create table public.perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  nombre  text not null,
  correo  text unique,
  rol     text not null default 'pendiente' check (rol in ('admin', 'vendedor', 'consulta', 'pendiente')),
  activo  boolean not null default true
);

create table public.vendedores (
  id            bigint generated always as identity primary key,
  nombre        text not null,
  telefono      text,
  comision_pct  numeric(6,4) not null default 0.04 check (comision_pct >= 0 and comision_pct < 1),
  perfil_id     uuid references public.perfiles (id) on delete set null,
  activo        boolean not null default true
);

create table public.clientes (
  id         bigint generated always as identity primary key,
  nombre     text not null,
  telefono   text,
  correo     text,
  notas      text,
  creado_en  timestamptz not null default now()
);

create table public.esquemas_pago (
  id              bigint generated always as identity primary key,
  clave           text not null unique,
  nombre          text not null,
  tipo            text not null check (tipo in ('contado', 'mensual', 'extraordinario')),
  enganche_pct    numeric(6,4) not null check (enganche_pct >= 0 and enganche_pct <= 1),
  num_pagos       int not null check (num_pagos >= 1),
  incremento_pct  numeric(6,4) not null default 0,
  descuento_pct   numeric(6,4) not null default 0,
  meses_pago      int[],          -- solo extraordinario: {5,7,12} = mayo, julio, diciembre
  reparto_pct     numeric[],      -- solo extraordinario: parte de cada año en cada mes (suma 1)
  activo          boolean not null default true
);

create table public.lotes (
  numero          int primary key,
  zona            text not null check (zona in ('carretera', 'medio')),
  superficie_m2   numeric(10,2) not null check (superficie_m2 > 0),
  precio_lista    numeric(12,2) not null check (precio_lista >= 0),
  precio_m2       numeric(12,2) generated always as (round(precio_lista / superficie_m2, 2)) stored,
  estado          text not null default 'disponible' check (estado in ('disponible', 'apartado', 'vendido')),
  actualizado_en  timestamptz not null default now()
);

create table public.ventas (
  id              bigint generated always as identity primary key,
  lote_numero     int not null references public.lotes (numero),
  cliente_id      bigint not null references public.clientes (id),
  vendedor_id     bigint not null references public.vendedores (id),
  esquema_id      bigint not null references public.esquemas_pago (id),
  estado          text not null default 'apartado' check (estado in ('apartado', 'vendido', 'liquidada', 'cancelada')),
  fecha_apartado  date not null default public.hoy(),
  fecha_contrato  date,
  -- Copiados al crear la venta (no cambian si después cambia el lote o el esquema)
  precio_lista    numeric(12,2),
  incremento_pct  numeric(6,4),
  descuento_pct   numeric(6,4),
  enganche_pct    numeric(6,4),
  apartado_monto  numeric(12,2),
  -- Calculados
  precio_final    numeric(12,2) generated always as
                    (round(precio_lista * (1 + incremento_pct) * (1 - descuento_pct), 2)) stored,
  enganche_monto  numeric(12,2) generated always as
                    (round(round(precio_lista * (1 + incremento_pct) * (1 - descuento_pct), 2) * enganche_pct, 2)) stored,
  saldo_plan      numeric(12,2) generated always as
                    (round(precio_lista * (1 + incremento_pct) * (1 - descuento_pct), 2)
                     - round(round(precio_lista * (1 + incremento_pct) * (1 - descuento_pct), 2) * enganche_pct, 2)) stored,
  notas           text,
  creado_por      uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now()
);
-- Un lote solo puede tener una venta activa (las canceladas no cuentan)
create unique index ventas_una_activa_por_lote on public.ventas (lote_numero) where estado <> 'cancelada';

create table public.pagos_programados (
  id                bigint generated always as identity primary key,
  venta_id          bigint not null references public.ventas (id) on delete cascade,
  numero            int not null,
  tipo              text not null check (tipo in ('apartado', 'enganche', 'mensualidad', 'extraordinario', 'escritura')),
  concepto          text not null,
  fecha_programada  date not null,
  monto_programado  numeric(12,2) not null check (monto_programado >= 0)
);
create index on public.pagos_programados (venta_id);

create table public.pagos_recibidos (
  id                  bigint generated always as identity primary key,
  venta_id            bigint not null references public.ventas (id) on delete cascade,
  pago_programado_id  bigint not null references public.pagos_programados (id) on delete cascade,
  fecha_pago          date not null default public.hoy(),
  monto               numeric(12,2) not null check (monto > 0),
  forma_pago          text not null default 'transferencia' check (forma_pago in ('transferencia', 'depósito', 'efectivo', 'cheque')),
  referencia          text,
  registrado_por      uuid references public.perfiles (id) on delete set null default auth.uid(),
  creado_en           timestamptz not null default now()
);
create index on public.pagos_recibidos (venta_id);
create index on public.pagos_recibidos (pago_programado_id);

create table public.comisiones (
  id            bigint generated always as identity primary key,
  venta_id      bigint not null references public.ventas (id) on delete cascade,
  vendedor_id   bigint not null references public.vendedores (id),
  parte         int not null check (parte in (1, 2)),
  monto         numeric(12,2) not null,
  fecha_pagada  date,
  unique (venta_id, parte)
);

-- ---------------------------------------------------------------------
-- Automatizaciones
-- ---------------------------------------------------------------------

-- Al crear una venta: copia precio, esquema, apartado y fecha de contrato
create or replace function public.ventas_preparar()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  e public.esquemas_pago%rowtype;
begin
  select * into e from esquemas_pago where id = new.esquema_id;
  new.precio_lista   := coalesce(new.precio_lista, (select precio_lista from lotes where numero = new.lote_numero));
  new.incremento_pct := coalesce(new.incremento_pct, e.incremento_pct);
  new.descuento_pct  := coalesce(new.descuento_pct, e.descuento_pct);
  new.enganche_pct   := coalesce(new.enganche_pct, e.enganche_pct);
  new.apartado_monto := coalesce(new.apartado_monto, (select valor from parametros where clave = 'apartado_monto'), 0);
  new.fecha_contrato := coalesce(new.fecha_contrato,
                          new.fecha_apartado + coalesce((select valor::int from parametros where clave = 'apartado_vigencia_dias'), 15));
  return new;
end $$;

create trigger ventas_preparar before insert on public.ventas
  for each row execute function public.ventas_preparar();

-- Genera el calendario de pagos y las dos comisiones de una venta
create or replace function public.generar_calendario(p_venta bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v          public.ventas%rowtype;
  e          public.esquemas_pago%rowtype;
  apartado   numeric;
  monto      numeric;
  acumulado  numeric := 0;
  k          int;
  idx        int;
  mes        int;
  por_anio   numeric;
  cursor_mes date;
  parte1     numeric;
  pct_vend   numeric;
begin
  select * into v from ventas where id = p_venta;
  select * into e from esquemas_pago where id = v.esquema_id;
  apartado := least(coalesce(v.apartado_monto, 0), v.enganche_monto);

  if apartado > 0 then
    insert into pagos_programados (venta_id, numero, tipo, concepto, fecha_programada, monto_programado)
    values (p_venta, 0, 'apartado', 'Apartado (parte del enganche)', v.fecha_apartado, apartado);
  end if;
  insert into pagos_programados (venta_id, numero, tipo, concepto, fecha_programada, monto_programado)
  values (p_venta, 0, 'enganche',
          case when e.tipo = 'contado' then 'Pago a la firma del contrato' else 'Resto del enganche (a la firma)' end,
          v.fecha_contrato, v.enganche_monto - apartado);

  if e.tipo = 'contado' then
    insert into pagos_programados (venta_id, numero, tipo, concepto, fecha_programada, monto_programado)
    values (p_venta, 1, 'escritura', 'Pago a la firma de la escritura',
            v.fecha_contrato + coalesce((select valor::int from parametros where clave = 'contado_dias_escritura'), 60),
            v.saldo_plan);

  elsif e.tipo = 'mensual' then
    for k in 1 .. e.num_pagos loop
      monto := case when k < e.num_pagos then round(v.saldo_plan / e.num_pagos, 2) else v.saldo_plan - acumulado end;
      acumulado := acumulado + monto;
      insert into pagos_programados (venta_id, numero, tipo, concepto, fecha_programada, monto_programado)
      values (p_venta, k, 'mensualidad', format('Mensualidad %s de %s', k, e.num_pagos),
              (v.fecha_contrato + make_interval(months => k))::date, monto);
    end loop;

  else  -- extraordinario: pagos el día 15 de los meses del esquema, a partir del mes siguiente al contrato
    por_anio := v.saldo_plan / (e.num_pagos::numeric / array_length(e.meses_pago, 1));
    cursor_mes := (date_trunc('month', v.fecha_contrato) + interval '1 month')::date;
    k := 0;
    while k < e.num_pagos loop
      mes := extract(month from cursor_mes)::int;
      idx := array_position(e.meses_pago, mes);
      if idx is not null then
        k := k + 1;
        monto := case when k < e.num_pagos then round(por_anio * e.reparto_pct[idx], 2) else v.saldo_plan - acumulado end;
        acumulado := acumulado + monto;
        insert into pagos_programados (venta_id, numero, tipo, concepto, fecha_programada, monto_programado)
        values (p_venta, k, 'extraordinario',
                format('Pago %s de %s · %s', k, e.num_pagos,
                       case mes when 5 then 'mayo (utilidades)' when 7 then 'julio (bono)'
                                when 12 then 'diciembre (aguinaldo)' else 'mes ' || mes end),
                cursor_mes + 14, monto);
      end if;
      cursor_mes := (cursor_mes + interval '1 month')::date;
    end loop;
  end if;

  -- Comisiones: parte 1 al completar el enganche, parte 2 al liquidar
  parte1   := coalesce((select valor from parametros where clave = 'comision_parte1_pct'), 0.5);
  pct_vend := (select comision_pct from vendedores where id = v.vendedor_id);
  insert into comisiones (venta_id, vendedor_id, parte, monto) values
    (p_venta, v.vendedor_id, 1, round(v.precio_lista * pct_vend * parte1, 2)),
    (p_venta, v.vendedor_id, 2, round(v.precio_lista * pct_vend, 2) - round(v.precio_lista * pct_vend * parte1, 2));
end $$;

-- El estado del lote sale de sus ventas
create or replace function public.actualizar_estado_lote(p_lote int)
returns void language sql security definer set search_path = public
as $$
  update lotes set
    estado = case
      when exists (select 1 from ventas where lote_numero = p_lote and estado in ('vendido', 'liquidada')) then 'vendido'
      when exists (select 1 from ventas where lote_numero = p_lote and estado = 'apartado') then 'apartado'
      else 'disponible' end,
    actualizado_en = now()
  where numero = p_lote;
$$;

create or replace function public.ventas_despues()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform generar_calendario(new.id);
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    perform actualizar_estado_lote(old.lote_numero);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform actualizar_estado_lote(new.lote_numero);
  end if;
  return null;
end $$;

create trigger ventas_despues after insert or update or delete on public.ventas
  for each row execute function public.ventas_despues();

-- Pagos recibidos: toman la venta del pago programado y actualizan el estado de la venta
create or replace function public.pagos_recibidos_preparar()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  new.venta_id := (select venta_id from pagos_programados where id = new.pago_programado_id);
  return new;
end $$;

create trigger pagos_recibidos_preparar before insert or update on public.pagos_recibidos
  for each row execute function public.pagos_recibidos_preparar();

create or replace function public.actualizar_estado_venta(p_venta bigint)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v           public.ventas%rowtype;
  pagado      numeric;
  pagado_eng  numeric;
  nuevo       text;
begin
  select * into v from ventas where id = p_venta;
  if not found or v.estado = 'cancelada' then return; end if;
  select coalesce(sum(r.monto), 0),
         coalesce(sum(r.monto) filter (where p.tipo in ('apartado', 'enganche')), 0)
    into pagado, pagado_eng
    from pagos_recibidos r join pagos_programados p on p.id = r.pago_programado_id
   where r.venta_id = p_venta;
  nuevo := case
    when pagado >= v.precio_final - 0.01 then 'liquidada'
    when pagado_eng >= v.enganche_monto - 0.01 then 'vendido'
    else 'apartado' end;
  if nuevo <> v.estado then
    update ventas set estado = nuevo where id = p_venta;
  end if;
end $$;

create or replace function public.pagos_recibidos_despues()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform actualizar_estado_venta(old.venta_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform actualizar_estado_venta(new.venta_id); end if;
  return null;
end $$;

create trigger pagos_recibidos_despues after insert or update or delete on public.pagos_recibidos
  for each row execute function public.pagos_recibidos_despues();

-- Cada usuario nuevo de Supabase recibe un perfil 'pendiente' (sin acceso hasta que un admin le asigne rol)
create or replace function public.nuevo_perfil()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into perfiles (id, nombre, correo)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)), new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.nuevo_perfil();

-- Usuarios que ya existían antes de correr este script
insert into public.perfiles (id, nombre, correo)
select id, split_part(email, '@', 1), email from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Vistas (se calculan al consultarlas y respetan las reglas de seguridad)
-- ---------------------------------------------------------------------
create view public.v_pagos with (security_invoker = true) as
select pp.*,
       coalesce(r.pagado, 0)                      as monto_pagado,
       pp.monto_programado - coalesce(r.pagado, 0) as saldo,
       case
         when pp.monto_programado - coalesce(r.pagado, 0) <= 0.01 then 'pagado'
         when pp.fecha_programada < public.hoy() then 'vencido'
         when coalesce(r.pagado, 0) > 0 then 'parcial'
         else 'pendiente'
       end as estatus
from public.pagos_programados pp
left join (select pago_programado_id, sum(monto) as pagado
             from public.pagos_recibidos group by pago_programado_id) r
       on r.pago_programado_id = pp.id;

create view public.v_estado_cuenta with (security_invoker = true) as
with totales as (
  select venta_id,
         sum(monto_pagado)                                  as pagado,
         sum(saldo) filter (where estatus = 'vencido')      as vencido,
         count(*) filter (where estatus = 'vencido')        as pagos_vencidos,
         min(fecha_programada) filter (where estatus <> 'pagado') as proximo_pago
    from public.v_pagos group by venta_id
)
select v.id as venta_id, v.lote_numero, l.superficie_m2, c.nombre as cliente, c.telefono as cliente_telefono,
       vd.nombre as vendedor, e.nombre as esquema, v.estado, v.fecha_apartado, v.fecha_contrato,
       v.precio_final, v.enganche_monto,
       coalesce(t.pagado, 0)                       as pagado,
       v.precio_final - coalesce(t.pagado, 0)      as saldo,
       coalesce(t.vencido, 0)                      as vencido,
       coalesce(t.pagos_vencidos, 0)               as pagos_vencidos,
       t.proximo_pago,
       (select sum(p.saldo) from public.v_pagos p
         where p.venta_id = v.id and p.fecha_programada = t.proximo_pago) as monto_proximo,
       case
         when v.estado = 'cancelada' then 'cancelada'
         when v.precio_final - coalesce(t.pagado, 0) <= 0.01 then 'liquidado'
         when coalesce(t.vencido, 0) > 0 then 'con atraso'
         else 'al corriente'
       end as estatus_cuenta
from public.ventas v
join public.lotes l           on l.numero = v.lote_numero
join public.clientes c        on c.id = v.cliente_id
join public.vendedores vd     on vd.id = v.vendedor_id
join public.esquemas_pago e   on e.id = v.esquema_id
left join totales t           on t.venta_id = v.id;

create view public.v_comisiones with (security_invoker = true) as
with pagos as (
  select venta_id,
         sum(monto_pagado) as pagado,
         sum(monto_pagado) filter (where tipo in ('apartado', 'enganche')) as pagado_enganche
    from public.v_pagos group by venta_id
), cumple as (
  select co.*, v.lote_numero, vd.nombre as vendedor, v.estado as estado_venta,
         case when co.parte = 1
              then coalesce(p.pagado_enganche, 0) >= v.enganche_monto - 0.01
              else coalesce(p.pagado, 0) >= v.precio_final
                     * coalesce((select valor from public.parametros where clave = 'comision_libera_pct'), 1) - 0.01
         end as condicion_cumplida
    from public.comisiones co
    join public.ventas v      on v.id = co.venta_id
    join public.vendedores vd on vd.id = co.vendedor_id
    left join pagos p         on p.venta_id = co.venta_id
)
select *,
       case when fecha_pagada is not null then 'pagada'
            when estado_venta = 'cancelada' then 'cancelada'
            when condicion_cumplida then 'por pagar'
            else 'en espera' end as estatus
from cumple;

-- ---------------------------------------------------------------------
-- Seguridad (Row Level Security)
-- ---------------------------------------------------------------------
create or replace function public.rol_actual()
returns text language sql stable security definer set search_path = public
as $$ select rol from perfiles where id = auth.uid() and activo $$;

create or replace function public.vendedor_actual()
returns bigint language sql stable security definer set search_path = public
as $$ select id from vendedores where perfil_id = auth.uid() limit 1 $$;

create or replace function public.puede_ver_venta(p_venta bigint)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.rol_actual() in ('admin', 'consulta')
      or exists (select 1 from ventas where id = p_venta and vendedor_id = public.vendedor_actual())
$$;

alter table public.parametros        enable row level security;
alter table public.perfiles          enable row level security;
alter table public.vendedores        enable row level security;
alter table public.clientes          enable row level security;
alter table public.esquemas_pago     enable row level security;
alter table public.lotes             enable row level security;
alter table public.ventas            enable row level security;
alter table public.pagos_programados enable row level security;
alter table public.pagos_recibidos   enable row level security;
alter table public.comisiones        enable row level security;

-- Lotes: cualquiera los ve (la página pública); solo un admin los modifica
create policy "lotes: todos leen"     on public.lotes for select to anon, authenticated using (true);
create policy "lotes: admin modifica" on public.lotes for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Catálogos: los usuarios del sistema leen; un admin modifica
create policy "parametros: usuarios leen"   on public.parametros    for select to authenticated using (public.rol_actual() in ('admin', 'vendedor', 'consulta'));
create policy "parametros: admin modifica"  on public.parametros    for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "esquemas: usuarios leen"     on public.esquemas_pago for select to authenticated using (public.rol_actual() in ('admin', 'vendedor', 'consulta'));
create policy "esquemas: admin modifica"    on public.esquemas_pago for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "vendedores: usuarios leen"   on public.vendedores    for select to authenticated using (public.rol_actual() in ('admin', 'vendedor', 'consulta'));
create policy "vendedores: admin modifica"  on public.vendedores    for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Perfiles: cada quien ve el suyo; un admin ve y modifica todos
create policy "perfiles: el propio"        on public.perfiles for select to authenticated
  using (id = auth.uid() or public.rol_actual() = 'admin');
create policy "perfiles: admin modifica"   on public.perfiles for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Clientes: admin y consulta ven todos; un vendedor solo los de sus ventas
create policy "clientes: ver" on public.clientes for select to authenticated
  using (public.rol_actual() in ('admin', 'consulta')
         or exists (select 1 from public.ventas v where v.cliente_id = clientes.id and v.vendedor_id = public.vendedor_actual()));
create policy "clientes: admin modifica" on public.clientes for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Ventas y todo lo que cuelga de ellas
create policy "ventas: ver"            on public.ventas            for select to authenticated using (public.puede_ver_venta(id));
create policy "ventas: admin modifica" on public.ventas            for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "programados: ver"       on public.pagos_programados for select to authenticated using (public.puede_ver_venta(venta_id));
create policy "programados: admin"     on public.pagos_programados for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "recibidos: ver"         on public.pagos_recibidos   for select to authenticated using (public.puede_ver_venta(venta_id));
create policy "recibidos: admin"       on public.pagos_recibidos   for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');
create policy "comisiones: ver"        on public.comisiones        for select to authenticated using (public.puede_ver_venta(venta_id));
create policy "comisiones: admin"      on public.comisiones        for all to authenticated
  using (public.rol_actual() = 'admin') with check (public.rol_actual() = 'admin');

-- Sin sesión solo se puede leer la tabla de lotes
revoke all on public.parametros, public.perfiles, public.vendedores, public.clientes, public.esquemas_pago,
              public.ventas, public.pagos_programados, public.pagos_recibidos, public.comisiones,
              public.v_pagos, public.v_estado_cuenta, public.v_comisiones from anon;
revoke insert, update, delete on public.lotes from anon;
grant select on public.lotes to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Las funciones internas no se llaman desde la página
revoke execute on function public.generar_calendario(bigint), public.actualizar_estado_lote(int),
                           public.actualizar_estado_venta(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Datos base
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, descripcion) values
  ('apartado_monto',          20000, 'Monto del apartado; se abona al enganche'),
  ('apartado_vigencia_dias',     15, 'Días entre el apartado y la firma del contrato'),
  ('contado_dias_escritura',     60, 'Contado: días entre contrato y escritura'),
  ('comision_parte1_pct',       0.5, 'Parte de la comisión que se paga al completar el enganche'),
  ('comision_libera_pct',         1, '% del precio pagado que libera la 2a parte (1 = al liquidar)'),
  ('dias_gracia',                 5, 'Días antes de considerar un pago atrasado'),
  ('recargo_mensual_pct',      0.02, 'Recargo mensual sobre pagos atrasados (definir con el abogado)');

insert into public.esquemas_pago (clave, nombre, tipo, enganche_pct, num_pagos, incremento_pct, descuento_pct, meses_pago, reparto_pct) values
  ('contado',    'Contado: 50% contrato, 50% escritura',          'contado',        0.50,  1, 0.00, 0.05, null, null),
  ('mensual_12', 'Enganche 20% + 12 mensualidades',               'mensual',        0.20, 12, 0.00, 0.00, null, null),
  ('mensual_18', 'Enganche 20% + 18 mensualidades',               'mensual',        0.20, 18, 0.04, 0.00, null, null),
  ('mensual_24', 'Enganche 20% + 24 mensualidades',               'mensual',        0.20, 24, 0.08, 0.00, null, null),
  ('extra_2a',   'Enganche 30% + mayo/julio/diciembre (2 años)',  'extraordinario', 0.30,  6, 0.05, 0.00, '{5,7,12}', '{0.30,0.30,0.40}');

insert into public.lotes (numero, zona, superficie_m2, precio_lista) values
  ( 1, 'carretera', 482.78, 400000),
  ( 2, 'carretera', 482.78, 400000),
  ( 3, 'carretera', 482.78, 400000),
  ( 4, 'carretera', 483.18, 400000),
  ( 5, 'carretera', 511.83, 420000),
  ( 6, 'carretera', 573.65, 450000),
  ( 7, 'carretera', 669.07, 520000),
  ( 8, 'carretera', 776.62, 600000),
  ( 9, 'carretera', 1085.37, 830000),
  (10, 'medio', 482.78, 350000),
  (11, 'medio', 482.78, 350000),
  (12, 'medio', 482.78, 350000),
  (13, 'medio', 482.78, 350000),
  (14, 'medio', 482.78, 350000),
  (15, 'medio', 482.78, 350000),
  (16, 'medio', 482.78, 350000),
  (17, 'medio', 482.78, 350000),
  (18, 'medio', 482.78, 350000),
  (19, 'medio', 701.37, 490000),
  (20, 'medio', 482.78, 350000),
  (21, 'medio', 482.78, 350000),
  (22, 'medio', 482.78, 350000),
  (23, 'medio', 482.78, 350000),
  (24, 'medio', 482.78, 350000),
  (25, 'medio', 482.78, 350000),
  (26, 'medio', 482.78, 350000),
  (27, 'medio', 482.78, 350000),
  (28, 'medio', 482.78, 350000);

commit;
