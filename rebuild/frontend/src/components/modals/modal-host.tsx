'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ContactType, InvoiceKind, ReturnKind, ShipmentDto, ShipStatus, StockCountDto } from '@mk/shared';
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
import { ProductToolModal, type ProductToolSpec } from './product-tools';
import { ProductCard, ProductCardModal, type ProductCardSpec } from './product-card';
import { MarketModal } from './market-prices';
import { ContactToolModal, type ContactToolSpec } from './contact-tools';
import { CountSessions } from './count-sessions';
import { AlertsModal, DayReportModal } from './alerts-modals';
import { TodayDetail, type TodayKind } from './today-detail';
import { ContactReportModal } from '../reports-extras';
import { PurchaseImport } from './purchase-import';

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
  | ProductToolSpec
  | ProductCardSpec
  | { kind: 'market' }
  | { kind: 'countSessions' }
  | { kind: 'alerts' }
  | { kind: 'dayReport' }
  | { kind: 'todayDetail'; k: TodayKind }
  | { kind: 'contactReport'; name: string; type: ContactType; from?: string; to?: string }
  | ContactToolSpec
  | { kind: 'purchImport' }
  | { kind: 'invoice'; id: string }
  | { kind: 'return'; type: ReturnKind }
  | { kind: 'contact'; id?: string; type?: ContactType }
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
        content = spec.id ? <ProductCard key={spec.id} id={spec.id} /> : <ProductModal key="new" />;
        break;
      case 'productEdit':
        content = <ProductModal key={`e-${spec.id}`} id={spec.id} />;
        break;
      case 'productDetails':
      case 'productSend':
      case 'productVariant':
        content = <ProductCardModal spec={spec} />;
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
        content = <ContactModal key={spec.id ?? `new-${spec.type ?? ''}`} id={spec.id} type={spec.type} />;
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
      case 'printAsk':
      case 'ctChooser':
      case 'missing':
      case 'invNotes':
        content = <ContactToolModal spec={spec} />;
        break;
      case 'contactReport':
        content = <ContactReportModal key={`${spec.type}-${spec.name}-${spec.from}-${spec.to}`} name={spec.name} type={spec.type} from={spec.from} to={spec.to} />;
        break;
      case 'todayDetail':
        content = <TodayDetail key={spec.k} k={spec.k} />;
        break;
      case 'alerts':
        content = <AlertsModal />;
        break;
      case 'dayReport':
        content = <DayReportModal />;
        break;
      case 'countSessions':
        content = <CountSessions />;
        break;
      case 'market':
        content = <MarketModal />;
        break;
      case 'purchImport':
        content = <PurchaseImport />;
        break;
      case 'bulkPrice':
      case 'printProducts':
      case 'labels':
      case 'linkBarcode':
      case 'oldGoods':
      case 'importFile':
      case 'split':
        content = <ProductToolModal spec={spec} />;
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
