#!/bin/bash
# SkillSpector (NVIDIA): فاحص أمان للسكيلز والإضافات قبل تركيبها — بيتنزل في الخلفية أول ما الجلسة تبدأ لو مش موجود
# الاستخدام: skillspector scan <رابط أو فولدر السكيل> --no-llm
command -v skillspector >/dev/null 2>&1 && exit 0
command -v uv >/dev/null 2>&1 || exit 0
nohup uv tool install "skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git@d7338f58200a9ae2a24810cee08911ab68b107a7" >/tmp/skillspector-install.log 2>&1 &
exit 0
