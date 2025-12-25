"""
Basic roadmap evaluation utilities.
"""

import asyncio
import json
from pathlib import Path
from typing import Any

from core.client import create_client
from phase_config import get_thinking_budget, normalize_thinking_level


def _safe_get(obj: dict, path: list[str]) -> Any:
    cur = obj
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def basic_roadmap_score(roadmap: dict) -> dict:
    issues: list[str] = []
    score = 100

    required = ["phases", "features", "vision", "target_audience"]
    for key in required:
        if key not in roadmap:
            issues.append(f"Missing required field: {key}")
            score -= 15

    features = roadmap.get("features", []) if isinstance(roadmap.get("features"), list) else []
    phases = roadmap.get("phases", []) if isinstance(roadmap.get("phases"), list) else []

    if len(features) < 3:
        issues.append("Feature count < 3")
        score -= 20

    primary_audience = _safe_get(roadmap, ["target_audience", "primary"])
    if not primary_audience:
        issues.append("Missing target_audience.primary")
        score -= 10

    if not roadmap.get("vision"):
        issues.append("Missing vision")
        score -= 10

    score = max(0, min(100, score))
    return {
        "score": score,
        "issues": issues,
        "feature_count": len(features),
        "phase_count": len(phases)
    }


def build_roadmap_summary(roadmap: dict) -> dict:
    features = roadmap.get("features", []) if isinstance(roadmap.get("features"), list) else []
    phases = roadmap.get("phases", []) if isinstance(roadmap.get("phases"), list) else []
    return {
        "vision": roadmap.get("vision", ""),
        "target_audience": roadmap.get("target_audience", {}),
        "feature_titles": [f.get("title", "") for f in features[:10]],
        "phase_names": [p.get("name", "") for p in phases[:10]],
    }


async def judge_roadmap_with_llm(
    roadmap: dict,
    model: str,
    thinking_level: str,
) -> dict:
    summary = build_roadmap_summary(roadmap)
    prompt = f"""You are evaluating a product roadmap for quality and usefulness.
Return JSON only with keys: score (0-100), summary, strengths (array), risks (array), recommendations (array).

Roadmap summary:
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

    # Extract JSON from response
    start = response_text.find("{")
    end = response_text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return {"error": "Judge returned non-JSON response", "raw": response_text[:2000]}

    try:
        return json.loads(response_text[start : end + 1])
    except json.JSONDecodeError:
        return {"error": "Failed to parse judge JSON", "raw": response_text[start : end + 1]}


def evaluate_roadmap(
    roadmap_path: Path,
    model: str,
    thinking_level: str,
    use_judge: bool = False,
) -> dict:
    if not roadmap_path.exists():
        return {"error": f"Roadmap file not found: {roadmap_path}"}

    with open(roadmap_path) as f:
        roadmap = json.load(f)

    result = {"basic": basic_roadmap_score(roadmap)}

    if use_judge:
        result["judge"] = asyncio.run(
            judge_roadmap_with_llm(roadmap, model, normalize_thinking_level(thinking_level))
        )

    return result
