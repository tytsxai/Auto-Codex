#!/usr/bin/env python3
"""
CLI entrypoint for task context discovery.

We keep the `context` name for the package (`auto-codex/context/`), so this file
avoids the ambiguous `context.py` module name that would shadow the package.
"""

import sys
from pathlib import Path

# Ensure auto-codex/ is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from context.main import main

if __name__ == "__main__":
    main()

