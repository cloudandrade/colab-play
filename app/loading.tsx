export default function Loading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "color-mix(in srgb, var(--bg) 88%, transparent)",
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "2.5rem",
          height: "2.5rem",
          borderRadius: "999px",
          border: "3px solid color-mix(in srgb, var(--accent) 25%, transparent)",
          borderTopColor: "var(--accent)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
