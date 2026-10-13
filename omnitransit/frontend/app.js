/* ==========================================================================
   OmniTransit-Agent Swarm — Frontend Command Center & WebGL/Canvas Renderer
   ========================================================================== */

let twinState = null;
let datasetStats = null;
let selectedScenario = "HEAVY_RAIN";
let lastCompiledPrompt = "";
let animFrameId = null;
let animTick = 0;

// Particle pool representing Layer-1 Commuter Persona Agents moving across routes
const commuterParticles = [];
for (let i = 0; i < 65; i++) {
  commuterParticles.push({
    routeIdx: i % 8,
    progress: Math.random(),
    speed: 0.0025 + Math.random() * 0.0035,
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  await fetchDigitalTwinState();
  await fetchDatasetStats();
  await runBlockPrediction();
  initCanvasAnimation();
});

function switchTab(tabId, btnEl) {
  document.querySelectorAll(".tab-pane").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
  if (btnEl) btnEl.classList.add("active");
}

function updateHourSliderLabel(val) {
  const hr = parseInt(val, 10);
  let tag = "Off-Peak";
  if (hr >= 7 && hr <= 10) tag = "AM Peak";
  else if (hr >= 17 && hr <= 20) tag = "PM Peak";
  else if (hr >= 11 && hr <= 16) tag = "Midday";
  document.getElementById("lblHour").textContent = `${String(hr).padStart(2, "0")}:00 (${tag})`;
}

async function fetchDigitalTwinState() {
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/state");
    const data = await res.json();
    twinState = data;
    renderAllTelemetry(data);
  } catch (err) {
    if (window.OMNI_STANDALONE) {
      twinState = JSON.parse(JSON.stringify(window.OMNI_STANDALONE.baseline));
      renderAllTelemetry(twinState);
    }
  }
}

async function fetchDatasetStats() {
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/dataset-stats");
    datasetStats = await res.json();
    renderDatasetExplorer(datasetStats);
  } catch (err) {
    if (window.OMNI_STANDALONE) {
      datasetStats = window.OMNI_STANDALONE.dataset_stats;
      renderDatasetExplorer(datasetStats);
    }
  }
}

function highlightScenarioBtn(scen) {
  selectedScenario = scen;
  document.querySelectorAll(".btn-chaos").forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById(`btnScen-${scen}`);
  if (btn) btn.classList.add("active");
}

async function selectAndDisrupt(scen) {
  highlightScenarioBtn(scen);
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/disrupt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: scen }),
    });
    const data = await res.json();
    twinState = data.telemetry;
    renderAllTelemetry(twinState);
  } catch (err) {
    if (window.OMNI_STANDALONE && window.OMNI_STANDALONE.scenarios[scen]) {
      twinState = JSON.parse(JSON.stringify(window.OMNI_STANDALONE.scenarios[scen].disrupted));
      renderAllTelemetry(twinState);
    }
  }
}

async function runSwarmOptimization() {
  const apiKey = document.getElementById("llmApiKey").value.trim();
  const provider = document.getElementById("llmProvider").value;
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, provider }),
    });
    const data = await res.json();
    twinState = data.telemetry;
    if (data.genai && data.genai.prompt) {
      lastCompiledPrompt = data.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
    }
    renderAllTelemetry(twinState);
  } catch (err) {
    const scen = selectedScenario || "HEAVY_RAIN";
    if (window.OMNI_STANDALONE && window.OMNI_STANDALONE.scenarios[scen]) {
      const pack = window.OMNI_STANDALONE.scenarios[scen];
      twinState = JSON.parse(JSON.stringify(pack.optimized));
      lastCompiledPrompt = pack.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
      renderAllTelemetry(twinState);
    }
  }
}

async function runFullSimulation(scen) {
  highlightScenarioBtn(scen || "HEAVY_RAIN");
  const apiKey = document.getElementById("llmApiKey").value.trim();
  const provider = document.getElementById("llmProvider").value;
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/simulate-full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: selectedScenario,
        api_key: apiKey,
        provider,
      }),
    });
    const data = await res.json();
    twinState = data.telemetry;
    if (data.genai && data.genai.prompt) {
      lastCompiledPrompt = data.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
    }
    renderAllTelemetry(twinState);
  } catch (err) {
    const sKey = selectedScenario || "HEAVY_RAIN";
    if (window.OMNI_STANDALONE && window.OMNI_STANDALONE.scenarios[sKey]) {
      const pack = window.OMNI_STANDALONE.scenarios[sKey];
      twinState = JSON.parse(JSON.stringify(pack.optimized));
      lastCompiledPrompt = pack.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
      renderAllTelemetry(twinState);
    }
  }
}

