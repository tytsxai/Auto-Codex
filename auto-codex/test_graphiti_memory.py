#!/usr/bin/env python3
"""
Backward compatibility shim for Graphiti integration smoke tests.

This file exists so documentation can run `python3 auto-codex/test_graphiti_memory.py`.
"""

import asyncio
import sys
from pathlib import Path

# Ensure auto-codex/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from integrations.graphiti.test_graphiti_memory import main

if __name__ == "__main__":
    asyncio.run(main())
