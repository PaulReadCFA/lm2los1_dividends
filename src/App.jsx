import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

/**
 * CFA Institute – Quantitative Methods: LOS 1
 * 1) Coupon Bond Cash Flows & Price
 * 2) Mortgage Amortization (stacked Interest + Principal)
 * 3) Dividend Discount Models (no growth, Gordon, two-stage)
 */

const CHART_MARGINS = { top: 8, right: 12, left: 72, bottom: 36 };

// ---- CFA palette & helpers ----
const CFA = { primary: "#4476FF", dark: "#06005A" };
const fmtUSD = (x) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

/* -------------------------------------------------------------------------- */
/*                             Compact calculator UI                           */
/* -------------------------------------------------------------------------- */

const Card = ({ title, children }) => (
  <section className="bg-white rounded-2xl shadow-md border border-gray-200">
    <header className="px-6 pt-6 pb-3 border-b border-gray-100">
      <h2 className="text-2xl font-georgia text-cfa-dark">{title}</h2>
    </header>
    <div className="p-6">{children}</div>
  </section>
);

// Label left, compact input(s) right
const InlineRow = ({ label, children }) => (
  <div className="flex items-center gap-4 py-1.5">
    <label className="grow text-sm font-arial text-gray-700">{label}</label>
    <div className="shrink-0 flex items-center gap-2">{children}</div>
  </div>
);

// Base input: fixed width, readable text/caret
const InputBase = ({ className = "", style, ...props }) => (
  <input
    {...props}
    className={
      "shrink-0 w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 " +
      "text-right text-sm text-gray-900 caret-cfa-blue font-arial shadow-sm " +
      "focus:outline-none focus:ring-2 focus:ring-cfa-blue/40 focus:border-cfa-blue " +
      className
    }
    style={{ width: "8rem", ...style }}
  />
);

// Handles $/% adornment without blocking caret; adds padding automatically
function InputWithAdorn({ left, right, inputClassName = "", ...props }) {
  const padLeft = left ? "pl-6" : "";
  const padRight = right ? "pr-8" : ""; // reserve space so text/caret never sit under adorn
  return (
    <div className="relative shrink-0">
      {left && (
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-gray-500 text-sm font-arial">
          {left}
        </span>
      )}
      <InputBase {...props} className={`${padLeft} ${padRight} ${inputClassName}`} />
      {right && (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-500 text-sm font-arial">
          {right}
        </span>
      )}
    </div>
  );
}

// Currency ($ shown, stores raw number)
function CurrencyField({ value, onChange }) {
  const display = Number.isFinite(value) ? value.toFixed(2) : "";
  return (
    <InputWithAdorn
      left="$"
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        e.target.value = Number.isFinite(v) ? v.toFixed(2) : "0.00";
        onChange(Number.isFinite(v) ? v : 0);
      }}
      placeholder="0.00"
    />
  );
}

// Percent (% shown, stores decimal 0–1)
function PercentField({ value, onChange }) {
  const display = Number.isFinite(value) ? (value * 100).toFixed(2) : "";
  return (
    <InputWithAdorn
      right="%"
      type="text"
      inputMode="decimal"
      value={display}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v / 100 : 0);
      }}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        e.target.value = Number.isFinite(v) ? v.toFixed(2) : "0.00";
        onChange(Number.isFinite(v) ? v / 100 : 0);
      }}
      placeholder="0.00"
    />
  );
}

// Integer years / frequency
function IntField({ value, onChange }) {
  const display = Number.isFinite(value) ? String(value) : "";
  return (
    <InputBase
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={display}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      onBlur={(e) => {
        const v = parseInt(e.target.value, 10);
        e.target.value = Number.isFinite(v) ? String(v) : "0";
        onChange(Number.isFinite(v) ? v : 0);
      }}
      placeholder="0"
    />
  );
}

/* -------------------------------------------------------------------------- */
/*                                Calculations                                */
/* -------------------------------------------------------------------------- */



