"""LLM provider registry for easy swapping."""

import logging
from typing import Dict, Type

from app.clients.llm.base import LLMProvider
from app.clients.llm.openai_provider import OpenAIProvider
from app.settings import settings


logger = logging.getLogger(__name__)


# Registry of available providers
PROVIDERS: Dict[str, Type[LLMProvider]] = {
    "openai": OpenAIProvider,
    # Add more providers here as needed:
    # "anthropic": AnthropicProvider,
    # "google": GoogleProvider,
}


def get_llm_provider() -> LLMProvider:
    """
    Get the configured LLM provider instance.
    
    Returns:
        Initialized LLM provider
        
    Raises:
        ValueError: If provider is not found or not configured
    """
    provider_name = settings.llm_provider.lower()
    
    if provider_name not in PROVIDERS:
        available = ", ".join(PROVIDERS.keys())
        raise ValueError(
            f"Unknown LLM provider '{provider_name}'. "
            f"Available providers: {available}"
        )
    
    provider_class = PROVIDERS[provider_name]
    
    try:
        provider = provider_class()
        logger.info(f"Initialized LLM provider: {provider_name}")
        return provider
    except Exception as e:
        logger.error(f"Failed to initialize provider '{provider_name}': {e}")
        raise ValueError(f"Failed to initialize LLM provider: {e}")
