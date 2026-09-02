import type { Metadata } from "next";
import WatchClient from "./WatchClient";

export const metadata: Metadata = {
  title: "Franco Watch",
  description: "Premium smartwatch UI with analog clock complications.",
};

export default function WatchPage() {
  return <WatchClient />;
}
