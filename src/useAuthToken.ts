import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useState } from "react";

export function useAuthToken() {
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

  return { user, isAuthenticated, token, isAdmin };
}
