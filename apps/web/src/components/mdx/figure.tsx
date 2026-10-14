import Image from "next/image";

/** Image with an optional caption (kit: 6px radius, 14px caption 16px below). */
export interface FigureProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export function Figure({ src, alt, width, height, caption }: FigureProps) {
  return (
    <figure className="mdx-figure">
      <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 768px) 680px, 88vw" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
