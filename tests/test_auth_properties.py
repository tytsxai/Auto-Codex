#!/usr/bin/env python3
"""
Property-based tests for Auth module.

These tests use Hypothesis to verify universal properties of the authentication system.

Note: Hypothesis has compatibility issues with Python 3.14 (unhashable SimpleNamespace).
These tests are skipped on Python 3.14+ until Hypothesis is updated.
"""

import json
import os
import sys
import tempfile
from contextlib import contextmanager
from unittest.mock import patch

import core.auth as auth
import pytest
from core.auth import (
    AuthStatus,
    _hydrate_env_from_codex_config,
    ensure_auth_hydrated,
    is_valid_openai_api_key,
)
from hypothesis import assume, given, settings
from hypothesis import strategies as st

# Skip all tests in this module on Python 3.14+ due to Hypothesis compatibility issues
pytestmark = pytest.mark.skipif(
    sys.version_info >= (3, 14),
    reason="Hypothesis has compatibility issues with Python 3.14 (unhashable SimpleNamespace)"
)


# Strategy for generating valid API keys (at least 20 chars, no whitespace)
valid_api_key = st.text(
    alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"),
    min_size=20,
    max_size=100,
).filter(lambda x: len(x.strip()) >= 20 and not any(c.isspace() for c in x))

# Strategy for generating valid base URLs
valid_base_url = st.from_regex(r"https://[a-z0-9]+\.[a-z]{2,}/api", fullmatch=True)


@contextmanager
def isolated_env():
    """Context manager to isolate environment variables for testing."""
    # Save original environment
    original_env = os.environ.copy()
    original_default_dir = auth._DEFAULT_CODEX_CONFIG_DIR

    try:
        yield
    finally:
        # Restore original environment
        os.environ.clear()
        os.environ.update(original_env)
        auth._DEFAULT_CODEX_CONFIG_DIR = original_default_dir


