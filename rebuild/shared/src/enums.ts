export const ROLES = ['ADMIN', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const COMPANIES = ['MK', 'HY'] as const;
export type Company = (typeof COMPANIES)[number];

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'BAD_REQUEST',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const CONTACT_TYPES = ['CUSTOMER', 'SUPPLIER'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

export const INVOICE_KINDS = ['SALE', 'PURCHASE'] as const;
export type InvoiceKind = (typeof INVOICE_KINDS)[number];

export const INVOICE_STATUSES = ['ACTIVE', 'VOID'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAY_METHODS = ['CASH', 'INSTAPAY', 'WALLET', 'TRANSFER'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];

/** IN = money received (from a customer), OUT = money paid (to a supplier). */
export const PAYMENT_DIRECTIONS = ['IN', 'OUT'] as const;
export type PaymentDirection = (typeof PAYMENT_DIRECTIONS)[number];

export const RETURN_KINDS = ['SALE', 'PURCHASE'] as const;
export type ReturnKind = (typeof RETURN_KINDS)[number];

/** How a return is settled: money back from/to the drawer, or against the contact's balance. */
export const RETURN_SETTLEMENTS = ['CASH', 'BALANCE'] as const;
export type ReturnSettlement = (typeof RETURN_SETTLEMENTS)[number];

export const STOCK_REASONS = [
  'SALE',
  'PURCHASE',
  'SALE_RETURN',
  'PURCHASE_RETURN',
  'ADJUST',
  'INVOICE_EDIT',
  'INVOICE_VOID',
  'DAYBOOK',
  'COUNT',
] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'USER_CREATE',
  'USER_UPDATE',
  'USER_DEACTIVATE',
  'USER_PASSWORD_RESET',
  'SETTING_UPDATE',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'STOCK_ADJUST',
  'CONTACT_CREATE',
  'CONTACT_UPDATE',
  'CONTACT_DELETE',
  'INVOICE_CREATE',
  'INVOICE_UPDATE',
  'INVOICE_VOID',
  'PAYMENT_CREATE',
  'PAYMENT_CANCEL',
  'RETURN_CREATE',
  'EXPENSE_CREATE',
  'EXPENSE_UPDATE',
  'EXPENSE_DELETE',
  'DAYBOOK_ADD',
  'DAYBOOK_UPDATE',
  'DAYBOOK_DELETE',
  'DAYBOOK_POST',
  'DAYBOOK_DELIVER',
  'DAY_CLOSE',
  'STOCK_COUNT',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
