'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { InvoiceKind, ReturnKind, ShipmentDto, ShipStatus, StockCountDto } from '@mk/shared';
import { QuickModal } from './quick-modal';
import { ProductModal } from './product-modal';
import { TransactionModal, type SalePreset } from './transaction-modal';
import { InvoiceView } from './invoice-view';
import { ReturnModal } from './return-modal';
import { ContactModal } from './contact-modal';
import { ContactFile } from './contact-file';
import { PaymentModal } from './payment-modal';
import { ExpenseModal } from './expense-modal';
import { ClosingHistory, ClosingModal } from './closing-modal';
import { CountResult } from './count-result';
import { QuoteView } from './quote-view';
import { ShipmentEdit, ShipPaid, ShipWho } from './shipment-modals';
import { Phase4Modal, type Phase4Spec } from './phase4-modals';

/** Every window the old system opened with openModal(), by name. */
export type ModalSpec =
  | { kind: 'quick' }
  | { kind: 'product'; id?: string }
  | { kind: 'transaction'; type: InvoiceKind; editId?: string; person?: string; contactId?: string; fromQuote?: string; preset?: SalePreset }
  | { kind: 'quote'; id?: string }
  | { kind: 'quoteView'; id: string }
  | { kind: 'shipEdit'; id?: string; invoiceId?: string }
  | { kind: 'shipWho'; s: ShipmentDto; next: ShipStatus }
  | { kind: 'shipPaid'; s: ShipmentDto }
  | Phase4Spec
  | { kind: 'invoice'; id: string }
  | { kind: 'return'; type: ReturnKind }
  | { kind: 'contact'; id?: string }
  | { kind: 'contactFile'; id: string }
  | { kind: 'payment'; contactId: string }
  | { kind: 'expense'; id?: string }
  | { kind: 'closing'; day?: string }
  | { kind: 'closingHistory' }
  | { kind: 'countResult'; count: StockCountDto };

interface Ctx {
  open: (m: ModalSpec) => void;
  close: () => void;
}

const ModalContext = createContext<Ctx>({ open: () => {}, close: () => {} });
export const useModal = () => useContext(ModalContext);

export function ModalHost({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<ModalSpec | null>(null);
  const close = useCallback(() => setSpec(null), []);
  const value = useMemo(() => ({ open: setSpec, close }), [close]);

  let content: ReactNode = null;
  if (spec) {
    switch (spec.kind) {
      case 'quick':
        content = <QuickModal />;
        break;
      case 'product':
        content = <ProductModal key={spec.id ?? 'new'} id={spec.id} />;
        break;
      case 'transaction':
        content = <TransactionModal key={`${spec.type}-${spec.editId ?? spec.fromQuote ?? 'new'}`} {...spec} />;
        break;
      case 'invoice':
        content = <InvoiceView key={spec.id} id={spec.id} />;
        break;
      case 'return':
        content = <ReturnModal key={spec.type} type={spec.type} />;
        break;
      case 'contact':
        content = <ContactModal key={spec.id ?? 'new'} id={spec.id} />;
        break;
      case 'contactFile':
        content = <ContactFile key={spec.id} id={spec.id} />;
        break;
      case 'payment':
        content = <PaymentModal key={spec.contactId} contactId={spec.contactId} />;
        break;
      case 'expense':
        content = <ExpenseModal key={spec.id ?? 'new'} id={spec.id} />;
        break;
      case 'closing':
        content = <ClosingModal day={spec.day} />;
        break;
      case 'closingHistory':
        content = <ClosingHistory />;
        break;
      case 'quote':
        content = <TransactionModal key={`q-${spec.id ?? 'new'}`} type="SALE" asQuote quoteId={spec.id} />;
        break;
      case 'quoteView':
        content = <QuoteView key={spec.id} id={spec.id} />;
        break;
      case 'shipEdit':
        content = <ShipmentEdit key={spec.id ?? spec.invoiceId ?? 'new'} id={spec.id} invoiceId={spec.invoiceId} />;
        break;
      case 'shipWho':
        content = <ShipWho s={spec.s} next={spec.next} />;
        break;
      case 'shipPaid':
        content = <ShipPaid s={spec.s} />;
        break;
      case 'countResult':
        content = <CountResult count={spec.count} />;
        break;
      default:
        content = <Phase4Modal spec={spec} />;
    }
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      {content}
    </ModalContext.Provider>
  );
}
