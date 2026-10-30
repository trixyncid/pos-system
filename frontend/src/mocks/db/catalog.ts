import type {
  Category,
  ModifierGroup,
  Product,
  RecipeLine,
  Station,
  Unit,
} from "@/features/catalog/schemas/catalog.ts"
import { photoFor } from "@/mocks/db/photos.ts"

let counter = 0
/** A stable, valid UUID v7-shaped id for seeded rows. */
export function mockId() {
  counter += 1
  return `0192f3a0-0000-7000-8000-${counter.toString(16).padStart(12, "0")}`
}

type Row<T> = Omit<T, "product_count">

export const categories: Row<Category>[] = []
export const modifierGroups: Row<ModifierGroup>[] = []
export const products: Product[] = []

function category(name: string, station: Station) {
  const row = {
    id: mockId(),
    name,
    station,
    sort_order: categories.length,
    is_active: true,
  }
  categories.push(row)
  return row.id
}

function group(
  name: string,
  min: number,
  max: number,
  options: [string, number][]
) {
  const row = {
    id: mockId(),
    name,
    min_select: min,
    max_select: max,
    sort_order: modifierGroups.length,
    options: options.map(([optionName, delta], index) => ({
      id: mockId(),
      name: optionName,
      price_delta: delta,
      sort_order: index,
    })),
  }
  modifierGroups.push(row)
  return row.id
}

function base(kind: Product["kind"], name: string): Product {
  return {
    id: mockId(),
    kind,
    name,
    description: "",
    category: null,
    category_name: null,
    price: 0,
    cost: 0,
    unit: kind === "menu" ? "portion" : "pcs",
    barcode: null,
    sku: "",
    tax_category: kind === "menu" ? "pbjt" : kind === "retail" ? "ppn" : "none",
    track_stock: kind !== "menu",
    low_stock_threshold: null,
    image_url: null,
    is_available: true,
    is_favorite: false,
    is_active: true,
    sort_order: products.length,
    modifier_groups: [],
    recipe: [],
    recipe_cost: null,
  }
}

// --- Ingredients -----------------------------------------------------------

const ingredientIds: Record<string, string> = {}
const ingredients: [string, string, Unit, number][] = [
  ["beras", "Beras", "g", 15],
  ["telur", "Telur", "pcs", 2_500],
  ["ayam", "Ayam", "g", 45],
  ["sapi", "Daging sapi", "g", 140],
  ["mie", "Mie", "g", 20],
  ["minyak", "Minyak goreng", "ml", 18],
  ["bawang", "Bawang merah", "g", 40],
  ["cabai", "Cabai", "g", 60],
  ["kecap", "Kecap manis", "ml", 25],
  ["santan", "Santan", "ml", 22],
  ["gula", "Gula", "g", 16],
  ["teh", "Teh", "g", 120],
  ["kopi", "Kopi bubuk", "g", 250],
  ["susu", "Susu", "ml", 20],
  ["es", "Es batu", "g", 1],
  ["jeruk", "Jeruk peras", "pcs", 2_000],
  ["kelapa", "Kelapa muda", "pcs", 9_000],
  ["alpukat", "Alpukat", "pcs", 8_000],
  ["tempe", "Tempe", "g", 15],
  ["tahu", "Tahu", "pcs", 1_000],
  ["pisang", "Pisang", "pcs", 1_500],
  ["ikan", "Ikan", "g", 80],
  ["udang", "Udang", "g", 150],
]
for (const [key, name, unit, cost] of ingredients) {
  const row = {
    ...base("ingredient", name),
    unit,
    cost,
    low_stock_threshold: unit === "pcs" ? 10 : 1_000,
  }
  ingredientIds[key] = row.id
  products.push(row)
}

