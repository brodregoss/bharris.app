export default function AppLogo({ className = '' }) {
  const base = import.meta.env.BASE_URL;
  return (
    <>
      <img
        src={`${base}logo-light.png?v=7`}
        alt=""
        draggable={false}
        className={`${className} dark:hidden`}
      />
      <img
        src={`${base}logo.png?v=7`}
        alt=""
        draggable={false}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
