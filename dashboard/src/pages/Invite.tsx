import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { get, post } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

export default function Invite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [name, setName] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("sms");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    get<{ valid: boolean; workspaceName?: string; reason?: string }>(`/invite/${token}`)
      .then((data) => {
        setValid(data.valid);
        if (data.valid && data.workspaceName) setWorkspaceName(data.workspaceName);
        if (!data.valid && data.reason) setReason(data.reason);
      })
      .catch(() => setValid(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await post(`/invite/${token}/join`, { name, preferredChannel, address });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  const channelPlaceholders: Record<string, string> = {
    sms: "+1234567890",
    email: "you@example.com",
    google_chat: "you@company.com",
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <AvocadoLogo size={40} />
          <h1 className="text-2xl font-bold text-brown">Guac</h1>
        </div>

        {valid === null && <p className="text-center text-brown-light text-sm">Checking invite...</p>}

        {valid === false && (
          <div className="text-center">
            <h2 className="text-lg font-semibold text-brown mb-2">Invalid invite</h2>
            <p className="text-brown-light text-sm">{reason || "This invite link is no longer valid."}</p>
          </div>
        )}

        {valid && success && (
          <div className="text-center">
            <div className="text-guac text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-brown mb-2">You're in!</h2>
            <p className="text-brown-light text-sm mb-4">Welcome to {workspaceName}.</p>
            <a href="/dashboard/login" className="text-guac text-sm hover:underline">Log in now</a>
          </div>
        )}

        {valid && !success && (
          <>
            <p className="text-center text-brown-light text-sm mb-4">
              Join <span className="font-semibold text-brown">{workspaceName}</span>
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Preferred channel</label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value)}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="google_chat">Google Chat</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">Contact</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={channelPlaceholders[preferredChannel]}
                  className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
                  required
                />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-guac text-white py-2.5 rounded-lg font-medium hover:bg-guac-dark transition-colors text-sm disabled:opacity-50"
              >
                {submitting ? "Joining..." : "Join workspace"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
