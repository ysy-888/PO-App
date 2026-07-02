/**
 * Fallback loader when /api/app-state fails (e.g. missing user_settings table
 * on a not-yet-deployed API). Reads the same data via Supabase + user JWT + RLS.
 */

function isMissingTableSupabaseError(error) {
  if (!error) return false;
  const code = error.code;
  if (code === "42P01" || code === "PGRST205") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find the table");
}

function shouldFallbackToSupabaseAppState(errorMessage) {
  const msg = String(errorMessage || "").toLowerCase();
  return msg.includes("failed to load settings") || msg.includes("failed to load app state");
}

async function querySupabaseRows(client, table, select, orderColumn = "created_at") {
  let query = client.from(table).select(select);
  if (orderColumn) query = query.order(orderColumn, { ascending: true });
  const { data, error } = await query;
  if (error) {
    if (!isMissingTableSupabaseError(error)) {
      console.warn(`Supabase fallback: ${table} query failed`, error);
    }
    return [];
  }
  return data || [];
}

function buildDefaultColumnsFromSettings(source) {
  if (!source?.defaultColumns) return null;
  if (Array.isArray(source.defaultColumnOrder)) {
    return { order: source.defaultColumnOrder, visible: source.defaultColumns };
  }
  return source.defaultColumns;
}

async function fetchSupabaseAppState() {
  if (typeof getSupabaseClient !== "function") {
    throw new Error("Supabase client is not available.");
  }

  const client = getSupabaseClient();
  const [
    posRows,
    shipmentsRows,
    exfRows,
    asnRows,
    deliveryRows,
    pickupRows,
    approvalsRows,
    chargebacksRows,
    packingListsRows,
    packingCartonsRows,
    pendingPackingListsRows,
    customersRows,
    contactsRows,
    locationsRows,
    stylePhotosRows,
    stylesRows,
    salesOrdersRows,
    tenantSettingsResult,
  ] = await Promise.all([
    querySupabaseRows(client, "purchase_orders", "data"),
    querySupabaseRows(client, "shipments", "data"),
    querySupabaseRows(client, "exf_requests", "data"),
    querySupabaseRows(client, "asn_requests", "data"),
    querySupabaseRows(client, "delivery_requests", "data"),
    querySupabaseRows(client, "pickup_requests", "data"),
    querySupabaseRows(client, "approvals", "data"),
    querySupabaseRows(client, "chargebacks", "data"),
    querySupabaseRows(client, "packing_lists", "data"),
    querySupabaseRows(client, "packing_cartons", "packing_list_entity_id, carton_number, data", null),
    querySupabaseRows(client, "pending_packing_lists", "data"),
    querySupabaseRows(client, "customers", "data"),
    querySupabaseRows(client, "contacts", "data"),
    querySupabaseRows(client, "locations", "data"),
    querySupabaseRows(client, "style_photos", "data", null),
    querySupabaseRows(client, "styles", "data"),
    querySupabaseRows(client, "sales_orders", "data"),
    client.from("tenant_settings").select("settings").maybeSingle(),
  ]);

  const unwrap = (rows) => rows.map(row => row.data);
  const packingCartons = packingCartonsRows.map(row => ({
    "Packing List ID": row.packing_list_entity_id,
    ...row.data,
  }));

  const settings = tenantSettingsResult.error ? {} : (tenantSettingsResult.data?.settings || {});

  return {
    success: true,
    data: unwrap(posRows),
    shipments: unwrap(shipmentsRows),
    exfRequests: unwrap(exfRows),
    asnRequests: unwrap(asnRows),
    deliveryRequests: unwrap(deliveryRows),
    pickupRequests: unwrap(pickupRows),
    approvals: unwrap(approvalsRows),
    chargebacks: unwrap(chargebacksRows),
    packingLists: unwrap(packingListsRows),
    packingCartons,
    pendingPackingLists: unwrap(pendingPackingListsRows),
    customers: unwrap(customersRows),
    contacts: unwrap(contactsRows),
    vendors: unwrap(contactsRows),
    locations: unwrap(locationsRows),
    stylePhotos: unwrap(stylePhotosRows),
    styles: unwrap(stylesRows),
    salesOrders: unwrap(salesOrdersRows),
    vendorSubmitMode: settings.vendorSubmitMode ?? "review",
    chargebacksEnabled: settings.chargebacksEnabled !== false,
    vendorSubmissionsEnabled: settings.vendorSubmissionsEnabled !== false,
    userSettings: {},
    defaultColumns: buildDefaultColumnsFromSettings(settings),
    defaultStatusFilter: settings.defaultStatusFilter ?? "__open__",
  };
}

function applyAppStatePayload(json) {
  allChargebacks = (json.chargebacks ?? []).map(normalizeChargeback);
  allAsnRequests = (json.asnRequests ?? []).map(row => ({ ...row }));
  allPackingLists = (json.packingLists ?? []).map(normalizePackingList);
  allPackingCartons = (json.packingCartons ?? []).map(normalizePackingCarton);
  allContactRows = json.contacts ?? json.vendors ?? [];
  allVendorEmailRows = allContactRows;
  allLocationRows = json.locations ?? [];
  buildStylePhotoIndex(json.stylePhotos ?? []);
  buildStyleMasterIndex(json.styles ?? []);
  if (typeof onPendingPackingListsDataLoaded === "function") {
    onPendingPackingListsDataLoaded(json.pendingPackingLists ?? [], json.vendorSubmitMode);
  }
  if (typeof onCustomersDataLoaded === "function") {
    onCustomersDataLoaded(json.customers ?? []);
  }
  if (typeof onStylesDataLoaded === "function") {
    onStylesDataLoaded(json.styles ?? []);
  }
  if (typeof onSalesOrdersDataLoaded === "function") {
    onSalesOrdersDataLoaded(json.salesOrders ?? []);
  }
  allRows = (json.data ?? []).map(row => applyStyleSizesToRow(normalizeRow(row)));
  window.__pendingShipments = json.shipments ?? [];
  window.__pendingExfRequests = json.exfRequests ?? [];
  window.__pendingAsnRequests = json.asnRequests ?? [];
  window.__pendingDeliveryRequests = json.deliveryRequests ?? [];
  window.__pendingPickupRequests = json.pickupRequests ?? [];
  window.__pendingApprovals = json.approvals ?? [];
  if (typeof onShipmentsDataLoaded === "function") {
    onShipmentsDataLoaded(window.__pendingShipments);
    window.__pendingShipments = null;
  }
  if (typeof onExfRequestsDataLoaded === "function") {
    onExfRequestsDataLoaded(window.__pendingExfRequests);
    window.__pendingExfRequests = null;
  }
  if (json.defaultColumns) applyDefaultColumnsFromServer(json.defaultColumns);
  applyDefaultStatusFilterFromServer(json.defaultStatusFilter);
  applyUserSettingsFromServer(json.userSettings);
  if (typeof applyTenantFeaturesFromServer === "function") applyTenantFeaturesFromServer(json);
  saveProgramColumnDefaultToStorage();
}
