"""
Planned models (next phase, see docs/architecture.md):

Order (UUID from the tablet, channel restaurant/snackbar, type, table, guests, status, version,
idempotency_key unique per outlet), OrderLine (name and price snapshot, modifiers JSON, seat,
course, held/sent/void, fired_at), KitchenTicket.
"""
