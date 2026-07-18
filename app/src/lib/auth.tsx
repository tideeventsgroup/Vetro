import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getDevOfficerId, getDevRole } from "./dev.js";

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  // The ID token, not the access token — the backend reads the tenant
  // assignment (custom:contractor_id) off it; see backend/src/lib/auth.ts.
  idToken?: string;
  // Decoded from the ID token's custom:role/custom:officer_id claims (or,
  // in SKIP_AUTH dev mode, from VITE_DEV_ROLE/VITE_DEV_OFFICER_ID) — purely
  // for client-side routing (admin dashboard vs officer portal). The
  // backend never trusts anything client-supplied; it re-derives both from
  // the verified token itself.
  role?: string;
  officerId?: string;
  /**
   * Reads whatever the ID token is *right now* — a stable function, not the
   * `idToken` field above. Use this (via lib/api.ts's useApi()) for any API
   * call, since `idToken` is a React state snapshot: code that calls
   * `login()`/`confirmSignUp()`/`refreshClaims()` and then immediately makes
   * an API call in the same handler (see routes/Signup.tsx) runs before
   * React has re-rendered with the new state, so a closure over `idToken`
   * would still see the stale (possibly undefined) pre-call value.
   */
  getIdToken: () => string | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Creates the raw Cognito account — email + password, nothing else (see infra/lib/auth-stack.ts's writeAttributes note). */
  signUp: (email: string, password: string) => Promise<void>;
  /** Confirms the emailed verification code so the account can sign in. */
  confirmSignUp: (email: string, code: string) => Promise<void>;
  /**
   * Re-pulls the session via Cognito's refresh-token flow, which mints a
   * fresh ID token reflecting whatever custom:* attributes the backend has
   * set *since* the current token was issued — the existing token is a
   * static JWT snapshot, so this is the only way to see a just-granted
   * custom:contractor_id/custom:role without signing out and back in.
   */
  refreshClaims: () => Promise<void>;
}

function claimsFromSession(session: CognitoUserSession): { role?: string; officerId?: string } {
  const payload = session.getIdToken().decodePayload() as Record<string, unknown>;
  return {
    role: typeof payload["custom:role"] === "string" ? (payload["custom:role"] as string) : undefined,
    officerId:
      typeof payload["custom:officer_id"] === "string" ? (payload["custom:officer_id"] as string) : undefined,
  };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getUserPool(): CognitoUserPool {
  return new CognitoUserPool({
    UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
    ClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(!SKIP_AUTH);
  const [idToken, setIdTokenState] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(SKIP_AUTH);
  const [role, setRole] = useState<string | undefined>(SKIP_AUTH ? getDevRole() ?? "ADMIN" : undefined);
  const [officerId, setOfficerId] = useState<string | undefined>(SKIP_AUTH ? getDevOfficerId() : undefined);

  // Mirrors `idToken` synchronously, so getIdToken() below is never a render
  // behind — see the getIdToken doc comment on AuthContextValue.
  const idTokenRef = useRef<string | undefined>(undefined);
  function setIdToken(token: string | undefined) {
    idTokenRef.current = token;
    setIdTokenState(token);
  }
  const getIdToken = useCallback(() => idTokenRef.current, []);

  useEffect(() => {
    if (SKIP_AUTH) return;

    const currentUser = getUserPool().getCurrentUser();
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (!err && session?.isValid()) {
        setIdToken(session.getIdToken().getJwtToken());
        const claims = claimsFromSession(session);
        setRole(claims.role);
        setOfficerId(claims.officerId);
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      idToken,
      getIdToken,
      role,
      officerId,
      login: (email, password) =>
        new Promise((resolve, reject) => {
          if (SKIP_AUTH) {
            setIsAuthenticated(true);
            resolve();
            return;
          }

          const user = new CognitoUser({ Username: email, Pool: getUserPool() });
          user.authenticateUser(new AuthenticationDetails({ Username: email, Password: password }), {
            onSuccess: (session) => {
              setIdToken(session.getIdToken().getJwtToken());
              const claims = claimsFromSession(session);
              setRole(claims.role);
              setOfficerId(claims.officerId);
              setIsAuthenticated(true);
              resolve();
            },
            onFailure: (err) => reject(err),
          });
        }),
      logout: () => {
        if (!SKIP_AUTH) getUserPool().getCurrentUser()?.signOut();
        setIsAuthenticated(false);
        setIdToken(undefined);
        setRole(undefined);
        setOfficerId(undefined);
      },
      signUp: (email, password) =>
        new Promise((resolve, reject) => {
          if (SKIP_AUTH) {
            resolve();
            return;
          }
          getUserPool().signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email })], [], (err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
      confirmSignUp: (email, code) =>
        new Promise((resolve, reject) => {
          if (SKIP_AUTH) {
            resolve();
            return;
          }
          const user = new CognitoUser({ Username: email, Pool: getUserPool() });
          user.confirmRegistration(code, true, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }),
      refreshClaims: () =>
        new Promise((resolve, reject) => {
          if (SKIP_AUTH) {
            resolve();
            return;
          }
          const currentUser = getUserPool().getCurrentUser();
          if (!currentUser) {
            reject(new Error("Not signed in"));
            return;
          }
          currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
            if (err || !session) {
              reject(err ?? new Error("No session"));
              return;
            }
            currentUser.refreshSession(session.getRefreshToken(), (refreshErr: Error | null, refreshed: CognitoUserSession) => {
              if (refreshErr || !refreshed) {
                reject(refreshErr ?? new Error("Could not refresh session"));
                return;
              }
              setIdToken(refreshed.getIdToken().getJwtToken());
              const claims = claimsFromSession(refreshed);
              setRole(claims.role);
              setOfficerId(claims.officerId);
              resolve();
            });
          });
        }),
    }),
    [isAuthenticated, isLoading, idToken, getIdToken, role, officerId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
