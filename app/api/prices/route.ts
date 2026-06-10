import { NextResponse } from "next/server"

export async function GET() {
  // simulate 7 days price trend
  const prices = Array.from({ length: 7 }).map((_, i) => {
    return {
      date: `Day ${i + 1}`,
      price: Math.floor(400 + Math.random() * 300),
    }
  })

  const cheapest = Math.min(...prices.map(p => p.price))
  const expensive = Math.max(...prices.map(p => p.price))

  return NextResponse.json({
    route: "DEL → SFO",
    cheapest,
    expensive,
    prices
  })
}