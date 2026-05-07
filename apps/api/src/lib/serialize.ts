export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function isoRequired(value: Date): string {
  return value.toISOString();
}
