#!/usr/bin/env python3
"""
OmniTransit-Agent Swarm — High-Throughput Backend API & Digital Twin Server
===========================================================================
Serves the Enterprise Command-Center Frontend and exposes REST endpoints for:
- Real-Time Digital Twin Telemetry (`/api/state`)
- Adversarial Chaos Monkey Disruptions (`/api/disrupt`)
- Autonomous Multi-Agent Token Auction (`/api/optimize`)
- Combined Chaos + Swarm + GenAI Execution (`/api/simulate-full`)
- 2,000,000-Row Blocked Dataset Analytics & SQLite Inspector (`/api/dataset-stats`, `/api/query-blocks`)
- Interactive Blocked GBM Demand & Wait-Time Predictor (`/api/predict-demand`)
- Generative AI Causal Architect Briefing & Prompt Generator (`/api/genai-brief`)
"""

import argparse
import json
import mimetypes
import os
import sqlite3
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict
from urllib.parse import parse_qs, urlparse

from omnitransit.agent_swarm import FleetMarketCommander
from omnitransit.chaos_monkey import ChaosMonkeyAgent
from omnitransit.digital_twin import UrbanTransitDigitalTwin
from omnitransit.genai_architect import GenAITransitArchitect

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
DATA_DIR = os.path.join(BASE_DIR, "data")
SQLITE_PATH = os.path.join(DATA_DIR, "omnitransit_blocks.db")

# Global Singleton Instances for the Digital Twin & Agent Swarm
CITY_TWIN = UrbanTransitDigitalTwin()
CHAOS_AGENT = ChaosMonkeyAgent()
FLEET_COMMANDER = FleetMarketCommander()