// Dividend cash flows + values
function buildDividendSeries({ D0 = 5, required = 0.1, gConst = 0.05, gShort = 0.05, gLong = 0.03, shortYears = 5, horizonYears = 10 }) {
  const constGrowth = [];
  let Dt = D0 * (1 + gConst);
  for (let t = 1; t <= horizonYears; t++) {
    if (t > 1) Dt *= 1 + gConst;
    constGrowth.push({ year: t, constGrow: Dt });
  }
  const twoStage = [];
  Dt = D0 * (1 + gShort);
  for (let t = 1; t <= horizonYears; t++) {
    if (t > 1) {
      const g = t <= shortYears ? gShort : gLong;
      Dt *= 1 + g;
    }
    twoStage.push({ year: t, twoStage: Dt });
  }
  const data = Array.from({ length: horizonYears }, (_, idx) => ({
    year: idx + 1,
    constDiv: D0,
    constGrow: constGrowth[idx].constGrow,
    twoStage: twoStage[idx].twoStage,
  }));

  const priceNoGrowth = D0 / required;
  const priceGordon = gConst < required ? (D0 * (1 + gConst)) / (required - gConst) : NaN;

  const cf1 = Array.from({ length: shortYears }, (_, k) =>
    (D0 * Math.pow(1 + gShort, k + 1)) / Math.pow(1 + required, k + 1)
  ).reduce((a, b) => a + b, 0);

  const D_T1 = D0 * Math.pow(1 + gShort, shortYears) * (1 + gLong);
  const TV = gLong < required ? D_T1 / (required - gLong) : NaN;
  const pvTV = TV / Math.pow(1 + required, shortYears);
  const priceTwoStage = cf1 + pvTV;

  return { data, priceNoGrowth, priceGordon, priceTwoStage };
}

/* -------------------------------------------------------------------------- */
/*                                   App                                      */
/* -------------------------------------------------------------------------- */

export default function App() {

  // Dividend state
  const [D0, setD0] = useState(5);
  const [req, setReq] = useState(0.1);
  const [gConst, setGConst] = useState(0.05);
  const [gShort, setGShort] = useState(0.05);
  const [gLong, setGLong] = useState(0.03);
  const [shortYears, setShortYears] = useState(5);
  const divs = useMemo(() => buildDividendSeries({ D0, required: req, gConst, gShort, gLong, shortYears, horizonYears: 10 }), [D0, req, gConst, gShort, gLong, shortYears]);



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}


      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* 1) Bonds */}
   

        {/* 3) Dividends */}
        <Card title="Dividend Discount Models">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="font-georgia text-cfa-blue mb-2">Inputs</h3>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <InlineRow label="Current Dividend, D₀"><CurrencyField value={D0} onChange={setD0} /></InlineRow>
                <InlineRow label="Required Return (r)"><PercentField value={req} onChange={setReq} /></InlineRow>
                <InlineRow label="Constant Growth g"><PercentField value={gConst} onChange={setGConst} /></InlineRow>
                <InlineRow label="Short-Term g₁"><PercentField value={gShort} onChange={setGShort} /></InlineRow>
                <InlineRow label="Long-Term g₂"><PercentField value={gLong} onChange={setGLong} /></InlineRow>
                <InlineRow label="Short-Term Years (T)"><IntField value={shortYears} onChange={setShortYears} /></InlineRow>

                <div className="h-px bg-gray-200 my-3" />
                <div className="text-sm text-gray-700 font-arial space-y-1">
                  <p><strong>No-growth price:</strong> {fmtUSD(divs.priceNoGrowth)}</p>
                  <p><strong>Gordon price:</strong> {isNaN(divs.priceGordon) ? <span className="text-red-600">Requires g &lt; r</span> : fmtUSD(divs.priceGordon)}</p>
                  <p><strong>Two-stage price:</strong> {isNaN(divs.priceTwoStage) ? <span className="text-red-600">Requires g₂ &lt; r</span> : fmtUSD(divs.priceTwoStage)}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <div style={{ height: 320 }}>
<ResponsiveContainer width="100%" height="100%">
  <BarChart data={divs.data} margin={CHART_MARGINS}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="year" tickMargin={8} label={{ value: "Years (first 10)", position: "insideBottom", offset: -20 }} />
    <YAxis tickFormatter={fmtUSD} width={80} />
    <Tooltip formatter={(v) => fmtUSD(v)} contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb" }} />
    <Legend verticalAlign="top" align="right" height={36} wrapperStyle={{ paddingBottom: 6 }} />
    <Bar dataKey="constDiv"  name="Constant Dividend" fill={CFA.dark} />
    <Bar dataKey="constGrow" name="Constant Growth"  fill={CFA.primary} />
    <Bar dataKey="twoStage"  name="Two‑Stage Growth" fill="#9CA3AF" />
  </BarChart>
</ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-600 mt-2 font-arial">
                  Cash flow comparison for three dividend assumptions. Valuations at left follow standard DDM formulae.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
