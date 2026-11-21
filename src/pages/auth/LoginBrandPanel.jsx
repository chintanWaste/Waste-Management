import { APP } from "../../config/appConfig";

/** The four collection sources the system covers (section 1.2). */
const CHIPS = [
  "BWG collection",
  "MMRF / RRR Centres",
  "RRR on Wheels",
  "Special drives",
  "Diversion certificates",
];

/** Left-hand brand panel of the login screen (hidden below 980px). */
export default function LoginBrandPanel() {
  return (
    <section className="login__brandpane">
      <div className="login__brandtop">
        <img className="login__logo" src={APP.logoUrl} alt="Chintan logo" />
        <div>
          <div className="login__org">{APP.shortOrg}</div>
          <div className="login__orgsub">Environmental Research and Action Group</div>
        </div>
      </div>

      <div className="login__pitch">
        <h1>Every kilo accounted for, from collection to certificate.</h1>
        <p>
          One record of waste collected, held in stock, dispatched to vendors and
          certified back to bulk waste generators — so the figures agree on every
          screen and in every report.
        </p>

        <div className="login__chips">
          {CHIPS.map((chip) => (
            <span key={chip} className="login__chip">{chip}</span>
          ))}
        </div>
      </div>

      <div className="login__foot" style={{ color: "rgba(255,255,255,.5)" }}>
        {APP.name} · Specification {APP.specVersion}
      </div>
    </section>
  );
}
