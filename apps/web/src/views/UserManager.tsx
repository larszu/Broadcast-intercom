import { useState } from "react";
import type {
  CallBehaviorSettings,
  CoreState,
  IntercomUser,
  PopupMode,
  ReplyMode,
  UserRole,
} from "@broadcast/shared";
import { defaultCallBehavior } from "@broadcast/shared";
import { useLang, type Strings } from "../i18n";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

const USER_ROLES: UserRole[] = ["admin", "director", "operator", "talent"];

const REPLY_MODES: { value: ReplyMode; label: keyof Strings }[] = [
  { value: "ptt", label: "umReplyPtt" },
  { value: "latch", label: "umReplyLatch" },
  { value: "handsfree", label: "umReplyHandsfree" },
];

const POPUP_MODES: { value: PopupMode; label: keyof Strings }[] = [
  { value: "off", label: "umPopupOff" },
  { value: "call", label: "umPopupCall" },
  { value: "talk", label: "umPopupTalk" },
  { value: "all", label: "umPopupAll" },
];

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function UserManager({ state, api }: Props) {
  const { t } = useLang();
  const users = Object.values(state.users);
  const channels = Object.values(state.channels);

  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("operator");

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("operator");
  const [editColor, setEditColor] = useState("#2a9d8f");
  const [editTalkChannels, setEditTalkChannels] = useState<string[]>([]);
  const [editListenChannels, setEditListenChannels] = useState<string[]>([]);
  const [editTrxChannels, setEditTrxChannels] = useState<string[]>([]);
  const [editCanAllCall, setEditCanAllCall] = useState(false);
  const [editCanManageDevices, setEditCanManageDevices] = useState(false);
  const [editCallBehavior, setEditCallBehavior] = useState<CallBehaviorSettings>(defaultCallBehavior());

  function patchCallBehavior(patch: Partial<CallBehaviorSettings>) {
    setEditCallBehavior((prev) => ({ ...prev, ...patch }));
  }

  async function addUser() {
    const name = createName.trim();
    if (!name) {
      return;
    }

    await api("POST", "/api/users", {
      name,
      role: createRole,
    });

    setCreateName("");
    setCreateRole("operator");
  }

  async function saveUser(userId: string) {
    await api("PATCH", `/api/users/${userId}`, {
      name: editName.trim() || undefined,
      role: editRole,
      color: editColor,
      permissions: {
        talkChannelIds: editTalkChannels,
        listenChannelIds: editListenChannels,
        transcriptionChannelIds: editTrxChannels,
        canAllCall: editCanAllCall,
        canManageDevices: editCanManageDevices,
      },
      callBehavior: editCallBehavior,
    });
    setEditId(null);
  }

  async function removeUser(user: IntercomUser) {
    if (!confirm(t.umRemoveConfirm.replace("{name}", user.name))) {
      return;
    }
    await api("DELETE", `/api/users/${user.id}`);
  }

  function startEdit(user: IntercomUser) {
    setEditId(user.id);
    setEditName(user.name);
    setEditRole(user.role);
    setEditColor(user.color);
    setEditTalkChannels(user.permissions.talkChannelIds || []);
    setEditListenChannels(user.permissions.listenChannelIds || []);
    setEditTrxChannels(user.permissions.transcriptionChannelIds || []);
    setEditCanAllCall(Boolean(user.permissions.canAllCall));
    setEditCanManageDevices(Boolean(user.permissions.canManageDevices));
    setEditCallBehavior({ ...defaultCallBehavior(), ...(user.callBehavior || {}) });
  }

  return (
    <div className="viewPanel">
      <h2>{t.umTitle}</h2>
      <p className="inlineHint">{t.umHint}</p>

      <div className="addRow">
        <input
          data-fuehrung="user-name"
          placeholder={t.umNewName}
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
        />
        <label data-fuehrung="user-role">
          {t.umRole}
          <select value={createRole} onChange={(event) => setCreateRole(event.target.value as UserRole)}>
            {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button data-fuehrung="user-create" onClick={addUser}>{t.umCreate}</button>
      </div>

      <div className="deviceTable">
        {users.map((user) => (
          <div className="deviceRow" key={user.id}>
            {editId === user.id ? (
              <div className="deviceEdit">
                <label>{t.umName}<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
                <label>
                  {t.umRole}
                  <select value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)}>
                    {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label>{t.umColor}<input type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} /></label>

                <div className="editSection">
                  <p>{t.umTalkChannels}</p>
                  <div className="checkGrid">
                    {channels.map((channel) => (
                      <label key={channel.id}>
                        <input
                          type="checkbox"
                          checked={editTalkChannels.includes(channel.id)}
                          onChange={() => setEditTalkChannels((prev) => toggleInList(prev, channel.id))}
                        />
                        {channel.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="editSection">
                  <p>{t.umListenChannels}</p>
                  <div className="checkGrid">
                    {channels.map((channel) => (
                      <label key={channel.id}>
                        <input
                          type="checkbox"
                          checked={editListenChannels.includes(channel.id)}
                          onChange={() => setEditListenChannels((prev) => toggleInList(prev, channel.id))}
                        />
                        {channel.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="editSection">
                  <p>{t.umTrxChannels}</p>
                  <div className="checkGrid">
                    {channels.map((channel) => (
                      <label key={channel.id}>
                        <input
                          type="checkbox"
                          checked={editTrxChannels.includes(channel.id)}
                          onChange={() => setEditTrxChannels((prev) => toggleInList(prev, channel.id))}
                        />
                        {channel.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="checkGrid">
                  <label>
                    <input
                      type="checkbox"
                      checked={editCanAllCall}
                      onChange={(event) => setEditCanAllCall(event.target.checked)}
                    />
                    {t.umAllCall}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editCanManageDevices}
                      onChange={(event) => setEditCanManageDevices(event.target.checked)}
                    />
                    {t.umManageDevices}
                  </label>
                </div>

                <div className="editSection">
                  <p>{t.umAdvanced}</p>
                  <div className="callBehaviorGrid">
                    <label>
                      {t.umReplyMode}
                      <select
                        value={editCallBehavior.replyMode}
                        onChange={(event) => patchCallBehavior({ replyMode: event.target.value as ReplyMode })}
                      >
                        {REPLY_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>{t[mode.label]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t.umPopupMode}
                      <select
                        value={editCallBehavior.popupMode}
                        onChange={(event) => patchCallBehavior({ popupMode: event.target.value as PopupMode })}
                      >
                        {POPUP_MODES.map((mode) => (
                          <option key={mode.value} value={mode.value}>{t[mode.label]}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t.umPriorityDim}
                      <input
                        type="number"
                        min={-60}
                        max={0}
                        value={editCallBehavior.priorityDimDb}
                        onChange={(event) => patchCallBehavior({ priorityDimDb: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      {t.umToneLevel}
                      <input
                        type="number"
                        min={-60}
                        max={0}
                        value={editCallBehavior.toneLevelDb}
                        onChange={(event) => patchCallBehavior({ toneLevelDb: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      {t.umCueTimeout}
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={editCallBehavior.cueTimeoutSec}
                        onChange={(event) => patchCallBehavior({ cueTimeoutSec: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      {t.umActiveTime}
                      <input
                        type="number"
                        min={0}
                        max={600}
                        value={editCallBehavior.activeTimeSec}
                        onChange={(event) => patchCallBehavior({ activeTimeSec: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="checkGrid">
                    <label>
                      <input
                        type="checkbox"
                        checked={editCallBehavior.isolate}
                        onChange={(event) => patchCallBehavior({ isolate: event.target.checked })}
                      />
                      {t.umIsolate}
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={editCallBehavior.alertTone}
                        onChange={(event) => patchCallBehavior({ alertTone: event.target.checked })}
                      />
                      {t.umAlertTone}
                    </label>
                  </div>
                </div>

                <div className="actionRow">
                  <button onClick={() => saveUser(user.id)}>{t.umSave}</button>
                  <button onClick={() => setEditId(null)}>{t.umCancel}</button>
                </div>
              </div>
            ) : (
              <div className="deviceRowContent">
                <div>
                  <strong>{user.name}</strong>
                  <span className="badge wifi">{user.role.toUpperCase()}</span>
                  <small>{user.id}</small>
                </div>
                <small>
                  {t.umAssigned}: {user.assignedDeviceIds.length > 0 ? user.assignedDeviceIds.join(", ") : t.umNone}<br />
                  {t.umTalk}: {user.permissions.talkChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || t.umNone}<br />
                  {t.umListen}: {user.permissions.listenChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || t.umNone}<br />
                  {t.umTranscription}: {user.permissions.transcriptionChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || t.umNone}<br />
                  {t.umCall}: {(user.callBehavior?.replyMode || "ptt")}
                  {user.callBehavior?.isolate ? " · isolate" : ""}
                  {user.callBehavior?.alertTone ? " · alertTone" : ""}
                  {user.callBehavior?.activeTimeSec ? ` · active ${user.callBehavior.activeTimeSec}s` : ""}
                </small>
                <div className="actionRow">
                  <button onClick={() => startEdit(user)}>{t.umEdit}</button>
                  <button onClick={() => removeUser(user)}>{t.umRemove}</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
