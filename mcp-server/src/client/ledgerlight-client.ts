import axios, { type AxiosInstance } from "axios";
import type { Config } from "../config";

let _instance: AxiosInstance | null = null;

export function getLedgerlightClient(config: Config): AxiosInstance {
  if (_instance) return _instance;

  _instance = axios.create({
    baseURL: config.BACKEND_URL,
    timeout: 15_000,
    headers: { "Content-Type": "application/json" },
  });

  return _instance;
}
