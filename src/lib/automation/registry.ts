import { detectJobSource } from "@/lib/jobs/types";
import { GreenhouseAutomator } from "./greenhouse";
import { LeverAutomator } from "./lever";
import { AshbyAutomator } from "./ashby";
import { WorkdayAutomator } from "./workday";
import type { PlatformAutomator } from "./base";

const automators: PlatformAutomator[] = [
  new GreenhouseAutomator(),
  new LeverAutomator(),
  new AshbyAutomator(),
  new WorkdayAutomator(),
];

export function getAutomatorForUrl(url: string): PlatformAutomator | null {
  return automators.find((a) => a.canHandle(url)) || null;
}

export function getAutomatorForSource(source: string): PlatformAutomator | null {
  return automators.find((a) => a.platform === source) || null;
}

export function getAllAutomators() {
  return automators;
}

export { GreenhouseAutomator, LeverAutomator, AshbyAutomator, WorkdayAutomator };
