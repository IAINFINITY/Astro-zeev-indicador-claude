import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";

// ═══════════════════════════════════════════════════════════════
// CONFIGURAÇÃO SUPABASE — ALTERE AQUI
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = "https://jpkdgpkkyhibihawkhjw.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impwa2RncGtreWhpYmloYXdraGp3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTMyOTk0NCwiZXhwIjoyMDM0OTA1OTQ0fQ.4zLxnS9ZuTBgAvw6AWLkJ4UuEh88NFAtd3vC5cEqZOM";

const supabaseFetch = async (endpoint, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
};

// ═══════════════════════════════════════════════════════════════
// USUÁRIOS E CREDENCIAIS (Em produção, use Supabase Auth)
// ═══════════════════════════════════════════════════════════════
const USERS = [
  { username: "admin", password: "admin123", role: "superadmin", name: "Administrador" },
  { username: "viewer", password: "viewer123", role: "viewer", name: "Visualizador" },
];

// ═══════════════════════════════════════════════════════════════
// FÓRMULAS EDITÁVEIS (Python-like syntax)
// ═══════════════════════════════════════════════════════════════
const DEFAULT_FORMULAS = {
  qtd_solicitacoes: {
    label: "Quantidade de Solicitações",
    syntax: "len( set( dados.map(r => r.id).filter(Boolean) ) )",
    description: "Conta IDs únicos de solicitações",
    fn: (dados) => new Set(dados.map((r) => r.id).filter(Boolean)).size,
  },
  qtd_tarefas: {
    label: "Quantidade de Tarefas",
    syntax: "len( dados )",
    description: "Conta total de registros (tarefas)",
    fn: (dados) => dados.length,
  },
  qtd_ontime: {
    label: "Quantidade de Tarefas onTime",
    syntax: 'len( dados.filter(r => r.instanceTasks_onTime === true) )',
    description: "Conta tarefas onde onTime é verdadeiro",
    fn: (dados) => dados.filter((r) => r.instanceTasks_onTime === true).length,
  },
  taxa_ontime: {
    label: "Taxa de Tarefas onTime",
    syntax: "( qtd_ontime / (qtd_ontime + qtd_atrasadas) ) * 100",
    description: "Percentual de tarefas no prazo sobre o total com status definido",
    fn: (dados) => {
      const onTime = dados.filter((r) => r.instanceTasks_onTime === true).length;
      const atrasadas = dados.filter((r) => r.instanceTasks_onTime === false).length;
      const total = onTime + atrasadas;
      return total > 0 ? ((onTime / total) * 100).toFixed(1) : "0.0";
    },
  },
  qtd_atrasadas: {
    label: "Quantidade de Tarefas Atrasadas",
    syntax: 'len( dados.filter(r => r.instanceTasks_onTime === false) )',
    description: "Conta tarefas onde onTime é falso",
    fn: (dados) => dados.filter((r) => r.instanceTasks_onTime === false).length,
  },
  taxa_atrasadas: {
    label: "Taxa de Tarefas Atrasadas",
    syntax: "( qtd_atrasadas / (qtd_ontime + qtd_atrasadas) ) * 100",
    description: "Percentual de tarefas atrasadas sobre o total com status definido",
    fn: (dados) => {
      const onTime = dados.filter((r) => r.instanceTasks_onTime === true).length;
      const atrasadas = dados.filter((r) => r.instanceTasks_onTime === false).length;
      const total = onTime + atrasadas;
      return total > 0 ? ((atrasadas / total) * 100).toFixed(1) : "0.0";
    },
  },
  qtd_ontime_null: {
    label: "Quantidade de onTime null",
    syntax: "len( dados.filter(r => r.instanceTasks_onTime === null) )",
    description: "Conta tarefas sem status onTime definido",
    fn: (dados) => dados.filter((r) => r.instanceTasks_onTime == null).length,
  },
};

// ═══════════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════════
const ACCENT = "rgb(246, 91, 0)";
const ACCENT_LIGHT = "rgba(246, 91, 0, 0.08)";
const ACCENT_MID = "rgba(246, 91, 0, 0.15)";
const BG = "#FAFAF8";
const CARD_BG = "#FFFFFF";
const TEXT = "#1A1A1A";
const TEXT_SEC = "#6B6B6B";
const BORDER = "#E8E8E4";
const GREEN = "#2D9D5C";
const RED = "#D94444";
const BLUE = "#3B82F6";
const YELLOW = "#F5A623";

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