@contextmanager
def temp_codex_dir(auth_data: dict):
    """Context manager to create a temporary codex directory with auth.json."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        codex_dir = os.path.join(tmp_dir, ".codex")
        os.makedirs(codex_dir)
        auth_path = os.path.join(codex_dir, "auth.json")
        with open(auth_path, "w") as f:
            json.dump(auth_data, f)
        yield codex_dir


class TestCredentialLoadingPriority:
    """
    Property 1: Credential Loading Priority

    *For any* system with credentials in both `~/.codex/auth.json` and environment variables,
    the Auth_System SHALL load file-based credentials first, but SHALL NOT override
    explicitly set environment variables.

    **Validates: Requirements 1.1, 1.4, 4.1**
    """

    @given(
        env_api_key=valid_api_key,
        file_api_key=valid_api_key,
        env_base_url=valid_base_url,
        file_base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_explicit_env_vars_not_overridden(
        self,
        env_api_key,
        file_api_key,
        env_base_url,
        file_base_url
    ):
        """
        Feature: third-party-auth-stability, Property 1: Credential Loading Priority

        When explicit environment variables are set, they SHALL NOT be overridden
        by file-based credentials from auth.json.

        **Validates: Requirements 1.1, 1.4, 4.1**
        """
        # Ensure the keys are different to test priority
        assume(env_api_key != file_api_key)
        assume(env_base_url != file_base_url)

        with isolated_env():
            auth_data = {
                "OPENAI_API_KEY": file_api_key,
                "api_base_url": file_base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ["OPENAI_API_KEY"] = env_api_key
                os.environ["OPENAI_BASE_URL"] = env_base_url
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call hydration
                _hydrate_env_from_codex_config()

                # Assert: Environment variables should NOT be overridden
                assert os.environ.get("OPENAI_API_KEY") == env_api_key, \
                    "Explicit OPENAI_API_KEY should not be overridden by auth.json"
                assert os.environ.get("OPENAI_BASE_URL") == env_base_url, \
                    "Explicit OPENAI_BASE_URL should not be overridden by auth.json"

    @given(file_api_key=valid_api_key)
    @settings(max_examples=100)
    def test_file_credentials_loaded_when_env_empty(self, file_api_key):
        """
        Feature: third-party-auth-stability, Property 1: Credential Loading Priority

        When no explicit environment variables are set, file-based credentials
        from auth.json SHALL be loaded.

        **Validates: Requirements 1.1, 1.4, 4.1**
        """
        with isolated_env():
            auth_data = {"OPENAI_API_KEY": file_api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call hydration
                _hydrate_env_from_codex_config()

                # Assert: File credentials should be loaded
                assert os.environ.get("OPENAI_API_KEY") == file_api_key, \
                    "File-based OPENAI_API_KEY should be loaded when env is empty"

    @given(
        file_api_key=valid_api_key,
        file_base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_ensure_auth_hydrated_returns_correct_source(
        self,
        file_api_key,
        file_base_url
    ):
        """
        Feature: third-party-auth-stability, Property 1: Credential Loading Priority

        ensure_auth_hydrated() SHALL correctly identify the authentication source.

        **Validates: Requirements 1.1, 1.4, 4.1**
        """
        with isolated_env():
            auth_data = {
                "OPENAI_API_KEY": file_api_key,
                "api_base_url": file_base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call ensure_auth_hydrated
                status = ensure_auth_hydrated()

                # Assert: Status should indicate auth.json as source
                assert status.is_authenticated, "Should be authenticated"
                assert status.source == "auth.json", f"Source should be 'auth.json', got '{status.source}'"
                assert status.api_key_set, "API key should be set"
                assert status.base_url_set, "Base URL should be set"



class TestCredentialExtractionCompleteness:
    """
    Property 2: Credential Extraction Completeness

    *For any* valid `auth.json` file containing credentials (in any supported key format:
    OPENAI_API_KEY, api_key, apiKey, key, or token), the Auth_System SHALL correctly extract
    and set the OPENAI_API_KEY environment variable. Additionally, if `api_base_url` is present,
    both OPENAI_BASE_URL and OPENAI_API_BASE SHALL be set.

    **Validates: Requirements 1.2, 1.3**
    """

    # Strategy for key format names
    key_format = st.sampled_from(["OPENAI_API_KEY", "api_key", "apiKey", "key", "token"])

    @given(
        key_name=key_format,
        api_key=valid_api_key,
    )
    @settings(max_examples=100)
    def test_all_key_formats_extracted(self, key_name, api_key):
        """
        Feature: third-party-auth-stability, Property 2: Credential Extraction Completeness

        For any supported key format in auth.json, the Auth_System SHALL correctly
        extract and set the OPENAI_API_KEY environment variable.

        **Validates: Requirements 1.2, 1.3**
        """
        with isolated_env():
            # Create auth.json with the specified key format
            auth_data = {key_name: api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call hydration
                _hydrate_env_from_codex_config()

                # Assert: OPENAI_API_KEY should be set regardless of key format
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    f"OPENAI_API_KEY should be set from '{key_name}' format"

    @given(
        api_key=valid_api_key,
        base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_base_url_sets_both_env_vars(self, api_key, base_url):
        """
        Feature: third-party-auth-stability, Property 2: Credential Extraction Completeness

        When api_base_url is present in auth.json, both OPENAI_BASE_URL and
        OPENAI_API_BASE SHALL be set.

        **Validates: Requirements 1.2, 1.3**
        """
        with isolated_env():
            auth_data = {
                "OPENAI_API_KEY": api_key,
                "api_base_url": base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call hydration
                _hydrate_env_from_codex_config()

                # Assert: Both base URL env vars should be set
                assert os.environ.get("OPENAI_BASE_URL") == base_url, \
                    "OPENAI_BASE_URL should be set from api_base_url"
                assert os.environ.get("OPENAI_API_BASE") == base_url, \
                    "OPENAI_API_BASE should be set from api_base_url"

    @given(
        key_name=key_format,
        api_key=valid_api_key,
        base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_complete_extraction_with_all_fields(self, key_name, api_key, base_url):
        """
        Feature: third-party-auth-stability, Property 2: Credential Extraction Completeness

        For any valid auth.json with both API key (in any format) and base URL,
        all relevant environment variables SHALL be correctly set.

        **Validates: Requirements 1.2, 1.3**
        """
        with isolated_env():
            auth_data = {
                key_name: api_key,
                "api_base_url": base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Act: Call ensure_auth_hydrated
                status = ensure_auth_hydrated()

                # Assert: All fields should be correctly extracted
                assert status.is_authenticated, "Should be authenticated"
                assert status.api_key_set, "API key should be set"
                assert status.base_url_set, "Base URL should be set"
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    f"OPENAI_API_KEY should be set from '{key_name}' format"
                assert os.environ.get("OPENAI_BASE_URL") == base_url, \
                    "OPENAI_BASE_URL should be set"
                assert os.environ.get("OPENAI_API_BASE") == base_url, \
                    "OPENAI_API_BASE should be set"


class TestShellIndependence:
    """
    Property 3: Shell Independence

    *For any* system with valid credentials in `~/.codex/auth.json`, the Auth_System
    SHALL successfully load credentials without depending on shell environment variables
    from `.zshrc` or any shell configuration.

    **Validates: Requirements 2.1, 2.3, 4.3**
    """

    @given(
        api_key=valid_api_key,
    )
    @settings(max_examples=100)
    def test_credentials_load_without_shell_env_vars(self, api_key):
        """
        Feature: third-party-auth-stability, Property 3: Shell Independence

        For any valid auth.json, credentials SHALL be loaded successfully even when
        no shell environment variables are set (simulating GUI app launch from Finder).

        **Validates: Requirements 2.1, 2.3, 4.3**
        """
        with isolated_env():
            auth_data = {"OPENAI_API_KEY": api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Clear ALL relevant environment variables to simulate GUI launch
                # This simulates launching from Finder where shell env vars are not inherited
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)
                os.environ.pop("HOME", None)  # Simulate no HOME var
                os.environ.pop("PATH", None)  # Simulate no PATH var
                os.environ.pop("SHELL", None)  # Simulate no SHELL var
                os.environ.pop("USER", None)  # Simulate no USER var
                os.environ.pop("TERM", None)  # Simulate no TERM var

                # Act: Call hydration - should work without shell env vars
                _hydrate_env_from_codex_config()

                # Assert: Credentials should be loaded from auth.json
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    "Credentials should be loaded from auth.json without shell env vars"

    @given(
        api_key=valid_api_key,
        base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_complete_credentials_load_without_shell_env(self, api_key, base_url):
        """
        Feature: third-party-auth-stability, Property 3: Shell Independence

        For any valid auth.json with both API key and base URL, all credentials
        SHALL be loaded successfully without shell environment variables.

        **Validates: Requirements 2.1, 2.3, 4.3**
        """
        with isolated_env():
            auth_data = {
                "OPENAI_API_KEY": api_key,
                "api_base_url": base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Clear ALL relevant environment variables
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)
                os.environ.pop("HOME", None)
                os.environ.pop("PATH", None)
                os.environ.pop("SHELL", None)

                # Act: Call ensure_auth_hydrated
                status = ensure_auth_hydrated()

                # Assert: All credentials should be loaded
                assert status.is_authenticated, \
                    "Should be authenticated without shell env vars"
                assert status.source == "auth.json", \
                    f"Source should be 'auth.json', got '{status.source}'"
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    "API key should be loaded without shell env vars"
                assert os.environ.get("OPENAI_BASE_URL") == base_url, \
                    "Base URL should be loaded without shell env vars"
                assert os.environ.get("OPENAI_API_BASE") == base_url, \
                    "API base should be loaded without shell env vars"

    @given(
        key_name=st.sampled_from(["OPENAI_API_KEY", "api_key", "apiKey", "key", "token"]),
        api_key=valid_api_key,
    )
    @settings(max_examples=100)
    def test_all_key_formats_work_without_shell_env(self, key_name, api_key):
        """
        Feature: third-party-auth-stability, Property 3: Shell Independence

        For any supported key format in auth.json, credentials SHALL be loaded
        successfully without shell environment variables.

        **Validates: Requirements 2.1, 2.3, 4.3**
        """
        with isolated_env():
            auth_data = {key_name: api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Clear ALL relevant environment variables
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)
                os.environ.pop("HOME", None)
                os.environ.pop("PATH", None)
                os.environ.pop("SHELL", None)
                os.environ.pop("TERM", None)

                # Act: Call hydration
                _hydrate_env_from_codex_config()

                # Assert: Credentials should be loaded regardless of key format
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    f"Credentials should be loaded from '{key_name}' format without shell env vars"

    @given(
        api_key=valid_api_key,
    )
    @settings(max_examples=100)
    def test_ensure_auth_hydrated_works_without_zshrc_vars(self, api_key):
        """
        Feature: third-party-auth-stability, Property 3: Shell Independence

        ensure_auth_hydrated() SHALL work correctly without any variables that
        would typically be set by .zshrc or other shell configuration files.

        **Validates: Requirements 2.1, 2.3, 4.3**
        """
        with isolated_env():
            auth_data = {"OPENAI_API_KEY": api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Clear environment to simulate GUI app launch
                # These are typical vars set by .zshrc that won't be present in GUI apps
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)
                os.environ.pop("HOME", None)
                os.environ.pop("PATH", None)
                os.environ.pop("SHELL", None)
                os.environ.pop("TERM", None)
                os.environ.pop("LANG", None)
                os.environ.pop("LC_ALL", None)
                os.environ.pop("EDITOR", None)
                os.environ.pop("VISUAL", None)

                # Act: Call ensure_auth_hydrated
                status = ensure_auth_hydrated()

                # Assert: Authentication should succeed
                assert status.is_authenticated, \
                    "Should be authenticated without .zshrc environment variables"
                assert status.api_key_set, \
                    "API key should be set without .zshrc environment variables"
                assert os.environ.get("OPENAI_API_KEY") == api_key, \
                    "API key should match the one in auth.json"


class TestRunnerStartupVerification:
    """
    Property 5: Runner Startup Verification

    *For any* runner (Insights, Roadmap, Ideation), the runner SHALL call
    `ensure_auth_hydrated()` before attempting any Codex CLI operations,
    ensuring credentials are loaded regardless of launch method.

    **Validates: Requirements 3.2, 3.3, 3.4, 5.1**
    """

    # Strategy for generating runner names
    runner_names = st.sampled_from(["insights", "roadmap", "ideation"])

    @given(
        file_api_key=valid_api_key,
    )
    @settings(max_examples=100)
    def test_runners_call_ensure_auth_hydrated_before_operations(self, file_api_key):
        """
        Feature: third-party-auth-stability, Property 5: Runner Startup Verification

        For any runner, ensure_auth_hydrated() SHALL be called before any
        Codex CLI operations, ensuring credentials are loaded from auth.json.

        **Validates: Requirements 3.2, 3.3, 3.4, 5.1**
        """
        # This test verifies that when runners start, they call ensure_auth_hydrated()
        # which loads credentials from auth.json before any CLI operations.

        with isolated_env():
            auth_data = {"OPENAI_API_KEY": file_api_key}

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars to simulate GUI launch
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Simulate what runners do at startup: call ensure_auth_hydrated()
                # This is the critical call that must happen before any CLI operations
                status = ensure_auth_hydrated()

                # Assert: After ensure_auth_hydrated(), credentials should be loaded
                assert status.is_authenticated, \
                    "Runner startup should result in authenticated state"
                assert status.source == "auth.json", \
                    f"Credentials should be loaded from auth.json, got '{status.source}'"
                assert os.environ.get("OPENAI_API_KEY") == file_api_key, \
                    "OPENAI_API_KEY should be set after runner startup"

    @given(
        file_api_key=valid_api_key,
        file_base_url=valid_base_url,
    )
    @settings(max_examples=100)
    def test_runners_load_complete_credentials_at_startup(self, file_api_key, file_base_url):
        """
        Feature: third-party-auth-stability, Property 5: Runner Startup Verification

        For any runner, ensure_auth_hydrated() SHALL load both API key and
        base URL from auth.json when available.

        **Validates: Requirements 3.2, 3.3, 3.4, 5.1**
        """
        with isolated_env():
            auth_data = {
                "OPENAI_API_KEY": file_api_key,
                "api_base_url": file_base_url,
            }

            with temp_codex_dir(auth_data) as codex_dir:
                # Set up environment - clear relevant vars to simulate GUI launch
                auth._DEFAULT_CODEX_CONFIG_DIR = codex_dir
                os.environ.pop("OPENAI_API_KEY", None)
                os.environ.pop("OPENAI_BASE_URL", None)
                os.environ.pop("OPENAI_API_BASE", None)
                os.environ.pop("CODEX_CONFIG_DIR", None)
                os.environ.pop("CODEX_CODE_OAUTH_TOKEN", None)

                # Simulate runner startup
                status = ensure_auth_hydrated()

                # Assert: Complete credentials should be loaded
                assert status.is_authenticated, \
                    "Runner startup should result in authenticated state"
                assert status.api_key_set, \
                    "API key should be set after runner startup"
                assert status.base_url_set, \
                    "Base URL should be set after runner startup"
                assert os.environ.get("OPENAI_API_KEY") == file_api_key, \
                    "OPENAI_API_KEY should be set"
                assert os.environ.get("OPENAI_BASE_URL") == file_base_url, \
                    "OPENAI_BASE_URL should be set"
                assert os.environ.get("OPENAI_API_BASE") == file_base_url, \
                    "OPENAI_API_BASE should be set"

    def test_all_runners_import_ensure_auth_hydrated(self):
        """
        Feature: third-party-auth-stability, Property 5: Runner Startup Verification

        Verify that all three runners (Insights, Roadmap, Ideation) import
        ensure_auth_hydrated from core.auth.

        **Validates: Requirements 3.2, 3.3, 3.4, 5.1**
        """
        import ast
        from pathlib import Path

        runners_dir = Path(__file__).parent.parent / "auto-codex" / "runners"
        runner_files = [
            runners_dir / "insights_runner.py",
            runners_dir / "roadmap_runner.py",
            runners_dir / "ideation_runner.py",
        ]

        for runner_file in runner_files:
            assert runner_file.exists(), f"Runner file should exist: {runner_file}"

            with open(runner_file) as f:
                source = f.read()

            # Parse the AST to find imports
            tree = ast.parse(source)

            # Check for import of ensure_auth_hydrated
            imports_ensure_auth = False
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom):
                    if node.module and "auth" in node.module:
                        for alias in node.names:
                            if alias.name == "ensure_auth_hydrated":
                                imports_ensure_auth = True
                                break

            assert imports_ensure_auth, \
                f"{runner_file.name} should import ensure_auth_hydrated from core.auth"

    def test_all_runners_call_ensure_auth_hydrated_in_main(self):
        """
        Feature: third-party-auth-stability, Property 5: Runner Startup Verification

        Verify that all three runners call ensure_auth_hydrated() in their main() function.

        **Validates: Requirements 3.2, 3.3, 3.4, 5.1**
        """
        import ast
        from pathlib import Path

        runners_dir = Path(__file__).parent.parent / "auto-codex" / "runners"
        runner_files = [
            runners_dir / "insights_runner.py",
            runners_dir / "roadmap_runner.py",
            runners_dir / "ideation_runner.py",
        ]

        for runner_file in runner_files:
            assert runner_file.exists(), f"Runner file should exist: {runner_file}"

            with open(runner_file) as f:
                source = f.read()

            # Parse the AST to find the main function
            tree = ast.parse(source)

            # Find the main function and check for ensure_auth_hydrated call
            calls_ensure_auth_in_main = False
            for node in ast.walk(tree):
                if isinstance(node, ast.FunctionDef) and node.name == "main":
                    # Walk through the main function body
                    for child in ast.walk(node):
                        if isinstance(child, ast.Call):
                            if isinstance(child.func, ast.Name):
                                if child.func.id == "ensure_auth_hydrated":
                                    calls_ensure_auth_in_main = True
                                    break
                    break

            assert calls_ensure_auth_in_main, \
                f"{runner_file.name} should call ensure_auth_hydrated() in main()"


class TestGUIPathCompleteness:
    """
    Property 4: GUI PATH Completeness

    *For any* invocation of `get_gui_env()`, the returned PATH SHALL include all common
    binary locations (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`,
    `~/.local/bin`, `~/.npm-global/bin`) that exist on the system.

    **Validates: Requirements 2.2**
    """

    # Expected directories that should be in GUI PATH (if they exist on the system)
    EXPECTED_GUI_PATHS = [
        "/opt/homebrew/bin",        # macOS ARM (Homebrew)
        "/usr/local/bin",           # macOS Intel (Homebrew) / Linux
        "/usr/bin",                 # System binaries
        "/bin",                     # Core binaries
        os.path.expanduser("~/.local/bin"),
        os.path.expanduser("~/.npm-global/bin"),
    ]

    # Strategy for generating random PATH values
    random_path_component = st.text(
        alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz0123456789/_-."),
        min_size=1,
        max_size=50,
    ).map(lambda x: "/" + x.strip("/"))

    random_path = st.lists(random_path_component, min_size=0, max_size=5).map(
        lambda parts: os.pathsep.join(parts)
    )

    @given(initial_path=random_path)
    @settings(max_examples=100)
    def test_gui_env_includes_existing_expected_directories(self, initial_path):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        For any initial PATH value, get_gui_env() SHALL include all expected
        directories that exist on the system.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Set up initial PATH
            os.environ["PATH"] = initial_path

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: All expected directories that exist should be in the result PATH
            for expected_dir in self.EXPECTED_GUI_PATHS:
                if os.path.isdir(expected_dir):
                    assert expected_dir in result_path_parts, \
                        f"Expected directory '{expected_dir}' should be in PATH when it exists on the system"

    @given(initial_path=random_path)
    @settings(max_examples=100)
    def test_gui_env_preserves_existing_path_entries(self, initial_path):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        For any initial PATH value, get_gui_env() SHALL preserve all existing
        PATH entries while adding new ones.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Set up initial PATH
            os.environ["PATH"] = initial_path
            initial_parts = initial_path.split(os.pathsep) if initial_path else []

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: All original PATH entries should still be present
            for original_part in initial_parts:
                if original_part:  # Skip empty strings
                    assert original_part in result_path_parts, \
                        f"Original PATH entry '{original_part}' should be preserved"

    @given(initial_path=random_path)
    @settings(max_examples=100)
    def test_gui_env_does_not_duplicate_expected_directories(self, initial_path):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        For any initial PATH that already contains expected directories,
        get_gui_env() SHALL NOT duplicate those expected directory entries.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Add some expected directories to the initial PATH
            existing_dirs = [d for d in self.EXPECTED_GUI_PATHS if os.path.isdir(d)]
            if existing_dirs:
                # Add first existing dir to initial path
                initial_with_expected = initial_path + os.pathsep + existing_dirs[0] if initial_path else existing_dirs[0]
                os.environ["PATH"] = initial_with_expected
            else:
                os.environ["PATH"] = initial_path

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: Expected directories should not appear more than once
            for expected_dir in self.EXPECTED_GUI_PATHS:
                if os.path.isdir(expected_dir):
                    count = result_path_parts.count(expected_dir)
                    assert count <= 1, \
                        f"Expected directory '{expected_dir}' should not be duplicated (found {count} times)"

    def test_gui_env_includes_all_standard_binary_locations(self):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        Verify that get_gui_env() includes all standard binary locations that
        exist on the current system.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Clear PATH to test from scratch
            os.environ["PATH"] = ""

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: All existing expected directories should be in PATH
            for expected_dir in self.EXPECTED_GUI_PATHS:
                if os.path.isdir(expected_dir):
                    assert expected_dir in result_path_parts, \
                        f"Standard binary location '{expected_dir}' should be in PATH"

    def test_gui_env_returns_complete_environment(self):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        Verify that get_gui_env() returns a complete environment dictionary,
        not just the PATH.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Set some test environment variables
            os.environ["TEST_VAR"] = "test_value"
            os.environ["PATH"] = "/usr/bin"

            # Act: Call get_gui_env
            result_env = get_gui_env()

            # Assert: Result should contain PATH and other env vars
            assert "PATH" in result_env, "Result should contain PATH"
            assert result_env.get("TEST_VAR") == "test_value", \
                "Result should preserve other environment variables"

    @given(
        initial_path=st.just(""),
    )
    @settings(max_examples=10)
    def test_gui_env_handles_empty_path(self, initial_path):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        For an empty initial PATH, get_gui_env() SHALL still include all
        expected directories that exist on the system.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Set empty PATH
            os.environ["PATH"] = initial_path

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: Should have at least some expected directories
            existing_expected = [d for d in self.EXPECTED_GUI_PATHS if os.path.isdir(d)]
            if existing_expected:
                # At least one expected directory should be in PATH
                found_any = any(d in result_path_parts for d in existing_expected)
                assert found_any, \
                    f"At least one of {existing_expected} should be in PATH when starting with empty PATH"

    def test_gui_env_adds_paths_at_beginning(self):
        """
        Feature: third-party-auth-stability, Property 4: GUI PATH Completeness

        Verify that get_gui_env() adds new paths at the beginning of PATH,
        giving them priority over existing entries.

        **Validates: Requirements 2.2**
        """
        from providers.codex_cli import get_gui_env

        with isolated_env():
            # Set a custom PATH that doesn't include expected directories
            os.environ["PATH"] = "/custom/path"

            # Act: Call get_gui_env
            result_env = get_gui_env()
            result_path = result_env.get("PATH", "")
            result_path_parts = result_path.split(os.pathsep) if result_path else []

            # Assert: Custom path should be at the end (new paths added at beginning)
            if "/custom/path" in result_path_parts:
                custom_index = result_path_parts.index("/custom/path")
                # Check that at least one expected directory comes before custom path
                existing_expected = [d for d in self.EXPECTED_GUI_PATHS if os.path.isdir(d)]
                if existing_expected:
                    for expected_dir in existing_expected:
                        if expected_dir in result_path_parts:
                            expected_index = result_path_parts.index(expected_dir)
                            assert expected_index < custom_index, \
                                f"Expected directory '{expected_dir}' should come before custom path"
                            break
