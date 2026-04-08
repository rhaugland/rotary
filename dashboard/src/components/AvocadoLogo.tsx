export default function AvocadoLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer avocado shape */}
      <ellipse cx="32" cy="36" rx="20" ry="26" fill="#4A7C59" />
      {/* Inner lighter flesh */}
      <ellipse cx="32" cy="38" rx="14" ry="19" fill="#C5D99E" />
      {/* Pit */}
      <circle cx="32" cy="42" r="8" fill="#6B4226" />
      {/* Pit highlight */}
      <circle cx="30" cy="40" r="2.5" fill="#8B5E3C" opacity="0.6" />
    </svg>
  );
}
