"""
The demo outlet the frontend's mock API serves (frontend/src/mocks/db), as
rows in the real database: `python manage.py seed_demo`. Keep the two in
step when either changes.
"""

OUTLET = {
    "name": "Yi Ci Pang",
    "address": "Jl. Ade Irma Suryani No. 68, Samarinda",
    "npwpd": "",
    "pbjt_percent": 10,
    "service_percent": 5,
    "tax_base": "subtotal_with_service",
    "cash_rounding": 100,
    "receipt_header": "WA 0851-0017-9868 · IG @yicipang68_vegetarian",
    "receipt_footer": "Terima kasih! 100% vegetarian.\nBuka Senin–Sabtu 07.00–17.00",
}

PASSWORD = "demo1234"

# username, full name, email, role code, active
STAFF = [
    ("rina", "Rina Wijaya", "owner@yicipang.test", "owner", True),
    ("dimas", "Dimas Pratama", "dimas@yicipang.test", "cashier", True),
    ("budi", "Budi Santoso", None, "cashier", True),
    ("sari", "Sari Lestari", None, "waiter", True),
    ("agus", "Agus Setiawan", None, "waiter", True),
    ("wati", "Wati Rahayu", None, "cashier", True),
    ("joko", "Joko Susilo", None, "waiter", False),
]

# key, name, unit, cost per unit
INGREDIENTS = [
    ("beras", "Beras", "g", 15),
    ("telur", "Telur", "pcs", 2_500),
    ("ayam", "Ayam", "g", 45),
    ("sapi", "Daging sapi", "g", 140),
    ("mie", "Mie", "g", 20),
    ("minyak", "Minyak goreng", "ml", 18),
    ("bawang", "Bawang merah", "g", 40),
    ("cabai", "Cabai", "g", 60),
    ("kecap", "Kecap manis", "ml", 25),
    ("santan", "Santan", "ml", 22),
    ("gula", "Gula", "g", 16),
    ("teh", "Teh", "g", 120),
    ("kopi", "Kopi bubuk", "g", 250),
    ("susu", "Susu", "ml", 20),
    ("es", "Es batu", "g", 1),
    ("jeruk", "Jeruk peras", "pcs", 2_000),
    ("kelapa", "Kelapa muda", "pcs", 9_000),
    ("alpukat", "Alpukat", "pcs", 8_000),
    ("tempe", "Tempe", "g", 15),
    ("tahu", "Tahu", "pcs", 1_000),
    ("pisang", "Pisang", "pcs", 1_500),
    ("ikan", "Ikan", "g", 80),
    ("udang", "Udang", "g", 150),
]

# key, name, min, max, [(option, price change)]
MODIFIER_GROUPS = [
    ("spicy", "Level pedas", 1, 1, [("Tidak pedas", 0), ("Sedang", 0), ("Pedas", 0), ("Extra pedas", 2_000)]),
    (
        "extras",
        "Tambahan",
        0,
        3,
        [("Telur ceplok", 5_000), ("Kerupuk", 3_000), ("Keju", 6_000), ("Nasi tambah", 6_000)],
    ),
    ("sugar", "Gula", 0, 1, [("Normal", 0), ("Kurang manis", 0), ("Tanpa gula", 0)]),
    ("ice", "Es", 0, 1, [("Normal", 0), ("Sedikit es", 0), ("Tanpa es", 0)]),
]

