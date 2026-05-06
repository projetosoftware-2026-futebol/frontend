import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";
import { type ReactNode } from "react";
import { useAuthToken } from "./useAuthToken";
import "./Auth.css";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAdmin } = useAuthToken();

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <div className="auth-layout">
      <div className="auth-session" aria-label="Sessao do usuario">
        <span className="auth-user">{user?.name ?? "Usuario"}</span>
        {isAdmin && <span className="auth-role">Admin</span>}
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
