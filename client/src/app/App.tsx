import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CartDrawer } from '@/components/cart/CartDrawer'
import { LocationPicker } from '@/features/location/LocationPicker'
import { StoreTransition } from '@/components/transition/StoreTransition'
import Landing from '@/pages/Landing'
import NotFound from '@/pages/NotFound'
import { ErrorBoundary } from './ErrorBoundary'
import { CartSync } from './CartSync'
import { StoresSync } from './StoresSync'

const DiscoveryPage = lazy(() => import('@/features/discovery/DiscoveryPage'))
const StorePage = lazy(() => import('@/pages/StorePage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const MissionsPage = lazy(() => import('@/pages/MissionsPage'))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'))
const OrderPage = lazy(() => import('@/pages/OrderPage'))
const OrdersPage = lazy(() => import('@/pages/OrdersPage'))
const OwnerLogin = lazy(() => import('@/features/owner/OwnerLogin'))
const OwnerLayout = lazy(() => import('@/features/owner/OwnerLayout'))
const OwnerDashboard = lazy(() => import('@/features/owner/OwnerDashboard'))
const OwnerOrders = lazy(() => import('@/features/owner/OwnerOrders'))
const OwnerInventory = lazy(() => import('@/features/owner/OwnerInventory'))
const OwnerProduct = lazy(() => import('@/features/owner/OwnerProduct'))
const OwnerProductNew = lazy(() => import('@/features/owner/OwnerProductNew'))
const OwnerExpiry = lazy(() => import('@/features/owner/OwnerExpiry'))
const OwnerAlerts = lazy(() => import('@/features/owner/OwnerAlerts'))
const OwnerSettings = lazy(() => import('@/features/owner/OwnerSettings'))
const OwnerActivity = lazy(() => import('@/features/owner/OwnerActivity'))
const staff = () => import('@/features/staff/StaffFrame')
const admin = () => import('@/features/admin/AdminPages')
const DeliveryLogin = lazy(() => staff().then((m) => ({ default: () => <m.StaffLogin portal={m.DELIVERY_PORTAL} /> })))
const DeliveryFrame = lazy(() => staff().then((m) => ({ default: () => <m.StaffFrame portal={m.DELIVERY_PORTAL} /> })))
const DeliveryPortal = lazy(() => import('@/features/delivery/DeliveryPortal'))
const ADMIN_NAV = [
  ['/admin', 'Overview', true],
  ['/admin/stores', 'Stores', false],
  ['/admin/orders', 'Orders', false],
  ['/admin/freshness', 'Freshness', false],
  ['/admin/rules', 'Rules', false],
  ['/admin/activity', 'Activity', false],
] as const
const AdminLogin = lazy(() => staff().then((m) => ({ default: () => <m.StaffLogin portal={m.ADMIN_PORTAL} /> })))
const AdminFrame = lazy(() => staff().then((m) => ({ default: () => <m.StaffFrame portal={m.ADMIN_PORTAL} nav={ADMIN_NAV} /> })))
const AdminOverview = lazy(() => admin().then((m) => ({ default: m.AdminOverview })))
const AdminStores = lazy(() => admin().then((m) => ({ default: m.AdminStores })))
const AdminOrders = lazy(() => admin().then((m) => ({ default: m.AdminOrders })))
const AdminCompliance = lazy(() => admin().then((m) => ({ default: m.AdminCompliance })))
const AdminRules = lazy(() => admin().then((m) => ({ default: m.AdminRules })))
const AdminActivity = lazy(() => admin().then((m) => ({ default: m.AdminActivity })))

/** Shown only on the static GitHub Pages build, so nobody mistakes it for a live service. */
function StaticDemoNotice() {
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem('thulir.staticNotice') !== 'seen'
    } catch {
      return true
    }
  })
  if (!open) return null
  return (
    <div role="note" className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl items-start gap-3 border border-terracotta bg-cream p-3 text-[0.85rem] text-charcoal shadow-lg sm:left-4 sm:right-auto">
      <p>
        <strong className="text-forest">Static demo.</strong> The Thulir server runs inside this browser tab — stores, products, orders and payments are
        fictional, and everything resets when you reload.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem('thulir.staticNotice', 'seen')
          } catch {
            /* private mode */
          }
          setOpen(false)
        }}
        className="min-h-11 shrink-0 border border-forest/40 px-3 text-forest hover:bg-forest/10"
      >
        OK
      </button>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <StoresSync />
        <CartSync />
        <Suspense fallback={<div className="min-h-dvh bg-forest" />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/discover" element={<DiscoveryPage />} />
            <Route path="/store/:slug" element={<StorePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/missions" element={<MissionsPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/owner/login" element={<OwnerLogin />} />
            <Route path="/owner" element={<OwnerLayout />}>
              <Route index element={<OwnerDashboard />} />
              <Route path="orders" element={<OwnerOrders />} />
              <Route path="inventory" element={<OwnerInventory />} />
              <Route path="inventory/new" element={<OwnerProductNew />} />
              <Route path="inventory/:pid" element={<OwnerProduct />} />
              <Route path="expiry" element={<OwnerExpiry />} />
              <Route path="alerts" element={<OwnerAlerts />} />
              <Route path="settings" element={<OwnerSettings />} />
              <Route path="activity" element={<OwnerActivity />} />
            </Route>
            <Route path="/delivery/login" element={<DeliveryLogin />} />
            <Route path="/delivery" element={<DeliveryFrame />}>
              <Route index element={<DeliveryPortal />} />
            </Route>
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminFrame />}>
              <Route index element={<AdminOverview />} />
              <Route path="stores" element={<AdminStores />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="freshness" element={<AdminCompliance />} />
              <Route path="rules" element={<AdminRules />} />
              <Route path="activity" element={<AdminActivity />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <LocationPicker />
        <CartDrawer />
        <StoreTransition />
        {import.meta.env.VITE_STATIC_API === '1' && <StaticDemoNotice />}
      </BrowserRouter>
    </ErrorBoundary>
  )
}
