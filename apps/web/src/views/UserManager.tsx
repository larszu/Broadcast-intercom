import { useState } from "react";
import type { CoreState, IntercomUser, UserRole } from "@broadcast/shared";

interface Props {
  state: CoreState;
  api: <T = unknown>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown) => Promise<T>;
}

const USER_ROLES: UserRole[] = ["admin", "director", "operator", "talent"];

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function UserManager({ state, api }: Props) {
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
    });
    setEditId(null);
  }

  async function removeUser(user: IntercomUser) {
    if (!confirm(`User ${user.name} wirklich entfernen?`)) {
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
  }

  return (
    <div className="viewPanel">
      <h2>Users & Permissions</h2>
      <p className="inlineHint">Web-Clients und Handys werden wie Beltpacks behandelt und bekommen ihre Rechte ueber den zugewiesenen User.</p>

      <div className="addRow">
        <input
          placeholder="Neuer Benutzername"
          value={createName}
          onChange={(event) => setCreateName(event.target.value)}
        />
        <label>
          Rolle
          <select value={createRole} onChange={(event) => setCreateRole(event.target.value as UserRole)}>
            {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </label>
        <button onClick={addUser}>User anlegen</button>
      </div>

      <div className="deviceTable">
        {users.map((user) => (
          <div className="deviceRow" key={user.id}>
            {editId === user.id ? (
              <div className="deviceEdit">
                <label>Name<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
                <label>
                  Rolle
                  <select value={editRole} onChange={(event) => setEditRole(event.target.value as UserRole)}>
                    {USER_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label>Farbe<input type="color" value={editColor} onChange={(event) => setEditColor(event.target.value)} /></label>

                <div className="editSection">
                  <p>Talk Channels</p>
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
                  <p>Listen Channels</p>
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
                  <p>Transcription Channels</p>
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
                    All Call erlaubt
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={editCanManageDevices}
                      onChange={(event) => setEditCanManageDevices(event.target.checked)}
                    />
                    Darf Devices verwalten
                  </label>
                </div>

                <div className="actionRow">
                  <button onClick={() => saveUser(user.id)}>Save</button>
                  <button onClick={() => setEditId(null)}>Cancel</button>
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
                  Assigned: {user.assignedDeviceIds.length > 0 ? user.assignedDeviceIds.join(", ") : "none"}<br />
                  Talk: {user.permissions.talkChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || "none"}<br />
                  Listen: {user.permissions.listenChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || "none"}<br />
                  Transcription: {user.permissions.transcriptionChannelIds.map((id) => state.channels[id]?.name || id).join(", ") || "none"}
                </small>
                <div className="actionRow">
                  <button onClick={() => startEdit(user)}>Edit</button>
                  <button onClick={() => removeUser(user)}>Remove</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
