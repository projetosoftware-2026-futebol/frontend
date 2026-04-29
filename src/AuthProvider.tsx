import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";
import { useEffect, useState, type ReactNode } from "react";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    const fetchTokenAndRoles = async () => {
      try {
        const accessToken = await getAccessTokenSilently();
        setToken(accessToken);

        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const roles = payload[import.meta.env.VITE_ROLES_NAMESPACE] || [];
        setIsAdmin(roles.includes("ADMIN"));
      } catch (e) {
        console.error("Erro ao buscar token:", e);
      }
    };

    if (isAuthenticated) {
      fetchTokenAndRoles();
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  if (!isAuthenticated) {
    return <LoginButton />;
  }

  return (
    <>
      {token}
      {isAdmin && (
        <div>Bem-vindo, {user && user.name}! Você é um administrador.</div>
      )}
      {children}
      <LogoutButton />
    </>
  );
}
