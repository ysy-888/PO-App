# PO App End-User Guide

This guide explains what the PO App does, how each part of the app is meant to be used, and what logic runs behind the scenes when an end user works through purchase orders, requests, shipments, packing lists, customers, and styles.

The app is designed for the Elevator Disco team to manage purchase orders from initial work-in-progress tracking through freight requests, shipment assignment, packing list review, warehouse/customer actions, and final closeout.

## Quick Overview

The app has seven main work areas:

- **Purchase Orders**: the main working list of POs. Users search, filter, edit, select, request actions, create shipments, and open PO details from here.
- **Shipments**: the shipment list. Users review shipment records, open shipment details, add/remove POs, edit shipment fields, or delete shipments.
- **Requests**: a dropdown section for Approval, EXF, ASN, Delivery, and Pickup requests.
- **Chargebacks**: a list of chargebacks tied to POs, with create/edit/delete behavior in the PO workflow.
- **Customers**: customer master data and customer email sending.
- **Styles**: style master data used to enrich PO rows with size/category information.
- **Vendor Submissions**: review queue for vendor-submitted packing lists before they become official packing list data.

## Sign-In and Data Loading

When the app is running in its current production-style mode, users sign in before data loads. After a successful sign-in, the app fetches the full app state from the backend.

That app state includes:

- purchase orders
- shipments
- EXF, ASN, delivery, pickup, and approval requests
- chargebacks
- packing lists and cartons
- pending vendor packing list submissions
- customers, contacts, locations, style photos, and styles
- tenant settings such as default columns, default PO status filter, and vendor submission mode

The app also still contains an older Apps Script/Google Sheets mode and a demo path, but the active configuration points to the Express API and Supabase backend.

## Main Purchase Order Workflow

The Purchase Orders tab is the main control center. Each row represents a PO and shows core fields such as status, division, vendor, buyer, PO number, style, color, quantities, freight dates, shipment ID, request IDs, ETA/IHD dates, cancel date, and notes.

Users can:

- search across visible PO data
- filter by division, status, flags, and column filters
- sort by columns
- select one or more POs for batch actions
- batch edit selected POs when the toolbar action is available
- edit allowed fields directly in the table or inside the PO detail modal
- create EXF, ASN, delivery, pickup, or shipment actions when selected rows are eligible
- open packing list details from the packing list column/group
- open linked request or shipment detail views from PO-related fields

By default, the list is sorted around operational timing, especially cancel dates, and the app applies a default status filter from settings when data loads.

## PO Status Logic

PO status controls what actions are available. The app limits manual status changes so users follow the intended workflow.

Supported manual transitions include:

- **Pending** can move to Hold, CXL, or WIP.
- **Hold** can move to CXL or WIP.
- **WIP** can move to Hold or CXL.
- **OTW** can move to In Warehouse, Hold, CXL, or Closed.
- **Scheduled** can move to In Warehouse, Hold, CXL, or Closed.
- **In Warehouse** can move to Hold, CXL, or Closed.
- **Assigned** can move to In Warehouse, Hold, CXL, or Closed.

Some older statuses are normalized when data loads:

- **Received** becomes **In Warehouse**.
- **Arrived at Port** becomes **OTW**.
- **Shipped** becomes **OTW** if the PO has a shipment, otherwise **In Warehouse**.

Closed POs are protected from packing list edits. If N41 shows a row as Closed while the PO status is not Closed, the app can highlight that mismatch without automatically changing the PO status.

## Automatic PO Updates

The app performs several automatic updates after data loads:

- It resets all row selections locally, so old selections do not persist after refresh.
- It calculates display totals from packing carton data when available.
- It enriches PO rows with style master size/category fields when the PO row is missing them.
- It syncs assigned dates from linked pickup requests.
- It flags assigned POs when their assignment/pickup date is today or earlier.
- It saves certain automatic status/flag updates back to the backend.

## Editing and Saving

When a user edits a PO field, the app saves only real backend fields. UI-only fields such as row selection and packing list controls are not saved.

In API mode, saves go through the Express backend using the signed-in user's Supabase access token. The app shows save, success, and error messages in the footer or modal area so users know whether their change persisted.

The app prevents conflicting operations while a large save/import/approval action is in progress by showing a saving overlay and disabling related buttons.

