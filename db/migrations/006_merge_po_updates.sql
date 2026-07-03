-- 006_merge_po_updates.sql
--
-- Atomic JSONB merge for purchase order updates.
--
-- Fixes two problems with the previous read-merge-write pattern in the API:
--   1. Lost updates: two concurrent editors (or the automatic status batch
--      racing a manual edit) could overwrite each other's fields, because
--      each writer wrote back the ENTIRE data object it had read earlier.
--      Merging with `data || patch` inside Postgres only touches the keys
--      being changed, so concurrent writers to different fields both win.
--   2. N round trips: batch updates previously issued one UPDATE per PO.
--      This function takes the whole batch as a JSONB array and applies it
--      in a single call.
--
-- Called only by the API server (service role). Not exposed to clients.
--
-- p_items shape: [{ "poNumber": "12345", "updates": { "Status": "Shipped" } }, ...]
-- Returns:       { "updated": <count>, "missing": ["<poNumber>", ...] }

create or replace function public.merge_po_updates(p_tenant_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item      jsonb;
  v_po      text;
  v_updates jsonb;
  v_count   int;
  v_updated int    := 0;
  v_missing text[] := '{}';
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    return jsonb_build_object('updated', 0, 'missing', '[]'::jsonb);
  end if;

  for item in select * from jsonb_array_elements(p_items)
  loop
    v_po      := trim(item->>'poNumber');
    v_updates := item->'updates';

    if v_po is null or v_po = ''
       or v_updates is null or jsonb_typeof(v_updates) <> 'object' then
      continue;
    end if;

    update public.purchase_orders
       set data = coalesce(data, '{}'::jsonb) || v_updates
     where tenant_id = p_tenant_id
       and po_number = v_po;

    get diagnostics v_count = row_count;
    if v_count = 0 then
      v_missing := array_append(v_missing, v_po);
    else
      v_updated := v_updated + v_count;
    end if;
  end loop;

  return jsonb_build_object('updated', v_updated, 'missing', to_jsonb(v_missing));
end;
$$;

-- Service-role only; never callable from the browser.
revoke all on function public.merge_po_updates(uuid, jsonb) from public;
revoke all on function public.merge_po_updates(uuid, jsonb) from anon;
revoke all on function public.merge_po_updates(uuid, jsonb) from authenticated;
