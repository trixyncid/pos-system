# Permissions

Ported from yanksandbrits, with two changes. Checks are by permission only, never by role code. Every staff member has their own account (username and password).

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
- Nobody can edit someone whose roles go beyond their own.
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
| `cashier` | Kasir | Runs the day, so also the manager: everything except `manage_staff` and `manage_settings` |
| `waiter` | Pelayan | take_order |

Migration `accounts.0005_three_roles` moves members of the retired Manager, Print Station and Gudang roles into Kasir and deletes those roles.

A Pelayan cannot void a sent item or discount a bill; the order screen hides those controls. Owner and Kasir hold `approve_override`, so they never need someone else's approval.

## Signing in

1. Each staff member signs in with their own username and password (`POST /auth/login/`). An email also works for accounts that have one.
2. There is no lock screen or idle lock: a tablet stays signed in as that person until they sign out. To hand a tablet over, sign out and the next person signs in.
3. Every action is recorded against whoever is signed in.

Approval PINs (`set-pin`, `approver_pin`) remain in the API for custom roles that need someone to approve, but the app no longer sets or asks for them.