# Category name, station, items. Each item: photo key, name, price, and
# optionally description, groups, recipe [(ingredient key, quantity)],
# favorite, sold_out.
MENU = [
    (
        "Nasi & Lauk",
        "kitchen",
        [
            {
                "key": "nasi-goreng",
                "name": "Nasi Goreng Spesial",
                "price": 28_000,
                "description": "Nasi goreng kecap, telur, ayam suwir dan kerupuk.",
                "groups": ["spicy", "extras"],
                "recipe": [
                    ("beras", 200),
                    ("telur", 1),
                    ("ayam", 50),
                    ("minyak", 15),
                    ("kecap", 10),
                    ("bawang", 10),
                    ("cabai", 5),
                ],
                "favorite": True,
            },
            {
                "key": "ayam-geprek",
                "name": "Ayam Geprek",
                "price": 25_000,
                "groups": ["spicy", "extras"],
                "recipe": [("ayam", 180), ("beras", 200), ("cabai", 20), ("minyak", 30)],
                "favorite": True,
            },
            {"key": "nasi-uduk", "name": "Nasi Uduk Komplit", "price": 22_000, "groups": ["extras"]},
            {"key": "nasi-campur", "name": "Nasi Campur Bali", "price": 30_000},
            {"key": "nasi-padang", "name": "Nasi Padang", "price": 35_000},
            {"key": "nasi-kuning", "name": "Nasi Kuning", "price": 25_000},
            {"key": "ayam-bakar", "name": "Ayam Bakar Madu", "price": 32_000, "groups": ["spicy"]},
            {
                "key": "rendang",
                "name": "Rendang Sapi",
                "price": 38_000,
                "recipe": [("sapi", 150), ("santan", 100), ("cabai", 15), ("bawang", 15)],
            },
            {"key": "ikan-bakar", "name": "Ikan Bakar Jimbaran", "price": 45_000, "groups": ["spicy"]},
            {"key": "gulai", "name": "Gulai Sayur", "price": 24_000},
            {"key": "rawon", "name": "Rawon Daging", "price": 32_000, "sold_out": True},
        ],
    ),
    (
        "Mie & Sup",
        "kitchen",
        [
            {
                "key": "mie-goreng",
                "name": "Mie Goreng Jawa",
                "price": 26_000,
                "groups": ["spicy", "extras"],
                "recipe": [("mie", 150), ("telur", 1), ("kecap", 15), ("minyak", 15)],
            },
            {"key": "mie-ayam", "name": "Mie Ayam", "price": 22_000, "groups": ["spicy"]},
            {"key": "bakso", "name": "Bakso Urat", "price": 22_000},
            {"key": "soto-ayam", "name": "Soto Ayam Lamongan", "price": 24_000},
            {"key": "sop-buntut", "name": "Sop Buntut", "price": 55_000, "sold_out": True},
            {"key": "capcay", "name": "Capcay Seafood", "price": 28_000},
        ],
    ),
    (
        "Sate & Seafood",
        "kitchen",
        [
            {"key": "sate-ayam", "name": "Sate Ayam (10 tusuk)", "price": 30_000, "groups": ["spicy"]},
            {"key": "udang-bakar", "name": "Udang Bakar", "price": 58_000},
            {"key": "cumi-goreng-tepung", "name": "Cumi Goreng Tepung", "price": 42_000},
            {"key": "pempek", "name": "Pempek Kapal Selam", "price": 28_000},
        ],
    ),
    (
        "Camilan",
        "kitchen",
        [
            {"key": "gado-gado", "name": "Gado-gado", "price": 22_000, "groups": ["spicy"]},
            {
                "key": "tempe-goreng",
                "name": "Tempe Mendoan",
                "price": 12_000,
                "recipe": [("tempe", 120), ("minyak", 20)],
            },
            {"key": "tahu-goreng", "name": "Tahu Goreng", "price": 12_000},
            {"key": "pisang-goreng", "name": "Pisang Goreng", "price": 15_000},
            {"key": "lumpia", "name": "Lumpia Semarang", "price": 18_000},
            {"key": "martabak", "name": "Martabak Manis", "price": 35_000},
            {"key": "klepon", "name": "Klepon", "price": 15_000},
        ],
    ),
    (
        "Minuman Dingin",
        "bar",
        [
            {
                "key": "es-teh-manis",
                "name": "Es Teh Manis",
                "price": 8_000,
                "groups": ["sugar", "ice"],
                "recipe": [("teh", 5), ("gula", 20), ("es", 150)],
                "favorite": True,
            },
            {
                "key": "kopi-susu",
                "name": "Es Kopi Susu",
                "price": 22_000,
                "groups": ["sugar", "ice"],
                "recipe": [("kopi", 18), ("susu", 120), ("gula", 15), ("es", 150)],
                "favorite": True,
            },
            {
                "key": "es-jeruk",
                "name": "Es Jeruk",
                "price": 12_000,
                "groups": ["sugar", "ice"],
                "recipe": [("jeruk", 2), ("gula", 15), ("es", 150)],
            },
            {"key": "lemon-tea", "name": "Lemon Tea", "price": 15_000, "groups": ["sugar", "ice"]},
            {
                "key": "es-kelapa-muda",
                "name": "Es Kelapa Muda",
                "price": 18_000,
                "recipe": [("kelapa", 1), ("es", 100)],
            },
            {
                "key": "jus-alpukat",
                "name": "Jus Alpukat",
                "price": 22_000,
                "recipe": [("alpukat", 1), ("susu", 50), ("gula", 20)],
            },
            {"key": "es-cendol", "name": "Es Cendol", "price": 18_000},
            {"key": "es-campur", "name": "Es Campur", "price": 22_000},
            {"key": "air-mineral", "name": "Air Mineral", "price": 6_000},
        ],
    ),
    (
        "Minuman Panas",
        "bar",
        [
            {"key": "teh-tarik", "name": "Teh Tarik", "price": 15_000, "groups": ["sugar"]},
            {"key": "wedang-jahe", "name": "Wedang Jahe", "price": 15_000},
            {"key": "kopi-hitam", "name": "Kopi Tubruk", "price": 12_000, "groups": ["sugar"]},
        ],
    ),
]

