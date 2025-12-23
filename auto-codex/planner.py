#!/usr/bin/env python3
"""
Backward compatibility shim for implementation plan generation.

This file exists so internal callers and documentation can run:
`python3 auto-codex/planner.py --spec-dir ...`
"""

import sys
from pathlib import Path

# Ensure auto-codex/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from planner_lib.main import main

if __name__ == "__main__":
    main()
