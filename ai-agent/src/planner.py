import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class ResearchPlanner:
    """
    Cost-Aware Dynamic Planner utilizing an LLM Engine to generate structured steps.
    """
    def __init__(self, llm_engine, service_registry):
        self.llm_engine = llm_engine
        self.service_registry = service_registry

    async def create_plan(self, goal: str) -> List[Dict]:
        """
        Generates a dynamic research plan using the LLM and validates capabilities/costs.
        """
        # 1. Gather context from ServiceRegistry
        available_caps = []
        for provider in self.service_registry.providers:
            available_caps.append({
                "capability": provider["capability"],
                "price": provider["price"]
            })
            
        # 2. Query LLM for structured dynamic routing
        raw_plan = await self.llm_engine.generate_structured_plan(goal, available_caps)
        
        validated_plan = []
        valid_cap_names = {c["capability"] for c in available_caps}
        
        # 3. Validate and append costs
        for step in raw_plan:
            cap = step.get("capability")
            # Security / Quality check: Ensure LLM hasn't hallucinated non-existent capabilities
            if cap not in valid_cap_names:
                logger.warning(f"LLM hallucinated capability '{cap}'. Dropping step.")
                continue
                
            # Find the best provider price to estimate cost
            try:
                provider_info = self.service_registry.find_provider(cap)
                step["estimated_cost"] = provider_info["price"]
                validated_plan.append(step)
            except Exception as e:
                logger.error(f"Failed to find provider for capability {cap}: {e}")
                
        if not validated_plan:
            raise ValueError("LLM generated an empty or completely invalid plan.")
            
        return validated_plan

    def estimate_total_cost(self, plan: list[dict]) -> int:
        return sum(step.get("estimated_cost", 0) for step in plan)