SNACK_CATEGORY = "Snack Bar"
# photo key, name, price, cost. Barcodes: Indonesian GS1 prefix 899, check digits not real.
SNACKS = [
    ("potato-chips", "Keripik Kentang 68g", 12_000, 8_500),
    ("chocolate-bar", "Cokelat Batang 50g", 15_000, 10_500),
    ("cookies", "Cookies Choco Chip", 14_000, 9_800),
    ("candy", "Permen Buah", 5_000, 3_000),
    ("bottled-water", "Air Mineral 600ml", 5_000, 3_200),
    ("soda-can", "Soda Kaleng 330ml", 10_000, 7_000),
    ("instant-noodles-cup", "Mi Instan Cup", 8_000, 5_500),
    ("crackers", "Crackers Gandum", 9_000, 6_200),
    ("peanuts", "Kacang Kulit 100g", 10_000, 7_000),
    ("chewing-gum", "Permen Karet", 3_000, 1_800),
    ("energy-drink", "Minuman Energi 250ml", 12_000, 8_500),
    ("juice-box", "Jus Kotak 200ml", 7_000, 4_800),
    ("wafer", "Wafer Cokelat", 6_000, 4_000),
    ("biscuits", "Biskuit Marie", 8_000, 5_400),
    ("popcorn", "Popcorn Karamel", 15_000, 9_000),
    ("gummy-bears", "Permen Jeli", 10_000, 6_500),
    ("milk-bottle", "Susu Segar 250ml", 9_000, 6_200),
    ("yogurt-drink", "Yogurt Minum", 11_000, 7_800),
    ("pretzels", "Pretzel", 13_000, 9_000),
    ("granola-bar", "Granola Bar", 12_000, 8_000),
    ("canned-coffee", "Kopi Kaleng", 9_000, 6_000),
    ("bottled-tea", "Teh Botol 350ml", 7_000, 4_500),
    ("rice-crackers", "Kerupuk Beras", 8_000, 5_000),
    ("dried-fruit", "Buah Kering", 18_000, 12_500),
    ("mixed-nuts", "Kacang Campur", 20_000, 14_000),
    ("lollipop", "Lolipop", 4_000, 2_200),
    ("mints", "Permen Mint", 6_000, 3_800),
    ("coconut-water", "Air Kelapa Kemasan", 12_000, 8_200),
    ("tortilla-chips", "Tortilla Chips", 16_000, 11_000),
    ("chocolate-cookies", "Cookies Cokelat", 14_000, 9_500),
    ("cereal-bar", "Sereal Bar", 9_000, 6_000),
    ("jelly-drink", "Minuman Jeli", 6_000, 3_900),
    ("sparkling-water", "Air Soda 330ml", 13_000, 9_000),
    ("ice-cream-cone", "Es Krim Cone", 12_000, 7_500),
    ("donut", "Donat Gula", 8_000, 4_500),
    ("croissant", "Croissant", 18_000, 11_000),
    ("sandwich", "Sandwich Ayam", 25_000, 15_000),
    ("banana-chips", "Keripik Pisang", 12_000, 7_800),
    ("cassava-chips", "Keripik Singkong Pedas", 12_000, 7_500),
]

