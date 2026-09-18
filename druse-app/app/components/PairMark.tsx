export default function PairMark({
  image,
  className,
}: {
  image?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative h-10 w-[54px] shrink-0 ${className ?? ""}`}>
      <div className="absolute top-0 left-0 h-10 w-10 overflow-hidden rounded-full bg-[#141210] ring-2 ring-[#100f0c]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/eth.svg?v=3"
        alt=""
        className="absolute top-0 left-[18px] h-10 w-10 rounded-full ring-2 ring-[#100f0c]"
      />
    </div>
  );
}
