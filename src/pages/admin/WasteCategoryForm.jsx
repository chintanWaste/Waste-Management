import { useEffect, useMemo, useRef } from "react";
import Button from "../../components/common/Button";
import { SelectInput, TextInput } from "../../components/common/Field";
import { Banner } from "../../components/common/States";
import { SETTING } from "../../config/appConfig";
import { WASTE_CATEGORIES } from "../../config/driveSchema";
import { useSettings } from "../../context/SettingsContext";
import { useToast } from "../../context/ToastContext";
import { useForm } from "../../hooks/useForm";
import {
  CERTIFICATE_REQUIREMENTS, STATUSES, UNITS,
  createCategory, nextCategoryId, updateCategory,
} from "../../services/categoryService";
import * as r from "../../utils/fieldRules";

export const EMPTY_CATEGORY = {
  Waste_Stream: "", Material_Group: "", Waste_Category: "",
  Unit: "Kg", Certificate_Requirement: "Required", Status: "Active",
};

/** Fill the form from a Waste_Categories row, for editing. */
export function categoryToForm(row = {}) {
  const out = { ...EMPTY_CATEGORY };
  for (const key of Object.keys(EMPTY_CATEGORY)) {
    out[key] = String(row[key] ?? "") || EMPTY_CATEGORY[key];
  }
  return out;
}

/**
 * A category or material group name.
 *
 * Deliberately looser than fieldRules.placeName: the master's own names carry
 * en dashes, slashes and brackets — "PET Bottles – up to 1 L", "Office / File
 * Paper (White Record)" — which a stricter pattern would reject. A pipe is the
 * one character ruled out, because pipes separate values in the Settings tab.
 */
const materialName = (label, { min = 2, max = 80 } = {}) => (value) => {
  const text = String(value ?? "").trim();
  if (!text) return `${label} is required`;
  if (text.length < min) return `${label} is too short`;
  if (text.length > max) return `${label} must be ${max} characters or fewer`;
  if (text.includes("|")) return `${label} cannot contain a pipe (|)`;
  if (!/[A-Za-z]{2}/.test(text)) return `${label} must contain letters`;
  return "";
};

/**
 * Create or edit a waste category — specification sections 4.2 and 17.3.
 *
 * Passing `category` switches to editing that row: the id and serial number
 * are fixed, and Status becomes editable so a category that has been used can
 * be deactivated instead of deleted.
 */
export default function WasteCategoryForm({
  category, rows = [], streams = [], groups = [], onSaved, onCancel, onBusyChange,
}) {
  const { list } = useSettings();
  const toast = useToast();

  const editing = Boolean(category);
  const editId = category?.[WASTE_CATEGORIES.idColumn] || "";

  /**
   * The configured streams, plus any the master already uses.
   *
   * A stream could have been removed from the Settings list after categories
   * were filed under it; leaving it out here would make an existing category
   * fail validation the moment it was opened for editing.
   */
  const streamOptions = useMemo(() => {
    const configured = list(SETTING.wasteStreams);
    return [...new Set([...configured, ...streams, category?.Waste_Stream].filter(Boolean))];
  }, [list, streams, category]);

  const initialValues = useMemo(
    () => (editing ? categoryToForm(category) : EMPTY_CATEGORY),
    [editing, category]
  );

  const form = useForm({
    initialValues,
    rules: {
      Waste_Stream: r.choice("Waste Stream", streamOptions),
      Material_Group: materialName("Material Group", { max: 60 }),
      Waste_Category: materialName("Waste Category"),
      Unit: r.choice("Unit", UNITS),
      Certificate_Requirement: r.choice("Certificate Requirement", CERTIFICATE_REQUIREMENTS),
      Status: editing ? r.choice("Status", STATUSES) : () => "",
    },
    onSubmit: async (values, { reset }) => {
      const { id, row } = editing
        ? await updateCategory({ categoryId: editId, values, rows })
        : await createCategory({ values, rows });

      reset();
      toast.success(
        editing ? `${id} updated` : `${id} created`,
        editing
          ? `${values.Waste_Category} is saved.`
          : `${values.Waste_Category} is now available in inward entry and dispatch.`
      );
      onSaved?.({ id, row });
    },
  });

  const { field, isValid, submitting, submitError, reset } = form;

  useEffect(() => {
    onBusyChange?.(submitting);
  }, [submitting, onBusyChange]);

  const errorRef = useRef(null);
  useEffect(() => {
    if (!submitError) return;
    errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    toast.error(editing ? "Category not updated" : "Category not created", submitError);
  }, [submitError, toast, editing]);

  const cancel = () => {
    reset();
    onCancel?.();
  };

  const groupListId = "waste-category-material-groups";

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      {submitError && (
        <div ref={errorRef} style={{ marginBottom: 16 }}>
          <Banner tone="danger">{submitError}</Banner>
        </div>
      )}

      {editing && (
        <div style={{ marginBottom: 16 }}>
          <Banner tone="info">
            Entries already recorded under this category keep the wording they were
            saved with — renaming it reads through to new entries only. The figures
            are unaffected either way, because every line is filed by {editId}, not
            by name.
          </Banner>
        </div>
      )}

      <div className="formgrid">
        <TextInput
          label="Category ID"
          value={editing ? editId : nextCategoryId(rows)}
          disabled
          hint={editing ? "An id never changes" : "Generated automatically"}
        />
        <TextInput
          label="Serial No"
          value={editing ? String(category?.Serial_No ?? "") : "Next in the master"}
          disabled
          hint="Sets the order categories are listed in"
        />

        <SelectInput label="Waste Stream" required options={streamOptions} {...field("Waste_Stream")} />

        <TextInput
          label="Material Group"
          required
          list={groupListId}
          placeholder="Paper, Plastic, Organic…"
          hint="Pick an existing group or type a new one — certificates are issued per group"
          {...field("Material_Group")}
        />
        <datalist id={groupListId}>
          {groups.map((group) => (
            <option key={group} value={group} />
          ))}
        </datalist>

        <div className="formgrid--full">
          <TextInput
            label="Waste Category"
            required
            placeholder="Cardboard (Gatta)"
            hint="Must be unique within its material group"
            {...field("Waste_Category")}
          />
        </div>

        <SelectInput label="Unit" required options={UNITS} {...field("Unit")} />
        <SelectInput
          label="Certificate Requirement"
          required
          options={CERTIFICATE_REQUIREMENTS}
          hint="Whether dispatching this category needs a vendor certificate"
          {...field("Certificate_Requirement")}
        />

        {editing && (
          <SelectInput
            label="Status"
            required
            options={STATUSES}
            hint="Inactive keeps the history but stops it being offered in new entries"
            {...field("Status")}
          />
        )}
      </div>

      <div className="formactions">
        <Button type="button" variant="secondary" onClick={cancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting
            ? (editing ? "Saving…" : "Creating…")
            : (editing ? "Save changes" : "Create category")}
        </Button>
      </div>
    </form>
  );
}
