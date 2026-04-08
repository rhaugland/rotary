import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api } from "../api/client";

export default function Settings() {
  const { currentWorkspace, isAdmin } = useOutletContext<{
    currentWorkspace: { id: string; name: string; slug: string };
    isAdmin: boolean;
  }>();
  const [name, setName] = useState(currentWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-xl font-bold text-brown mb-5">Settings</h1>
        <p className="text-brown-light text-sm">Only admins can edit workspace settings.</p>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api(`/workspaces/${currentWorkspace.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setSaved(true);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Settings</h1>
      <div className="bg-white rounded-xl border border-tan shadow-sm p-6 max-w-md">
        <form onSubmit={handleSave}>
          <label className="block text-sm font-medium text-brown mb-1.5">Workspace name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
            required
          />
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-guac text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-guac-dark transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-guac text-sm">Saved!</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
