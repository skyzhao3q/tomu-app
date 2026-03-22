# Skill Implementation: `xiaohongshu-cli`

## 🚀 正体: 外部ラッパー・スクリプト
このスキルは `xiaohongshu-cli/scripts/` ディレクトリ内に独自の実行スクリプトを持っています。

### `scripts/xhs`
```bash
#!/usr/bin/env bash
set -euo pipefail

if command -v xhs >/dev/null 2>&1; then
  exec xhs "$@"
fi

if command -v uvx >/dev/null 2>&1; then
  exec uvx --from xiaohongshu-cli xhs "$@"
fi

if command -v uv >/dev/null 2>&1; then
  exec uv tool run --from xiaohongshu-cli xhs "$@"
fi

cat >&2 <<'EOF'
xhs is not installed and uv/uvx is unavailable.

Install xiaohongshu-cli with one of:
  uv tool install xiaohongshu-cli
  pipx install xiaohongshu-cli
EOF

exit 127

```

