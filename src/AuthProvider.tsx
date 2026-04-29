import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";
import { type ReactNode } from "react";
import { useAuthToken } from "./useAuthToken";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isAdmin } = useAuthToken();

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <>
      {user && user.name}
      {isAdmin && <div>Você é um administrador.</div>}
      {children}
      <LogoutButton />
    </>
  );
}
