export class PackingPrintContext {
  constructor({ poRows, listsByPo, cartonsByListId }) {
    this.poRows = poRows;
    this.listsByPo = listsByPo;
    this.cartonsByListId = cartonsByListId;
  }

  getPoRow(poNumber) {
    return this.poRows.find(row => String(row["PO #"]) === String(poNumber)) ?? null;
  }

  getPackingListForPo(poNumber) {
    return this.listsByPo.get(String(poNumber ?? "").trim()) ?? null;
  }

  getCartonsForPo(poNumber) {
    const list = this.getPackingListForPo(poNumber);
    if (!list) return [];
    const listId = String(list["Packing List ID"] ?? "").trim();
    return this.cartonsByListId.get(listId) ?? [];
  }

  static async load(supabase, tenantId, poNumbers) {
    const normalized = [...new Set(poNumbers.map(po => String(po ?? "").trim()).filter(Boolean))];
    if (normalized.length === 0) {
      return new PackingPrintContext({
        poRows: [],
        listsByPo: new Map(),
        cartonsByListId: new Map(),
      });
    }

    const { data: poData, error: poErr } = await supabase
      .from("purchase_orders")
      .select("po_number, data")
      .eq("tenant_id", tenantId)
      .in("po_number", normalized.map(String));
    if (poErr) throw poErr;

    const byPo = new Map((poData || []).map(row => [String(row.po_number), row.data || {}]));
    const poRows = normalized.map(po => byPo.get(String(po))).filter(Boolean);

    const { data: listData, error: listErr } = await supabase
      .from("packing_lists")
      .select("entity_id, data")
      .eq("tenant_id", tenantId);
    if (listErr) throw listErr;

    const listsByPo = new Map();
    const listIds = [];
    for (const row of listData || []) {
      const po = String(row.data?.["PO #"] ?? "").trim();
      if (!po || !normalized.includes(po)) continue;
      listsByPo.set(po, row.data || {});
      const listId = String(row.data?.["Packing List ID"] ?? row.entity_id ?? "").trim();
      if (listId) listIds.push(listId);
    }

    const cartonsByListId = new Map();
    if (listIds.length > 0) {
      const { data: cartonData, error: cartonErr } = await supabase
        .from("packing_cartons")
        .select("packing_list_entity_id, carton_number, data")
        .eq("tenant_id", tenantId)
        .in("packing_list_entity_id", listIds);
      if (cartonErr) throw cartonErr;

      for (const row of cartonData || []) {
        const listId = String(row.packing_list_entity_id ?? "").trim();
        if (!listId) continue;
        if (!cartonsByListId.has(listId)) cartonsByListId.set(listId, []);
        cartonsByListId.get(listId).push(row.data || {});
      }
      for (const cartons of cartonsByListId.values()) {
        cartons.sort((a, b) => toQtyNumber(a["Carton #"]) - toQtyNumber(b["Carton #"]));
      }
    }

    return new PackingPrintContext({ poRows, listsByPo, cartonsByListId });
  }
}

function toQtyNumber(val) {
  const n = Number(String(val ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}
