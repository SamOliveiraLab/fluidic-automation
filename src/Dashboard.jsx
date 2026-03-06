import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ─────────────────────────────────────────────
   REAL DATA from Bukola's Pioreactors
   Sampled every ~5 min from the full 4-hour session
───────────────────────────────────────────── */
const OD_DATA = [
  {t:"23:48",r01:0.2069,r02:0.00526},{t:"23:53",r01:0.2069,r02:0.00527},
  {t:"23:58",r01:0.2069,r02:0.00527},{t:"00:03",r01:0.2071,r02:0.00528},
  {t:"00:08",r01:0.2071,r02:0.00527},{t:"00:13",r01:0.2071,r02:0.00525},
  {t:"00:18",r01:0.2072,r02:0.00525},{t:"00:23",r01:0.2072,r02:0.00525},
  {t:"00:28",r01:0.2073,r02:0.00526},{t:"00:33",r01:0.2073,r02:0.00526},
  {t:"00:38",r01:0.2073,r02:0.00525},{t:"00:43",r01:0.2073,r02:0.00527},
  {t:"00:48",r01:0.2073,r02:0.00526},{t:"00:53",r01:0.2073,r02:0.00527},
  {t:"00:58",r01:0.2074,r02:0.00527},{t:"01:03",r01:0.2075,r02:0.00526},
  {t:"01:08",r01:0.2075,r02:0.00527},{t:"01:13",r01:0.2074,r02:0.00527},
  {t:"01:18",r01:0.2075,r02:0.00528},{t:"01:23",r01:0.2075,r02:0.00525},
  {t:"01:28",r01:0.2076,r02:0.00527},{t:"01:33",r01:0.2075,r02:0.00526},
  {t:"01:38",r01:0.2075,r02:0.00525},{t:"01:43",r01:0.2074,r02:0.00527},
  {t:"01:48",r01:0.2073,r02:0.00524},{t:"01:53",r01:0.2073,r02:0.00526},
  {t:"01:58",r01:0.2074,r02:0.00526},{t:"02:03",r01:0.2074,r02:0.00525},
  {t:"02:08",r01:0.2074,r02:0.00525},{t:"02:13",r01:0.2073,r02:0.00525},
  {t:"02:18",r01:0.2073,r02:0.00525},{t:"02:23",r01:0.2072,r02:0.00524},
  {t:"02:28",r01:0.2072,r02:0.00524},{t:"02:33",r01:0.2070,r02:0.00524},
  {t:"02:38",r01:0.2062,r02:0.00525},{t:"02:43",r01:0.2061,r02:0.00524},
  {t:"02:48",r01:0.2061,r02:0.00525},{t:"02:53",r01:0.2061,r02:0.00524},
  {t:"02:58",r01:0.2061,r02:0.00523},{t:"03:03",r01:0.2061,r02:0.00524},
  {t:"03:08",r01:0.2061,r02:0.00525},{t:"03:13",r01:0.2061,r02:0.00526},
  {t:"03:18",r01:0.2060,r02:0.00525},{t:"03:23",r01:0.2060,r02:0.00526},
  {t:"03:28",r01:0.2056,r02:0.00525},{t:"03:33",r01:0.2059,r02:0.00525},
  {t:"03:38",r01:0.2059,r02:0.00526},{t:"03:43",r01:0.2059,r02:0.00526},
  {t:"03:48",r01:0.2058,r02:0.00525},
];

const REACTORS = [
  { id: "oliveirapioreactor01", label: "Reactor 01", role: "Leader + Worker", status: "online", model: "40mL v1.5", added: "Oct 1, 2025" },
  { id: "oliveirapioreactor02", label: "Reactor 02", role: "Worker", status: "online", model: "40mL v1.5", added: "Mar 5, 2026" },
  { id: "oliveirapioreactor03", label: "Reactor 03", role: "Worker", status: "warning", model: "40mL v1.5", added: "Mar 5, 2026" },
  { id: "oliveirapioreactor04", label: "Reactor 04", role: "Worker", status: "offline", model: "40mL v1.5", added: "Mar 5, 2026" },
];