Some PO fields become shipment-managed after a PO is linked to a shipment. In that case, users should edit the shipment record instead of editing synced freight fields directly on the PO.

## CSV Import Logic

The header menu includes import behavior for multiple data types.

### PO Import

PO CSV import reads a CSV export, maps known CSV fields to app fields, normalizes dates and numeric values, deduplicates rows by PO number, and compares incoming rows against the current PO data.

Only new or changed POs are sent to the backend. After import, the app shows a summary of added, updated, skipped, and errored rows.

The export action creates a CSV from the current app data so users can pull filtered or current-state information out of the app for reporting or review.

### Customer Import

Customer CSV import maps customer master fields such as customer code, address, contact, phone, and email. Rows are deduplicated by customer code. Only new or changed customers are uploaded.

### Style Import

Style master CSV import maps N41-style fields such as style, color, size category, style category, description, cost, and division. Styles are keyed by style number plus color. Size category values are expanded into the size labels used by PO rows.

Style import requires API mode.

## Requests Workflow

The Requests navigation tab contains five request queues:

- **Approvals**
- **EXF**
- **ASN**
- **Delivery**
- **Pickup**

Each request type has its own list, search behavior, detail modal, linked PO table, email status fields, and resend email behavior.

In API mode, email sending and resending goes through the Express API so Supabase remains the source of truth for email status. The API uses the configured Apps Script deployment only as the mail relay.

### EXF Requests

EXF requests are available for POs in WIP status that have not already had an EXF requested.

When an EXF request is created:

- the app generates an EXF request ID
- records the requested EXF date, vendor, vendor email/CC, notes, linked PO numbers, PO count, and email status
- marks linked POs as EXF requested
- writes the EXF request ID, EXF date, EXF request date, per-PO memo, and optional ship method back to the linked POs

### ASN Requests

ASN requests are available when selected POs are ready for request processing:

- each selected PO must be OTW
- each selected PO must have a packing list
- all selected POs must be for an eligible buyer: LULU'S FASHION LOUNGE or 12TH TRIBE
- selected POs cannot already have delivery or pickup requests
- selected POs cannot already have an ASN request

When an ASN request is created, the app stores the request and marks linked POs with ASN requested, ASN request ID, ASN date, and ASN request date.

### Delivery Requests

Delivery requests are available when:

- each selected PO is OTW
- each selected PO has a packing list
- all selected POs are under the Elevator Disco division
- no selected PO already has a delivery or pickup request

When a delivery request is created, the app stores the request and marks linked POs with delivery requested, delivery request ID, delivery date, and delivery request date.

### Pickup Requests

Pickup requests are available when:

- each selected PO is OTW
- each selected PO has a packing list
- all selected POs are for an eligible ASN buyer: LULU'S FASHION LOUNGE or 12TH TRIBE
- each selected PO already has an ASN request
- no selected PO already has a pickup or delivery request

When a pickup request is created, the app stores the request and marks linked POs with pickup requested, pickup request ID, pickup date, and pickup request date. Linked pickup requests can also drive the PO assign date.

### Approval Requests

Approval requests are tied to a single PO. Creating an approval request generates an approval ID and links it back to the PO.

Typical approval types include shortage, overage, and extension-style requests. These requests are handled from the PO context rather than from multi-select toolbar actions.

When an approval is later updated to Approved or Rejected, the PO's N41 Status is updated to match that approval result.

## Shipments Workflow

Shipments group one or more POs under a shipment ID.

Users can create a shipment from eligible selected POs, open shipment detail, edit shipment fields, add POs to a shipment, remove POs from a shipment, or delete shipments.

A PO is eligible for shipment when:

- it does not already have a shipment
- it is WIP, or it is Requested after EXF has been requested

When a shipment is created:

- the backend generates a shipment ID like SHP-0001
- shipment fields are saved as a shipment record
- linked POs receive the shipment ID and synced shipment fields

Synced shipment fields include:

- Ship Method
- Vessel
- House #
- EXF
- Shipped
- ETD
- ETA
- IHD

When a shipment is updated, those same fields sync back to all linked POs. When a shipment is deleted or a PO is removed from it, the shipment ID and shipment fields are cleared from the affected POs.

## Packing Lists

Packing lists track carton-level production/packing quantities for a PO.

Users can save a packing list with carton lines. The app validates that:

- the PO exists
- the PO is not Closed
- at least one carton exists
- no carton has a zero total quantity

