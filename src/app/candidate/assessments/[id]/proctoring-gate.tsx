"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Icon } from "@/components/ui";
import { buttonClass } from "@/components/ui/Button";
import { AssessmentRunner, type RunnerSection } from "./runner";

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
// are already saved on the server.
const UPLOAD_TIMEOUT_MS = 20_000;

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
}) {
  const [stage, setStage] = useState<"consent" | "requesting" | "recording" | "error">("consent");
  const [errorMsg, setErrorMsg] = useState("");
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const formatRef = useRef<{ mime: string; ext: "webm" | "mp4" } | null>(null);

  const requestAccess = useCallback(async () => {
    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaRef.current = stream;
      startedAtRef.current = Date.now();

      const format = pickRecordingFormat();
      formatRef.current = format;
      if (storageBackend === "supabase" && format) {
        const recorder = new MediaRecorder(stream, { mimeType: format.mime });
        chunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
      }

      setStage("recording");
    } catch {
      setErrorMsg(
        "Camera access was blocked or unavailable. This assessment requires camera consent to proceed — allow camera access in your browser and reload."
      );
      setStage("error");
    }
  }, [storageBackend]);

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
  // (Save and exit, closing the tab, navigating away).
  useEffect(() => {
    const stop = () => {
      try {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      } catch {}
      mediaRef.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, []);

  const stopAndUpload = useCallback(async () => {
    const durationSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    const stream = mediaRef.current;
    const recorder = recorderRef.current;

    let storagePath: string | null = null;

    if (recorder && storageBackend === "supabase") {
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      if (recorder.state !== "inactive") recorder.stop();
      await Promise.race([stopped, new Promise<void>((r) => setTimeout(r, 3000))]);

      const format = formatRef.current ?? { mime: "video/webm", ext: "webm" as const };
      const upload = (async () => {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return null;
        const blob = new Blob(chunksRef.current, { type: format.mime.split(";")[0] });
        const path = `${user.id}/${caId}.${format.ext}`;
        const { error: uploadError } = await supabase.storage.from("proctoring").upload(path, blob, {
          contentType: format.mime.split(";")[0],
          upsert: true,
        });
        return uploadError ? null : path;
      })().catch(() => null);
      // Non-fatal: submit anyway if the upload fails or is slow.
      storagePath = await Promise.race([upload, new Promise<null>((r) => setTimeout(() => r(null), UPLOAD_TIMEOUT_MS))]);
      chunksRef.current = [];
    }

    stream?.getTracks().forEach((t) => t.stop());

    try {
      const supabase = createClient();
      await supabase.from("proctoring_recordings").insert({
        candidate_assessment_id: caId,
        storage_path: storagePath,
        consent_given_at: new Date(startedAtRef.current || Date.now()).toISOString(),
        duration_seconds: durationSeconds,
      });
    } catch {
      // Non-fatal.
    }
  }, [caId, storageBackend]);

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
          <h1 className="text-lg font-bold text-foreground mb-2">Camera consent required</h1>
          <p className="text-sm text-muted leading-relaxed mb-2">
            This assessment records video for integrity review by the hiring team.{" "}
            {storageBackend === "supabase"
              ? "Your recording is uploaded securely and only visible to authorized staff."
              : "Your recording stays on this device only and is not uploaded or stored centrally."}
          </p>
          <p className="text-xs text-muted leading-relaxed mb-6">
            We record video only — this is not analyzed automatically for gestures, expressions, or emotion. You can
            decline, but the assessment can&apos;t start without camera access.
          </p>
          {errorMsg && <p className="text-sm text-critical bg-critical-soft border border-critical/40 rounded-xl px-4 py-3 mb-4">{errorMsg}</p>}
          <button
            onClick={requestAccess}
            disabled={stage === "requesting"}
            className={buttonClass({ size: "lg", block: true })}
          >
            <Icon name="camera" className="w-4 h-4" />
            {stage === "requesting" ? "Requesting access…" : "Allow camera & begin"}
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
    />
  );
}
