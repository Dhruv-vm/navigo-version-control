import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json([
    {
      from: "DEL",
      to: "DXB",
      city: "Delhi to Dubai",
      price: 102,
      image: "/dubai.jpg"
    },
    {
      from: "BOM",
      to: "SIN",
      city: "Mumbai to Singapore",
      price: 145,
      image: "/singapore.jpg"
    },
    {
      from: "BLR",
      to: "LON",
      city: "Bangalore to London",
      price: 456,
      image: "/london.jpg"
    }
  ])
}