When a packing list is saved:

- the backend creates or updates a packing list ID like PL-0001
- all cartons for that packing list are replaced with the submitted carton list
- the PO is marked as having a packing list
- carton count is synced to Ctn Qty
- actual quantity is calculated from carton totals
- Act Unit fields are populated from carton totals

When a packing list is deleted, the app deletes the list and carton records and clears the packing-related PO fields.

## Vendor Submissions

The Vendor Submissions tab is a review queue for pending packing lists submitted by vendors.

Users can:

- search submissions
- open a submission to compare/review it in the PO context
- approve one pending submission
- select and approve multiple pending submissions
- reject a pending submission

When a pending submission is approved, it becomes the official packing list data for that PO. In review mode, users approve submissions before they affect official packing data. In direct mode, vendor submissions can bypass the review queue depending on settings.

Vendor portal links are managed from settings. These links let vendors submit packing list data without using the main internal PO table.

## Chargebacks

Chargebacks are records tied to a PO, with fields such as chargeback ID, PO number, amount, reason, status, date, and notes.

The app can calculate a PO's total chargeback amount by summing chargebacks linked to that PO. Users can create, update, and delete chargebacks through the chargeback workflow.

## Customers

The Customers tab shows customer master data and email-send state.

Users can:

- search customers
- select customers with valid email addresses
- send an email to one customer
- batch email multiple selected customers

The customer email template includes a customer name placeholder and records when an email has been sent.

## Styles

The Styles tab shows style master data keyed by style number and color.

The app uses style master data to fill missing PO size labels and style category values. This helps packing list and quantity displays stay consistent even when the PO import did not include all style-size detail.

## Settings and View Preferences

The header menu and settings modal control user/app preferences such as:

- column visibility
- default column setup
- default status filter
- date format preference
- CXL countdown preference
- split view preference
- vendor submission mode
- test/live mode for the legacy Apps Script path

Some preferences are stored locally in the browser. Shared defaults are saved through the backend settings API.

The settings area is also where users manage vendor portal behavior, including whether vendor-submitted packing lists require internal review before becoming official.

## Backend Behavior in Plain English

The browser app is the user interface. The Express backend is the API layer. Supabase stores the actual tenant-scoped data.

Each signed-in user belongs to a tenant. API calls require authentication, and backend queries use the tenant ID so users only work with their tenant's data.

Most business records are stored with a stable ID and a flexible data object. For example:

- POs are stored by PO number.
- Shipments are stored by shipment ID.
- Requests are stored by request ID.
- Packing lists are stored by packing list ID.
- Chargebacks are stored by chargeback ID.

This lets the frontend continue using spreadsheet-like field names while the backend handles persistence, tenant scoping, and generated IDs.

## Typical Daily Flow

1. Sign in.
2. Import new PO, customer, or style data if needed.
3. Review the Purchase Orders tab using division, status, search, and column filters.
4. Update PO statuses and key dates as work progresses.
5. Create EXF requests for eligible WIP POs.
6. Create shipments once POs are ready to be grouped under freight details.
7. Save or review packing lists so actual quantities and carton quantities are available.
8. Create ASN, delivery, or pickup requests when POs are OTW and have packing list data.
9. Review vendor submissions and approve accepted packing lists.
10. Track chargebacks, customer email needs, and final closed status.

## Important User Rules

- A PO must be eligible before request buttons appear.
- Closed POs cannot have packing lists edited.
- Request and shipment actions update both their own records and linked PO fields.
- Shipment fields are synced from the shipment record to linked POs.
- Packing quantities are calculated from cartons, not manually guessed.
- Imports only upload new or changed rows after comparing against current data.
- Email status belongs to request/customer records in Supabase; the API calls Apps Script only to relay the email.

## Troubleshooting

- If data does not load, confirm the user is signed in and try Refresh.
- If a save fails, check the error message shown in the app footer or modal and retry after the current save/import finishes.
- If a request or shipment button is missing, the selected POs are not eligible for that action.
- If packing list changes are blocked, check whether the PO is Closed.
- If email status is not updating as expected, confirm the API has `APPS_SCRIPT_URL` configured and that the Apps Script deployment includes the `sendRawEmail` action.
- If imported rows are skipped, the app may have found no differences compared with existing data, or the CSV row may be missing the required key such as PO number, customer code, or style/color.
