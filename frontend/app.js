/* ==========================================================================
   OmniTransit-Agent Swarm — Frontend Command Center & Real Coimbatore GIS Engine
   ========================================================================== */

let twinState = null;
let datasetStats = null;
let selectedScenario = "HEAVY_RAIN";
let lastCompiledPrompt = "";
let animFrameId = null;
let animTick = 0;

// JWT Session & Operator State
let currentJwtToken = sessionStorage.getItem("omnitransit_jwt_token") || "";
let currentUser = null;
try {
  currentUser = JSON.parse(sessionStorage.getItem("omnitransit_user") || "null");
} catch (e) {
  currentUser = null;
}

// Leaflet Map & GIS State
let coimbatoreMap = null;
let leafletStationMarkers = {};
let leafletRoutePolylines = {};
let leafletGhostPolylines = [];
let leafletBusMarkers = [];
let activeMapView = "leaflet"; // "leaflet" | "canvas"

// Google Maps API & Integration State
let googleMapsApiKey = localStorage.getItem("omnitransit_google_maps_key") || "";
let googleMap = null;
let googleStationMarkers = {};
let googleRoutePolylines = {};
let googleBusMarkers = [];
let activeMapProvider = "leaflet"; // "leaflet" | "google"

// Spatial.UI View Modes & Layers
let spatialViewMode = "3D"; // "3D" | "2D"
let spatialLayers = {
  corridors: true,
  particles: true,
  arcs: true,
  heatmap: true,
  evGrid: true,
};
let activeSelectedStation = null;
let activeMpcMode = "ADAPTIVE_MPC";
let robustMatrixData = null;
let mpcHorizonData = null;

// Particle pool representing commuter persona movements across routes (Canvas fallback)
const commuterParticles = [];
for (let i = 0; i < 75; i++) {
  commuterParticles.push({
    routeIdx: i % 8,
    progress: Math.random(),
    speed: 0.0022 + Math.random() * 0.0035,
  });
}

// Representative Coimbatore Transit GPS Waypoints for Corridor Routing
const COIMBATORE_HUBS_GPS = {
  "Kalapatti Hub": { lat: 11.0745, lng: 77.0355, code: "KAL", name: "Kalapatti Tech Hub" },
  "Gandhipuram Central": { lat: 11.0183, lng: 76.9675, code: "GAN", name: "Gandhipuram Central" },
  "Town Hall Hub": { lat: 10.9925, lng: 76.9614, code: "TWN", name: "Town Hall Hub" },
  "Arasur Junction": { lat: 11.0792, lng: 77.1215, code: "ARA", name: "Arasur Industrial" },
  "Saravanampatti IT": { lat: 11.0797, lng: 76.9997, code: "SAR", name: "Saravanampatti IT SEZ" },
  "Peelamedu Metro Link": { lat: 11.0286, lng: 77.0226, code: "PEE", name: "Peelamedu Metro Link" },
  "Singanallur Center": { lat: 11.0007, lng: 77.0296, code: "SIN", name: "Singanallur Center" },
  "Ukkadam Terminal": { lat: 10.9902, lng: 76.9518, code: "UKK", name: "Ukkadam Lakefront Terminal" },
};

// 8 Primary Arterial Corridors in Coimbatore
const COIMBATORE_ROUTES_GPS = [
  { id: "R-101", name: "Route-101 (Town Hall - Kalapatti)", from: "Town Hall Hub", to: "Kalapatti Hub", via: "Peelamedu Metro Link" },
  { id: "R-102", name: "Route-102 (Gandhipuram - Peelamedu)", from: "Gandhipuram Central", to: "Peelamedu Metro Link", via: null },
  { id: "R-103", name: "Route-103 (Town Hall - Singanallur)", from: "Town Hall Hub", to: "Singanallur Center", via: null },
  { id: "R-202", name: "Route-202 (Gandhipuram - Arasur)", from: "Gandhipuram Central", to: "Arasur Junction", via: "Kalapatti Hub" },
  { id: "R-104", name: "Route-104 (Saravanampatti - Gandhipuram)", from: "Saravanampatti IT", to: "Gandhipuram Central", via: null },
  { id: "R-105", name: "Route-105 (Metro Feeder Loop)", from: "Peelamedu Metro Link", to: "Kalapatti Hub", via: "Saravanampatti IT" },
  { id: "R-106", name: "Route-106 (Southern Ring)", from: "Singanallur Center", to: "Ukkadam Terminal", via: "Town Hall Hub" },
  { id: "R-204", name: "Route-204 (Ukkadam - North Express)", from: "Ukkadam Terminal", to: "Saravanampatti IT", via: "Gandhipuram Central" },
];

window.addEventListener("DOMContentLoaded", async () => {
  await ensureJwtAuthentication();
  await initGoogleMapsConfiguration();
  initCoimbatoreLeafletMap();
  await fetchDigitalTwinState();
  await fetchDatasetStats();
  await runBlockPrediction();
  await fetchRobustMatrix();
  await fetchMpcHorizon(activeMpcMode);
  initCanvasAnimation();
  initCanvasInteraction();
  startBusGpsSimulation();
  renderCorridorsAdvisoryGrid();
  updateTripAdvisoryAdvice();
  initTelemetryStreamEngine();
});

// ============================================================================
// JWT AUTHENTICATION & OPERATOR MANAGEMENT
// ============================================================================

async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (currentJwtToken) {
    options.headers["Authorization"] = `Bearer ${currentJwtToken}`;
  }
  let res = await fetch(url, options);
  if (res.status === 401) {
    console.warn("[AUTH] Session expired or invalid token - re-authenticating");
    await ensureJwtAuthentication();
    if (currentJwtToken) {
      options.headers["Authorization"] = `Bearer ${currentJwtToken}`;
      res = await fetch(url, options);
    }
  }
  return res;
}

async function ensureJwtAuthentication() {
  if (currentJwtToken && currentUser) {
    updateOperatorUi(currentUser, currentJwtToken);
    return;
  }
  // Public Passenger Mode by default — Admin panel is hidden from regular commuters
  updateOperatorUi(null, null);
}

function updateOperatorUi(user, token) {
  const nameEl = document.getElementById("operatorName");
  const roleEl = document.getElementById("operatorRole");
  const avatarEl = document.getElementById("operatorAvatar");
  const rawTokenEl = document.getElementById("rawTokenDisplay");
  const badgeEl = document.getElementById("jwtStatusBadge");

  const labelEl = document.getElementById("operatorRoleLabel");
  const avatarBadge = document.getElementById("operatorAvatarBadge");
  const navBtnAdv = document.getElementById("navBtn-advanced");
  const dropAdmin = document.getElementById("dropdownAdminItem");
  const tabAdv = document.getElementById("tab-advanced");

  if (!user) {
    if (labelEl) labelEl.textContent = "Passenger Access";
    if (avatarBadge) avatarBadge.textContent = "PA";
    if (navBtnAdv) navBtnAdv.style.display = "none";
    if (dropAdmin) dropAdmin.style.display = "none";
    if (tabAdv) tabAdv.style.display = "none";
    if (badgeEl) badgeEl.textContent = "PUBLIC ACCESS";
    return;
  }

  const isAdmin = user.username === "admin" || user.role === "admin" || (user.role && user.role.toLowerCase().includes("architect"));

  if (labelEl) {
    labelEl.textContent = isAdmin ? `${user.name || "Operator"} (Admin)` : (user.name || "Operator");
  }
  if (avatarBadge) {
    const initials = (user.name || "OP").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    avatarBadge.textContent = initials;
  }

  // Hide or Show Admin Diagnostics Tab based on role
  if (isAdmin) {
    if (navBtnAdv) navBtnAdv.style.display = "inline-flex";
    if (dropAdmin) dropAdmin.style.display = "block";
    if (tabAdv) tabAdv.style.display = "block";
  } else {
    if (navBtnAdv) navBtnAdv.style.display = "none";
    if (dropAdmin) dropAdmin.style.display = "none";
    if (tabAdv) tabAdv.style.display = "none";
  }

  if (nameEl) nameEl.textContent = user.name || "Operator";
  if (roleEl) roleEl.textContent = `${user.role || "Operator"} • ${user.agency || "CMTA"}`;
  if (avatarEl) {
    const initials = (user.name || "OP").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    avatarEl.textContent = initials;
  }
  if (rawTokenEl) rawTokenEl.textContent = token || "No active token";
  if (badgeEl) badgeEl.textContent = "JWT VALID";
}

function openLoginModal() {
  const modal = document.getElementById("loginModal") || document.getElementById("authModalBackdrop");
  if (modal) modal.style.display = "flex";
  const errBox = document.getElementById("loginStatusMsg") || document.getElementById("authErrorMessage");
  if (errBox) {
    errBox.style.display = "none";
    errBox.textContent = "";
  }
}

function closeLoginModal() {
  const modal = document.getElementById("loginModal") || document.getElementById("authModalBackdrop");
  if (modal) modal.style.display = "none";
}

function selectQuickRole(user, pass) {
  const uInput = document.getElementById("authUsername");
  const pInput = document.getElementById("authPassword");
  if (uInput) uInput.value = user;
  if (pInput) pInput.value = pass;
  document.querySelectorAll(".btn-role-quick, .btn-pill-secondary").forEach((b) => b.classList.remove("active"));
  if (user === "admin") document.getElementById("roleBtnAdmin")?.classList.add("active");
  if (user === "dispatcher") document.getElementById("roleBtnDispatcher")?.classList.add("active");
  if (user === "planner") document.getElementById("roleBtnPlanner")?.classList.add("active");
}

async function handleOperatorLogin(event) {
  return handleLoginSubmit(event);
}

async function handleLoginSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();
  const u = (document.getElementById("authUsername")?.value || "admin").trim();
  const p = (document.getElementById("authPassword")?.value || "omni2026").trim();
  const errBox = document.getElementById("loginStatusMsg") || document.getElementById("authErrorMessage");
  const btn = document.getElementById("btnLoginSubmit");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Authenticating...";
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const data = await res.json();
    if (res.ok && (data.session || data.token)) {
      currentJwtToken = data.token || data.session?.token;
      currentUser = data.session || data.user;
      sessionStorage.setItem("omnitransit_jwt_token", currentJwtToken);
      sessionStorage.setItem("omnitransit_user", JSON.stringify(currentUser));
      updateOperatorUi(currentUser, currentJwtToken);
      if (errBox) {
        errBox.style.display = "block";
        errBox.style.color = "var(--accent-success)";
        errBox.textContent = `Authenticated: ${currentUser?.name || u} (JWT Issued)`;
      }
      setTimeout(() => closeLoginModal(), 400);
    } else {
      if (errBox) {
        errBox.textContent = data.message || "Authentication failed. Check credentials.";
        errBox.style.color = "var(--accent-danger)";
        errBox.style.display = "block";
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = "Network error connecting to authentication service.";
      errBox.style.color = "var(--accent-danger)";
      errBox.style.display = "block";
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Sign In & Issue JWT";
    }
  }
}

