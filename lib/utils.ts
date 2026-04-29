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

// --- Transaction Helpers ---
export function calculateLineTotal({ quantity, unitPrice, discountAmount, taxAmount }: {
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
}): number {
  return roundCurrency((quantity * unitPrice) - discountAmount + taxAmount);
}

export async function generateTransactionNumber(type: string, ownerId: string): Promise<string> {
  const prefix = type.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `${prefix}-${timestamp}-${random}`;
}
