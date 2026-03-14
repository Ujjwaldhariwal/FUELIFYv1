import dynamic from "next/dynamic";

const FuelMap = dynamic(() => import("./MapCore").then((module) => module.MapCore), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#1a1a2e] skeleton-shimmer" />,
});

export default FuelMap;
export { FuelMap };
export * from "./types";
