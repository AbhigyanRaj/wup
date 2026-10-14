"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  bridgesApi,
  defaultSelection,
  privacyRowsFor,
  selectedCount,
  selectionToScope,
  suggestBridgeName,
  toggleRedaction,
  waitForScan,
  type BridgeDetails,
  type MongoTestResult,
  type RedactionMap,
  type Selection,
} from "@/lib/bridges";
import { qk } from "@/lib/query-keys";
import { connectionError, type ConnectionErrorInfo } from "./connection-errors";

/*
 * The MongoDB connect wizard, ported from the old connect-db-modal step machine:
 *   m-url -> m-pick -> m-privacy -> m-name -> m-saving -> m-ready
 * m-privacy is skipped when none of the kept collections have sensitive fields.
 */

export type MongoStep = "m-url" | "m-pick" | "m-privacy" | "m-name" | "m-saving" | "m-ready";

export const MONGO_STEPS: MongoStep[] = ["m-url", "m-pick", "m-privacy", "m-name"];
export const MONGO_STEP_LABELS = ["Connect", "Choose collections", "Hide sensitive fields", "Name"] as const;

export interface MongoWizardState {
  step: MongoStep;
  url: string;
  testing: boolean;
  error: ConnectionErrorInfo | null;
  test: MongoTestResult | null;
  selection: Selection;
  expanded: string[];
  filter: string;
  hidden: RedactionMap;
  name: string;
  created: BridgeDetails | null;
}

export const initialMongoState: MongoWizardState = {
  step: "m-url",
  url: "",
  testing: false,
  error: null,
  test: null,
  selection: {},
  expanded: [],
  filter: "",
  hidden: {},
  name: "",
  created: null,
};

export type MongoAction =
  | { type: "setUrl"; url: string }
  | { type: "testStart" }
  | { type: "testOk"; result: MongoTestResult }
  | { type: "fail"; error: ConnectionErrorInfo; step?: MongoStep }
  | { type: "go"; step: MongoStep }
  | { type: "toggleDb"; db: string }
  | { type: "toggleCollection"; db: string; coll: string }
  | { type: "toggleExpanded"; db: string }
  | { type: "setFilter"; filter: string }
  | { type: "toggleHidden"; key: string; field: string }
  | { type: "setName"; name: string }
  | { type: "saveStart" }
  | { type: "scanUpdate"; details: BridgeDetails }
  | { type: "saveOk"; details: BridgeDetails }
  | { type: "reset" };

export function mongoReducer(state: MongoWizardState, action: MongoAction): MongoWizardState {
  switch (action.type) {
    case "setUrl":
      return { ...state, url: action.url, error: null };
    case "testStart":
      return { ...state, testing: true, error: null };
    case "testOk": {
      const r = action.result;
      return {
        ...state,
        testing: false,
        test: r,
        selection: defaultSelection(r),
        expanded: r.databases.slice(0, 1).map((d) => d.db),
        hidden: r.sensitive,
        name: state.name || suggestBridgeName(state.url),
        filter: "",
        step: "m-pick",
      };
    }
    case "fail":
      return { ...state, testing: false, error: action.error, step: action.step ?? state.step };
    case "go":
      return { ...state, step: action.step, error: null };
    case "toggleDb": {
      const db = state.test?.databases.find((d) => d.db === action.db);
      if (!db) return state;
      const current = state.selection[db.db] ?? [];
      const allOn = current.length === db.collections.length;
      return {
        ...state,
        selection: { ...state.selection, [db.db]: allOn ? [] : db.collections.map((c) => c.name) },
      };
    }
    case "toggleCollection": {
      const current = state.selection[action.db] ?? [];
      const next = current.includes(action.coll)
        ? current.filter((c) => c !== action.coll)
        : [...current, action.coll];
      return { ...state, selection: { ...state.selection, [action.db]: next } };
    }
    case "toggleExpanded":
      return {
        ...state,
        expanded: state.expanded.includes(action.db)
          ? state.expanded.filter((d) => d !== action.db)
          : [...state.expanded, action.db],
      };
    case "setFilter":
      return { ...state, filter: action.filter };
    case "toggleHidden":
      return { ...state, hidden: toggleRedaction(state.hidden, action.key, action.field) };
    case "setName":
      return { ...state, name: action.name, error: null };
    case "saveStart":
      return { ...state, step: "m-saving", error: null };
    case "scanUpdate":
      return { ...state, created: action.details };
    case "saveOk":
      return { ...state, created: action.details, step: "m-ready" };
    case "reset":
      return initialMongoState;
    default:
      return state;
  }
}

