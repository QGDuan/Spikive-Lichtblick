// SPDX-FileCopyrightText: Copyright (C) 2026 Spikive
// SPDX-License-Identifier: MPL-2.0

import { create } from "zustand";

import type { ManagerCommandRequest, ManagerCommandResult, ManagerCommandType } from "./types";

type ManagerCommandStore = {
  nextSeq: number;
  pendingRequest?: ManagerCommandRequest;
  publishingSeq?: number;
  lastPublishedSeq: number;
  attemptCount: number;
  lastFailure?: ManagerCommandResult;
  requestCommand: (droneId: string, commandType: ManagerCommandType) => ManagerCommandRequest;
  tryBeginPublish: (seq: number) => boolean;
  markPublishedAttempt: (seq: number) => void;
  markAcked: (requestId: string) => void;
  markFailed: (seq: number, message: string) => void;
};

export const useManagerCommandStore = create<ManagerCommandStore>((set, get) => ({
  nextSeq: 1,
  pendingRequest: undefined,
  publishingSeq: undefined,
  lastPublishedSeq: 0,
  attemptCount: 0,
  lastFailure: undefined,

  requestCommand: (droneId, commandType) => {
    const state = get();
    const seq = state.nextSeq;
    const request: ManagerCommandRequest = {
      seq,
      droneId,
      commandType,
      requestId: `spikive-${droneId}-${seq}-${Date.now().toString(36)}`,
      status: "pending",
      createdAtMs: Date.now(),
    };
    console.info(
      `[Spikive Manager] request ${commandType} drone=${droneId} seq=${seq} request_id=${request.requestId}`,
    );
    set({
      nextSeq: seq + 1,
      pendingRequest: request,
      publishingSeq: undefined,
      attemptCount: 0,
      lastFailure: undefined,
    });
    return request;
  },

  tryBeginPublish: (seq) => {
    const state = get();
    const request = state.pendingRequest;
    if (
      request == undefined ||
      request.seq !== seq ||
      request.status !== "pending" ||
      seq <= state.lastPublishedSeq ||
      state.publishingSeq != undefined ||
      state.attemptCount >= 1
    ) {
      return false;
    }
    set({ publishingSeq: seq, attemptCount: state.attemptCount + 1 });
    return true;
  },

  markPublishedAttempt: (seq) => {
    set((state) =>
      state.publishingSeq === seq && state.pendingRequest?.seq === seq
        ? {
            lastPublishedSeq: Math.max(state.lastPublishedSeq, seq),
            publishingSeq: undefined,
            pendingRequest: {
              ...state.pendingRequest,
              status: "published",
              publishedAtMs: Date.now(),
            },
          }
        : state,
    );
  },

  markAcked: (requestId) => {
    set((state) =>
      state.pendingRequest?.requestId === requestId
        ? { pendingRequest: undefined, publishingSeq: undefined }
        : state,
    );
  },

  markFailed: (seq, message) => {
    set((state) => {
      const request = state.pendingRequest;
      if (request?.seq !== seq && state.publishingSeq !== seq) {
        return state;
      }
      return {
        pendingRequest: request?.seq === seq ? undefined : state.pendingRequest,
        publishingSeq: state.publishingSeq === seq ? undefined : state.publishingSeq,
        lastFailure:
          request != undefined
            ? {
                seq: request.seq,
                droneId: request.droneId,
                commandType: request.commandType,
                requestId: request.requestId,
                message,
                atMs: Date.now(),
              }
            : state.lastFailure,
      };
    });
  },
}));
