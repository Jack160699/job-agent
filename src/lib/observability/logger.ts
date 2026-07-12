export function logStructured(
  component: string,
  event: string,
  data: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info"
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    component,
    event,
    ...data,
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
