# Permissions

Ported from yanksandbrits, with two changes. Checks are by permission only, never by role code. PINs are stored hashed.

- **Role** = a Django `Group` plus a `GroupProfile` (`code`, `description`, `is_system`).
- **Action** = a Django permission. POS actions live on the `accounts.PosAccess` proxy model (`backend/accounts/models.py`), so their full names are `accounts.<codename>`.
- **Catalog** = `backend/accounts/permission_catalog.py`. Only these permissions can be saved on a role or shown in the role editor. Today that is the `PosAccess` actions only. The API sends permissions as `"app_label.codename"` strings.
- **Seeding**: `python manage.py seed_roles` runs in the entrypoint on every start. It creates any missing built-in role from `backend/accounts/roles.py` and leaves the permissions of existing roles alone, so owner edits survive deploys. `seed_roles --reset` restores the defaults.
- **Backend checks**: `common.permissions.RequirePermission("accounts.void_sent_item")` and `ModelPermissions`. Listing records also needs `view_<model>`.
- **Frontend checks**: `/auth/me/` returns `permissions`. The page catalog, `<Can>` and the route guards read only that list (M1).

## Guarding against escalation

`backend/accounts/services/access.py`. A user with `manage_staff` works only within their own permissions:

- A role can only be given permissions the editor holds.
- Staff can only be given roles that do nothing beyond the editor's own permissions.
- Nobody can edit, or reset the PIN of, someone whose roles go beyond their own.
- Nobody can deactivate themselves, change their own roles, or edit their own role so they lose `manage_staff`.
- The Owner role's permissions cannot be edited: it always has the whole catalog, so the outlet can never be locked out.

## POS actions

| Codename | Meaning |
|---|---|
| `take_order` | Take orders; subscribe to the floor and order streams |
| `void_sent_item` | Void an item already sent to the kitchen |
| `apply_discount` | Apply a discount |
| `approve_override` | Approve someone else's void or discount with their own PIN |
| `reprint` | Reprint a ticket or receipt |
| `take_payment` | Take payment |
| `open_drawer` | Open the cash drawer without a sale |
| `open_shift` / `close_shift` | Shift and cash drawer |
| `edit_floor` | Edit the floor plan |
| `manage_stock` | Receive, count and write off stock |
| `view_dashboard` / `view_reports` | Owner views |
| `manage_staff` / `manage_settings` | Back office |
| `view_audit` | Audit log |
| `print_station` | Run the Android print station |

## System roles

| Code | Name | Actions |
|---|---|---|
| `owner` | Owner | All catalog permissions |
| `manager` | Manager | Everything except `manage_staff`, `manage_settings`, `print_station` |
| `cashier` | Kasir | take_order, take_payment, reprint, open_shift, close_shift |
| `waiter` | Pelayan | take_order |
| `print-station` | Print Station | print_station, reprint |
| `inventory` | Gudang | manage_stock |

## Shared tablets

1. A manager signs the tablet in with email and password.
2. Staff then unlock it with `POST /auth/pin-unlock/ { user_id, pin }`. The tablet's session is swapped for theirs, so every action is recorded against the person who did it.
3. After `PIN_MAX_ATTEMPTS` wrong PINs, that user's PIN is locked for `PIN_LOCK_MINUTES`.
