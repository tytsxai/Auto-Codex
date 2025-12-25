"""
Basic ideation evaluation utilities.
"""

import asyncio
import json
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_thinking_budget, normalize_thinking_level


def basic_ideation_score(ideation: dict) -> dict:
    issues: list[str] = []
    score = 100

    ideas = ideation.get("ideas", []) if isinstance(ideation.get("ideas"), list) else []
    if not ideas:
        issues.append("No ideas generated")
        score -= 50

    if "project_context" not in ideation:
        issues.append("Missing project_context")
        score -= 15

    idea_types = {i.get("type") for i in ideas if isinstance(i, dict)}
    if len(idea_types) < 2:
        issues.append("Low type diversity (<2 types)")
        score -= 10

    score = max(0, min(100, score))
    return {
        "score": score,
        "issues": issues,
        "idea_count": len(ideas),
        "type_count": len(idea_types)
    }


def build_ideation_summary(ideation: dict) -> dict:
    ideas = ideation.get("ideas", []) if isinstance(ideation.get("ideas"), list) else []
    return {
        "idea_titles": [i.get("title", "") for i in ideas[:10] if isinstance(i, dict)],
        "idea_types": [i.get("type", "") for i in ideas[:10] if isinstance(i, dict)],
        "project_context": ideation.get("project_context", {})
    }


async def judge_ideation_with_llm(
    ideation: dict,
    model: str,
    thinking_level: str,
) -> dict:
    summary = build_ideation_summary(ideation)
    prompt = f"""You are evaluating generated product ideation for quality and usefulness.
Return JSON only with keys: score (0-100), summary, strengths (array), risks (array), recommendations (array).

Ideation summary:
{json.dumps(summary, indent=2)}
"""

    client = create_client(
        project_dir=Path.cwd(),
        spec_dir=None,
        model=model,
        agent_type="planner",
        max_thinking_tokens=get_thinking_budget(thinking_level),
    )

    response_text = ""
    async with client:
        await client.query(prompt)
        async for msg in client.receive_response():
            if type(msg).__name__ == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "TextBlock" and hasattr(block, "text"):
                        response_text += block.text

    start = response_text.find("{")
    end = response_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {"error": "Judge returned non-JSON response", "raw": response_text[:2000]}

    try:
        return json.loads(response_text[start : end + 1])
    except json.JSONDecodeError:
        return {"error": "Failed to parse judge JSON", "raw": response_text[start : end + 1]}


def evaluate_ideation(
    ideation_path: Path,
    model: str,
    thinking_level: str,
    use_judge: bool = False,
) -> dict:
    if not ideation_path.exists():
        return {"error": f"Ideation file not found: {ideation_path}"}

    with open(ideation_path) as f:
        ideation = json.load(f)

    result = {"basic": basic_ideation_score(ideation)}

    if use_judge:
        result["judge"] = asyncio.run(
            judge_ideation_with_llm(ideation, model, normalize_thinking_level(thinking_level))
        )

    return result
