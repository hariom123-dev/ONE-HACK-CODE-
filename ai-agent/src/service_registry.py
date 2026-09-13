class ServiceRegistry:
    """
    Discovers and selects the best service provider for a given capability.
    """
    def __init__(self):
        self.providers = [
            {"name": "SearchNode", "url": "http://provider-search/search", "capability": "search", "price": 0.001},
            {"name": "AnalyzeNode", "url": "http://provider-analyze/summarize", "capability": "summarize", "price": 0.005},
            {"name": "TranslateNode", "url": "http://provider-translate/translate", "capability": "translate", "price": 0.002},
            {"name": "ComputeNode", "url": "http://provider-compute/compute", "capability": "compute", "price": 0.01},
        ]

    def find_provider(self, capability: str) -> dict:
        """Finds the cheapest provider that offers the requested capability."""
        available = [p for p in self.providers if p["capability"] == capability]
        if not available:
            raise ValueError(f"No provider found for capability: {capability}")
            
        return min(available, key=lambda x: x["price"])
