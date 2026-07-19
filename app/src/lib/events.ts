// Fired after MyMessages.tsx marks everything visible as read, so
// PortalLayout's unread badge can refresh immediately instead of waiting for
// its next 60s poll — there's no shared state between the two components
// otherwise (no websocket/store), so a plain DOM CustomEvent is the least
// machinery that gets the badge back in sync right away.
export const MESSAGES_READ_EVENT = "vetro:messages-read";
