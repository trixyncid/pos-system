"""
The roles every outlet starts with. Owners can change their permissions or
add roles of their own; these codes stay fixed so seeding is repeatable.
"""

OWNER = "owner"
MANAGER = "manager"
CASHIER = "cashier"
WAITER = "waiter"
PRINT_STATION = "print-station"
INVENTORY = "inventory"

# code -> (display name, POS action codenames on accounts.posaccess)
SYSTEM_ROLES: dict[str, tuple[str, tuple[str, ...]]] = {
    OWNER: ("Owner", ("*",)),
    MANAGER: (
        "Manager",
        (
            "take_order",
            "void_sent_item",
            "apply_discount",
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
        ),
    ),
    CASHIER: ("Kasir", ("take_order", "take_payment", "reprint", "open_shift", "close_shift")),
    WAITER: ("Pelayan", ("take_order",)),
    PRINT_STATION: ("Print Station", ("print_station", "reprint")),
    INVENTORY: ("Gudang", ("manage_stock",)),
}