function logoutOperator() {
  currentJwtToken = "";
  currentUser = null;
  sessionStorage.removeItem("omnitransit_jwt_token");
  sessionStorage.removeItem("omnitransit_user");
  const badgeEl = document.getElementById("jwtStatusBadge");
  if (badgeEl) badgeEl.textContent = "UNAUTHENTICATED";
  openLoginModal();
}

// ============================================================================
// REAL COIMBATORE LEAFLET GIS MAP
// ============================================================================

function initCoimbatoreLeafletMap() {
  const mapContainer = document.getElementById("coimbatoreMap");
  if (!mapContainer || typeof L === "undefined") return;

  // Center on Coimbatore metropolitan area: 11.025° N, 77.010° E, Zoom level 12
  coimbatoreMap = L.map("coimbatoreMap", {
    center: [11.025, 77.010],
    zoom: 12,
    zoomControl: true,
    attributionControl: false,
  });

  // CartoDB Positron tiles (clean, high-contrast light cartographic map matching #F4F1EA newsprint)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd",
  }).addTo(coimbatoreMap);

  // Plot Coimbatore Transit Corridors as Exposed Editorial Hairline Routes
  COIMBATORE_ROUTES_GPS.forEach((rt) => {
    const orig = COIMBATORE_HUBS_GPS[rt.from];
    const dest = COIMBATORE_HUBS_GPS[rt.to];
    if (!orig || !dest) return;

    let pts = [[orig.lat, orig.lng]];
    if (rt.via && COIMBATORE_HUBS_GPS[rt.via]) {
      pts.push([COIMBATORE_HUBS_GPS[rt.via].lat, COIMBATORE_HUBS_GPS[rt.via].lng]);
    }
    pts.push([dest.lat, dest.lng]);

    const poly = L.polyline(pts, {
      color: "#2E5A44",
      weight: 3.5,
      opacity: 0.85,
      lineCap: "round",
    }).addTo(coimbatoreMap);

    poly.bindTooltip(`${rt.name}`, { sticky: true, className: "leaflet-corridor-tooltip" });
    leafletRoutePolylines[rt.id] = poly;
  });

  // Plot Coimbatore Stations as Custom Typographic Stamp Markers
  Object.keys(COIMBATORE_HUBS_GPS).forEach((hubName) => {
    const hub = COIMBATORE_HUBS_GPS[hubName];
    const markerEl = document.createElement("div");
    markerEl.className = "station-pin";
    markerEl.innerHTML = `
      <div class="station-pin-core" style="background:#2E5A44; color:#FFFFFF;" id="pinCore-${hub.code}">${hub.code}</div>
      <div class="station-pin-label">${hub.name}</div>
    `;

    const icon = L.divIcon({
      html: markerEl,
      className: "custom-station-icon",
      iconSize: [120, 40],
      iconAnchor: [60, 15],
    });

    const marker = L.marker([hub.lat, hub.lng], { icon: icon }).addTo(coimbatoreMap);
    marker.on("click", () => {
      openStationLeafletPopup(hubName, marker);
      showSpatialHud(hubName);
    });

    leafletStationMarkers[hubName] = marker;
  });

  // Initial bus units for GPS simulation
  initLeafletBusUnits();
}

function openStationLeafletPopup(hubName, marker) {
  if (!twinState || !twinState.stations) return;
  const st = twinState.stations[hubName];
  if (!st) return;

  const waitColor = st.avg_wait_time > 15 ? "var(--accent-terracotta)" : st.avg_wait_time > 11.5 ? "var(--accent-ochre)" : "var(--accent-forest)";
  const html = `
    <div style="font-family:var(--font-sans); padding:4px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px; border-bottom:1px solid var(--hairline-dark); padding-bottom:4px;">
        <strong style="font-family:var(--font-serif); font-size:18px; color:var(--text-ink);">${st.full_name || st.name}</strong>
        <span class="badge ${st.avg_wait_time > 15 ? "badge-red" : "badge-green"}">${st.status}</span>
      </div>
      <div style="font-family:var(--font-mono); font-size:11px; margin-bottom:4px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Simulated Queue:</span>
        <strong style="color:var(--text-ink);">${st.waiting_commuters} pax</strong>
      </div>
      <div style="font-family:var(--font-mono); font-size:11px; margin-bottom:4px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Avg Wait Time:</span>
        <strong style="color:${waitColor}; font-weight:700;">${st.avg_wait_time} mins</strong>
      </div>
      <div style="font-family:var(--font-mono); font-size:11px; margin-bottom:4px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Dominant Persona:</span>
        <span>${st.dominant_persona}</span>
      </div>
      <div style="font-family:var(--font-mono); font-size:11px; margin-bottom:8px; display:flex; justify-content:space-between;">
        <span style="color:var(--text-muted);">Token Bounty Pool:</span>
        <strong style="color:var(--text-ink);">${st.token_pool} TK</strong>
      </div>
      <div style="font-family:var(--font-mono); font-size:10px; color:var(--text-ink); background:var(--bg-subtle); border:1px solid var(--hairline); padding:6px;">
        Primary: ${st.primary_route}
      </div>
    </div>
  `;
  marker.bindPopup(html, { offset: [0, -10] }).openPopup();
}

function updateLeafletMapMarkers(state) {
  if (!state || !state.stations) return;

  // Update Station Pin Colors based on live wait times
  Object.keys(state.stations).forEach((hubName) => {
    const st = state.stations[hubName];
    const hub = COIMBATORE_HUBS_GPS[hubName];
    if (!hub) return;

    const coreEl = document.getElementById(`pinCore-${hub.code}`);
    if (coreEl) {
      if (st.avg_wait_time > 15) {
        coreEl.style.background = "var(--accent-terracotta)";
        coreEl.style.borderColor = "var(--accent-terracotta)";
        coreEl.style.color = "#FFFFFF";
      } else if (st.avg_wait_time > 11.5) {
        coreEl.style.background = "var(--accent-ochre)";
        coreEl.style.borderColor = "var(--accent-ochre)";
        coreEl.style.color = "#FFFFFF";
      } else {
        coreEl.style.background = "var(--accent-forest)";
        coreEl.style.borderColor = "var(--accent-forest)";
        coreEl.style.color = "#FFFFFF";
      }
    }
  });

  // Update Route Polyline Colors based on load factor
  Object.keys(state.routes || {}).forEach((rtName) => {
    const rData = state.routes[rtName];
    const poly = leafletRoutePolylines[rData.id];
    if (poly) {
      const load = rData["load_factor_%"];
      let color = "#2E5A44"; // Balanced
      if (load >= 85) color = "#C85A32"; // High load (Terracotta)
      else if (load <= 35) color = "#8F5B1E"; // Underutilized (Ochre)
      poly.setStyle({ color: color });
    }
  });

  // Render Dynamic Ghost-Routes on Leaflet Map
  leafletGhostPolylines.forEach((p) => coimbatoreMap.removeLayer(p));
  leafletGhostPolylines = [];
  (state.ghost_routes || []).forEach((gr) => {
    const fromGps = COIMBATORE_HUBS_GPS[gr.from_hub];
    const toGps = COIMBATORE_HUBS_GPS[gr.to_hub];
    if (fromGps && toGps) {
      const poly = L.polyline(
        [
          [fromGps.lat, fromGps.lng],
          [toGps.lat, toGps.lng],
        ],
        {
          color: "#6B46C1",
          weight: 3.5,
          dashArray: "6, 6",
          opacity: 0.95,
        }
      ).addTo(coimbatoreMap);
      poly.bindTooltip(`[EXPRESS GHOST CORRIDOR] ${gr.id}`, { sticky: true });
      leafletGhostPolylines.push(poly);
    }
  });
}

// Animated GPS Bus Markers along Coimbatore Arterials
function initLeafletBusUnits() {
  if (!coimbatoreMap) return;
  leafletBusMarkers.forEach((m) => coimbatoreMap.removeLayer(m.marker));
  leafletBusMarkers = [];

  COIMBATORE_ROUTES_GPS.forEach((rt, idx) => {
    const orig = COIMBATORE_HUBS_GPS[rt.from];
    const dest = COIMBATORE_HUBS_GPS[rt.to];
    if (!orig || !dest) return;

    const busDiv = document.createElement("div");
    busDiv.className = "bus-marker-div";
    busDiv.textContent = `BUS-${rt.id.replace("R-", "")}`;

    const icon = L.divIcon({
      html: busDiv,
      className: "custom-bus-icon",
      iconSize: [52, 18],
      iconAnchor: [26, 9],
    });

    const marker = L.marker([orig.lat, orig.lng], { icon: icon }).addTo(coimbatoreMap);
    leafletBusMarkers.push({
      marker: marker,
      route: rt,
      from: orig,
      to: dest,
      progress: (idx * 0.12) % 1.0,
      speed: 0.003 + Math.random() * 0.002,
    });
  });
}

function startBusGpsSimulation() {
  function tick() {
    leafletBusMarkers.forEach((b) => {
      b.progress = (b.progress + b.speed) % 1.0;
      const lat = b.from.lat + (b.to.lat - b.from.lat) * b.progress;
      const lng = b.from.lng + (b.to.lng - b.from.lng) * b.progress;
      b.marker.setLatLng([lat, lng]);
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function switchMapView(mode) {
  activeMapView = mode;
  const leafletWrapper = document.getElementById("leafletMapWrapper");
  const canvasWrapper = document.getElementById("canvasMapWrapper");
  const btnLeaflet = document.getElementById("btnViewLeaflet");
  const btnCanvas = document.getElementById("btnViewCanvas");

  if (mode === "leaflet") {
    leafletWrapper.style.display = "block";
    canvasWrapper.style.display = "none";
    btnLeaflet.classList.add("active");
    btnCanvas.classList.remove("active");
    if (coimbatoreMap) {
      setTimeout(() => coimbatoreMap.invalidateSize(), 50);
    }
  } else {
    leafletWrapper.style.display = "none";
    canvasWrapper.style.display = "block";
    btnLeaflet.classList.remove("active");
    btnCanvas.classList.add("active");
  }
}

// ============================================================================
// MODEL RETRAINING ENGINE (TAB 5)
// ============================================================================

async function triggerModelRetraining() {
  const btn = document.getElementById("btnRetrainModel") || document.getElementById("btnTrainModel");
  const trees = parseInt(document.getElementById("sliderTrees")?.value || "25", 10);
  const lr = parseFloat(document.getElementById("sliderLr")?.value || "0.25");
  const badge = document.getElementById("trainStatusBadge") || document.getElementById("modelTrainingStatusBadge");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "Training 80/20 Holdout Model...";
  }
  if (badge) badge.textContent = "TRAINING...";

  try {
    const res = await authFetch("/api/train-model", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ n_trees: trees, learning_rate: lr }),
    });
    const data = await res.json();
    if (data.model) {
      renderModelRetrainingResults(data.model);
      if (badge) badge.textContent = "MODEL ACTIVE (80/20 VALIDATED)";
      appendTerminalLog(
        "ML_TRAINER",
        "RETRAIN_COMPLETE",
        `Blocked GBM retrained (${trees} trees, η=${lr}) in ${data.model.training_time_ms} ms with 80/20 holdout. ` +
        `Holdout Demand R²=${data.model.metrics.demand_r2_score}, Holdout Wait R²=${data.model.metrics.wait_time_r2_score}`
      );
    }
  } catch (err) {
    console.error("Model retrain error:", err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Retrain Model";
    }
  }
}

