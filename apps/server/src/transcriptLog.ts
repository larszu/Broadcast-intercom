// The transcript of a show, kept apart from the event list.
//
// WHY A SECOND LIST. `state.events` is the live feed for the UI and holds the
// last 300 events of every kind — heartbeats, assignments, talk. On a busy
// show the transcript lines scroll out of it within minutes, so an export at
// the end of the evening would have held the last few minutes and nothing
// else. This log keeps only transcript lines and operator bookmarks, and far
// more of them.
//
// A bookmark is an operator's marker ("cue 34 late", "RF drop on Stage 2")
// placed in the same timeline as the speech, so the post-show report can put
// the two side by side.

export interface TranscriptEntry {
	id: string;
	ts: number;
	kind: "line" | "bookmark";
	channelId?: string;
	channelName?: string;
	sender?: string;
	text: string;
}

export const TRANSCRIPT_LOG_MAX = 5000;

export class TranscriptLog {
	private entries: TranscriptEntry[] = [];

	constructor(private readonly max = TRANSCRIPT_LOG_MAX) {}

	add(entry: TranscriptEntry): TranscriptEntry {
		this.entries.push(entry);
		if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
		return entry;
	}

	/** Oldest first. A channel filter keeps bookmarks: they belong to the whole show. */
	list(channelId?: string): TranscriptEntry[] {
		const all = [...this.entries].sort((a, b) => a.ts - b.ts);
		return channelId ? all.filter((e) => e.kind === "bookmark" || e.channelId === channelId) : all;
	}

	clear(): void {
		this.entries = [];
	}
}

function lineText(e: TranscriptEntry): string {
	if (e.kind === "bookmark") return `BOOKMARK: ${e.text}`;
	return `[${e.channelName ?? e.channelId ?? "?"}] ${e.sender ?? "?"}: ${e.text}`;
}

export function toTxt(entries: TranscriptEntry[]): string {
	return entries.map((e) => `${new Date(e.ts).toISOString()} ${lineText(e)}`).join("\n") + (entries.length ? "\n" : "");
}

function srtTime(ms: number): string {
	const h = Math.floor(ms / 3_600_000);
	const m = Math.floor((ms % 3_600_000) / 60_000);
	const s = Math.floor((ms % 60_000) / 1000);
	const r = ms % 1000;
	const p = (n: number, w = 2) => String(n).padStart(w, "0");
	return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** Longest a cue stays on screen when the next one is far away. */
const SRT_MAX_MS = 4000;

/**
 * SubRip, timed from the first entry. Speech has no end time here — Vosk
 * reports a finished phrase, not its length — so a cue runs until the next
 * one starts, at most four seconds, and never less than one.
 */
export function toSrt(entries: TranscriptEntry[]): string {
	if (entries.length === 0) return "";
	const t0 = entries[0].ts;
	return entries
		.map((e, i) => {
			const start = e.ts - t0;
			const next = entries[i + 1]?.ts;
			const end = next !== undefined && next > e.ts ? Math.min(next - t0, start + SRT_MAX_MS) : start + SRT_MAX_MS;
			return `${i + 1}\n${srtTime(start)} --> ${srtTime(Math.max(end, start + 1000))}\n${lineText(e)}\n`;
		})
		.join("\n");
}

export function toJson(entries: TranscriptEntry[]): string {
	return JSON.stringify({ format: "broadcast-intercom-transcript", version: 1, entries }, null, 2);
}

export type TranscriptFormat = "json" | "txt" | "srt";

export const TRANSCRIPT_FORMATS: Record<TranscriptFormat, { type: string; render: (e: TranscriptEntry[]) => string }> = {
	json: { type: "application/json", render: toJson },
	txt: { type: "text/plain; charset=utf-8", render: toTxt },
	srt: { type: "application/x-subrip; charset=utf-8", render: toSrt },
};
