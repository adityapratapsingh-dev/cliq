"use client";

import { useState } from "react";
import { AtSign, Camera, Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { INTEREST_OPTIONS } from "@/lib/constants";
import { Avatar } from "@/components/ui/Primitives";
import type { PublicUser, SessionUser } from "@/types/cliq";
import { cx } from "@/lib/utils";

type Mode = "signup" | "login";

export function AuthScreen({ onAuthed }: { onAuthed: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit =
    mode === "login"
      ? Boolean(username.trim() && password)
      : Boolean(username.trim() && displayName.trim() && password.length >= 6);

  const preview: Pick<PublicUser, "id" | "username" | "displayName" | "avatarUrl"> = {
    id: "preview",
    username: username || "you",
    displayName: displayName || "New Cliq user",
    avatarUrl: avatarUrl || null,
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } =
        mode === "login"
          ? await api.logIn(username.trim().replace(/^@/, ""), password)
          : await api.signUp({
              username: username.trim().replace(/^@/, ""),
              displayName: displayName.trim(),
              password,
              age: age.trim() ? Number(age) : null,
              bio: bio.trim(),
              avatarUrl: avatarUrl.trim() || null,
              interests,
            });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-white/10 bg-[#121216] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center gap-3 pb-6">
          <span className="text-4xl font-bold tracking-tight text-white">Cliq</span>
          <p className="text-center text-sm text-zinc-500">
            {mode === "signup" ? "Sign up to share photos, videos and posts." : "Log in to your Cliq."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" ? (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#121216] p-3">
              <Avatar user={preview} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{preview.displayName}</p>
                <p className="truncate text-xs text-zinc-500">@{preview.username}</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/15">
                <Camera size={13} strokeWidth={1.75} /> Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setAvatarUrl(typeof reader.result === "string" ? reader.result : "");
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
            </div>
          ) : null}

          <label className="block">
            <div className="relative">
              <AtSign size={15} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_@]/g, "").toLowerCase())}
                autoComplete="username"
                placeholder="Username"
                className={cx(inputClass, "pl-9")}
              />
            </div>
          </label>

          {mode === "signup" ? (
            <>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                placeholder="Full name"
                className={inputClass}
              />
              <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  inputMode="numeric"
                  placeholder="Age"
                  className={inputClass}
                />
                <input
                  value={avatarUrl.startsWith("data:") ? "" : avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="Avatar URL (optional)"
                  className={inputClass}
                />
              </div>
            </>
          ) : null}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "Password (6+ characters)" : "Password"}
            className={inputClass}
          />

          {mode === "signup" ? (
            <>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Bio (optional)"
                className={cx(inputClass, "resize-none")}
              />
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">Interests</p>
                <div className="flex flex-wrap gap-1.5">
                  {INTEREST_OPTIONS.map((interest) => {
                    const active = interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() =>
                          setInterests((prev) => (active ? prev.filter((i) => i !== interest) : [...prev, interest]))
                        }
                        className={cx(
                          "rounded-full px-3 py-1 text-xs font-medium transition",
                          active ? "bg-white text-black" : "bg-[#121216] text-zinc-400 hover:text-zinc-200",
                        )}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-[#ff3040]/40 bg-[#ff3040]/10 px-3 py-2 text-xs font-medium text-[#ff8f99]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#6366f1] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Just a sec...
              </>
            ) : mode === "signup" ? (
              "Create account"
            ) : (
              "Log in"
            )}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-[#121216] py-3 text-sm">
          <span className="text-zinc-500">{mode === "signup" ? "Have an account?" : "New to Cliq?"}</span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError(null);
            }}
            className="font-semibold text-[#4f46e5] transition hover:text-white"
          >
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-600">
          Your password is hashed before it is stored. Cliq is built for ages 13–19 with safety controls on by default.
        </p>
      </div>
    </div>
  );
}
