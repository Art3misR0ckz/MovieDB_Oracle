// We have no poster images in the database, so each movie gets a simple
// coloured tile made from its title (same title -> same colour).
export default function Poster({ title, className = '' }) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const style = {
    background: `linear-gradient(150deg, hsl(${hash} 45% 32%), hsl(${(hash + 40) % 360} 50% 14%))`,
  };
  return (
    <div style={style} className={`flex items-end rounded-lg p-3 ${className}`}>
      <span className="font-display text-lg leading-tight text-white/90 drop-shadow">{title}</span>
    </div>
  );
}
