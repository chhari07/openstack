import type { SVGProps } from "react";
import { ShelfIcon } from "./icons";
import {
  BrainIcon,
  BreakIcon,
  BuildingIcon,
  ChatIcon,
  DumbbellIcon,
  EarlyBirdIcon,
  EditIcon,
  GamepadIcon,
  HighlighterIcon,
  IdeaIcon,
  InTheZoneIcon,
  LearningIcon,
  MedalIcon,
  MixerIcon,
  NewspaperIcon,
  NightOwlIcon,
  OfflineIcon,
  PartyIcon,
  ReadingIcon,
  RocketIcon,
  SickIcon,
  SproutIcon,
  StreakIcon,
  TargetIcon,
  TravelIcon,
  WritingIcon,
} from "./stack-icons";

type P = SVGProps<SVGSVGElement> & { size?: number };

// Icons the profile refers to by name: statuses (lib/profile.ts), badges and
// reader types (lib/me-stats.ts).
const ICONS: Record<string, (p: P) => React.ReactNode> = {
  reading: ReadingIcon,
  "in-the-zone": InTheZoneIcon,
  learning: LearningIcon,
  writing: WritingIcon,
  building: BuildingIcon,
  break: BreakIcon,
  "night-owl": NightOwlIcon,
  "early-bird": EarlyBirdIcon,
  offline: OfflineIcon,
  chat: ChatIcon,
  rocket: RocketIcon,
  gamepad: GamepadIcon,
  dumbbell: DumbbellIcon,
  travel: TravelIcon,
  sick: SickIcon,
  party: PartyIcon,
  edit: EditIcon,
  highlighter: HighlighterIcon,
  idea: IdeaIcon,
  newspaper: NewspaperIcon,
  shelf: ShelfIcon,
  target: TargetIcon,
  medal: MedalIcon,
  streak: StreakIcon,
  brain: BrainIcon,
  mixer: MixerIcon,
  sprout: SproutIcon,
};

export function NamedIcon({ name, ...p }: P & { name: string }) {
  const Icon = ICONS[name] ?? ChatIcon;
  return <Icon {...p} />;
}
