# Requires: pip install litellm pydantic
import json
import logging
from litellm import acompletion

logger = logging.getLogger(__name__)

class LLMEngine:
    """
    Model-agnostic reasoning engine for dynamic planning and data synthesis.
    Strictly isolated from Web3 logic (does not bypass contract enforcement).
    """
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model

    async def generate_structured_plan(self, goal: str, available_capabilities: list[dict]) -> list[dict]:
        """
        Uses the LLM to analyze the goal and map it to a sequence of available capabilities.
        Enforces structured JSON outputs to ensure machine-readable formatting.
        """
        caps_str = json.dumps(available_capabilities, indent=2)
        system_prompt = (
            "You are an expert AI research planner. Break down the user's goal into a sequence "
            "of executable tasks. You MUST only use the capabilities provided in the available_capabilities list.\n"
            f"Available capabilities:\n{caps_str}\n"
            "Return a JSON array of task objects. Each task object must have:\n"
            "- 'capability': The exact capability string from the available list.\n"
            "- 'description': A short human-readable description of what this step does.\n"
            "- 'required': A boolean indicating if this step is strictly necessary (true) or optional enrichment (false).\n"
            "- 'parameters': A dictionary of parameters required for this capability."
        )
        
        # Enforce exact JSON schema using standard LLM structured outputs
        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "plan_schema",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "plan": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "capability": {"type": "string"},
                                    "description": {"type": "string"},
                                    "required": {"type": "boolean"},
                                    "parameters": {"type": "object", "additionalProperties": True}
                                },
                                "required": ["capability", "description", "required", "parameters"],
                                "additionalProperties": False
                            }
                        }
                    },
                    "required": ["plan"],
                    "additionalProperties": False
                }
            }
        }
        
        try:
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Goal: {goal}"}
                ],
                response_format=response_format
            )
            raw_json = response.choices[0].message.content
            parsed = json.loads(raw_json)
            return parsed.get("plan", [])
        except Exception as e:
            logger.error(f"LLM planning failed: {e}")
            raise e

    async def synthesize_research(self, goal: str, raw_results: list[dict]) -> str:
        """
        Weaves the raw, disjointed data purchased from Web3 providers into a cohesive executive summary.
        """
        results_str = json.dumps(raw_results, indent=2)
        system_prompt = (
            "You are an elite Research Synthesizer. You will be given an original research goal and a set of "
            "raw results gathered from various external data providers.\n"
            "Your job is to synthesize these results into a highly polished, cohesive executive summary "
            "that directly answers the original goal. Do not mention the individual steps, hashes, or providers unless specifically relevant."
        )
        
        try:
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Original Goal: {goal}\n\nRaw Results:\n{results_str}"}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM synthesis failed: {e}")
            raise e
