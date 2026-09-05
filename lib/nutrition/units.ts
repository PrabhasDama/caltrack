export const KG_TO_LB = 2.2046226218;
export function toKg(value: number, units: "imperial" | "metric") {
  return units === "imperial" ? value / KG_TO_LB : value;
}
export function fromKg(value: number, units: "imperial" | "metric") {
  return units === "imperial" ? value * KG_TO_LB : value;
}
export function toCm(value: number, units: "imperial" | "metric") {
  return units === "imperial" ? value * 2.54 : value;
}
export function formatWeight(kg: number, units: "imperial" | "metric") {
  return `${fromKg(kg, units).toFixed(1)} ${units === "imperial" ? "lb" : "kg"}`;
}
