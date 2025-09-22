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

const fmtUSD = (x) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(x);

// Accessible input component following required patterns
const FormField = ({ id, label, error, helpText, required, children }) => (
  <div className="mb-4">
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
    </label>
    {children}
    {helpText && (
      <p id={`${id}-help`} className="mt-1 text-xs text-gray-600">
        {helpText}
      </p>
    )}
    {error && (
      <div id={`${id}-error`} className="mt-1 text-xs text-red-600" role="alert">
        {error}
      </div>
    )}
  </div>
);

const NumericInput = ({ id, value, onChange, min, max, step = 0.01, prefix = "", suffix = "", error, helpText }) => {
  const describedBy = [
    helpText ? `${id}-help` : null,
    error ? `${id}-error` : null
  ].filter(Boolean).join(' ');

  const handleFocus = (e) => {
    e.target.select();
  };

  return (
    <div className="relative">
      {prefix && <span className="absolute left-2 top-2 text-gray-500 pointer-events-none">{prefix}</span>}
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onFocus={handleFocus}
        min={min}
        max={max}
        step={step}
        className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none ${
          prefix ? 'pl-6' : ''
        } ${suffix ? 'pr-8' : ''} ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? 'true' : 'false'}
      />
      {suffix && <span className="absolute right-2 top-2 text-gray-500 pointer-events-none">{suffix}</span>}
    </div>
  );
};

// Model configurations
const MODEL_CONFIG = {
  constant: {
    name: "Constant Dividend",
    color: "#2563eb",
    dataKey: "constDiv",
    description: "Assumes dividends remain constant forever. Appropriate for mature companies with stable payouts.",
    formula: "P = D₀ ÷ r"
  },
  growth: {
    name: "Constant Growth Dividend", 
    color: "#16a34a",
    dataKey: "constGrow",
    description: "Assumes constant dividend growth rate forever. Requires growth rate less than required return.",
    formula: "P = D₁ ÷ (r - g)"
  },
  changing: {
    name: "Changing Growth Dividend",
    color: "#9333ea", 
    dataKey: "changingGrowth",
    description: "Assumes high growth initially, then lower sustainable growth. More realistic for many companies.",
    formula: "High growth + Terminal value"
  }
};

// Calculation function
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

