import { useState } from "react";
export default function useContent() {
  const [items, setItems] = useState([]);
  return { items, setItems };
}
