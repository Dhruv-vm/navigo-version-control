// Shared seat state across Admin operations and Passenger Booking API

const BLOCKED_SEATS_STORE = new Map<string, Set<string>>() // flightInstanceId -> Set<seatNumber>

export function getBlockedSeatsForInstance(flightInstanceId: string): string[] {
  const set = BLOCKED_SEATS_STORE.get(flightInstanceId)
  return set ? Array.from(set) : []
}

export function setSeatBlockState(
  flightInstanceId: string,
  seatNumber: string,
  block: boolean
): string[] {
  if (!BLOCKED_SEATS_STORE.has(flightInstanceId)) {
    BLOCKED_SEATS_STORE.set(flightInstanceId, new Set<string>())
  }
  const set = BLOCKED_SEATS_STORE.get(flightInstanceId)!
  if (block) {
    set.add(seatNumber)
  } else {
    set.delete(seatNumber)
  }
  return Array.from(set)
}
