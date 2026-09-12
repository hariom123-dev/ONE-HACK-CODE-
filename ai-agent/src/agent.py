import logging
import hashlib
import time
from typing import Optional, Callable, Awaitable
from src.x402_client import X402Client
from src.wallet import ContractRevertError

logger = logging.getLogger(__name__)

class AutonomousAgent:
    """
    Complete Autonomous Agent with Async Event Bus, Pre-Flight Checks, and Cognitive LLM Synthesis.
    """
    def __init__(self, agent_id: str, wallet, receipt_store, planner, service_registry, refund_daemon, llm_engine, event_listener: Optional[Callable[[dict], Awaitable[None]]] = None):
        self.agent_id = agent_id
        self.wallet = wallet
        self.receipt_store = receipt_store
        self.planner = planner
        self.service_registry = service_registry
        self.refund_daemon = refund_daemon
        self.llm_engine = llm_engine
        self.event_listener = event_listener
        self.x402_client = X402Client(wallet=self.wallet)

    async def emit_event(self, event_type: str, data: dict):
        """Helper that logs and dispatches structured events to the telemetry bus."""
        event = {"type": event_type, "data": data, "timestamp": time.time()}
        logger.info(f"[EVENT] {event_type}: {data}")
        if self.event_listener:
            try:
                await self.event_listener(event)
            except Exception as e:
                logger.error(f"Event listener failed: {e}")

    async def conduct_research(self, goal: str):
        await self.emit_event("RESEARCH_STARTED", {"goal": goal})
        
        # Cognitive Plan Generation
        try:
            plan = await self.planner.create_plan(goal)
        except Exception as e:
            await self.emit_event("RESEARCH_HALTED", {"reason": f"Plan generation failed: {e}"})
            return {"status": "failed", "halt_reason": str(e)}

        estimated_cost = self.planner.estimate_total_cost(plan)
        await self.emit_event("PLAN_GENERATED", {"steps": len(plan), "estimated_cost": estimated_cost})
        
        # Pre-Flight Budget Optimization
        remaining_budget = await self.wallet.get_remaining_budget()
        await self.emit_event("PRE_FLIGHT_CHECK", {"remaining_budget": remaining_budget, "estimated_cost": estimated_cost})
        
        if remaining_budget < estimated_cost:
            # Prune optional steps
            required_plan = [step for step in plan if step.get("required", False)]
            req_cost = self.planner.estimate_total_cost(required_plan)
            if remaining_budget < req_cost:
                await self.emit_event("BUDGET_EXHAUSTION_PREVENTED", {"msg": "Insufficient budget for core tasks. Halting."})
                await self.emit_event("RESEARCH_HALTED", {"reason": "Insufficient budget at pre-flight."})
                return {"status": "halted_at_preflight"}
            
            logger.info("Pruning optional steps due to budget constraints.")
            plan = required_plan
            await self.emit_event("BUDGET_EXHAUSTION_PREVENTED", {"msg": "Pruned optional steps to fit budget."})

        research_context = {
            "goal": goal,
            "steps_completed": 0,
            "results": [],
            "final_output": None,
            "status": "in_progress"
        }
        
        current_input = goal

        for i, step in enumerate(plan):
            capability = step["capability"]
            
            # Find provider
            try:
                provider_info = self.service_registry.find_provider(capability)
                service_url = provider_info["url"]
            except Exception as e:
                await self.emit_event("RESEARCH_HALTED", {"reason": f"No provider for {capability}: {e}"})
                return research_context
            
            await self.emit_event("STEP_STARTED", {"step_index": i + 1, "capability": capability, "provider": provider_info["name"]})
            
            payload = {
                "capability": capability,
                "input_data": current_input,
                "parameters": step.get("parameters", {})
            }
            
            # Reset wallet tracking
            self.wallet.last_payment = None

            try:
                result = await self.x402_client.make_request(
                    service_url=service_url,
                    payload=payload,
                    agent_id=self.agent_id
                )
                
                # Check for locked funds via wallet state mapping
                lp = self.wallet.last_payment
                if lp:
                    await self.emit_event("FUNDS_LOCKED", {
                        "tx_hash": lp["tx_hash"], 
                        "request_hash": lp["request_hash"], 
                        "amount": lp["amount"]
                    })
                
                delivery_hash = result.get("deliveryHash")
                provider_sig = result.get("providerSignature")
                
                step_output = result.get("content") or result.get("translated") or str(result)
                
                if delivery_hash and lp:
                    # Validate delivery content
                    computed_hash = hashlib.sha256(str(step_output).encode()).hexdigest()
                    if computed_hash != delivery_hash:
                        raise ValueError("Delivery hash mismatch (Payload tampered)")
                    
                    # Store receipt with full forensic details
                    await self.receipt_store.record_receipt(
                        request_hash=lp["request_hash"],
                        tx_hash=lp["tx_hash"],
                        provider_address=lp["provider"],
                        amount_units=lp["amount"],
                        delivery_hash=delivery_hash,
                        provider_signature=provider_sig or "",
                        content_preview=str(step_output)
                    )
                    await self.emit_event("DELIVERY_VERIFIED", {"delivery_hash": delivery_hash, "status": "Valid"})

                research_context["results"].append({
                    "step": i + 1,
                    "capability": capability,
                    "output": step_output,
                    "provider": provider_info["name"]
                })
                research_context["steps_completed"] += 1
                current_input = step_output
                
            except ContractRevertError as e:
                await self.emit_event("PROTOCOL_REVERT_BLOCKED", {"error": str(e), "step": i+1})
                research_context["status"] = "halted_by_contract"
                research_context["halt_reason"] = str(e)
                break
                
            except Exception as e:
                logger.error(f"Network or protocol error on step {i+1}: {e}")
                
                lp = self.wallet.last_payment
                if lp:
                    # Payment went through but network/provider failed. Recover capital!
                    unlock_ts = lp["timestamp"] + 3600
                    await self.refund_daemon.register_escrow(
                        request_hash=lp["request_hash"],
                        amount=lp["amount"],
                        unlock_timestamp=unlock_ts,
                        owner=self.wallet.owner_address
                    )
                    await self.emit_event("STEP_FAILED_TIMELOCK_REGISTERED", {
                        "request_hash": lp["request_hash"],
                        "unlock_timestamp": unlock_ts,
                        "error": str(e)
                    })
                    
                research_context["status"] = "failed"
                research_context["halt_reason"] = str(e)
                break
                
        if research_context["status"] == "in_progress":
            # Cognitive Synthesis
            await self.emit_event("SYNTHESIZING_FINAL_OUTPUT", {"results_count": len(research_context["results"])})
            try:
                final_output = await self.llm_engine.synthesize_research(goal, research_context["results"])
                research_context["final_output"] = final_output
                research_context["status"] = "completed"
                await self.emit_event("RESEARCH_COMPLETED", {"steps": research_context["steps_completed"]})
            except Exception as e:
                logger.error(f"Final synthesis failed: {e}")
                research_context["status"] = "failed"
                research_context["halt_reason"] = f"Synthesis error: {e}"
                await self.emit_event("RESEARCH_HALTED", {"reason": research_context["halt_reason"]})
        else:
            await self.emit_event("RESEARCH_HALTED", {"reason": research_context.get("halt_reason")})
            
        return research_context
