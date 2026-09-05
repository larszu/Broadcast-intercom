/**
 * Headless smoke test for the Broadcast Intercom core.
 *
 * Exercises the REST API, the Companion control endpoint and the WebSocket
 * protocol against a running core — no browser required.
 *
 * Usage:
 *   npm run dev:server          # in one terminal
 *   npm run test:smoke          # in another  (BASE=http://host:port to override)
 */
import WebSocket from "ws";

const BASE = process.env.BASE || "http://localhost:4001";
let pass = 0,
	fail = 0;
const results = [];

function check(name, cond, detail = "") {
	if (cond) {
		pass++;
		results.push(`  ✓  ${name}`);
	} else {
		fail++;
		results.push(`  ✗  ${name}${detail ? ` — ${detail}` : ""}`);
	}
}

async function api(method, path, body) {
	const res = await fetch(BASE + path, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
	});
	let json = null;
	try {
		json = await res.json();
	} catch {}
	return { status: res.status, json };
}

function wsOpen() {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/ws");
		const timer = setTimeout(() => reject(new Error("ws open timeout")), 4000);
		ws.on("open", () => {
			clearTimeout(timer);
			resolve(ws);
		});
		ws.on("error", reject);
	});
}

function nextMsg(ws, predicate, timeoutMs = 3000) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("ws message timeout")), timeoutMs);
		function handler(raw) {
			const msg = JSON.parse(raw.toString());
			if (!predicate || predicate(msg)) {
				clearTimeout(timer);
				ws.off("message", handler);
				resolve(msg);
			}
		}
		ws.on("message", handler);
	});
}