function renderModelRetrainingResults(model) {
  if (!model) return;
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl("trainTimeVal", `${model.training_time_ms} ms`);
  setEl("trainTimeMetric", `${model.training_time_ms} ms`);
  setEl("trainDemandR2Val", `${model.metrics.demand_r2_score}`);
  setEl("trainDemandR2Metric", `${model.metrics.demand_r2_score}`);
  setEl("trainDemandMaeVal", `MAE: ${model.metrics.demand_mae_passengers} pax`);
  setEl("trainWaitR2Val", `${model.metrics.wait_time_r2_score}`);
  setEl("trainWaitR2Metric", `${model.metrics.wait_time_r2_score}`);
  setEl("trainWaitMaeVal", `MAE: ${model.metrics.wait_time_mae_mins} mins`);
  setEl("trainWaitMaeMetric", `${model.metrics.wait_time_mae_mins}m`);
  setEl("trainLogBox", `[ML_STUDIO] 80/20 Train-Test Holdout Complete. Demand R²=${model.metrics.demand_r2_score}, Wait R²=${model.metrics.wait_time_r2_score} (${model.split_details?.train_blocks || 102} train blocks / ${model.split_details?.test_blocks || 26} test blocks).`);

  // Render Loss Convergence Bars
  const barsContainer = document.getElementById("lossCurveBars");
  if (barsContainer && model.loss_curve) {
    barsContainer.innerHTML = "";
    const losses = model.loss_curve.map((l) => l.wait_loss_rmse);
    const maxLoss = Math.max(...losses, 5.0);
    losses.forEach((loss, i) => {
      const h = Math.max(6, Math.round((loss / maxLoss) * 32));
      const bar = document.createElement("div");
      bar.className = "loss-bar-item";
      bar.style.height = `${h}px`;
      bar.title = `Round ${i + 1}: RMSE ${loss} mins`;
      barsContainer.appendChild(bar);
    });
    const finalLoss = losses[losses.length - 1];
    document.getElementById("lossConvergenceSummary").textContent = `Converged (Final RMSE: ${finalLoss} mins)`;
  }
}