# Area, [(label, shape, x, y, width, height, seats, rotation)]. x and y are the centre on the 1000×700 canvas.
FLOOR = [
    (
        "Indoor",
        [
            ("1", "round", 130, 110, 90, 90, 2, 0),
            ("2", "round", 300, 110, 90, 90, 2, 0),
            ("3", "round", 470, 110, 90, 90, 2, 0),
            ("4", "round", 640, 110, 90, 90, 2, 0),
            ("5", "rect", 160, 300, 130, 90, 4, 0),
            ("6", "rect", 380, 300, 130, 90, 4, 0),
            ("7", "rect", 600, 300, 130, 90, 4, 0),
            ("8", "rect", 850, 230, 120, 230, 8, 0),
            ("9", "rect", 200, 540, 170, 110, 6, 0),
            ("10", "rect", 470, 540, 170, 110, 6, 0),
            ("11", "rect", 780, 560, 90, 90, 2, 45),
        ],
    ),
    (
        "Teras",
        [
            ("12", "round", 200, 170, 110, 110, 4, 0),
            ("13", "round", 500, 170, 110, 110, 4, 0),
            ("14", "round", 800, 170, 110, 110, 4, 0),
            ("15", "round", 200, 470, 110, 110, 4, 0),
            ("16", "round", 500, 470, 110, 110, 4, 0),
            ("17", "rect", 800, 470, 150, 100, 6, 0),
        ],
    ),
]

PROMOS = [
    {
        "name": "Happy hour minuman",
        "description": "Semua minuman dingin 20% lebih murah, Senin–Kamis sore.",
        "kind": "items",
        "value": 20,
        "categories": ["Minuman Dingin"],
        "weekdays": [0, 1, 2, 3],
        "starts_at": "14:00",
        "ends_at": "17:00",
        "channel": "restaurant",
    },
    {
        "name": "Beli 2 gratis 1 Es Teh",
        "kind": "bundle",
        "value": 100,
        "buy_quantity": 2,
        "get_quantity": 1,
        "products": ["Es Teh Manis"],
    },
    {
        "name": "Hemat 10% belanja Rp 150 rb",
        "description": "Maksimal potongan Rp 30.000.",
        "kind": "bill",
        "value": 10,
        "min_spend": 150_000,
        "max_discount": 30_000,
    },
    {
        "name": "Promo akhir pekan",
        "kind": "bill",
        "benefit": "amount",
        "value": 25_000,
        "min_spend": 200_000,
        "weekdays": [5, 6],
    },
]

# Tables in service right now: label, minutes since seated, guests, waiter username, status,
# lines [(product, quantity, modifiers, held)].
OPEN_TABLES = [
    (
        "2",
        34,
        2,
        "sari",
        "open",
        [("Nasi Goreng Spesial", 1, ["Pedas", "Telur ceplok"], False), ("Es Teh Manis", 2, ["Kurang manis"], False)],
    ),
    (
        "5",
        61,
        4,
        "agus",
        "open",
        [
            ("Ayam Geprek", 2, ["Extra pedas"], False),
            ("Sate Ayam (10 tusuk)", 1, ["Sedang"], False),
            ("Es Kopi Susu", 3, [], False),
            ("Pisang Goreng", 1, [], True),
        ],
    ),
    ("6", 4, 3, "sari", "open", []),
    (
        "8",
        78,
        7,
        "agus",
        "billed",
        [
            ("Rendang Sapi", 3, [], False),
            ("Ikan Bakar Jimbaran", 2, ["Sedang"], False),
            ("Gado-gado", 2, ["Tidak pedas"], False),
            ("Es Jeruk", 7, [], False),
        ],
    ),
    (
        "12",
        18,
        4,
        "sari",
        "open",
        [("Mie Goreng Jawa", 2, ["Sedang"], False), ("Bakso Urat", 2, [], False), ("Es Teh Manis", 4, [], False)],
    ),
    ("15", 9, 2, "agus", "open", [("Lemon Tea", 2, [], True)]),
]

# Open Monday to Saturday, 07:00–17:00 (Instagram @yicipang68_vegetarian).
OPENS, CLOSES = 7, 17
# Restaurant orders per hour from opening: a breakfast and a lunch rush.
RESTAURANT_CURVE = [3, 5, 4, 3, 6, 8, 5, 3, 2, 1]
