#!/usr/bin/env python3
"""
Auth module tests for Codex authentication sources.
"""

import pytest

import core.auth as auth

from core.auth import (
    get_auth_token,
    get_auth_token_source,
    get_deprecated_auth_token,
    is_valid_codex_config_dir,
    is_valid_codex_oauth_token,
    is_valid_openai_api_key,
    require_auth_token,
)


def test_get_auth_token_uses_openai_key(monkeypatch):
    monkeypatch.delenv("CODEX_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test-1234567890abcdef1234")

    assert get_auth_token() == "sk-test-1234567890abcdef1234"
    assert get_auth_token_source() == "OPENAI_API_KEY"


def test_get_auth_token_uses_oauth_token(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.setenv("CODEX_CODE_OAUTH_TOKEN", "codex-token-1234567890abcdef")
    # Disable default config dir to prevent hydration from ~/.codex/auth.json
    monkeypatch.setenv("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "1")
    monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", "/nonexistent/path")

    assert get_auth_token() == "codex-token-1234567890abcdef"
    assert get_auth_token_source() == "CODEX_CODE_OAUTH_TOKEN"


def test_get_auth_token_uses_config_dir(monkeypatch, tmp_path):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CODEX_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.setenv("CODEX_CONFIG_DIR", str(tmp_path))

    assert get_auth_token() == str(tmp_path)
    assert get_auth_token_source() == "CODEX_CONFIG_DIR"


def test_get_auth_token_uses_default_codex_config_dir(monkeypatch, tmp_path):
    codex_dir = tmp_path / ".codex"
    codex_dir.mkdir()
    (codex_dir / "config.toml").write_text("")

    monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", str(codex_dir))
    monkeypatch.delenv("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("CODEX_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)

    assert get_auth_token() == str(codex_dir)
    assert get_auth_token_source() == "DEFAULT_CODEX_CONFIG_DIR"


def test_require_auth_token_invalid_format(monkeypatch):
    monkeypatch.setenv("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "1")
    monkeypatch.setenv("OPENAI_API_KEY", "not-a-key")
    monkeypatch.delenv("CODEX_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)

    with pytest.raises(ValueError) as excinfo:
        require_auth_token()

    assert "Invalid OPENAI_API_KEY format" in str(excinfo.value)


def test_require_auth_token_deprecated_oauth(monkeypatch):
    monkeypatch.setenv("AUTO_CODEX_DISABLE_DEFAULT_CODEX_CONFIG_DIR", "1")
    monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", "/nonexistent/path")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.delenv("CODEX_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "legacy-token")

    assert get_deprecated_auth_token() == "legacy-token"
    assert get_auth_token() is None

    with pytest.raises(ValueError) as excinfo:
        require_auth_token()

    message = str(excinfo.value)
    assert "CLAUDE_CODE_OAUTH_TOKEN" in message
    assert "OPENAI_API_KEY" in message
    assert "CODEX_CODE_OAUTH_TOKEN" in message
    assert "CODEX_CONFIG_DIR" in message


def test_is_valid_openai_api_key():
    assert is_valid_openai_api_key("sk-test-1234567890abcdef1234") is True
    assert is_valid_openai_api_key("sk-proj-1234567890abcdef1234") is True
    assert is_valid_openai_api_key("thirdparty-12345678901234567890") is True
    assert is_valid_openai_api_key("sk_123") is False
    assert is_valid_openai_api_key("not-a-key") is False


def test_is_valid_codex_oauth_token():
    assert is_valid_codex_oauth_token("codex-token-1234567890abcdef") is True
    assert is_valid_codex_oauth_token("short-token") is False
    assert is_valid_codex_oauth_token("token with space") is False


def test_is_valid_codex_config_dir(tmp_path):
    assert is_valid_codex_config_dir(str(tmp_path)) is True
    assert is_valid_codex_config_dir(str(tmp_path / "missing")) is False


class TestHydrateEnvFromCodexAuthJson:
    """Tests for _hydrate_env_from_codex_auth_json and _read_codex_auth_json."""

    def test_hydrate_env_from_auth_json(self, monkeypatch, tmp_path):
        """Test that auth.json credentials are loaded into env vars."""
        import json

        codex_dir = tmp_path / ".codex"
        codex_dir.mkdir()
        auth_data = {
            "OPENAI_API_KEY": "test-key-12345678901234567890",
            "api_base_url": "https://example.com/api",
        }
        (codex_dir / "auth.json").write_text(json.dumps(auth_data))

        monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", str(codex_dir))
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
        monkeypatch.delenv("OPENAI_API_BASE", raising=False)
        monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)

        auth._hydrate_env_from_codex_auth_json()

        import os
        assert os.environ.get("OPENAI_API_KEY") == "test-key-12345678901234567890"
        assert os.environ.get("OPENAI_BASE_URL") == "https://example.com/api"
        assert os.environ.get("OPENAI_API_BASE") == "https://example.com/api"

    def test_hydrate_env_respects_existing_env(self, monkeypatch, tmp_path):
        """Test that existing env vars are not overwritten."""
        import json

        codex_dir = tmp_path / ".codex"
        codex_dir.mkdir()
        auth_data = {
            "OPENAI_API_KEY": "auth-json-key-1234567890",
            "api_base_url": "https://auth-json.example.com",
        }
        (codex_dir / "auth.json").write_text(json.dumps(auth_data))

        monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", str(codex_dir))
        monkeypatch.setenv("OPENAI_API_KEY", "existing-key-1234567890")
        monkeypatch.setenv("OPENAI_BASE_URL", "https://existing.example.com")
        monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)

        auth._hydrate_env_from_codex_auth_json()

        import os
        # Should not be overwritten
        assert os.environ.get("OPENAI_API_KEY") == "existing-key-1234567890"
        assert os.environ.get("OPENAI_BASE_URL") == "https://existing.example.com"

    def test_hydrate_env_uses_codex_config_dir(self, monkeypatch, tmp_path):
        """Test that CODEX_CONFIG_DIR takes precedence over default."""
        import json

        custom_dir = tmp_path / "custom-codex"
        custom_dir.mkdir()
        auth_data = {"OPENAI_API_KEY": "custom-key-12345678901234567890"}
        (custom_dir / "auth.json").write_text(json.dumps(auth_data))

        monkeypatch.setenv("CODEX_CONFIG_DIR", str(custom_dir))
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)

        auth._hydrate_env_from_codex_auth_json()

        import os
        assert os.environ.get("OPENAI_API_KEY") == "custom-key-12345678901234567890"

    def test_hydrate_env_handles_alternative_key_names(self, monkeypatch, tmp_path):
        """Test that alternative key names in auth.json are supported."""
        import json

        codex_dir = tmp_path / ".codex"
        codex_dir.mkdir()
        # Use alternative key name
        auth_data = {"api_key": "alt-key-12345678901234567890"}
        (codex_dir / "auth.json").write_text(json.dumps(auth_data))

        monkeypatch.setattr(auth, "_DEFAULT_CODEX_CONFIG_DIR", str(codex_dir))
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.delenv("CODEX_CONFIG_DIR", raising=False)

        auth._hydrate_env_from_codex_auth_json()

        import os
        assert os.environ.get("OPENAI_API_KEY") == "alt-key-12345678901234567890"

    def test_read_codex_auth_json_missing_file(self, tmp_path):
        """Test that missing auth.json returns None."""
        result = auth._read_codex_auth_json(str(tmp_path))
        assert result is None

    def test_read_codex_auth_json_invalid_json(self, tmp_path):
        """Test that invalid JSON returns None."""
        (tmp_path / "auth.json").write_text("not valid json")
        result = auth._read_codex_auth_json(str(tmp_path))
        assert result is None

    def test_read_codex_auth_json_non_dict(self, tmp_path):
        """Test that non-dict JSON returns None."""
        (tmp_path / "auth.json").write_text('["array", "not", "dict"]')
        result = auth._read_codex_auth_json(str(tmp_path))
        assert result is None
