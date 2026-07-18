import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserPool,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

const SKIP_AUTH = import.meta.env.VITE_SKIP_AUTH === "true";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken?: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState(SKIP_AUTH);

  useEffect(() => {
    if (SKIP_AUTH) return;

    const currentUser = getUserPool().getCurrentUser();
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    currentUser.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (!err && session?.isValid()) {
        setAccessToken(session.getAccessToken().getJwtToken());
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      accessToken,
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
              setAccessToken(session.getAccessToken().getJwtToken());
              setIsAuthenticated(true);
              resolve();
            },
            onFailure: (err) => reject(err),
          });
        }),
      logout: () => {
        if (!SKIP_AUTH) getUserPool().getCurrentUser()?.signOut();
        setIsAuthenticated(false);
        setAccessToken(undefined);
      },
    }),
    [isAuthenticated, isLoading, accessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
