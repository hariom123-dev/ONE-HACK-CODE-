from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ResearchStep(BaseModel):
    capability: str
    description: str
    estimated_cost: float
    parameters: Dict[str, Any]
    required: bool = False

class ResearchPlan(BaseModel):
    steps: List[ResearchStep]
    total_estimated_cost: float

class EvaluationResult(BaseModel):
    score: int
    critique: str
    requires_revision: bool

class AgentState(BaseModel):
    original_goal: str
    current_step_index: int
    purchased_data: List[Dict[str, Any]]
    final_output: Optional[str]
    status: str
