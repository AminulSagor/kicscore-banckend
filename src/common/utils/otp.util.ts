export function generateFourDigitOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
