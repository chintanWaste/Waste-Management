export default function PageHeader({ title, description, actions }) {
  return (
    <div className="content__head u-row-between u-wrap">
      <div>
        <h1>{title}</h1>
        {description && (
          <p className="u-muted u-small" style={{ margin: "4px 0 0", maxWidth: 680 }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="u-row u-wrap">{actions}</div>}
    </div>
  );
}
