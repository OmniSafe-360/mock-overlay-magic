-- Fase 4.1 — tipo de movimento das perdas (separado porque um valor novo de enum só pode ser usado depois de gravado).
alter type public.tipo_movimento add value if not exists 'perda';