export default function AccessibleDividendCalculator() {
  const [D0, setD0] = useState(5);
  const [req, setReq] = useState(10);
  const [gConst, setGConst] = useState(5);
  const [gShort, setGShort] = useState(5);
  const [gLong, setGLong] = useState(3);
  const [shortYears, setShortYears] = useState(5);
  const [selectedModel, setSelectedModel] = useState("constant"); // Toggle state

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
  
  // Get current model configuration
  const currentModel = MODEL_CONFIG[selectedModel];
  
  // Get price for current model
  const getCurrentPrice = () => {
    switch(selectedModel) {
      case "constant": return results.priceNoGrowth;
      case "growth": return results.priceConstantGrowth;
      case "changing": return results.priceChangingGrowth;
      default: return NaN;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Inputs */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-4">Model Parameters</h2>
            
            <FormField id="current-dividend" label="Current Dividend (D₀)" helpText="Most recent annual dividend payment per share" required error={results.errors.D0}>
              <NumericInput id="current-dividend" value={D0} onChange={setD0} min={0.01} max={1000} step={0.1} prefix="$" />
            </FormField>
            
            <FormField id="required-return" label="Required Return" helpText="Investor's minimum acceptable rate of return" required error={results.errors.required}>
              <NumericInput id="required-return" value={req} onChange={setReq} min={0.1} max={50} step={0.1} suffix="%" />
            </FormField>
            
            <FormField id="constant-growth" label="Constant Growth Rate" helpText="Expected annual dividend growth rate" error={results.errors.gConst}>
              <NumericInput id="constant-growth" value={gConst} onChange={setGConst} min={-10} max={25} step={0.1} suffix="%" />
            </FormField>
            
            <FormField id="short-term-growth" label="Short-term Growth Rate" helpText="Higher growth rate for initial years">
              <NumericInput id="short-term-growth" value={gShort} onChange={setGShort} min={-10} max={50} step={0.1} suffix="%" />
            </FormField>
            
            <FormField id="long-term-growth" label="Long-term Growth Rate" helpText="Sustainable growth rate after high-growth period" error={results.errors.gLong}>
              <NumericInput id="long-term-growth" value={gLong} onChange={setGLong} min={-5} max={15} step={0.1} suffix="%" />
            </FormField>
            
            <FormField id="high-growth-years" label="High Growth Period (Years)" helpText="Number of years of high growth before transitioning">
              <NumericInput id="high-growth-years" value={shortYears} onChange={setShortYears} min={1} max={20} step={1} />
            </FormField>
          </section>

          {/* Results and Chart */}
          <div className="lg:col-span-3 space-y-6">
            
            {hasErrors && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="assertive">
                <h3 className="text-red-800 font-medium mb-2">Input Validation Errors:</h3>
                <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                  {Object.values(results.errors).map((error, i) => (
                    <li key={i} role="listitem">{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Current Model Results */}
            <section className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Valuation Results</h2>
              <div className="text-center p-6 rounded-lg" style={{ backgroundColor: currentModel.color + '20' }}>
                <div className="text-3xl font-bold mb-2" style={{ color: currentModel.color }} aria-live="polite" aria-label={`Current valuation: ${isFinite(getCurrentPrice()) ? fmtUSD(getCurrentPrice()) : "Invalid"}`}>
                  {isFinite(getCurrentPrice()) ? fmtUSD(getCurrentPrice()) : "Invalid"}
                </div>
                <div className="text-lg font-medium text-gray-700 mb-1" aria-live="polite">
                  {currentModel.name}
                </div>
                <div className="text-sm text-gray-600">{currentModel.formula}</div>
              </div>
            </section>

            {/* Chart with Model Toggle */}
            <section className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Equity Cash Flows</h2>
                
                {/* Model Toggle Buttons with Enhanced Accessibility */}
                <div className="inline-flex rounded-lg overflow-hidden border border-gray-200" role="group" aria-label="Select dividend model to display">
                  <button 
                    className={`px-3 py-2 text-sm ${selectedModel === "constant" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-gray-700"}`} 
                    onClick={() => setSelectedModel("constant")}
                    aria-pressed={selectedModel === "constant"}
                    aria-controls="dividend-chart"
                    aria-describedby="constant-model-desc"
                  >
                    Constant
                  </button>
                  <button 
                    className={`px-3 py-2 text-sm border-l ${selectedModel === "growth" ? "bg-green-50 text-green-600 border-green-200" : "bg-white text-gray-700 border-gray-200"}`} 
                    onClick={() => setSelectedModel("growth")}
                    aria-pressed={selectedModel === "growth"}
                    aria-controls="dividend-chart"
                    aria-describedby="growth-model-desc"
                  >
                    Growth
                  </button>
                  <button 
                    className={`px-3 py-2 text-sm border-l ${selectedModel === "changing" ? "bg-purple-50 text-purple-600 border-purple-200" : "bg-white text-gray-700 border-gray-200"}`} 
                    onClick={() => setSelectedModel("changing")}
                    aria-pressed={selectedModel === "changing"}
                    aria-controls="dividend-chart"
                    aria-describedby="changing-model-desc"
                  >
                    Changing
                  </button>
                </div>
              </div>
              
              <p className="text-sm text-gray-600 mb-4" aria-live="polite">
                Showing: <strong>{currentModel.name}</strong> - {currentModel.description}
              </p>

              {/* Live region for model changes */}
              <div className="sr-only" aria-live="assertive" aria-atomic="true">
                Chart updated to display {currentModel.name} model showing {isFinite(getCurrentPrice()) ? fmtUSD(getCurrentPrice()) : "invalid"} valuation.
              </div>

              {/* Hidden model descriptions for screen readers */}
              <div className="sr-only">
                <p id="constant-model-desc">Constant Dividend Model: {MODEL_CONFIG.constant.description}</p>
                <p id="growth-model-desc">Constant Growth Dividend Model: {MODEL_CONFIG.growth.description}</p>
                <p id="changing-model-desc">Changing Growth Dividend Model: {MODEL_CONFIG.changing.description}</p>
              </div>

              {/* Accessible Data Table (Screen Reader Only) */}
              <div className="sr-only">
                <h3>Cash Flow Data for {currentModel.name}</h3>
                <p>
                  Annual dividend projections and initial investment cost for the {currentModel.name.toLowerCase()} over 10 years.
                  Year 0 shows the initial investment outflow. Subsequent years show dividend inflows.
                </p>
                <table>
                  <caption>Dividend cash flows by year for {currentModel.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Year</th>
                      <th scope="col" className="text-right">Cash Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.map(row => {
                      const value = row[currentModel.dataKey];
                      return (
                        <tr key={row.year}>
                          <th scope="row">{row.year === 0 ? "Initial Investment" : `Year ${row.year}`}</th>
                          <td className="text-right">
                            {value === null 
                              ? "Invalid model" 
                              : row.year === 0 
                                ? fmtUSD(Math.abs(value)) + " (outflow)"
                                : fmtUSD(value)
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Chart Title */}
              <div className="text-left text-sm text-gray-600 mb-2 font-medium">
                Cash Flow ($)
              </div>

              <div id="dividend-chart" className="h-[500px] w-full" 
                   role="img" 
                   aria-labelledby="chart-title" 
                   aria-describedby="chart-description">
                
                <div className="sr-only">
                  <p id="chart-title">{currentModel.name} Cash Flow Chart</p>
                  <p id="chart-description">
                    Bar chart showing dividend cash flows for the {currentModel.name.toLowerCase()} over 10 years. 
                    Year 0 shows the negative initial investment cost of {isFinite(getCurrentPrice()) ? fmtUSD(Math.abs(getCurrentPrice())) : "invalid amount"}. 
                    Subsequent years show dividend inflows. 
                    {selectedModel === "constant" && `All dividend years show constant ${fmtUSD(D0)} payments.`}
                    {selectedModel === "growth" && `Dividends grow at ${gConst}% annually.`}
                    {selectedModel === "changing" && `Dividends grow at ${gShort}% for the first ${shortYears} years, then ${gLong}% thereafter.`}
                  </p>
                </div>
                
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.data} margin={{ top: 60, right: 30, left: 50, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="yearLabel" 
                      label={{ value: 'Years', position: 'insideBottom', offset: -5 }} 
                    />
                    <YAxis 
                      tickFormatter={fmtUSD}
                    />
                    <Tooltip 
                      formatter={(value) => [value ? fmtUSD(Math.abs(value)) : 'Invalid', currentModel.name]}
                      labelFormatter={(label) => label === "0" ? "Initial Investment" : `Year ${label}`}
                    />
                    
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
                  </BarChart>
                </ResponsiveContainer>
              </div>


            </section>
          </div>
        </div>
      </div>
    </div>
  );
}