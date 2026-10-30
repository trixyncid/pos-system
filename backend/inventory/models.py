"""
Planned models (next phase, see docs/architecture.md):

StockMovement ledger (sale, receive, adjust, waste, opname) as the source of truth; stock on hand
cached on Product and updated under select_for_update.
"""