function appendTerminalLog(sender, category, text) {
  const term = document.getElementById("terminalBox");
  if (!term) return;
  const now = new Date().toTimeString().split(" ")[0];
  const div = document.createElement("div");
  div.className = `log-entry cat-${category}`;
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; font-size:10px; opacity:0.75; margin-bottom:2px;">
      <strong>${sender}</strong>
      <span>${now}</span>
    </div>
    <div>${text}</div>
  `;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

// ============================================================================
// STATE FETCHING & ACTIONS
// ============================================================================

function switchTab(tabId, btnEl) {
  document.querySelectorAll(".tab-pane").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".tab-index-item, .tab-btn, .subnav-tab-item").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(tabId);
  if (target) target.classList.add("active");
  if (btnEl) btnEl.classList.add("active");

  const subBtn = document.getElementById(`subTab-${tabId.replace("tab-", "")}`);
  if (subBtn) subBtn.classList.add("active");

  syncChromeTabWithPane(tabId);

  if (tabId === "tab-map" && activeMapView === "leaflet" && coimbatoreMap) {
    setTimeout(() => coimbatoreMap.invalidateSize(), 50);
  }
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
  document.querySelectorAll(".btn-editorial, .btn-chaos").forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById(`btnScen-${scen}`);
  if (btn) btn.classList.add("active");
}

async function selectAndDisrupt(scen) {
  highlightScenarioBtn(scen);
  try {
    if (window.location.protocol === "file:" && window.OMNI_STANDALONE) {
      throw new Error("file_protocol");
    }
    const res = await authFetch("/api/disrupt", {
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
    const res = await authFetch("/api/optimize", {
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
    const res = await authFetch("/api/simulate-full", {
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
    const res = await authFetch("/api/simulate-full", {
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
      twinState.scenario_title = `Custom Shock (Rain ${Math.round(rain)}%, Demand +${Math.round(pop)}%)`;
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
    const res = await authFetch("/api/reset", { method: "POST" });
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

// ============================================================================
// TELEMETRY & WORKSPACE RENDERING
// ============================================================================

function renderAllTelemetry(data) {
  if (!data) return;

  // Header State
  const scenEl = document.getElementById("activeScenarioTitle");
  if (scenEl) scenEl.textContent = data.scenario_title;
  const wEl = document.getElementById("activeWeatherBadge");
  if (wEl) wEl.textContent = `${data.weather_condition} • ${String(data.simulated_hour).padStart(2, "0")}:00`;

  // Broadsheet Telemetry Ledger
  const stats = computeAggregateKpis(data);
  const avgWaitEl = document.getElementById("kpiAvgWait");
  if (avgWaitEl) avgWaitEl.innerHTML = `${stats.avgWait} <span style="font-size:16px; font-family:var(--font-mono); color:var(--text-muted);">min</span>`;
  const waitSubEl = document.getElementById("kpiWaitSub");
  if (waitSubEl) waitSubEl.textContent = `15.0m SLA • ${stats.avgWait > 15 ? "[CRITICAL_BREACH]" : "[COMPLIANT]"}`;

  const totalWaitEl = document.getElementById("kpiTotalWaiting");
  if (totalWaitEl) totalWaitEl.innerHTML = `${stats.totalWaiting} <span style="font-size:16px; font-family:var(--font-mono); color:var(--text-muted);">pax</span>`;
  const critHubsEl = document.getElementById("kpiCriticalHubs");
  if (critHubsEl) critHubsEl.textContent = `${stats.criticalHubCount} Critical Bottlenecks (>15m)`;

  const tokensTradedEl = document.getElementById("kpiTokensTraded");
  if (tokensTradedEl) tokensTradedEl.innerHTML = `${data.esg_ledger.total_tokens_traded} <span style="font-size:16px; font-family:var(--font-mono); color:var(--text-muted);">TK</span>`;
  const ghostRoutesEl = document.getElementById("kpiGhostRoutes");
  if (ghostRoutesEl) ghostRoutesEl.textContent = `${data.ghost_routes ? data.ghost_routes.length : 0} Express Ghost-Routes`;

  const carbonSavedEl = document.getElementById("kpiCarbonSaved");
  if (carbonSavedEl) carbonSavedEl.innerHTML = `${data.esg_ledger.co2_prevented_kg} <span style="font-size:16px; font-family:var(--font-mono); color:var(--text-muted);">kg</span>`;
  const esgRevEl = document.getElementById("kpiEsgRevenue");
  if (esgRevEl) esgRevEl.textContent = `$${data.esg_ledger.estimated_esg_revenue_usd} / ₹${Math.round(data.esg_ledger.estimated_esg_revenue_inr).toLocaleString()}`;

  const activeFleetEl = document.getElementById("kpiActiveFleet");
  if (activeFleetEl) activeFleetEl.innerHTML = `${stats.activeBuses} <span style="font-size:16px; font-family:var(--font-mono); color:var(--text-muted);">buses</span>`;

  // Station Hub Rows in Drawer (Tab 1 - Clean & Unboxed)
  const stationsGrid = document.getElementById("stationsGrid");
  if (stationsGrid) {
    stationsGrid.innerHTML = "";
    Object.keys(data.stations || {}).forEach((sKey) => {
      const st = data.stations[sKey];
      const row = document.createElement("div");
      row.className = "station-row-item";
      row.onclick = () => panToStation(sKey);

      let badgeClass = "";
      if (st.avg_wait_time > 15) badgeClass = "critical";
      else if (st.avg_wait_time > 11.5) badgeClass = "moderate";

      row.innerHTML = `
        <div class="station-row-info">
          <span class="station-row-name">${st.name}</span>
          <span class="station-row-sub">Queue: ${st.waiting_commuters} pax • Persona: ${st.dominant_persona}</span>
        </div>
        <span class="station-row-badge ${badgeClass}">${st.avg_wait_time}m wait</span>
      `;
      stationsGrid.appendChild(row);
    });
  }

  // EV Fleet in Drawer
  const evGrid = document.getElementById("evFleetGrid");
  if (evGrid) {
    evGrid.innerHTML = "";
    (data.ev_fleet_units || []).forEach((ev) => {
      const isLocked = ev.soc_pct < 25;
      const socColor = isLocked ? "var(--accent-danger)" : ev.soc_pct > 75 ? "var(--accent-success)" : "var(--accent-warning)";
      const div = document.createElement("div");
      div.style.cssText = "padding:8px 12px; background:#F8F9FA; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;";
      div.innerHTML = `
        <div>
          <strong>${ev.unit_id}</strong> <span style="color:var(--text-secondary); font-size:11px;">(${ev.route})</span>
          <div style="font-size:10px; color:${isLocked ? 'var(--accent-danger)' : 'var(--text-secondary)'};">
            ${isLocked ? 'LOW BATTERY (HOLD)' : 'ACTIVE IN TRANSIT'}
          </div>
        </div>
        <div style="font-weight:700; color:${socColor};">${ev.soc_pct}%</div>
      `;
      evGrid.appendChild(div);
    });
  }

  // Schedule Comparison Matrix (Tab 2)
  const tbody = document.getElementById("comparisonTableBody");
  if (tbody) {
    tbody.innerHTML = "";
    (data.comparison_table || []).forEach((row) => {
      const tr = document.createElement("tr");
      const improved = row.wait_delta_mins < 0;
      tr.innerHTML = `
        <td>
          <strong>${row.hub_name}</strong><br/>
          <span style="font-size:11px; color:var(--text-secondary);">${row.dominant_persona}</span>
        </td>
        <td>
          <div style="font-weight:600;">${row.primary_route}</div>
          <div style="font-size:11px; color:var(--text-secondary);">Alt: ${row.alternative_route}</div>
        </td>
        <td>
          <strong style="color:${row.disrupted_wait_mins > 15 ? 'var(--accent-danger)' : 'var(--text-primary)'};">${row.disrupted_wait_mins} mins</strong>
          <div style="font-size:11px; color:var(--text-secondary);">${row.disrupted_demand_pax} pax &bull; ${row.route_load_pct}% crowding</div>
        </td>
        <td>
          <strong style="color:var(--accent-success);">${row.optimized_wait_mins} mins</strong>
          ${improved ? `<span style="font-size:10px; color:var(--accent-success); font-weight:700;">(-${Math.abs(row.wait_delta_mins)}m)</span>` : ""}
          <div style="font-size:11px; color:var(--text-secondary);">${row.optimized_demand_pax} pax &bull; est.</div>
        </td>
        <td>
          ${row.scheduled_headway_mins}m ➔ <strong>${row.recommended_headway_mins}m</strong>
          <div style="font-size:11px; color:var(--text-secondary);">${row.active_buses} buses</div>
        </td>
        <td style="font-size:12px; color:var(--text-secondary); max-width:300px;">
          ${row.why_recommended}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // B2C Commuter Advisories
  const compGrid = document.getElementById("companionGrid");
  if (compGrid) {
    compGrid.innerHTML = "";
    (data.commuter_companion_advisories || []).forEach((adv) => {
      const div = document.createElement("div");
      div.style.cssText = "padding:14px; background:#FFFFFF; border:1px solid var(--chrome-border-mid); border-radius:8px;";
      div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <strong>[ADVISORY] ${adv.hub_name}</strong>
          <span style="font-size:11px; color:var(--accent-primary); font-weight:600;">~${adv.simulated_wait_mins}m est.</span>
        </div>
        <div style="font-size:12px; margin-bottom:6px; color:var(--text-primary);">${adv.message}</div>
        <div style="font-size:11px; color:var(--text-secondary);">Recommended Corridor: <strong>${adv.recommended_route}</strong></div>
      `;
      compGrid.appendChild(div);
    });
  }

  // Optional Causal Report
  const causalEl = document.getElementById("causalReportContainer");
  if (causalEl) {
    causalEl.innerHTML = renderMarkdown(data.causal_report_markdown || "");
  }

  // Update Real Coimbatore Leaflet GIS Map Markers
  updateLeafletMapMarkers(data);

  // Update Google Maps Markers (if Google Maps active)
  updateGoogleMapMarkers(data);

  // Synchronize Robust Optimization & MPC
  fetchRobustMatrix();
  fetchMpcHorizon(activeMpcMode);
  if (activeSelectedStation) {
    showSpatialHud(activeSelectedStation);
  }
}

function computeAggregateKpis(data) {
  const stations = Object.values(data.stations || {});
  const routes = Object.values(data.routes || {});
  const totalWait = stations.reduce((s, st) => s + st.avg_wait_time, 0);
  const avgWait = stations.length ? (totalWait / stations.length).toFixed(1) : "0.0";
  const totalWaiting = stations.reduce((s, st) => s + st.waiting_commuters, 0);
  const criticalHubCount = stations.filter((st) => st.avg_wait_time > 15.0).length;
  const activeBuses = routes.reduce((s, rt) => s + rt.active_buses, 0);
  return { avgWait, totalWaiting, criticalHubCount, activeBuses };
}

function renderDatasetExplorer(stats) {
  if (!stats) return;

  // 24-Hour Load Chart
  const chart = document.getElementById("hourlyChart");
  chart.innerHTML = "";
  const profile = stats.hourly_profile || [];
  const maxDem = Math.max(...profile.map((p) => p.avg_demand), 220);

  profile.forEach((p) => {
    const isPeak = p.is_busy_period;
    const h = Math.max(8, Math.round((p.avg_demand / maxDem) * 58));
    const bar = document.createElement("div");
    bar.className = `hourly-bar ${isPeak ? "peak" : ""}`;
    bar.style.height = `${h}px`;
    bar.title = `${String(p.hour).padStart(2, "0")}:00 - Avg Demand: ${p.avg_demand} pax (${p.busy_tag})`;
    chart.appendChild(bar);
  });

  // Persona Cohorts Table
  const pBody = document.getElementById("personaTableBody");
  pBody.innerHTML = "";
  (stats.personas || []).forEach((p) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.persona}</strong></td>
      <td style="font-family:var(--font-mono);">${p.patience_mins} mins</td>
      <td style="font-family:var(--font-mono);">${p.share_pct}%</td>
      <td><span class="badge ${p.abandonment_multiplier > 1.25 ? "badge-red" : "badge-green"}">${p.abandonment_multiplier}x</span></td>
    `;
    pBody.appendChild(tr);
  });

  // Distressed Smart Blocks
  const bBody = document.getElementById("blocksTableBody");
  bBody.innerHTML = "";
  (stats.top_distressed_blocks || []).slice(0, 8).forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><code>${b.block_key}</code></td>
      <td style="font-family:var(--font-mono);">${b.record_count.toLocaleString()}</td>
      <td style="font-family:var(--font-mono);">${b.avg_demand} pax</td>
      <td style="font-family:var(--font-mono); color:#ef4444; font-weight:700;">${b.avg_wait_mins} mins</td>
      <td style="font-family:var(--font-mono); color:#38bdf8;">${b.avg_bounty} TK</td>
    `;
    bBody.appendChild(tr);
  });
}

async function runBlockPrediction() {
  const hub = document.getElementById("predHub").value;
  const bucket = document.getElementById("predBucket").value;
  const weather = document.getElementById("predWeather").value;
  const headway = document.getElementById("predHeadway").value;

  try {
    const res = await fetch(`/api/predict-demand?hub_code=${hub}&time_bucket=${bucket}&weather_code=${weather}&headway_mins=${headway}`);
    const data = await res.json();
    renderBlockPredictionResult(data);
  } catch (err) {
    console.error("Predict error:", err);
  }
}

function renderBlockPredictionResult(pred) {
  const box = document.getElementById("predResultBox");
  if (!box || !pred) return;
  const isHighWait = pred.predicted_wait_mins > 15;
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
      <span style="color:var(--text-muted); font-size:11px;">MATCHED SMART BLOCK: <code>${pred.block_key}</code></span>
      <span class="badge ${isHighWait ? "badge-red" : "badge-green"}">${pred.status}</span>
    </div>
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:8px; font-family:var(--font-mono);">
      <div>
        <span style="font-size:10.5px; color:var(--text-dim); display:block;">EST. DEMAND</span>
        <strong style="font-size:15px; color:#fff;">${pred.predicted_demand_passengers} pax</strong>
      </div>
      <div>
        <span style="font-size:10.5px; color:var(--text-dim); display:block;">EST. WAIT TIME</span>
        <strong style="font-size:15px; color:${isHighWait ? "#ef4444" : "#10b981"};">${pred.predicted_wait_mins} mins</strong>
      </div>
      <div>
        <span style="font-size:10.5px; color:var(--text-dim); display:block;">BUS LOAD FACTOR</span>
        <strong style="font-size:15px; color:#38bdf8;">${pred.predicted_load_factor_pct}%</strong>
      </div>
      <div>
        <span style="font-size:10.5px; color:var(--text-dim); display:block;">EQUILIBRIUM BOUNTY</span>
        <strong style="font-size:15px; color:#f59e0b;">${pred.predicted_bounty_tokens} TK</strong>
      </div>
    </div>
  `;
}

// ============================================================================
// ROBUST OPTIMIZATION & MPC HORIZON
// ============================================================================

async function fetchRobustMatrix() {
  try {
    const res = await fetch("/api/robust-matrix");
    const data = await res.json();
    robustMatrixData = data;
    renderRobustMatrix(data);
  } catch (err) {
    console.error("Robust matrix error:", err);
  }
}

function renderRobustMatrix(data) {
  if (!data || !data.strategies_matrix) return;
  const tBody = document.getElementById("robustStrategiesTableBody");
  tBody.innerHTML = "";
  data.strategies_matrix.forEach((st) => {
    const isRec = st.strategy_id === data.recommended_strategy;
    const tr = document.createElement("tr");
    tr.style.background = isRec ? "rgba(16, 185, 129, 0.08)" : "transparent";
    tr.innerHTML = `
      <td>
        <strong>${st.strategy_name}</strong>
        ${isRec ? `<span class="strategy-badge-recommended" style="margin-left:6px;">Recommended</span>` : ""}
      </td>
      <td style="font-family:var(--font-mono);">${st.fleet_size_buses} buses</td>
      <td style="font-family:var(--font-mono); font-weight:700;">${st.expected_wait_mins} mins</td>
      <td style="font-family:var(--font-mono); color:${st.worst_case_wait_mins > 20 ? "#ef4444" : "#f1f5f9"};">${st.worst_case_wait_mins} mins</td>
      <td style="font-family:var(--font-mono);">${st.expected_left_behind_pax} pax</td>
      <td style="font-family:var(--font-mono); color:${st.worst_case_left_behind_pax > 100 ? "#ef4444" : "#10b981"};">${st.worst_case_left_behind_pax} pax</td>
      <td style="font-family:var(--font-mono); color:#10b981; font-weight:700;">${st.resilience_score_pct}%</td>
      <td>
        <span class="badge ${st.policy_verdict === "SURVIVES_ALL_SHOCKS" ? "badge-green" : st.policy_verdict === "CAPACITY_COLLAPSE_UNDER_SURGE" ? "badge-red" : "badge-amber"}">
          ${st.policy_verdict}
        </span>
      </td>
    `;
    tBody.appendChild(tr);
  });
  const justBox = document.getElementById("robustJustificationBox");
  if (justBox) justBox.textContent = data.minimax_justification;
  fetchConstraintsAudit();
}

async function fetchConstraintsAudit() {
  try {
    const res = await fetch("/api/constraints-audit");
    const data = await res.json();
    renderConstraintsAudit(data);
  } catch (err) {
    console.error("Audit error:", err);
  }
}

function renderConstraintsAudit(audit) {
  if (!audit || !audit.audit_breakdown) return;
  const cBody = document.getElementById("constraintsTableBody");
  cBody.innerHTML = "";
  audit.audit_breakdown.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${c.constraint_name}</strong></td>
      <td style="font-family:var(--font-mono); color:var(--text-muted);">${c.required_threshold}</td>
      <td style="font-family:var(--font-mono); font-weight:700; color:#38bdf8;">${c.candidate_value}</td>
      <td>
        <span class="badge ${c.audit_status === "FEASIBLE" ? "badge-green" : "badge-red"}">
          ${c.audit_status}
        </span>
      </td>
      <td style="font-size:11px; color:#cbd5e1;">${c.rationale}</td>
    `;
    cBody.appendChild(tr);
  });
}

async function fetchMpcHorizon(mode) {
  activeMpcMode = mode;
  try {
    const res = await fetch(`/api/mpc-horizon?mode=${mode}`);
    const data = await res.json();
    mpcHorizonData = data;
    renderMpcHorizon(data);
  } catch (err) {
    console.error("MPC error:", err);
  }
}

function setMpcMode(mode) {
  document.getElementById("btnMpcAdaptive")?.classList.toggle("active", mode === "ADAPTIVE_MPC");
  document.getElementById("btnMpcStatic")?.classList.toggle("active", mode === "UNCONTROLLED_BASELINE");
  fetchMpcHorizon(mode);
}

function renderMpcHorizon(data) {
  if (!data || !data.horizon_steps) return;
  document.getElementById("mpcActiveModeLabel").textContent = data.control_mode;
  document.getElementById("mpcStabilityIndex").textContent = `${data.summary.headway_stability_index}%`;
  document.getElementById("mpcTotalDenied").textContent = `${data.summary.total_denied_boarding_passengers} pax`;
  document.getElementById("mpcTotalServed").textContent = `${data.summary.total_passengers_served.toLocaleString()} pax`;

  const cardsCont = document.getElementById("mpcTimelineCards");
  cardsCont.innerHTML = "";
  data.horizon_steps.forEach((step) => {
    const card = document.createElement("div");
    card.className = "mpc-step-card";
    card.innerHTML = `
      <div class="mpc-step-minute">T+${step.minute} MINS</div>
      <div class="mpc-step-wait" style="color:${step.avg_simulated_wait_mins > 15 ? "#ef4444" : "#10b981"};">
        ${step.avg_simulated_wait_mins}m wait
      </div>
      <div class="mpc-step-queue">${step.total_network_queue} pax queued</div>
      <div class="mpc-step-denied">${step.denied_boarding_pax > 0 ? `Denied: ${step.denied_boarding_pax}` : "Denied: 0"}</div>
    `;
    cardsCont.appendChild(card);
  });

  const sBody = document.getElementById("mpcStationTableBody");
  sBody.innerHTML = "";
  (data.station_queue_dynamics || []).forEach((st) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${st.station_name}</strong></td>
      <td style="font-family:var(--font-mono);">${st.incoming_passenger_rate_per_min} pax/min</td>
      <td style="font-family:var(--font-mono);">${st.service_rate_per_min} pax/min</td>
      <td style="font-family:var(--font-mono); color:#10b981;">${st.passengers_boarded_60m} pax</td>
      <td style="font-family:var(--font-mono); color:${st.passengers_denied_boarding > 0 ? "#ef4444" : "#f1f5f9"};">${st.passengers_denied_boarding} pax</td>
      <td style="font-family:var(--font-mono);">${st.final_remaining_queue} pax</td>
      <td style="font-family:var(--font-mono); font-weight:700; color:${st.estimated_wait_at_60m > 15 ? "#ef4444" : "#38bdf8"};">${st.estimated_wait_at_60m} mins</td>
    `;
    sBody.appendChild(tr);
  });
}

