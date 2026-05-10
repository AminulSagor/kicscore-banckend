import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashValue(value: string): Promise<string> {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export async function compareHash(
  plainValue: string,
  hashedValue: string,
): Promise<boolean> {
  return bcrypt.compare(plainValue, hashedValue);
}
