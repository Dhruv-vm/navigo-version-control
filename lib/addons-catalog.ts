import fs from "fs"
import path from "path"

export interface AddonItem {
  id: string
  name: string
  category: string
  price: number
  active: boolean
  salesCount: number
  totalRevenue: number
  icon: string
  description?: string
}

const DEFAULT_CATALOG: AddonItem[] = [
  {
    id: "addon-bag-15",
    name: "Extra Baggage (+15kg Check-in)",
    category: "Baggage",
    price: 1850,
    active: true,
    salesCount: 420,
    totalRevenue: 777000,
    icon: "🧳",
    description: "Additional 15kg checked luggage allowance",
  },
  {
    id: "addon-meal-exec",
    name: "Gourmet Chef's Meal & Beverage",
    category: "Catering",
    price: 650,
    active: true,
    salesCount: 890,
    totalRevenue: 578500,
    icon: "🍽️",
    description: "Curated hot meal & artisanal refreshment",
  },
  {
    id: "addon-lounge-del",
    name: "Navigo Executive Lounge Access (T3)",
    category: "Hospitality",
    price: 1450,
    active: true,
    salesCount: 310,
    totalRevenue: 449500,
    icon: "🍸",
    description: "Complimentary gourmet buffet, high-speed Wi-Fi, and quiet pods",
  },
  {
    id: "addon-priority-board",
    name: "Priority Boarding & Express Security",
    category: "Airport Services",
    price: 499,
    active: true,
    salesCount: 650,
    totalRevenue: 324350,
    icon: "⚡",
    description: "Fast-track security lane and priority boarding gate queue",
  },
  {
    id: "addon-wifi-high",
    name: "High-Speed Satellite In-Flight Wi-Fi",
    category: "Connectivity",
    price: 799,
    active: true,
    salesCount: 280,
    totalRevenue: 223720,
    icon: "📡",
    description: "Stream, browse, and message at 35,000 feet",
  },
  {
    id: "addon-insurance",
    name: "Comprehensive Travel & Delay Insurance",
    category: "Protection",
    price: 399,
    active: true,
    salesCount: 940,
    totalRevenue: 375060,
    icon: "🛡️",
    description: "Coverage for delays, lost luggage, and medical emergencies",
  },
]

const DATA_DIR = path.join(process.cwd(), "data")
const CATALOG_FILE = path.join(DATA_DIR, "addons-catalog.json")

function loadPersistedCatalog(): AddonItem[] {
  try {
    if (fs.existsSync(CATALOG_FILE)) {
      const content = fs.readFileSync(CATALOG_FILE, "utf-8")
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.error("Failed to read addons catalog from disk:", err)
  }
  return DEFAULT_CATALOG
}

function saveCatalogToDisk(catalog: AddonItem[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2), "utf-8")
  } catch (err) {
    console.error("Failed to persist addons catalog to disk:", err)
  }
}

let inMemoryCatalog: AddonItem[] | null = null

export function getAddonsCatalog(): AddonItem[] {
  if (!inMemoryCatalog) {
    inMemoryCatalog = loadPersistedCatalog()
  }
  return inMemoryCatalog
}

export function updateAddonPrice(id: string, price: number): AddonItem[] {
  const current = getAddonsCatalog()
  const updated = current.map((a) => (a.id === id ? { ...a, price } : a))
  inMemoryCatalog = updated
  saveCatalogToDisk(updated)
  return updated
}

export function toggleAddonActive(id: string): AddonItem[] {
  const current = getAddonsCatalog()
  const updated = current.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
  inMemoryCatalog = updated
  saveCatalogToDisk(updated)
  return updated
}
