import type { CustomMessageTriggerEvent, CustomMessageTriggerHandler } from "aws-lambda";

// Cognito's own invite email (AdminCreateUser) is otherwise a generic
// "here's your username and temporary password" with no mention of Lunara
// Screening, which org invited them, or where to go sign in. The backend passes orgName
// and loginUrl via ClientMetadata on AdminCreateUserCommand (see
// backend/src/lib/cognito.ts) specifically so this trigger can fill them in —
// no VPC/DB access needed here, everything arrives with the event. Every
// other trigger source (self-serve signup's verification code, forgot
// password, etc.) is untouched; Cognito uses its own default text.
export const handler: CustomMessageTriggerHandler = async (event: CustomMessageTriggerEvent) => {
  if (event.triggerSource !== "CustomMessage_AdminCreateUser") return event;

  const orgName = event.request.clientMetadata?.orgName;
  const loginUrl = event.request.clientMetadata?.loginUrl;
  const username = event.userName;

  event.response.emailSubject = orgName
    ? `You're invited to ${orgName} on Lunara Screening`
    : "You're invited to Lunara Screening";

  event.response.emailMessage = [
    orgName
      ? `You've been invited to join ${orgName} on Lunara Screening.`
      : "You've been invited to Lunara Screening.",
    "",
    `Username: ${username}`,
    // {####} is Cognito's own placeholder — it substitutes the real
    // temporary password into the delivered email, this Lambda never sees it.
    "Temporary password: {####}",
    "",
    loginUrl ? `Sign in here: ${loginUrl}` : undefined,
    "",
    "You'll be asked to set a new password the first time you sign in.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  return event;
};