async function runCustomScenario() {
  const rain = parseFloat(document.getElementById("sliderRain").value);
  const pop = parseFloat(document.getElementById("sliderPop").value);
  const hr = parseInt(document.getElementById("sliderHour").value, 10);
  const metroFault = document.getElementById("chkMetroFault").checked;
  const apiKey = document.getElementById("llmApiKey").value.trim();
  const provider = document.getElementById("llmProvider").value;

  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/simulate-full", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "CUSTOM",
        custom_params: {
          rain_intensity_pct: rain,
          population_surge_pct: pop,
          simulated_hour: hr,
          metro_breakdown: metroFault,
        },
        api_key: apiKey,
        provider,
      }),
    });
    const data = await res.json();
    twinState = data.telemetry;
    if (data.genai && data.genai.prompt) {
      lastCompiledPrompt = data.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
    }
    renderAllTelemetry(twinState);
  } catch (err) {
    const fallbackKey = metroFault && rain >= 60 ? "COMPOUND_CRISIS" : metroFault ? "METRO_BREAKDOWN" : "HEAVY_RAIN";
    if (window.OMNI_STANDALONE && window.OMNI_STANDALONE.scenarios[fallbackKey]) {
      const pack = window.OMNI_STANDALONE.scenarios[fallbackKey];
      twinState = JSON.parse(JSON.stringify(pack.optimized));
      twinState.scenario_title = `Custom What-If Matrix (Rain ${Math.round(rain)}%, Demand +${Math.round(pop)}%)`;
      twinState.simulated_hour = hr;
      lastCompiledPrompt = pack.genai.prompt;
      document.getElementById("rawPromptBox").textContent = lastCompiledPrompt;
      renderAllTelemetry(twinState);
    }
  }
}

async function resetDigitalTwin() {
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch("/api/reset", { method: "POST" });
    const data = await res.json();
    twinState = data.telemetry;
    renderAllTelemetry(twinState);
  } catch (err) {
    if (window.OMNI_STANDALONE) {
      twinState = JSON.parse(JSON.stringify(window.OMNI_STANDALONE.baseline));
      renderAllTelemetry(twinState);
    }
  }
}

