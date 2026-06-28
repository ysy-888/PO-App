# Database Migrations

All migration files live in `db/migrations/`. Run them in order in the Supabase SQL editor, or via the Supabase CLI (`supabase db push`).

## How to apply

### Option A — Supabase SQL editor (quickest for first setup)
1. Open your Supabase project → **SQL editor**.
2. Paste the contents of each migration file in order and click **Run**.

### Option B — Supabase CLI
```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Migration files

| File | What it creates |
|---|---|
| `001_initial_schema.sql` | `tenants`, `profiles`, `tenant_memberships`, `purchase_orders` tables + RLS policies |
| `002_full_schema.sql` | Shipments, requests, packing, customers, contacts, locations, style_photos, settings |
| `003_styles.sql` | `styles` table (Style Master keyed by `Style #|Color`) |

## After running 001

1. Create your first tenant row manually (or via the import script):
   ```sql
   insert into tenants (name) values ('Elevator Disco') returning id;
   ```
2. Sign up / invite yourself via Supabase Auth → the trigger auto-creates a `profiles` row.
3. Link your user to the tenant:
   ```sql
   insert into tenant_memberships (tenant_id, user_id, role)
   values ('<tenant-id-from-step-1>', '<your-auth-user-id>', 'admin');
   ```
4. Run `scripts/import-pos.js` to load existing PO data.
