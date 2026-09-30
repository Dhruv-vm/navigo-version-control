"use client"

import React, { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Navbar from "@/components/navbar"
import { motion } from "framer-motion"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  suggestions?: string[]
  actionWidget?: any
}

export default function NaviBotPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-welcome",
      role: "assistant",
      content:
        "👋 Welcome to **NaviBot Full Command Center**!\n\nI am your real-time aviation AI assistant. Ask me to find flights, analyze fare trends, verify your PNR status, explain DigiYatra biometric boarding, or review baggage allowances.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "🔍 Find non-stop flights from Delhi to Mumbai",
        "🎫 What is my latest booking status?",
        "⚡ How does DigiYatra touchless boarding work?",
        "📈 Will flight prices increase this weekend?",
        "🧳 Extra baggage & Priority pass rates",
      ],
      actionWidget: {
        type: "quick_links",
        title: "Popular Fast Shortcuts",
        links: [
          { label: "Search Flights Now ↗", href: "/flights?origin=DEL&destination=BLR&depart=2026-08-25&pax=1&mode=oneway" },
          { label: "DigiYatra Web Check-In ↗", href: "/check-in" },
          { label: "My Trips & Passes ↗", href: "/my-trips" },
        ],
      },
    },
  ])

  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input
    if (!textToSend.trim() || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const res = await fetch("/api/navibot", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          query: textToSend,
        }),
      })

      const data = await res.json()

      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.reply || "I have received your inquiry.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: data.suggestions || [],
        actionWidget: data.actionWidget,
      }

      setMessages((prev) => [...prev, botMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content: "I encountered a network timeout while querying the flight network.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Voice speech recognition is not supported in this browser.")
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = "en-US"
    recognition.interimResults = false

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setInput(transcript)
      handleSend(transcript)
    }

    recognition.start()
  }

  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n")
    return (
      <div className="space-y-2 leading-relaxed text-sm">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1.5" />

          if (line.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-display font-bold text-amber-300 text-base mt-2 mb-1">
                {line.replace("### ", "")}
              </h4>
            )
          }

          if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
            const text = line.replace(/^[•\-*]\s+/, "")
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-amber-400 font-bold">•</span>
                <span
                  dangerouslySetInnerHTML={{
                    __html: text
                      .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-bold'>$1</strong>")
                      .replace(/\*(.*?)\*/g, "<em class='text-slate-300'>$1</em>")
                      .replace(/`([^`]+)`/g, "<code class='bg-black/40 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono'>$1</code>"),
                  }}
                />
              </div>
            )
          }

          return (
            <p
              key={idx}
              dangerouslySetInnerHTML={{
                __html: line
                  .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-bold'>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em class='text-slate-300'>$1</em>")
                  .replace(/`([^`]+)`/g, "<code class='bg-black/40 text-amber-300 px-1.5 py-0.5 rounded text-xs font-mono'>$1</code>"),
              }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020614] text-slate-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-12 gap-6">
        {/* ── LEFT SIDEBAR (QUICK ASSIST TOOLS) ───────────────────────── */}
        <div className="hidden lg:block col-span-4 space-y-5 font-mono text-xs">
          {/* Agent Profile Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
            <div className="flex items-center gap-3.5 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-2xl shadow-inner">
                🤖
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-white tracking-wide">
                  NaviBot AI Assistant
                </h2>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE & TELEMETRY SYNCED
                </span>
              </div>
            </div>
            <p className="text-slate-400 leading-relaxed text-xs">
              Powered by real-time flight inventory schedules, dynamic pricing algorithms, and DigiYatra biometric gate terminals.
            </p>
          </div>

          {/* Quick Prompt Categories */}
          <div className="p-5 rounded-3xl bg-[#070E1C] border border-white/[0.08] shadow-xl space-y-3">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-amber-300">
              Quick Inquiries
            </h3>
            <div className="space-y-2">
              {[
                { label: "✈️ Find cheap flights to Delhi", prompt: "Find cheap flights to Delhi" },
                { label: "🎫 Track my booking status", prompt: "What is my latest booking status?" },
                { label: "⚡ DigiYatra Face Scan Guide", prompt: "How does DigiYatra check-in work?" },
                { label: "📈 Fare Price Forecast", prompt: "Will flight prices increase this weekend?" },
                { label: "🧳 Baggage & Add-on Rules", prompt: "What are the baggage allowance and add-on rates?" },
                { label: "✨ NavPoints Loyalty Rewards", prompt: "How do I earn and redeem NavPoints?" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(item.prompt)}
                  className="w-full text-left p-2.5 rounded-2xl bg-white/[0.02] hover:bg-amber-400/10 text-slate-300 hover:text-amber-300 border border-white/[0.06] hover:border-amber-400/30 transition-all font-sans text-xs"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT MAIN CHAT AREA ───────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8 flex flex-col h-[78vh] rounded-3xl bg-gradient-to-b from-[#0D1A2C] to-[#0A1424] border border-white/[0.08] shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-emerald-400" />

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {messages.map((msg) => {
              const isBot = msg.role === "assistant"

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                >
                  <div className="flex items-end gap-3 max-w-[90%]">
                    {isBot && (
                      <div className="w-8 h-8 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-sm shrink-0 mb-1">
                        🤖
                      </div>
                    )}

                    <div
                      className={`p-4 rounded-3xl shadow-xl ${
                        isBot
                          ? "bg-[#070F1E] border border-white/[0.08] text-slate-200 rounded-bl-sm"
                          : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 text-slate-950 font-medium rounded-br-sm shadow-[0_2px_14px_rgba(251,191,36,0.25)]"
                      }`}
                    >
                      {renderFormattedContent(msg.content)}

                      {/* Widget Rendering */}
                      {msg.actionWidget && (
                        <div className="mt-4 pt-3 border-t border-white/[0.08]">
                          {/* 0. Instant Booking Card Widget (End-to-End One Click Booking) */}
                          {msg.actionWidget.type === "instant_booking_card" && (
                            <div className="p-4 rounded-2xl bg-[#030712] border border-amber-400/30 space-y-3 shadow-xl">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <strong className="text-white text-sm">{msg.actionWidget.flight.airline}</strong>
                                </div>
                                <span className="text-amber-300 font-mono text-xs font-bold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/30">
                                  RESERVATION READY
                                </span>
                              </div>

                              {/* Sector & Timing */}
                              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1.5 font-mono">
                                <div className="flex items-center justify-between text-white font-bold text-base">
                                  <span>{msg.actionWidget.flight.origin}</span>
                                  <span className="text-amber-400 text-xs">✈ {msg.actionWidget.flight.duration || "2h 30m"} ➔</span>
                                  <span>{msg.actionWidget.flight.destination}</span>
                                </div>
                                <div className="flex items-center justify-between text-slate-400 text-xs">
                                  <span>Departure: {msg.actionWidget.flight.departure_time?.slice(0, 5) || "11:30"}</span>
                                  <span>Arrival: {msg.actionWidget.flight.arrival_time?.slice(0, 5) || "14:00"}</span>
                                </div>
                              </div>

                              {/* Passenger & Seat Assignment */}
                              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                  <span className="text-slate-500 block text-[10px] uppercase">Passenger</span>
                                  <span className="text-slate-200 font-bold truncate block">{msg.actionWidget.passengerName}</span>
                                </div>
                                <div className="p-2.5 rounded-xl bg-emerald-400/10 border border-emerald-400/25">
                                  <span className="text-emerald-400 block text-[10px] uppercase">Assigned Seat</span>
                                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                                    💺 Seat {msg.actionWidget.assignedSeat} <span className="text-[9px] bg-emerald-400/20 px-1 rounded">FREE</span>
                                  </span>
                                </div>
                              </div>

                              {/* Fare Summary */}
                              <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-sm">
                                <span className="text-slate-400">Total Payable (Fare + Taxes):</span>
                                <span className="text-amber-300 font-black text-lg font-mono">
                                  ₹{msg.actionWidget.total?.toLocaleString("en-IN") || "5,700"}
                                </span>
                              </div>

                              {/* 1-Click Action CTAs */}
                              <div className="space-y-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (typeof window !== "undefined") {
                                      sessionStorage.setItem("navigo_checkout_selection", JSON.stringify(msg.actionWidget.checkoutSession))
                                    }
                                    router.push("/checkout/payment")
                                  }}
                                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(251,191,36,0.35)] cursor-pointer"
                                >
                                  <span>💳 Proceed to Payment (₹{msg.actionWidget.total?.toLocaleString("en-IN")})</span>
                                  <span>➔</span>
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== "undefined") {
                                        sessionStorage.setItem("navigo_checkout_selection", JSON.stringify(msg.actionWidget.checkoutSession))
                                      }
                                      router.push("/checkout/seats")
                                    }}
                                    className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-cyan-300 hover:text-cyan-200 text-xs font-bold border border-white/[0.08] transition-colors text-center cursor-pointer"
                                  >
                                    💺 Pick Specific Seat
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== "undefined") {
                                        sessionStorage.setItem("navigo_checkout_selection", JSON.stringify(msg.actionWidget.checkoutSession))
                                      }
                                      router.push("/checkout/passengers")
                                    }}
                                    className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-xs font-bold border border-white/[0.08] transition-colors text-center cursor-pointer"
                                  >
                                    👤 Edit Passenger
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.actionWidget.type === "flight_card" && (
                            <div className="p-4 rounded-2xl bg-[#030712] border border-white/[0.08] space-y-2">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <strong className="text-white">{msg.actionWidget.flight.airline}</strong>
                                <span className="text-cyan-300">{msg.actionWidget.flight.flight_number}</span>
                              </div>
                              <div className="flex justify-between items-center font-bold text-white text-base">
                                <span>{msg.actionWidget.flight.origin}</span>
                                <span className="text-amber-400 text-xs">✈ {msg.actionWidget.flight.duration} ➔</span>
                                <span>{msg.actionWidget.flight.destination}</span>
                              </div>
                              <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
                                <span className="text-amber-300 font-bold text-base">
                                  ₹{msg.actionWidget.flight.calculatedPrice?.toLocaleString("en-IN") || "4,850"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSend(`Book ${msg.actionWidget.flight.origin} to ${msg.actionWidget.flight.destination}`)}
                                  className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs hover:bg-amber-300 transition-all shadow-[0_2px_10px_rgba(251,191,36,0.3)] hover:scale-105 cursor-pointer"
                                >
                                  Book Flight ➔
                                </button>
                              </div>
                            </div>
                          )}

                          {msg.actionWidget.type === "booking_card" && (
                            <div className="p-4 rounded-2xl bg-[#030712] border border-white/[0.08] space-y-2 font-mono text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-amber-300 font-bold tracking-widest text-sm">
                                  PNR: {msg.actionWidget.booking.pnr}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                                  {msg.actionWidget.booking.status}
                                </span>
                              </div>
                              <div className="text-white text-sm">
                                <strong>{msg.actionWidget.booking.origin} ➔ {msg.actionWidget.booking.destination}</strong>
                                <span className="text-slate-400 block text-xs mt-0.5">
                                  {msg.actionWidget.booking.travelDate} · Seat {msg.actionWidget.booking.seat} · Gate {msg.actionWidget.booking.gate}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 pt-2">
                                <Link
                                  href="/my-trips"
                                  className="flex-1 py-2 text-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-bold border border-white/[0.08] transition-colors"
                                >
                                  View Boarding Pass ↗
                                </Link>
                                <Link
                                  href="/check-in"
                                  className="flex-1 py-2 text-center rounded-xl bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 transition-colors"
                                >
                                  DigiYatra Check-In ↗
                                </Link>
                              </div>
                            </div>
                          )}

                          {msg.actionWidget.type === "quick_links" && (
                            <div className="flex flex-wrap gap-2 font-mono text-xs">
                              {msg.actionWidget.links.map((link: any, i: number) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    if (link.label.toLowerCase().includes("search flight")) {
                                      handleSend("Find flights to Delhi")
                                    }
                                    router.push(link.href)
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-amber-400/20 text-amber-300 hover:text-amber-200 font-bold border border-white/[0.1] hover:border-amber-400/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 text-left"
                                >
                                  {link.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono mt-1 px-1">
                    {msg.timestamp}
                  </span>

                  {/* Suggestion Chips */}
                  {isBot && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 pl-11">
                      {msg.suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(s)}
                          className="px-3 py-1.5 rounded-xl bg-[#070F1E] hover:bg-amber-400/20 text-slate-300 hover:text-amber-300 border border-white/[0.08] hover:border-amber-400/30 text-xs font-mono transition-all text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-slate-400 pl-2"
              >
                <div className="w-8 h-8 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-sm">
                  🤖
                </div>
                <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-[#070F1E] border border-white/[0.08]">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-75" />
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-150" />
                  <span className="text-xs text-slate-400 font-mono ml-1">NaviBot is searching live flight telemetry…</span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-[#050C17] border-t border-white/[0.08]">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-3 bg-[#081324] border border-white/[0.1] rounded-2xl p-2 focus-within:border-amber-400/50 transition-colors shadow-inner"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask NaviBot anything about flights, PNRs, baggage, or DigiYatra..."
                className="flex-1 bg-transparent px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none font-mono"
              />

              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-2.5 rounded-xl border transition-all ${
                  isListening
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                    : "bg-white/[0.04] text-slate-400 hover:text-white border-white/[0.06]"
                }`}
                title="Voice Input (Speech to Text)"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
                </svg>
              </button>

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-all disabled:opacity-40"
              >
                Send Query →
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