// ============================================================================
// SPATIAL CANVAS ENGINE (TOPOLOGY FALLBACK SCHEMATIC)
// ============================================================================

function initCanvasAnimation() {
  const canvas = document.getElementById("twinCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio;
    canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function loop() {
    animTick++;
    drawCanvas(canvas, ctx);
    animFrameId = requestAnimationFrame(loop);
  }
  loop();
}

function projectSpatialCoords(normX, normY, W, H, elev = 0) {
  if (spatialViewMode === "2D") {
    return {
      x: normX * (W - 80) + 40,
      y: normY * (H - 80) + 40 - elev * 0.7,
    };
  }
  const isoX = normX - normY;
  const isoY = (normX + normY) * 0.5;
  const cx = W * 0.5;
  const cy = H * 0.45;
  const scale = Math.min(W, H) * 0.72;
  return {
    x: cx + isoX * scale * 0.72,
    y: cy + isoY * scale * 0.58 - elev * 0.85,
  };
}

function drawCanvas(canvas, ctx) {
  const W = canvas.parentElement.clientWidth;
  const H = canvas.parentElement.clientHeight;
  ctx.clearRect(0, 0, W, H);

  // Background Grid Lines (Exposed Hairlines)
  ctx.save();
  ctx.strokeStyle = "rgba(18, 18, 18, 0.08)";
  ctx.lineWidth = 1;
  const gridSteps = 10;
  for (let i = 0; i <= gridSteps; i++) {
    const f = i / gridSteps;
    const p1 = projectSpatialCoords(f, 0, W, H, 0);
    const p2 = projectSpatialCoords(f, 1, W, H, 0);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    const p3 = projectSpatialCoords(0, f, W, H, 0);
    const p4 = projectSpatialCoords(1, f, W, H, 0);
    ctx.beginPath();
    ctx.moveTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.stroke();
  }
  ctx.restore();

  if (!twinState || !twinState.stations) return;
  const stations = twinState.stations;
  const routes = Object.values(twinState.routes || {});

  // Corridors & Road Network
  if (spatialLayers.corridors) {
    routes.forEach((rt, rIdx) => {
      const orig = stations[rt.origin];
      const dest = stations[rt.destination];
      if (!orig || !dest) return;

      const p1 = projectSpatialCoords(orig.map_x, orig.map_y, W, H, spatialViewMode === "3D" ? 6 : 0);
      const p2 = projectSpatialCoords(dest.map_x, dest.map_y, W, H, spatialViewMode === "3D" ? 6 : 0);

      let strokeColor = "#2E5A44"; // Forest Green
      if (rt["load_factor_%"] >= 85) strokeColor = "#C85A32"; // Terracotta
      else if (rt["load_factor_%"] <= 35) strokeColor = "#8F5B1E"; // Ochre

      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Swarm Flow Particles (Ink dots)
      if (spatialLayers.particles) {
        commuterParticles
          .filter((p) => p.routeIdx === rIdx)
          .forEach((p) => {
            p.progress = (p.progress + p.speed) % 1.0;
            const px = p1.x + (p2.x - p1.x) * p.progress;
            const py = p1.y + (p2.y - p1.y) * p.progress;
            ctx.fillStyle = "#121212";
            ctx.beginPath();
            ctx.arc(px, py, 2.0, 0, Math.PI * 2);
            ctx.fill();
          });
      }
      ctx.restore();
    });
  }

  // Station Nodes (Solid ink stamp nodes, NO glowing neon blur)
  Object.keys(stations).forEach((sKey) => {
    const st = stations[sKey];
    const elev = spatialViewMode === "3D" ? 18 : 0;
    const pt = projectSpatialCoords(st.map_x, st.map_y, W, H, elev);

    let nodeColor = "#2E5A44";
    if (st.avg_wait_time > 15) nodeColor = "#C85A32";
    else if (st.avg_wait_time > 11.5) nodeColor = "#8F5B1E";

    ctx.save();
    ctx.fillStyle = nodeColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
    ctx.fill();

    // Solid border ring
    ctx.strokeStyle = "#121212";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#121212";
    ctx.font = "bold 10px var(--font-mono)";
    ctx.fillText(st.name, pt.x - 28, pt.y - 12);
    ctx.restore();
  });
}

function initCanvasInteraction() {
  const canvas = document.getElementById("twinCanvas");
  if (!canvas) return;
  canvas.addEventListener("click", (evt) => {
    if (!twinState || !twinState.stations) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = evt.clientX - rect.left;
    const clickY = evt.clientY - rect.top;
    const W = rect.width;
    const H = rect.height;

    let closest = null;
    let minDist = 35;
    Object.keys(twinState.stations).forEach((sKey) => {
      const st = twinState.stations[sKey];
      const pt = projectSpatialCoords(st.map_x, st.map_y, W, H, spatialViewMode === "3D" ? 18 : 0);
      const d = Math.hypot(clickX - pt.x, clickY - pt.y);
      if (d < minDist) {
        minDist = d;
        closest = sKey;
      }
    });
    if (closest) showSpatialHud(closest);
  });
}

function toggleSpatial3DMode() {
  spatialViewMode = spatialViewMode === "3D" ? "2D" : "3D";
  document.getElementById("spatialModeText").textContent = spatialViewMode === "3D" ? "3D Isometric Mode" : "2D Orthographic";
}

function toggleSpatialLayer(layerKey, btnEl) {
  spatialLayers[layerKey] = !spatialLayers[layerKey];
  btnEl.classList.toggle("active", spatialLayers[layerKey]);
}

function showSpatialHud(hubName) {
  activeSelectedStation = hubName;
  if (!twinState || !twinState.stations) return;
  const st = twinState.stations[hubName];
  if (!st) return;

  const hud = document.getElementById("spatialHudOverlay");
  if (!hud) return;
  hud.style.display = "block";
  document.getElementById("hudStationName").textContent = st.name;
  document.getElementById("hudQueue").textContent = `${st.waiting_commuters} pax`;
  const waitEl = document.getElementById("hudWait");
  waitEl.textContent = `${st.avg_wait_time} mins`;
  waitEl.style.color = st.avg_wait_time > 15 ? "#ef4444" : st.avg_wait_time > 11.5 ? "#f59e0b" : "#10b981";
  document.getElementById("hudPersona").textContent = st.dominant_persona;
  document.getElementById("hudTokens").textContent = `${st.token_pool} TK`;
  document.getElementById("hudRoutes").textContent = `${st.primary_route} / ${st.alt_route}`;

  const riskEl = document.getElementById("hudDeniedRisk");
  if (st.avg_wait_time > 15) {
    riskEl.textContent = "CRITICAL (38.4%)";
    riskEl.style.color = "#ef4444";
  } else {
    riskEl.textContent = "LOW (3.2%)";
    riskEl.style.color = "#10b981";
  }
}

function closeSpatialHud() {
  const hud = document.getElementById("spatialHudOverlay");
  if (hud) hud.style.display = "none";
  activeSelectedStation = null;
}

function copyGenAiPrompt() {
  const txt = document.getElementById("rawPromptBox").textContent;
  if (!txt) return;
  navigator.clipboard.writeText(txt).then(() => {
    alert("Raw GenAI Architect prompt copied to clipboard.");
  });
}

function renderMarkdown(md) {
  if (!md) return "";
  return md
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^#### (.*$)/gim, "<h4>$1</h4>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(/`([^`]+)`/gim, "<code>$1</code>")
    .replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>")
    .replace(/\n\n/gim, "<p></p>")
    .replace(/\n/gim, "<br/>");
}

// ============================================================================
// CHROMIUM / GOOGLE CHROME DESKTOP WINDOW CONTROLLER
// ============================================================================

const TAB_URL_MAP = {
  "tab-map": "https://omnitransit.coimbatore.gov.in/live-map",
  "tab-routes": "https://omnitransit.coimbatore.gov.in/schedules",
  "tab-advanced": "https://omnitransit.coimbatore.gov.in/diagnostics",
};

let chromeHistory = ["tab-map"];
let chromeHistoryIdx = 0;

function syncChromeTabWithPane(tabId) {
  document.querySelectorAll(".chrome-tab").forEach((t) => {
    if (t.dataset.tab === tabId) {
      t.classList.add("active");
    } else {
      t.classList.remove("active");
    }
  });

  const url = TAB_URL_MAP[tabId] || `https://omnitransit.coimbatore.gov.in/${tabId.replace("tab-", "")}`;
  const inputEl = document.getElementById("chromeOmniboxInput");
  if (inputEl) inputEl.value = url;
}

function activateChromeTab(tabId, el) {
  if (!tabId) return;

  // Protect Admin Diagnostics Tab
  if (tabId === "tab-advanced") {
    const isAdmin = currentUser && (currentUser.username === "admin" || currentUser.role === "admin" || (currentUser.role && currentUser.role.toLowerCase().includes("architect")));
    if (!isAdmin) {
      openLoginModal();
      const errBox = document.getElementById("loginStatusMsg") || document.getElementById("authErrorMessage");
      if (errBox) {
        errBox.textContent = "Operator Credentials Required: The Advanced ML & Diagnostics Studio is restricted to authorized transit staff.";
        errBox.style.color = "var(--accent-danger)";
        errBox.style.display = "block";
      }
      return;
    }
  }

  // Switch views
  document.querySelectorAll(".tab-pane").forEach((p) => {
    p.classList.remove("active");
    if (p.id === tabId) {
      p.classList.add("active");
      p.style.display = "block";
    } else if (p.id === "tab-advanced") {
      p.style.display = "none";
    }
  });

  // Activate Tab Header / Nav Menu Items
  document.querySelectorAll(".nav-menu-item, .chrome-tab").forEach((t) => t.classList.remove("active"));
  const btnMap = {
    "tab-map": "navBtn-map",
    "tab-routes": "navBtn-routes",
    "tab-advisory": "navBtn-advisory",
    "tab-advanced": "navBtn-advanced",
  };
  const activeBtnId = btnMap[tabId];
  if (activeBtnId) {
    document.getElementById(activeBtnId)?.classList.add("active");
  }
  if (el && el.classList) {
    el.classList.add("active");
  }

  // Update Omnibox if present
  const url = TAB_URL_MAP[tabId] || `https://omnitransit.coimbatore.gov.in/${tabId.replace("tab-", "")}`;
  const inputEl = document.getElementById("chromeOmniboxInput");
  if (inputEl) inputEl.value = url;

  // Manage Nav History
  if (chromeHistory[chromeHistoryIdx] !== tabId) {
    chromeHistory = chromeHistory.slice(0, chromeHistoryIdx + 1);
    chromeHistory.push(tabId);
    chromeHistoryIdx = chromeHistory.length - 1;
  }
  updateNavButtonsState();

  if (tabId === "tab-map") {
    if (activeMapProvider === "google" && googleMap && window.google) {
      setTimeout(() => google.maps.event.trigger(googleMap, "resize"), 60);
    } else if (coimbatoreMap) {
      setTimeout(() => coimbatoreMap.invalidateSize(), 60);
    }
  } else if (tabId === "tab-advisory") {
    renderCorridorsAdvisoryGrid();
    updateTripAdvisoryAdvice();
  }
}

function updateNavButtonsState() {
  const backBtn = document.getElementById("chromeNavBack");
  const forwardBtn = document.getElementById("chromeNavForward");
  if (backBtn) {
    if (chromeHistoryIdx > 0) backBtn.classList.remove("disabled");
    else backBtn.classList.add("disabled");
  }
  if (forwardBtn) {
    if (chromeHistoryIdx < chromeHistory.length - 1) forwardBtn.classList.remove("disabled");
    else forwardBtn.classList.add("disabled");
  }
}

function chromeGoBack() {
  if (chromeHistoryIdx > 0) {
    chromeHistoryIdx--;
    const prevTab = chromeHistory[chromeHistoryIdx];
    activateChromeTab(prevTab);
  }
}

function chromeGoForward() {
  if (chromeHistoryIdx < chromeHistory.length - 1) {
    chromeHistoryIdx++;
    const nextTab = chromeHistory[chromeHistoryIdx];
    activateChromeTab(nextTab);
  }
}

function chromeReload() {
  const reloadBtn = document.getElementById("chromeNavReload");
  if (reloadBtn) reloadBtn.classList.add("spinning");

  fetchDigitalTwinState().finally(() => {
    setTimeout(() => {
      if (reloadBtn) reloadBtn.classList.remove("spinning");
    }, 500);
  });
}

function handleOmniboxKey(event) {
  if (event.key === "Enter") {
    const val = (event.target.value || "").toLowerCase();
    if (val.includes("diag") || val.includes("model") || val.includes("train") || val.includes("ml")) {
      activateChromeTab("tab-advanced");
    } else if (val.includes("route") || val.includes("schedule") || val.includes("bus")) {
      activateChromeTab("tab-routes");
    } else {
      activateChromeTab("tab-map");
    }
    event.target.blur();
  }
}

function createNewChromeTab() {
  const tabs = ["tab-map", "tab-routes", "tab-advanced"];
  const current = document.querySelector(".chrome-tab.active");
  const curTab = current ? current.dataset.tab : "tab-map";
  const next = tabs[(tabs.indexOf(curTab) + 1) % tabs.length];
  activateChromeTab(next);
}

function closeChromeTab(event, tabIdOrElementId) {
  if (event) event.stopPropagation();
  const el = document.getElementById(tabIdOrElementId) || document.querySelector(`.chrome-tab[data-tab="${tabIdOrElementId}"]`);
  if (!el) return;

  const wasActive = el.classList.contains("active");
  el.style.display = "none";

  if (wasActive) {
    const visibleTabs = Array.from(document.querySelectorAll(".chrome-tab")).filter((t) => t.style.display !== "none");
    if (visibleTabs.length > 0) {
      activateChromeTab(visibleTabs[0].dataset.tab, visibleTabs[0]);
    }
  }
}

function toggleChromeMenu() {
  const menu = document.getElementById("chromeDropdownMenu");
  if (!menu) return;
  menu.style.display = menu.style.display === "none" ? "block" : "none";
}

// Close Chrome menu when clicking outside
window.addEventListener("click", (e) => {
  const menu = document.getElementById("chromeDropdownMenu");
  const menuBtn = document.getElementById("chromeMenuBtn");
  if (menu && menu.style.display === "block") {
    if (!menu.contains(e.target) && !menuBtn.contains(e.target)) {
      menu.style.display = "none";
    }
  }
});

// ============================================================================
// GOOGLE MAPS JAVASCRIPT API INTEGRATION ENGINE
// ============================================================================

async function initGoogleMapsConfiguration() {
  try {
    const res = await fetch("/api/config");
    const cfg = await res.json();
    if (cfg.google_maps_api_key) {
      googleMapsApiKey = cfg.google_maps_api_key;
      localStorage.setItem("omnitransit_google_maps_key", googleMapsApiKey);
    }
  } catch (err) {}

  const badgeStatus = document.getElementById("gmapsStatusText");
  const banner = document.getElementById("gmapsSetupBanner");

  if (googleMapsApiKey) {
    if (badgeStatus) badgeStatus.textContent = "Active";
    if (banner) banner.style.display = "none";
    loadGoogleMapsApi(googleMapsApiKey);
  } else {
    if (badgeStatus) badgeStatus.textContent = "Connect API Key";
    if (banner) banner.style.display = "flex";
  }
}

function loadGoogleMapsApi(apiKey) {
  if (!apiKey) return;
  if (window.google && window.google.maps) {
    initGoogleMap();
    return;
  }
  const existing = document.getElementById("googleMapsScript");
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.id = "googleMapsScript";
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    initGoogleMap();
  };
  script.onerror = () => {
    console.warn("[Google Maps] Failed to load. Check API Key permissions.");
    const badgeStatus = document.getElementById("gmapsStatusText");
    if (badgeStatus) badgeStatus.textContent = "Invalid Key";
  };
  document.head.appendChild(script);
}

