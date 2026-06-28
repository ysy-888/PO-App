/**
 * GET /api/app-state
 *
 * Returns the same JSON envelope that the frontend's loadData() function
 * expects from the Apps Script doGet response.  Only POs are populated from
 * Supabase in this first slice; all other arrays return empty so existing
 * frontend rendering code keeps working without modification.
 */

import { Router } from "express";
import supabase from "../supabase.js";
import { requireAuth } from "../auth.js";

const router = Router();

router.get("/app-state", requireAuth, async (req, res) => {
  try {
    // Fetch all purchase orders for this tenant.
    // The `data` JSONB column holds the row object the frontend expects
    // (field names like "PO #", "Status", "Vendor", etc.).
    const { data: rows, error } = await supabase
      .from("purchase_orders")
      .select("data")
      .eq("tenant_id", req.tenantId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("purchase_orders select failed:", error);
      return res.json({ success: false, error: "Failed to load purchase orders." });
    }

    // Unwrap the jsonb wrapper: each row.data is a plain object.
    const poData = (rows || []).map((r) => r.data);

    // Return the full envelope shape so loadData() in data-pipeline.js
    // can process it without any changes to downstream code.
    return res.json({
      success: true,
      data: poData,
      shipments: [],
      exfRequests: [],
      contacts: [],
      vendors: [],        // legacy alias kept for cached clients
      locations: [],
      asnRequests: [],
      deliveryRequests: [],
      pickupRequests: [],
      chargebacks: [],
      approvals: [],
      packingLists: [],
      packingCartons: [],
      stylePhotos: [],
      pendingPackingLists: [],
      customers: [],
      vendorSubmitMode: "review",
      defaultColumns: null,
      defaultStatusFilter: "__open__",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Server error." });
  }
});

export default router;
