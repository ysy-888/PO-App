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
import { requireAuth } from "../auth.js";

const router = Router();

router.get("/app-state", requireAuth, async (req, res) => {
  const tid = req.tenantId;

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

    const settingsError = [settingsResult, userSettingsResult].find(r => r.error);
    if (settingsError?.error) {
      const code = settingsError.error.code;
      if (code !== "42P01") {
        console.error("settings query failed:", settingsError.error);
        return res.status(500).json({ success: false, error: "Failed to load settings." });
      }
      console.warn("Settings migration not applied — returning default settings.");
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
    const settings = settingsResult.error ? {} : (settingsResult.data?.settings || {});
    const userSettings = userSettingsResult.error ? {} : (userSettingsResult.data?.settings || {});
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
      // Settings
      vendorSubmitMode,
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