async function run() {
	// ── State + defaults ──
	const state = await api("GET", "/api/state");
	check("GET /api/state → 200", state.status === 200, `status ${state.status}`);
	check(
		"state has 3 system channels",
		state.json?.channels?.__sys_announcement__ &&
			state.json?.channels?.__sys_emergency__ &&
			state.json?.channels?.__sys_program__,
	);
	check(
		"state has a default admin user",
		Object.values(state.json?.users || {}).some((u) => u.role === "admin"),
	);

	// ── Users ──
	const created = await api("POST", "/api/users", { id: "user-smoke", name: "Smoke Op", role: "operator" });
	check("POST /api/users → 200", created.status === 200 && created.json?.ok);
	check("duplicate user rejected", (await api("POST", "/api/users", { id: "user-smoke" })).status === 400);
	const patched = await api("PATCH", "/api/users/user-smoke", { name: "Renamed" });
	check("PATCH user name", patched.json?.user?.name === "Renamed");

	// ── Advanced Call Behavior ──
	check("new user has default callBehavior", created.json?.user?.callBehavior?.replyMode === "ptt");
	const cbPatch = await api("PATCH", "/api/users/user-smoke", {
		callBehavior: { replyMode: "latch", activeTimeSec: 1, priorityDimDb: -999, isolate: true },
	});
	check("PATCH callBehavior replyMode", cbPatch.json?.user?.callBehavior?.replyMode === "latch");
	check("PATCH callBehavior clamps priorityDimDb to -60", cbPatch.json?.user?.callBehavior?.priorityDimDb === -60);
	check("PATCH callBehavior isolate flag", cbPatch.json?.user?.callBehavior?.isolate === true);
	check("PATCH callBehavior activeTimeSec", cbPatch.json?.user?.callBehavior?.activeTimeSec === 1);

	// ── Channels / Groups / Profiles ──
	const chan = await api("POST", "/api/channels", { id: "chSmoke", name: "SMOKE", color: "#123456" });
	check("POST /api/channels → 200", chan.status === 200 && chan.json?.state?.channels?.chSmoke);
	const grp = await api("POST", "/api/groups", { name: "Smoke Team" });
	check("POST /api/groups → 201", grp.status === 201 && grp.json?.group?.id);
	const prof = await api("POST", "/api/profiles", { userId: "user-smoke", name: "Preset" });
	check("POST /api/profiles → 201", prof.status === 201 && prof.json?.profile?.id);

	// ── Devices ──
	const dev = await api("POST", "/api/devices", {
		id: "bp-smoke-1",
		label: "Smoke BP",
		transport: "ethernet",
		channelIds: ["ch1", "chSmoke"],
	});
	check("POST /api/devices → 200", dev.status === 200 && dev.json?.state?.devices?.["bp-smoke-1"]);

	// ── Companion control endpoint ──
	check("control ptt_start → 200", (await api("POST", "/api/control/action", { action: "ptt_start", deviceId: "bp-smoke-1", slotIndex: 0 })).status === 200);
	check("ptt_start set talkChannelId", Boolean((await api("GET", "/api/state")).json?.devices?.["bp-smoke-1"]?.talkChannelId));
	check("control ptt_stop → 200", (await api("POST", "/api/control/action", { action: "ptt_stop", deviceId: "bp-smoke-1", slotIndex: 0 })).status === 200);
	check("ptt_stop cleared talkChannelId", !(await api("GET", "/api/state")).json?.devices?.["bp-smoke-1"]?.talkChannelId);
	check("control volume_up → 200", (await api("POST", "/api/control/action", { action: "volume_up", deviceId: "bp-smoke-1" })).status === 200);
	check("control mute_input → 200", (await api("POST", "/api/control/action", { action: "mute_input", deviceId: "bp-smoke-1" })).status === 200);
	check("control emergency_start → 200", (await api("POST", "/api/control/action", { action: "emergency_start" })).status === 200);
	check("control missing action → 400", (await api("POST", "/api/control/action", {})).status === 400);
	check("control unknown device → 404", (await api("POST", "/api/control/action", { action: "ptt_start", deviceId: "nope" })).status === 404);

	// ── Misc endpoints ──
	check("GET /api/network/hosts → 200", (await api("GET", "/api/network/hosts")).status === 200);
	check("GET /api/transcription/status → 200", (await api("GET", "/api/transcription/status")).status === 200);
	const pbPatch = await api("PATCH", "/api/audio/plugin-bridge", { enabled: true });
	check("PATCH plugin-bridge", pbPatch.json?.pluginBridge?.enabled === true);

	// ── WebSocket lifecycle ──
	const ws = await wsOpen();
	check("WS initial state message", (await nextMsg(ws, (m) => m.type === "state"))?.type === "state");
	ws.send(JSON.stringify({ type: "register_device", payload: { id: "ws-smoke-1", label: "WS BP", transport: "wifi", channelIds: ["ch1"] } }));
	check("WS register_device reflected in state", Boolean((await nextMsg(ws, (m) => m.type === "state" && m.payload?.devices?.["ws-smoke-1"]))?.payload?.devices?.["ws-smoke-1"]));
	ws.send(JSON.stringify({ type: "set_talk", payload: { id: "ws-smoke-1", channelId: "ch1", active: true } }));
	check("WS set_talk produces talk event", /TALK/.test((await nextMsg(ws, (m) => m.type === "event" && /TALK/.test(m.payload?.message || "")))?.payload?.message || ""));

	// ── ActiveTime auto-release (user-smoke has activeTimeSec=1 from PATCH above) ──
	await api("PATCH", "/api/devices/ws-smoke-1/user", { userId: "user-smoke" });
	ws.send(JSON.stringify({ type: "set_talk", payload: { id: "ws-smoke-1", channelId: "ch1", active: true } }));
	await new Promise((r) => setTimeout(r, 300));
	check("talk active before auto-release", Boolean((await api("GET", "/api/state")).json?.devices?.["ws-smoke-1"]?.talkChannelId));
	await new Promise((r) => setTimeout(r, 1200));
	check("talk auto-released after ActiveTime", !(await api("GET", "/api/state")).json?.devices?.["ws-smoke-1"]?.talkChannelId);

	ws.send(JSON.stringify({ type: "direct_call", payload: { fromDeviceId: "ws-smoke-1", toUserId: "user-smoke" } }));
	check("WS direct_call opens temp channel", Boolean(await nextMsg(ws, (m) => m.type === "temp_channel_opened" || (m.type === "state" && m.payload?.temporaryChannels?.length > 0), 4000).catch(() => null)));
	ws.close();

	// ── Intercom-Plan aus dem AV-Planner (B-41.2) ──
	// Der Plan bringt eine Konferenz mit, die es schon gibt ("DIR", hier klein
	// und mit Leerzeichen geschrieben), eine neue, und eine Sprechstelle, die
	// auf der einen spricht und die andere nur hoert. Genau daran haengt der
	// Nutzen: zusammenfuehren statt verdoppeln, und talk/listen getrennt.
	const plan = {
		format: "avplan-intercom",
		version: 1,
		systemName: "Smoke-Anlage",
		exportedAt: "2026-09-05T12:00:00.000Z",
		channels: [
			{ id: "ch-1", name: " dir " },
			{ id: "ch-2", name: "SMOKE-PGM" },
		],
		stations: [
			{
				id: "st-1",
				name: "Smoke Regie",
				memberships: [
					{ channelId: "ch-1", talk: true, listen: true },
					{ channelId: "ch-2", talk: false, listen: true },
					// Verweis auf eine Konferenz, die die Datei nicht definiert.
					{ channelId: "ch-99", talk: true, listen: true },
				],
			},
		],
		derivedFrom: "Green-GO-Konfiguration.",
	};

	const bad = await api("POST", "/api/plan/preview", { plan: { format: "etwas-anderes" } });
	check("plan preview rejects a foreign format → 400", bad.status === 400);

	const vorher = (await api("GET", "/api/state")).json;
	const pv = await api("POST", "/api/plan/preview", { plan });
	check("plan preview → 200", pv.status === 200);
	check("preview merges the existing channel by name", pv.json?.diff?.channels?.unchanged?.some((c) => /dir/i.test(c.name)));
	check("preview lists the new channel", pv.json?.diff?.channels?.added?.some((c) => c.name === "SMOKE-PGM"));
	check("preview lists the new station", pv.json?.diff?.users?.added?.some((u) => u.name === "Smoke Regie"));
	check("preview keeps what the plan does not name", (pv.json?.diff?.channels?.keptOutsidePlan?.length ?? 0) > 0);
	check("preview reports the dangling membership", pv.json?.diff?.danglingMemberships?.length === 1);
	check("preview passes derivedFrom through", /Green-GO/.test(pv.json?.diff?.derivedFrom || ""));
	// Der Abgleich ist eine Vorschau. Aendert er etwas, ist er keine.
	const nachher = (await api("GET", "/api/state")).json;
	check("preview changes nothing", JSON.stringify(vorher?.channels) === JSON.stringify(nachher?.channels));

	const ap = await api("POST", "/api/plan/apply", { plan });
	check("plan apply → 200", ap.status === 200);
	const nachApply = (await api("GET", "/api/state")).json;
	const pgm = Object.values(nachApply?.channels ?? {}).find((c) => c.name === "SMOKE-PGM");
	const dir = Object.values(nachApply?.channels ?? {}).find((c) => /^dir$/i.test(c.name));
	const regie = Object.values(nachApply?.users ?? {}).find((u) => u.name === "Smoke Regie");
	check("apply created the new channel", Boolean(pgm));
	check("apply did not duplicate the existing channel", Object.values(nachApply?.channels ?? {}).filter((c) => /^dir$/i.test(c.name)).length === 1);
	check("apply created the station", Boolean(regie));
	check("station talks only where the plan says so", regie && dir && pgm
		&& regie.permissions.talkChannelIds.includes(dir.id)
		&& !regie.permissions.talkChannelIds.includes(pgm.id));
	check("station listens on both", regie && dir && pgm
		&& regie.permissions.listenChannelIds.includes(dir.id)
		&& regie.permissions.listenChannelIds.includes(pgm.id));
	check("apply kept the system channels", Boolean(nachApply?.channels?.__sys_emergency__));
	check("apply kept the devices it does not know about", Boolean(nachApply?.devices?.["bp-smoke-1"]));

	// Zweiter Lauf derselben Datei: nichts darf sich verdoppeln. Das ist der
	// Fall, der bei einem Zusammenfuehren ueber die Datei-Id kaputtginge.
	const zweite = await api("POST", "/api/plan/apply", { plan });
	check("second apply → 200", zweite.status === 200);
	const nachZwei = (await api("GET", "/api/state")).json;
	check("second apply adds nothing", Object.keys(nachZwei?.channels ?? {}).length === Object.keys(nachApply?.channels ?? {}).length
		&& Object.keys(nachZwei?.users ?? {}).length === Object.keys(nachApply?.users ?? {}).length);
	check("second apply keeps the same channel colour", pgm && Object.values(nachZwei?.channels ?? {}).find((c) => c.name === "SMOKE-PGM")?.color === pgm.color);

	if (pgm) await api("DELETE", `/api/channels/${pgm.id}`);
	if (regie) await api("DELETE", `/api/users/${regie.id}`);

	// ── Cleanup ──
	check("DELETE device → 200", (await api("DELETE", "/api/devices/bp-smoke-1")).status === 200);
	check("DELETE device ws → 200", (await api("DELETE", "/api/devices/ws-smoke-1")).status === 200);
	check("DELETE channel → 200", (await api("DELETE", "/api/channels/chSmoke")).status === 200);
	check("DELETE user → 200", (await api("DELETE", "/api/users/user-smoke")).status === 200);
	check("DELETE group → 204", (await api("DELETE", `/api/groups/${grp.json.group.id}`)).status === 204);

	console.log(results.join("\n"));
	console.log(`\n──────────────────\nRESULT: ${pass} passed, ${fail} failed`);
	process.exit(fail === 0 ? 0 : 1);
}

run().catch((e) => {
	console.error("Smoke-test harness error:", e);
	process.exit(2);
});
