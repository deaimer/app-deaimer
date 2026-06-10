export function generateTempPassword(): string {
  const symbols = "!@#$%^&*-_+=?";
  const numbers = "0123456789";
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
  const pool = symbols + numbers + letters;

  const chars: string[] = [
    symbols[Math.floor(Math.random() * symbols.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
  ];

  for (let i = 2; i < 12; i++) {
    chars.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 20) return "Password must be at most 20 characters.";
  if (!/[0-9!@#$%^&*\-_+=?]/.test(password)) {
    return "Password must include at least one number or symbol.";
  }
  return null;
}
