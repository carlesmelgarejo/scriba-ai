export function ProcessingWarning() {
  return (
    <p className="processing-warning">
      <span aria-hidden>⚠️</span>
      <span>
        Mentre dura el procés, no tanquis l&apos;aplicació ni deixis que el
        dispositiu es posi en repòs (bloqueig de pantalla).
      </span>
    </p>
  );
}
