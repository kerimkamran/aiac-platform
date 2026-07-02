"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, Icon } from "@/components/ui";
import { AssessmentRunner, type RunnerSection } from "./runner";

export function ProctoredAssessmentRunner({
  caId,
  title,
  description,
  deadlineMs,
  sections,
  submitAction,
  watermarkLabel,
  storageBackend,
}: {
  caId: string;
  title: string;
  description: string;
  deadlineMs: number;
  sections: RunnerSection[];
  submitAction: (formData: FormData) => Promise<void>;
  watermarkLabel: string;
  storageBackend: "supabase" | "local";
}) {
  const [stage, setStage] = useState<"consent" | "requesting" | "recording" | "error">("consent");
  const [errorMsg, setErrorMsg] = useState("");
  const mediaRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const requestAccess = useCallback(async () => {
    setStage("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      mediaRef.current = stream;
      startedAtRef.current = Date.now();

      if (storageBackend === "supabase") {
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
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

  const stopAndUpload = useCallback(async () => {
    const durationSeconds = startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : 0;
    const stream = mediaRef.current;
    const recorder = recorderRef.current;

    let storagePath: string | null = null;

    if (recorder && storageBackend === "supabase") {
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await stopped;

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          const path = `${user.id}/${caId}.webm`;
          const { error: uploadError } = await supabase.storage.from("proctoring").upload(path, blob, {
            contentType: "video/webm",
            upsert: true,
          });
          if (!uploadError) storagePath = path;
        }
      } catch {
        // Non-fatal: proceed with submission even if the recording upload fails.
      }
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
      await submitAction(formData);
    },
    [stopAndUpload, submitAction]
  );

  if (stage === "consent" || stage === "requesting" || stage === "error") {
    return (
      <div className="p-6 lg:p-10 max-w-lg mx-auto">
        <Card className="p-8">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft grid place-items-center mb-5">
            <Icon name="camera" className="w-6 h-6 text-accent-dark" />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-2 [font-family:var(--font-display)]">Camera consent required</h1>
          <p className="text-sm text-muted leading-relaxed mb-2">
            This assessment records video for integrity review by the hiring team.{" "}
            {storageBackend === "supabase"
              ? "Your recording is uploaded securely and only visible to authorized staff and assigned decision makers."
              : "Your recording stays on this device only and is not uploaded or stored centrally."}
          </p>
          <p className="text-xs text-faint leading-relaxed mb-6">
            We record video only — this is not analyzed automatically for gestures, expressions, or emotion. You can
            decline, but the assessment can&apos;t start without camera access.
          </p>
          {errorMsg && <p className="text-sm text-critical bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{errorMsg}</p>}
          <button
            onClick={requestAccess}
            disabled={stage === "requesting"}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand text-white text-sm font-semibold px-5 py-3 rounded-xl hover:bg-brand-light transition-colors disabled:opacity-60"
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
      sections={sections}
      submitAction={wrappedSubmitAction}
      watermarkLabel={watermarkLabel}
    />
  );
}
