interface Activity {
  id: string;
  rawText: string;
  channel: string;
  direction: string;
  createdAt: string;
  user: { name: string };
  task?: { title: string } | null;
}

const channelIcons: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  google_chat: "Chat",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="text-brown-light text-sm py-4">No recent activity.</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-tan shadow-sm">
      <h3 className="text-sm font-semibold text-brown px-4 pt-4 pb-2">Activity</h3>
      {activities.map((a, i) => (
        <div key={a.id} className={`px-4 py-2.5 ${i < activities.length - 1 ? "border-b border-tan-light" : ""}`}>
          <p className="text-sm text-brown">
            <span className="font-medium">{a.user.name}</span>{" "}
            {a.rawText.length > 60 ? a.rawText.slice(0, 60) + "..." : a.rawText}
          </p>
          <p className="text-xs text-brown-light mt-0.5">
            via {channelIcons[a.channel] ?? a.channel} · {timeAgo(a.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
