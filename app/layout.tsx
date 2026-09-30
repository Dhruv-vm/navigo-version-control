import "./globals.css"
import NaviBot from "@/components/NaviBot"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#020617] text-white overflow-y-auto">
        {children}
        <NaviBot />
      </body>
    </html>
  )
}