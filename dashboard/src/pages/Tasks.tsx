import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get } from "../api/client";
import TaskList from "../components/TaskList";

const statusFilters = ["all", "open", "in_progress", "overdue", "done"];

export default function Tasks() {
  const { currentWorkspace } = useOutletContext<{ currentWorkspace: { id: string } }>();
  const [tasks, setTasks] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    const query = filter !== "all" ? `?status=${filter}` : "";
    get<any[]>(`/workspaces/${currentWorkspace.id}/tasks${query}`)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, filter]);

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Tasks</h1>
      <div className="flex gap-2 mb-4">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              filter === s
                ? "bg-guac text-white"
                : "bg-white text-brown-light border border-tan hover:border-guac/30"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-brown-light text-sm">Loading tasks...</p>
      ) : (
        <TaskList tasks={tasks} />
      )}
    </div>
  );
}