function recipe(lines: [string, number][]): RecipeLine[] {
  return lines.map(([key, quantity]) => {
    const ingredient = products.find((p) => p.id === ingredientIds[key])!
    return {
      ingredient: ingredient.id,
      ingredient_name: ingredient.name,
      unit: ingredient.unit,
      quantity,
      cost: Math.round(ingredient.cost * quantity),
    }
  })
}

// --- Modifier groups --------------------------------------------------------

const spicy = group("Level pedas", 1, 1, [
  ["Tidak pedas", 0],
  ["Sedang", 0],
  ["Pedas", 0],
  ["Extra pedas", 2_000],
])
const extras = group("Tambahan", 0, 3, [
  ["Telur ceplok", 5_000],
  ["Kerupuk", 3_000],
  ["Keju", 6_000],
  ["Nasi tambah", 6_000],
])
const sugar = group("Gula", 0, 1, [
  ["Normal", 0],
  ["Kurang manis", 0],
  ["Tanpa gula", 0],
])
const ice = group("Es", 0, 1, [
  ["Normal", 0],
  ["Sedikit es", 0],
  ["Tanpa es", 0],
])

// --- Menu ---------------------------------------------------------------------

type MenuSeed = {
  key: string
  name: string
  price: number
  description?: string
  groups?: string[]
  recipe?: [string, number][]
  favorite?: boolean
  soldOut?: boolean
}

function menu(categoryId: string, items: MenuSeed[]) {
  const categoryName = categories.find((c) => c.id === categoryId)!.name
  for (const item of items) {
    const lines = item.recipe ? recipe(item.recipe) : []
    products.push({
      ...base("menu", item.name),
      description: item.description ?? "",
      category: categoryId,
      category_name: categoryName,
      price: item.price,
      cost: 0,
      image_url: photoFor(item.key)?.src ?? null,
      modifier_groups: item.groups ?? [],
      recipe: lines,
      recipe_cost: lines.length
        ? lines.reduce((sum, line) => sum + line.cost, 0)
        : null,
      is_favorite: item.favorite ?? false,
      is_available: !item.soldOut,
    })
  }
}

