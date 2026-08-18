import { NextResponse } from "next/server"

export async function GET() {
  const numScore = Number((Math.random() * 5).toFixed(1))
  const score = String(numScore)

  let level = "Medium"

  if (numScore < 2.5) level = "Low"
  else if (numScore > 3.5) level = "High"

  return NextResponse.json({
    score,
    level,
    message:
      level === "Low"
        ? "Best time to book"
        : level === "High"
        ? "Prices are expensive"
        : "Average pricing"
  })
}