/* ─────────────────────────────────────────────
   THEME SYSTEM
───────────────────────────────────────────── */
const themes = {
  light: {
    bg: "#f5f1eb",
    bgAlt: "#ece7df",
    surface: "#fffdf9",
    surfaceHover: "#faf7f2",
    border: "#ddd5c9",
    borderLight: "#e8e2d8",
    text: "#2c2418",
    textSecondary: "#7a6f60",
    textMuted: "#a89d8e",
    accent: "#0d5c63",
    accentLight: "#e6f2f3",
    accentSoft: "#1a8a94",
    warning: "#c4841d",
    warningBg: "#fdf3e3",
    danger: "#b83a3a",
    dangerBg: "#fce8e8",
    success: "#2d7a4f",
    successBg: "#e8f5ee",
    chartLine1: "#0d5c63",
    chartFill1: "#0d5c6318",
    chartLine2: "#c4841d",
    chartFill2: "#c4841d18",
    gridLine: "#e8e2d810",
    dotGrid: "#d4cdc2",
    comingSoonBg: "#f0ece5",
    comingSoonBorder: "#ddd5c9",
    comingSoonText: "#a89d8e",
    modalOverlay: "rgba(44,36,24,0.5)",
    shadow: "0 1px 3px rgba(44,36,24,0.06), 0 6px 16px rgba(44,36,24,0.04)",
    shadowHover: "0 2px 8px rgba(44,36,24,0.08), 0 12px 28px rgba(44,36,24,0.06)",
  },
  dark: {
    bg: "#151820",
    bgAlt: "#1c2029",
    surface: "#1e2230",
    surfaceHover: "#252a3a",
    border: "#2a3040",
    borderLight: "#232838",
    text: "#e2dfd8",
    textSecondary: "#8a8578",
    textMuted: "#5c5850",
    accent: "#4ec9b0",
    accentLight: "#4ec9b015",
    accentSoft: "#3da894",
    warning: "#e0a64a",
    warningBg: "#e0a64a12",
    danger: "#e06060",
    dangerBg: "#e0606012",
    success: "#5cb87a",
    successBg: "#5cb87a12",
    chartLine1: "#4ec9b0",
    chartFill1: "#4ec9b018",
    chartLine2: "#e0a64a",
    chartFill2: "#e0a64a18",
    gridLine: "#2a304020",
    dotGrid: "#2a3040",
    comingSoonBg: "#1a1e28",
    comingSoonBorder: "#2a3040",
    comingSoonText: "#5c5850",
    modalOverlay: "rgba(0,0,0,0.65)",
    shadow: "0 1px 3px rgba(0,0,0,0.2), 0 6px 16px rgba(0,0,0,0.15)",
    shadowHover: "0 2px 8px rgba(0,0,0,0.25), 0 12px 28px rgba(0,0,0,0.2)",
  },
};

/* ─────────────────────────────────────────────
   COMPONENTS
───────────────────────────────────────────── */

const StatusDot = ({ status, th }) => {
  const colors = {
    online: th.success,
    warning: th.warning,
    offline: th.danger,
  };
  const c = colors[status] || th.textMuted;
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: c,
      boxShadow: status === "online" ? `0 0 6px ${c}80` : "none",
    }} />
  );
};

const ComingSoonCard = ({ title, description, icon, th }) => (
  <div style={{
    background: th.comingSoonBg,
    border: `1.5px dashed ${th.comingSoonBorder}`,
    borderRadius: 14,
    padding: "28px 24px",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
  }}>
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
      backgroundImage: `radial-gradient(${th.comingSoonBorder} 1px, transparent 1px)`,
      backgroundSize: "20px 20px",
      opacity: 0.3,
    }} />
    <div style={{ position: "relative" }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{
        display: "inline-block",
        fontSize: 10, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase",
        color: th.accent, background: th.accentLight,
        padding: "4px 12px", borderRadius: 20, marginBottom: 12,
      }}>
        Coming Soon
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: th.text }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: th.textMuted, lineHeight: 1.6 }}>{description}</p>
    </div>
  </div>
);

