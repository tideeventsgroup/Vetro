import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
  const [idToken, setIdToken] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(SKIP_AUTH);
  const [role, setRole] = useState<string | undefined>(SKIP_AUTH ? getDevRole() ?? "ADMIN" : undefined);
  const [officerId, setOfficerId] = useState<string | undefined>(SKIP_AUTH ? getDevOfficerId() : undefined);

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
    }),
    [isAuthenticated, isLoading, idToken, role, officerId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
