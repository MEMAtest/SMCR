"use client";

import { FIT_SECTIONS } from "@/lib/smcr-data";
import { useState } from "react";
import { CheckCircle2, UploadCloud } from "lucide-react";

export function FitnessChecklist() {
  const [responses, setResponses] = useState<Record<string, string>>({});

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 03</p>
          <h3 className="text-2xl">Fitness & propriety snapshot</h3>
        </div>
        <CheckCircle2 className="size-8 text-emerald" />
      </div>
      <p className="text-sm text-sand/70">
        Capture evidence for FIT 2.1 – 2.3. Uploads stay local for now and will sync with Neon once APIs land.
      </p>
      <div className="space-y-4">
        {FIT_SECTIONS.map((section) => (
          <details key={section.id} className="rounded-2xl border border-white/10 bg-white/5">
            <summary className="cursor-pointer px-4 py-3 text-lg font-semibold text-sand">
              {section.title}
            </summary>
            <div className="space-y-4 px-4 pb-4">
              {section.questions.map((question) => (
                <label key={question} className="block text-sm text-sand/80">
                  {question}
                  <textarea
                    className="mt-2 w-full rounded-2xl border border-white/20 bg-midnight/60 px-4 py-3 text-sand focus:border-emerald focus:outline-none"
                    placeholder="Add narrative or link to evidence"
                    value={responses[question] ?? ""}
                    onChange={(e) =>
                      setResponses((prev) => ({
                        ...prev,
                        [question]: e.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-sand/80"
              >
                <UploadCloud className="size-4" /> Attach evidence
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