export function useMongoWizard() {
  const [state, dispatch] = useReducer(mongoReducer, initialMongoState);
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);

  const scope = useMemo(() => (state.test ? selectionToScope(state.test, state.selection) : []), [state.test, state.selection]);
  const count = selectedCount(state.selection);
  const privacyRows = useMemo(
    () => (state.test ? privacyRowsFor(state.test.sensitive, state.selection) : []),
    [state.test, state.selection],
  );
  const totalCollections = state.test?.databases.reduce((n, d) => n + d.collections.length, 0) ?? 0;

  const runTest = useCallback(async () => {
    const url = state.url.trim();
    if (!url || state.testing) return;
    dispatch({ type: "testStart" });
    try {
      const result = await bridgesApi.testMongo(url);
      dispatch({ type: "testOk", result });
    } catch (e) {
      dispatch({ type: "fail", error: connectionError(e, "mongodb") });
    }
  }, [state.url, state.testing]);

  const save = useCallback(async () => {
    if (!state.test) return;
    dispatch({ type: "saveStart" });
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // Only send redactions for in-scope collections that the probe looked at.
      const redactedFields: RedactionMap = {};
      for (const row of privacyRows) redactedFields[row.key] = state.hidden[row.key] ?? [];
      const { id } = await bridgesApi.create({
        name: state.name.trim() || suggestBridgeName(state.url),
        type: "mongodb",
        config: state.url.trim(),
        scope,
        redactedFields,
      });
      void qc.invalidateQueries({ queryKey: qk.bridges.list });
      const details = await waitForScan(id, (d) => dispatch({ type: "scanUpdate", details: d }), ac.signal);
      void qc.invalidateQueries({ queryKey: qk.bridges.all });
      void qc.invalidateQueries({ queryKey: qk.usage });
      dispatch({ type: "saveOk", details });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      dispatch({ type: "fail", error: connectionError(e, "mongodb"), step: "m-name" });
    }
  }, [state.test, state.hidden, state.name, state.url, privacyRows, scope, qc]);

  const next = useCallback(() => {
    switch (state.step) {
      case "m-url":
        void runTest();
        break;
      case "m-pick":
        if (count > 0) dispatch({ type: "go", step: privacyRows.length > 0 ? "m-privacy" : "m-name" });
        break;
      case "m-privacy":
        dispatch({ type: "go", step: "m-name" });
        break;
      case "m-name":
        if (state.name.trim()) void save();
        break;
    }
  }, [state.step, state.name, count, privacyRows.length, runTest, save]);

  /** Returns false when Back should leave the wizard (to the source picker). */
  const back = useCallback((): boolean => {
    switch (state.step) {
      case "m-pick":
        dispatch({ type: "go", step: "m-url" });
        return true;
      case "m-privacy":
        dispatch({ type: "go", step: "m-pick" });
        return true;
      case "m-name":
        dispatch({ type: "go", step: privacyRows.length > 0 ? "m-privacy" : "m-pick" });
        return true;
      default:
        return false;
    }
  }, [state.step, privacyRows.length]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, []);

  return { state, dispatch, scope, count, privacyRows, totalCollections, runTest, save, next, back, reset };
}

export type MongoWizard = ReturnType<typeof useMongoWizard>;
