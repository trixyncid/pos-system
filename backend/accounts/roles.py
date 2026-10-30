"""
The roles every outlet starts with: Owner, Kasir (cashier, who also runs
the floor like a manager would: voids, discounts, stock, shifts, reports)
and Pelayan (waiter, takes orders only). Owners can still change a role's
permissions or add roles of their own; these codes stay fixed so seeding is
repeatable.
"""

OWNER = "owner"
CASHIER = "cashier"
WAITER = "waiter"

#: Codes of roles earlier versions seeded; their staff move to Kasir (migration 0005).
RETIRED_ROLES = ("manager", "print-station", "inventory")

KASIR_ACTIONS = (
    "take_order",
    "void_sent_item",
    "apply_discount",
    "manage_promos",
    "approve_override",
    "reprint",
    "take_payment",
    "open_drawer",
    "open_shift",
    "close_shift",
    "edit_floor",
    "manage_stock",
    "view_dashboard",
    "view_reports",
    "view_audit",
    "print_station",
)

# code -> (display name, POS action codenames on accounts.posaccess)
SYSTEM_ROLES: dict[str, tuple[str, tuple[str, ...]]] = {
    OWNER: ("Owner", ("*",)),
    CASHIER: ("Kasir", KASIR_ACTIONS),
    WAITER: ("Pelayan", ("take_order",)),
}