menu(category("Nasi & Lauk", "kitchen"), [
  {
    key: "nasi-goreng",
    name: "Nasi Goreng Spesial",
    price: 28_000,
    description: "Nasi goreng kecap, telur, ayam suwir dan kerupuk.",
    groups: [spicy, extras],
    recipe: [
      ["beras", 200],
      ["telur", 1],
      ["ayam", 50],
      ["minyak", 15],
      ["kecap", 10],
      ["bawang", 10],
      ["cabai", 5],
    ],
    favorite: true,
  },
  {
    key: "ayam-geprek",
    name: "Ayam Geprek",
    price: 25_000,
    groups: [spicy, extras],
    recipe: [
      ["ayam", 180],
      ["beras", 200],
      ["cabai", 20],
      ["minyak", 30],
    ],
    favorite: true,
  },
  {
    key: "nasi-uduk",
    name: "Nasi Uduk Komplit",
    price: 22_000,
    groups: [extras],
  },
  { key: "nasi-campur", name: "Nasi Campur Bali", price: 30_000 },
  { key: "nasi-padang", name: "Nasi Padang", price: 35_000 },
  { key: "nasi-kuning", name: "Nasi Kuning", price: 25_000 },
  {
    key: "ayam-bakar",
    name: "Ayam Bakar Madu",
    price: 32_000,
    groups: [spicy],
  },
  {
    key: "rendang",
    name: "Rendang Sapi",
    price: 38_000,
    recipe: [
      ["sapi", 150],
      ["santan", 100],
      ["cabai", 15],
      ["bawang", 15],
    ],
  },
  {
    key: "ikan-bakar",
    name: "Ikan Bakar Jimbaran",
    price: 45_000,
    groups: [spicy],
  },
  { key: "gulai", name: "Gulai Sayur", price: 24_000 },
  { key: "rawon", name: "Rawon Daging", price: 32_000, soldOut: true },
])
menu(category("Mie & Sup", "kitchen"), [
  {
    key: "mie-goreng",
    name: "Mie Goreng Jawa",
    price: 26_000,
    groups: [spicy, extras],
    recipe: [
      ["mie", 150],
      ["telur", 1],
      ["kecap", 15],
      ["minyak", 15],
    ],
  },
  { key: "mie-ayam", name: "Mie Ayam", price: 22_000, groups: [spicy] },
  { key: "bakso", name: "Bakso Urat", price: 22_000 },
  { key: "soto-ayam", name: "Soto Ayam Lamongan", price: 24_000 },
  { key: "sop-buntut", name: "Sop Buntut", price: 55_000, soldOut: true },
  { key: "capcay", name: "Capcay Seafood", price: 28_000 },
])
menu(category("Sate & Seafood", "kitchen"), [
  {
    key: "sate-ayam",
    name: "Sate Ayam (10 tusuk)",
    price: 30_000,
    groups: [spicy],
  },
  { key: "udang-bakar", name: "Udang Bakar", price: 58_000 },
  { key: "cumi-goreng-tepung", name: "Cumi Goreng Tepung", price: 42_000 },
  { key: "pempek", name: "Pempek Kapal Selam", price: 28_000 },
])
menu(category("Camilan", "kitchen"), [
  { key: "gado-gado", name: "Gado-gado", price: 22_000, groups: [spicy] },
  {
    key: "tempe-goreng",
    name: "Tempe Mendoan",
    price: 12_000,
    recipe: [
      ["tempe", 120],
      ["minyak", 20],
    ],
  },
  { key: "tahu-goreng", name: "Tahu Goreng", price: 12_000 },
  { key: "pisang-goreng", name: "Pisang Goreng", price: 15_000 },
  { key: "lumpia", name: "Lumpia Semarang", price: 18_000 },
  { key: "martabak", name: "Martabak Manis", price: 35_000 },
  { key: "klepon", name: "Klepon", price: 15_000 },
])
menu(category("Minuman Dingin", "bar"), [
  {
    key: "es-teh-manis",
    name: "Es Teh Manis",
    price: 8_000,
    groups: [sugar, ice],
    recipe: [
      ["teh", 5],
      ["gula", 20],
      ["es", 150],
    ],
    favorite: true,
  },
  {
    key: "kopi-susu",
    name: "Es Kopi Susu",
    price: 22_000,
    groups: [sugar, ice],
    recipe: [
      ["kopi", 18],
      ["susu", 120],
      ["gula", 15],
      ["es", 150],
    ],
    favorite: true,
  },
  {
    key: "es-jeruk",
    name: "Es Jeruk",
    price: 12_000,
    groups: [sugar, ice],
    recipe: [
      ["jeruk", 2],
      ["gula", 15],
      ["es", 150],
    ],
  },
  { key: "lemon-tea", name: "Lemon Tea", price: 15_000, groups: [sugar, ice] },
  {
    key: "es-kelapa-muda",
    name: "Es Kelapa Muda",
    price: 18_000,
    recipe: [
      ["kelapa", 1],
      ["es", 100],
    ],
  },
  {
    key: "jus-alpukat",
    name: "Jus Alpukat",
    price: 22_000,
    recipe: [
      ["alpukat", 1],
      ["susu", 50],
      ["gula", 20],
    ],
  },
  { key: "es-cendol", name: "Es Cendol", price: 18_000 },
  { key: "es-campur", name: "Es Campur", price: 22_000 },
  { key: "air-mineral", name: "Air Mineral", price: 6_000 },
])
menu(category("Minuman Panas", "bar"), [
  { key: "teh-tarik", name: "Teh Tarik", price: 15_000, groups: [sugar] },
  { key: "wedang-jahe", name: "Wedang Jahe", price: 15_000 },
  { key: "kopi-hitam", name: "Kopi Tubruk", price: 12_000, groups: [sugar] },
])

// --- Snack bar --------------------------------------------------------------------

