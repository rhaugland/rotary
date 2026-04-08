interface Stat {
  label: string;
  value: number;
  color: string;
}

export default function StatsCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-tan p-4 shadow-sm">
          <p className="text-xs font-medium text-brown-light uppercase tracking-wide">{stat.label}</p>
          <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
