"""
3-Layer Autonomous Multi-Agent Swarm & Game-Theoretic Token Marketplace
=======================================================================
Implements:
- Layer 1: Commuter Persona Agents (Patience thresholds, rideshare abandonment risk)
- Layer 2: Hub Management Agents (Buyers broadcasting Token Bounties on wait > 15m)
- Layer 3: Fleet Commander & Route Agents (Sellers evaluating load factor & EV SOC >= 25%)
- Commercial Extensions:
  * EV Fleet Battery-Life & Grid Constraint Guardrails
  * Dynamic "Ghost-Route" Generator (On-Demand Express Corridors)
  * ESG Carbon-Credit Token Exchange (CO2 offset & revenue ledger)
"""

from typing import Any, Dict, List
from .digital_twin import UrbanTransitDigitalTwin


class CommuterPersonaLayer:
    """Layer 1: Evaluates commuter archetype distress and mode-shift abandonment risk."""

    @staticmethod
    def audit_commuter_cohorts(twin: UrbanTransitDigitalTwin, hub_name: str) -> Dict[str, Any]:
        st = twin.stations[hub_name]
        wait = st["avg_wait_time"]
        patience = st["patience_threshold_mins"]
        dom_persona = st["dominant_persona"]
        waiting = st["waiting_commuters"]

        if wait > patience:
            overrun = round(wait - patience, 1)
            # Estimate how many commuters would desert to private cabs/autos without intervention
            at_risk_pax = int(round(waiting * min(0.68, (overrun / 22.0) * 0.65)))
            twin.log_event(
                f"Persona_{dom_persona}",
                "PERSONA_ALERT",
                f"At {hub_name}: Simulated wait ({wait}m) exceeds {dom_persona} patience threshold ({patience}m) by +{overrun}m. "
                f"{at_risk_pax} commuters at imminent risk of abandoning public transit for private ride-hailing.",
            )
            return {"at_risk_pax": at_risk_pax, "overrun_mins": overrun}
        return {"at_risk_pax": 0, "overrun_mins": 0.0}


class HubAgent:
    """Layer 2: Autonomous Station Buyer Agent that bids tokens to resolve crowd bottlenecks."""

    def __init__(self, name: str) -> None:
        self.name = name

    def evaluate_market_need(self, twin: UrbanTransitDigitalTwin) -> int:
        station_data = twin.stations[self.name]
        wait_mins = station_data["avg_wait_time"]
        commuters = station_data["waiting_commuters"]

        if wait_mins > 15.0:
            # First run Layer-1 Persona audit
            CommuterPersonaLayer.audit_commuter_cohorts(twin, self.name)

            # Calculate Game-Theoretic Token Bounty proportional to commuter distress
            raw_bounty = int(round(commuters * 2.8 + (wait_mins - 15.0) * 14.0))
            bounty = min(station_data["token_pool"], max(250, raw_bounty))
            twin.log_event(
                f"Hub_{self.name.replace(' ', '_')}_Agent",
                "BOUNTY_BID",
                f"BOTTLENECK CRITICAL ({commuters} pax waiting, {wait_mins}m simulated wait)! "
                f"Broadcasting decentralized bounty of {bounty} Transit Tokens for immediate EV fleet reinforcement.",
            )
            return bounty
        return 0


class EVBatteryGuardrailAgent:
    """Commercial Guardrail: Prevents dispatching EV buses with <25% State-of-Charge (SOC)."""

    MIN_SAFE_SOC_PCT = 25

    @classmethod
    def verify_route_can_donate(cls, twin: UrbanTransitDigitalTwin, route_name: str) -> bool:
        r_data = twin.routes[route_name]
        min_soc = r_data.get("min_fleet_soc_%", 75)

        if min_soc < cls.MIN_SAFE_SOC_PCT:
            twin.esg_ledger["ev_guardrail_blocks_triggered"] += 1
            twin.log_event(
                "EV_Grid_Guardrail",
                "GUARDRAIL_BLOCK",
                f"VETOED transfer from {route_name}: Candidate unit has {min_soc}% Battery SOC "
                f"(below {cls.MIN_SAFE_SOC_PCT}% minimum grid-safety threshold). Routing unit to fast-charger instead; scanning next seller...",
            )
            # After flagging the low-SOC unit to depot, remaining standby units on that route have high SOC (81%)
            r_data["min_fleet_soc_%"] = 81
            return False
        return True


