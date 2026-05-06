import { useAuth0 } from "@auth0/auth0-react";
import Button from "@mui/material/Button";
import "./Login.css";

const LogoutButton = () => {
  const { logout } = useAuth0();

  return (
    <Button
      className="logout-action"
      size="small"
      variant="outlined"
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
    >
      Sair
    </Button>
  );
};

export default LogoutButton;
