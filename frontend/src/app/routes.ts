import { createBrowserRouter } from "react-router";
import OrderPage from "./pages/OrderPage";
import AdminLayout from "./pages/admin/AdminLayout";
import LoginPage from "./pages/admin/LoginPage";
import DashboardPage from "./pages/admin/DashboardPage";
import MerchantsPage from "./pages/admin/MerchantsPage";
import OrdersAdminPage from "./pages/admin/OrdersAdminPage";
import SettingsAdminPage from "./pages/admin/SettingsAdminPage";
import ProductsPage from "./pages/admin/ProductsPage";
import RolesPage from "./pages/admin/RolesPage";
import MerchantPage from "./pages/MerchantPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: OrderPage,
  },
  {
    path: "/merchant",
    Component: MerchantPage,
  },
  {
    path: "/admin/login",
    Component: LoginPage,
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "merchants", Component: MerchantsPage },
      { path: "products", Component: ProductsPage },
      { path: "orders", Component: OrdersAdminPage },
      { path: "roles", Component: RolesPage },
      { path: "settings", Component: SettingsAdminPage },
    ],
  },
]);
