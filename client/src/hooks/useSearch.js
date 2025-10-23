import { useState } from "react";
export default function useSearch() {
  const [q, setQ] = useState("");
  return { q, setQ };
}
