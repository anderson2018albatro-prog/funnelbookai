import { createFileRoute } from "@tanstack/react-router";
import { EbooksList } from "./ebooks";

export const Route = createFileRoute("/_authenticated/ebooks/")({
  component: EbooksList,
});