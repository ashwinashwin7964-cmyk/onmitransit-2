"""
Urban Transit Digital Twin — Central State Engine
=================================================
Acts as the single source of truth linking:
1. The 2,000,000-row Blocked Telemetry Dataset & Gradient-Boosted Predictor
2. The 3-Layer Autonomous Multi-Agent Swarm & Game-Theoretic Token Marketplace
3. The EV Fleet Battery-Life & Grid Constraint Guardrails
4. The Dynamic Ghost-Route Synthesizer & ESG Carbon-Credit Exchange
5. The Generative AI Causal Architect & B2C Commuter Companion
"""

import copy
import datetime
import json
import os
from typing import Any, Dict, List, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
SUMMARY_JSON_PATH = os.path.join(DATA_DIR, "dataset_analytics_summary.json")
MODEL_JSON_PATH = os.path.join(DATA_DIR, "trained_demand_model.json")


class UrbanTransitDigitalTwin:
    """
    Real-time data-driven mirror of the metropolitan public transport network.
    All telemetry is explicitly governed under:
    [⚠️ SIMULATION SANDBOX MODE — POLICY PLANNING ONLY]
    """

    def __init__(self) -> None:
        self.sandbox_compliance_banner = (
            "[⚠️ SIMULATION SANDBOX MODE — POLICY PLANNING ONLY | "
            "NOT LIVE PASSENGER ARRIVAL ETAs]"
        )
        self.dataset_summary = self._load_json(SUMMARY_JSON_PATH)
        self.trained_model = self._load_json(MODEL_JSON_PATH)
        self.reset_to_baseline()

    @staticmethod
    def _load_json(path: str) -> Dict[str, Any]:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def reset_to_baseline(self) -> None:
        """Resets the Digital Twin to the steady-state baseline schedule."""
        self.simulation_step = 0
        self.active_scenario = "BASELINE_EQUILIBRIUM"
        self.scenario_title = "Normal Metropolitan Schedule Equilibrium"
        self.weather_condition = "CLEAR"
        self.simulated_hour = 17  # 17:30 Evening Transition

        # 8 Metropolitan Transit Hubs (with Canvas/Map normalized & GPS coordinates)
        self.stations: Dict[str, Dict[str, Any]] = {
            "Kalapatti Hub": {
                "id": "HUB-01",
                "code": "KAL",
                "name": "Kalapatti Hub",
                "full_name": "Kalapatti Tech & University Hub",
                "zone": "North-East Tech Corridor",
                "lat": 11.0745,
                "lon": 77.0355,
                "map_x": 0.68,
                "map_y": 0.22,
                "waiting_commuters": 118,
                "baseline_commuters": 118,
                "avg_wait_time": 11.5,
                "baseline_wait_time": 11.5,
                "token_pool": 2500,
                "tokens_spent": 0,
                "primary_route": "Route-101 (Town Hall - Kalapatti)",
                "alt_route": "Route-202 (Gandhipuram - Arasur)",
                "dominant_persona": "Student-Exam-Cohort",
                "patience_threshold_mins": 11.0,
                "distress_index": 34.0,
                "status": "NORMAL",
                "persona_breakdown": {
                    "Student-Exam-Cohort": 54,
                    "IT-Corridor-Professional": 38,
                    "General-Commuter": 26,
                },
            },
            "Gandhipuram Central": {
                "id": "HUB-02",
                "code": "GAN",
                "name": "Gandhipuram Central",
                "full_name": "Gandhipuram Central Bus Terminus",
                "zone": "Central Business District",
                "lat": 11.0183,
                "lon": 76.9675,
                "map_x": 0.34,
                "map_y": 0.50,
                "waiting_commuters": 142,
                "baseline_commuters": 142,
                "avg_wait_time": 12.0,
                "baseline_wait_time": 12.0,
                "token_pool": 3200,
                "tokens_spent": 0,
                "primary_route": "Route-102 (Gandhipuram - Peelamedu)",
                "alt_route": "Route-105 (Metro Feeder Loop)",
                "dominant_persona": "IT-Corridor-Professional",
                "patience_threshold_mins": 13.0,
                "distress_index": 38.0,
                "status": "NORMAL",
                "persona_breakdown": {
                    "IT-Corridor-Professional": 68,
                    "Commercial-Shopper": 44,
                    "Student-Exam-Cohort": 30,
                },
            },
            "Town Hall Hub": {
                "id": "HUB-03",
                "code": "TWN",
                "name": "Town Hall Hub",
                "full_name": "Town Hall Heritage & Stadium Hub",
                "zone": "Old City Commercial Core",
                "lat": 10.9925,
                "lon": 76.9614,
                "map_x": 0.28,
                "map_y": 0.74,
                "waiting_commuters": 110,
                "baseline_commuters": 110,
                "avg_wait_time": 10.5,
                "baseline_wait_time": 10.5,
                "token_pool": 2400,
                "tokens_spent": 0,
                "primary_route": "Route-103 (Town Hall - Singanallur)",
                "alt_route": "Route-106 (Southern Ring)",
                "dominant_persona": "General-Commuter",
                "patience_threshold_mins": 15.0,
                "distress_index": 29.0,
                "status": "NORMAL",
                "persona_breakdown": {
                    "General-Commuter": 58,
                    "Senior-Citizen-Accessible": 28,
                    "Student-Exam-Cohort": 24,
                },
            },
            "Arasur Junction": {
                "id": "HUB-04",
                "code": "ARA",
                "name": "Arasur Junction",
                "full_name": "Arasur Industrial Logistics Junction",
                "zone": "Eastern Manufacturing Belt",
                "lat": 11.0792,
                "lon": 77.1215,
                "map_x": 0.88,
                "map_y": 0.30,
                "waiting_commuters": 32,
                "baseline_commuters": 32,
                "avg_wait_time": 6.5,
                "baseline_wait_time": 6.5,
                "token_pool": 1600,
                "tokens_spent": 0,
                "primary_route": "Route-202 (Gandhipuram - Arasur)",
                "alt_route": "Route-101 (Town Hall - Kalapatti)",
                "dominant_persona": "Industrial-Shift-Worker",
                "patience_threshold_mins": 16.0,
                "distress_index": 12.0,
                "status": "SMOOTH",
                "persona_breakdown": {
                    "Industrial-Shift-Worker": 22,
                    "General-Commuter": 10,
                },
            },
            "Saravanampatti IT": {
                "id": "HUB-05",
                "code": "SAR",
                "name": "Saravanampatti IT",
                "full_name": "Saravanampatti IT SEZ Corridor",
                "zone": "IT SEZ North",
                "lat": 11.0797,
                "lon": 76.9997,
                "map_x": 0.48,
                "map_y": 0.16,
                "waiting_commuters": 128,
                "baseline_commuters": 128,
                "avg_wait_time": 12.5,
                "baseline_wait_time": 12.5,
                "token_pool": 2800,
                "tokens_spent": 0,
                "primary_route": "Route-104 (Saravanampatti - Gandhipuram)",
                "alt_route": "Route-204 (Ukkadam - North Express)",
                "dominant_persona": "IT-Corridor-Professional",
                "patience_threshold_mins": 13.0,
                "distress_index": 39.0,
                "status": "NORMAL",
                "persona_breakdown": {
                    "IT-Corridor-Professional": 82,
                    "Student-Exam-Cohort": 28,
                    "General-Commuter": 18,
                },
            },
            "Peelamedu Metro Link": {
                "id": "HUB-06",
                "code": "PEE",
                "name": "Peelamedu Metro Link",
                "full_name": "Peelamedu Medical & Metro Link",
                "zone": "Avinashi Med-Edu Corridor",
                "lat": 11.0286,
                "lon": 77.0226,
                "map_x": 0.58,
                "map_y": 0.48,
                "waiting_commuters": 96,
                "baseline_commuters": 96,
                "avg_wait_time": 10.0,
                "baseline_wait_time": 10.0,
                "token_pool": 2200,
                "tokens_spent": 0,
                "primary_route": "Route-105 (Metro Feeder Loop)",
                "alt_route": "Route-102 (Gandhipuram - Peelamedu)",
                "dominant_persona": "Healthcare-Essential-Staff",
                "patience_threshold_mins": 9.5,
                "distress_index": 31.0,
                "status": "NORMAL",
                "persona_breakdown": {
                    "Healthcare-Essential-Staff": 46,
                    "Student-Exam-Cohort": 32,
                    "Senior-Citizen-Accessible": 18,
                },
            },
            "Singanallur Center": {
                "id": "HUB-07",
                "code": "SIN",
                "name": "Singanallur Center",
                "full_name": "Singanallur Inter-Modal Transit Center",
                "zone": "South-East Residential",
                "lat": 11.0007,
                "lon": 77.0296,
                "map_x": 0.64,
                "map_y": 0.72,
                "waiting_commuters": 54,
                "baseline_commuters": 54,
                "avg_wait_time": 8.0,
                "baseline_wait_time": 8.0,
                "token_pool": 1800,
                "tokens_spent": 0,
                "primary_route": "Route-106 (Southern Ring)",
                "alt_route": "Route-103 (Town Hall - Singanallur)",
                "dominant_persona": "Senior-Citizen-Accessible",
                "patience_threshold_mins": 12.0,
                "distress_index": 18.0,
                "status": "SMOOTH",
                "persona_breakdown": {
                    "Senior-Citizen-Accessible": 24,
                    "General-Commuter": 30,
                },
            },
            "Ukkadam Terminal": {
                "id": "HUB-08",
                "code": "UKK",
                "name": "Ukkadam Terminal",
                "full_name": "Ukkadam Lakefront Mobility Terminal",
                "zone": "Southern Lakefront Gateway",
                "lat": 10.9902,
                "lon": 76.9518,
                "map_x": 0.16,
                "map_y": 0.82,
                "waiting_commuters": 40,
                "baseline_commuters": 40,
                "avg_wait_time": 7.0,
                "baseline_wait_time": 7.0,
                "token_pool": 1750,
                "tokens_spent": 0,
                "primary_route": "Route-204 (Ukkadam - North Express)",
                "alt_route": "Route-103 (Town Hall - Singanallur)",
                "dominant_persona": "General-Commuter",
                "patience_threshold_mins": 18.0,
                "distress_index": 14.0,
                "status": "SMOOTH",
                "persona_breakdown": {
                    "General-Commuter": 28,
                    "Industrial-Shift-Worker": 12,
                },
            },
        }

        # 8 Primary Transit Routes (with Seller Agent capabilities & EV Fleet telemetry)
        self.routes: Dict[str, Dict[str, Any]] = {
            "Route-101 (Town Hall - Kalapatti)": {
                "id": "R-101",
                "name": "Route-101 (Town Hall - Kalapatti)",
                "origin": "Town Hall Hub",
                "destination": "Kalapatti Hub",
                "via": "Peelamedu Metro Link",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 12,
                "baseline_headway_mins": 12,
                "avg_speed_kmh": 24.0,
                "load_factor_%": 76.0,
                "baseline_load_%": 76.0,
                "ev_bus_share_%": 80,
                "min_fleet_soc_%": 64,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "BALANCED",
            },
            "Route-102 (Gandhipuram - Peelamedu)": {
                "id": "R-102",
                "name": "Route-102 (Gandhipuram - Peelamedu)",
                "origin": "Gandhipuram Central",
                "destination": "Peelamedu Metro Link",
                "via": "Avinashi Arterial",
                "active_buses": 6,
                "baseline_buses": 6,
                "headway_mins": 10,
                "baseline_headway_mins": 10,
                "avg_speed_kmh": 21.0,
                "load_factor_%": 82.0,
                "baseline_load_%": 82.0,
                "ev_bus_share_%": 83,
                "min_fleet_soc_%": 58,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "BALANCED",
            },
            "Route-103 (Town Hall - Singanallur)": {
                "id": "R-103",
                "name": "Route-103 (Town Hall - Singanallur)",
                "origin": "Town Hall Hub",
                "destination": "Singanallur Center",
                "via": "Trichy Road Corridor",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 12,
                "baseline_headway_mins": 12,
                "avg_speed_kmh": 23.0,
                "load_factor_%": 68.0,
                "baseline_load_%": 68.0,
                "ev_bus_share_%": 60,
                "min_fleet_soc_%": 71,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "BALANCED",
            },
            "Route-202 (Gandhipuram - Arasur)": {
                "id": "R-202",
                "name": "Route-202 (Gandhipuram - Arasur)",
                "origin": "Gandhipuram Central",
                "destination": "Arasur Junction",
                "via": "Kalapatti Hub",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 14,
                "baseline_headway_mins": 14,
                "avg_speed_kmh": 29.0,
                "load_factor_%": 18.0,
                "baseline_load_%": 18.0,
                "ev_bus_share_%": 100,
                "min_fleet_soc_%": 78,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "UNDERUTILIZED_SELLER",
            },
            "Route-104 (Saravanampatti - Gandhipuram)": {
                "id": "R-104",
                "name": "Route-104 (Saravanampatti - Gandhipuram)",
                "origin": "Saravanampatti IT",
                "destination": "Gandhipuram Central",
                "via": "Sathy Tech Highway",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 11,
                "baseline_headway_mins": 11,
                "avg_speed_kmh": 22.0,
                "load_factor_%": 79.0,
                "baseline_load_%": 79.0,
                "ev_bus_share_%": 80,
                "min_fleet_soc_%": 62,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "BALANCED",
            },
            "Route-105 (Metro Feeder Loop)": {
                "id": "R-105",
                "name": "Route-105 (Metro Feeder Loop)",
                "origin": "Peelamedu Metro Link",
                "destination": "Kalapatti Hub",
                "via": "Saravanampatti IT",
                "active_buses": 4,
                "baseline_buses": 4,
                "headway_mins": 15,
                "baseline_headway_mins": 15,
                "avg_speed_kmh": 25.0,
                "load_factor_%": 64.0,
                "baseline_load_%": 64.0,
                "ev_bus_share_%": 100,
                "min_fleet_soc_%": 54,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "BALANCED",
            },
            "Route-106 (Southern Ring)": {
                "id": "R-106",
                "name": "Route-106 (Southern Ring)",
                "origin": "Singanallur Center",
                "destination": "Ukkadam Terminal",
                "via": "Town Hall Hub",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 14,
                "baseline_headway_mins": 14,
                "avg_speed_kmh": 28.0,
                "load_factor_%": 22.0,
                "baseline_load_%": 22.0,
                "ev_bus_share_%": 80,
                "min_fleet_soc_%": 19,  # Has one low-battery unit to trigger EV guardrail!
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "UNDERUTILIZED_SELLER",
            },
            "Route-204 (Ukkadam - North Express)": {
                "id": "R-204",
                "name": "Route-204 (Ukkadam - North Express)",
                "origin": "Ukkadam Terminal",
                "destination": "Saravanampatti IT",
                "via": "Gandhipuram Central",
                "active_buses": 5,
                "baseline_buses": 5,
                "headway_mins": 15,
                "baseline_headway_mins": 15,
                "avg_speed_kmh": 27.0,
                "load_factor_%": 24.0,
                "baseline_load_%": 24.0,
                "ev_bus_share_%": 100,
                "min_fleet_soc_%": 84,
                "tokens_earned": 0,
                "is_ghost_route": False,
                "status": "UNDERUTILIZED_SELLER",
            },
        }

        # Representative EV & Hybrid Bus Units monitored by the EV Grid Guardrail
        self.ev_fleet_units: List[Dict[str, Any]] = [
            {"unit_id": "EV-101A", "route": "Route-101 (Town Hall - Kalapatti)", "soc_pct": 74, "capacity": 65, "status": "ACTIVE"},
            {"unit_id": "EV-102B", "route": "Route-102 (Gandhipuram - Peelamedu)", "soc_pct": 68, "capacity": 65, "status": "ACTIVE"},
            {"unit_id": "EV-202A", "route": "Route-202 (Gandhipuram - Arasur)", "soc_pct": 86, "capacity": 65, "status": "STANDBY_SELLER"},
            {"unit_id": "EV-202B", "route": "Route-202 (Gandhipuram - Arasur)", "soc_pct": 79, "capacity": 65, "status": "STANDBY_SELLER"},
            {"unit_id": "EV-106X", "route": "Route-106 (Southern Ring)", "soc_pct": 19, "capacity": 65, "status": "GUARDRAIL_LOCKED_LOW_SOC"},
            {"unit_id": "EV-106Y", "route": "Route-106 (Southern Ring)", "soc_pct": 81, "capacity": 65, "status": "STANDBY_SELLER"},
            {"unit_id": "EV-204A", "route": "Route-204 (Ukkadam - North Express)", "soc_pct": 88, "capacity": 65, "status": "STANDBY_SELLER"},
            {"unit_id": "EV-204B", "route": "Route-204 (Ukkadam - North Express)", "soc_pct": 84, "capacity": 65, "status": "STANDBY_SELLER"},
        ]

        # Active Token Bounty Arcs for 3D-style Map Visualization
        self.active_trades: List[Dict[str, Any]] = []
        self.ghost_routes: List[Dict[str, Any]] = []

        # ESG & Commercial Metrics
        self.esg_ledger = {
            "total_tokens_traded": 0,
            "commuters_retained_in_transit": 0,
            "private_cab_trips_prevented": 0,
            "co2_prevented_kg": 0.0,
            "co2_prevented_metric_tons": 0.0,
            "verified_carbon_credits_minted": 0.0,
            "estimated_esg_revenue_usd": 0.0,
            "estimated_esg_revenue_inr": 0.0,
            "ev_guardrail_blocks_triggered": 0,
            "ghost_routes_spawned": 0,
        }

        self.negotiation_logs: List[Dict[str, Any]] = []
        self.pre_disruption_snapshot: Optional[Dict[str, Any]] = None
        self.post_disruption_snapshot: Optional[Dict[str, Any]] = None
        self.causal_report_markdown: str = self._default_baseline_briefing()
        self.commuter_companion_advisories: List[Dict[str, Any]] = self._build_companion_advisories()

        self.log_event(
            "SYSTEM_TWIN",
            "INFO",
            "Urban Transit Digital Twin initialized with 2,000,000-row Blocked Telemetry Index (128 Smart Blocks).",
        )
        self.log_event(
            "GUARDRAIL",
            "COMPLIANCE",
            "Sandbox Policy Guardrail active: All demand & wait-time projections tagged as non-live planning estimates.",
        )

    def _default_baseline_briefing(self) -> str:
        return (
            "### 🛡️ Baseline Digital Twin Equilibrium\n"
            "The metropolitan transit network is currently operating within nominal schedule parameters "
            "calibrated against **2,000,000 historical synthetic commuter check-ins (128 Smart Blocks)**.\n\n"
            "- **Network Average Simulated Wait Time:** `9.8 mins` (Below the `15.0 min` Hub Distress Threshold)\n"
            "- **Active Autonomous Fleet:** `40 Electric & Hybrid Buses` across `8 Primary Corridors`\n"
            "- **Decentralized Token Market:** Idle (`0` emergency bounties active). Use the **Adversarial Chaos Monkey** "
            "controls to inject a flash flood, metro feeder failure, or stadium surge and observe the 3-layer agent swarm negotiate in real time."
        )

    def log_event(self, sender: str, category: str, text: str) -> None:
        timestamp = datetime.datetime.now().strftime("%H:%M:%S.%f")[:-3]
        self.negotiation_logs.append(
            {
                "timestamp": timestamp,
                "sender": sender,
                "category": category,
                "message": text,
                "formatted": f"[{sender}]: {text}",
            }
        )

    def _build_companion_advisories(self) -> List[Dict[str, Any]]:
        """Generates B2C 'GenAI Commuter Companion' plain-English advisories for each hub."""
        advisories = []
        for s_name, s_data in self.stations.items():
            wait = s_data["avg_wait_time"]
            commuters = s_data["waiting_commuters"]
            alt = s_data["alt_route"]
            persona = s_data["dominant_persona"]

            if wait > 18:
                tone = "URGENT_RELIEF_IN_PROGRESS"
                advice = (
                    f"[SANDBOX ADVISORY] Heavy crowd surge ({commuters} commuters) simulated at {s_name}. "
                    f"Wait time is currently ~{wait:.1f} mins. Our AI Swarm is bidding tokens to divert backup EV shuttles. "
                    f"Consider boarding alternative {alt} or delaying arrival by 12 mins."
                )
            elif wait > 13:
                tone = "MODERATE_CROWDING"
                advice = (
                    f"[SANDBOX ADVISORY] Moderate queue ({commuters} commuters, mostly {persona}) at {s_name}. "
                    f"Simulated wait is ~{wait:.1f} mins. {s_data['primary_route']} is operating near peak capacity."
                )
            else:
                tone = "SMOOTH_FLOW"
                advice = (
                    f"[SANDBOX ADVISORY] Smooth boarding conditions at {s_name} (~{wait:.1f} min simulated wait, "
                    f"{commuters} commuters queued). Optimal window for {persona} cohorts."
                )

            advisories.append(
                {
                    "hub_name": s_name,
                    "dominant_persona": persona,
                    "simulated_wait_mins": round(wait, 1),
                    "recommended_route": s_data["primary_route"] if wait <= 15 else alt,
                    "tone": tone,
                    "message": advice,
                }
            )
        return advisories

    def recompute_station_statuses(self) -> None:
        for s_name, s_data in self.stations.items():
            wait = s_data["avg_wait_time"]
            pat = s_data["patience_threshold_mins"]
            comm = s_data["waiting_commuters"]
            # Distress Index (0 - 100)
            pdi = min(100.0, round((wait / max(1.0, pat)) * 35.0 + (comm / 6.5), 1))
            s_data["distress_index"] = pdi
            if wait > 15.0:
                s_data["status"] = "CRITICAL_BOTTLENECK"
            elif wait > 11.5:
                s_data["status"] = "ELEVATED_DEMAND"
            else:
                s_data["status"] = "SMOOTH"

        for r_name, r_data in self.routes.items():
            load = r_data["load_factor_%"]
            if r_data.get("is_ghost_route"):
                r_data["status"] = "GHOST_EXPRESS_CORRIDOR"
            elif load >= 85.0:
                r_data["status"] = "CONGESTED"
            elif load <= 35.0 and r_data["active_buses"] > 2:
                r_data["status"] = "UNDERUTILIZED_SELLER"
            else:
                r_data["status"] = "BALANCED"

        self.commuter_companion_advisories = self._build_companion_advisories()

    def predict_block_demand(self, hub_code: str, time_bucket: str, weather_code: str, headway_mins: int = 12) -> Dict[str, Any]:
        """
        Uses the Blocked Gradient-Boosted Decision Ensemble trained on the 2,000,000 rows
        to predict passenger demand, crowding load factor %, and waiting time.
        """
        fw = self.trained_model.get("feature_weights", {})
        base_d = self.trained_model.get("global_mean_demand", 140.0)
        base_w = self.trained_model.get("global_mean_wait_mins", 12.5)

        h_d = fw.get("hub_demand_delta", {}).get(hub_code, 0.0)
        t_d = fw.get("time_bucket_demand_delta", {}).get(time_bucket, 0.0)
        w_d = fw.get("weather_demand_delta", {}).get(weather_code[:3].upper(), 0.0)

        h_w = fw.get("hub_wait_delta", {}).get(hub_code, 0.0)
        t_w = fw.get("time_bucket_wait_delta", {}).get(time_bucket, 0.0)
        w_w = fw.get("weather_wait_delta", {}).get(weather_code[:3].upper(), 0.0)

        pred_demand = max(12.0, round(base_d + h_d + t_d + w_d, 1))
        headway_factor = headway_mins / 12.0
        pred_load_pct = min(135.0, max(10.0, round((pred_demand / 115.0) * headway_factor * 58.0, 1)))
        pred_wait_mins = max(3.0, round((base_w + h_w + t_w + w_w) * (0.65 + 0.35 * headway_factor), 1))

        # Recommended headway optimization
        if pred_wait_mins > 15.0 or pred_load_pct > 85.0:
            rec_headway = max(5, int(round(headway_mins * 0.58)))
            opt_wait = max(4.5, round(pred_wait_mins * 0.52, 1))
            opt_load = max(25.0, round(pred_load_pct * 0.62, 1))
            recommendation = (
                f"Reduce headway from {headway_mins} mins to {rec_headway} mins (+2 buses via Token Bounty) "
                f"to cut simulated wait time by {round(pred_wait_mins - opt_wait, 1)} mins."
            )
        else:
            rec_headway = headway_mins
            opt_wait = pred_wait_mins
            opt_load = pred_load_pct
            recommendation = "Current schedule frequency is optimal for predicted block demand."

        return {
            "hub_code": hub_code,
            "time_bucket": time_bucket,
            "weather_code": weather_code[:3].upper(),
            "scheduled_headway_mins": headway_mins,
            "predicted_demand": pred_demand,
            "predicted_load_pct": pred_load_pct,
            "predicted_wait_mins": pred_wait_mins,
            "recommended_headway_mins": rec_headway,
            "optimized_wait_mins": opt_wait,
            "optimized_load_pct": opt_load,
            "wait_reduction_mins": round(pred_wait_mins - opt_wait, 1),
            "recommendation_reason": recommendation,
        }

    def get_comparison_table(self) -> List[Dict[str, Any]]:
        """
        Builds a structured route & hub comparison matrix comparing:
        1. Unoptimized / Disrupted State (or Baseline)
        2. Agent-Optimized State
        With explicit causal explanations for every recommendation.
        """
        rows = []
        disrupted_stations = (
            self.post_disruption_snapshot["stations"]
            if self.post_disruption_snapshot
            else {k: {"waiting_commuters": v["baseline_commuters"], "avg_wait_time": v["baseline_wait_time"]} for k, v in self.stations.items()}
        )

        for s_name, s_data in self.stations.items():
            before_wait = disrupted_stations.get(s_name, {}).get("avg_wait_time", s_data["baseline_wait_time"])
            before_comm = disrupted_stations.get(s_name, {}).get("waiting_commuters", s_data["baseline_commuters"])
            now_wait = s_data["avg_wait_time"]
            now_comm = s_data["waiting_commuters"]
            p_route = s_data["primary_route"]
            r_obj = self.routes.get(p_route, {})

            wait_delta = round(now_wait - before_wait, 1)
            relief_pct = (
                round(((before_wait - now_wait) / max(1.0, before_wait)) * 100.0, 1)
                if before_wait > now_wait
                else 0.0
            )

            if s_data["tokens_spent"] > 0:
                why_text = (
                    f"{s_data['dominant_persona']} queue spiked to {before_comm} pax ({before_wait:.1f}m wait > "
                    f"{s_data['patience_threshold_mins']}m patience). Hub Agent bid {s_data['tokens_spent']} tokens "
                    f"to acquire surplus EV capacity & compress headway to {r_obj.get('headway_mins', 8)} mins."
                )
            elif r_obj.get("tokens_earned", 0) > 0:
                why_text = (
                    f"Route operated at low load factor ({r_obj.get('baseline_load_%', 20)}%). Route Agent sold "
                    f"surplus EV bus for {r_obj.get('tokens_earned')} tokens while maintaining safe {s_data['avg_wait_time']:.1f}m wait."
                )
            else:
                why_text = (
                    f"Operating within equilibrium ({now_wait:.1f}m wait vs {s_data['patience_threshold_mins']}m "
                    f"{s_data['dominant_persona']} patience threshold). Alternative: {s_data['alt_route']}."
                )

            rows.append(
                {
                    "hub_name": s_name,
                    "primary_route": p_route,
                    "alternative_route": s_data["alt_route"],
                    "dominant_persona": s_data["dominant_persona"],
                    "disrupted_demand_pax": before_comm,
                    "optimized_demand_pax": now_comm,
                    "disrupted_wait_mins": round(before_wait, 1),
                    "optimized_wait_mins": round(now_wait, 1),
                    "wait_delta_mins": wait_delta,
                    "simulated_relief_pct": relief_pct,
                    "scheduled_headway_mins": r_obj.get("baseline_headway_mins", 12),
                    "recommended_headway_mins": r_obj.get("headway_mins", 12),
                    "active_buses": r_obj.get("active_buses", 4),
                    "route_load_pct": round(r_obj.get("load_factor_%", 50.0), 1),
                    "tokens_exchanged": s_data["tokens_spent"] or r_obj.get("tokens_earned", 0),
                    "why_recommended": why_text,
                }
            )
        return rows

    def get_twin_telemetry(self) -> Dict[str, Any]:
        """Returns the complete Digital Twin state snapshot for API & Frontend rendering."""
        self.recompute_station_statuses()
        avg_wait = round(
            sum(s["avg_wait_time"] for s in self.stations.values()) / len(self.stations), 1
        )
        total_waiting = sum(s["waiting_commuters"] for s in self.stations.values())
        critical_hubs = sum(1 for s in self.stations.values() if s["avg_wait_time"] > 15.0)
        total_buses = sum(r["active_buses"] for r in self.routes.values())

        return {
            "compliance_guardrail": self.sandbox_compliance_banner,
            "simulation_step": self.simulation_step,
            "active_scenario": self.active_scenario,
            "scenario_title": self.scenario_title,
            "weather_condition": self.weather_condition,
            "simulated_hour": self.simulated_hour,
            "kpis": {
                "network_avg_wait_mins": avg_wait,
                "total_waiting_commuters": total_waiting,
                "critical_bottleneck_hubs": critical_hubs,
                "total_active_fleet": total_buses,
                "total_tokens_traded": self.esg_ledger["total_tokens_traded"],
                "co2_prevented_kg": round(self.esg_ledger["co2_prevented_kg"], 1),
                "esg_revenue_usd": round(self.esg_ledger["estimated_esg_revenue_usd"], 2),
                "ghost_routes_active": len(self.ghost_routes),
            },
            "stations": self.stations,
            "routes": self.routes,
            "ev_fleet_units": self.ev_fleet_units,
            "active_trades": self.active_trades,
            "ghost_routes": self.ghost_routes,
            "esg_ledger": self.esg_ledger,
            "comparison_table": self.get_comparison_table(),
            "commuter_companion_advisories": self.commuter_companion_advisories,
            "causal_report_markdown": self.causal_report_markdown,
            "negotiation_logs": self.negotiation_logs[-45:],
        }

    def snapshot_minimal(self) -> Dict[str, Any]:
        """Compact snapshot used for GenAI prompt injection."""
        return {
            "stations": {
                k: {
                    "waiting_commuters": v["waiting_commuters"],
                    "avg_wait_time_mins": v["avg_wait_time"],
                    "dominant_persona": v["dominant_persona"],
                    "token_pool": v["token_pool"],
                    "distress_index": v["distress_index"],
                }
                for k, v in self.stations.items()
            },
            "routes": {
                k: {
                    "active_buses": v["active_buses"],
                    "headway_mins": v["headway_mins"],
                    "load_factor_%": v["load_factor_%"],
                    "min_fleet_soc_%": v["min_fleet_soc_%"],
                }
                for k, v in self.routes.items()
            },
        }
