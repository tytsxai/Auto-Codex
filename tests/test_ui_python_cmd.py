def test_python_cmd_returns_basename() -> None:
    import importlib
    import sys
    from unittest.mock import MagicMock

    existing = sys.modules.get("ui")
    if isinstance(existing, MagicMock):
        del sys.modules["ui"]

    ui = importlib.import_module("ui")
    cmd = ui.python_cmd()
    assert "python" in cmd
    assert "/" not in cmd
    assert "\\" not in cmd
