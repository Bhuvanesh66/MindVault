import { api } from "./api";
export const search = (q) => api.get(`/search?q=${encodeURIComponent(q)}`);