function renderAllTelemetry(data) {
  if (!data) return;

  // Header status
  document.getElementById("activeScenarioTitle").textContent = data.scenario_title;
  document.getElementById("activeWeatherBadge").textContent = `${data.weather_condition} • ${String(data.simulated_hour).padStart(2, "0")}:00`;

  // KPI Ribbon
  const kpis = data.kpis;
  const avgWaitEl = document.getElementById("kpiAvgWait");
  avgWaitEl.textContent = `${kpis.network_avg_wait_mins} mins`;
  avgWaitEl.style.color = kpis.network_avg_wait_mins > 14.0 ? "#ef4444" : "#10b981";

  const tradesCount = (data.active_trades || []).length;
  document.getElementById("kpiWaitSub").textContent =
    tradesCount > 0
      ? `✅ Swarm Optimized (${tradesCount} Bounties Settled)`
      : kpis.critical_bottleneck_hubs > 0
      ? `⚠️ ${kpis.critical_bottleneck_hubs} Hubs Exceeding 15m Threshold!`
      : "Nominal Equilibrium (SLA <= 15m)";

  document.getElementById("kpiTotalWaiting").textContent = `${kpis.total_waiting_commuters} pax`;
  document.getElementById("kpiCriticalHubs").textContent = `${kpis.critical_bottleneck_hubs} Critical Bottleneck Hubs`;
  document.getElementById("kpiTokensTraded").textContent = `${kpis.total_tokens_traded.toLocaleString()} TK`;
  document.getElementById("kpiGhostRoutes").textContent = `${kpis.ghost_routes_active} Dynamic Ghost-Route(s) Active`;
  document.getElementById("kpiCarbonSaved").textContent = `${kpis.co2_prevented_kg} kg CO₂e`;
  document.getElementById("kpiEsgRevenue").textContent = `$${kpis.esg_revenue_usd} / ₹${Math.round(data.esg_ledger.estimated_esg_revenue_inr).toLocaleString()} ESG Value`;
  document.getElementById("kpiActiveFleet").textContent = `${kpis.total_active_fleet} Buses`;
  document.getElementById("kpiEvGuardrail").textContent = `EV Guardrail Vetoes: ${data.esg_ledger.ev_guardrail_blocks_triggered} (<25% SOC)`;

  // Render Station Hub Cards
  const stationsGrid = document.getElementById("stationsGrid");
  stationsGrid.innerHTML = "";
  Object.values(data.stations).forEach((st) => {
    let badgeClass = "badge-green";
    if (st.status === "CRITICAL_BOTTLENECK") badgeClass = "badge-red";
    else if (st.status === "ELEVATED_DEMAND") badgeClass = "badge-amber";

    const barColor =
      st.avg_wait_time > 15 ? "#ef4444" : st.avg_wait_time > 11.5 ? "#f59e0b" : "#10b981";

    const card = document.createElement("div");
    card.className = `station-card status-${st.status}`;
    card.innerHTML = `
      <div class="st-header">
        <span>${st.name}</span>
        <span class="badge ${badgeClass}">${st.avg_wait_time}m wait</span>
      </div>
      <div style="font-size:11.5px; color:var(--text-muted); display:flex; justify-content:space-between;">
        <span>Queue: <strong style="color:#fff;">${st.waiting_commuters} pax</strong></span>
        <span>Tokens: <strong style="color:#38bdf8;">${st.token_pool} TK</strong></span>
      </div>
      <div style="font-size:11px; color:var(--text-dim); margin-top:3px;">
        Persona: <span style="color:#c084fc;">${st.dominant_persona}</span> (Patience: ${st.patience_threshold_mins}m)
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${Math.min(100, st.distress_index)}%; background:${barColor};"></div>
      </div>
    `;
    stationsGrid.appendChild(card);
  });

  // Render EV Fleet Battery Guardrail Cards
  const evGrid = document.getElementById("evFleetGrid");
  evGrid.innerHTML = "";
  (data.ev_fleet_units || []).forEach((ev) => {
    const isLocked = ev.soc_pct < 25;
    const socColor = isLocked ? "#ef4444" : ev.soc_pct > 75 ? "#10b981" : "#38bdf8";
    const div = document.createElement("div");
    div.className = `ev-card ${isLocked ? "locked" : ""}`;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-weight:700;">
        <span>🚌 ${ev.unit_id}</span>
        <span style="color:${socColor}; font-family:var(--font-mono);">${ev.soc_pct}% SOC</span>
      </div>
      <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        ${ev.route}
      </div>
      <div style="font-size:10px; margin-top:4px; color:${isLocked ? "#fca5a5" : "#6ee7b7"};">
        ${isLocked ? "⛔ GUARDRAIL VETO (<25% SOC)" : "✅ Eligible for Swarm Dispatch"}
      </div>
    `;
    evGrid.appendChild(div);
  });

  // Render Schedule & Route Comparison Matrix (Tab 2)
  const tbody = document.getElementById("comparisonTableBody");
  tbody.innerHTML = "";
  (data.comparison_table || []).forEach((row) => {
    const tr = document.createElement("tr");
    const improved = row.wait_delta_mins < 0;
    tr.innerHTML = `
      <td>
        <strong>${row.hub_name}</strong><br/>
        <span class="badge badge-purple" style="margin-top:3px; display:inline-block;">${row.dominant_persona}</span>
      </td>
      <td>
        <div style="color:#38bdf8; font-weight:600;">${row.primary_route}</div>
        <div style="font-size:11px; color:var(--text-muted);">Alt: ${row.alternative_route}</div>
      </td>
      <td style="font-family:var(--font-mono);">
        <span style="color:${row.disrupted_wait_mins > 15 ? "#ef4444" : "#f1f5f9"}; font-weight:700;">${row.disrupted_wait_mins} mins</span>
        <div style="font-size:11px; color:var(--text-muted);">(${row.disrupted_demand_pax} pax)</div>
      </td>
      <td style="font-family:var(--font-mono);">
        <span style="color:#10b981; font-weight:700;">${row.optimized_wait_mins} mins</span>
        ${improved ? `<span class="badge badge-green" style="margin-left:4px;">-${Math.abs(row.wait_delta_mins)}m (${row.simulated_relief_pct}% relief)</span>` : ""}
        <div style="font-size:11px; color:var(--text-muted);">(${row.optimized_demand_pax} pax)</div>
      </td>
      <td style="font-family:var(--font-mono);">
        ${row.scheduled_headway_mins}m ➔ <strong style="color:#38bdf8;">${row.recommended_headway_mins}m</strong>
        <div style="font-size:11px; color:var(--text-muted);">${row.active_buses} active buses</div>
      </td>
      <td style="font-family:var(--font-mono);">
        ${row.tokens_exchanged > 0 ? `<span class="badge badge-amber">${row.tokens_exchanged} TK</span>` : `<span style="color:var(--text-dim);">0 TK</span>`}
        <div style="font-size:11px; color:var(--text-muted);">Load: ${row.route_load_pct}%</div>
      </td>
      <td style="font-size:11.5px; color:#e2e8f0; max-width:310px;">
        ${row.why_recommended}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Render B2C Commuter Companion Advisories (Tab 2)
  const compGrid = document.getElementById("companionGrid");
  compGrid.innerHTML = "";
  (data.commuter_companion_advisories || []).forEach((adv) => {
    const div = document.createElement("div");
    div.className = "station-card";
    div.innerHTML = `
      <div class="st-header">
        <span>📲 ${adv.hub_name} (${adv.dominant_persona})</span>
        <span class="badge badge-cyan">~${adv.simulated_wait_mins}m Sandbox Est.</span>
      </div>
      <div style="font-size:11.5px; color:#e2e8f0; margin-bottom:5px;">
        ${adv.message}
      </div>
      <div style="font-size:11px; color:#38bdf8;">
        Recommended Corridor: <strong>${adv.recommended_route}</strong>
      </div>
    `;
    compGrid.appendChild(div);
  });

  // Render GenAI Causal Architect Report (Tab 4)
  document.getElementById("causalReportContainer").innerHTML = renderMarkdown(
    data.causal_report_markdown || ""
  );

  // Render Negotiation Terminal Logs (Right Panel)
  const term = document.getElementById("terminalBox");
  term.innerHTML = "";
  (data.negotiation_logs || []).forEach((item) => {
    const div = document.createElement("div");
    div.className = `log-entry cat-${item.category}`;
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.75; margin-bottom:2px;">
        <strong>${item.sender}</strong>
        <span>${item.timestamp}</span>
      </div>
      <div>${item.message}</div>
    `;
    term.appendChild(div);
  });
  term.scrollTop = term.scrollHeight;
  document.getElementById("logCountBadge").textContent = `${(data.negotiation_logs || []).length} EVENTS`;

  // Render ESG Ledger
  const esg = data.esg_ledger;
  document.getElementById("esgRetained").textContent = `${esg.commuters_retained_in_transit} pax`;
  document.getElementById("esgCabs").textContent = `${esg.private_cab_trips_prevented} trips`;
  document.getElementById("esgCo2").textContent = `${esg.co2_prevented_kg} kg (${esg.co2_prevented_metric_tons} t)`;
  document.getElementById("esgCredits").textContent = `${esg.verified_carbon_credits_minted} Credits`;
  document.getElementById("esgValuation").textContent = `$${esg.estimated_esg_revenue_usd} (₹${Math.round(esg.estimated_esg_revenue_inr).toLocaleString()})`;
}

function renderDatasetExplorer(stats) {
  if (!stats) return;

  // 24-Hour Busy Time-Period Chart
  const chart = document.getElementById("hourlyChart");
  chart.innerHTML = "";
  const profile = stats.hourly_profile || [];
  const maxDem = Math.max(...profile.map((p) => p.avg_demand), 220);

  profile.forEach((p) => {
    const col = document.createElement("div");
    col.className = "hour-bar-col";
    const pct = Math.max(8, Math.round((p.avg_demand / maxDem) * 100));
    const color = p.is_busy_period
      ? "linear-gradient(180deg, #ef4444, #f97316)"
      : "linear-gradient(180deg, #06b6d4, #2563eb)";
    col.title = `${p.label} (${p.time_bucket}): Avg Demand ${p.avg_demand} pax | Simulated Wait ${p.avg_wait_mins}m | Load ${p.avg_load_pct}%`;
    col.innerHTML = `
      <div class="hour-bar" style="height:${pct}%; background:${color};"></div>
      <span class="hour-label">${String(p.hour).padStart(2, "0")}</span>
    `;
    chart.appendChild(col);
  });

  // Persona Table
  const pBody = document.getElementById("personaTableBody");
  pBody.innerHTML = "";
  (stats.persona_benchmarks || []).forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.persona}</strong></td>
      <td style="font-family:var(--font-mono);">${p.patience_threshold_mins}m</td>
      <td style="font-family:var(--font-mono);">${p.share_pct}%</td>
      <td><span class="badge ${p.abandonment_risk_pct > 45 ? "badge-red" : "badge-amber"}">${p.abandonment_risk_pct}%</span></td>
    `;
    pBody.appendChild(tr);
  });

  // Top Distressed Smart Blocks Table
  const bBody = document.getElementById("blocksTableBody");
  bBody.innerHTML = "";
  (stats.top_distressed_blocks || []).slice(0, 8).forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-family:var(--font-mono); color:#38bdf8;">${b.block_key}</td>
      <td style="font-family:var(--font-mono);">${b.records.toLocaleString()}</td>
      <td style="font-family:var(--font-mono);">${b.avg_demand} pax</td>
      <td style="font-family:var(--font-mono); color:#ef4444; font-weight:700;">${b.avg_wait_mins}m</td>
      <td style="font-family:var(--font-mono); color:#f59e0b;">${Math.round(b.avg_bounty)} TK</td>
    `;
    bBody.appendChild(tr);
  });
}

async function runBlockPrediction() {
  const hub = document.getElementById("predHub").value;
  const bucket = document.getElementById("predBucket").value;
  const weather = document.getElementById("predWeather").value;
  const headway = parseInt(document.getElementById("predHeadway").value, 10) || 12;

  let pred = null;
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await fetch(
      `/api/predict-demand?hub_code=${hub}&time_bucket=${bucket}&weather_code=${weather}&headway_mins=${headway}`
    );
    pred = await res.json();
  } catch (err) {
    if (window.OMNI_STANDALONE && window.OMNI_STANDALONE.trained_model) {
      const m = window.OMNI_STANDALONE.trained_model;
      const fw = m.feature_weights || {};
      const baseD = m.global_mean_demand || 140.0;
      const baseW = m.global_mean_wait_mins || 12.5;
      const hD = (fw.hub_demand_delta || {})[hub] || 0;
      const tD = (fw.time_bucket_demand_delta || {})[bucket] || 0;
      const wD = (fw.weather_demand_delta || {})[weather] || 0;
      const hW = (fw.hub_wait_delta || {})[hub] || 0;
      const tW = (fw.time_bucket_wait_delta || {})[bucket] || 0;
      const wW = (fw.weather_wait_delta || {})[weather] || 0;

      const predDemand = Math.max(12.0, Number((baseD + hD + tD + wD).toFixed(1)));
      const hwFactor = headway / 12.0;
      const predLoad = Math.min(135.0, Math.max(10.0, Number(((predDemand / 115.0) * hwFactor * 58.0).toFixed(1))));
      const predWait = Math.max(3.0, Number(((baseW + hW + tW + wW) * (0.65 + 0.35 * hwFactor)).toFixed(1)));
      const needsOpt = predWait > 15.0 || predLoad > 85.0;
      const recHw = needsOpt ? Math.max(5, Math.round(headway * 0.58)) : headway;
      const optWait = needsOpt ? Math.max(4.5, Number((predWait * 0.52).toFixed(1))) : predWait;
      const redMins = Number((predWait - optWait).toFixed(1));

      pred = {
        hub_code: hub,
        time_bucket: bucket,
        weather_code: weather,
        predicted_demand: predDemand,
        predicted_load_pct: predLoad,
        predicted_wait_mins: predWait,
        optimized_wait_mins: optWait,
        wait_reduction_mins: redMins,
        recommendation_reason: needsOpt
          ? `Reduce headway from ${headway} mins to ${recHw} mins (+2 buses via Token Bounty) to cut simulated wait time by ${redMins} mins.`
          : "Current schedule frequency is optimal for predicted block demand.",
      };
    }
  }

  if (pred) {
    const box = document.getElementById("predResultBox");
    box.innerHTML = `
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:6px;">
        <span>🧱 Block Key: <strong style="color:#38bdf8; font-family:var(--font-mono);">${pred.hub_code}_*_${pred.time_bucket}_${pred.weather_code}</strong></span>
        <span>Predicted Demand: <strong style="color:#fff;">${pred.predicted_demand} commuters</strong></span>
        <span>Simulated Load: <strong style="color:#f59e0b;">${pred.predicted_load_pct}%</strong></span>
        <span>Unoptimized Wait: <strong style="color:#ef4444;">${pred.predicted_wait_mins} mins</strong></span>
        <span>Optimized Wait: <strong style="color:#10b981;">${pred.optimized_wait_mins} mins (-${pred.wait_reduction_mins}m)</strong></span>
      </div>
      <div style="color:#a7f3d0;">
        💡 <strong>Blocked GBM Schedule Recommendation:</strong> ${pred.recommendation_reason}
      </div>
    `;
  }
}

function copyGenAiPrompt() {
  const text = document.getElementById("rawPromptBox").textContent || "Run an optimization cycle to populate the prompt.";
  navigator.clipboard.writeText(text);
  alert("Compiled GenAI Transit Architect prompt copied to clipboard!");
}

/* ==========================================================================
   Hardware-Accelerated 2D/3D-Style Geospatial Digital Twin Canvas Renderer
   ========================================================================== */
function initCanvasAnimation() {
  const canvas = document.getElementById("twinCanvas");
  if (!canvas) return;

  function renderLoop() {
    animTick += 1;
    drawDigitalTwinCanvas(canvas);
    animFrameId = requestAnimationFrame(renderLoop);
  }
  renderLoop();
}

function drawDigitalTwinCanvas(canvas) {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }

  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.scale(dpr, dpr);
  const W = rect.width;
  const H = rect.height;

  // Clear cyber-grid background
  ctx.fillStyle = "#050811";
  ctx.fillRect(0, 0, W, H);

  // Subtle coordinate grid lines
  ctx.strokeStyle = "rgba(56, 189, 248, 0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  if (!twinState || !twinState.stations) {
    ctx.restore();
    return;
  }

  const stations = twinState.stations;
  const routes = Object.values(twinState.routes || {});

  // 1. Draw Primary Transit Routes & Commuter Persona Particles
  routes.forEach((rt, rIdx) => {
    const orig = stations[rt.origin];
    const dest = stations[rt.destination];
    if (!orig || !dest) return;

    const x1 = orig.map_x * W;
    const y1 = orig.map_y * H;
    const x2 = dest.map_x * W;
    const y2 = dest.map_y * H;

    let strokeColor = "#10b981";
    if (rt["load_factor_%"] >= 85) strokeColor = "#ef4444";
    else if (rt["load_factor_%"] <= 32) strokeColor = "#06b6d4";
    else if (rt["load_factor_%"] >= 70) strokeColor = "#f59e0b";

    // Outer glow
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();

    // Core route line
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Animated Commuter Persona Particles along this route
    commuterParticles
      .filter((p) => p.routeIdx === rIdx)
      .forEach((p) => {
        p.progress = (p.progress + p.speed) % 1.0;
        const px = x1 + (x2 - x1) * p.progress;
        const py = y1 + (y2 - y1) * p.progress;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
  });

  // 2. Draw Dynamic Ghost-Routes (if spawned)
  (twinState.ghost_routes || []).forEach((gr) => {
    const orig = stations[gr.from_hub];
    const dest = stations[gr.to_hub];
    if (!orig || !dest) return;
    const x1 = orig.map_x * W;
    const y1 = orig.map_y * H;
    const x2 = dest.map_x * W;
    const y2 = dest.map_y * H;

    ctx.save();
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -(animTick * 0.8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Label
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - 10;
    ctx.fillStyle = "#e9d5ff";
    ctx.font = "bold 11px monospace";
    ctx.fillText(`⚡ ${gr.id} (Non-Stop Express)`, mx - 60, my);
    ctx.restore();
  });

  // 3. Draw 3D-Style Soaring Token Bounty Arcs between Seller Hubs and Buyer Hubs
  (twinState.active_trades || []).forEach((tr, idx) => {
    const seller = stations[tr.seller_hub];
    const buyer = stations[tr.buyer_hub];
    if (!seller || !buyer) return;

    const sx = seller.map_x * W;
    const sy = seller.map_y * H;
    const bx = buyer.map_x * W;
    const by = buyer.map_y * H;

    // Control point elevated above midpoint for 3D arc illusion
    const cx = (sx + bx) / 2;
    const cy = Math.min(sy, by) - 65 - idx * 18;

    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.2;
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.stroke();

    // Moving Token & EV Bus packet along the Quadratic Bezier curve
    const t = ((animTick * 0.012) + idx * 0.3) % 1.0;
    const invT = 1 - t;
    const px = invT * invT * sx + 2 * invT * t * cx + t * t * bx;
    const py = invT * invT * sy + 2 * invT * t * cy + t * t * by;

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fde047";
    ctx.font = "bold 10.5px monospace";
    ctx.fillText(`+${tr.buses_shifted} EV Bus (${tr.tokens_paid} TK)`, cx - 55, cy + 14);
    ctx.restore();
  });

  // 4. Draw Station Hub Nodes & Telemetry Callouts
  Object.values(stations).forEach((st) => {
    const x = st.map_x * W;
    const y = st.map_y * H;

    let nodeColor = "#10b981";
    if (st.avg_wait_time > 15.0) nodeColor = "#ef4444";
    else if (st.avg_wait_time > 11.5) nodeColor = "#f59e0b";

    // Pulsing shockwave ring for critical hubs
    const pulseR = 12 + Math.sin(animTick * 0.08) * 4;
    ctx.save();
    ctx.strokeStyle = nodeColor;
    ctx.globalAlpha = st.avg_wait_time > 15.0 ? 0.65 : 0.28;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Hub Core Circle
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#050811";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hub Label Box
    ctx.fillStyle = "rgba(6, 9, 19, 0.85)";
    ctx.fillRect(x - 54, y + 10, 108, 30);
    ctx.strokeStyle = nodeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 54, y + 10, 108, 30);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 10.5px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(st.name, x, y + 22);

    ctx.fillStyle = nodeColor;
    ctx.font = "10px monospace";
    ctx.fillText(`${st.avg_wait_time}m | ${st.waiting_commuters} pax`, x, y + 35);
  });

  ctx.restore();
}

/* Simple Markdown to HTML renderer for Causal Briefing */
function renderMarkdown(md) {
  if (!md) return "";
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.startsWith("|") && line.endsWith("|")) {
      if (line.includes("---")) continue;
      if (!inTable) {
        html += `<div class="table-wrap" style="margin:10px 0;"><table class="data-table">`;
        inTable = true;
      }
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => formatInlineMd(c.trim()));
      const tag = i > 0 && lines[i + 1] && lines[i + 1].includes("---") ? "th" : "td";
      html += `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join("")}</tr>`;
      continue;
    } else if (inTable) {
      html += `</table></div>`;
      inTable = false;
    }

    if (line.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3>${formatInlineMd(line.slice(4))}</h3>`;
    } else if (line.startsWith("#### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h4 style="color:#c084fc; margin:12px 0 6px 0;">${formatInlineMd(line.slice(5))}</h4>`;
    } else if (line.startsWith("- ")) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${formatInlineMd(line.slice(2))}</li>`;
    } else if (line.startsWith("> ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<blockquote>${formatInlineMd(line.slice(2))}</blockquote>`;
    } else if (line === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p style="margin-bottom:8px;">${formatInlineMd(line)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  if (inTable) html += "</table></div>";
  return html;
}

function formatInlineMd(str) {
  return str
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}
