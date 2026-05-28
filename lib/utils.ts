import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// --- Shadcn UI Utility ---
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- App Error ---
export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// --- Environment Helpers ---
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new AppError(`Missing required environment variable: ${key}`, 500);
  }
  return value;
}

// --- Password Utilities ---
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- Document Transformation ---
export function mongooseDocumentTransform(doc: any, ret: any) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.password;
  return ret;
}

// --- Normalization ---
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export function normalizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

// --- Currency ---
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// --- Slugify ---
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// --- ID Generation ---
export function generateId(length: number = 12): string {
  return crypto.randomBytes(length).toString('hex');
}

// --- Secure Password Generation ---
export function generateSecurePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|';
  
  const allCharacters = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allCharacters[Math.floor(Math.random() * allCharacters.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// --- Transaction Helpers ---
export function calculateLineTotal({ quantity, unitPrice, discountAmount, taxAmount }: {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
}): number {
  return roundCurrency((quantity * unitPrice) - discountAmount + taxAmount);
}

export async function generateTransactionNumber(
  type: string,
  ownerId: string,
  prefixOverride?: string,
  sequenceNumber?: number,
): Promise<string> {
  const prefix = prefixOverride || type.substring(0, 3).toUpperCase();
  const normalizedPrefix = prefix.replace(/[-\s]+$/, '');

  if (typeof sequenceNumber === 'number' && Number.isFinite(sequenceNumber)) {
    return `${prefix}${sequenceNumber}`;
  }

  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `${normalizedPrefix}-${timestamp}-${random}`;
}

// --- Number to Words (Indian Numbering System) ---
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertBelow1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    return ones[hundreds] + ' Hundred' + (remainder !== 0 ? ' ' + convertBelow1000(remainder) : '');
  };

  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);

  // Indian numbering: lakh (100,000), crore (10,000,000)
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const remaining = whole % 1000;

  const parts: string[] = [];

  if (crore > 0) parts.push(convertBelow1000(crore) + ' Crore');
  if (lakh > 0) parts.push(convertBelow1000(lakh) + ' Lakh');
  if (thousand > 0) parts.push(convertBelow1000(thousand) + ' Thousand');
  if (remaining > 0) parts.push(convertBelow1000(remaining));

  let result = parts.join(' ');

  if (fraction > 0) {
    result += ' and ' + convertBelow1000(fraction) + ' Paise';
  }

  return result + ' Only';
}

// --- Debounce ---
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
