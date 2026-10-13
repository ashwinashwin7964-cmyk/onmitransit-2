"""
OmniTransit-Agent Swarm Core Package
====================================
Autonomous Multi-Agent Simulation, Game-Theoretic Token Marketplace,
Urban Digital Twin, Model Predictive Control (MPC), Robust Uncertainty Optimization,
Constraint Feasibility Auditing, and Generative AI Causal Engine.
"""

from omnitransit.digital_twin import UrbanTransitDigitalTwin
from omnitransit.agent_swarm import FleetMarketCommander
from omnitransit.chaos_monkey import ChaosMonkeyAgent
from omnitransit.genai_architect import GenAITransitArchitect
from omnitransit.mpc_optimizer import (
    ModelPredictiveController,
    RobustOptimizationEngine,
    ConstraintFeasibilityAuditor,
)

__version__ = "3.0.0"

__all__ = [
    "UrbanTransitDigitalTwin",
    "FleetMarketCommander",
    "ChaosMonkeyAgent",
    "GenAITransitArchitect",
    "ModelPredictiveController",
    "RobustOptimizationEngine",
    "ConstraintFeasibilityAuditor",
]
