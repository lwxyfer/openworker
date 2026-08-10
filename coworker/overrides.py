"""User-local risk overrides — relax (or tighten) a tool's risk class.

Mainly to relax MCP's conservative default (every MCP tool defaults to ``external``): a user
who trusts a server can mark its read-only tools ``read`` so they stop gating. Rules match the
tool name (e.g. ``mcp__notion__create_page``) by glob; the most specific rule wins.

**Inviolable rule: this store is user-local and is NEVER written by a persona/package.** A
persona can declare what tools it wants, but only the user decides how much to trust them — so
the persona-loading path never touches this file (see ``PERMISSIONS-AND-INBOX.md``).
"""

from __future__ import annotations

from dataclasses import dataclass
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Callable, Optional

from .jsonstore import read_json, write_json_atomic
from .risk import RiskClass


@dataclass
class _Rule:
    pattern: str
    risk: RiskClass


def _specificity(pattern: str) -> int:
    """More literal (non-wildcard) characters = more specific; an exact pattern beats any glob."""
    literal = sum(1 for c in pattern if c not in "*?[]")
    exact = 0 if any(c in pattern for c in "*?[") else 1000
    return literal + exact


class RiskOverrideStore:
    """User-local rules with lazy mtime reload so live engines see REST updates."""

    def __init__(self, path: Optional[str | Path] = None) -> None:
        self.path = Path(path) if path else None
        self._mtime: Optional[int] = None
        self._rules: list[_Rule] = []
        self._refresh()

    def _refresh(self) -> None:
        if not self.path:
            return
        try:
            mtime = self.path.stat().st_mtime_ns
        except OSError:
            self._rules, self._mtime = [], None
            return
        if mtime != self._mtime:
            self._rules, self._mtime = self._load(), mtime

    def _load(self) -> list[_Rule]:
        data = read_json(self.path, {}) or {}
        rules = []
        for r in data.get("rules", []):
            try:
                rules.append(_Rule(str(r["pattern"]), RiskClass(str(r["risk"]))))
            except (KeyError, ValueError, TypeError):
                continue  # skip malformed rules rather than failing the whole store
        return rules

    def save(self) -> None:
        write_json_atomic(
            self.path,
            {"rules": [{"pattern": r.pattern, "risk": r.risk.value} for r in self._rules]},
        )
        try:
            self._mtime = self.path.stat().st_mtime_ns if self.path else None
        except OSError:
            self._mtime = None

    def set_rule(self, pattern: str, risk: RiskClass | str) -> None:
        """Add/replace a user override (the everyday path writes this from the approval UI)."""
        risk = RiskClass(risk) if not isinstance(risk, RiskClass) else risk
        self._refresh()
        self._rules = [r for r in self._rules if r.pattern != pattern]
        self._rules.append(_Rule(pattern, risk))
        self.save()

    def remove_rule(self, pattern: str) -> bool:
        self._refresh()
        before = len(self._rules)
        self._rules = [r for r in self._rules if r.pattern != pattern]
        if len(self._rules) == before:
            return False
        self.save()
        return True

    def rules(self) -> list[dict[str, str]]:
        self._refresh()
        return [{"pattern": r.pattern, "risk": r.risk.value} for r in self._rules]

    def resolve(self, tool_name: str) -> Optional[RiskClass]:
        self._refresh()
        best: Optional[RiskClass] = None
        best_score = -1
        for r in self._rules:
            if fnmatchcase(tool_name, r.pattern):
                score = _specificity(r.pattern)
                if score > best_score:
                    best, best_score = r.risk, score
        return best

    def resolver(self) -> Callable[[str], Optional[RiskClass]]:
        """A callable for ``PermissionEngine.risk_overrides`` / ``risk.classify``."""
        return self.resolve
