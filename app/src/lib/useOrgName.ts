import { useEffect, useState } from "react";
import { useApi } from "./api.js";

/** The signed-in account's own org name, for the sidebar — same GET /contractors/me every layout already relies on for tenant resolution post-login (see routes/Login.tsx). */
export function useOrgName(): string | undefined {
  const api = useApi();
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    api
      .getCurrentContractor()
      .then((contractor) => setName(contractor?.name))
      .catch(() => setName(undefined));
  }, []);

  return name;
}
