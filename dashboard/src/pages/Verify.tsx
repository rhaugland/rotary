import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { post } from "../api/client";
import AvocadoLogo from "../components/AvocadoLogo";

interface VerifyProps {
  onLogin: (token: string) => void;
}

export default function Verify({ onLogin }: VerifyProps) {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    post<{ token: string; user: { id: string; name: string } }>("/auth/verify", { token })
      .then((data) => {
        onLogin(data.token);
        navigate("/");
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired link");
      });
  }, [token, onLogin, navigate]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border border-tan p-8 w-full max-w-sm text-center">
        <AvocadoLogo size={40} />
        {error ? (
          <>
            <h2 className="text-lg font-semibold text-brown mt-4 mb-2">Link expired</h2>
            <p className="text-brown-light text-sm mb-4">{error}</p>
            <a href="/dashboard/login" className="text-guac text-sm hover:underline">Request a new link</a>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-brown mt-4 mb-2">Verifying...</h2>
            <p className="text-brown-light text-sm">Hang tight, logging you in.</p>
          </>
        )}
      </div>
    </div>
  );
}
