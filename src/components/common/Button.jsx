export default function Button({
  variant = "primary",
  size,
  block = false,
  icon,
  children,
  className = "",
  ...rest
}) {
  const classes = [
    "btn",
    `btn--${variant}`,
    size === "sm" ? "btn--sm" : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} {...rest}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
}