function initGoogleMap() {
  const gEl = document.getElementById("googleMapContainer");
  const lEl = document.getElementById("leafletMapContainer");
  if (!gEl) return;

  gEl.style.display = "block";
  if (lEl) lEl.style.display = "none";
  activeMapProvider = "google";

  const lbl = document.getElementById("lblMapProvider");
  if (lbl) lbl.textContent = "Switch to Vector Map";
  const badgeStatus = document.getElementById("gmapsStatusText");
  if (badgeStatus) badgeStatus.textContent = "Active";

  googleMap = new google.maps.Map(gEl, {
    center: { lat: 11.025, lng: 77.010 },
    zoom: 12,
    mapTypeControl: true,
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.TOP_RIGHT,
    },
    fullscreenControl: false,
    streetViewControl: false,
    zoomControl: true,
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
    styles: [
      { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
    ]
  });

  // Plot Stations on Google Maps
  googleStationMarkers = {};
  Object.keys(COIMBATORE_HUBS_GPS).forEach((hubName) => {
    const hub = COIMBATORE_HUBS_GPS[hubName];
    const marker = new google.maps.Marker({
      position: { lat: hub.lat, lng: hub.lng },
      map: googleMap,
      title: hub.name,
      label: {
        text: hub.code,
        color: "#FFFFFF",
        fontSize: "10px",
        fontWeight: "700",
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: "#188038",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 2,
      },
    });

    const info = new google.maps.InfoWindow({
      content: `
        <div style="font-family:system-ui; padding:6px; min-width:180px;">
          <strong style="font-size:14px; color:#202124;">${hub.name}</strong><br/>
          <div style="font-size:11px; color:#5f6368; margin-top:2px;">Metropolitan Hub Code: ${hub.code}</div>
        </div>
      `,
    });

    marker.addListener("click", () => {
      info.open(googleMap, marker);
    });

    googleStationMarkers[hubName] = { marker, info };
  });

  // Plot Routes on Google Maps
  googleRoutePolylines = {};
  COIMBATORE_ROUTES_GPS.forEach((rt) => {
    const orig = COIMBATORE_HUBS_GPS[rt.from];
    const dest = COIMBATORE_HUBS_GPS[rt.to];
    if (!orig || !dest) return;
    const path = [{ lat: orig.lat, lng: orig.lng }];
    if (rt.via && COIMBATORE_HUBS_GPS[rt.via]) {
      path.push({ lat: COIMBATORE_HUBS_GPS[rt.via].lat, lng: COIMBATORE_HUBS_GPS[rt.via].lng });
    }
    path.push({ lat: dest.lat, lng: dest.lng });

    const poly = new google.maps.Polyline({
      path: path,
      strokeColor: "#188038",
      strokeOpacity: 0.85,
      strokeWeight: 4,
      map: googleMap,
    });
    googleRoutePolylines[rt.id] = poly;
  });

  initGoogleBusMarkers();
}

