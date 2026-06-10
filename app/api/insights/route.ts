import { NextResponse } from "next/server"

export async function GET() {
  const score = (Math.random() * 5).toFixed(1)

  let level = "Medium"

  if (score < 2.5) level = "Low"
  else if (score > 3.5) level = "High"

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