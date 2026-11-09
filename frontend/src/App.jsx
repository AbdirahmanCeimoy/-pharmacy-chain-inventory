import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import LandingPage from './pages/LandingPage.jsx';
import ReportsPage from './pages/reports/ReportsPage.jsx';
import StockCountsListPage from './pages/stock-counts/StockCountsListPage.jsx';
import StockCountDetailPage from './pages/stock-counts/StockCountDetailPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MedicinesListPage from './pages/medicines/MedicinesListPage.jsx';
import SuppliersListPage from './pages/suppliers/SuppliersListPage.jsx';
import PurchaseOrdersListPage from './pages/purchase-orders/PurchaseOrdersListPage.jsx';
import PurchaseOrderCreatePage from './pages/purchase-orders/PurchaseOrderCreatePage.jsx';
import PurchaseOrderDetailPage from './pages/purchase-orders/PurchaseOrderDetailPage.jsx';
import PurchaseOrderReceivePage from './pages/purchase-orders/PurchaseOrderReceivePage.jsx';
import BatchesExpiryPage from './pages/batches/BatchesExpiryPage.jsx';
import PosPage from './pages/pos/PosPage.jsx';
import ReceiptPage from './pages/pos/ReceiptPage.jsx';
import ReturnsPage from './pages/returns/ReturnsPage.jsx';
import TransfersListPage from './pages/transfers/TransfersListPage.jsx';
import CreateTransferPage from './pages/transfers/CreateTransferPage.jsx';
import TransferDetailPage from './pages/transfers/TransferDetailPage.jsx';
import ReorderPage from './pages/reorder/ReorderPage.jsx';
import AppShell from './components/layout/AppShell.jsx';

function Protected({ children }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return <div className="grid min-h-full place-items-center text-ink-secondary">Loading...</div>;
  }
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

function P({ children }) {
  return <Protected>{children}</Protected>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route
            path="/reports"
            element={
              <P>
                <ReportsPage />
              </P>
            }
          />
          <Route
            path="/inventory/stock-counts"
            element={
              <P>
                <StockCountsListPage />
              </P>
            }
          />
          <Route
            path="/inventory/stock-counts/:id"
            element={
              <P>
                <StockCountDetailPage />
              </P>
            }
          />
          <Route
            path="/"
            element={
              <P>
                <DashboardPage />
              </P>
            }
          />
          <Route
            path="/inventory/medicines"
            element={
              <P>
                <MedicinesListPage />
              </P>
            }
          />
          <Route
            path="/inventory/suppliers"
            element={
              <P>
                <SuppliersListPage />
              </P>
            }
          />
          <Route
            path="/inventory/purchase-orders"
            element={
              <P>
                <PurchaseOrdersListPage />
              </P>
            }
          />
          <Route
            path="/inventory/purchase-orders/new"
            element={
              <P>
                <PurchaseOrderCreatePage />
              </P>
            }
          />
          <Route
            path="/inventory/purchase-orders/:id"
            element={
              <P>
                <PurchaseOrderDetailPage />
              </P>
            }
          />
          <Route
            path="/inventory/purchase-orders/:id/receive"
            element={
              <P>
                <PurchaseOrderReceivePage />
              </P>
            }
          />
          <Route
            path="/inventory/batches"
            element={
              <P>
                <BatchesExpiryPage />
              </P>
            }
          />
          <Route
            path="/inventory/reorder"
            element={
              <P>
                <ReorderPage />
              </P>
            }
          />
          <Route
            path="/pos"
            element={
              <P>
                <PosPage />
              </P>
            }
          />
          <Route
            path="/pos/receipts/:id"
            element={
              <P>
                <ReceiptPage />
              </P>
            }
          />
          <Route
            path="/returns"
            element={
              <P>
                <ReturnsPage />
              </P>
            }
          />
          <Route
            path="/transfers"
            element={
              <P>
                <TransfersListPage />
              </P>
            }
          />
          <Route
            path="/transfers/new"
            element={
              <P>
                <CreateTransferPage />
              </P>
            }
          />
          <Route
            path="/transfers/:id"
            element={
              <P>
                <TransferDetailPage />
              </P>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
