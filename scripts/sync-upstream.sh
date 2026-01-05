#!/bin/bash
# 上游同步脚本 - AndyMik90/Auto-Claude
# Usage: ./scripts/sync-upstream.sh [--preview] [commit-hash]

set -e

PREVIEW=false
COMMIT=""

for arg in "$@"; do
    case $arg in
        --preview|--dry-run)
            PREVIEW=true
            shift
            ;;
        *)
            COMMIT="$arg"
            shift
            ;;
    esac
done

cd "$(dirname "$0")/.."

echo "=== 上游同步: AndyMik90/Auto-Claude ==="
echo ""

# 检查 upstream remote
if ! git remote get-url upstream &>/dev/null; then
    echo "添加 upstream remote..."
    git remote add upstream https://github.com/AndyMik90/Auto-Claude
fi

echo "获取上游更改..."
git fetch upstream

if [ -n "$COMMIT" ]; then
    echo "显示提交 $COMMIT 的更改..."
    git show --stat "$COMMIT"
else
    echo "上游最新提交:"
    git log --oneline -5 upstream/main
fi

echo ""
echo "本地独有提交 (upstream/main 之后):"
git log --oneline upstream/main..HEAD

echo ""
if [ "$PREVIEW" = true ]; then
    echo "[预览模式] 如需合并，请运行:"
    echo "  git cherry-pick -X ours <commit-hash>"
else
    echo "选择性合并 (本地优先):"
    echo "  ./scripts/sync-upstream.sh --preview          # 预览"
    echo "  ./scripts/sync-upstream.sh <commit-hash>      # 合并特定提交"
fi
