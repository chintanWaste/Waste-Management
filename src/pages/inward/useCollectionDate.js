import { useState } from "react";
import { SETTING, ROLES } from "../../config/appConfig";
import { useAuth } from "../../context/AuthContext";
import { useSettings } from "../../context/SettingsContext";
import { daysBetween, today, toInputDate } from "../../utils/format";

/**
 * The collection-date rule shared by every inward tab (section 12.1).
 *
 * A collection date is never in the future. A Supervisor may go back only as
 * many days as the Settings tab allows; the Super Admin has no limit.
 */
export function useCollectionDate(initial = today()) {
  const { user } = useAuth();
  const { number } = useSettings();
  const [value, setValue] = useState(initial);

  const isSupervisor = user?.role === ROLES.SUPERVISOR;
  const backDays = number(SETTING.supervisorBackdateDays, 7);

  const max = today();
  let min;
  if (isSupervisor) {
    const earliest = new Date();
    earliest.setDate(earliest.getDate() - backDays);
    min = toInputDate(earliest);
  }

  let error = "";
  if (!value) {
    error = "Select the collection date";
  } else if (daysBetween(today(), value) > 0) {
    error = "The collection date cannot be in the future";
  } else if (isSupervisor && daysBetween(value, today()) > backDays) {
    error = `You can enter a collection date up to ${backDays} days back. Ask a Super Admin for anything older.`;
  }

  return { value, setValue, min, max, error, isSupervisor, backDays };
}
