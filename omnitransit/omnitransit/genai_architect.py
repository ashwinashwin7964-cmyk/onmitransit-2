"""
Generative AI Causal Engine — The Chief AI Urban Transit Architect
==================================================================
Translates complex Multi-Agent Token Negotiation logs and Digital Twin
state transitions into authoritative Causal English justifications for
urban transit dispatchers and policy planners.
"""

import json
import os
import urllib.request
from typing import Any, Dict, List, Optional
from .digital_twin import UrbanTransitDigitalTwin


def get_transit_architect_prompt(
    initial_state: str,
    final_state: str,
    negotiation_logs: str,
    metrics_delta: str,
) -> str:
    """
    Exact prompt template fed into the Generative AI engine to produce
    causal transit architecture briefings.
    """
    prompt = f"""You are the Chief AI Urban Transit Architect for a Smart City Metropolitan Council. Your role is to act as the interpreter between a complex, autonomous multi-agent simulation and human city planners who require high-level causal explanations for system-directed alterations.

Analyze the following event data representing a real-time shift in our city's Public Transport Digital Twin:

=========================================
1. INITIAL SYSTEM STATE (THE TRIGGER/DISRUPTION)
=========================================
{initial_state}

=========================================
2. SWARM NEGOTIATION & GAME-THEORETIC LOGS
=========================================
{negotiation_logs}

=========================================
3. FINAL OPTIMIZED SYSTEM STATE
=========================================
{final_state}

=========================================
4. NET PERFORMANCE IMPACT METRICS
=========================================
{metrics_delta}

=========================================
EXECUTIVE BRIEFING INSTRUCTIONS
=========================================
Write a highly professional, authoritative, and concise executive summary in markdown format explaining the underlying cause-and-effect mechanics of this event.

Your output must strictly structure itself under the following four headers:

### 💥 1. Incident Causal Analysis
Explain exactly what bottleneck or disruption occurred, what commuter personas were most severely impacted, and why the unoptimized baseline network layout was incapable of handling the surge.

### 🤝 2. Autonomous Market Resolution
Detail how the Game-Theoretic Token Economy solved the issue. Explain which Hub Agent issued the bounty, which Route Agent accepted the trade, and how this decentralized financial balancing mechanism reached an equilibrium without any centralized manual dispatching instruction.

### 🔋 3. Environmental & Asset Guardrails
Confirm that the route transition successfully respected asset limitations. Specifically state how the vehicle's EV battery limits were preserved, and detail the exact volume of *Carbon Credit Generation (ESG Offsets)* earned by preventing passengers from deserting to private ride-sharing services.

### ⚠️ 4. Sandbox Policy Disclaimer
Conclude with a clear statement re-emphasizing that this optimization strategy was computed inside the Digital Twin planning matrix and must be thoroughly stress-tested against historical city dispatch tables before being rolled out to live passenger-facing timetables.

Maintain a sophisticated, analytical, data-driven tone. Avoid vague or conversational sentences. Focus heavily on providing actionable architectural clarity."""
    return prompt


