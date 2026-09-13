import json
import logging
from litellm import acompletion
from src.models import ResearchPlan, EvaluationResult

logger = logging.getLogger(__name__)

class LLMEngine:
    """
    Model-agnostic reasoning engine for dynamic planning and data synthesis.
    Strictly isolated from Web3 logic (does not bypass contract enforcement).
    """
    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model

    async def generate_structured_plan(self, goal: str, available_capabilities: list[dict]) -> ResearchPlan:
        """
        Uses the LLM to analyze the goal and map it to a sequence of available capabilities.
        Enforces structured JSON outputs to ensure machine-readable formatting.
        """
        caps_str = json.dumps(available_capabilities, indent=2)
        system_prompt = (
            "You are an expert AI research planner. Break down the user's goal into a sequence "
            "of executable tasks. You MUST only use the capabilities provided in the available_capabilities list.\n"
            f"Available capabilities:\n{caps_str}\n"
            "Return a structured plan with individual steps and a total estimated cost."
        )
        
        try:
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Goal: {goal}"}
                ],
                response_format=ResearchPlan
            )
            raw_json = response.choices[0].message.content
            return ResearchPlan.model_validate_json(raw_json)
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

    async def evaluate_output(self, goal: str, draft: str) -> EvaluationResult:
        system_prompt = (
            "You are a harsh but fair critic. Evaluate the provided draft against the original goal. "
            "Provide a score from 1-10, a detailed critique, and set requires_revision to true if the score is below 8."
        )
        try:
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Goal: {goal}\n\nDraft:\n{draft}"}
                ],
                response_format=EvaluationResult
            )
            raw_json = response.choices[0].message.content
            return EvaluationResult.model_validate_json(raw_json)
        except Exception as e:
            logger.error(f"LLM evaluation failed: {e}")
            raise e

    async def revise_output(self, goal: str, draft: str, critique: str) -> str:
        system_prompt = (
            "You are an expert editor. Rewrite the draft to directly address the critique provided, "
            "ensuring it perfectly answers the original goal and resolves all raised issues."
        )
        try:
            response = await acompletion(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Goal: {goal}\n\nDraft:\n{draft}\n\nCritique:\n{critique}"}
                ]
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM revision failed: {e}")
            raise e
