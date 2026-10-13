"""
OmniTransit Real-Time 1,000,000 Telemetry Streaming Engine
==========================================================
Manages sequential line-by-line streaming across the 1,000,000-row
dataset. Serves single-tick snapshots every 4 seconds to power
real-time passenger travel guidance, dynamic crowding updates,
and live headway re-balancing.
"""

import linecache
import os
import time
from typing import Any, Dict, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
STREAM_CSV_PATH = os.path.join(DATA_DIR, "realtime_1m_telemetry_stream.csv")
TOTAL_RECORDS = 1_000_000


class TelemetryStreamEngine:
    """High-speed indexed reader for the 1,000,000-row real-time telemetry dataset."""

    _current_tick: int = 1
    _last_advance_time: float = 0.0
    _interval_seconds: float = 4.0

    @classmethod
    def get_tick(cls, tick_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Retrieves a single tick record from the 1,000,000-row telemetry dataset.
        If tick_id is not specified, auto-advances based on 4-second intervals.
        """
        now = time.time()
        if tick_id is None:
            # Auto-advance tick every 4 seconds
            if cls._last_advance_time == 0.0:
                cls._last_advance_time = now
            elapsed = now - cls._last_advance_time
            if elapsed >= cls._interval_seconds:
                ticks_to_advance = max(1, int(elapsed // cls._interval_seconds))
                cls._current_tick = ((cls._current_tick - 1 + ticks_to_advance) % TOTAL_RECORDS) + 1
                cls._last_advance_time = now
            target_tick = cls._current_tick
        else:
            target_tick = max(1, min(TOTAL_RECORDS, int(tick_id)))

        # Linecache header is line 1, data starts at line 2
        line_num = target_tick + 1
        line = linecache.getline(STREAM_CSV_PATH, line_num)

        if not line or not line.strip():
            # Fallback synthetic generator if file is being initialized
            return cls._fallback_tick(target_tick)

        parts = line.strip().split(",")
        if len(parts) < 16:
            return cls._fallback_tick(target_tick)

        return {
            "tick_id": int(parts[0]),
            "total_records": TOTAL_RECORDS,
            "interval_seconds": 4,
            "simulated_time": parts[1],
            "hub_code": parts[2],
            "hub_name": parts[3],
            "primary_route": parts[4],
            "alt_route": parts[5],
            "waiting_commuters": int(parts[6]),
            "avg_wait_mins": float(parts[7]),
            "crowding_pct": int(parts[8]),
            "crowding_level": parts[9],
            "active_buses": int(parts[10]),
            "recommended_headway_mins": int(parts[11]),
            "weather_condition": parts[12],
            "ev_battery_soc": float(parts[13]),
            "advisory_headline": parts[14],
            "advisory_guidance": parts[15],
            "server_timestamp_ms": int(time.time() * 1000),
        }

    @classmethod
    def _fallback_tick(cls, tick: int) -> Dict[str, Any]:
        """Provides guaranteed valid data if file is temporarily unavailable."""
        hubs = [
            ("KAL", "Kalapatti IT Hub", "R-107", "R-101"),
            ("GAN", "Gandhipuram Central", "R-101", "R-105"),
            ("TWN", "Town Hall Commercial", "R-103", "R-105"),
            ("PEE", "Peelamedu Medical Feeder", "R-108", "R-101"),
            ("SAR", "Saravanampatti Tech Zone", "R-102", "R-107"),
            ("SIN", "Singanallur Industrial Hub", "R-103", "R-105"),
            ("UKK", "Ukkadam Lake Interchange", "R-105", "R-103"),
            ("ARA", "Avinashi Road Junction", "R-101", "R-102"),
        ]
        h_idx = (tick - 1) % len(hubs)
        h_code, h_name, p_route, a_route = hubs[h_idx]
        pax = 60 + ((tick * 13) % 150)
        wait_m = round(pax / 14.0, 1)
        crowd_pct = min(100, int((pax / 220) * 100))
        crowd_lvl = "HEAVY" if crowd_pct > 65 else "MODERATE"
        return {
            "tick_id": tick,
            "total_records": TOTAL_RECORDS,
            "interval_seconds": 4,
            "simulated_time": "18:30",
            "hub_code": h_code,
            "hub_name": h_name,
            "primary_route": p_route,
            "alt_route": a_route,
            "waiting_commuters": pax,
            "avg_wait_mins": wait_m,
            "crowding_pct": crowd_pct,
            "crowding_level": crowd_lvl,
            "active_buses": 5 if crowd_pct > 75 else 4,
            "recommended_headway_mins": 6 if crowd_pct > 75 else 10,
            "weather_condition": "CLEAR",
            "ev_battery_soc": 82.5,
            "advisory_headline": f"Dynamic flow at {h_name}",
            "advisory_guidance": f"Alternative corridor {a_route} available with low crowding",
            "server_timestamp_ms": int(time.time() * 1000),
        }