body, #root {
  font-family: 'DM Sans', sans-serif;
  background: ${BG};
  color: ${TEXT};
  min-height: 100vh;
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #CCC; border-radius: 3px; }

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 2000px; }
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-in { animation: fadeInUp 0.4s ease-out forwards; }
.fade-in { animation: fadeIn 0.3s ease-out forwards; }
`;

// ═══════════════════════════════════════════════════════════════
// COMPONENTES UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════
const Spinner = () => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
    <div style={{
      width: 36, height: 36, border: `3px solid ${BORDER}`,
      borderTopColor: ACCENT, borderRadius: "50%",
      animation: "pulse 1s ease-in-out infinite"
    }} />
  </div>
);

const Badge = ({ children, color = ACCENT }) => (
  <span style={{
    display: "inline-block", padding: "2px 10px", borderRadius: 20,
    fontSize: 11, fontWeight: 600, background: `${color}18`, color,
    letterSpacing: 0.3,
  }}>{children}</span>
);

// ═══════════════════════════════════════════════════════════════
// MULTI-SELECT DROPDOWN
// ═══════════════════════════════════════════════════════════════
const MultiSelect = ({ label, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (val) => {
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);
  };

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 180 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "8px 12px", border: `1px solid ${BORDER}`,
        borderRadius: 8, background: CARD_BG, cursor: "pointer",
        fontSize: 13, fontFamily: "'DM Sans'", textAlign: "left",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        color: selected.length > 0 ? TEXT : TEXT_SEC,
      }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "85%" }}>
          {selected.length > 0 ? `${label} (${selected.length})` : label}
        </span>
        <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 999,
          background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 8,
          marginTop: 4, maxHeight: 240, overflowY: "auto",
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}>
          {selected.length > 0 && (
            <button onClick={() => onChange([])} style={{
              width: "100%", padding: "8px 12px", border: "none", borderBottom: `1px solid ${BORDER}`,
              background: "transparent", cursor: "pointer", fontSize: 12,
              color: ACCENT, fontWeight: 600, textAlign: "left", fontFamily: "'DM Sans'",
            }}>Limpar seleção</button>
          )}
          {options.map((opt) => (
            <label key={opt} style={{
              display: "flex", alignItems: "center", padding: "8px 12px", gap: 8,
              cursor: "pointer", fontSize: 13, transition: "0.15s",
              background: selected.includes(opt) ? ACCENT_LIGHT : "transparent",
            }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                style={{ accentColor: ACCENT }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt || "(vazio)"}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DATE RANGE PICKER
// ═══════════════════════════════════════════════════════════════
const DateRangePicker = ({ startDate, endDate, onStartChange, onEndChange, onClear }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)}
      style={{
        padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 8,
        fontSize: 13, fontFamily: "'DM Sans'", background: CARD_BG, color: TEXT,
        outline: "none",
      }} />
    <span style={{ color: TEXT_SEC, fontSize: 13 }}>até</span>
    <input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)}
      style={{
        padding: "8px 12px", border: `1px solid ${BORDER}`, borderRadius: 8,
        fontSize: 13, fontFamily: "'DM Sans'", background: CARD_BG, color: TEXT,
        outline: "none",
      }} />
    {(startDate || endDate) && (
      <button onClick={onClear} style={{
        padding: "8px 12px", border: `1px solid ${ACCENT}`, borderRadius: 8,
        background: "transparent", color: ACCENT, cursor: "pointer",
        fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans'",
      }}>Limpar</button>
    )}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// MODAL DE EXTRATIFICAÇÃO
// ═══════════════════════════════════════════════════════════════
const DrilldownModal = ({ title, data, columns, onClose }) => {
  const [page, setPage] = useState(0);
  const perPage = 15;
  const totalPages = Math.ceil(data.length / perPage);
  const pageData = data.slice(page * perPage, (page + 1) * perPage);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease-out",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: CARD_BG, borderRadius: 16, width: "90%", maxWidth: 1100,
        maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h3>
            <p style={{ fontSize: 13, color: TEXT_SEC, marginTop: 2 }}>{data.length} registros</p>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: "50%", border: "none",
            background: ACCENT_LIGHT, color: ACCENT, cursor: "pointer",
            fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        <div style={{ overflow: "auto", flex: 1, padding: "0 24px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{
                    padding: "12px 10px", textAlign: "left", fontWeight: 600,
                    borderBottom: `2px solid ${BORDER}`, whiteSpace: "nowrap",
                    position: "sticky", top: 0, background: CARD_BG, fontSize: 12,
                    color: TEXT_SEC, textTransform: "uppercase", letterSpacing: 0.5,
                  }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{
                      padding: "10px 10px", maxWidth: 250, overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{
            padding: "12px 24px", borderTop: `1px solid ${BORDER}`,
            display: "flex", justifyContent: "center", alignItems: "center", gap: 12,
          }}>
            <button disabled={page === 0} onClick={() => setPage(page - 1)}
              style={{
                padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`,
                background: page === 0 ? "#F5F5F5" : CARD_BG, cursor: page === 0 ? "default" : "pointer",
                fontSize: 13, fontFamily: "'DM Sans'",
              }}>← Anterior</button>
            <span style={{ fontSize: 13, color: TEXT_SEC }}>{page + 1} de {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}
              style={{
                padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`,
                background: page >= totalPages - 1 ? "#F5F5F5" : CARD_BG,
                cursor: page >= totalPages - 1 ? "default" : "pointer",
                fontSize: 13, fontFamily: "'DM Sans'",
              }}>Próxima →</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SCORECARD
// ═══════════════════════════════════════════════════════════════
const Scorecard = ({ label, value, suffix = "", icon, color = ACCENT, onClick, delay = 0 }) => (
  <button onClick={onClick} style={{
    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14,
    padding: "22px 24px", cursor: "pointer", textAlign: "left",
    transition: "all 0.25s cubic-bezier(0.4,0,0.2,1)",
    animation: `fadeInUp 0.5s ease-out ${delay}ms both`,
    position: "relative", overflow: "hidden", width: "100%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.08)";
      e.currentTarget.style.borderColor = color;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
      e.currentTarget.style.borderColor = BORDER;
    }}
  >
    <div style={{
      position: "absolute", top: 0, left: 0, right: 0, height: 3,
      background: `linear-gradient(90deg, ${color}, ${color}88)`,
    }} />
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <p style={{ fontSize: 12, color: TEXT_SEC, fontWeight: 500, marginBottom: 8, letterSpacing: 0.3 }}>
          {label}
        </p>
        <p style={{ fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1 }}>
          {value}<span style={{ fontSize: 16, color: TEXT_SEC, fontWeight: 500, marginLeft: 2 }}>{suffix}</span>
        </p>
      </div>
      <div style={{
        width: 42, height: 42, borderRadius: 12, background: `${color}12`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
      }}>{icon}</div>
    </div>
    <p style={{ fontSize: 11, color: ACCENT, marginTop: 12, fontWeight: 500 }}>
      Clique para detalhes →
    </p>
  </button>
);

// ═══════════════════════════════════════════════════════════════
// CHART CARD WRAPPER
// ═══════════════════════════════════════════════════════════════
const ChartCard = ({ title, subtitle, children, delay = 0 }) => (
  <div style={{
    background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14,
    padding: 24, animation: `fadeInUp 0.5s ease-out ${delay}ms both`,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  }}>
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{title}</h3>
      {subtitle && <p style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>{subtitle}</p>}
    </div>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════
// CUSTOM TOOLTIP
// ═══════════════════════════════════════════════════════════════
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1A1A1A", borderRadius: 10, padding: "12px 16px",
      boxShadow: "0 8px 30px rgba(0,0,0,0.25)", border: "none",
    }}>
      <p style={{ fontSize: 12, color: "#AAA", marginBottom: 6, fontWeight: 500 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 13, color: p.color || "#FFF", fontWeight: 600, lineHeight: 1.6 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString("pt-BR") : p.value}
          {p.name?.includes("Taxa") ? "%" : ""}
        </p>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PÁGINA DE LOGIN
// ═══════════════════════════════════════════════════════════════
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setLoading(true);
    setError("");
    setTimeout(() => {
      const user = USERS.find((u) => u.username === username && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError("Credenciais inválidas");
      }
      setLoading(false);
    }, 600);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${BG} 0%, #F0EDE8 100%)`,
    }}>
      <div style={{
        background: CARD_BG, borderRadius: 20, padding: 44, width: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)", border: `1px solid ${BORDER}`,
        animation: "fadeInUp 0.6s ease-out",
      }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, background: ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: 24, color: "#FFF", fontWeight: 700,
          }}>Z</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>Zeev Dashboard</h1>
          <p style={{ fontSize: 13, color: TEXT_SEC, marginTop: 6 }}>Painel de indicadores</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, display: "block", marginBottom: 6 }}>
              Usuário
            </label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Digite seu usuário"
              style={{
                width: "100%", padding: "12px 14px", border: `1px solid ${BORDER}`,
                borderRadius: 10, fontSize: 14, fontFamily: "'DM Sans'",
                outline: "none", transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => e.target.style.borderColor = ACCENT}
              onBlur={(e) => e.target.style.borderColor = BORDER}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: TEXT_SEC, display: "block", marginBottom: 6 }}>
              Senha
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Digite sua senha"
              style={{
                width: "100%", padding: "12px 14px", border: `1px solid ${BORDER}`,
                borderRadius: 10, fontSize: 14, fontFamily: "'DM Sans'",
                outline: "none", transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => e.target.style.borderColor = ACCENT}
              onBlur={(e) => e.target.style.borderColor = BORDER}
            />
          </div>
          {error && (
            <p style={{
              color: RED, fontSize: 13, textAlign: "center",
              padding: "8px 12px", background: `${RED}10`, borderRadius: 8,
            }}>{error}</p>
          )}
          <button onClick={handleSubmit} disabled={loading}
            style={{
              padding: "13px 0", border: "none", borderRadius: 10,
              background: loading ? `${ACCENT}88` : ACCENT, color: "#FFF",
              fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans'",
              cursor: loading ? "wait" : "pointer", marginTop: 6,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => !loading && (e.target.style.background = "#E05200")}
            onMouseLeave={(e) => !loading && (e.target.style.background = ACCENT)}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: TEXT_SEC, textAlign: "center", marginTop: 20 }}>
          admin / admin123 (superadmin) · viewer / viewer123
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PAINEL SUPERADMIN — EDITOR DE FÓRMULAS
// ═══════════════════════════════════════════════════════════════
const FormulaEditor = ({ formulas, onSave }) => {
  const [editing, setEditing] = useState(null);
  const [tempSyntax, setTempSyntax] = useState("");

  const startEdit = (key) => {
    setEditing(key);
    setTempSyntax(formulas[key].syntax);
  };

  const save = (key) => {
    onSave(key, tempSyntax);
    setEditing(null);
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 17, fontWeight: 700 }}>Editor de Fórmulas</h3>
        <p style={{ fontSize: 13, color: TEXT_SEC, marginTop: 4 }}>
          Edite a sintaxe Python-like das fórmulas dos indicadores. As funções são executadas em JavaScript.
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.entries(formulas).map(([key, f]) => (
          <div key={key} style={{
            background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
            padding: 18, transition: "border-color 0.2s",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</p>
                <p style={{ fontSize: 12, color: TEXT_SEC, marginTop: 2 }}>{f.description}</p>
              </div>
              {editing !== key ? (
                <button onClick={() => startEdit(key)} style={{
                  padding: "6px 14px", borderRadius: 6, border: `1px solid ${ACCENT}`,
                  background: "transparent", color: ACCENT, cursor: "pointer",
                  fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans'",
                }}>Editar</button>
              ) : (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => save(key)} style={{
                    padding: "6px 14px", borderRadius: 6, border: "none",
                    background: GREEN, color: "#FFF", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, fontFamily: "'DM Sans'",
                  }}>Salvar</button>
                  <button onClick={() => setEditing(null)} style={{
                    padding: "6px 14px", borderRadius: 6, border: `1px solid ${BORDER}`,
                    background: "transparent", color: TEXT_SEC, cursor: "pointer",
                    fontSize: 12, fontFamily: "'DM Sans'",
                  }}>Cancelar</button>
                </div>
              )}
            </div>
            {editing === key ? (
              <textarea value={tempSyntax} onChange={(e) => setTempSyntax(e.target.value)}
                style={{
                  width: "100%", marginTop: 12, padding: 14, border: `2px solid ${ACCENT}`,
                  borderRadius: 8, fontSize: 13, fontFamily: "'JetBrains Mono'",
                  background: "#1A1A1A", color: "#E8E8E8", minHeight: 80,
                  outline: "none", resize: "vertical", boxSizing: "border-box",
                  lineHeight: 1.6,
                }} />
            ) : (
              <code style={{
                display: "block", marginTop: 10, padding: 12, borderRadius: 8,
                background: "#F5F5F2", fontSize: 12, fontFamily: "'JetBrains Mono'",
                color: "#555", lineHeight: 1.5, overflowX: "auto",
              }}>{f.syntax}</code>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// PAINEL SUPERADMIN — LOGS
// ═══════════════════════════════════════════════════════════════
const LogsPanel = ({ logs }) => (
  <div>
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 17, fontWeight: 700 }}>Logs de Acesso</h3>
      <p style={{ fontSize: 13, color: TEXT_SEC, marginTop: 4 }}>
        Registro de todos os acessos ao dashboard
      </p>
    </div>
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#F8F8F6" }}>
            {["Data/Hora", "Usuário", "Role", "Ação"].map((h) => (
              <th key={h} style={{
                padding: "12px 16px", textAlign: "left", fontWeight: 600,
                fontSize: 11, color: TEXT_SEC, textTransform: "uppercase",
                letterSpacing: 0.5, borderBottom: `1px solid ${BORDER}`,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && (
            <tr><td colSpan={4} style={{ padding: 30, textAlign: "center", color: TEXT_SEC }}>
              Nenhum log registrado
            </td></tr>
          )}
          {logs.slice().reverse().map((log, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
              <td style={{ padding: "10px 16px", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono'", fontSize: 12 }}>
                {log.timestamp}
              </td>
              <td style={{ padding: "10px 16px", fontWeight: 500 }}>{log.username}</td>
              <td style={{ padding: "10px 16px" }}>
                <Badge color={log.role === "superadmin" ? ACCENT : BLUE}>{log.role}</Badge>
              </td>
              <td style={{ padding: "10px 16px", color: TEXT_SEC }}>{log.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════
// APLICAÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [formulas, setFormulas] = useState(DEFAULT_FORMULAS);
  const [activePage, setActivePage] = useState("dashboard");
  const [drilldown, setDrilldown] = useState(null);

  // Filtros
  const [filterFlowName, setFilterFlowName] = useState([]);
  const [filterExecutor, setFilterExecutor] = useState([]);
  const [filterTaskResult, setFilterTaskResult] = useState([]);
  const [filterFlowResult, setFilterFlowResult] = useState([]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const addLog = useCallback((username, role, action) => {
    const now = new Date();
    const ts = now.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
    setLogs((prev) => [...prev, { timestamp: ts, username, role, action }]);
  }, []);

  const handleLogin = (u) => {
    setUser(u);
    addLog(u.username, u.role, "Login realizado");
  };

  const handleLogout = () => {
    addLog(user.username, user.role, "Logout realizado");
    setUser(null);
    setActivePage("dashboard");
  };

  // Fetch data from Supabase
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const fetchAll = async () => {
      try {
        let allData = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const batch = await supabaseFetch(
            `astro_zeev_instances?select=*&offset=${offset}&limit=${limit}`,
            { headers: { "Range-Unit": "items", Range: `${offset}-${offset + limit - 1}` } }
          );
          allData = [...allData, ...batch];
          hasMore = batch.length === limit;
          offset += limit;
        }

        setRawData(allData);
        addLog(user.username, user.role, `Dados carregados: ${allData.length} registros`);
      } catch (err) {
        console.error(err);
        setError(
          `Erro ao conectar ao Supabase. Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no código. Detalhes: ${err.message}`
        );
        addLog(user.username, user.role, "Falha na conexão com Supabase");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user, addLog]);

  // Derive filter options from raw data
  const filterOptions = useMemo(() => ({
    flowNames: [...new Set(rawData.map((r) => r.flow_name).filter(Boolean))].sort(),
    executors: [...new Set(rawData.map((r) => r.instanceTasks_executor_name).filter(Boolean))].sort(),
    taskResults: [...new Set(rawData.map((r) => r.instanceTasks_result).filter(Boolean))].sort(),
    flowResults: [...new Set(rawData.map((r) => r.flowResult).filter(Boolean))].sort(),
  }), [rawData]);

  // Apply filters
  const filteredData = useMemo(() => {
    return rawData.filter((row) => {
      if (filterFlowName.length > 0 && !filterFlowName.includes(row.flow_name)) return false;
      if (filterExecutor.length > 0 && !filterExecutor.includes(row.instanceTasks_executor_name)) return false;
      if (filterTaskResult.length > 0 && !filterTaskResult.includes(row.instanceTasks_result)) return false;
      if (filterFlowResult.length > 0 && !filterFlowResult.includes(row.flowResult)) return false;
      if (dateStart || dateEnd) {
        const rowDate = row.startDateTime ? new Date(row.startDateTime) : null;
        if (!rowDate) return false;
        if (dateStart && rowDate < new Date(dateStart)) return false;
        if (dateEnd && rowDate > new Date(dateEnd + "T23:59:59")) return false;
      }
      return true;
    });
  }, [rawData, filterFlowName, filterExecutor, filterTaskResult, filterFlowResult, dateStart, dateEnd]);

  // Compute scorecards
  const scorecards = useMemo(() => {
    const f = formulas;
    return {
      qtd_solicitacoes: f.qtd_solicitacoes.fn(filteredData),
      qtd_tarefas: f.qtd_tarefas.fn(filteredData),
      qtd_ontime: f.qtd_ontime.fn(filteredData),
      taxa_ontime: f.taxa_ontime.fn(filteredData),
      qtd_atrasadas: f.qtd_atrasadas.fn(filteredData),
      taxa_atrasadas: f.taxa_atrasadas.fn(filteredData),
      qtd_ontime_null: f.qtd_ontime_null.fn(filteredData),
    };
  }, [filteredData, formulas]);

  // Chart 1: By date (startDateTime)
  const chartByDate = useMemo(() => {
    const map = {};
    filteredData.forEach((row) => {
      if (!row.startDateTime) return;
      const d = new Date(row.startDateTime).toISOString().split("T")[0];
      if (!map[d]) map[d] = { date: d, onTime: 0, atrasadas: 0 };
      if (row.instanceTasks_onTime === true) map[d].onTime++;
      else if (row.instanceTasks_onTime === false) map[d].atrasadas++;
    });
    return Object.values(map)
      .map((r) => ({
        ...r,
        taxa: r.onTime + r.atrasadas > 0 ? +((r.atrasadas / (r.onTime + r.atrasadas)) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.onTime - a.onTime);
  }, [filteredData]);

  // Chart 2: By executor
  const chartByExecutor = useMemo(() => {
    const map = {};
    filteredData.forEach((row) => {
      const ex = row.instanceTasks_executor_name || "(Sem executor)";
      if (!map[ex]) map[ex] = { executor: ex, onTime: 0, atrasadas: 0 };
      if (row.instanceTasks_onTime === true) map[ex].onTime++;
      else if (row.instanceTasks_onTime === false) map[ex].atrasadas++;
    });
    return Object.values(map)
      .map((r) => ({
        ...r,
        taxa: r.onTime + r.atrasadas > 0 ? +((r.atrasadas / (r.onTime + r.atrasadas)) * 100).toFixed(1) : 0,
      }))
      .sort((a, b) => b.onTime - a.onTime);
  }, [filteredData]);

  // Chart 3: By flow_name
  const chartByFlow = useMemo(() => {
    const map = {};
    filteredData.forEach((row) => {
      const fn = row.flow_name || "(Sem nome)";
      if (!map[fn]) map[fn] = { flow: fn, count: 0, ids: new Set() };
      map[fn].ids.add(row.id);
    });
    return Object.values(map)
      .map((r) => ({ flow: r.flow, count: r.ids.size }))
      .sort((a, b) => b.count - a.count);
  }, [filteredData]);

  // Drilldown columns
  const drillCols = [
    { key: "id", label: "ID Solicitação" },
    { key: "flow_name", label: "Solicitação" },
    { key: "instanceTasks_task_name", label: "Tarefa" },
    { key: "instanceTasks_executor_name", label: "Responsável" },
    { key: "instanceTasks_onTime", label: "On Time", render: (v) => v === true ? "✓ Sim" : v === false ? "✗ Não" : "—" },
    { key: "instanceTasks_result", label: "Status Tarefa" },
    { key: "startDateTime", label: "Início", render: (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "—" },
    { key: "instanceTasks_leadTimeInDays", label: "Lead Time (dias)" },
  ];

  const openDrilldown = (type) => {
    let title, data;
    switch (type) {
      case "solicitacoes":
        title = "Extratificação — Solicitações";
        const uniqueIds = [...new Set(filteredData.map((r) => r.id))];
        data = uniqueIds.map((id) => filteredData.find((r) => r.id === id)).filter(Boolean);
        break;
      case "tarefas":
        title = "Extratificação — Todas as Tarefas";
        data = filteredData;
        break;
      case "ontime":
        title = "Extratificação — Tarefas On Time";
        data = filteredData.filter((r) => r.instanceTasks_onTime === true);
        break;
      case "taxa_ontime":
        title = "Extratificação — Tarefas On Time (Taxa)";
        data = filteredData.filter((r) => r.instanceTasks_onTime === true);
        break;
      case "atrasadas":
        title = "Extratificação — Tarefas Atrasadas";
        data = filteredData.filter((r) => r.instanceTasks_onTime === false);
        break;
      case "taxa_atrasadas":
        title = "Extratificação — Tarefas Atrasadas (Taxa)";
        data = filteredData.filter((r) => r.instanceTasks_onTime === false);
        break;
      case "null":
        title = "Extratificação — onTime Null";
        data = filteredData.filter((r) => r.instanceTasks_onTime == null);
        break;
      default:
        return;
    }
    setDrilldown({ title, data, columns: drillCols });
  };

  const updateFormulaSyntax = (key, newSyntax) => {
    setFormulas((prev) => ({
      ...prev,
      [key]: { ...prev[key], syntax: newSyntax },
    }));
    addLog(user.username, user.role, `Fórmula "${key}" atualizada`);
  };

  if (!user) return <><style>{css}</style><LoginPage onLogin={handleLogin} /></>;

  const isSuperAdmin = user.role === "superadmin";
  const activeFiltersCount = [filterFlowName, filterExecutor, filterTaskResult, filterFlowResult]
    .filter((f) => f.length > 0).length + (dateStart || dateEnd ? 1 : 0);

  return (
    <>
      <style>{css}</style>
      {drilldown && (
        <DrilldownModal title={drilldown.title} data={drilldown.data}
          columns={drilldown.columns} onClose={() => setDrilldown(null)} />
      )}

      {/* HEADER */}
      <header style={{
        background: CARD_BG, borderBottom: `1px solid ${BORDER}`,
        padding: "0 28px", height: 60, display: "flex", alignItems: "center",
        justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: ACCENT,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#FFF", fontSize: 15, fontWeight: 800,
          }}>Z</div>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -0.3 }}>Zeev Dashboard</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => { setActivePage("dashboard"); addLog(user.username, user.role, "Acessou Dashboard"); }}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "none",
              background: activePage === "dashboard" ? ACCENT : "transparent",
              color: activePage === "dashboard" ? "#FFF" : TEXT_SEC,
              fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'",
            }}>Dashboard</button>
          {isSuperAdmin && (
            <>
              <button onClick={() => { setActivePage("formulas"); addLog(user.username, user.role, "Acessou Editor de Fórmulas"); }}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: activePage === "formulas" ? ACCENT : "transparent",
                  color: activePage === "formulas" ? "#FFF" : TEXT_SEC,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'",
                }}>Fórmulas</button>
              <button onClick={() => { setActivePage("logs"); addLog(user.username, user.role, "Acessou Logs"); }}
                style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: activePage === "logs" ? ACCENT : "transparent",
                  color: activePage === "logs" ? "#FFF" : TEXT_SEC,
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'",
                }}>Logs</button>
            </>
          )}
          <div style={{ width: 1, height: 28, background: BORDER, margin: "0 8px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{user.name}</p>
              <p style={{ fontSize: 11, color: TEXT_SEC }}>{user.role}</p>
            </div>
            <button onClick={handleLogout} title="Sair" style={{
              width: 34, height: 34, borderRadius: 8, border: `1px solid ${BORDER}`,
              background: "transparent", cursor: "pointer", fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: TEXT_SEC, transition: "0.2s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = RED; e.currentTarget.style.color = RED; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SEC; }}
            >⏻</button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1320, margin: "0 auto", padding: "24px 28px 60px" }}>

        {/* SUPERADMIN PAGES */}
        {activePage === "formulas" && isSuperAdmin && (
          <div className="fade-in">
            <FormulaEditor formulas={formulas} onSave={updateFormulaSyntax} />
          </div>
        )}
        {activePage === "logs" && isSuperAdmin && (
          <div className="fade-in">
            <LogsPanel logs={logs} />
          </div>
        )}

        {/* DASHBOARD */}
        {activePage === "dashboard" && (
          <div className="fade-in">
            {/* FILTERS */}
            <div style={{
              background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 14,
              padding: "16px 20px", marginBottom: 24,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 14,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Filtros</span>
                {activeFiltersCount > 0 && (
                  <Badge color={ACCENT}>{activeFiltersCount} ativo{activeFiltersCount > 1 ? "s" : ""}</Badge>
                )}
              </div>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
              }}>
                <MultiSelect label="Solicitação" options={filterOptions.flowNames}
                  selected={filterFlowName} onChange={setFilterFlowName} />
                <MultiSelect label="Responsável" options={filterOptions.executors}
                  selected={filterExecutor} onChange={setFilterExecutor} />
                <MultiSelect label="Status Tarefa" options={filterOptions.taskResults}
                  selected={filterTaskResult} onChange={setFilterTaskResult} />
                <MultiSelect label="Status Solicitação" options={filterOptions.flowResults}
                  selected={filterFlowResult} onChange={setFilterFlowResult} />
                <DateRangePicker startDate={dateStart} endDate={dateEnd}
                  onStartChange={setDateStart} onEndChange={setDateEnd}
                  onClear={() => { setDateStart(""); setDateEnd(""); }}
                />
              </div>
            </div>

            {loading ? <Spinner /> : error && rawData.length === 0 ? (
              <div style={{
                background: `${RED}08`, border: `1px solid ${RED}30`, borderRadius: 12,
                padding: 24, textAlign: "center",
              }}>
                <p style={{ fontSize: 14, color: RED, fontWeight: 600, marginBottom: 6 }}>Erro de conexão</p>
                <p style={{ fontSize: 13, color: TEXT_SEC }}>{error}</p>
              </div>
            ) : (
              <>
                {/* SCORECARDS */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 14, marginBottom: 28,
                }}>
                  <Scorecard label="Solicitações" value={scorecards.qtd_solicitacoes}
                    icon="📋" color={BLUE} onClick={() => openDrilldown("solicitacoes")} delay={0} />
                  <Scorecard label="Tarefas" value={scorecards.qtd_tarefas}
                    icon="📝" color={TEXT} onClick={() => openDrilldown("tarefas")} delay={50} />
                  <Scorecard label="Tarefas On Time" value={scorecards.qtd_ontime}
                    icon="✅" color={GREEN} onClick={() => openDrilldown("ontime")} delay={100} />
                  <Scorecard label="Taxa On Time" value={scorecards.taxa_ontime} suffix="%"
                    icon="📊" color={GREEN} onClick={() => openDrilldown("taxa_ontime")} delay={150} />
                  <Scorecard label="Tarefas Atrasadas" value={scorecards.qtd_atrasadas}
                    icon="⚠" color={RED} onClick={() => openDrilldown("atrasadas")} delay={200} />
                  <Scorecard label="Taxa Atrasadas" value={scorecards.taxa_atrasadas} suffix="%"
                    icon="📉" color={RED} onClick={() => openDrilldown("taxa_atrasadas")} delay={250} />
                  <Scorecard label="onTime Null" value={scorecards.qtd_ontime_null}
                    icon="❓" color={YELLOW} onClick={() => openDrilldown("null")} delay={300} />
                </div>

                {/* CHART 1: By Date */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 20 }}>
                  <ChartCard title="Tarefas por Data" subtitle="Barras empilhadas (On Time / Atrasadas) + Linha (Taxa de Atrasos)" delay={350}>
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={chartByDate} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: TEXT_SEC }}
                          angle={-35} textAnchor="end" height={60} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: TEXT_SEC }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TEXT_SEC }}
                          domain={[0, 100]} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar yAxisId="left" dataKey="onTime" stackId="a" name="On Time"
                          fill={GREEN} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="left" dataKey="atrasadas" stackId="a" name="Atrasadas"
                          fill={RED} radius={[3, 3, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa de Atrasos"
                          stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }}
                          activeDot={{ r: 5, strokeWidth: 0 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
                  {/* CHART 2: By Executor */}
                  <ChartCard title="Tarefas por Responsável" subtitle="Barras empilhadas + Linha (Taxa de Atrasos)" delay={400}>
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={chartByExecutor} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                        <XAxis dataKey="executor" tick={{ fontSize: 10, fill: TEXT_SEC }}
                          angle={-35} textAnchor="end" height={80} interval={0} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: TEXT_SEC }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: TEXT_SEC }}
                          domain={[0, 100]} unit="%" />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Bar yAxisId="left" dataKey="onTime" stackId="a" name="On Time"
                          fill={GREEN} radius={[0, 0, 0, 0]} />
                        <Bar yAxisId="left" dataKey="atrasadas" stackId="a" name="Atrasadas"
                          fill={RED} radius={[3, 3, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="taxa" name="Taxa de Atrasos"
                          stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3, fill: ACCENT }}
                          activeDot={{ r: 5, strokeWidth: 0 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {/* CHART 3: By Flow */}
                  <ChartCard title="Solicitações por Tipo" subtitle="Quantidade de solicitações únicas por flow_name" delay={450}>
                    <ResponsiveContainer width="100%" height={340}>
                      <BarChart data={chartByFlow} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EEE" />
                        <XAxis dataKey="flow" tick={{ fontSize: 10, fill: TEXT_SEC }}
                          angle={-35} textAnchor="end" height={80} interval={0} />
                        <YAxis tick={{ fontSize: 11, fill: TEXT_SEC }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Solicitações" fill={ACCENT}
                          radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}
