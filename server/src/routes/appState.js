/**
 * GET /api/app-state
 *
 * Returns the same JSON envelope that the frontend's loadData() function
 * expects from the Apps Script doGet response.  All arrays are populated
 * from Supabase; the schema for every entity except purchase_orders requires
 * migration 002_full_schema.sql to have been applied first.
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth, isPortalRole } from "../auth.js";

const router = Router();

/** PostgREST / Postgres codes when a settings table is missing or not in schema cache. */
function isMissingTableError(error) {
  if (!error) return false;
  const code = error.code;
  if (code === "42P01" || code === "PGRST205") return true;
  const msg = String(error.message || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("could not find the table");
}

/** Read settings JSONB; log and return {} on any query failure so data still loads. */
function unwrapSettings(result, label) {
  if (!result.error) return result.data?.settings || {};
  if (isMissingTableError(result.error)) {
    console.warn(`${label} table not available — using default settings.`);
  } else {
    console.error(`${label} query failed:`, result.error);
  }
  return {};
}

router.get("/app-state", requireAuth, async (req, res) => {
  const tid = req.tenantId;

  // Showroom portal accounts get sales orders only — no POs, shipments,
  // invoices, or any other entity. The frontend switches to portal mode
  // when it sees portalMode: true.
  if (isPortalRole(req.userRole)) {
    try {
      const [salesOrdersResult, userSettingsResult] = await Promise.all([
        supabase.from("sales_orders").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
        supabase.from("user_settings").select("settings").eq("tenant_id", tid).eq("user_id", req.userId).maybeSingle(),
      ]);
      if (salesOrdersResult.error) {
        console.error("portal app-state query failed:", salesOrdersResult.error);
        return res.status(500).json({ success: false, error: "Failed to load app state." });
      }
      return res.json({
        success: true,
        portalMode: true,
        userEmail: req.userEmail || "",
        data: [],
        shipments: [],
        exfRequests: [],
        asnRequests: [],
        deliveryRequests: [],
        pickupRequests: [],
        approvals: [],
        chargebacks: [],
        packingLists: [],
        packingCartons: [],
        pendingPackingLists: [],
        customers: [],
        contacts: [],
        vendors: [],
        locations: [],
        stylePhotos: [],
        styles: [],
        // Portal accounts see Elevator Disco orders only. Memo is
        // internal-only — strip it so it can't surface via search, export,
        // or the network payload. Comments stay (shared thread).
        salesOrders: (salesOrdersResult.data || [])
          .map(row => {
            const { Memo, ...rest } = row.data || {};
            return rest;
          })
          .filter(order =>
            String(order.Division ?? "").trim().toLowerCase() === "elevator disco"
          ),
        invoices: [],
        vendorSubmitMode: "review",
        chargebacksEnabled: false,
        vendorSubmissionsEnabled: false,
        userSettings: unwrapSettings(userSettingsResult, "user_settings"),
        defaultColumns: null,
        defaultStatusFilter: "__open__",
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: "Server error." });
    }
  }

  try {
    // Run all table queries in parallel for speed.
    const [
      posResult,
      shipmentsResult,
      exfResult,
      asnResult,
      deliveryResult,
      pickupResult,
      approvalsResult,
      chargebacksResult,
      packingListsResult,
      packingCartonsResult,
      pendingPackingListsResult,
      customersResult,
      contactsResult,
      locationsResult,
      stylePhotosResult,
      stylesResult,
      salesOrdersResult,
      invoicesResult,
      settingsResult,
      userSettingsResult,
    ] = await Promise.all([
      supabase.from("purchase_orders").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("shipments").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("exf_requests").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("asn_requests").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("delivery_requests").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("pickup_requests").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("approvals").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("chargebacks").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("packing_lists").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("packing_cartons").select("packing_list_entity_id, carton_number, data").eq("tenant_id", tid).order("packing_list_entity_id").order("carton_number"),
      supabase.from("pending_packing_lists").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("customers").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("contacts").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("locations").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("style_photos").select("data").eq("tenant_id", tid),
      supabase.from("styles").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("sales_orders").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("invoices").select("data").eq("tenant_id", tid).order("created_at", { ascending: true }),
      supabase.from("tenant_settings").select("settings").eq("tenant_id", tid).maybeSingle(),
      supabase.from("user_settings").select("settings").eq("tenant_id", tid).eq("user_id", req.userId).maybeSingle(),
    ]);

    // Surface any Supabase errors.  Tables from migration 002 may not exist
    // yet if that migration hasn't been applied; in that case just return empty
    // arrays so the app still loads POs correctly.
    const tableError = [
      posResult, shipmentsResult, exfResult, asnResult, deliveryResult,
      pickupResult, approvalsResult, chargebacksResult, packingListsResult,
      packingCartonsResult, pendingPackingListsResult, customersResult,
      contactsResult, locationsResult, stylePhotosResult, stylesResult,
      salesOrdersResult, invoicesResult,
    ].find(r => r.error);

    if (tableError?.error) {
      // If the error is "relation does not exist" (42P01) it means migration
      // 002 hasn't been run yet — degrade gracefully.
      const code = tableError.error.code;
      if (code !== "42P01") {
        console.error("app-state query failed:", tableError.error);
        return res.status(500).json({ success: false, error: "Failed to load app state." });
      }
      // Migration not applied: return POs only (same as before migration 002).
      console.warn("Migration 002 not applied — returning POs only.");
    }

    // Unwrap helpers
    const rows = (r) => (r.error ? [] : (r.data || []).map(row => row.data));

    // Packing cartons need the "Packing List ID" field injected from the
    // packing_list_entity_id column so the frontend can group them correctly.
    const packingCartons = (packingCartonsResult.data || []).map(row => ({
      "Packing List ID": row.packing_list_entity_id,
      ...row.data,
    }));

    // Settings: vendor mode is tenant-wide; UI/table preferences are per-user.
    const settings = unwrapSettings(settingsResult, "tenant_settings");
    const userSettings = unwrapSettings(userSettingsResult, "user_settings");
    const vendorSubmitMode = settings.vendorSubmitMode ?? "review";
    const buildDefaultColumns = (source) => {
      if (!source.defaultColumns) return null;
      if (Array.isArray(source.defaultColumnOrder)) {
        return { order: source.defaultColumnOrder, visible: source.defaultColumns };
      }
      return source.defaultColumns;
    };
    const defaultColumns = buildDefaultColumns(userSettings) ?? buildDefaultColumns(settings);
    const defaultStatusFilter = userSettings.defaultStatusFilter ?? settings.defaultStatusFilter ?? "__open__";

    return res.json({
      success: true,
      portalMode: false,
      userEmail: req.userEmail || "",
      // PO data
      data: rows(posResult),
      // Shipments
      shipments: rows(shipmentsResult),
      // Request types
      exfRequests: rows(exfResult),
      asnRequests: rows(asnResult),
      deliveryRequests: rows(deliveryResult),
      pickupRequests: rows(pickupResult),
      approvals: rows(approvalsResult),
      // Chargebacks
      chargebacks: rows(chargebacksResult),
      // Packing
      packingLists: rows(packingListsResult),
      packingCartons,
      pendingPackingLists: rows(pendingPackingListsResult),
      // Reference data
      customers: rows(customersResult),
      contacts: rows(contactsResult),
      vendors: rows(contactsResult),  // legacy alias kept for cached clients
      locations: rows(locationsResult),
      stylePhotos: rows(stylePhotosResult),
      styles: rows(stylesResult),
      salesOrders: rows(salesOrdersResult),
      invoices: rows(invoicesResult),
      // Settings
      vendorSubmitMode,
      chargebacksEnabled: settings.chargebacksEnabled !== false,
      vendorSubmissionsEnabled: settings.vendorSubmissionsEnabled !== false,
      userSettings,
      defaultColumns,
      defaultStatusFilter,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error." });
  }
});

export default router;
