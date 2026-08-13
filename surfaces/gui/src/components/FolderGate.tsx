import { useEffect, useState } from "react";
import { getRecentWorkspaces, openWorkspace, type RecentWorkspace } from "../api";
import { chooseFolder } from "../tauri";

// The mandatory project-directory picker for every file-capable persona. Deliberately no
// "switch persona" escape hatch: the user explicitly chose an agent that works with files.
interface Props {
  onChoose: (path: string, branch?: string | null) => void;
  onCancel?: () => void; // present when changing folder mid-session
  create?: boolean; // "New project" mode: create the folder if missing
}

export function FolderGate({ onChoose, onCancel, create }: Props) {
  const [recents, setRecents] = useState<RecentWorkspace[]>([]);
  const [path, setPath] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getRecentWorkspaces().then(setRecents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!onCancel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const open = async (p: string, doCreate = false) => {
    setError("");
    const res = await openWorkspace(p.trim(), doCreate);
    if (res.ok) onChoose(res.path, res.git_branch);
    else setError(res.error || "could not open that folder");
  };

  const browse = async () => {
    const picked = await chooseFolder();
    if (picked) {
      setPath(picked);
      open(picked, create); // a picked folder already exists; create flag is harmless
    }
  };

  return (
    <div
      className="gate-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div className="gate" role="dialog" aria-modal="true" aria-labelledby="project-picker-title">
        {onCancel && (
          <button
            type="button"
            className="gate-close"
            onClick={onCancel}
            aria-label="Close project picker"
            title="Close"
          >
            ×
          </button>
        )}
        <div className="gate-mark">✦</div>
        <h2 id="project-picker-title">{create ? "New project" : "Choose a project folder"}</h2>
        <p className="gate-sub">
          {create
            ? "Pick a folder or enter a path. If the path doesn't exist, it will be created."
            : "Choose the folder this agent can read, edit, and run in. Sessions and files stay inside this project."}
        </p>

        <div className="gate-input">
          <input
            placeholder="/path/to/your/project"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && open(path, create)}
            autoFocus
          />
          <button className="btn" onClick={browse} title="Pick a folder">
            Browse…
          </button>
          <button className="btn primary" onClick={() => open(path, create)} disabled={!path.trim()}>
            {create ? "Create" : "Open"}
          </button>
        </div>
        {error && <div className="gate-error">{error}</div>}

        {recents.length > 0 && (
          <>
            <div className="gate-label">Recent</div>
            <div className="gate-recents">
              {recents.map((w) => (
                <div className="gate-recent" key={w.path} onClick={() => open(w.path)} title={w.path}>
                  <span className="folder">📁 {w.name}</span>
                  <span className="dim">{w.path}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {onCancel && (
          <div className="gate-foot">
            <button className="btn gate-cancel" onClick={onCancel}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
