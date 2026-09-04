export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: number, _currency = "PKR") {
  const num = Number(value) || 0;
  return `Rs ${num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function safeNextPath(value: string | null | undefined, fallback = "/account") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
