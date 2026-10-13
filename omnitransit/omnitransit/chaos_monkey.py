"""
Adversarial Stress-Tester — The Chaos Monkey Agent
==================================================
Simulates urban transport disruptions (Flash Floods, Metro Line Failures,
Stadium Event Surges, EV Grid Throttling, and Custom Parameter Shocks)
to test the decentralized resilience of the 3-Layer Agent Swarm.
"""

from typing import Any, Dict
from .digital_twin import UrbanTransitDigitalTwin


class ChaosMonkeyAgent:
    """
    Adversarial agent whose sole objective is to fracture transit equilibrium
    and force autonomous market-driven re-optimization.
    """

    SCENARIOS = {
        "HEAVY_RAIN": {
            "title": "Sudden Cloudburst & Flash Flood (North-East Tech Corridor)",
            "weather": "FLASH_FLOOD",
            "hour": 18,
            "description": (
                "Severe monsoon cloudburst hits Kalapatti Tech Hub and Saravanampatti IT Corridor "
                "at 18:00 peak exit. Road speed drops 42% and student/IT commuter queues surge."
            ),
        },
        "METRO_BREAKDOWN": {
            "title": "Peelamedu Metro Feeder Signal Failure & Med-Corridor Spillover",
            "weather": "LIGHT_RAIN",
            "hour": 9,
            "description": (
                "Traction power fault halts Metro Feeder line at Peelamedu & Gandhipuram Central "
                "during 09:00 hospital & university shift change, dumping 310 stranded commuters onto bus hubs."
            ),
        },
        "STADIUM_SURGE": {
            "title": "28,000-Spectator Championship Exit at Town Hall & CBD",
            "weather": "CLEAR",
            "hour": 20,
            "description": (
                "Sudden dispersal of 28,000 spectators near Town Hall Heritage Hub and Gandhipuram Central "
                "creates an asymmetric demand spike while eastern industrial routes run nearly empty."
            ),
        },
        "EV_GRID_CRISIS": {
            "title": "Substation Peak-Load Throttling + Evening Shift Release",
            "weather": "EXTREME_HEAT",
            "hour": 17,
            "description": (
                "Urban grid transformer thermal limit locks low-SOC EV chargers while Saravanampatti IT "
                "and Kalapatti hubs experience simultaneous shift-release bottlenecks."
            ),
        },
        "COMPOUND_CRISIS": {
            "title": "Category-5 Compound Urban Stress Test (Flood + Feeder Fault + Surge)",
            "weather": "FLASH_FLOOD",
            "hour": 18,
            "description": (
                "Simultaneous flash flood in North-East corridor, feeder signal outage at Peelamedu, "
                "and commuter rush at Gandhipuram Central."
            ),
        },
    }

    def trigger_disruption(
        self,
        twin: UrbanTransitDigitalTwin,
        event_type: str = "HEAVY_RAIN",
        custom_params: Dict[str, Any] = None,
    ) -> Dict[str, Any]:
        """Applies an adversarial stress shock to the Digital Twin."""
        twin.simulation_step += 1
        twin.active_trades = []
        twin.pre_disruption_snapshot = twin.snapshot_minimal()

        if event_type == "CUSTOM" and custom_params:
            return self._trigger_custom(twin, custom_params)

        meta = self.SCENARIOS.get(event_type, self.SCENARIOS["HEAVY_RAIN"])
        twin.active_scenario = event_type
        twin.scenario_title = meta["title"]
        twin.weather_condition = meta["weather"]
        twin.simulated_hour = meta["hour"]

        if event_type == "HEAVY_RAIN":
            # Kalapatti & Saravanampatti hit hardest
            self._spike_hub(twin, "Kalapatti Hub", add_commuters=145, add_wait=19.5)
            self._spike_hub(twin, "Saravanampatti IT", add_commuters=115, add_wait=15.0)
            self._spike_route(twin, "Route-101 (Town Hall - Kalapatti)", load_pct=96.0, speed_kmh=13.5)
            self._spike_route(twin, "Route-104 (Saravanampatti - Gandhipuram)", load_pct=94.0, speed_kmh=14.0)
            twin.log_event(
                "⚠️ CHAOS MONKEY",
                "DISRUPTION",
                "Triggered FLASH_FLOOD over Kalapatti Hub (+145 Student/IT pax, 31.0m wait) & Saravanampatti IT (+115 pax, 27.5m wait)!",
            )

        elif event_type == "METRO_BREAKDOWN":
            self._spike_hub(twin, "Peelamedu Metro Link", add_commuters=170, add_wait=21.0)
            self._spike_hub(twin, "Gandhipuram Central", add_commuters=130, add_wait=16.5)
            self._spike_route(twin, "Route-105 (Metro Feeder Loop)", load_pct=98.0, speed_kmh=15.0)
            self._spike_route(twin, "Route-102 (Gandhipuram - Peelamedu)", load_pct=95.0, speed_kmh=16.0)
            twin.log_event(
                "⚠️ CHAOS MONKEY",
                "DISRUPTION",
                "Triggered METRO_BREAKDOWN at Peelamedu Link (+170 Healthcare/Student pax, 31.0m wait) & Gandhipuram Central (+130 pax)!",
            )

        elif event_type == "STADIUM_SURGE":
            self._spike_hub(twin, "Town Hall Hub", add_commuters=195, add_wait=22.5)
            self._spike_hub(twin, "Gandhipuram Central", add_commuters=125, add_wait=15.5)
            self._spike_route(twin, "Route-103 (Town Hall - Singanallur)", load_pct=97.0, speed_kmh=14.5)
            self._spike_route(twin, "Route-102 (Gandhipuram - Peelamedu)", load_pct=91.0, speed_kmh=17.0)
            twin.log_event(
                "⚠️ CHAOS MONKEY",
                "DISRUPTION",
                "Triggered STADIUM_SURGE at Town Hall Hub (+195 spectators, 33.0m wait) & Gandhipuram Central (+125 pax, 27.5m wait)!",
            )

        elif event_type == "EV_GRID_CRISIS":
            self._spike_hub(twin, "Saravanampatti IT", add_commuters=150, add_wait=18.5)
            self._spike_hub(twin, "Kalapatti Hub", add_commuters=125, add_wait=17.0)
            self._spike_route(twin, "Route-104 (Saravanampatti - Gandhipuram)", load_pct=95.0, speed_kmh=16.0)
            self._spike_route(twin, "Route-101 (Town Hall - Kalapatti)", load_pct=92.0, speed_kmh=16.5)
            # Drop one more EV unit SOC to test multi-unit battery guardrail
            twin.ev_fleet_units[2]["soc_pct"] = 21
            twin.ev_fleet_units[2]["status"] = "GUARDRAIL_LOCKED_LOW_SOC"
            twin.log_event(
                "⚠️ CHAOS MONKEY",
                "DISRUPTION",
                "Triggered EV_GRID_CRISIS: Substation thermal limit locked 2 low-SOC EV buses (<25%) during IT Corridor surge!",
            )

        else:  # COMPOUND_CRISIS
            self._spike_hub(twin, "Kalapatti Hub", add_commuters=160, add_wait=21.5)
            self._spike_hub(twin, "Peelamedu Metro Link", add_commuters=145, add_wait=19.0)
            self._spike_hub(twin, "Saravanampatti IT", add_commuters=130, add_wait=16.5)
            self._spike_route(twin, "Route-101 (Town Hall - Kalapatti)", load_pct=99.0, speed_kmh=12.5)
            self._spike_route(twin, "Route-105 (Metro Feeder Loop)", load_pct=96.0, speed_kmh=14.0)
            self._spike_route(twin, "Route-104 (Saravanampatti - Gandhipuram)", load_pct=94.0, speed_kmh=15.0)
            twin.log_event(
                "⚠️ CHAOS MONKEY",
                "DISRUPTION",
                "Triggered COMPOUND_CRISIS across Kalapatti Hub, Peelamedu Metro Link, and Saravanampatti IT Corridor!",
            )

        twin.recompute_station_statuses()
        twin.post_disruption_snapshot = twin.snapshot_minimal()
        return {
            "event_type": event_type,
            "scenario_title": twin.scenario_title,
            "weather": twin.weather_condition,
        }

    def _trigger_custom(self, twin: UrbanTransitDigitalTwin, params: Dict[str, Any]) -> Dict[str, Any]:
        rain_pct = float(params.get("rain_intensity_pct", 50))
        pop_surge_pct = float(params.get("population_surge_pct", 35))
        metro_fault = bool(params.get("metro_breakdown", False))
        hour = int(params.get("simulated_hour", 18))

        twin.active_scenario = "CUSTOM_SANDBOX_SCENARIO"
        twin.scenario_title = f"Custom What-If Matrix (Rain {int(rain_pct)}%, Demand +{int(pop_surge_pct)}%)"
        twin.weather_condition = "FLASH_FLOOD" if rain_pct >= 65 else ("LIGHT_RAIN" if rain_pct >= 25 else "CLEAR")
        twin.simulated_hour = hour

        scale = (rain_pct / 50.0) * 0.55 + (pop_surge_pct / 35.0) * 0.65
        self._spike_hub(twin, "Kalapatti Hub", int(95 * scale), round(12.5 * scale, 1))
        self._spike_hub(twin, "Saravanampatti IT", int(80 * scale), round(10.5 * scale, 1))
        if metro_fault:
            self._spike_hub(twin, "Peelamedu Metro Link", int(135 * scale), round(15.5 * scale, 1))

        twin.log_event(
            "⚠️ CHAOS MONKEY",
            "DISRUPTION",
            f"Injected Custom What-If Scenario: Rain={int(rain_pct)}%, Population Surge=+{int(pop_surge_pct)}%, MetroFault={metro_fault} at {hour:02d}:00.",
        )
        twin.recompute_station_statuses()
        twin.post_disruption_snapshot = twin.snapshot_minimal()
        return {
            "event_type": "CUSTOM",
            "scenario_title": twin.scenario_title,
            "weather": twin.weather_condition,
        }

    @staticmethod
    def _spike_hub(twin: UrbanTransitDigitalTwin, hub_name: str, add_commuters: int, add_wait: float) -> None:
        if hub_name in twin.stations:
            st = twin.stations[hub_name]
            st["waiting_commuters"] += add_commuters
            st["avg_wait_time"] = round(st["avg_wait_time"] + add_wait, 1)
            # Scale persona counts proportionally
            pb = st.get("persona_breakdown", {})
            if pb:
                dom = st["dominant_persona"]
                pb[dom] = pb.get(dom, 30) + int(add_commuters * 0.65)

    @staticmethod
    def _spike_route(twin: UrbanTransitDigitalTwin, route_name: str, load_pct: float, speed_kmh: float) -> None:
        if route_name in twin.routes:
            rt = twin.routes[route_name]
            rt["load_factor_%"] = load_pct
            rt["avg_speed_kmh"] = speed_kmh