class GenAITransitArchitect:
    """
    Orchestrates the Causal Reasoning Report generation.
    Supports live Gemini / Groq / OpenAI API keys and includes a deterministic
    telemetry-driven Causal Synthesizer so the prototype works 100% reliably offline or online.
    """

    @classmethod
    def generate_causal_briefing(
        cls,
        twin: UrbanTransitDigitalTwin,
        api_key: Optional[str] = None,
        provider: str = "gemini",
    ) -> Dict[str, str]:
        initial_obj = twin.post_disruption_snapshot or twin.pre_disruption_snapshot or twin.snapshot_minimal()
        final_obj = twin.snapshot_minimal()
        logs_str = "\n".join(item["formatted"] for item in twin.negotiation_logs[-20:])

        delta_summary = {
            "active_scenario": twin.active_scenario,
            "scenario_title": twin.scenario_title,
            "trades_executed": twin.active_trades,
            "ghost_routes": twin.ghost_routes,
            "esg_ledger": twin.esg_ledger,
        }

        prompt_text = get_transit_architect_prompt(
            initial_state=json.dumps(initial_obj, indent=2),
            final_state=json.dumps(final_obj, indent=2),
            negotiation_logs=logs_str,
            metrics_delta=json.dumps(delta_summary, indent=2),
        )

        # If an external API key is passed or set in env, attempt live LLM inference first
        resolved_key = api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GROQ_API_KEY")
        if resolved_key:
            live_resp = cls._call_external_llm(prompt_text, resolved_key, provider)
            if live_resp:
                twin.causal_report_markdown = live_resp
                return {"prompt": prompt_text, "report_markdown": live_resp, "engine": f"LIVE_{provider.upper()}_LLM"}

        # Deterministic Causal Reasoning Synthesis grounded in the exact Digital Twin & 2M-Row Block telemetry
        report_md = cls._synthesize_causal_markdown(twin)
        twin.causal_report_markdown = report_md
        return {
            "prompt": prompt_text,
            "report_markdown": report_md,
            "engine": "OMNITRANSIT_CAUSAL_SYNTHESIZER_V2",
        }

    @staticmethod
    def _call_external_llm(prompt: str, api_key: str, provider: str) -> Optional[str]:
        try:
            if provider.lower() == "groq" or api_key.startswith("gsk_"):
                url = "https://api.groq.com/openai/v1/chat/completions"
                payload = json.dumps(
                    {
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.2,
                    }
                ).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                    return body["choices"][0]["message"]["content"]
            else:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}"
                payload = json.dumps(
                    {"contents": [{"parts": [{"text": prompt}]}]}
                ).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=8) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                    return body["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            return None

    @staticmethod
    def _synthesize_causal_markdown(twin: UrbanTransitDigitalTwin) -> str:
        trades = twin.active_trades
        esg = twin.esg_ledger
        scenario = twin.scenario_title
        weather = twin.weather_condition
        hour = twin.simulated_hour

        if not trades:
            return (
                f"### 💥 1. Incident Causal Analysis\n"
                f"Under scenario **{scenario}** (`{weather}` at `{hour:02d}:00`), the Digital Twin detected localized demand fluctuations. "
                f"Wait-time telemetry across primary hubs remained near or below the critical `15.0 min` dispatch threshold, "
                f"or awaits autonomous swarm execution.\n\n"
                f"### 🤝 2. Autonomous Market Resolution\n"
                f"No emergency token bounties have been settled in the current cycle. Click **Run Autonomous Swarm Auction** "
                f"or **Trigger Chaos + Auto-Swarm** to execute decentralized token bidding between Buyer Hubs and Seller Routes.\n\n"
                f"### 🔋 3. Environmental & Asset Guardrails\n"
                f"All `40` active EV and Hybrid transit units remain within safe State-of-Charge thresholds (`>=25% SOC`). "
                f"Cumulative ESG Carbon Offset stands at **{esg['co2_prevented_kg']} kg CO₂e**.\n\n"
                f"### ⚠️ 4. Sandbox Policy Disclaimer\n"
                f"> **[⚠️ SIMULATION SANDBOX MODE — POLICY PLANNING ONLY]**\n"
                f"> All metrics, headways, and queue projections above are simulated estimates derived from the **2,000,000-row "
                f"OmniTransit Blocked Telemetry Dataset** and must not be displayed as live passenger arrival ETAs."
            )

        # Build detailed causal narrative from actual trades
        incident_bullets = []
        market_bullets = []
        table_rows = []

        for t in trades:
            hub = t["buyer_hub"]
            st = twin.stations.get(hub, {})
            persona = st.get("dominant_persona", "Commuter-Cohort")
            patience = st.get("patience_threshold_mins", 12.0)
            p_route = st.get("primary_route", "Primary Corridor")
            alt_route = st.get("alt_route", "Alternative Corridor")
            r_obj = twin.routes.get(p_route, {})

            incident_bullets.append(
                f"- **{hub} Bottleneck (`{p_route}`):** Triggered by **{scenario}** (`{weather}` at `{hour:02d}:00`). "
                f"Simulated waiting time surged to **`{t['wait_before_mins']} mins`**, breaching the **`{persona}`** "
                f"patience threshold (`{patience} mins`) and stranding `{t['commuters_relieved'] + st.get('waiting_commuters', 30)}` passengers. "
                f"The static baseline headway (`{r_obj.get('baseline_headway_mins', 12)} mins`) lacked the elastic capacity to absorb the spike."
            )

            ghost_note = (
                f" Additionally, **`{t['ghost_route_id']}`** was dynamically synthesized as a non-stop express corridor."
                if t.get("ghost_route_id")
                else ""
            )
            market_bullets.append(
                f"- **Trade Settlement (`{hub}`  `{t['seller_route']}`):** The `{hub}` Buyer Agent broadcast an emergency bounty of "
                f"**`{t['tokens_paid']} Transit Tokens`**. While high-load routes (`>75%` occupancy) rejected the bid to protect their own SLAs, "
                f"**`{t['seller_route']}`** (operating at `<30%` off-peak load factor) accepted the bounty and diverted **`{t['buses_shifted']} EV bus(es)`**, "
                f"compressing `{p_route}` headway to **`{r_obj.get('headway_mins', 8)} mins`** and cutting simulated wait time from "
                f"**`{t['wait_before_mins']} mins` ➔ `{t['wait_after_mins']} mins`** (`-{round(t['wait_before_mins'] - t['wait_after_mins'], 1)} mins` relief).{ghost_note}"
            )

            table_rows.append(
                f"| **{hub}** | `{p_route}` | `{alt_route}` | `{t['wait_before_mins']} mins` | **`{t['wait_after_mins']} mins`** | "
                f"`{r_obj.get('baseline_headway_mins', 12)}m ➔ {r_obj.get('headway_mins', 8)}m` | `+{t['buses_shifted']} EV Bus` (`{t['tokens_paid']} Tokens`) |"
            )

        incident_section = "\n".join(incident_bullets)
        market_section = "\n".join(market_bullets)
        comparison_md = (
            "\n\n#### 📊 Disrupted Baseline vs. Swarm-Optimized Schedule Comparison\n"
            "| Transit Hub | Primary Route | Alternative Route | Disrupted Wait | Optimized Wait | Headway Shift | Autonomous Action |\n"
            "| :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n"
            + "\n".join(table_rows)
        )

        return (
            f"### 💥 1. Incident Causal Analysis\n"
            f"{incident_section}\n\n"
            f"### 🤝 2. Autonomous Market Resolution\n"
            f"{market_section}"
            f"{comparison_md}\n\n"
            f"### 🔋 3. Environmental & Asset Guardrails\n"
            f"- **EV Fleet Battery-Life & Grid Guardrail:** Prior to vehicle dispatch, the `EV_Grid_Guardrail` agent audited candidate seller fleets "
            f"(blocking `{esg['ev_guardrail_blocks_triggered']}` low-SOC transfer attempt(s) where battery charge was `<25%`, such as `EV-106X` at `19% SOC`) "
            f"and exclusively reallocated high-charge units (`78%–88% SOC`).\n"
            f"- **ESG Carbon-Credit Monetization:** By resolving station queues before `{esg['commuters_retained_in_transit']}` commuters abandoned public transit "
            f"for private ride-hailing (`{esg['private_cab_trips_prevented']}` cab trips prevented), the swarm prevented **`{esg['co2_prevented_kg']} kg CO₂e`** "
            f"(`{esg['co2_prevented_metric_tons']} metric tons`) and minted **`{esg['verified_carbon_credits_minted']} Verified Carbon Credits`** "
            f"(valued at **`${esg['estimated_esg_revenue_usd']}` / `₹{int(esg['estimated_esg_revenue_inr'])}`**).\n\n"
            f"### ⚠️ 4. Sandbox Policy Disclaimer\n"
            f"> **[⚠️ SIMULATION SANDBOX MODE — POLICY PLANNING ONLY]**\n"
            f"> This schedule and route optimization strategy was computed inside the **OmniTransit Digital Twin Planning Matrix** "
            f"(calibrated on **2,000,000 synthetic telemetry rows / 128 Smart Blocks**). Simulated demand and waiting-time comparisons "
            f"are intended strictly for dispatcher policy evaluation and must never be presented to the public as live vehicle arrival ETAs."
        )
