"use client";

import { User } from "firebase/auth";

export const GUEST_FREE_PRD_LIMIT = 3;
export const USER_FREE_PRD_LIMIT = 5;
export const USER_FREE_CHAT_LIMIT = 10;

export interface QuotaStatus {
  canGeneratePRD: boolean;
  prdCount: number;
  prdLimit: number;
  extraPrdQuota: number;
  requiresAuth: boolean;
  requiresPayment: boolean;
  canUseChatbot: boolean;
  chatCount: number;
  chatLimit: number;
  chatReason?: "auth_required" | "limit_reached";
}

export function getPRDQuotaStatus(user: User | null): QuotaStatus {
  if (typeof window === "undefined") {
    return {
      canGeneratePRD: true,
      prdCount: 0,
      prdLimit: user ? USER_FREE_PRD_LIMIT : GUEST_FREE_PRD_LIMIT,
      extraPrdQuota: 0,
      requiresAuth: false,
      requiresPayment: false,
      canUseChatbot: !!user,
      chatCount: 0,
      chatLimit: USER_FREE_CHAT_LIMIT,
    };
  }

  // Chatbot Access & Quota
  let chatCount = 0;
  let canUseChatbot = false;
  let chatReason: "auth_required" | "limit_reached" | undefined = undefined;

  if (!user) {
    canUseChatbot = false;
    chatReason = "auth_required";
  } else {
    const savedChat = localStorage.getItem(`buatprd_chat_count_${user.uid}`);
    chatCount = savedChat ? parseInt(savedChat, 10) : 0;
    if (chatCount >= USER_FREE_CHAT_LIMIT) {
      canUseChatbot = false;
      chatReason = "limit_reached";
    } else {
      canUseChatbot = true;
    }
  }

  // PRD Access & Quota
  if (!user) {
    // Guest User
    const savedCount = localStorage.getItem("buatprd_guest_prd_count");
    const prdCount = savedCount ? parseInt(savedCount, 10) : 0;
    const extraQuotaStr = localStorage.getItem("buatprd_guest_extra_quota");
    const extraPrdQuota = extraQuotaStr ? parseInt(extraQuotaStr, 10) : 0;

    const totalAllowed = GUEST_FREE_PRD_LIMIT + extraPrdQuota;
    const canGenerate = prdCount < totalAllowed;

    return {
      canGeneratePRD: canGenerate,
      prdCount,
      prdLimit: GUEST_FREE_PRD_LIMIT,
      extraPrdQuota,
      requiresAuth: prdCount >= GUEST_FREE_PRD_LIMIT && extraPrdQuota === 0,
      requiresPayment: prdCount >= totalAllowed,
      canUseChatbot,
      chatCount,
      chatLimit: USER_FREE_CHAT_LIMIT,
      chatReason,
    };
  } else {
    // Logged-in User
    const savedCount = localStorage.getItem(`buatprd_user_prd_count_${user.uid}`);
    const prdCount = savedCount ? parseInt(savedCount, 10) : 0;
    const extraQuotaStr = localStorage.getItem(`buatprd_user_extra_quota_${user.uid}`);
    const extraPrdQuota = extraQuotaStr ? parseInt(extraQuotaStr, 10) : 0;

    const totalAllowed = USER_FREE_PRD_LIMIT + extraPrdQuota;
    const canGenerate = prdCount < totalAllowed;

    return {
      canGeneratePRD: canGenerate,
      prdCount,
      prdLimit: USER_FREE_PRD_LIMIT,
      extraPrdQuota,
      requiresAuth: false,
      requiresPayment: prdCount >= totalAllowed,
      canUseChatbot,
      chatCount,
      chatLimit: USER_FREE_CHAT_LIMIT,
      chatReason,
    };
  }
}

export function incrementPRDCount(user: User | null): number {
  if (typeof window === "undefined") return 0;

  if (!user) {
    const savedCount = localStorage.getItem("buatprd_guest_prd_count");
    const current = savedCount ? parseInt(savedCount, 10) : 0;
    const newCount = current + 1;
    localStorage.setItem("buatprd_guest_prd_count", newCount.toString());
    return newCount;
  } else {
    const key = `buatprd_user_prd_count_${user.uid}`;
    const savedCount = localStorage.getItem(key);
    const current = savedCount ? parseInt(savedCount, 10) : 0;
    const newCount = current + 1;
    localStorage.setItem(key, newCount.toString());
    return newCount;
  }
}

export function incrementChatCount(user: User | null): number {
  if (typeof window === "undefined" || !user) return 0;

  const key = `buatprd_chat_count_${user.uid}`;
  const savedCount = localStorage.getItem(key);
  const current = savedCount ? parseInt(savedCount, 10) : 0;
  const newCount = current + 1;
  localStorage.setItem(key, newCount.toString());
  return newCount;
}

export function addExtraPRDQuota(user: User | null, amountAdded = 5) {
  if (typeof window === "undefined") return;

  if (!user) {
    const savedQuota = localStorage.getItem("buatprd_guest_extra_quota");
    const current = savedQuota ? parseInt(savedQuota, 10) : 0;
    localStorage.setItem("buatprd_guest_extra_quota", (current + amountAdded).toString());
  } else {
    const key = `buatprd_user_extra_quota_${user.uid}`;
    const savedQuota = localStorage.getItem(key);
    const current = savedQuota ? parseInt(savedQuota, 10) : 0;
    localStorage.setItem(key, (current + amountAdded).toString());
  }
}
