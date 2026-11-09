import {
  ArchiveBoxIcon,
  ArrowsPointingInIcon,
  BeakerIcon,
  CameraIcon,
  ChartBarIcon,
  CloudArrowDownIcon,
  Cog6ToothIcon,
  HomeIcon,
  PaintBrushIcon,
  PhotoIcon,
  PuzzlePieceIcon,
  RectangleGroupIcon,
  SwatchIcon,
  ViewfinderCircleIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { StudioIcon as StudioIconName } from "./navigation";

const ICONS: Record<StudioIconName, ComponentType<SVGProps<SVGSVGElement>>> = {
  home: HomeIcon,
  image: PhotoIcon,
  vector: ViewfinderCircleIcon,
  workshop: PuzzlePieceIcon,
  library: ArchiveBoxIcon,
  card: RectangleGroupIcon,
  flask: BeakerIcon,
  lut: SwatchIcon,
  camera: CameraIcon,
  chart: ChartBarIcon,
  merge: ArrowsPointingInIcon,
  cloud: CloudArrowDownIcon,
  settings: Cog6ToothIcon,
  palette: PaintBrushIcon,
};

export function StudioIcon({ name, className = "h-5 w-5" }: { name: StudioIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
