// Card formatting, brand detection, and lightweight validation for the
// payment page. Pure functions, no network calls, no external deps.

export type CardBrand = "visa" | "mastercard" | "amex" | "rupay" | "unknown"

export function detectCardBrand(digitsOnly: string): CardBrand {
  if (!digitsOnly) return "unknown"
  if (/^4/.test(digitsOnly)) return "visa"
  if (/^5[1-5]/.test(digitsOnly)) return "mastercard"
  if (/^3[47]/.test(digitsOnly)) return "amex"
  if (/^(60|65|81|82|508)/.test(digitsOnly)) return "rupay"
  return "unknown"
}

export function cardNumberMaxLength(brand: CardBrand): number {
  return brand === "amex" ? 15 : 16
}

export function cvvMaxLength(brand: CardBrand): number {
  return brand === "amex" ? 4 : 3
}

// Strips non-digits and caps at the brand's real length. Re-detects brand
// from the digits as they arrive, so typing "34..." caps at 15 the moment
// Amex is recognized instead of waiting for a fixed 16.
export function sanitizeCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, "")
  const brand = detectCardBrand(digits)
  return digits.slice(0, cardNumberMaxLength(brand))
}

// "4111111111111111" -> "4111 1111 1111 1111"
// Amex groups 4-6-5 ("3714 496353 98431") instead of 4-4-4-4.
export function formatCardNumber(digitsOnly: string, brand: CardBrand): string {
  if (brand === "amex") {
    return [digitsOnly.slice(0, 4), digitsOnly.slice(4, 10), digitsOnly.slice(10, 15)]
      .filter(Boolean)
      .join(" ")
  }
  return digitsOnly.match(/.{1,4}/g)?.join(" ") ?? digitsOnly
}

// What the card FACE shows — real digits typed so far, padded out to the
// brand's full length with bullet placeholders so the layout doesn't jump
// around as the person types.
export function cardNumberDisplay(digitsOnly: string, brand: CardBrand): string {
  const max = cardNumberMaxLength(brand)
  const placeholder = "•".repeat(Math.max(0, max - digitsOnly.length))
  return formatCardNumber(digitsOnly + placeholder, brand)
}

export function sanitizeExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function isExpiryComplete(expiry: string): boolean {
  return /^\d{2}\/\d{2}$/.test(expiry)
}

export function isExpiryValid(expiry: string): boolean {
  const match = expiry.match(/^(\d{2})\/(\d{2})$/)
  if (!match) return false
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return false
  const now = new Date()
  const lastDayOfExpiryMonth = new Date(year, month, 0, 23, 59, 59)
  return lastDayOfExpiryMonth.getTime() >= now.getTime()
}

export function sanitizeCvvInput(raw: string, brand: CardBrand): string {
  return raw.replace(/\D/g, "").slice(0, cvvMaxLength(brand))
}

// Luhn checksum — optional extra validation layer beyond length checks,
// catches obvious typos (e.g. two digits swapped).
export function passesLuhn(digitsOnly: string): boolean {
  if (digitsOnly.length < 12) return false
  let sum = 0
  let alternate = false
  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let n = Number(digitsOnly[i])
    if (alternate) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    alternate = !alternate
  }
  return sum % 10 === 0
}

export type CardFieldErrors = {
  name?: string
  number?: string
  expiry?: string
  cvv?: string
}

export function validateCardForm(input: {
  name: string
  numberDigits: string
  brand: CardBrand
  expiry: string
  cvv: string
}): CardFieldErrors {
  const errors: CardFieldErrors = {}

  if (!input.name.trim()) errors.name = "Enter the name on the card"

  if (input.brand === "unknown" || input.numberDigits.length < cardNumberMaxLength(input.brand)) {
    errors.number = "Enter a valid card number"
  } else if (!passesLuhn(input.numberDigits)) {
    errors.number = "That card number doesn't look right"
  }

  if (!isExpiryComplete(input.expiry)) {
    errors.expiry = "MM/YY"
  } else if (!isExpiryValid(input.expiry)) {
    errors.expiry = "Card has expired"
  }

  if (input.cvv.length < cvvMaxLength(input.brand)) {
    errors.cvv = input.brand === "amex" ? "4 digits" : "3 digits"
  }

  return errors
}