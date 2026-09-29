import type { SVGProps } from "react";
import type { Topic } from "@/lib/news";
import {
  BallIcon,
  BriefcaseIcon,
  ChipIcon,
  ClapperIcon,
  CodeIcon,
  FlagIcon,
  FlaskIcon,
  GlobeIcon,
  HealthIcon,
  RssIcon,
  SparkleIcon,
  TrendingIcon,
} from "./stack-icons";

const ICONS: Record<Topic, (p: SVGProps<SVGSVGElement> & { size?: number }) => React.ReactNode> = {
  top: TrendingIcon,
  india: FlagIcon,
  world: GlobeIcon,
  tech: ChipIcon,
  ai: SparkleIcon,
  dev: CodeIcon,
  business: BriefcaseIcon,
  science: FlaskIcon,
  sports: BallIcon,
  entertainment: ClapperIcon,
  health: HealthIcon,
  mine: RssIcon,
};

// One icon per News topic (chips, profile interests).
export function TopicIcon({ topic, ...p }: SVGProps<SVGSVGElement> & { size?: number; topic: Topic }) {
  const Icon = ICONS[topic];
  return <Icon {...p} />;
}
