import { getImageProps } from "next/image";

// A real app screenshot in a phone frame. When there's a dark screenshot too,
// it's shown on devices in dark mode.
export function PhoneShot({
  light,
  dark,
  width = 1080,
  height = 2400,
  alt,
  priority = false,
  className = "",
}: {
  light: string;
  dark?: string;
  width?: number;
  height?: number;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const common = { alt, width, height, sizes: "(min-width: 768px) 300px, 72vw", priority };
  const { props: img } = getImageProps({ ...common, src: light });
  const darkSet = dark ? getImageProps({ ...common, src: dark }).props : null;

  return (
    <picture
      className={`block overflow-hidden rounded-[2.2rem] border-[7px] border-[#111] bg-[#111] shadow-[0_30px_80px_rgb(0_0_0/0.22)] ${className}`}
    >
      {darkSet && <source media="(prefers-color-scheme: dark)" srcSet={darkSet.srcSet} sizes={darkSet.sizes} />}
      <img {...img} alt={alt} className="block h-auto w-full" />
    </picture>
  );
}
