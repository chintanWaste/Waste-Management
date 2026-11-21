/**
 * Helpers for Google Drive files referenced from the Sheet.
 *
 * Every file column stores a bare Drive FILE ID (e.g. "1AbC...xyz"), so that
 * preview, thumbnail and download links can all be built from the same value.
 * A column ending in _File_Ids holds several ids separated by "|".
 */

const ID_FROM_URL = /[-\w]{25,}/;

/** Accepts an id or any Drive URL and returns the bare file id. */
export function toFileId(value) {
  if (!value) return "";
  const str = String(value).trim();
  const match = str.match(ID_FROM_URL);
  return match ? match[0] : "";
}

/** Split a _File_Ids cell into an array of ids. */
export function toFileIds(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,\n]/)
    .map(toFileId)
    .filter(Boolean);
}

/** Inline preview, works in an <iframe> for PDFs and images. */
export const previewUrl = (value) => {
  const id = toFileId(value);
  return id ? `https://drive.google.com/file/d/${id}/preview` : "";
};

/** Direct image URL, usable as an <img src>. */
export const imageUrl = (value, width = 800) => {
  const id = toFileId(value);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${width}` : "";
};

/** Forces a download rather than opening the Drive viewer. */
export const downloadUrl = (value) => {
  const id = toFileId(value);
  return id ? `https://drive.google.com/uc?export=download&id=${id}` : "";
};

/** Opens the file in Drive itself (for the Super Admin). */
export const viewUrl = (value) => {
  const id = toFileId(value);
  return id ? `https://drive.google.com/file/d/${id}/view` : "";
};

/** Link to the Drive folder that holds the uploads. */
export const folderUrl = (folderId) =>
  folderId ? `https://drive.google.com/drive/folders/${folderId}` : "";
