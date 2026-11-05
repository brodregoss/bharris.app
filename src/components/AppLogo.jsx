export default function AppLogo({ className = '' }) {
  return (
    <img
      src="/logo.png?v=4"
      alt=""
      draggable={false}
      className={className}
    />
  );
}
