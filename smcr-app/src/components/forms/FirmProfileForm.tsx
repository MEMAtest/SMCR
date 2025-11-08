"use client";

import { FIRM_TYPES, SMCR_CATEGORIES } from "@/lib/smcr-data";
import { useSmcrStore } from "@/stores/useSmcrStore";
import { Info, MapPin } from "lucide-react";

export function FirmProfileForm() {
  const { firmProfile, updateFirmProfile } = useSmcrStore();
  const firmConfig = firmProfile.firmType ? FIRM_TYPES[firmProfile.firmType] : undefined;

  return (
    <div className="glass-panel gradient-border p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-emerald">step 01</p>
        <h2 className="mt-2 text-3xl">Firm profile & perimeter</h2>
        <p className="text-sand/70">Tell us who you are so we can tailor the SMCR flow and references.</p>
      </div>

      <label className="block">
        <span className="text-sm text-sand/70">Registered firm name</span>
        <input
          type="text"
          className="mt-2 w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sand placeholder:text-sand/40 focus:border-emerald focus:outline-none"
          placeholder="MEMA Consulting Ltd"
          value={firmProfile.firmName || ""}
          onChange={(e) => updateFirmProfile({ firmName: e.target.value })}
        />
      </label>

      <div>
        <p className="text-sm text-sand/70 mb-3">Firm type</p>
        <div className="grid gap-4 md:grid-cols-2">
          {Object.values(FIRM_TYPES).map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() =>
                updateFirmProfile({
                  firmType: type.key,
                  smcrCategory: type.isSoloRegulated ? firmProfile.smcrCategory ?? "core" : "enhanced",
                })
              }
              className={`rounded-2xl border px-4 py-4 text-left transition hover:border-emerald/60 ${
                firmProfile.firmType === type.key ? "border-emerald bg-emerald/10" : "border-white/15 bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <type.icon className="size-6 text-emerald" />
                <div>
                  <p className="font-semibold">{type.label}</p>
                  <p className="text-sm text-sand/70">{type.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {firmConfig?.isSoloRegulated && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-sand/70 mb-2">SM&CR category</p>
          <select
            value={firmProfile.smcrCategory || "core"}
            onChange={(e) => updateFirmProfile({ smcrCategory: e.target.value })}
            className="w-full rounded-xl border border-white/15 bg-midnight px-4 py-3"
          >
            {SMCR_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key} className="bg-midnight text-sand">
                {cat.label}
              </option>
            ))}
          </select>
          <label className="mt-3 flex items-center gap-2 text-sm text-sand/80">
            <input
              type="checkbox"
              className="size-4 rounded border-white/30 bg-midnight"
              checked={firmProfile.optUp ?? false}
              onChange={(e) => updateFirmProfile({ optUp: e.target.checked })}
            />
            Voluntarily opt up to Enhanced
          </label>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex flex-col gap-2 text-sm text-sand/70">
          Jurisdiction focus
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-sand">
            <MapPin className="size-4" /> UK & EU
          </span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-sand/80">
          <input
            type="checkbox"
            className="size-4 rounded border-white/30 bg-midnight"
            checked={firmProfile.isCASSFirm ?? false}
            onChange={(e) => updateFirmProfile({ isCASSFirm: e.target.checked })}
          />
          CASS firm?
          <Info className="size-4 text-sand/50" />
        </label>
      </div>
    </div>
  );
}
