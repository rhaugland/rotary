import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { get, post, del } from "../api/client";

interface Member {
  id: string;
  name: string;
  role: string;
  preferredChannel: string;
  joinedAt: string;
}

interface InviteLink {
  id: string;
  token: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  createdAt: string;
}

const channelLabels: Record<string, string> = {
  sms: "SMS",
  email: "Email",
  google_chat: "Google Chat",
};

export default function Members() {
  const { currentWorkspace, isAdmin } = useOutletContext<{ currentWorkspace: { id: string }; isAdmin: boolean }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkspace) return;
    setLoading(true);
    Promise.all([
      get<Member[]>(`/workspaces/${currentWorkspace.id}/members`),
      isAdmin ? get<InviteLink[]>(`/workspaces/${currentWorkspace.id}/invites`) : Promise.resolve([]),
    ])
      .then(([m, i]) => { setMembers(m); setInvites(i); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentWorkspace?.id, isAdmin]);

  const createInvite = async () => {
    try {
      const invite = await post<{ id: string; token: string; url: string }>(`/workspaces/${currentWorkspace.id}/invites`, {});
      setInvites((prev) => [{ ...invite, expiresAt: null, maxUses: null, useCount: 0, active: true, createdAt: new Date().toISOString() } as InviteLink, ...prev]);
    } catch (err) {
      console.error("Failed to create invite:", err);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    try {
      await del(`/workspaces/${currentWorkspace.id}/invites/${inviteId}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  };

  const copyInviteUrl = (token: string, id: string) => {
    const url = `${window.location.origin}/dashboard/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) return <p className="text-brown-light text-sm">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-brown mb-5">Members</h1>

      {/* Member List */}
      <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden mb-8">
        {members.map((m, i) => (
          <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i < members.length - 1 ? "border-b border-tan-light" : ""}`}>
            <div>
              <p className="text-sm font-medium text-brown">{m.name}</p>
              <p className="text-xs text-brown-light mt-0.5">
                {channelLabels[m.preferredChannel] ?? m.preferredChannel} · Joined {new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
              m.role === "admin" ? "bg-guac/10 text-guac" : "bg-tan-light text-brown-light"
            }`}>
              {m.role}
            </span>
          </div>
        ))}
      </div>

      {/* Invite Management (admin only) */}
      {isAdmin && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-brown">Invite Links</h2>
            <button
              onClick={createInvite}
              className="bg-guac text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-guac-dark transition-colors"
            >
              + New Invite
            </button>
          </div>

          {invites.length === 0 ? (
            <p className="text-brown-light text-sm">No active invite links.</p>
          ) : (
            <div className="bg-white rounded-xl border border-tan shadow-sm overflow-hidden">
              {invites.map((inv, i) => (
                <div key={inv.id} className={`flex items-center justify-between px-4 py-3 ${i < invites.length - 1 ? "border-b border-tan-light" : ""}`}>
                  <div>
                    <p className="text-sm font-mono text-brown-light">{inv.token.slice(0, 20)}...</p>
                    <p className="text-xs text-brown-light mt-0.5">
                      Used {inv.useCount} time{inv.useCount !== 1 ? "s" : ""}
                      {inv.maxUses ? ` / ${inv.maxUses} max` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyInviteUrl(inv.token, inv.id)}
                      className="text-xs px-3 py-1.5 rounded-md border border-tan text-brown-light hover:border-guac hover:text-guac transition-colors"
                    >
                      {copiedId === inv.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      onClick={() => revokeInvite(inv.id)}
                      className="text-xs px-3 py-1.5 rounded-md border border-tan text-red-500 hover:border-red-300 transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