const snackCategory = category("Snack Bar", "none")
const snacks: [string, string, number, number][] = [
  ["potato-chips", "Keripik Kentang 68g", 12_000, 8_500],
  ["chocolate-bar", "Cokelat Batang 50g", 15_000, 10_500],
  ["cookies", "Cookies Choco Chip", 14_000, 9_800],
  ["candy", "Permen Buah", 5_000, 3_000],
  ["bottled-water", "Air Mineral 600ml", 5_000, 3_200],
  ["soda-can", "Soda Kaleng 330ml", 10_000, 7_000],
  ["instant-noodles-cup", "Mi Instan Cup", 8_000, 5_500],
  ["crackers", "Crackers Gandum", 9_000, 6_200],
  ["peanuts", "Kacang Kulit 100g", 10_000, 7_000],
  ["chewing-gum", "Permen Karet", 3_000, 1_800],
  ["energy-drink", "Minuman Energi 250ml", 12_000, 8_500],
  ["juice-box", "Jus Kotak 200ml", 7_000, 4_800],
  ["wafer", "Wafer Cokelat", 6_000, 4_000],
  ["biscuits", "Biskuit Marie", 8_000, 5_400],
  ["popcorn", "Popcorn Karamel", 15_000, 9_000],
  ["gummy-bears", "Permen Jeli", 10_000, 6_500],
  ["milk-bottle", "Susu Segar 250ml", 9_000, 6_200],
  ["yogurt-drink", "Yogurt Minum", 11_000, 7_800],
  ["pretzels", "Pretzel", 13_000, 9_000],
  ["granola-bar", "Granola Bar", 12_000, 8_000],
  ["canned-coffee", "Kopi Kaleng", 9_000, 6_000],
  ["bottled-tea", "Teh Botol 350ml", 7_000, 4_500],
  ["rice-crackers", "Kerupuk Beras", 8_000, 5_000],
  ["dried-fruit", "Buah Kering", 18_000, 12_500],
  ["mixed-nuts", "Kacang Campur", 20_000, 14_000],
  ["lollipop", "Lolipop", 4_000, 2_200],
  ["mints", "Permen Mint", 6_000, 3_800],
  ["coconut-water", "Air Kelapa Kemasan", 12_000, 8_200],
  ["tortilla-chips", "Tortilla Chips", 16_000, 11_000],
  ["chocolate-cookies", "Cookies Cokelat", 14_000, 9_500],
  ["cereal-bar", "Sereal Bar", 9_000, 6_000],
  ["jelly-drink", "Minuman Jeli", 6_000, 3_900],
  ["sparkling-water", "Air Soda 330ml", 13_000, 9_000],
  ["ice-cream-cone", "Es Krim Cone", 12_000, 7_500],
  ["donut", "Donat Gula", 8_000, 4_500],
  ["croissant", "Croissant", 18_000, 11_000],
  ["sandwich", "Sandwich Ayam", 25_000, 15_000],
  ["banana-chips", "Keripik Pisang", 12_000, 7_800],
  ["cassava-chips", "Keripik Singkong Pedas", 12_000, 7_500],
]
snacks.forEach(([key, name, price, cost], index) => {
  products.push({
    ...base("retail", name),
    category: snackCategory,
    category_name: "Snack Bar",
    price,
    cost,
    // Indonesian GS1 prefix 899; check digits are not real.
    barcode: `899${String(1_000_000_000 + index * 7_919).padStart(10, "0")}`,
    sku: `SB-${String(index + 1).padStart(3, "0")}`,
    image_url: photoFor(key)?.src ?? null,
    low_stock_threshold: 6,
  })
})

export function productCount(categoryId: string) {
  return products.filter((p) => p.is_active && p.category === categoryId).length
}

export function groupProductCount(groupId: string) {
  return products.filter(
    (p) => p.is_active && p.modifier_groups.includes(groupId)
  ).length
}
