import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4" role="alert">
                <h3 className="text-red-800 font-medium mb-2">Input Validation Errors:</h3>
                <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                  {Object.values(results.errors).map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Results - Enhanced contrast */}
            <section className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-4">Valuation Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-800">
                    {isFinite(results.priceNoGrowth) ? fmtUSD(results.priceNoGrowth) : "Invalid"}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Constant Dividend Model</div>
                  <div className="text-xs text-gray-600 mt-1">P = D₀ ÷ r</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-800">
                    {isNaN(results.priceConstantGrowth) ? "Invalid" : fmtUSD(results.priceConstantGrowth)}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Constant Growth Dividend Model</div>
                  <div className="text-xs text-gray-600 mt-1">P = D₁ ÷ (r - g)</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-800">
                    {isNaN(results.priceChangingGrowth) ? "Invalid" : fmtUSD(results.priceChangingGrowth)}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">Changing Growth Dividend Model</div>
                  <div className="text-xs text-gray-600 mt-1">High growth + Terminal value</div>
                </div>
              </div>
            </section>

            {/* Accessible Data Table (Screen Reader Only) */}
            <div className="sr-only">
              <h3>Cash Flow Data Table</h3>
              <p>
                Annual dividend projections and initial investment costs for each valuation model over 10 years. 
                Constant Dividend model (solid bars) shows constant dividends.
                Constant Growth Dividend model (striped pattern) shows growing dividends.
                Changing Growth Dividend model (dotted pattern) shows high initial growth then sustainable growth.
              </p>
              <table>
                <caption>Dividend cash flows by year and model</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col" className="text-right">Constant Dividend</th>
                    <th scope="col" className="text-right">Constant Growth Dividend</th>
                    <th scope="col" className="text-right">Changing Growth Dividend</th>
                  </tr>
                </thead>
                <tbody>
                  {results.data.map(row => (
                    <tr key={row.year}>
                      <th scope="row">{row.year === 0 ? "Initial Investment" : `Year ${row.year}`}</th>
                      <td className="text-right">
                        {row.year === 0 
                          ? fmtUSD(Math.abs(row.constDiv)) + " (outflow)"
                          : fmtUSD(row.constDiv)
                        }
                      </td>
                      <td className="text-right">
                        {row.constGrow === null 
                          ? "Invalid model" 
                          : row.year === 0 
                            ? fmtUSD(Math.abs(row.constGrow)) + " (outflow)"
                            : fmtUSD(row.constGrow)
                        }
                      </td>
                      <td className="text-right">
                        {row.changingGrowth === null 
                          ? "Invalid model" 
                          : row.year === 0 
                            ? fmtUSD(Math.abs(row.changingGrowth)) + " (outflow)"
                            : fmtUSD(row.changingGrowth)
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chart */}
            <section className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-semibold mb-2">Equity Cash Flows (in US$) for Different Dividend Models</h2>
              <p className="text-sm text-gray-600 mb-4">(Only the first 10 years are shown)</p>
              
              {/* Clean Legend */}
              <div className="mb-4 flex flex-wrap gap-6 justify-center text-sm">
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 bg-blue-600 mr-2 rounded"></span>
                  <span className="font-medium">Constant Dividend</span>
                </span>
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 bg-green-600 mr-2 rounded"></span>
                  <span className="font-medium">Constant Growth Dividend</span>
                </span>
                <span className="inline-flex items-center">
                  <span className="w-4 h-4 bg-purple-600 mr-2 rounded"></span>
                  <span className="font-medium">Changing Growth Dividend</span>
                </span>
              </div>

              <div className="h-[600px] w-full" 
                   role="img" 
                   aria-labelledby="chart-title" 
                   aria-describedby="chart-description">
                
                <div className="sr-only">
                  <p id="chart-description">
                    Bar chart showing dividend cash flows over 10 years. Year 0 shows negative initial investment costs. 
                    Subsequent years show growing dividend payments for each model. 
                    For each year, bars appear in consistent order from left to right:
                    First bar (blue): Constant Dividend model showing constant {fmtUSD(D0)} dividends. 
                    Second bar (green): Constant Growth Dividend model showing dividends growing at {gConst}% annually. 
                    Third bar (purple): Changing Growth Dividend model showing {gShort}% growth for {shortYears} years, then {gLong}% thereafter.
                  </p>
                </div>
                
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.data} margin={{ top: 120, right: 30, left: 20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="yearLabel" label={{ value: 'Years', position: 'insideBottom', offset: -5 }} />
                    <YAxis tickFormatter={fmtUSD} />
                    <Tooltip 
                      formatter={(value, name) => [value ? fmtUSD(Math.abs(value)) : 'Invalid', name]}
                      labelFormatter={(label) => label === "0" ? "Initial Investment" : `Year ${label}`}
                    />
                    
                    <Bar dataKey="constDiv" name="Constant Dividend" fill="#2563eb">
                      <LabelList 
                        dataKey="constDiv"
                        content={(props) => {
                          const { x, width, value } = props;
                          if (value === null) return null;
                          
                          return (
                            <text 
                              x={x + width/2} 
                              y={30}
                              textAnchor="middle"
                              fill="#1e3a8a"
                              fontSize="10"
                              fontWeight="bold"
                              transform={`rotate(-15 ${x + width/2} 10)`}
                            >
                              {fmtUSD(value)}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                    
                    <Bar dataKey="constGrow" name="Constant Growth Dividend" fill="#16a34a">
                      <LabelList 
                        dataKey="constGrow"
                        content={(props) => {
                          const { x, width, value } = props;
                          if (value === null) return null;
                          
                          return (
                            <text 
                              x={x + width/2} 
                              y={50}
                              textAnchor="middle"
                              fill="#047857"
                              fontSize="10"
                              fontWeight="bold"
                              transform={`rotate(-15 ${x + width/2} 30)`}
                            >
                              {fmtUSD(value)}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                    
                    <Bar dataKey="changingGrowth" name="Changing Growth Dividend" fill="#9333ea">
                      <LabelList 
                        dataKey="changingGrowth"
                        content={(props) => {
                          const { x, width, value } = props;
                          if (value === null) return null;
                          
                          return (
                            <text 
                              x={x + width/2} 
                              y={70}
                              textAnchor="middle"
                              fill="#6b21a8"
                              fontSize="10"
                              fontWeight="bold"
                              transform={`rotate(-15 ${x + width/2} 50)`}
                            >
                              {fmtUSD(value)}
                            </text>
                          );
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">Model Explanations:</h3>
                <div className="text-xs text-gray-700 space-y-2">
                  <p><strong>Constant Dividend Model (■):</strong> Assumes dividends remain constant. Appropriate for mature companies with stable payouts.</p>
                  <p><strong>Constant Growth Dividend Model (▦):</strong> Assumes constant dividend growth rate. Requires growth rate less than required return.</p>
                  <p><strong>Changing Growth Dividend Model (●):</strong> Assumes high growth initially, then lower sustainable growth. More realistic for many companies.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}