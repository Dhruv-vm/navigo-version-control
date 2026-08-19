"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async () => {
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Login failed")
        setLoading(false)
        return
      }

      localStorage.setItem("token", data.token)
      if (data.isAdmin || data.role) {
        localStorage.setItem("navigo_admin_session", JSON.stringify(data.admin || data.user))
        router.push("/admin")
      } else {
        router.push("/")
      }
    } catch (err) {
      setError("Something went wrong")
    }

    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin()
  }

  return (
    <div className="relative min-h-screen text-white overflow-hidden font-sans">
      {/* BACKGROUND */}
      <img
        src="/login-bg.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* OVERLAY */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#020617]/95 via-[#020617]/70 to-[#020617]/40" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_75%_50%,rgba(56,189,248,0.08),transparent)]" />

      <div className="relative z-10 flex min-h-screen">
        {/* LEFT SIDE */}
        <div className="hidden lg:flex w-1/2 flex-col justify-center px-16 xl:px-20">
          <div className="flex items-center gap-2.5 mb-8 animate-[fadeInUp_0.6s_ease-out]">
            <img
              src="/logo.png"
              alt="Navigo"
              className="h-14 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-[0.25em]">NAVIGO</h1>
              <p className="text-sm tracking-wide bg-gradient-to-r from-blue-400 via-cyan-300 to-amber-300 text-transparent bg-clip-text font-medium">
                Your Journey, Simplified
              </p>
            </div>
          </div>

          <h1 className="text-5xl xl:text-6xl font-bold leading-[1.05] max-w-xl tracking-tight animate-[fadeInUp_0.7s_ease-out_0.1s_both]">
            Every journey
            <br />
            begins with{" "}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-amber-300 text-transparent bg-clip-text">
              Navigo
            </span>
          </h1>

          <p className="mt-5 text-slate-300/90 text-base max-w-md animate-[fadeInUp_0.7s_ease-out_0.2s_both]">
            Smart booking. Dynamic pricing. Personalized for you.
          </p>

          <div className="mt-7 space-y-3 animate-[fadeInUp_0.7s_ease-out_0.3s_both]">
            {[
              { icon: "✈", text: "Smart Booking", sub: "AI finds best flights" },
              { icon: "💺", text: "Comfort First", sub: "choose your seat" },
              { icon: "🔒", text: "Secure & Reliable", sub: "your data is safe" },
            ].map((item) => (
              <div
                key={item.text}
                className="flex w-fit items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] pl-3.5 pr-6 py-2.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-cyan-400/15 to-amber-300/20 border border-white/10 text-[15px]">
                  {item.icon}
                </span>
                <p className="text-sm text-slate-200">
                  <span className="font-semibold text-white">{item.text}</span>
                  <span className="text-slate-400"> — {item.sub}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400 animate-[fadeInUp_0.7s_ease-out_0.4s_both]">
            <div className="flex -space-x-2.5">
              {["from-blue-400 to-cyan-300", "from-cyan-300 to-emerald-300", "from-amber-300 to-orange-400"].map(
                (grad, i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-full border-2 border-[#020617] bg-gradient-to-br ${grad} shadow-[0_0_0_1px_rgba(255,255,255,0.08)]`}
                  />
                )
              )}
            </div>
            <span>
              <span className="text-white font-semibold">2M+</span> travelers trust Navigo
            </span>
          </div>
        </div>

        {/* RIGHT CARD */}
        <div className="w-full lg:w-1/2 flex items-center justify-center px-6 lg:pr-16 xl:pr-20 py-10">
          <div
            className="w-full max-w-md
            bg-white/[0.06] backdrop-blur-2xl
            border border-white/10
            rounded-3xl p-8 sm:p-10
            shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7),0_8px_24px_-8px_rgba(0,0,0,0.5)]
            ring-1 ring-white/5
            relative
            before:content-[''] before:absolute before:inset-0 before:-z-10 before:rounded-3xl
            before:bg-gradient-to-br before:from-cyan-400/10 before:via-transparent before:to-amber-300/10
            before:blur-2xl before:scale-105
            animate-[fadeInUp_0.6s_ease-out_0.1s_both]"
          >
            {/* mobile logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-8">
              <img
                src="/logo.png"
                alt="Navigo"
                className="h-9 w-auto object-contain"
              />
              <span className="text-sm font-bold tracking-[0.25em]">NAVIGO</span>
            </div>

            <h2 className="text-3xl font-bold mb-1.5 tracking-tight">Welcome back</h2>
            <p className="text-slate-400 mb-8 text-[15px]">
              Login to continue your journey
            </p>

            {/* EMAIL */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                Email or phone number
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10
                text-[15px] placeholder:text-slate-500
                outline-none transition-all duration-200
                focus:border-cyan-400/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>

            {/* PASSWORD */}
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-black/30 border border-white/10
                  text-[15px] placeholder:text-slate-500
                  outline-none transition-all duration-200
                  focus:border-cyan-400/60 focus:bg-black/40 focus:ring-4 focus:ring-cyan-400/10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="flex items-center gap-2 -mt-3 mb-5 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* OPTIONS */}
            <div className="flex justify-between items-center text-sm mb-7">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  className="peer sr-only"
                />
                <span className="h-[18px] w-[18px] shrink-0 rounded-[5px] border border-white/25 bg-black/30 flex items-center justify-center peer-checked:bg-cyan-400 peer-checked:border-cyan-400 transition-colors">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#020617" strokeWidth="3.5" className="opacity-0 peer-checked:opacity-100">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                Remember me
              </label>

              <span
                className="text-cyan-300 cursor-pointer hover:text-cyan-200 hover:underline underline-offset-2 transition-colors"
                onClick={() => router.push("/forgot-password")}
              >
                Forgot password?
              </span>
            </div>

            {/* LOGIN */}
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-[15px]
              bg-gradient-to-r from-blue-500 via-cyan-400 to-amber-300
              text-[#020617]
              shadow-[0_4px_20px_-4px_rgba(56,189,248,0.5)]
              hover:shadow-[0_6px_28px_-4px_rgba(56,189,248,0.65)]
              hover:brightness-105
              active:scale-[0.98]
              disabled:opacity-60 disabled:pointer-events-none
              transition-all duration-200
              flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Logging in...
                </>
              ) : (
                <>
                  Login
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </>
              )}
            </button>

            {/* DIVIDER */}
            <div className="flex items-center my-7">
              <div className="flex-1 h-px bg-white/15" />
              <span className="px-3 text-slate-500 text-xs tracking-wide">OR CONTINUE WITH</span>
              <div className="flex-1 h-px bg-white/15" />
            </div>

            {/* SOCIAL */}
            <div className="flex gap-3">
              <button className="flex-1 py-3.5 rounded-xl bg-white/[0.06] border border-white/15 hover:bg-white/[0.12] hover:border-white/25 hover:shadow-[0_4px_16px_-4px_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 text-sm font-semibold">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24z"/>
                  <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38l4.01-3.1z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.62l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75z"/>
                </svg>
                Google
              </button>

              <button className="flex-1 py-3.5 rounded-xl bg-white/[0.06] border border-white/15 hover:bg-white/[0.12] hover:border-white/25 hover:shadow-[0_4px_16px_-4px_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2.5 text-sm font-semibold">
                <svg width="16" height="16" viewBox="0 0 384 512" fill="currentColor">
                  <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 0 184.4 0 273c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-57.7-90-57.7-91.4zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
                </svg>
                Apple
              </button>
            </div>

            {/* SIGNUP */}
            <p className="text-center text-sm text-slate-400 mt-7">
              Don't have an account?{" "}
              <span
                className="text-cyan-300 hover:text-cyan-200 cursor-pointer font-medium hover:underline underline-offset-2 transition-colors"
                onClick={() => router.push("/signup")}
              >
                Sign up
              </span>
            </p>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500 mt-4">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              256-bit encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}