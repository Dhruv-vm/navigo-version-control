// Boarding-pass header theming per airline, visually matched to the
// reference designs (Emirates red, Etihad black/gold, IndiGo indigo,
// Lufthansa navy/yellow, Qatar maroon, Singapore navy/gold, Thai purple/
// gold, Vistara maroon/gold, Oman Air grey/gold, JAL red/black). Falls
// back to the app's own navy/gold house style for any airline not listed.

export type AirlineTheme = {
  headerBg: string
  stripe: string
  titleColor: string
}

export const AIRLINE_THEMES: Record<string, AirlineTheme> = {
  "Emirates": { headerBg: "linear-gradient(135deg, #D7132A, #A80F21)", stripe: "#8C0C1B", titleColor: "#FFFFFF" },
  "Etihad": { headerBg: "linear-gradient(135deg, #241611, #150C09)", stripe: "#D4AF37", titleColor: "#E8C766" },
  "IndiGo": { headerBg: "linear-gradient(135deg, #2A3990, #1D2A6B)", stripe: "#141C4D", titleColor: "#FFFFFF" },
  "Air India": { headerBg: "linear-gradient(135deg, #D7132A, #8C0C1B)", stripe: "#5B0712", titleColor: "#FFFFFF" },
  "Japan Airlines": { headerBg: "linear-gradient(135deg, #C8102E, #8C0C1B)", stripe: "#141414", titleColor: "#FFFFFF" },
  "Lufthansa": { headerBg: "linear-gradient(135deg, #0A1E42, #071530)", stripe: "#F5A623", titleColor: "#F5A623" },
  "Oman Air": { headerBg: "linear-gradient(135deg, #7C8792, #5E6772)", stripe: "#D4AF37", titleColor: "#FFFFFF" },
  "Qatar Airways": { headerBg: "linear-gradient(135deg, #5C0632, #3E0421)", stripe: "#9AA0A6", titleColor: "#FFFFFF" },
  "Singapore Airlines": { headerBg: "linear-gradient(135deg, #0A2472, #071A52)", stripe: "#F5C518", titleColor: "#F5C518" },
  "Thai Airways": { headerBg: "linear-gradient(135deg, #3A1859, #260F3D)", stripe: "#F5C518", titleColor: "#F5C518" },
  "Vistara": { headerBg: "linear-gradient(135deg, #4A0E28, #33071B)", stripe: "#D4AF37", titleColor: "#E8C766" },
  "Akasa Air": { headerBg: "linear-gradient(135deg, #FF6A13, #CC5610)", stripe: "#8C3B0B", titleColor: "#FFFFFF" },
}

// Navigo house style — used for any airline not in the table above, and
// doubles as the "stub" accent when nothing more specific applies.
export const DEFAULT_THEME: AirlineTheme = {
  headerBg: "linear-gradient(135deg, #101B2C, #0A1424)",
  stripe: "#D4AF37",
  titleColor: "#E8C766",
}

export function getAirlineTheme(airline: string): AirlineTheme {
  return AIRLINE_THEMES[airline] || DEFAULT_THEME
}