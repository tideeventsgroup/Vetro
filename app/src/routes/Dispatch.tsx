import { FormEvent, useEffect, useState } from "react";
import { MessageIcon } from "../components/icons.js";
import { Message, Officer, useApi } from "../lib/api.js";

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// The control-room side of dispatch messaging — send a broadcast to every
// officer or a direct message to one. One-way for now: officers read here,
// they don't reply (see MyMessages.tsx) — this isn't officer-to-officer
// chat, it's the same kind of channel a radio dispatch call would be.
export function Dispatch() {
  const api = useApi();
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const [officerRows, messageRows] = await Promise.all([api.listOfficers(), api.listMessages()]);
      setOfficers(officerRows);
      setMessages(messageRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    setError(undefined);
    try {
      await api.sendMessage({ recipientId: recipientId || undefined, body: body.trim() });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dispatch</h1>
          <p>Broadcast to every officer, or message one directly.</p>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSend}>
          <div className="form-field">
            <label htmlFor="dispatchRecipient">Send to</label>
            <select id="dispatchRecipient" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
              <option value="">Everyone (broadcast)</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.firstName} {o.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="dispatchBody">Message</label>
            <textarea id="dispatchBody" rows={3} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={isSending}>
            <MessageIcon width={14} height={14} />
            {isSending ? "Sending…" : "Send"}
          </button>
        </form>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="card">
        <div className="card-header">
          <h2>Sent messages</h2>
        </div>
        {isLoading ? (
          <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
        ) : messages.length === 0 ? (
          <p style={{ color: "var(--vetro-text-muted)", fontSize: 14 }}>No messages sent yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sent</th>
                <th>To</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td>{formatDateTime(m.createdAt)}</td>
                  <td>{m.recipient ? `${m.recipient.firstName} ${m.recipient.lastName}` : "Everyone"}</td>
                  <td>{m.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
