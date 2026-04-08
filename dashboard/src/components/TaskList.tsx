interface Task {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assignee?: { name: string };
  creator?: { name: string };
}

const statusStyles: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-green-700",
  overdue: "bg-red-50 text-red-700",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TaskList({ tasks, showAssignee = true }: { tasks: Task[]; showAssignee?: boolean }) {
  if (tasks.length === 0) {
    return <p className="text-brown-light text-sm py-4">No tasks found.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden">
      {tasks.map((task, i) => (
        <div key={task.id} className={`flex items-center justify-between px-4 py-3 ${i < tasks.length - 1 ? "border-b border-tan-light" : ""}`}>
          <div>
            <p className="text-sm font-medium text-brown">{task.title}</p>
            <p className="text-xs text-brown-light mt-0.5">
              {showAssignee && task.assignee ? task.assignee.name : task.creator ? `From ${task.creator.name}` : ""}
              {task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}
            </p>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusStyles[task.status] ?? "bg-gray-50 text-gray-600"}`}>
            {task.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
