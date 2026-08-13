// Any persona that needs files is project-scoped: the user explicitly chooses a directory and
// sessions are grouped beneath that project, Codex-style. Chat-like personas advertise
// `workspace: "none"` (or `needs_workspace: false`) and remain directory-free.
export function isProjectScoped(p?: {
  workspace?: string;
  family?: string;
  needs_workspace?: boolean;
}): boolean {
  if (!p) return false;
  if (p.needs_workspace !== undefined) return p.needs_workspace;
  return p.workspace !== "none" && (p.family === "code" || !!p.workspace);
}

// Persona naming: the product is "OpenWorker"; the personas are a "Coworker" family — Coworker
// (general), Code Coworker, Ops Coworker. In lists/chrome we use the SHORT label (Coworker / Code /
// Ops); the persona detail page uses the FULL family name. Backend names are left untouched (the
// API + tests keep "OpenWorker" / "Ops Coworker"); this is purely the display layer.

// Short label for the sidebar + top bar: "Coworker" / "Code" / "Ops" / "Chat".
export function shortPersonaName(name?: string, id?: string): string {
  if (id === "cowork") return "Coworker";
  const n = (name || id || "").trim();
  return n.replace(/\s*coworker$/i, "").trim() || n;
}

// Full family name for the persona detail page: "Coworker" / "Code Coworker" / "Ops Coworker".
// Chat isn't a coworker — left as-is.
export function fullPersonaName(name?: string, id?: string): string {
  if (id === "cowork") return "Coworker";
  const n = (name || id || "").trim();
  if (id === "chat" || !n) return n;
  return /coworker$/i.test(n) ? n : `${n} Coworker`;
}