const InterpretationModal = ({ isOpen, onClose, th, data }) => {
  const [interpretation, setInterpretation] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setInterpretation("");
      const timer = setTimeout(() => {
        setInterpretation(
          `Both reactors are currently running with sterile water — no biological organisms are present.\n\n` +
          `Reactor 01 (OD ~0.206–0.208) shows a stable baseline with a notable downward drift beginning around 02:30 UTC, dropping from ~0.2075 to ~0.2058. This is not biological — it's almost certainly caused by ambient temperature cooling in the room. As water cools, its refractive index changes slightly, which shifts the optical density reading. This is normal and expected for an overnight run without temperature control.\n\n` +
          `Reactor 02 (OD ~0.005) is reading near-zero, confirming very clear water with minimal light scatter. The extremely low and stable signal suggests this reactor's optical path is well-calibrated.\n\n` +
          `Key takeaway: Both sensors are working correctly and producing clean, low-noise baseline data. When you introduce a microbial culture (like yeast in YPD medium), you'll see Reactor 01's OD begin climbing from this ~0.207 baseline — expect it to rise to 0.5–1.5 over 8–24 hours depending on the organism and conditions.\n\n` +
          `The temperature-driven OD drift you see in Reactor 01 is actually useful data — it tells you that for precise measurements, you should run the Temperature Automation to hold a constant temperature. This eliminates thermal noise from your OD readings.`
        );
        setLoading(false);
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: th.modalOverlay,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: th.surface,
          borderRadius: 18,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
          border: `1px solid ${th.border}`,
          boxShadow: th.shadowHover,
        }}
      >
        <div style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${th.borderLight}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>🧬</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: th.text }}>
                Biological Interpretation
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: th.textMuted }}>AI analysis of current OD readings</p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: th.bgAlt, border: `1px solid ${th.border}`,
              borderRadius: 8, width: 32, height: 32,
              cursor: "pointer", fontSize: 16, color: th.textSecondary,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >×</button>
        </div>
        <div style={{ padding: "20px 24px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                border: `3px solid ${th.borderLight}`,
                borderTopColor: th.accent,
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px",
              }} />
              <p style={{ color: th.textMuted, fontSize: 13 }}>Analyzing reactor data...</p>
            </div>
          ) : (
            <div style={{
              fontFamily: '"Newsreader", Georgia, serif',
              fontSize: 14.5, lineHeight: 1.85,
              color: th.textSecondary,
              whiteSpace: "pre-wrap",
            }}>
              {interpretation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChartTooltip = ({ active, payload, label, th }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: th.surface, border: `1px solid ${th.border}`,
      borderRadius: 10, padding: "10px 14px",
      boxShadow: th.shadow, fontSize: 12,
    }}>
      <div style={{ color: th.textMuted, marginBottom: 6, fontWeight: 600 }}>{label} UTC</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 3, background: p.color }} />
          <span style={{ color: th.textSecondary }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: th.text, fontFamily: "'JetBrains Mono', monospace" }}>
            {p.value?.toFixed(6)}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
