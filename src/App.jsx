import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

// CFA-branded color palette
const COLORS = {
  primary: "#4476ff",
  dark: "#06005a",
  darkAlt: "#38337b",
  positive: "#6991ff",
  negative: "#ea792d",
  purple: "#7a46ff",
  purpleAlt: "#50037f",
  lightBlue: "#4476ff",
  orange: "#ea792d",
  darkText: "#06005a",
};

// Model configurations
const MODEL_CONFIG = {
  constant: {
    name: "Constant Dividend Model",
    color: "#2563eb",
    dataKey: "constDiv",
    description: "Assumes dividends remain constant forever.",
    formula: "P = D₀ ÷ r"
  },
  growth: {
    name: "Constant Growth Model", 
    color: "#16a34a",
    dataKey: "constGrow",
    description: "Assumes constant dividend growth rate forever.",
    formula: "P = D₁ ÷ (r - g)"
  },
  changing: {
    name: "Changing Growth Model",
    color: "#9333ea", 
    dataKey: "changingGrowth",
    description: "Assumes high growth initially, then lower sustainable growth.",
    formula: "PV high growth + Terminal value"
  }
};

function Card({ title, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-md p-5 border border-gray-100 ${className}`}>
      <h2 className="font-serif text-xl text-slate-800 mb-3">{title}</h2>
      <div className="font-sans text-sm text-black/80">{children}</div>
    </div>
  );
}

function InfoIcon({ children, id }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  return (
    <div className="relative inline-block ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-gray-400 text-white text-xs font-bold hover:bg-gray-500 focus:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        aria-describedby={`${id}-tooltip`}
        aria-label="More information"
      >
        ?
      </button>
      
      {showTooltip && (
        <div
          id={`${id}-tooltip`}
          role="tooltip"
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 max-w-xs"
        >
          {children}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
        </div>
      )}
    </div>
  );
}

function ValidationMessage({ errors }) {
  if (!errors || Object.keys(errors).length === 0) return null;
  
  return (
    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg" role="alert">
      <h3 className="text-red-800 font-semibold text-sm mb-2">Please correct the following:</h3>
      <ul className="text-red-800 text-sm space-y-1">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>• {error}</li>
        ))}
      </ul>
    </div>
  );
}

const fmtUSD = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);

function buildDividendSeries({ D0 = 5, required = 0.1, gConst = 0.05, gShort = 0.05, gLong = 0.03, shortYears = 5 }) {
  const horizonYears = 10;
  
  const errors = {};
  if (gConst >= required) errors.gConst = "Growth rate must be less than required return";
  if (gLong >= required) errors.gLong = "Long-term growth must be less than required return";
  if (D0 <= 0) errors.D0 = "Dividend must be positive";
  if (required <= 0) errors.required = "Required return must be positive";
  
  const priceNoGrowth = required > 0 ? D0 / required : NaN;
  const priceConstantGrowth = (gConst < required && gConst >= 0) ? (D0 * (1 + gConst)) / (required - gConst) : NaN;
  
  let priceChangingGrowth = NaN;
  if (gLong < required && gLong >= 0 && gShort >= 0) {
    let pvHighGrowth = 0;
    for (let t = 1; t <= shortYears; t++) {
      const dividend = D0 * Math.pow(1 + gShort, t);
      pvHighGrowth += dividend / Math.pow(1 + required, t);
    }
    
    const terminalDividend = D0 * Math.pow(1 + gShort, shortYears) * (1 + gLong);
    const terminalValue = terminalDividend / (required - gLong);
    const pvTerminalValue = terminalValue / Math.pow(1 + required, shortYears);
    
    priceChangingGrowth = pvHighGrowth + pvTerminalValue;
  }

  const data = [
    {
      year: 0,
      yearLabel: "0",
      constDiv: -priceNoGrowth,
      constGrow: isNaN(priceConstantGrowth) ? null : -priceConstantGrowth,
      changingGrowth: isNaN(priceChangingGrowth) ? null : -priceChangingGrowth,
    }
  ];

  for (let year = 1; year <= horizonYears; year++) {
    const constDiv = D0;
    const constGrow = isNaN(priceConstantGrowth) ? null : D0 * Math.pow(1 + gConst, year);
    
    let changingGrowthDiv = null;
    if (!isNaN(priceChangingGrowth)) {
      if (year <= shortYears) {
        changingGrowthDiv = D0 * Math.pow(1 + gShort, year);
      } else {
        changingGrowthDiv = D0 * Math.pow(1 + gShort, shortYears) * Math.pow(1 + gLong, year - shortYears);
      }
    }

    data.push({
      year,
      yearLabel: year.toString(),
      constDiv,
      constGrow,
      changingGrowth: changingGrowthDiv,
    });
  }

  return { data, priceNoGrowth, priceConstantGrowth, priceChangingGrowth, errors };
}

function ResultsSection({ results, selectedModel }) {
  if (!results || !results.data) return null;

  const getAllPrices = () => ({
    constant: results.priceNoGrowth,
    growth: results.priceConstantGrowth,
    changing: results.priceChangingGrowth
  });

  const currentModel = selectedModel === "all" ? null : MODEL_CONFIG[selectedModel];
  
  const getCurrentPrice = () => {
    if (selectedModel === "all") return null;
    switch(selectedModel) {
      case "constant": return results.priceNoGrowth;
      case "growth": return results.priceConstantGrowth;
      case "changing": return results.priceChangingGrowth;
      default: return NaN;
    }
  };

  return (
    <div className="space-y-6">
      {selectedModel === "all" ? (
        <>
          {Object.entries(MODEL_CONFIG).map(([key, model]) => {
            const price = getAllPrices()[key];
            return (
              <div key={key} className="p-4 rounded-lg border" style={{ backgroundColor: model.color + '20', borderColor: model.color }}>
                <div className="text-3xl font-serif mb-2" style={{ color: model.color }}>
                  {isFinite(price) ? fmtUSD(price) : "Invalid"}
                </div>
                <div className="text-sm text-gray-700">
                  <div><strong>{model.name}</strong></div>
                  <div className="text-xs mt-1">{model.formula}</div>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <>
          <div className="p-4 rounded-lg border" style={{ backgroundColor: currentModel.color + '20', borderColor: currentModel.color }}>
            <div className="text-3xl font-serif mb-2" style={{ color: currentModel.color }}>
              {isFinite(getCurrentPrice()) ? fmtUSD(getCurrentPrice()) : "Invalid"}
            </div>
            <div className="text-sm text-gray-700">
              <div><strong>{currentModel.name}</strong></div>
              <div className="text-xs mt-2">{currentModel.description}</div>
              <div className="text-xs mt-2 font-mono bg-white p-2 rounded border">{currentModel.formula}</div>
            </div>
          </div>
        </>
      )}

      {/* Model Equations */}
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="font-semibold mb-3 text-sm">Model Equations</div>
        <div className="space-y-2">
          {Object.entries(MODEL_CONFIG).map(([key, model]) => (
            <div key={key} className="text-xs p-2 rounded border-l-4" style={{ borderColor: model.color, backgroundColor: model.color + '10' }}>
              <div className="font-medium" style={{ color: model.color }}>{model.name}</div>
              <div className="font-mono mt-1 text-gray-700">{model.formula}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DividendChart({ results, selectedModel, D0, gConst, gShort, gLong, shortYears }) {
  if (!results || !results.data || results.data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
        <p className="text-gray-500">Adjust parameters to see cash flows</p>
      </div>
    );
  }

  const currentModel = selectedModel === "all" ? null : MODEL_CONFIG[selectedModel];

  return (
    <>
      {/* Debug info */}
      <div className="mb-2 text-xs text-gray-500">
        Data points: {results.data.length} | Selected: {selectedModel}
      </div>

      {/* Model Toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex rounded-lg overflow-hidden border border-gray-200">
          <button 
            className={`px-3 py-2 text-sm ${selectedModel === "all" ? "bg-gray-50 text-gray-700 font-semibold" : "bg-white text-gray-600"}`} 
            onClick={() => {}}
            disabled
          >
            Model: {selectedModel === "all" ? "All" : currentModel?.name.split(' ')[0]}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4">
        {selectedModel === "all" ? 
          "Showing: All dividend models for comparison" :
          `Showing: ${currentModel.name} - ${currentModel.description}`
        }
      </p>

      {/* Chart */}
      <div style={{ width: '100%', height: '450px' }} role="img" aria-labelledby="chart-title" aria-describedby="chart-description">
        <div className="sr-only">
          <h3 id="chart-title">{selectedModel === "all" ? "All Models" : currentModel.name} Cash Flow Chart</h3>
          <p id="chart-description">
            Bar chart showing dividend cash flows over 10 years. Year 0 shows the negative initial investment cost.
          </p>
        </div>

        <ResponsiveContainer width="100%" height={450}>
          <BarChart data={results.data} margin={{ top: 60, right: 30, left: 50, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="yearLabel" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
            <YAxis tickFormatter={fmtUSD} />
            <Tooltip 
              formatter={(value, name) => {
                const modelName = Object.values(MODEL_CONFIG).find(m => m.dataKey === name)?.name || name;
                return [value ? fmtUSD(Math.abs(value)) : 'Invalid', modelName];
              }}
              labelFormatter={(label) => label === "0" ? "Initial Investment" : `Year ${label}`}
            />
            
            {selectedModel === "all" ? 
              Object.values(MODEL_CONFIG).map(model => (
                <Bar 
                  key={model.dataKey}
                  dataKey={model.dataKey} 
                  name={model.name} 
                  fill={model.color}
                />
              )) :
              <Bar dataKey={currentModel.dataKey} name={currentModel.name} fill={currentModel.color}>
                <LabelList 
                  dataKey={currentModel.dataKey}
                  content={(props) => {
                    const { x, width, value, y } = props;
                    if (value === null || Math.abs(value) < 0.01) return null;
                    
                    const isNegative = value < 0;
                    const labelY = isNegative ? y + 30 : y - 10;
                    
                    return (
                      <text 
                        x={x + width/2} 
                        y={labelY}
                        textAnchor="middle"
                        fill={currentModel.color}
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {isNegative ? `(${fmtUSD(Math.abs(value))})` : fmtUSD(value)}
                      </text>
                    );
                  }}
                />
              </Bar>
            }
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Educational note */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
        <strong>Dividend Discount Models:</strong> Value stocks based on present value of expected future dividend payments.
      </div>
    </>
  );
}

export default function App() {
  const [D0, setD0] = useState(5);
  const [req, setReq] = useState(10);
  const [gConst, setGConst] = useState(5);
  const [gShort, setGShort] = useState(5);
  const [gLong, setGLong] = useState(3);
  const [shortYears, setShortYears] = useState(5);
  const [selectedModel, setSelectedModel] = useState("constant");

  const results = useMemo(() => {
    return buildDividendSeries({
      D0,
      required: req / 100,
      gConst: gConst / 100,
      gShort: gShort / 100,
      gLong: gLong / 100,
      shortYears
    });
  }, [D0, req, gConst, gShort, gLong, shortYears]);

  const hasErrors = Object.keys(results.errors).length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <main className="max-w-7xl mx-auto space-y-6">

        {hasErrors && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
            <h3 className="text-red-800 font-medium mb-2">Input Validation Errors:</h3>
            <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
              {Object.values(results.errors).map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* RESULTS AND CHART */}
        {hasErrors ? (
          <div className="lg:col-span-5">
            <Card title="Validation Required">
              <p className="text-gray-600">Please correct the input errors above to see results and visualizations.</p>
            </Card>
          </div>
        ) : (
          <>
            {/* MOBILE */}
            <div className="lg:hidden space-y-6">
              <Card title="Results">
                <ResultsSection results={results} selectedModel={selectedModel} />
              </Card>
              <Card title="Equity Cash Flows">
                <DividendChart results={results} selectedModel={selectedModel} D0={D0} gConst={gConst} gShort={gShort} gLong={gLong} shortYears={shortYears} />
              </Card>
            </div>

            {/* DESKTOP */}
            <div className="hidden lg:grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-1">
                <Card title="Results">
                  <ResultsSection results={results} selectedModel={selectedModel} />
                </Card>
              </div>
              <div className="lg:col-span-4">
                <Card title="Equity Cash Flows">
                  <DividendChart results={results} selectedModel={selectedModel} D0={D0} gConst={gConst} gShort={gShort} gLong={gLong} shortYears={shortYears} />
                </Card>
              </div>
            </div>
          </>
        )}

        {/* INPUTS */}
        <Card title="Dividend Discount Model Calculator">
          {/* Model Selector */}
          <div className="mb-4 inline-flex rounded-lg overflow-hidden border border-gray-200">
            <button 
              className={`px-3 py-2 text-sm ${selectedModel === "all" ? "bg-gray-50 text-gray-700 font-semibold" : "bg-white text-gray-600"}`} 
              onClick={() => setSelectedModel("all")}
            >
              All
            </button>
            <button 
              className={`px-3 py-2 text-sm border-l ${selectedModel === "constant" ? "bg-blue-50 text-blue-700 font-semibold" : "bg-white text-gray-600"}`} 
              onClick={() => setSelectedModel("constant")}
            >
              Constant
            </button>
            <button 
              className={`px-3 py-2 text-sm border-l ${selectedModel === "growth" ? "bg-green-50 text-green-700 font-semibold" : "bg-white text-gray-600"}`} 
              onClick={() => setSelectedModel("growth")}
            >
              Growth
            </button>
            <button 
              className={`px-3 py-2 text-sm border-l ${selectedModel === "changing" ? "bg-purple-50 text-purple-700 font-semibold" : "bg-white text-gray-600"}`} 
              onClick={() => setSelectedModel("changing")}
            >
              Changing
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            
            <div className="flex items-center gap-2">
              <label htmlFor="D0" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Current Dividend
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="D0">Most recent dividend</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="D0"
                  type="number"
                  step="0.1"
                  value={D0}
                  onChange={(e) => setD0(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="req" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Required Return (%)
                <span className="text-red-500 ml-1">*</span>
                <InfoIcon id="req">Investor's required return</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="req"
                  type="number"
                  step="0.1"
                  value={req}
                  onChange={(e) => setReq(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="gConst" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Constant Growth (%)
                <InfoIcon id="gConst">Constant dividend growth rate</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="gConst"
                  type="number"
                  step="0.1"
                  value={gConst}
                  onChange={(e) => setGConst(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="gShort" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Short-term Growth (%)
                <InfoIcon id="gShort">Initial high growth rate</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="gShort"
                  type="number"
                  step="0.1"
                  value={gShort}
                  onChange={(e) => setGShort(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="gLong" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                Long-term Growth (%)
                <InfoIcon id="gLong">Sustainable growth rate</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="gLong"
                  type="number"
                  step="0.1"
                  value={gLong}
                  onChange={(e) => setGLong(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="shortYears" className="font-medium text-gray-700 whitespace-nowrap flex items-center text-sm">
                High Growth Years
                <InfoIcon id="shortYears">Years of high growth</InfoIcon>
              </label>
              <div className="w-24">
                <input
                  id="shortYears"
                  type="number"
                  step="1"
                  value={shortYears}
                  onChange={(e) => setShortYears(+e.target.value)}
                  className="block w-full rounded-md shadow-sm px-2 py-2 text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

          </div>
          
          <ValidationMessage errors={results.errors} />
        </Card>

      </main>
    </div>
  );
}