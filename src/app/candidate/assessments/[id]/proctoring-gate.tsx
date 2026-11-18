"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Icon } from "@/components/ui";
import { buttonClass } from "@/components/ui/Button";
import { AssessmentRunner, type RunnerSection } from "./runner";
import type { Dict } from "@/i18n/en";
import type { Lang } from "@/i18n";

// Set when the candidate allows the camera on the "ready to begin" page, so
// the camera starts by itself when the timed part opens. The browser keeps the
// permission for the rest of the visit.
export const cameraConsentKey = (caId: string) => `vantage-camera-${caId}`;

// Picks a video format this browser can actually record. Safari on iPhone
// records MP4, not WebM; if nothing is supported the exam goes ahead without a
// recording and the reviewer sees that none was made.
function pickRecordingFormat(): { mime: string; ext: "webm" | "mp4" } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options: { mime: string; ext: "webm" | "mp4" }[] = [
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
    { mime: "video/mp4", ext: "mp4" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

// Uploading the recording must never hold up the submit for long: the answers
// are already saved on the server. Parts are small (see below), so this only
// covers the last one, not the whole recording.
const UPLOAD_TIMEOUT_MS = 8_000;

// CAN-B-12: the whole exam's video used to sit in memory and go up as one file
// only when the candidate pressed Submit -- the biggest request of the exam,
// at the worst moment, and lost entirely if the page closed first. Instead the
// recorder is restarted every SEGMENT_MS, so each part is a complete, playable
// file of its own that is uploaded while the exam is still going.
const SEGMENT_MS = 60_000;

export function ProctoredAssessmentRunner({
  saveDraftAction,
  serverNowMs,
  serverDraft,
  caId,
  title,
  description,
  deadlineMs,
  totalQuestions,
  sections,
  submitAction,
  watermarkLabel,
  storageBackend,
  contentLanguage,
  lang,
  text,
}: {
  saveDraftAction?: (answers: Record<string, string>) => Promise<boolean>;
  serverNowMs?: number;
  serverDraft?: Record<string, string> | null;
  caId: string;
  title: string;
  description: string;
  deadlineMs: number;
  totalQuestions: number;
  sections: RunnerSection[];
  submitAction: (formData: FormData) => Promise<void | { error: string }>;
  watermarkLabel: string;
  storageBackend: "supabase" | "local";
  contentLanguage?: string | null;
  lang: Lang;
  text: Dict["candidate"];
}) {
  const [stage, setStage] = useState<"consent" | "requesting" | "recording" | "error">("consent");
  const [errorMsg, setErrorMsg] = useState("");
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const formatRef = useRef<{ mime: string; ext: "webm" | "mp4" } | null>(null);
  const userIdRef = useRef<string | null>(null);
  const partRef = useRef(0);
  const pendingRef = useRef<Set<Promise<void>>>(new Set());
  const savedPartsRef = useRef(0);
  const stoppedRef = useRef(false);

  // Uploads one finished part and records it, so the reviewer sees every part
  // that made it to the server even if a later one is lost.
  const uploadPart = useCallback(
    (blob: Blob, part: number, partStartedAt: number) => {
      const format = formatRef.current;
      const userId = userIdRef.current;
      if (!format || !userId || blob.size === 0) return;
      const job = (async () => {
        const supabase = createClient();
        const contentType = format.mime.split(";")[0];
        const path = `${userId}/${caId}/part-${String(part).padStart(3, "0")}-${partStartedAt}.${format.ext}`;
        const { error: uploadError } = await supabase.storage.from("proctoring").upload(path, blob, { contentType, upsert: false });
        if (uploadError) return;
        const { error: rowError } = await supabase.from("proctoring_recordings").insert({
          candidate_assessment_id: caId,
          storage_path: path,
          consent_given_at: new Date(startedAtRef.current || partStartedAt).toISOString(),
          duration_seconds: Math.max(1, Math.round((Date.now() - partStartedAt) / 1000)),
        });
        if (!rowError) savedPartsRef.current += 1;
      })().catch(() => {});
      pendingRef.current.add(job);
      void job.finally(() => pendingRef.current.delete(job));
    },
    [caId]
  );

  // Starts a fresh recorder on the open camera stream. Its own chunks become
  // one playable file when it stops.
  const startPart = useCallback(() => {
    const stream = mediaRef.current;
    const format = formatRef.current;
    if (!stream || !format || stoppedRef.current) return;
    const recorder = new MediaRecorder(stream, { mimeType: format.mime });
    const chunks: Blob[] = [];
    const part = (partRef.current += 1);
    const partStartedAt = Date.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => uploadPart(new Blob(chunks, { type: format.mime.split(";")[0] }), part, partStartedAt);
    recorder.start(1000);
    recorderRef.current = recorder;
  }, [uploadPart]);

  const stopPart = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    try {
      if (recorder && recorder.state !== "inactive") recorder.stop();
    } catch {}
  }, []);

  const requestAccess = useCallback(async () => {
    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaRef.current = stream;
      startedAtRef.current = Date.now();
      stoppedRef.current = false;

      const format = pickRecordingFormat();
      formatRef.current = format;
      if (storageBackend === "supabase" && format) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userIdRef.current = user?.id ?? null;
        startPart();
        rotateTimerRef.current = setInterval(() => {
          stopPart();
          startPart();
        }, SEGMENT_MS);
      }

      setStage("recording");
    } catch {
      setErrorMsg(text.gate.blocked);
      setStage("error");
    }
  }, [storageBackend, startPart, stopPart, text.gate.blocked]);

  // Allowed earlier on the "ready to begin" page: start by itself.
  useEffect(() => {
    let consented = false;
    try {
      consented = sessionStorage.getItem(cameraConsentKey(caId)) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starts the camera once after mount
    if (consented) void requestAccess();
  }, [caId, requestAccess]);

  // The camera never keeps running once the candidate leaves the exam
  // (Save and exit, closing the tab, navigating away). The part in progress
  // is still handed to the uploader on the way out.
  useEffect(() => {
    const stop = () => {
      stoppedRef.current = true;
      if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
      rotateTimerRef.current = null;
      stopPart();
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [stopPart]);

  const stopAndUpload = useCallback(async () => {
    const durationSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    stoppedRef.current = true;
    if (rotateTimerRef.current) clearInterval(rotateTimerRef.current);
    rotateTimerRef.current = null;

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
      stopPart();
      await Promise.race([stopped, new Promise<void>((r) => setTimeout(r, 3000))]);
    }

    // Non-fatal: submit anyway if the last part is slow or fails.
    await Promise.race([
      Promise.allSettled(Array.from(pendingRef.current)),
      new Promise<void>((r) => setTimeout(r, UPLOAD_TIMEOUT_MS)),
    ]);

    mediaRef.current?.getTracks().forEach((t) => t.stop());

    // Nothing reached the server (local-only setting, unsupported browser, or
    // every upload failed): still leave a row so the reviewer can see a
    // session took place with consent, and for how long.
    if (savedPartsRef.current === 0) {
      try {
        const supabase = createClient();
        await supabase.from("proctoring_recordings").insert({
          candidate_assessment_id: caId,
          storage_path: null,
          consent_given_at: new Date(startedAtRef.current || Date.now()).toISOString(),
          duration_seconds: durationSeconds,
        });
      } catch {
        // Non-fatal.
      }
    }
  }, [caId, stopPart]);

  const wrappedSubmitAction = useCallback(
    async (formData: FormData) => {
      await stopAndUpload();
      return submitAction(formData);
    },
    [stopAndUpload, submitAction]
  );

  if (stage === "consent" || stage === "requesting" || stage === "error") {
    return (
      <div className="p-6 lg:p-10 max-w-lg mx-auto">
        <Card className="p-8">
          <div className="w-12 h-12 rounded-card bg-accent-soft grid place-items-center mb-5">
            <Icon name="camera" className="w-6 h-6 text-accent-dark" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2">{text.gate.title}</h1>
          <p className="text-sm text-muted leading-relaxed mb-2">
            {text.gate.intro} {storageBackend === "supabase" ? text.gate.uploaded : text.gate.local}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-6">
            {text.gate.note}
          </p>
          {errorMsg && <p className="text-sm text-critical bg-critical-soft border border-critical/40 rounded-xl px-4 py-3 mb-4">{errorMsg}</p>}
          <button
            onClick={requestAccess}
            disabled={stage === "requesting"}
            className={buttonClass({ size: "lg", block: true })}
          >
            <Icon name="camera" className="w-4 h-4" />
            {stage === "requesting" ? text.gate.requesting : text.gate.allow}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <AssessmentRunner
      caId={caId}
      title={title}
      description={description}
      deadlineMs={deadlineMs}
      totalQuestions={totalQuestions}
      sections={sections}
      submitAction={wrappedSubmitAction}
      saveDraftAction={saveDraftAction}
      serverNowMs={serverNowMs}
      serverDraft={serverDraft}
      watermarkLabel={watermarkLabel}
      contentLanguage={contentLanguage}
      lang={lang}
      text={text.exam}
    />
  );
}
