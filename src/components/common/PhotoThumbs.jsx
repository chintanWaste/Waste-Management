import { useState } from "react";
import { ExternalLink, ImageOff } from "lucide-react";
import { imageUrl, imageUrlAlt, toFileIds, viewUrl } from "../../services/drive";

/**
 * The photos saved with a record, as thumbnails that open the file in Drive.
 *
 * A file column holds bare Drive file ids, so the thumbnail is built from the
 * id (services/drive.js). Drive serves that thumbnail only to someone allowed
 * to see the file: if the uploads folder is not shared, the image 403s. The
 * tile then falls back to a plain link rather than a broken image, so the
 * photo can still be opened by anyone with access to the Drive folder.
 */
function Thumb({ id, index, size }) {
  // Drive's thumbnail host, then Google's content host, then a plain link.
  const [attempt, setAttempt] = useState(0);
  const sources = [imageUrl(id, 200), imageUrlAlt(id, 200)];
  const src = sources[attempt];

  return (
    <a
      className={`thumb${src ? "" : " thumb--fallback"}`}
      style={{ width: size, height: size }}
      href={viewUrl(id)}
      target="_blank"
      rel="noreferrer"
      title={
        src
          ? `Photo ${index + 1}`
          : `Photo ${index + 1} — Drive will not show it here. Open it in Drive, ` +
            "or share the uploads folder as \"anyone with the link — viewer\"."
      }
    >
      {src ? (
        <img
          src={src}
          alt={`Photo ${index + 1}`}
          loading="lazy"
          onError={() => setAttempt((a) => a + 1)}
        />
      ) : (
        <ExternalLink size={13} aria-hidden="true" />
      )}
    </a>
  );
}

export default function PhotoThumbs({ value, max = 3, size = 34 }) {
  const ids = toFileIds(value);

  if (!ids.length) {
    return (
      <span className="u-row u-small u-muted" style={{ gap: 4 }} title="No photos were saved with this entry">
        <ImageOff size={13} aria-hidden="true" />
        None
      </span>
    );
  }

  const shown = ids.slice(0, max);

  return (
    <div className="thumbs">
      {shown.map((id, i) => (
        <Thumb key={id} id={id} index={i} size={size} />
      ))}
      {ids.length > shown.length && (
        <span className="u-small u-muted">+{ids.length - shown.length}</span>
      )}
    </div>
  );
}

/** For exports: one openable link per photo. */
export const photoLinks = (value) => toFileIds(value).map(viewUrl).join(" ");
