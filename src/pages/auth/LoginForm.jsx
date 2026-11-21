import { useState } from "react";
import Button from "../../components/common/Button";
import { Banner } from "../../components/common/States";
import { useAuth } from "../../context/AuthContext";

export default function LoginForm() {
  const { signIn, busy } = useAuth();
  const [values, setValues] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const set = (key) => (e) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signIn(values.username, values.password);
    } catch (err) {
      setError(err.message);
    }
  };

  const ready = values.username.trim() && values.password;

  return (
    <form className="login__form" onSubmit={submit} noValidate>
      {error && <Banner tone="danger">{error}</Banner>}

      <div className="field">
        <label className="field__label" htmlFor="username">Username</label>
        <input
          id="username"
          className="input"
          autoComplete="username"
          autoFocus
          placeholder="Your username"
          value={values.username}
          onChange={set("username")}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="password">Password</label>
        <div className="login__pwwrap">
          <input
            id="password"
            className="input"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            value={values.password}
            onChange={set("password")}
          />
          <button
            type="button"
            className="login__pwtoggle"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      <Button type="submit" block className="login__submit" disabled={!ready || busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
