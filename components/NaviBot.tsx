"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  suggestions?: string[]
  actionWidget?: any
}

export default function NaviBot() {
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [bubbleDismissed, setBubbleDismissed] = useState(false)

  // Pages with sticky bottom bars (flight search with selection, checkout steps)
  const hasBottomBar = pathname === "/flights" || pathname?.startsWith("/checkout")

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-init",
      role: "assistant",
      content:
        "👋 Hello! I am **NaviBot**, your AI flight companion.\n\nI can help you find cheap flights, track your booking PNR, check in with DigiYatra, and forecast fare prices. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "🔍 Find flights to Delhi",
        "🎫 Check my booking status",
        "⚡ How does DigiYatra work?",
        "🧳 Baggage allowance rules",
      ],
      actionWidget: {
        type: "quick_links",
        title: "Fast Shortcuts",
        links: [
          { label: "Search Flights ↗", href: "/flights?origin=DEL&destination=BLR&depart=2026-08-25&pax=1&mode=oneway" },
          { label: "Web Check-In ↗", href: "/check-in" },
          { label: "My Trips ↗", href: "/my-trips" },
        ],
      },
    },
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      setUnreadCount(0)
    }
  }, [messages, isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen])

  // Listen for global custom event to open NaviBot from anywhere (e.g. Navbar)
  useEffect(() => {
    const handleOpenNaviBot = (e: any) => {
      setIsOpen(true)
      if (e?.detail?.query) {
        handleSend(e.detail.query)
      }
    }
    window.addEventListener("open_navibot", handleOpenNaviBot)
    return () => window.removeEventListener("open_navibot", handleOpenNaviBot)
  }, [])

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
        content: data.reply || "I am processing your request. Please check back shortly!",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: data.suggestions || [],
        actionWidget: data.actionWidget,
      }

      setMessages((prev) => [...prev, botMsg])
      if (!isOpen) setUnreadCount((c) => c + 1)
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content: "I ran into a temporary network glitch. Please try asking again!",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          suggestions: ["Search Flights", "My Bookings", "Web Check-In"],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Voice speech recognition handler
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

  const clearChat = () => {
    setMessages([
      {
        id: "msg-reset",
        role: "assistant",
        content: "Chat cleared! How can I assist you with your flights?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        suggestions: ["Find cheap flights", "My Bookings", "DigiYatra Check-In", "Price Trends"],
      },
    ])
  }

  // Format simple markdown into JSX
  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n")
    return (
      <div className="space-y-1.5 leading-relaxed text-xs">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />

          // Headers
          if (line.startsWith("### ")) {
            return (
              <h4 key={idx} className="font-display font-bold text-amber-300 text-sm mt-1 mb-0.5">
                {line.replace("### ", "")}
              </h4>
            )
          }

          // Bullet points
          if (line.startsWith("• ") || line.startsWith("- ") || line.startsWith("* ")) {
            const text = line.replace(/^[•\-*]\s+/, "")
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-amber-400 font-bold">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatBoldAndCode(text) }} />
              </div>
            )
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatBoldAndCode(line) }} />
          )
        })}
      </div>
    )
  }

  const formatBoldAndCode = (text: string) => {
    let out = text
      .replace(/\*\*(.*?)\*\*/g, "<strong class='text-white font-bold'>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em class='text-slate-300'>$1</em>")
      .replace(/`([^`]+)`/g, "<code class='bg-black/40 text-amber-300 px-1 py-0.5 rounded text-[11px] font-mono'>$1</code>")
    return out
  }

  return (
    <div
      className={`fixed right-4 sm:right-6 font-sans transition-all duration-300 ${
        isOpen
          ? "bottom-4 sm:bottom-6 z-50"
          : hasBottomBar
          ? "bottom-24 sm:bottom-28 z-40"
          : "bottom-6 z-40"
      }`}
    >
      {/* ── FLOATING TRIGGER PILL / BUBBLE ────────────────────────── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0, y: 20 }}
            className="flex items-center gap-2"
          >
            {/* Quick Greeting Bubble (dismissible and hidden on pages with sticky bottom bars so it never blocks buttons) */}
            {!bubbleDismissed && !hasBottomBar && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="hidden sm:flex items-center gap-2 bg-[#091322]/95 border border-white/[0.12] pl-3.5 pr-2 py-2 rounded-2xl shadow-2xl backdrop-blur-xl group"
              >
                <div onClick={() => setIsOpen(true)} className="flex items-center gap-2 cursor-pointer">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono text-slate-200 group-hover:text-white">
                    Hi! Ask <strong className="text-amber-300">NaviBot AI</strong>
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setBubbleDismissed(true)
                  }}
                  className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 text-xs transition-colors ml-1"
                  title="Dismiss tip"
                >
                  ✕
                </button>
              </motion.div>
            )}

            {/* Glowing Launcher Button */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-3 sm:p-3.5 rounded-2xl bg-gradient-to-tr from-[#0F1D32] via-[#152744] to-[#0A1628] border border-amber-400/40 text-white shadow-[0_0_25px_rgba(251,191,36,0.25)] hover:shadow-[0_0_35px_rgba(251,191,36,0.45)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center group"
              title="Open NaviBot AI Flight Assistant"
            >
              {/* Outer Pulsing Ring */}
              <div className="absolute inset-0 rounded-2xl bg-amber-400/10 animate-ping pointer-events-none" />

              <div className="flex items-center gap-1.5">
                <span className="text-xl group-hover:scale-110 transition-transform">🤖</span>
                {!hasBottomBar && (
                  <span className="hidden md:inline-block font-display font-black text-xs tracking-wider text-amber-300 pr-1">
                    NAVIBOT AI
                  </span>
                )}
              </div>

              {/* Unread Badge */}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-lg animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EXPANDABLE CHAT DRAWER / WINDOW ───────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className={`flex flex-col bg-gradient-to-b from-[#0B172A] via-[#081120] to-[#040914] border border-white/[0.14] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden transition-all duration-300 ${
              isExpanded
                ? "w-[94vw] sm:w-[680px] h-[86vh]"
                : "w-[92vw] sm:w-[420px] h-[580px] sm:h-[620px]"
            }`}
          >
            {/* Top Amber Hairline */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 via-amber-400 to-amber-300" />

            {/* ── HEADER ─────────────────────────────────────────── */}
            <div className="p-4 bg-[#060E1C] border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400/20 via-cyan-400/15 to-transparent border border-white/15 flex items-center justify-center text-xl shadow-inner">
                  🤖
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#060E1C]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-black text-sm text-white tracking-wide">
                      NAVIBOT AI
                    </h3>
                    <span className="text-[9px] font-mono font-bold bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30">
                      INTELLIGENCE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live System & Flight Awareness
                  </span>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-xl hover:bg-white/[0.06] hover:text-white transition-colors"
                  title="Clear conversation"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="hidden sm:block p-1.5 rounded-xl hover:bg-white/[0.06] hover:text-white transition-colors"
                  title={isExpanded ? "Collapse view" : "Expand view"}
                >
                  {isExpanded ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M4 14h6v6M20 10h-6V4" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/[0.06] hover:text-white transition-colors"
                  title="Close chat"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── CHAT MESSAGES BODY ───────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {messages.map((msg) => {
                const isBot = msg.role === "assistant"

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isBot ? "items-start" : "items-end"}`}
                  >
                    <div className="flex items-end gap-2 max-w-[88%]">
                      {isBot && (
                        <div className="w-7 h-7 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-xs shrink-0 mb-1">
                          🤖
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-3xl shadow-lg ${
                          isBot
                            ? "bg-[#091424] border border-white/[0.08] text-slate-200 rounded-bl-sm"
                            : "bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 text-slate-950 font-medium rounded-br-sm shadow-[0_2px_14px_rgba(251,191,36,0.25)]"
                        }`}
                      >
                        {renderFormattedContent(msg.content)}

                        {/* Interactive Widget Render */}
                        {msg.actionWidget && (
                          <div className="mt-3 pt-3 border-t border-white/[0.08]">
                            {/* 0. Instant Booking Card Widget (End-to-End One Click Booking) */}
                            {msg.actionWidget.type === "instant_booking_card" && (
                              <div className="p-3.5 rounded-2xl bg-[#030712] border border-amber-400/30 space-y-2.5 shadow-xl">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                    <strong className="text-white text-xs">{msg.actionWidget.flight.airline}</strong>
                                  </div>
                                  <span className="text-amber-300 font-mono text-[10px] font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                                    RESERVATION READY
                                  </span>
                                </div>

                                {/* Sector & Timing */}
                                <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                                  <div className="flex items-center justify-between text-white font-bold text-sm">
                                    <span>{msg.actionWidget.flight.origin}</span>
                                    <span className="text-amber-400 text-xs">✈ {msg.actionWidget.flight.duration || "2h 30m"} ➔</span>
                                    <span>{msg.actionWidget.flight.destination}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-slate-400 text-[10px] font-mono">
                                    <span>Departure: {msg.actionWidget.flight.departure_time?.slice(0, 5) || "11:30"}</span>
                                    <span>Arrival: {msg.actionWidget.flight.arrival_time?.slice(0, 5) || "14:00"}</span>
                                  </div>
                                </div>

                                {/* Passenger & Seat Assignment */}
                                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                    <span className="text-slate-500 block text-[9px] uppercase">Passenger</span>
                                    <span className="text-slate-200 font-bold truncate block">{msg.actionWidget.passengerName}</span>
                                  </div>
                                  <div className="p-2 rounded-xl bg-emerald-400/10 border border-emerald-400/25">
                                    <span className="text-emerald-400 block text-[9px] uppercase">Assigned Seat</span>
                                    <span className="text-emerald-300 font-bold flex items-center gap-1">
                                      💺 Seat {msg.actionWidget.assignedSeat} <span className="text-[8px] bg-emerald-400/20 px-1 rounded">FREE</span>
                                    </span>
                                  </div>
                                </div>

                                {/* Fare Summary */}
                                <div className="flex items-center justify-between pt-1 border-t border-white/[0.06] text-xs">
                                  <span className="text-slate-400">Total (Fare + Taxes):</span>
                                  <span className="text-amber-300 font-black text-base font-mono">
                                    ₹{msg.actionWidget.total?.toLocaleString("en-IN") || "5,700"}
                                  </span>
                                </div>

                                {/* 1-Click Action CTAs */}
                                <div className="space-y-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== "undefined") {
                                        sessionStorage.setItem("navigo_checkout_selection", JSON.stringify(msg.actionWidget.checkoutSession))
                                      }
                                      router.push("/checkout/payment")
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-xs hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(251,191,36,0.35)] cursor-pointer"
                                  >
                                    <span>💳 Proceed to Payment (₹{msg.actionWidget.total?.toLocaleString("en-IN")})</span>
                                    <span>➔</span>
                                  </button>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (typeof window !== "undefined") {
                                          sessionStorage.setItem("navigo_checkout_selection", JSON.stringify(msg.actionWidget.checkoutSession))
                                        }
                                        router.push("/checkout/seats")
                                      }}
                                      className="py-1.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-cyan-300 hover:text-cyan-200 text-[10px] font-bold border border-white/[0.08] transition-colors text-center cursor-pointer"
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
                                      className="py-1.5 px-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 hover:text-white text-[10px] font-bold border border-white/[0.08] transition-colors text-center cursor-pointer"
                                    >
                                      👤 Edit Passenger
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 1. Flight Card Widget */}
                            {msg.actionWidget.type === "flight_card" && (
                              <div className="p-3 rounded-2xl bg-[#030712] border border-white/[0.08] space-y-2">
                                <div className="flex items-center justify-between">
                                  <strong className="text-white text-xs">{msg.actionWidget.flight.airline}</strong>
                                  <span className="text-cyan-300 text-[10px]">{msg.actionWidget.flight.aircraft || "A320neo"}</span>
                                </div>
                                <div className="flex items-center justify-between text-white font-bold">
                                  <span>{msg.actionWidget.flight.origin}</span>
                                  <span className="text-amber-400 text-xs">✈ {msg.actionWidget.flight.duration} ➔</span>
                                  <span>{msg.actionWidget.flight.destination}</span>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                                  <span className="text-amber-300 font-bold text-sm">
                                    ₹{msg.actionWidget.flight.calculatedPrice?.toLocaleString("en-IN") || "4,850"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleSend(`Book ${msg.actionWidget.flight.origin} to ${msg.actionWidget.flight.destination}`)}
                                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-bold text-[11px] hover:bg-amber-300 transition-all shadow-[0_2px_10px_rgba(251,191,36,0.3)] hover:scale-105 cursor-pointer"
                                  >
                                    Book Flight ➔
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 2. Booking Card Widget */}
                            {msg.actionWidget.type === "booking_card" && (
                              <div className="p-3 rounded-2xl bg-[#030712] border border-white/[0.08] space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-amber-300 font-bold tracking-widest">
                                    PNR: {msg.actionWidget.booking.pnr}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                                    {msg.actionWidget.booking.status}
                                  </span>
                                </div>
                                <div className="text-white">
                                  <strong>{msg.actionWidget.booking.origin} ➔ {msg.actionWidget.booking.destination}</strong>
                                  <span className="text-slate-400 block text-[10px]">
                                    {msg.actionWidget.booking.travelDate} · Seat {msg.actionWidget.booking.seat} · Gate {msg.actionWidget.booking.gate}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <Link
                                    href="/my-trips"
                                    className="flex-1 py-1.5 text-center rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-[10px] font-bold border border-white/[0.08] transition-colors"
                                  >
                                    View Pass ↗
                                  </Link>
                                  <Link
                                    href="/check-in"
                                    className="flex-1 py-1.5 text-center rounded-xl bg-amber-400 text-slate-950 text-[10px] font-bold hover:bg-amber-300 transition-colors"
                                  >
                                    DigiYatra Check-In ↗
                                  </Link>
                                </div>
                              </div>
                            )}

                            {/* 3. Price Insight Widget */}
                            {msg.actionWidget.type === "price_insight_card" && (
                              <div className="p-3 rounded-2xl bg-[#030712] border border-white/[0.08] space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <strong className="text-white">{msg.actionWidget.route}</strong>
                                  <span className="text-rose-400 text-[9px] font-bold bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30">
                                    {msg.actionWidget.forecast}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400">{msg.actionWidget.advice}</p>
                              </div>
                            )}

                            {/* 4. Quick Links Widget */}
                            {msg.actionWidget.type === "quick_links" && (
                              <div className="flex flex-wrap gap-2">
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
                                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-amber-400/20 text-amber-300 hover:text-amber-200 text-[11px] font-bold border border-white/[0.1] hover:border-amber-400/40 transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95 text-left"
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

                    <span className="text-[9.5px] text-slate-500 font-mono mt-1 px-1">
                      {msg.timestamp}
                    </span>

                    {/* Follow-up Suggestion Chips */}
                    {isBot && msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2 pl-9">
                        {msg.suggestions.map((s, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(s)}
                            className="px-2.5 py-1 rounded-xl bg-[#0D1A2C] hover:bg-amber-400/20 text-slate-300 hover:text-amber-300 border border-white/[0.08] hover:border-amber-400/30 text-[10px] font-mono transition-all text-left"
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
                  className="flex items-center gap-2 text-slate-400 pl-2"
                >
                  <div className="w-7 h-7 rounded-xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-xs">
                    🤖
                  </div>
                  <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-[#091424] border border-white/[0.08]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse delay-150" />
                    <span className="text-[10px] text-slate-400 ml-1">NaviBot is thinking…</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT FOOTER ─────────────────────────────────────── */}
            <div className="p-3 sm:p-4 bg-[#050C17] border-t border-white/[0.08] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSend()
                }}
                className="flex items-center gap-2 bg-[#081324] border border-white/[0.1] rounded-2xl p-1.5 focus-within:border-amber-400/50 transition-colors shadow-inner"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask NaviBot (e.g. flights to Mumbai, PNR status)..."
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none font-mono"
                />

                {/* Voice Input Mic Button */}
                <button
                  type="button"
                  onClick={handleVoiceInput}
                  className={`p-2 rounded-xl border transition-all ${
                    isListening
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                      : "bg-white/[0.04] text-slate-400 hover:text-white border-white/[0.06]"
                  }`}
                  title="Speak to NaviBot (Voice Search)"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" />
                  </svg>
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition-all disabled:opacity-40 disabled:hover:bg-amber-400"
                  title="Send message"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                </button>
              </form>

              <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 mt-2 px-1">
                <span>NaviBot Flight AI v2.4</span>
                <span>Powered by Navigo Telemetry</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
