import { useEffect, useState } from "react";
import { MessageIcon } from "../components/icons.js";
import { MyMessage, useApi } from "../lib/api.js";
import { MESSAGES_READ_EVENT } from "../lib/events.js";
import { formatDateTime } from "../lib/format.js";

// The field side of dispatch messaging — read-only, since this is a
// control-room-to-officer channel, not officer-to-officer chat. Polling on
// mount/focus rather than push (no websocket infra yet); opening the page
// marks everything visible as read, which is what clears the nav badge.
export function MyMessages() {
  const api = useApi();
  const [messages, setMessages] = useState<MyMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      const rows = await api.listMyMessages();
      setMessages(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load messages");
      return;
    } finally {
      setIsLoading(false);
    }

    // Marking read is best-effort and separate from the fetch above — a
    // failure here shouldn't make an already-successfully-loaded list look
    // broken to the officer.
    try {
      await api.markAllMessagesRead();
      window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
    } catch {
      // Nav badge just won't clear until the next poll; not worth surfacing.
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <p>Broadcasts and direct messages from your admin.</p>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {isLoading ? (
        <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>
      ) : messages.length === 0 ? (
        <div className="card empty-state">
          <span className="empty-icon">
            <MessageIcon />
          </span>
          <p>No messages yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m) => (
            <div className="card" key={m.id}>
              <div className="card-header">
                <h2 style={{ fontSize: 14 }}>{m.recipientId ? "Direct message" : "Broadcast"}</h2>
                <span className="subtle-meta" style={{ margin: 0 }}>
                  {formatDateTime(m.createdAt)}
                </span>
              </div>
              <p style={{ fontSize: 14, color: "var(--vetro-text-secondary)", margin: 0 }}>{m.body}</p>
              <p style={{ fontSize: 12, color: "var(--vetro-text-muted)", margin: "8px 0 0" }}>
                From {m.senderEmail}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
