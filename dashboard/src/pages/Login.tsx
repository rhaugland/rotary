import { useState } from "react";
import { post } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

export default function Login() {
  const [address, setAddress] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await post("/auth/request", { address });
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-6">
          <AvocadoLogo size={40} />
          <h1 className="text-2xl font-bold text-brown">Guac</h1>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-guac text-4xl mb-3">✓</div>
            <h2 className="text-lg font-semibold text-brown mb-2">Check your messages</h2>
            <p className="text-brown-light text-sm">We sent a login link to your preferred channel.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-brown mb-1.5">
              Email or phone number
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="+1234567890 or you@email.com"
              className="w-full px-3 py-2 border border-tan rounded-lg text-brown bg-cream/50 focus:outline-none focus:ring-2 focus:ring-guac/30 focus:border-guac text-sm"
              required
            />
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <button
              type="submit"
              className="w-full mt-4 bg-guac text-white py-2.5 rounded-lg font-medium hover:bg-guac-dark transition-colors text-sm"
            >
              Send login link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
