"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  AdminRole,
  ADMIN_ROLES_META,
  hasAdminPermission,
} from "@/lib/admin-auth"

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "📊", href: "/admin" },
  {
    id: "flights",
    label: "Flights",
    icon: "✈️",
    href: "/admin/flights",
    subItems: [
      { id: "flights", label: "All Flights", href: "/admin/flights" },
      { id: "instances", label: "Flight Instances", href: "/admin/flights/instances" },
    ],
  },
  { id: "seats", label: "Seats & Cabins", icon: "💺", href: "/admin/seats" },
  { id: "bookings", label: "Bookings", icon: "🎫", href: "/admin/bookings" },
  { id: "passengers", label: "Passengers", icon: "👥", href: "/admin/passengers" },
  { id: "checkin", label: "Check-In", icon: "🛫", href: "/admin/checkin" },
  { id: "smart-checkin", label: "Smart Check-In", icon: "👤", href: "/admin/smart-checkin" },
  { id: "gates", label: "Gate Operations", icon: "🚪", href: "/admin/gates" },
  { id: "revenue", label: "Revenue", icon: "💳", href: "/admin/revenue" },
  { id: "addons", label: "Add-Ons", icon: "🧳", href: "/admin/addons" },
  { id: "pricing", label: "Dynamic Pricing", icon: "📈", href: "/admin/pricing" },
  { id: "analytics", label: "Analytics", icon: "📉", href: "/admin/analytics" },
  { id: "alerts", label: "Alerts", icon: "🔔", href: "/admin/alerts" },
  { id: "settings", label: "Settings", icon: "⚙️", href: "/admin/settings" },
  { id: "audit-logs", label: "Audit Logs", icon: "📜", href: "/admin/audit-logs" },
]

// ── Thin-stroke line icons for the topbar — matches the overview page's
// icon language instead of emoji, and (unlike emoji) never changes line
// height or triggers font-fallback width shifts that push text to wrap. ──
const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

