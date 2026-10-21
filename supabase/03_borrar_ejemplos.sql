-- Bosques Amador · Quita las ventas, clientes y vendedores de ejemplo.
-- Al borrar las ventas se borran sus pagos y comisiones, y los lotes vuelven a "disponible".
-- Clientes y vendedores de ejemplo solo se borran si ya no tienen ninguna venta.
delete from public.ventas where notas = 'EJEMPLO';
delete from public.clientes
where notas = 'EJEMPLO'
  and not exists (select 1 from public.ventas v where v.cliente_id = clientes.id);
delete from public.vendedores
where nombre in ('Vendedor de ejemplo 1', 'Vendedor de ejemplo 2')
  and not exists (select 1 from public.ventas v where v.vendedor_id = vendedores.id);
