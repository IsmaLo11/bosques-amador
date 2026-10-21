-- =====================================================================
-- Bosques Amador · Datos de ejemplo (opcional)
-- Ejecutar DESPUÉS de 01_base_de_datos.sql. Son ventas ficticias para probar:
--   lote 28 vendido (18 mensualidades, debe octubre 2026),
--   lote 9 apartado (mayo/julio/diciembre) y lote 13 apartado (12 mensualidades).
-- Para quitarlos después: 03_borrar_ejemplos.sql
-- =====================================================================

begin;

insert into public.vendedores (nombre, telefono) values
  ('Vendedor de ejemplo 1', '246 000 0001'),
  ('Vendedor de ejemplo 2', '246 000 0002');

insert into public.clientes (nombre, telefono, correo, notas) values
  ('Cliente de ejemplo A', '222 000 0001', 'clienteA@ejemplo.com', 'EJEMPLO'),
  ('Cliente de ejemplo B', '222 000 0002', 'clienteB@ejemplo.com', 'EJEMPLO'),
  ('Cliente de ejemplo C', '222 000 0003', 'clienteC@ejemplo.com', 'EJEMPLO');

-- Al guardar cada venta se generan solos su calendario y sus comisiones
insert into public.ventas (lote_numero, cliente_id, vendedor_id, esquema_id, fecha_apartado, fecha_contrato, notas)
select x.lote,
       (select id from public.clientes where nombre = x.cliente),
       (select id from public.vendedores where nombre = x.vendedor),
       (select id from public.esquemas_pago where clave = x.esquema),
       x.apartado, x.contrato, 'EJEMPLO'
from (values
  (28, 'Cliente de ejemplo A', 'Vendedor de ejemplo 1', 'mensual_18', date '2026-05-08', date '2026-05-15'),
  ( 9, 'Cliente de ejemplo B', 'Vendedor de ejemplo 2', 'extra_2a',   date '2026-10-10', null::date),
  (13, 'Cliente de ejemplo C', 'Vendedor de ejemplo 1', 'mensual_12', date '2026-10-18', null::date)
) as x (lote, cliente, vendedor, esquema, apartado, contrato);

-- Pagos que ya entraron
insert into public.pagos_recibidos (pago_programado_id, fecha_pago, monto, forma_pago, referencia)
select pp.id, x.fecha, x.monto, x.forma, x.ref
from (values
  (28, 'apartado',    0, date '2026-05-08', 20000.00, 'transferencia', 'SPEI 0001'),
  (28, 'enganche',    0, date '2026-05-15', 52800.00, 'transferencia', 'SPEI 0002'),
  (28, 'mensualidad', 1, date '2026-06-14', 16177.78, 'transferencia', 'SPEI 0003'),
  (28, 'mensualidad', 2, date '2026-07-15', 16177.78, 'depósito',      'Ficha 0004'),
  (28, 'mensualidad', 3, date '2026-08-16', 16177.78, 'transferencia', 'SPEI 0005'),
  (28, 'mensualidad', 4, date '2026-09-15', 16177.78, 'transferencia', 'SPEI 0006'),
  ( 9, 'apartado',    0, date '2026-10-10', 20000.00, 'efectivo',      'Recibo 0007'),
  (13, 'apartado',    0, date '2026-10-18', 20000.00, 'transferencia', 'SPEI 0008')
) as x (lote, tipo, numero, fecha, monto, forma, ref)
join public.ventas v on v.lote_numero = x.lote and v.estado <> 'cancelada'
join public.pagos_programados pp on pp.venta_id = v.id and pp.tipo = x.tipo and pp.numero = x.numero;

-- Al vendedor del lote 28 ya se le pagó la primera mitad de su comisión
update public.comisiones set fecha_pagada = date '2026-05-31'
where parte = 1 and venta_id = (select id from public.ventas where lote_numero = 28 and estado <> 'cancelada');

commit;