const IconMenu = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
)
const IconSearch = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
)
const IconBell = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
)
const IconChevronDown = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="m6 9 6 6 6-6" /></svg>
)
const IconArrowLeft = ({ className }: { className?: string }) => (
  <svg {...iconProps} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
)

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [currentRole, setCurrentRole] = useState<AdminRole>("SUPER_ADMIN")
  const [adminUser, setAdminUser] = useState<any>({
    id: "adm-dhruv",
    name: "Dhruv Sharma",
    role: "SUPER_ADMIN",
    badgeNumber: "NVG-SA-001",
  })
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [isSimulated, setIsSimulated] = useState(false)

  useEffect(() => {
    try {
      const savedSession = localStorage.getItem("navigo_admin_session")
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        setAdminUser(parsed)
        if (parsed.role) setCurrentRole(parsed.role)
      }
    } catch {
      // Fallback
    }

    const savedMode = localStorage.getItem("navigo_admin_telemetry_mode")
    if (savedMode === "SIMULATION") setIsSimulated(true)
  }, [])

  const handleRoleChange = (role: AdminRole) => {
    setCurrentRole(role)
    setRoleDropdownOpen(false)
    if (adminUser) {
      const updated = { ...adminUser, role }
      setAdminUser(updated)
      localStorage.setItem("navigo_admin_session", JSON.stringify(updated))
    }
  }

  const toggleSimulationMode = () => {
    const next = !isSimulated
    setIsSimulated(next)
    localStorage.setItem("navigo_admin_telemetry_mode", next ? "SIMULATION" : "REALTIME")
    window.dispatchEvent(new CustomEvent("navigo_telemetry_mode_changed", { detail: { isSimulated: next } }))
  }

  // Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date()
      setCurrentTime(
        d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }) + " · " + d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      )
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Filter Nav Items by role
  const visibleNavItems = NAV_ITEMS.filter((item) =>
    hasAdminPermission(currentRole, item.id)
  )

  const activeRoleMeta = ADMIN_ROLES_META[currentRole]

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col selection:bg-amber-400/30 selection:text-amber-200">
      {/* ── TOPBAR ─────────────────────────────────────────────────── */}
      {/* Every label below is either `whitespace-nowrap` and fully shown,
          or hidden past a breakpoint — nothing is left to shrink and wrap
          onto a second line the way it was, which is what blew out the
          fixed h-16 height and made the badge/logo overlap. */}
      <header className="sticky top-0 z-40 bg-[#070E1C]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 h-16 flex items-center justify-between gap-3 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Left: Mobile Toggle & Brand */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 lg:hidden p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white"
          >
            <IconMenu className="w-4 h-4" />
          </button>

          <Link href="/admin" className="flex items-center gap-2.5 shrink-0 group">
            <img src="/logo.png" alt="Navigo" className="w-8 h-8 object-contain shrink-0 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]" />
            <div className="leading-tight hidden sm:block whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-sm tracking-[0.12em] text-white">NAVIGO</span>
                <span className="hidden lg:inline-block text-[9px] font-mono font-bold bg-amber-400/15 text-amber-300 px-1.5 py-[1px] rounded border border-amber-400/30 tracking-wider whitespace-nowrap">
                  OPS COMMAND
                </span>
              </div>
              <span className="hidden xl:block text-[10px] text-slate-500 font-mono tracking-wide whitespace-nowrap">AIRPORT OPERATIONS SYSTEM</span>
            </div>
          </Link>

          {/* System Status & Time — only once there's real room for it */}
          <div className="hidden 2xl:flex items-center gap-4 pl-6 ml-2 border-l border-white/[0.08] text-xs font-mono shrink-0 whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span className="text-emerald-400 font-semibold">All Systems Operational</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">{currentTime}</span>
          </div>
        </div>

        {/* Right: Simulation Toggle, Search, Role Switcher, Alerts & Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Simulation vs Realtime Mode Toggle */}
          <button
            onClick={toggleSimulationMode}
            className={`shrink-0 px-2.5 lg:px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
              isSimulated
                ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.25)]"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
            }`}
            title="Toggle between 100% Realtime Supabase Database and High-Volume Simulated Telemetry"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${isSimulated ? "bg-purple-400 animate-pulse" : "bg-emerald-400"}`} />
            <span className="hidden lg:inline">
              {isSimulated ? "Simulation Mode" : "Realtime DB"}
            </span>
            <span className="lg:hidden font-bold">
              {isSimulated ? "SIM" : "REAL"}
            </span>
          </button>

          {/* Global Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.15] text-xs text-slate-400 hover:text-slate-200 transition-colors whitespace-nowrap"
          >
            <IconSearch className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden lg:inline">Search PNR, Flight, Pax…</span>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* Notifications / Alerts Bell */}
          <div className="relative shrink-0">
            <button
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="relative w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 flex items-center justify-center transition-colors"
            >
              <IconBell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-[10px] font-bold font-mono text-white flex items-center justify-center">
                3
              </span>
            </button>

            {/* Alerts Dropdown */}
            <AnimatePresence>
              {alertsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-80 bg-[#0A1424] border border-white/[0.12] rounded-2xl p-4 shadow-2xl z-50"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                    <span className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                      Live Airport Alerts (3)
                    </span>
                    <Link
                      href="/admin/alerts"
                      onClick={() => setAlertsOpen(false)}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="space-y-2 mt-3 text-xs">
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300">
                      <strong className="block text-[11px]">High Delay Risk: Flight AI 106</strong>
                      <span className="text-[10px] text-slate-400">DEL → BLR (Weather hold)</span>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
                      <strong className="block text-[11px]">Seat Inventory Low: EK 512</strong>
                      <span className="text-[10px] text-slate-400">92% Occupancy reached</span>
                    </div>
                    <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                      <strong className="block text-[11px]">DigiYatra Gate Scan Surge</strong>
                      <span className="text-[10px] text-slate-400">+48 e-gate passages in 10 mins</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Role Switcher Selector */}
          <div className="relative shrink-0">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs transition-colors whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: activeRoleMeta.color }} />
              <span className="font-bold text-white hidden lg:inline max-w-[9rem] truncate">{activeRoleMeta.label}</span>
              <IconChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
            </button>

            <AnimatePresence>
              {roleDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 8 }}
                  className="absolute right-0 mt-2 w-72 bg-[#091222] border border-white/[0.12] rounded-2xl p-2 shadow-2xl z-50"
                >
                  <div className="px-3 py-2 border-b border-white/[0.08] mb-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                      Switch Role (Demo & Access Test)
                    </span>
                  </div>
                  {(Object.keys(ADMIN_ROLES_META) as AdminRole[]).map((roleKey) => {
                    const r = ADMIN_ROLES_META[roleKey]
                    const isSelected = currentRole === roleKey
                    return (
                      <button
                        key={roleKey}
                        onClick={() => handleRoleChange(roleKey)}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? "bg-white/[0.08] text-white border border-white/[0.1]"
                            : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                        }`}
                      >
                        <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{r.label}</span>
                            <span className="text-[8.5px] font-mono px-1 rounded bg-white/[0.08]" style={{ color: r.color }}>
                              {r.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{r.description}</p>
                        </div>
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Return to passenger view */}
          <Link
            href="/dashboard"
            className="shrink-0 px-3 py-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 text-xs font-mono font-bold transition-colors hidden sm:flex items-center gap-1.5 whitespace-nowrap"
          >
            <IconArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline">Passenger App</span>
          </Link>
        </div>
      </header>

      {/* ── BODY: SIDEBAR + MAIN CONTENT ───────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop & Mobile Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#050A14] border-r border-white/[0.08] flex flex-col transition-transform duration-300 lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Active Admin Profile Card */}
          <div className="p-4 border-b border-white/[0.08] bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400/20 to-amber-400/20 border border-white/10 flex items-center justify-center text-lg text-white font-bold">
                👨‍✈️
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-white truncate">{adminUser?.name || "Dhruv Sharma"}</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] font-mono px-1.5 py-[1px] rounded font-bold uppercase tracking-wider" style={{ color: activeRoleMeta.color, background: `${activeRoleMeta.color}20` }}>
                    {activeRoleMeta.badge}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links List */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-slate-500 font-semibold">
              OPERATIONS MODULES
            </div>

            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (item.subItems && item.subItems.some((s) => pathname === s.href))
              return (
                <div key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent border-l-2 border-amber-400 text-white font-bold shadow-[inset_0_0_12px_rgba(251,191,36,0.08)]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm opacity-90">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {isActive && <span className="text-amber-400 text-[10px] font-mono">●</span>}
                  </Link>

                  {/* Sub-items if any */}
                  {item.subItems && isActive && (
                    <div className="pl-8 pr-2 py-1 space-y-1">
                      {item.subItems.map((sub) => (
                        <Link
                          key={sub.id}
                          href={sub.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`block px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                            pathname === sub.href
                              ? "text-amber-300 font-bold bg-white/[0.05]"
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          ↳ {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/[0.08] text-[10px] font-mono text-slate-500 flex items-center justify-between">
            <span>NAVIGO v3.4.0</span>
            <span className="text-emerald-400 font-bold">NODE: DEL-T3-P1</span>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#030712] via-[#040915] to-[#02050E] p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* ── BOTTOM LIVE SYSTEM TICKER ─────────────────────────────── */}
      <footer className="h-8 bg-[#040813] border-t border-white/[0.08] px-4 flex items-center justify-between text-[11px] font-mono text-slate-400 overflow-hidden shrink-0 z-20">
        <div className="flex items-center gap-2 shrink-0 pr-4 border-r border-white/[0.08]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-bold">SYSTEM FEED LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap px-4 marquee-admin">
          <span className="text-slate-300">
            [10:24 AM] New booking confirmed: PNR <strong>MB5BRS</strong> (DEL → DXB) · [10:22 AM] DigiYatra Biometric cleared at Gate G4 · [10:20 AM] Seat 41C checked in · [10:18 AM] Dynamic pricing recalculated for BLR → DEL
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0 pl-4 border-l border-white/[0.08] text-[10px]">
          <span>CPU: 12%</span>
          <span>LATENCY: 14ms</span>
          <span className="text-cyan-400 font-bold">ENCRYPTED SHA-256</span>
        </div>
      </footer>

      {/* Global Quick Search Modal */}
      <AnimatePresence>
        {searchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSearchOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-xl bg-[#0A1424] border border-white/[0.14] rounded-3xl p-5 shadow-2xl z-10"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-white/[0.1]">
                <span className="text-lg">🔍</span>
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Quick lookup: PNR, Flight Number, Passenger Name..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                />
                <button onClick={() => setSearchOpen(false)} className="text-slate-400 hover:text-white text-xs">
                  ESC
                </button>
              </div>

              <div className="pt-3 space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                  Quick Navigation Shortcuts
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      router.push("/admin/flights")
                      setSearchOpen(false)
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-left font-mono"
                  >
                    ✈️ /admin/flights
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/bookings")
                      setSearchOpen(false)
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-left font-mono"
                  >
                    🎫 /admin/bookings
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/gates")
                      setSearchOpen(false)
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-left font-mono"
                  >
                    🚪 /admin/gates (QR Scanner)
                  </button>
                  <button
                    onClick={() => {
                      router.push("/admin/pricing")
                      setSearchOpen(false)
                    }}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] text-left font-mono"
                  >
                    📈 /admin/pricing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes adminTicker {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .marquee-admin span {
          display: inline-block;
          animation: adminTicker 35s linear infinite;
        }
      `}</style>
    </div>
  )
}