class FleetMarketCommander:
    """
    Layer 3: Decentralized Fleet & Route Seller Swarm.
    Matches Hub token bounties against underutilized Seller Routes, enforces EV battery
    guardrails, spawns Dynamic Ghost-Routes for extreme surges, and calculates ESG Carbon Credits.
    """

    def run_market_equilibrium(self, twin: UrbanTransitDigitalTwin) -> Dict[str, Any]:
        trades_executed = []
        distressed_hubs = [
            name
            for name, s in sorted(
                twin.stations.items(), key=lambda x: x[1]["avg_wait_time"], reverse=True
            )
            if s["avg_wait_time"] > 15.0
        ]

        if not distressed_hubs:
            twin.log_event(
                "Fleet_Commander",
                "INFO",
                "All 8 metropolitan hubs operating below 15.0m wait threshold. No token auction required.",
            )
            return {"trades_executed": [], "resolved_hubs": 0}

        for hub_name in distressed_hubs:
            hub_agent = HubAgent(hub_name)
            bounty = hub_agent.evaluate_market_need(twin)
            if bounty > 0:
                trade = self.process_bounties(twin, hub_name, bounty)
                if trade:
                    trades_executed.append(trade)

        twin.recompute_station_statuses()
        return {
            "trades_executed": trades_executed,
            "resolved_hubs": len(trades_executed),
        }

    def process_bounties(
        self, twin: UrbanTransitDigitalTwin, hub_name: str, bounty_offered: int
    ) -> Dict[str, Any]:
        if bounty_offered <= 0:
            return {}

        st = twin.stations[hub_name]
        primary_route_name = st["primary_route"]
        twin.log_event(
            "Fleet_Commander",
            "MARKET_SCAN",
            f"Auditing 8 Route Seller Agents to fulfill {hub_name}'s {bounty_offered}-token bounty...",
        )

        # Step 1: Log a realistic diplomatic rejection from a busy route first
        for r_name, r_data in twin.routes.items():
            if r_data["load_factor_%"] >= 75.0 and r_name != primary_route_name:
                twin.log_event(
                    f"{r_data['id']}_Agent",
                    "PROPOSAL_REJECTED",
                    f"Proposal rejected for {hub_name}. My current load factor is {r_data['load_factor_%']}% "
                    f"along {r_data['via']}. Cannot release fleet units without violating headway SLA.",
                )
                break

        # Step 2: Scan underutilized Seller Routes (load_factor < 40% and active_buses > 2)
        for route_name, data in twin.routes.items():
            if data["load_factor_%"] < 40.0 and data["active_buses"] > 2:
                # Check EV Battery & Grid Constraint Guardrail!
                if not EVBatteryGuardrailAgent.verify_route_can_donate(twin, route_name):
                    # Try next seller route or re-evaluate backup unit
                    continue

                # Execute Autonomous Token Trade
                old_wait = st["avg_wait_time"]
                old_commuters = st["waiting_commuters"]

                # If extreme surge (waiting_commuters >= 250), shift 2 buses & spawn a Dynamic Ghost-Route!
                severe_surge = old_commuters >= 250 and data["active_buses"] >= 4
                buses_transferred = 2 if severe_surge else 1

                data["active_buses"] -= buses_transferred
                data["headway_mins"] = min(22, data["headway_mins"] + (3 * buses_transferred))
                data["load_factor_%"] = round(data["load_factor_%"] + (11.0 * buses_transferred), 1)
                data["tokens_earned"] += bounty_offered

                # Reinforce the distressed hub's primary corridor
                if primary_route_name in twin.routes:
                    pr = twin.routes[primary_route_name]
                    pr["active_buses"] += buses_transferred
                    pr["headway_mins"] = max(5, pr["headway_mins"] - (3 * buses_transferred))
                    pr["load_factor_%"] = max(48.0, round(pr["load_factor_%"] - (16.0 * buses_transferred), 1))
                    pr["avg_speed_kmh"] = min(26.0, round(pr["avg_speed_kmh"] + 4.5, 1))

                commuters_cleared = min(old_commuters - 28, 78 * buses_transferred)
                new_commuters = max(24, old_commuters - commuters_cleared)
                new_wait = max(6.0, round(old_wait - (11.5 * buses_transferred), 1))

                st["waiting_commuters"] = new_commuters
                st["avg_wait_time"] = new_wait
                st["token_pool"] = max(0, st["token_pool"] - bounty_offered)
                st["tokens_spent"] += bounty_offered

                twin.log_event(
                    f"{data['id']}_Agent",
                    "BOUNTY_ACCEPTED",
                    f"Bounty accepted! Load factor is only {round(data['load_factor_%'] - 11.0 * buses_transferred, 1)}% "
                    f"(EV SOC {data['min_fleet_soc_%']}% >= 25% verified). Releasing {buses_transferred} EV bus(es) to {hub_name} "
                    f"and claiming {bounty_offered} Transit Tokens.",
                )

                ghost_route_id = None
                if severe_surge:
                    ghost_route_id = f"Ghost-Corridor-{len(twin.ghost_routes) + 1}"
                    ghost_origin = twin.routes[route_name]["destination"]
                    twin.ghost_routes.append(
                        {
                            "id": ghost_route_id,
                            "name": f"{ghost_route_id} ({ghost_origin} ➔ {hub_name} Express)",
                            "from_hub": ghost_origin,
                            "to_hub": hub_name,
                            "buses_deployed": buses_transferred,
                            "estimated_time_saved_mins": round(old_wait - new_wait, 1),
                            "commuters_served": commuters_cleared,
                        }
                    )
                    twin.esg_ledger["ghost_routes_spawned"] += 1
                    twin.log_event(
                        "Ghost_Route_Synthesizer",
                        "GHOST_ROUTE",
                        f"Spawned temporary on-demand {ghost_route_id} ({ghost_origin} ➔ {hub_name} Non-Stop Express) "
                        f"to bypass arterial congestion, clearing {commuters_cleared} stranded commuters.",
                    )

                # Calculate Commercial ESG Carbon Credit Offsets
                # Each prevented private auto/cab trip (~6.8 km avg corridor) saves ~1.42 kg CO2e
                prevented_cabs = max(12, int(round(commuters_cleared * 0.58)))
                co2_saved_kg = round(prevented_cabs * 1.42, 2)
                credits_minted = round(co2_saved_kg / 10.0, 2)  # Micro-Carbon Transit Credits
                usd_val = round(credits_minted * 4.85, 2)
                inr_val = round(usd_val * 84.0, 0)

                twin.esg_ledger["total_tokens_traded"] += bounty_offered
                twin.esg_ledger["commuters_retained_in_transit"] += commuters_cleared
                twin.esg_ledger["private_cab_trips_prevented"] += prevented_cabs
                twin.esg_ledger["co2_prevented_kg"] = round(
                    twin.esg_ledger["co2_prevented_kg"] + co2_saved_kg, 2
                )
                twin.esg_ledger["co2_prevented_metric_tons"] = round(
                    twin.esg_ledger["co2_prevented_kg"] / 1000.0, 4
                )
                twin.esg_ledger["verified_carbon_credits_minted"] = round(
                    twin.esg_ledger["verified_carbon_credits_minted"] + credits_minted, 2
                )
                twin.esg_ledger["estimated_esg_revenue_usd"] = round(
                    twin.esg_ledger["estimated_esg_revenue_usd"] + usd_val, 2
                )
                twin.esg_ledger["estimated_esg_revenue_inr"] = round(
                    twin.esg_ledger["estimated_esg_revenue_inr"] + inr_val, 0
                )

                twin.log_event(
                    "ESG_Carbon_Exchange",
                    "ESG_MINT",
                    f"Prevented {prevented_cabs} private cab desertions at {hub_name}: "
                    f"Saved {co2_saved_kg} kg CO2e | Minted +{credits_minted} ESG Carbon Credits (${usd_val} / ₹{int(inr_val)}).",
                )
                twin.log_event(
                    "Fleet_Commander",
                    "RESOLVED",
                    f"Digital Twin updated: {hub_name} simulated wait dropped from {old_wait}m ➔ {new_wait}m "
                    f"(-{round(old_wait - new_wait, 1)}m latency relief).",
                )

                seller_hub = twin.routes[route_name]["destination"]
                trade_record = {
                    "buyer_hub": hub_name,
                    "seller_route": route_name,
                    "seller_hub": seller_hub,
                    "buses_shifted": buses_transferred,
                    "tokens_paid": bounty_offered,
                    "wait_before_mins": old_wait,
                    "wait_after_mins": new_wait,
                    "commuters_relieved": commuters_cleared,
                    "co2_saved_kg": co2_saved_kg,
                    "ghost_route_id": ghost_route_id,
                }
                twin.active_trades.append(trade_record)
                return trade_record

        twin.log_event(
            "Fleet_Commander",
            "WARNING",
            f"No eligible under-utilized routes passed EV Battery Guardrail for {hub_name}.",
        )
        return {}
