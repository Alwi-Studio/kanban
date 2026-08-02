import api from "./api";
import type { RewardLogNetwork, RewardLogResponse } from "../types";

export async function getRewardLogs(params: {
  network: RewardLogNetwork;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<RewardLogResponse> {
  const { data } = await api.get("/reward-logs", { params });
  return data as RewardLogResponse;
}
