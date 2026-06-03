export function getBooleanEnv(name: string, defaultValue = false): boolean {
  const value = process.env[name];

  if (value === undefined || value === null) {
    return defaultValue;
  }

  return String(value).toLowerCase().trim() === 'true';
}
