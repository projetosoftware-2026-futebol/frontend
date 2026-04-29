import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <>
      <Stack>
        <Button onClick={() => loginWithRedirect()}>Log In</Button>
      </Stack>
    </>
  );
};

export default LoginButton;