class OmniTransitRequestHandler(BaseHTTPRequestHandler):
    """High-speed HTTP & JSON API handler for the OmniTransit Command Center."""

    def log_message(self, fmt: str, *args: Any) -> None:
        # Keep console output clean
        pass

    def _send_json(self, payload: Dict[str, Any], status: int = 200) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json_body(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        raw = self.rfile.read(length).decode("utf-8")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:
        self._send_json({"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/state":
            self._send_json(CITY_TWIN.get_twin_telemetry())
            return

        if path == "/api/dataset-stats":
            self._send_json(CITY_TWIN.dataset_summary)
            return

        if path == "/api/query-blocks":
            hub_filter = query.get("hub", ["ALL"])[0]
            bucket_filter = query.get("time_bucket", ["ALL"])[0]
            weather_filter = query.get("weather", ["ALL"])[0]
            rows = self._query_sqlite_blocks(hub_filter, bucket_filter, weather_filter)
            self._send_json({"blocks": rows, "count": len(rows)})
            return

        if path == "/api/predict-demand":
            hub_code = query.get("hub_code", ["KAL"])[0]
            time_bucket = query.get("time_bucket", ["PM_PEAK"])[0]
            weather_code = query.get("weather_code", ["FLA"])[0]
            headway = int(query.get("headway_mins", ["12"])[0])
            pred = CITY_TWIN.predict_block_demand(hub_code, time_bucket, weather_code, headway)
            self._send_json(pred)
            return

        # Serve static frontend files
        if path == "/" or path == "":
            path = "/index.html"

        safe_rel = os.path.normpath(path.lstrip("/"))
        file_path = os.path.join(FRONTEND_DIR, safe_rel)
        if os.path.isfile(file_path):
            ctype, _ = mimetypes.guess_type(file_path)
            ctype = ctype or "application/octet-stream"
            with open(file_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        else:
            self._send_json({"error": "Not found", "path": path}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        body = self._read_json_body()

        if path == "/api/reset":
            CITY_TWIN.reset_to_baseline()
            self._send_json(
                {
                    "status": "RESET_COMPLETE",
                    "telemetry": CITY_TWIN.get_twin_telemetry(),
                }
            )
            return

        if path == "/api/disrupt":
            event_type = body.get("event_type", "HEAVY_RAIN")
            custom_params = body.get("custom_params")
            CITY_TWIN.reset_to_baseline()
            disruption_info = CHAOS_AGENT.trigger_disruption(CITY_TWIN, event_type, custom_params)
            GenAITransitArchitect.generate_causal_briefing(CITY_TWIN)
            self._send_json(
                {
                    "status": "DISRUPTION_APPLIED",
                    "disruption": disruption_info,
                    "telemetry": CITY_TWIN.get_twin_telemetry(),
                }
            )
            return

        if path == "/api/optimize":
            api_key = body.get("api_key")
            provider = body.get("provider", "gemini")
            market_result = FLEET_COMMANDER.run_market_equilibrium(CITY_TWIN)
            genai_result = GenAITransitArchitect.generate_causal_briefing(
                CITY_TWIN, api_key=api_key, provider=provider
            )
            self._send_json(
                {
                    "status": "SWARM_OPTIMIZED",
                    "market_result": market_result,
                    "genai": genai_result,
                    "telemetry": CITY_TWIN.get_twin_telemetry(),
                }
            )
            return

        if path == "/api/simulate-full":
            event_type = body.get("event_type", "HEAVY_RAIN")
            custom_params = body.get("custom_params")
            api_key = body.get("api_key")
            provider = body.get("provider", "gemini")

            CITY_TWIN.reset_to_baseline()
            disruption_info = CHAOS_AGENT.trigger_disruption(CITY_TWIN, event_type, custom_params)
            market_result = FLEET_COMMANDER.run_market_equilibrium(CITY_TWIN)
            genai_result = GenAITransitArchitect.generate_causal_briefing(
                CITY_TWIN, api_key=api_key, provider=provider
            )
            self._send_json(
                {
                    "status": "FULL_SIMULATION_COMPLETE",
                    "disruption": disruption_info,
                    "market_result": market_result,
                    "genai": genai_result,
                    "telemetry": CITY_TWIN.get_twin_telemetry(),
                }
            )
            return

        if path == "/api/genai-brief":
            api_key = body.get("api_key")
            provider = body.get("provider", "gemini")
            genai_result = GenAITransitArchitect.generate_causal_briefing(
                CITY_TWIN, api_key=api_key, provider=provider
            )
            self._send_json(
                {
                    "status": "BRIEFING_GENERATED",
                    "genai": genai_result,
                    "telemetry": CITY_TWIN.get_twin_telemetry(),
                }
            )
            return

        self._send_json({"error": "Unknown endpoint"}, status=404)

    @staticmethod
    def _query_sqlite_blocks(hub: str, time_bucket: str, weather: str) -> list:
        if not os.path.exists(SQLITE_PATH):
            return []
        conn = sqlite3.connect(SQLITE_PATH)
        cur = conn.cursor()
        clauses = []
        params = []
        if hub and hub != "ALL":
            clauses.append("hub_code = ?")
            params.append(hub)
        if time_bucket and time_bucket != "ALL":
            clauses.append("time_bucket = ?")
            params.append(time_bucket)
        if weather and weather != "ALL":
            clauses.append("weather_code = ?")
            params.append(weather[:3].upper())

        where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql = f"""
            SELECT block_key, hub_code, route_id, time_bucket, weather_code,
                   record_count, avg_demand, avg_wait_mins, avg_load_pct, avg_bounty, distress_rate_pct
            FROM smart_blocks
            {where_sql}
            ORDER BY avg_wait_mins DESC
            LIMIT 50
        """
        cur.execute(sql, params)
        rows = [
            {
                "block_key": r[0],
                "hub_code": r[1],
                "route_id": r[2],
                "time_bucket": r[3],
                "weather_code": r[4],
                "record_count": r[5],
                "avg_demand": r[6],
                "avg_wait_mins": r[7],
                "avg_load_pct": r[8],
                "avg_bounty": r[9],
                "distress_rate_pct": r[10],
            }
            for r in cur.fetchall()
        ]
        conn.close()
        return rows


def run_self_verification() -> None:
    """Runs an end-to-end verification drill of the Digital Twin, 3-Layer Swarm, and GenAI Architect."""
    print("=" * 78)
    print("OMNITRANSIT-AGENT SWARM — END-TO-END VERIFICATION DRILL")
    print("=" * 78)
    CITY_TWIN.reset_to_baseline()
    print(f"[1] Digital Twin Baseline Loaded: {len(CITY_TWIN.stations)} Hubs, {len(CITY_TWIN.routes)} Routes")
    print(f"[2] 2M-Row Dataset Verified: {CITY_TWIN.dataset_summary.get('total_rows', 0):,} rows on disk")

    CHAOS_AGENT.trigger_disruption(CITY_TWIN, "HEAVY_RAIN")
    kal_before = CITY_TWIN.stations["Kalapatti Hub"]["avg_wait_time"]
    print(f"[3] Chaos Monkey Triggered (HEAVY_RAIN): Kalapatti Hub wait surged to {kal_before} mins")

    res = FLEET_COMMANDER.run_market_equilibrium(CITY_TWIN)
    kal_after = CITY_TWIN.stations["Kalapatti Hub"]["avg_wait_time"]
    print(
        f"[4] 3-Layer Token Auction Completed: {res['resolved_hubs']} Hubs resolved | "
        f"Kalapatti Hub wait dropped {kal_before}m -> {kal_after}m"
    )
    print(
        f"[5] ESG Carbon Exchange: {CITY_TWIN.esg_ledger['co2_prevented_kg']} kg CO2e prevented | "
        f"EV Guardrail Blocks: {CITY_TWIN.esg_ledger['ev_guardrail_blocks_triggered']}"
    )

    brief = GenAITransitArchitect.generate_causal_briefing(CITY_TWIN)
    print(f"[6] GenAI Causal Briefing Synthesized ({len(brief['report_markdown'])} chars)")
    print("=" * 78)


def main() -> None:
    parser = argparse.ArgumentParser(description="OmniTransit-Agent Swarm Backend Server")
    parser.add_argument("--port", type=int, default=8050, help="Port to bind HTTP server (default: 8050)")
    parser.add_argument("--verify", action="store_true", help="Run self-verification drill and exit")
    args = parser.parse_args()

    if args.verify:
        run_self_verification()
        return

    server = ThreadingHTTPServer(("127.0.0.1", args.port), OmniTransitRequestHandler)
    print(f"\n🚀 OmniTransit-Agent Swarm Command Center running at: http://localhost:{args.port}")
    print(f"🛡️  Guardrail Active: {CITY_TWIN.sandbox_compliance_banner}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down OmniTransit Command Center.")
        server.server_close()


if __name__ == "__main__":
    main()