function initGoogleBusMarkers() {
  if (!googleMap) return;
  googleBusMarkers.forEach((b) => b.marker.setMap(null));
  googleBusMarkers = [];

  COIMBATORE_ROUTES_GPS.forEach((rt, idx) => {
    const orig = COIMBATORE_HUBS_GPS[rt.from];
    const dest = COIMBATORE_HUBS_GPS[rt.to];
    if (!orig || !dest) return;

    const marker = new google.maps.Marker({
      position: { lat: orig.lat, lng: orig.lng },
      map: googleMap,
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 4,
        fillColor: "#1A73E8",
        fillOpacity: 1,
        strokeColor: "#FFFFFF",
        strokeWeight: 1.5,
      },
      title: `Bus ${rt.id.replace("R-", "")}`,
    });

    googleBusMarkers.push({
      marker,
      route: rt,
      from: orig,
      to: dest,
      progress: (idx * 0.12) % 1.0,
      speed: 0.003 + Math.random() * 0.002,
    });
  });
}

function updateGoogleMapMarkers(state) {
  if (!googleMap || !state || !state.stations) return;

  Object.keys(state.stations).forEach((hubName) => {
    const st = state.stations[hubName];
    const obj = googleStationMarkers[hubName];
    if (!obj) return;

    let col = "#188038";
    if (st.avg_wait_time > 15) col = "#D93025";
    else if (st.avg_wait_time > 11.5) col = "#B06000";

    obj.marker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      scale: 14,
      fillColor: col,
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeWeight: 2,
    });

    obj.info.setContent(`
      <div style="font-family:system-ui; padding:6px; min-width:180px;">
        <strong style="font-size:14px; color:#202124;">${st.full_name || st.name}</strong>
        <div style="font-size:12px; margin-top:4px;">
          Wait: <strong style="color:${col};">${st.avg_wait_time} mins</strong><br/>
          Queue: <strong>${st.waiting_commuters} pax</strong><br/>
          Route: ${st.primary_route}
        </div>
      </div>
    `);
  });

  // Update Route Polyline colors
  Object.keys(state.routes || {}).forEach((rtName) => {
    const rData = state.routes[rtName];
    const poly = googleRoutePolylines[rData.id];
    if (poly) {
      const load = rData["load_factor_%"];
      let col = "#188038";
      if (load >= 85) col = "#D93025";
      else if (load <= 35) col = "#B06000";
      poly.setOptions({ strokeColor: col });
    }
  });
}

function toggleMapProvider() {
  const gEl = document.getElementById("googleMapContainer");
  const lEl = document.getElementById("leafletMapContainer");
  const lbl = document.getElementById("lblMapProvider");

  if (activeMapProvider === "google") {
    activeMapProvider = "leaflet";
    if (gEl) gEl.style.display = "none";
    if (lEl) lEl.style.display = "block";
    if (lbl) lbl.textContent = "Switch to Google Maps";
    if (coimbatoreMap) setTimeout(() => coimbatoreMap.invalidateSize(), 50);
  } else {
    if (!googleMapsApiKey) {
      openGoogleMapsKeyModal();
      return;
    }
    activeMapProvider = "google";
    if (gEl) gEl.style.display = "block";
    if (lEl) lEl.style.display = "none";
    if (lbl) lbl.textContent = "Switch to Vector Map";
    if (!googleMap) {
      loadGoogleMapsApi(googleMapsApiKey);
    } else {
      google.maps.event.trigger(googleMap, "resize");
    }
  }
}

// Google Maps Key Dialog Controls
function openGoogleMapsKeyModal() {
  const modal = document.getElementById("gmapsModal");
  const input = document.getElementById("modalGmapsKeyInput");
  if (modal) modal.style.display = "flex";
  if (input) {
    input.value = "";
    input.placeholder = googleMapsApiKey ? "Configured & Active (Key Hidden for Security)" : "Enter Google Maps API Key...";
  }
}

function closeGoogleMapsKeyModal() {
  const modal = document.getElementById("gmapsModal");
  if (modal) modal.style.display = "none";
}

async function saveGoogleMapsKey(key) {
  const cleanKey = (key || "").trim();
  if (cleanKey) {
    googleMapsApiKey = cleanKey;
    localStorage.setItem("omnitransit_google_maps_key", googleMapsApiKey);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_maps_api_key: googleMapsApiKey }),
      });
    } catch (e) {}
  }

  const banner = document.getElementById("gmapsSetupBanner");
  if (banner) banner.style.display = googleMapsApiKey ? "none" : "flex";

  const badge = document.getElementById("gmapsStatusText");
  if (badge) badge.textContent = googleMapsApiKey ? "Active" : "Connect API Key";

  if (googleMapsApiKey) {
    loadGoogleMapsApi(googleMapsApiKey);
  }
}

function saveGoogleMapsKeyFromModal() {
  const input = document.getElementById("modalGmapsKeyInput");
  if (input && input.value.trim()) {
    saveGoogleMapsKey(input.value.trim());
  }
  closeGoogleMapsKeyModal();
}

function saveGoogleMapsKeyFromBanner() {
  const input = document.getElementById("bannerGmapsKeyInput");
  if (input && input.value.trim()) {
    saveGoogleMapsKey(input.value.trim());
  }
}

// Global Toolbar Handlers
function runDisruptionScenario() {
  const scen = document.getElementById("scenarioSelector")?.value || "HEAVY_RAIN";
  selectAndDisrupt(scen);
}

function runSwarmAuction() {
  return runSwarmOptimization();
}

function resetSimulation() {
  return resetDigitalTwin();
}

// ============================================================================
// RIGHT SLIDE-OUT DRAWER CONTROLS (UNBOXED & USER-FRIENDLY)
// ============================================================================

function toggleStationDrawer() {
  const drawer = document.getElementById("stationDrawer");
  const svg = document.getElementById("drawerToggleSvg");
  if (!drawer) return;
  drawer.classList.toggle("collapsed");
  if (svg) {
    svg.style.transform = drawer.classList.contains("collapsed") ? "rotate(180deg)" : "rotate(0deg)";
  }
}

function switchDrawerTab(tab) {
  const sList = document.getElementById("drawerStationsList");
  const bList = document.getElementById("drawerBusesList");
  const btnS = document.getElementById("btnDrawerTabStations");
  const btnB = document.getElementById("btnDrawerTabBuses");

  if (tab === "stations") {
    if (sList) sList.style.display = "block";
    if (bList) bList.style.display = "none";
    if (btnS) { btnS.style.background = "#E8F0FE"; btnS.style.color = "var(--accent-primary)"; }
    if (btnB) { btnB.style.background = "#FFFFFF"; btnB.style.color = "var(--text-primary)"; }
  } else {
    if (sList) sList.style.display = "none";
    if (bList) bList.style.display = "block";
    if (btnB) { btnB.style.background = "#E8F0FE"; btnB.style.color = "var(--accent-primary)"; }
    if (btnS) { btnS.style.background = "#FFFFFF"; btnS.style.color = "var(--text-primary)"; }
  }
}

function filterDrawerStations(query) {
  const q = (query || "").toLowerCase();
  document.querySelectorAll(".station-row-item").forEach((row) => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(q) ? "flex" : "none";
  });
}

function panToStation(hubName) {
  const hub = COIMBATORE_HUBS_GPS[hubName];
  if (!hub) return;

  if (activeMapProvider === "google" && googleMap && window.google) {
    googleMap.panTo({ lat: hub.lat, lng: hub.lng });
    googleMap.setZoom(14);
    if (googleStationMarkers[hubName] && googleStationMarkers[hubName].info) {
      googleStationMarkers[hubName].info.open(googleMap, googleStationMarkers[hubName].marker);
    }
  } else if (coimbatoreMap) {
    coimbatoreMap.flyTo([hub.lat, hub.lng], 14, { duration: 0.8 });
    if (leafletStationMarkers[hubName]) {
      openStationLeafletPopup(hubName, leafletStationMarkers[hubName]);
    }
  }
}

// ============================================================================
// 1,000,000 REAL-TIME TELEMETRY STREAMING ENGINE (4-SECOND LINE INGESTION)
// ============================================================================

let telemetryStreamTimer = null;
let currentStreamTick = 1;
let advisoryBulletinsHistory = [];

const CORRIDOR_DATA = [
  { code: "KAL", name: "Kalapatti Tech Hub", primary: "R-107", alt: "R-101", savings: 12 },
  { code: "GAN", name: "Gandhipuram Central", primary: "R-101", alt: "R-105", savings: 16 },
  { code: "TWN", name: "Town Hall Commercial", primary: "R-103", alt: "R-105", savings: 14 },
  { code: "PEE", name: "Peelamedu Metro Link", primary: "R-108", alt: "R-101", savings: 10 },
  { code: "SAR", name: "Saravanampatti Tech Zone", primary: "R-102", alt: "R-107", savings: 15 },
  { code: "SIN", name: "Singanallur Hub", primary: "R-103", alt: "R-105", savings: 11 },
  { code: "UKK", name: "Ukkadam Lake Terminal", primary: "R-105", alt: "R-103", savings: 13 },
  { code: "ARA", name: "Arasur Industrial Junction", primary: "R-101", alt: "R-102", savings: 18 },
];

function initTelemetryStreamEngine() {
  if (telemetryStreamTimer) clearInterval(telemetryStreamTimer);
  fetchTelemetryStreamTick();
  telemetryStreamTimer = setInterval(fetchTelemetryStreamTick, 4000);
}

async function fetchTelemetryStreamTick() {
  try {
    const res = await fetch("/api/stream/tick");
    if (!res.ok) return;
    const data = await res.json();
    currentStreamTick = data.tick_id;
    updateTelemetryStreamUi(data);
  } catch (err) {
    console.warn("[STREAM] Error fetching 4-second telemetry tick:", err);
  }
}

