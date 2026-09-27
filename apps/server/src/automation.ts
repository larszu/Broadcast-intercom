// Keyword rules: a word in a transcript line sends a webhook or an OSC message.
//
// The use case is the show caller's "standby" or "go" reaching a playback or
// lighting console without someone pressing a key, and "emergency" paging a
// stage manager's phone through a webhook. A rule only ever SENDS: nothing in
// a transcript line may choose what runs on the core machine, which is why
// there is no local-command action.
import dgram from "node:dgram";
import type { KeywordAction, KeywordRule } from "@broadcast/shared";

export interface TranscriptHit {
	channelId: string;
	channelName: string;
	sender: string;
	text: string;
	ts: number;
}

function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole word or phrase, case-insensitive, Unicode-aware: "go" fires on
 * "Go!" and "standby, go" but not on "going" or "cargo". Whitespace inside a
 * phrase matches any run of whitespace — speech recognition does not promise
 * single spaces.
 */
export function keywordMatches(keyword: string, text: string): boolean {
	const words = keyword.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return false;
	const pattern = words.map(escapeRegExp).join("\\s+");
	return new RegExp(`(^|[^\\p{L}\\p{N}])${pattern}(?=$|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export function matchingRules(rules: KeywordRule[], hit: Pick<TranscriptHit, "channelId" | "text">): KeywordRule[] {
	return rules.filter(
		(r) => r.enabled && (!r.channelId || r.channelId === hit.channelId) && keywordMatches(r.keyword, hit.text),
	);
}

/** Validates user input; returns the error text or null. */
export function ruleError(rule: Partial<KeywordRule>): string | null {
	if (!rule.keyword || !String(rule.keyword).trim()) return "keyword is empty";
	const a = rule.action as KeywordAction | undefined;
	if (!a) return "action is missing";
	if (a.kind === "webhook") {
		let u: URL;
		try {
			u = new URL(a.url);
		} catch {
			return "webhook URL is not a URL";
		}
		if (u.protocol !== "http:" && u.protocol !== "https:") return "webhook URL must be http or https";
		return null;
	}
	if (a.kind === "osc") {
		if (!a.host || !String(a.host).trim()) return "OSC host is empty";
		if (!Number.isInteger(a.port) || a.port < 1 || a.port > 65535) return "OSC port must be 1–65535";
		if (!String(a.address).startsWith("/")) return "OSC address must start with /";
		return null;
	}
	return "unknown action";
}

// ── OSC 1.0 encoding (strings only) ─────────────────────────────────────────
// Strings are NUL-terminated and padded to a multiple of four bytes.
function oscString(s: string): Buffer {
	const raw = Buffer.from(s, "utf8");
	const len = Math.ceil((raw.length + 1) / 4) * 4;
	const out = Buffer.alloc(len);
	raw.copy(out);
	return out;
}

export function encodeOscMessage(address: string, args: string[]): Buffer {
	return Buffer.concat([oscString(address), oscString("," + "s".repeat(args.length)), ...args.map(oscString)]);
}

const WEBHOOK_TIMEOUT_MS = 3000;

/** Sends the action; resolves with an error text or null. Never throws. */
export async function fireAction(rule: KeywordRule, hit: TranscriptHit): Promise<string | null> {
	const a = rule.action;
	try {
		if (a.kind === "webhook") {
			const res = await fetch(a.url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rule: { id: rule.id, keyword: rule.keyword }, ...hit }),
				signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
			});
			return res.ok ? null : `webhook answered ${res.status}`;
		}
		const msg = encodeOscMessage(a.address, [hit.text, hit.channelName, hit.sender, rule.keyword]);
		const sock = dgram.createSocket(a.host.includes(":") ? "udp6" : "udp4");
		return await new Promise<string | null>((resolve) => {
			sock.send(msg, a.port, a.host, (err) => {
				sock.close();
				resolve(err ? `OSC send failed: ${err.message}` : null);
			});
		});
	} catch (e) {
		return e instanceof Error ? e.message : String(e);
	}
}

/**
 * A rule fires at most once per second. A recogniser that splits one spoken
 * "go" across two final results, or a caller who says "go, go", must not
 * fire a cue twice.
 */
const MIN_INTERVAL_MS = 1000;
const lastFired = new Map<string, number>();

export function dueRules(rules: KeywordRule[], hit: TranscriptHit): KeywordRule[] {
	return matchingRules(rules, hit).filter((r) => {
		const last = lastFired.get(r.id) ?? -Infinity;
		if (hit.ts - last < MIN_INTERVAL_MS) return false;
		lastFired.set(r.id, hit.ts);
		return true;
	});
}
