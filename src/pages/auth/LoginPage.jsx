import { Navigate } from "react-router-dom";
import { APP } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import LoginBrandPanel from "./LoginBrandPanel";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="login">
      <LoginBrandPanel />

      <section className="login__formpane">
        <div className="login__card">
          <div className="login__mobilebrand">
            <img src={APP.logoUrl} alt="Chintan logo" />
            <div>
              <div style={{ fontWeight: 700, color: "var(--c-ink)" }}>{APP.shortOrg}</div>
              <div className="u-small u-muted">Waste Operations Tracking</div>
            </div>
          </div>

          <h1 className="login__heading">Sign in</h1>
          <p className="login__sub">
            Use the credentials issued to you by the Super Admin.
          </p>

          <LoginForm />

          <p className="login__foot">
            {APP.org} · Specification {APP.specVersion}
          </p>
        </div>
      </section>
    </div>
  );
}