function updateTelemetryStreamUi(data) {
  if (!data) return;

  // 1. Update Menu Bar Stream Counter with Flash Animation
  const streamPill = document.getElementById("streamTelemetryPill");
  const counterEl = document.getElementById("streamCounterText");
  if (counterEl) {
    counterEl.textContent = `Line #${data.tick_id.toLocaleString()} / 1,000,000 (4s)`;
  }
  if (streamPill) {
    streamPill.classList.remove("pulse-tick-flash");
    void streamPill.offsetWidth;
    streamPill.classList.add("pulse-tick-flash");
  }

  // 2. Update Advisory Ticker Strip with Flash Animation
  const tickerStrip = document.querySelector(".advisory-ticker-strip");
  const tickerText = document.getElementById("advisoryTickerText");
  const tickerMeta = document.getElementById("advisoryTickerMeta");
  if (tickerText) {
    tickerText.textContent = `[${data.simulated_time} ADVISORY - ${data.hub_name.toUpperCase()}] ${data.advisory_headline}: ${data.advisory_guidance} (Wait: ${data.avg_wait_mins}m • Crowding: ${data.crowding_pct}% • Active Fleet: ${data.active_buses} units)`;
  }
  if (tickerMeta) {
    tickerMeta.textContent = `Tick #${data.tick_id.toLocaleString()} • 4s Line Stream • 1M Rows`;
  }
  if (tickerStrip) {
    tickerStrip.classList.remove("ticker-tick-flash");
    void tickerStrip.offsetWidth;
    tickerStrip.classList.add("ticker-tick-flash");
  }

  // 3. Update Weather & Operational Scenario Status on Screen
  const topCond = document.getElementById("topConditionText");
  if (topCond) {
    topCond.textContent = `${data.weather_condition} (31°C)`;
  }
  const statusScenario = document.getElementById("activeScenarioTitle");
  if (statusScenario) {
    statusScenario.textContent = data.crowding_pct > 75 ? "Surge Congestion" : data.crowding_pct > 50 ? "Elevated Flow" : "Equilibrium";
    statusScenario.style.color = data.crowding_pct > 75 ? "var(--accent-danger)" : data.crowding_pct > 50 ? "var(--accent-warning)" : "var(--accent-success)";
  }
  const dotIndicator = document.getElementById("statusIndicatorDot");
  if (dotIndicator) {
    dotIndicator.className = `status-indicator-dot ${data.crowding_pct > 75 ? "critical" : data.crowding_pct > 50 ? "warning" : "nominal"}`;
  }

  // 4. Update Matching Station Hub in Digital Twin State
  if (twinState && twinState.stations) {
    let matchedKey = null;
    for (const [sKey, sObj] of Object.entries(twinState.stations)) {
      if (sObj.code === data.hub_code || sKey.includes(data.hub_name.split(" ")[0]) || data.hub_name.includes(sKey.split(" ")[0])) {
        matchedKey = sKey;
        break;
      }
    }
    if (matchedKey) {
      twinState.stations[matchedKey].waiting_commuters = data.waiting_commuters;
      twinState.stations[matchedKey].avg_wait_time = data.avg_wait_mins;
      twinState.stations[matchedKey].crowding_level = data.crowding_level;
      twinState.stations[matchedKey].active_buses = data.active_buses;

      // Update Map Marker Pin Color dynamically on Map
      const hubGps = COIMBATORE_HUBS_GPS[matchedKey];
      if (hubGps) {
        const pinCore = document.getElementById(`pinCore-${hubGps.code}`);
        if (pinCore) {
          pinCore.style.background = data.crowding_pct > 75 ? "#EF4444" : data.crowding_pct > 50 ? "#F59E0B" : "#10B981";
          pinCore.style.borderColor = "#FFFFFF";
        }
      }
    }

    // Refresh Drawer Stations list
    const stationsGrid = document.getElementById("stationsGrid");
    if (stationsGrid) {
      stationsGrid.innerHTML = "";
      Object.keys(twinState.stations).forEach((sKey) => {
        const st = twinState.stations[sKey];
        const row = document.createElement("div");
        row.className = "station-row-item";
        row.onclick = () => panToStation(sKey);

        let badgeClass = "";
        if (st.avg_wait_time > 15 || st.crowding_level === "HEAVY") badgeClass = "critical";
        else if (st.avg_wait_time > 10 || st.crowding_level === "MODERATE") badgeClass = "moderate";

        row.innerHTML = `
          <div class="station-row-info">
            <span class="station-row-name">${st.name}</span>
            <span class="station-row-sub">Queue: ${st.waiting_commuters || 45} pax • Rec: ${st.primary_route || 'R-101'}</span>
          </div>
          <span class="station-row-badge ${badgeClass}">${st.avg_wait_time}m wait</span>
        `;
        stationsGrid.appendChild(row);
      });
    }
  }

  // 5. Update Bottom Floating Ribbon KPIs
  const kpiWait = document.getElementById("kpiAvgWait");
  if (kpiWait) kpiWait.textContent = `${data.avg_wait_mins} min`;

  const kpiPax = document.getElementById("kpiTotalWaiting");
  if (kpiPax) {
    let sumPax = 0;
    if (twinState && twinState.stations) {
      Object.values(twinState.stations).forEach(s => sumPax += (s.waiting_commuters || 0));
    }
    if (sumPax === 0) sumPax = data.waiting_commuters * 8;
    kpiPax.textContent = `${sumPax} pax`;
  }

  const kpiFleet = document.getElementById("kpiActiveFleet");
  if (kpiFleet) kpiFleet.textContent = `${data.active_buses * 8} units`;

  // 6. Update Real-Time Advisory Tab Feed
  addAdvisoryBulletinFromStream(data);

  // 7. Update Corridors Grid in Advisory Tab
  updateCorridorsAdvisoryMatrix(data);

  // 8. Update Trip Advisory Guidance if Origin matches
  const origSelect = document.getElementById("advisoryOriginSelect");
  if (origSelect && origSelect.value === data.hub_code) {
    updateTripAdvisoryAdvice();
  }
}

function addAdvisoryBulletinFromStream(data) {
  const feedContainer = document.getElementById("advisoryBulletinsFeed");
  const feedBadge = document.getElementById("advisoryFeedTickBadge");
  if (feedBadge) feedBadge.textContent = `Tick #${data.tick_id.toLocaleString()}`;

  advisoryBulletinsHistory.unshift(data);
  if (advisoryBulletinsHistory.length > 8) {
    advisoryBulletinsHistory.pop();
  }

  if (!feedContainer) return;

  feedContainer.innerHTML = advisoryBulletinsHistory.map((item) => {
    let sevClass = "nominal";
    if (item.crowding_pct > 75) sevClass = "critical";
    else if (item.crowding_pct > 50) sevClass = "elevated";

    return `
      <div class="advisory-bulletin-card">
        <div class="bulletin-top">
          <span class="bulletin-severity ${sevClass}">${item.crowding_level} PRIORITY</span>
          <span class="bulletin-time">${item.simulated_time} (Tick #${item.tick_id.toLocaleString()})</span>
        </div>
        <div class="bulletin-headline">${item.advisory_headline}</div>
        <div class="bulletin-guidance">${item.advisory_guidance}</div>
        <div class="bulletin-metrics">
          <span>Hub: <strong>${item.hub_name}</strong></span>
          <span>Wait: <strong>${item.avg_wait_mins}m</strong></span>
          <span>Crowd: <strong>${item.crowding_pct}%</strong></span>
          <span>Alt Route: <strong style="color:var(--accent-primary);">${item.alt_route}</strong></span>
        </div>
      </div>
    `;
  }).join("");
}

function renderCorridorsAdvisoryGrid() {
  const container = document.getElementById("corridorsAdvisoryGrid");
  if (!container) return;

  container.innerHTML = CORRIDOR_DATA.map((c) => {
    return `
      <div class="corridor-advisory-box" id="corridorBox-${c.code}">
        <div class="corridor-box-top">
          <strong style="font-size:13px; color:var(--text-primary);">${c.name}</strong>
          <span class="bulletin-severity nominal" id="corridorSev-${c.code}">MODERATE</span>
        </div>
        <div style="font-size:12px; color:var(--text-secondary); display:flex; justify-content:space-between;">
          <span>Primary: <strong>${c.primary}</strong></span>
          <span>Bypass: <strong style="color:var(--accent-primary);">${c.alt}</strong></span>
        </div>
        <div class="corridor-crowd-bar-bg">
          <div class="corridor-crowd-bar-fill" id="corridorBar-${c.code}" style="width: 45%; background: #3B82F6;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-secondary); margin-top:2px;">
          <span id="corridorWait-${c.code}">Wait: ~6.2m</span>
          <span style="color:#166534; font-weight:600;">Saves ~${c.savings}m via ${c.alt}</span>
        </div>
      </div>
    `;
  }).join("");
}

function updateCorridorsAdvisoryMatrix(data) {
  if (!data || !data.hub_code) return;
  const bar = document.getElementById(`corridorBar-${data.hub_code}`);
  const waitEl = document.getElementById(`corridorWait-${data.hub_code}`);
  const sevEl = document.getElementById(`corridorSev-${data.hub_code}`);

  if (bar) {
    bar.style.width = `${Math.min(100, data.crowding_pct)}%`;
    bar.style.background = data.crowding_pct > 75 ? "#EF4444" : data.crowding_pct > 50 ? "#F59E0B" : "#10B981";
  }
  if (waitEl) {
    waitEl.textContent = `Wait: ${data.avg_wait_mins}m`;
  }
  if (sevEl) {
    sevEl.textContent = data.crowding_level;
    sevEl.className = `bulletin-severity ${data.crowding_pct > 75 ? "critical" : data.crowding_pct > 50 ? "elevated" : "nominal"}`;
  }
}

function updateTripAdvisoryAdvice() {
  const orig = document.getElementById("advisoryOriginSelect")?.value || "GAN";
  const dest = document.getElementById("advisoryDestSelect")?.value || "KAL";

  const hubMatch = CORRIDOR_DATA.find((c) => c.code === orig) || CORRIDOR_DATA[1];
  const primaryNameEl = document.getElementById("advPrimaryRouteName");
  const savingsTextEl = document.getElementById("advSavingsText");
  const queuePaxEl = document.getElementById("advQueuePax");
  const waitMinsEl = document.getElementById("advWaitMins");
  const crowdStatusEl = document.getElementById("advCrowdStatus");
  const fleetSocEl = document.getElementById("advFleetSoc");
  const noticeEl = document.getElementById("advGuidanceNotice");

  const estWait = (4.2 + (orig.charCodeAt(0) % 5)).toFixed(1);
  const estPax = 45 + (orig.charCodeAt(0) % 60);
  const crowdPct = Math.min(95, Math.round((estPax / 120) * 100));

  if (primaryNameEl) primaryNameEl.textContent = `Corridor ${hubMatch.primary} (${hubMatch.name} to ${dest})`;
  if (savingsTextEl) savingsTextEl.textContent = `Saves ~${hubMatch.savings} min via ${hubMatch.alt} Bypass`;
  if (queuePaxEl) queuePaxEl.textContent = `${estPax} commuters`;
  if (waitMinsEl) waitMinsEl.textContent = `${estWait} mins`;
  if (crowdStatusEl) crowdStatusEl.textContent = `${crowdPct > 65 ? "Heavy" : "Moderate"} (${crowdPct}%)`;
  if (fleetSocEl) fleetSocEl.textContent = `5 Units (82% SOC)`;
  if (noticeEl) {
    noticeEl.innerHTML = `<strong>Live Advisory:</strong> Real-time streaming indicates optimal commuter throughput by taking bypass corridor <strong>${hubMatch.alt}</strong> instead of crowded <strong>${hubMatch.primary}</strong>. Expected transit saving is ~${hubMatch.savings} minutes.`;
  }
}



