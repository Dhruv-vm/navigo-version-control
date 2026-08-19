export type AdminRole =
  | "SUPER_ADMIN"
  | "FLIGHT_OPERATIONS"
  | "BOOKING_AGENT"
  | "FINANCE"
  | "GATE_STAFF"

export interface AdminUser {
  id: string
  name: string
  email: string
  role: AdminRole
  badgeNumber: string
  department: string
  lastActive: string
}

export const DEMO_ADMIN_ACCOUNTS = [
  {
    id: "adm-dhruv",
    name: "Dhruv Sharma",
    email: "admin@navigo.app",
    role: "SUPER_ADMIN" as AdminRole,
    badgeNumber: "NVG-SA-001",
    department: "Executive & Systems Command",
    password: "admin",
  },
  {
    id: "adm-ops",
    name: "Flight Controller Singh",
    email: "ops@navigo.app",
    role: "FLIGHT_OPERATIONS" as AdminRole,
    badgeNumber: "NVG-OPS-102",
    department: "Air Traffic & Route Scheduling",
    password: "admin",
  },
  {
    id: "adm-agent",
    name: "Reservations Agent Rao",
    email: "agent@navigo.app",
    role: "BOOKING_AGENT" as AdminRole,
    badgeNumber: "NVG-RES-304",
    department: "Passenger Services & Manifests",
    password: "admin",
  },
  {
    id: "adm-finance",
    name: "Finance Controller Kapoor",
    email: "finance@navigo.app",
    role: "FINANCE" as AdminRole,
    badgeNumber: "NVG-FIN-401",
    department: "Revenue & Escrow Settlement",
    password: "admin",
  },
  {
    id: "adm-gate",
    name: "Gate Officer Verma",
    email: "gate@navigo.app",
    role: "GATE_STAFF" as AdminRole,
    badgeNumber: "NVG-SEC-809",
    department: "DigiYatra E-Gate Clearance",
    password: "admin",
  },
]

export function verifyAdminCredentials(email: string, pass: string) {
  const account = DEMO_ADMIN_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === pass.trim()
  )
  if (!account) return null
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    badgeNumber: account.badgeNumber,
    department: account.department,
    lastActive: new Date().toISOString(),
  }
}

export interface AdminAuditLog {
  id: string
  adminId: string
  adminName: string
  role: AdminRole
  action: string
  target: string
  timestamp: string
  details?: Record<string, any>
  ipAddress?: string
}

export const ADMIN_ROLES_META: Record<
  AdminRole,
  { label: string; badge: string; color: string; description: string }
> = {
  SUPER_ADMIN: {
    label: "Super Administrator",
    badge: "FULL ACCESS",
    color: "#E8C766", // Gold
    description: "Unrestricted operational, financial, and system administrative authority",
  },
  FLIGHT_OPERATIONS: {
    label: "Flight Operations",
    badge: "FLIGHT OPS",
    color: "#38BDF8", // Cyan
    description: "Manage routes, flight instances, aircraft schedules, gates, and seat inventory",
  },
  BOOKING_AGENT: {
    label: "Booking & Passenger Agent",
    badge: "RESERVATIONS",
    color: "#34D399", // Emerald
    description: "Customer bookings, passenger manifests, check-in operations, and boarding passes",
  },
  FINANCE: {
    label: "Finance & Revenue",
    badge: "FINANCE",
    color: "#F59E0B", // Amber
    description: "Financial reconciliations, refunds, revenue analytics, and add-on sales",
  },
  GATE_STAFF: {
    label: "Gate Security & Boarding Staff",
    badge: "E-GATE",
    color: "#A78BFA", // Violet
    description: "DigiYatra QR verification, biometric gate clearance, and passenger boarding",
  },
}

export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  SUPER_ADMIN: [
    "overview",
    "flights",
    "instances",
    "seats",
    "bookings",
    "passengers",
    "checkin",
    "smart-checkin",
    "gates",
    "revenue",
    "addons",
    "pricing",
    "analytics",
    "alerts",
    "settings",
    "audit-logs",
  ],
  FLIGHT_OPERATIONS: [
    "overview",
    "flights",
    "instances",
    "seats",
    "gates",
    "analytics",
    "alerts",
  ],
  BOOKING_AGENT: [
    "overview",
    "bookings",
    "passengers",
    "checkin",
    "smart-checkin",
    "gates",
    "alerts",
  ],
  FINANCE: [
    "overview",
    "revenue",
    "addons",
    "bookings",
    "analytics",
  ],
  GATE_STAFF: [
    "overview",
    "gates",
    "checkin",
    "smart-checkin",
    "alerts",
  ],
}

export function hasAdminPermission(role: AdminRole, module: string): boolean {
  if (role === "SUPER_ADMIN") return true
  const allowed = ROLE_PERMISSIONS[role] || []
  return allowed.includes(module)
}

// In-memory audit trail
const AUDIT_LOGS_STORE: AdminAuditLog[] = [
  {
    id: "aud-001",
    adminId: "adm-dhruv",
    adminName: "Dhruv Sharma",
    role: "SUPER_ADMIN",
    action: "SYSTEM_INITIALIZATION",
    target: "Command Center Operations",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    details: { status: "Online", nodes: 4 },
  },
  {
    id: "aud-002",
    adminId: "adm-ops1",
    adminName: "Flight Controller A",
    role: "FLIGHT_OPERATIONS",
    action: "STATUS_UPDATE",
    target: "Flight AI 102 (DEL → BLR)",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    details: { from: "SCHEDULED", to: "BOARDING", gate: "G4" },
  },
  {
    id: "aud-003",
    adminId: "adm-gate",
    adminName: "Gate Agent Delhi T3",
    role: "GATE_STAFF",
    action: "GATE_BOARDING_SCAN",
    target: "PNR MB5BRS / Seat 41C",
    timestamp: new Date(Date.now() - 900000).toISOString(),
    details: { result: "ALLOWED", biometricMatch: "99.8%" },
  },
]

export function recordAdminAuditLog(
  admin: { id: string; name: string; role: AdminRole },
  action: string,
  target: string,
  details?: Record<string, any>
): AdminAuditLog {
  const log: AdminAuditLog = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    adminId: admin.id,
    adminName: admin.name,
    role: admin.role,
    action,
    target,
    timestamp: new Date().toISOString(),
    details,
  }
  AUDIT_LOGS_STORE.unshift(log)
  if (AUDIT_LOGS_STORE.length > 500) AUDIT_LOGS_STORE.pop()
  return log
}

export function getAdminAuditLogs(limit = 100): AdminAuditLog[] {
  return AUDIT_LOGS_STORE.slice(0, limit)
}
