/** True when the project should use urgent (red) styling in the UI. */
export function isHighProjectPriority(priority: string): boolean {
  const p = priority.toLowerCase();
  return p === "high" || p === "critical";
}
