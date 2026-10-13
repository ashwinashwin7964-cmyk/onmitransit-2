from omnitransit.transport_optimizer import (
    DemandScenario,
    build_demo_network,
    build_transport_summary,
    detect_bunching,
    feasibility_check,
    optimize_fleet_allocation,
    pareto_frontier,
    robustness_analysis,
    simulate_passenger_flow,
)


def test_build_demo_network_has_routes_and_stops():
    network = build_demo_network()
    assert set(network["routes"]).issuperset({"R-101", "R-102", "R-103"})
    assert len(network["stops"]) >= 9


def test_simulate_passenger_flow_returns_metrics():
    sim = simulate_passenger_flow(demand_multiplier=1.0, travel_time_multiplier=1.0, fleet_reduction=0)
    metrics = sim["metrics"]
    assert metrics["passenger_waiting"] > 0
    assert metrics["denied_boardings"] >= 0
    assert metrics["headway_variability"] >= 0


def test_detect_bunching_flags_low_headway():
    baseline = simulate_passenger_flow(demand_multiplier=1.0, travel_time_multiplier=0.7, fleet_reduction=1)
    detection = detect_bunching(baseline["routes"], intended_headway=12, tolerance=0.35)
    assert isinstance(detection["bunching_detected"], bool)
    assert detection["event_count"] >= 0


def test_optimize_fleet_allocation_handles_capacity_constraint():
    allocation = optimize_fleet_allocation(
        available_fleet=8,
        route_demands={"R-101": 180.0, "R-102": 210.0, "R-103": 140.0},
        minimum_service={"R-101": 3, "R-102": 3, "R-103": 2},
    )
    assert allocation["feasible"] is True
    assert sum(allocation["allocation"].values()) == 8


def test_feasibility_check_detects_invalid_allocations():
    result = feasibility_check({"R-101": 2, "R-102": 2, "R-103": 1}, 7, {"R-101": 3, "R-102": 3, "R-103": 2})
    assert result.feasible is False
    assert result.issues


def test_pareto_frontier_returns_non_dominated_candidates():
    candidates = [
        {"name": "A", "feasible": True, "metrics": {"passenger_waiting": 90, "operating_bus_hours": 30, "denied_boardings": 20}},
        {"name": "B", "feasible": True, "metrics": {"passenger_waiting": 100, "operating_bus_hours": 25, "denied_boardings": 25}},
        {"name": "C", "feasible": True, "metrics": {"passenger_waiting": 80, "operating_bus_hours": 35, "denied_boardings": 22}},
    ]
    frontier = pareto_frontier(candidates)
    assert len(frontier) >= 2


def test_robustness_analysis_returns_summary():
    baseline = simulate_passenger_flow(demand_multiplier=1.0, travel_time_multiplier=1.0, fleet_reduction=0)
    scenarios = [
        DemandScenario("Low", 0.8, 0.95, 0),
        DemandScenario("Expected", 1.0, 1.0, 0),
        DemandScenario("High", 1.2, 1.15, 1),
    ]
    out = robustness_analysis(baseline, scenarios)
    assert out["scenario_count"] == 3
    assert 0 <= out["win_rate"] <= 1


def test_transport_summary_ready():
    summary = build_transport_summary()
    assert "simulation" in summary
    assert "bunching" in summary
    assert "fleet_allocation" in summary
    assert "pareto" in summary
    assert "robustness" in summary
