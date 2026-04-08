import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get } from "../api/client";
import StatsCards from "../components/StatsCards";
import TaskList from "../components/TaskList";
import ActivityFeed from "../components/ActivityFeed";

interface DashboardData {
  openTasks: number;
  overdueTasks: number;
  completedTasks: number;
  memberCount: number;
  recentTasks: any[];
  recentActivity: any[];
}

export default function Dashboard() {
  const { currentWorkspace, isAdmin } = useOutletContext<{ currentWorkspace: { id: string; slug: string }; isAdmin: boolean }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    if (isAdmin) {
      get<DashboardData>(`/workspaces/${currentWorkspace.id}/dashboard`)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      get<any[]>(`/workspaces/${currentWorkspace.id}/my-tasks`)
        .then(setMyTasks)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [currentWorkspace?.id, isAdmin]);

  if (loading) {
    return <p className="text-brown-light">Loading...</p>;
  }

  // Member view: show my tasks
  if (!isAdmin) {
    const openCount = myTasks.filter((t) => t.status !== "done").length;
    const dueThisWeek = myTasks.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const due = new Date(t.dueDate);
      const weekFromNow = new Date(Date.now() + 7 * 86400000);
      return due <= weekFromNow;
    }).length;
    const memberStats = [
      { label: "Assigned to Me", value: openCount, color: "text-blue-600" },
      { label: "Due This Week", value: dueThisWeek, color: "text-amber-600" },
    ];
    return (
      <div>
        <h1 className="text-xl font-bold text-brown mb-5">My Tasks</h1>
        <div className="max-w-md">
          <StatsCards stats={memberStats} />
        </div>
        <TaskList tasks={myTasks} showAssignee={false} />
      </div>
    );
  }

  // Admin view: full dashboard
  if (!data) return null;

  const stats = [
    { label: "Open", value: data.openTasks, color: "text-blue-600" },
    { label: "Overdue", value: data.overdueTasks, color: "text-red-600" },
    { label: "Completed", value: data.completedTasks, color: "text-guac" },
    { label: "Members", value: data.memberCount, color: "text-brown" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Dashboard</h1>
      <StatsCards stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold text-brown mb-3">Recent Tasks</h3>
          <TaskList tasks={data.recentTasks} />
        </div>
        <div className="lg:col-span-2">
          <ActivityFeed activities={data.recentActivity} />
        </div>
      </div>
    </div>
  );
}
