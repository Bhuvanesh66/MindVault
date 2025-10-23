import { api } from "./api";
export const fetchContent = () => api.get("/content");
