import { createFileRoute } from "@tanstack/react-router";
import { SalesList } from "./sales-pages";

export const Route = createFileRoute("/_authenticated/sales-pages/")({
  component: SalesList,
});