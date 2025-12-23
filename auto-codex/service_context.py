#!/usr/bin/env python3
"""
Backward compatibility shim for service context generation.

This file exists so documentation can run `python3 auto-codex/service_context.py ...`.
"""

import sys
from pathlib import Path

# Ensure auto-codex/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from services.context import main

if __name__ == "__main__":
    main()
