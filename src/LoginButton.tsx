import { useAuth0 } from "@auth0/auth0-react";
import Button from "@mui/material/Button";
import heroImage from "./assets/hero.png";
import "./Login.css";

export default function LoginButton() {
  const { isLoading, loginWithRedirect } = useAuth0();

  return (
    <main className="login-shell">
      <section className="login-stage" aria-label="Fut Manager">
        <img className="login-stage-image" src={heroImage} alt="" />
        <div className="login-stage-shade" />

        <div className="login-brand">
          <p className="login-eyebrow">Fut Manager</p>
          <h1>FUT MANAGER</h1>
          <p>Entre no vestiario e assuma o comando do seu clube.</p>
        </div>

        <div className="login-match-card" aria-hidden="true">
          <span>OVR</span>
          <strong>91</strong>
          <small>4-3-3</small>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel-header">
          <span className="login-club-mark">FM</span>
          <div>
            <p className="login-eyebrow">Acesso</p>
            <h2 id="login-title">Entrar na conta</h2>
          </div>
        </div>

        <p className="login-copy">
          Seu painel de clube, mercado e partidas fica pronto depois do login.
        </p>

        <Button
          className="login-action"
          variant="contained"
          size="large"
          disabled={isLoading}
          onClick={() => void loginWithRedirect()}
        >
          {isLoading ? "Preparando..." : "Entrar"}
        </Button>

        <div className="login-panel-footer" aria-hidden="true">
          <span>Auth0</span>
          <span>Temporada 2026</span>
        </div>
      </section>
    </main>
  );
}