export default function PioreactorDashboard() {
  const [mode, setMode] = useState("light");
  const [showSettings, setShowSettings] = useState(false);
  const [showInterpretation, setShowInterpretation] = useState(false);
  const [activeChartReactor, setActiveChartReactor] = useState("both");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const th = themes[mode];
  const onlineCount = REACTORS.filter(r => r.status === "online").length;

  const navItems = [
    { id: "overview", icon: "◉", label: "Overview" },
    { id: "od", icon: "◎", label: "OD Readings" },
    { id: "temp", icon: "◈", label: "Temperature" },
    { id: "pumps", icon: "⬡", label: "Pump Control" },
    { id: "alerts", icon: "△", label: "Alerts" },
  ];
  const [activePage, setActivePage] = useState("overview");

  return (
    <div style={{
      fontFamily: '"Outfit", "Segoe UI", sans-serif',
      background: th.bg,
      minHeight: "100vh",
      color: th.text,
      transition: "background 0.3s, color 0.3s",
      position: "relative",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Dot grid background */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `radial-gradient(${th.dotGrid} 1px, transparent 1px)`,
        backgroundSize: "24px 24px", opacity: 0.5,
      }} />

      {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 90,
            background: th.modalOverlay,
          }}
        />
      )}

      {/* ─── SIDEBAR ─── */}
      <div style={{
        position: "fixed", top: 0, left: 0, bottom: 0,
        width: 220, zIndex: 100,
        background: th.surface,
        borderRight: `1px solid ${th.border}`,
        padding: "20px 0",
        display: "flex", flexDirection: "column",
        transform: sidebarOpen ? "translateX(0)" : (typeof window !== "undefined" && window.innerWidth < 768 ? "translateX(-100%)" : "translateX(0)"),
        transition: "transform 0.3s ease",
        boxShadow: sidebarOpen ? th.shadowHover : "none",
      }}>
        {/* Logo */}
        <div style={{ padding: "0 20px", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: `linear-gradient(135deg, ${th.accent}, ${th.accentSoft})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, fontWeight: 800,
            }}>P</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: th.text, letterSpacing: "-0.01em" }}>
                Pioreactor
              </div>
              <div style={{ fontSize: 10, color: th.textMuted, fontWeight: 500 }}>Lab Dashboard</div>
            </div>
          </div>
        </div>

        {/* Cluster badge */}
        <div style={{
          margin: "0 16px 20px", padding: "10px 14px",
          background: th.successBg, borderRadius: 10,
          border: `1px solid ${th.success}25`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <StatusDot status="online" th={th} />
            <span style={{ fontSize: 12, fontWeight: 600, color: th.success }}>
              {onlineCount} of {REACTORS.length} Online
            </span>
          </div>
          <div style={{ fontSize: 10, color: th.textMuted, marginTop: 4 }}>
            Demo experiment · 3747h
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: "0 10px" }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActivePage(item.id); setSidebarOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: activePage === item.id ? th.accentLight : "transparent",
                border: "none", borderRadius: 9,
                cursor: "pointer", marginBottom: 2,
                color: activePage === item.id ? th.accent : th.textSecondary,
                fontWeight: activePage === item.id ? 600 : 500,
                fontSize: 13, textAlign: "left",
                transition: "all 0.15s",
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 14, width: 20, textAlign: "center", opacity: 0.7 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Settings toggle */}
        <div style={{ padding: "0 10px", borderTop: `1px solid ${th.borderLight}`, paddingTop: 16 }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "100%", padding: "10px 14px",
              background: showSettings ? th.bgAlt : "transparent",
              border: "none", borderRadius: 9,
              cursor: "pointer",
              color: th.textSecondary, fontSize: 13, fontWeight: 500,
              textAlign: "left", fontFamily: "inherit",
            }}
          >
            <span style={{ fontSize: 14, width: 20, textAlign: "center", opacity: 0.7 }}>⚙</span>
            Settings
          </button>

          {showSettings && (
            <div style={{ padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: th.textMuted, fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Appearance
              </div>
              <div style={{
                display: "flex", borderRadius: 8, overflow: "hidden",
                border: `1px solid ${th.border}`,
              }}>
                {["light", "dark"].map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    style={{
                      flex: 1, padding: "8px 0",
                      background: mode === m ? th.accent : th.bgAlt,
                      color: mode === m ? "#fff" : th.textMuted,
                      border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      fontFamily: "inherit",
                      textTransform: "capitalize",
                    }}
                  >
                    {m === "light" ? "☀ " : "☽ "}{m}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT ─── */}
      <div style={{
        marginLeft: typeof window !== "undefined" && window.innerWidth < 768 ? 0 : 220,
        minHeight: "100vh",
        position: "relative", zIndex: 1,
        transition: "margin-left 0.3s",
      }}>

        {/* Top bar */}
        <div style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${th.borderLight}`,
          background: `${th.surface}e0`,
          backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Mobile hamburger */}
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                display: typeof window !== "undefined" && window.innerWidth < 768 ? "flex" : "none",
                alignItems: "center", justifyContent: "center",
                width: 36, height: 36, borderRadius: 9,
                background: th.bgAlt, border: `1px solid ${th.border}`,
                cursor: "pointer", fontSize: 18, color: th.textSecondary,
              }}
            >☰</button>
            <div>
              <h1 style={{
                margin: 0, fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", color: th.text,
              }}>
                {navItems.find(n => n.id === activePage)?.label || "Overview"}
              </h1>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              padding: "6px 12px", borderRadius: 8,
              background: th.bgAlt, border: `1px solid ${th.border}`,
              fontSize: 11, color: th.textMuted, fontWeight: 500,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>

        {/* ─── PAGE: OVERVIEW ─── */}
        {activePage === "overview" && (
          <div style={{ padding: "24px" }}>
            {/* Reactor Cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 14, marginBottom: 28,
            }}>
              {REACTORS.map(r => (
                <div key={r.id} style={{
                  background: th.surface,
                  border: `1px solid ${th.border}`,
                  borderRadius: 14,
                  padding: "18px 20px",
                  boxShadow: th.shadow,
                  transition: "box-shadow 0.2s, transform 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {r.status === "offline" && (
                    <div style={{
                      position: "absolute", inset: 0, background: `${th.bg}90`,
                      zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 14, backdropFilter: "blur(2px)",
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: th.danger, background: th.dangerBg, padding: "6px 14px", borderRadius: 8 }}>
                        EXCLUDED
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <StatusDot status={r.status} th={th} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: th.text }}>{r.label}</span>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: th.accent,
                        background: th.accentLight,
                        padding: "2px 8px", borderRadius: 5,
                      }}>{r.role}</span>
                    </div>
                    <span style={{
                      fontSize: 10, color: th.textMuted, fontWeight: 500,
                      background: th.bgAlt, padding: "3px 8px", borderRadius: 6,
                    }}>{r.model}</span>
                  </div>
                  <div style={{ fontSize: 11, color: th.textMuted }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: th.textSecondary }}>
                      {r.id}
                    </span>
                  </div>
                  {r.status === "warning" && (
                    <div style={{
                      marginTop: 12, padding: "8px 10px", borderRadius: 8,
                      background: th.warningBg, border: `1px solid ${th.warning}20`,
                      fontSize: 11, color: th.warning, fontWeight: 500,
                    }}>
                      ⚠ Photodiode cables swapped + stir bar check needed
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* OD Chart */}
            <div style={{
              background: th.surface,
              border: `1px solid ${th.border}`,
              borderRadius: 16,
              boxShadow: th.shadow,
              marginBottom: 20,
              overflow: "hidden",
            }}>
              {/* Chart header */}
              <div style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${th.borderLight}`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 12,
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: th.text }}>
                    Optical Density (OD)
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: th.textMuted }}>
                    90° scatter · {OD_DATA.length} readings · ~4 hours
                  </p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  {["both","r01","r02"].map(f => (
                    <button
                      key={f}
                      onClick={() => setActiveChartReactor(f)}
                      style={{
                        padding: "6px 12px", borderRadius: 7,
                        background: activeChartReactor === f ? th.accent : th.bgAlt,
                        color: activeChartReactor === f ? "#fff" : th.textMuted,
                        border: `1px solid ${activeChartReactor === f ? th.accent : th.border}`,
                        cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                      }}
                    >
                      {f === "both" ? "Both" : f === "r01" ? "R-01" : "R-02"}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowInterpretation(true)}
                    style={{
                      padding: "6px 14px", borderRadius: 7,
                      background: "transparent",
                      border: `1.5px solid ${th.accent}50`,
                      color: th.accent,
                      cursor: "pointer", fontSize: 11, fontWeight: 700,
                      fontFamily: "inherit",
                      display: "flex", alignItems: "center", gap: 5,
                    }}
                  >
                    🧬 Interpret
                  </button>
                </div>
              </div>

              {/* Chart body */}
              <div style={{ padding: "16px 10px 8px 0" }}>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={OD_DATA} margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fill01" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={th.chartLine1} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={th.chartLine1} stopOpacity={0.01} />
                      </linearGradient>
                      <linearGradient id="fill02" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={th.chartLine2} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={th.chartLine2} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={th.gridLine} />
                    <XAxis
                      dataKey="t" tick={{ fontSize: 10, fill: th.textMuted }}
                      axisLine={{ stroke: th.border }} tickLine={false} interval={5}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10, fill: th.textMuted }}
                      axisLine={{ stroke: th.border }} tickLine={false} width={58}
                      tickFormatter={(v) => v < 0.01 ? v.toFixed(4) : v.toFixed(3)}
                    />
                    <Tooltip content={<ChartTooltip th={th} />} />
                    {(activeChartReactor === "both" || activeChartReactor === "r01") && (
                      <Area
                        type="monotone" dataKey="r01" name="Reactor 01"
                        stroke={th.chartLine1} fill="url(#fill01)"
                        strokeWidth={2.5} dot={false}
                      />
                    )}
                    {(activeChartReactor === "both" || activeChartReactor === "r02") && (
                      <Area
                        type="monotone" dataKey="r02" name="Reactor 02"
                        stroke={th.chartLine2} fill="url(#fill02)"
                        strokeWidth={2.5} dot={false}
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Quick stats row */}
              <div style={{
                padding: "14px 22px", borderTop: `1px solid ${th.borderLight}`,
                display: "flex", gap: 24, flexWrap: "wrap",
              }}>
                {[
                  { label: "R-01 Current", value: "0.2058", color: th.chartLine1 },
                  { label: "R-02 Current", value: "0.0053", color: th.chartLine2 },
                  { label: "R-01 Δ (4h)", value: "−0.0011", color: th.danger },
                  { label: "R-02 Δ (4h)", value: "−0.0001", color: th.textMuted },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 10, color: th.textMuted, fontWeight: 600, marginBottom: 2 }}>{s.label}</div>
                    <div style={{
                      fontSize: 16, fontWeight: 700, color: s.color,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming soon grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 14,
            }}>
              <ComingSoonCard
                icon="🌡️" title="Temperature Monitoring"
                description="Live temperature graphs with target tracking. Start Temperature Automation to activate."
                th={th}
              />
              <ComingSoonCard
                icon="🔄" title="Stirring (RPM)"
                description="Real-time stirring speed monitoring and stir bar health detection."
                th={th}
              />
              <ComingSoonCard
                icon="📈" title="Growth Rate"
                description="Calculated doubling time and growth phase detection. Requires active culture."
                th={th}
              />
            </div>
          </div>
        )}

        {/* ─── PAGE: OD ─── */}
        {activePage === "od" && (
          <div style={{ padding: "24px" }}>
            <div style={{
              background: th.surface, border: `1px solid ${th.border}`,
              borderRadius: 16, boxShadow: th.shadow, overflow: "hidden",
            }}>
              <div style={{
                padding: "18px 22px", borderBottom: `1px solid ${th.borderLight}`,
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: th.text }}>Optical Density — Detailed View</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: th.textMuted }}>Full dataset · Both reactors</p>
                </div>
                <button
                  onClick={() => setShowInterpretation(true)}
                  style={{
                    padding: "8px 16px", borderRadius: 9,
                    background: th.accent, border: "none",
                    color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >🧬 What does this mean?</button>
              </div>

              {/* R01 chart */}
              <div style={{ padding: "20px 22px 8px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: th.chartLine1, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: th.chartLine1 }} />
                  Reactor 01 — oliveirapioreactor01
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={OD_DATA} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fill01b" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={th.chartLine1} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={th.chartLine1} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={th.gridLine} />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} interval={5} />
                    <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} width={55} tickFormatter={v=>v.toFixed(3)} />
                    <Tooltip content={<ChartTooltip th={th} />} />
                    <Area type="monotone" dataKey="r01" name="Reactor 01" stroke={th.chartLine1} fill="url(#fill01b)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* R02 chart */}
              <div style={{ padding: "12px 22px 16px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: th.chartLine2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 12, height: 3, borderRadius: 2, background: th.chartLine2 }} />
                  Reactor 02 — oliveirapioreactor02
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={OD_DATA} margin={{ top: 5, right: 10, left: 8, bottom: 5 }}>
                    <defs>
                      <linearGradient id="fill02b" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={th.chartLine2} stopOpacity={0.15} />
                        <stop offset="100%" stopColor={th.chartLine2} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={th.gridLine} />
                    <XAxis dataKey="t" tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} interval={5} />
                    <YAxis domain={["auto","auto"]} tick={{ fontSize: 10, fill: th.textMuted }} axisLine={false} tickLine={false} width={55} tickFormatter={v=>v.toFixed(4)} />
                    <Tooltip content={<ChartTooltip th={th} />} />
                    <Area type="monotone" dataKey="r02" name="Reactor 02" stroke={th.chartLine2} fill="url(#fill02b)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─── PAGE: TEMPERATURE ─── */}
        {activePage === "temp" && (
          <div style={{ padding: "24px" }}>
            <ComingSoonCard
              icon="🌡️" title="Temperature Monitoring"
              description="Start Temperature Automation on your reactors to see live temperature data here. This works with water — set the thermostat to 30°C and watch the heating curve appear."
              th={th}
            />
          </div>
        )}

        {/* ─── PAGE: PUMPS ─── */}
        {activePage === "pumps" && (
          <div style={{ padding: "24px" }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}>
              <ComingSoonCard
                icon="💧" title="Media Pump"
                description="Controls fresh nutrient delivery into each reactor. Connect pump to PWM channel 2 and calibrate to activate."
                th={th}
              />
              <ComingSoonCard
                icon="🗑️" title="Waste Pump"
                description="Removes used media from reactors. Connect pump to PWM channel 4 and calibrate to activate."
                th={th}
              />
              <ComingSoonCard
                icon="🧪" title="Alt-Media Pump"
                description="Delivers alternative nutrients or chemicals. Connect pump to PWM channel 3 and calibrate to activate."
                th={th}
              />
              <ComingSoonCard
                icon="📜" title="Dosing Event Log"
                description="Complete history of every pump action — when, how much, which reactor. Requires active pumps."
                th={th}
              />
            </div>

            {/* Pump setup guide */}
            <div style={{
              marginTop: 20, padding: "20px 24px",
              background: th.surface, border: `1px solid ${th.border}`,
              borderRadius: 14, boxShadow: th.shadow,
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: th.text }}>
                How to activate pumps
              </h3>
              <div style={{ fontSize: 13, color: th.textSecondary, lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 10px" }}>
                  <strong style={{ color: th.text }}>1.</strong> Physically connect peristaltic pumps to PWM channels on the Pioreactor HAT
                </p>
                <p style={{ margin: "0 0 10px" }}>
                  <strong style={{ color: th.text }}>2.</strong> Break them in — run continuously for 10 min with water to loosen tubing
                </p>
                <p style={{ margin: "0 0 10px" }}>
                  <strong style={{ color: th.text }}>3.</strong> Calibrate via SSH:{" "}
                  <code style={{
                    background: th.bgAlt, padding: "2px 8px", borderRadius: 5,
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: th.accent,
                  }}>pio calibrations run --device media_pump</code>
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: th.text }}>4.</strong> Start a dosing automation (Turbidostat or Chemostat) from the Pioreactor UI
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── PAGE: ALERTS ─── */}
        {activePage === "alerts" && (
          <div style={{ padding: "24px" }}>
            <ComingSoonCard
              icon="🔔" title="Smart Alerts"
              description="Configure thresholds for temperature, OD, and pump failures. Get notified when something needs attention. Define rules like 'if temp > 38°C, alert' or 'if OD drops 20% in 1 hour, alert'."
              th={th}
            />
            <div style={{ marginTop: 14 }}>
              <ComingSoonCard
                icon="🔮" title="Digital Twin"
                description="A computational model that mirrors your real bioreactor. It predicts what will happen next based on current trends and physics. This is the long-term grant and paper territory — the foundation (this dashboard) is already built."
                th={th}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: "20px 24px",
          borderTop: `1px solid ${th.borderLight}`,
          textAlign: "center",
          fontSize: 11,
          color: th.textMuted,
        }}>
          Oliveira Lab · Pioreactor Dashboard v0.1 · Built by Bukola · {new Date().getFullYear()}
        </div>
      </div>

      {/* Biological Interpretation Modal */}
      <InterpretationModal
        isOpen={showInterpretation}
        onClose={() => setShowInterpretation(false)}
        th={th}
        data={OD_DATA}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${th.border}; border-radius: 3px; }
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
