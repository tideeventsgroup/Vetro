import { FormEvent, useEffect, useState } from "react";
import { MailIcon, MapPinIcon, PlusIcon } from "../components/icons.js";
import { TemporaryPasswordReveal } from "../components/TemporaryPasswordReveal.js";
import { Site, useApi } from "../lib/api.js";
import { useCurrentLocation } from "../lib/geo.js";

export function Sites() {
  const api = useApi();
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSite, setShowAddSite] = useState(false);
  const [expandedId, setExpandedId] = useState<string | undefined>(undefined);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | undefined>(undefined);
  const [invitedPassword, setInvitedPassword] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [geofenceStatus, setGeofenceStatus] = useState<string | undefined>(undefined);
  const [isGeneratingSin, setIsGeneratingSin] = useState(false);
  const addSiteLocation = useCurrentLocation("newSiteLat", "newSiteLng");
  const editLocation = useCurrentLocation("editSiteLat", "editSiteLng");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    try {
      setSites(await api.listSites());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load sites");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddSite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const lat = String(form.get("latitude") || "");
    const lng = String(form.get("longitude") || "");
    const radius = String(form.get("geofenceRadiusM") || "");
    const headcount = String(form.get("requiredHeadcount") || "");
    await api.createSite({
      name: String(form.get("name")),
      address: String(form.get("address") || "") || undefined,
      clientContactName: String(form.get("clientContactName") || "") || undefined,
      clientContactEmail: String(form.get("clientContactEmail") || "") || undefined,
      latitude: lat ? Number(lat) : undefined,
      longitude: lng ? Number(lng) : undefined,
      geofenceRadiusM: radius ? Number(radius) : undefined,
      requiredHeadcount: headcount ? Number(headcount) : undefined,
    });
    setShowAddSite(false);
    await load();
  }

  async function handleSaveHeadcount(e: FormEvent<HTMLFormElement>, siteId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const headcount = String(form.get("requiredHeadcount") || "");
    setGeofenceStatus(undefined);
    try {
      await api.updateSite(siteId, { requiredHeadcount: headcount ? Number(headcount) : null });
      setGeofenceStatus("Required headcount saved");
      await load();
    } catch (err) {
      setGeofenceStatus(err instanceof Error ? err.message : "Could not save required headcount");
    }
  }

  async function handleSaveGeofence(e: FormEvent<HTMLFormElement>, siteId: string) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const lat = String(form.get("latitude") || "");
    const lng = String(form.get("longitude") || "");
    const radius = String(form.get("geofenceRadiusM") || "");
    setGeofenceStatus(undefined);
    try {
      await api.updateSite(siteId, {
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
        geofenceRadiusM: radius ? Number(radius) : null,
      });
      setGeofenceStatus("Geofence saved");
      await load();
    } catch (err) {
      setGeofenceStatus(err instanceof Error ? err.message : "Could not save geofence");
    }
  }

  function toggleExpand(site: Site) {
    setExpandedId((current) => (current === site.id ? undefined : site.id));
    setInviteEmail(site.clientContactEmail ?? "");
    setInviteStatus(undefined);
    setInvitedPassword(undefined);
  }

  async function handleInviteClient(siteId: string) {
    setInviteStatus(undefined);
    setInvitedPassword(undefined);
    try {
      const result = await api.inviteClient(siteId, inviteEmail.trim() || undefined);
      setInviteStatus(
        `Account created for ${result.email}. Email may not arrive (Cognito's sender is capped at 50/day) — share this temporary password directly if needed:`
      );
      setInvitedPassword(result.temporaryPassword);
      await load();
    } catch (err) {
      setInviteStatus(err instanceof Error ? err.message : "Could not send invitation");
    }
  }

  async function handleGenerateSin(siteId: string) {
    setIsGeneratingSin(true);
    try {
      await api.regenerateSiteSin(siteId);
      await load();
    } finally {
      setIsGeneratingSin(false);
    }
  }

  if (isLoading) return <p style={{ color: "var(--vetro-text-muted)" }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sites</h1>
          <p>The client sites and contracts your officers are scheduled against.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAddSite((v) => !v)}>
            {!showAddSite && <PlusIcon width={14} height={14} />}
            {showAddSite ? "Cancel" : "Add site"}
          </button>
        </div>
      </div>

      {error && <p className="error-text">{error}</p>}

      {showAddSite && (
        <div className="card">
          <form onSubmit={handleAddSite}>
            <div className="form-field">
              <label htmlFor="siteName">Name</label>
              <input id="siteName" name="name" required />
            </div>
            <div className="form-field">
              <label htmlFor="siteAddress">Address (optional)</label>
              <input id="siteAddress" name="address" />
            </div>
            <div className="form-field">
              <label htmlFor="clientContactName">Client contact name (optional)</label>
              <input id="clientContactName" name="clientContactName" />
            </div>
            <div className="form-field">
              <label htmlFor="clientContactEmail">Client contact email (optional)</label>
              <input id="clientContactEmail" name="clientContactEmail" type="email" />
            </div>
            <div className="form-field" style={{ maxWidth: 220 }}>
              <label htmlFor="requiredHeadcount">Required headcount (optional)</label>
              <input id="requiredHeadcount" name="requiredHeadcount" type="number" min="0" placeholder="e.g. 2" />
            </div>

            <p style={{ fontSize: 13, color: "var(--vetro-text-muted)", marginBottom: 8 }}>
              Set a geofence to require officers to be physically on site to clock in/out. Leave blank to
              skip GPS verification for this site.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                <label htmlFor="newSiteLat">Latitude</label>
                <input id="newSiteLat" name="latitude" type="number" step="any" />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                <label htmlFor="newSiteLng">Longitude</label>
                <input id="newSiteLng" name="longitude" type="number" step="any" />
              </div>
              <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                <label htmlFor="newSiteRadius">Radius (metres)</label>
                <input id="newSiteRadius" name="geofenceRadiusM" type="number" min="1" placeholder="e.g. 100" />
              </div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={addSiteLocation.fill} style={{ marginBottom: 12 }}>
              <MapPinIcon width={14} height={14} />
              Use my current location
            </button>
            {addSiteLocation.status && <p className="subtle-meta">{addSiteLocation.status}</p>}

            <button className="btn btn-primary" type="submit">
              Save site
            </button>
          </form>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="card empty-state">
          <p>No sites added yet. Add your first site to start scheduling.</p>
        </div>
      ) : (
        <div className="site-grid">
          {sites.map((site) => {
            const isExpanded = expandedId === site.id;
            return (
              <div className={`card site-card${isExpanded ? " site-card-expanded" : ""}`} key={site.id}>
                <button type="button" className="site-card-summary" onClick={() => toggleExpand(site)}>
                  <div>
                    <div className="site-card-name">{site.name}</div>
                    {site.address && (
                      <div className="site-card-address">
                        <MapPinIcon width={13} height={13} />
                        {site.address}
                      </div>
                    )}
                  </div>
                  <div className="site-card-contact">{site.clientContactEmail ?? "No client contact yet"}</div>
                </button>

                {isExpanded && (
                  <div className="site-card-manage">
                    <p style={{ fontSize: 13, marginBottom: 12, color: "var(--vetro-text-muted)" }}>
                      Give this site's client contact their own login to review and confirm shifts.
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
                      <div className="form-field" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                        <label htmlFor={`invite-${site.id}`}>Client email</label>
                        <input
                          id={`invite-${site.id}`}
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                        />
                      </div>
                      <button className="btn btn-secondary" onClick={() => handleInviteClient(site.id)}>
                        <MailIcon width={14} height={14} />
                        Send invite
                      </button>
                    </div>
                    {inviteStatus && <p className="subtle-meta">{inviteStatus}</p>}
                    {invitedPassword && <TemporaryPasswordReveal password={invitedPassword} />}

                    <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--vetro-border)" }} />
                    <p style={{ fontSize: 13, marginBottom: 12, color: "var(--vetro-text-muted)" }}>
                      {site.geofenceRadiusM != null
                        ? `Geofence: ${site.geofenceRadiusM}m radius — officers must be on site to clock in/out.`
                        : "No geofence set — clock-in/out isn't GPS-verified for this site."}
                    </p>
                    <form onSubmit={(e) => handleSaveGeofence(e, site.id)}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                          <label htmlFor="editSiteLat">Latitude</label>
                          <input
                            id="editSiteLat"
                            name="latitude"
                            type="number"
                            step="any"
                            defaultValue={site.latitude ?? ""}
                          />
                        </div>
                        <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                          <label htmlFor="editSiteLng">Longitude</label>
                          <input
                            id="editSiteLng"
                            name="longitude"
                            type="number"
                            step="any"
                            defaultValue={site.longitude ?? ""}
                          />
                        </div>
                        <div className="form-field" style={{ flex: 1, minWidth: 140 }}>
                          <label htmlFor="editSiteRadius">Radius (metres)</label>
                          <input
                            id="editSiteRadius"
                            name="geofenceRadiusM"
                            type="number"
                            min="1"
                            defaultValue={site.geofenceRadiusM ?? ""}
                          />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn btn-secondary" onClick={editLocation.fill}>
                          <MapPinIcon width={14} height={14} />
                          Use my current location
                        </button>
                        <button type="submit" className="btn btn-primary">
                          Save geofence
                        </button>
                      </div>
                    </form>
                    {editLocation.status && <p className="subtle-meta">{editLocation.status}</p>}
                    {geofenceStatus && <p className="subtle-meta">{geofenceStatus}</p>}

                    <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--vetro-border)" }} />
                    <p style={{ fontSize: 13, marginBottom: 12, color: "var(--vetro-text-muted)" }}>
                      Expected headcount for Live Site Occupancy to compare the currently clocked-in count
                      against.
                    </p>
                    <form
                      onSubmit={(e) => handleSaveHeadcount(e, site.id)}
                      style={{ display: "flex", gap: 8, alignItems: "flex-end" }}
                    >
                      <div className="form-field" style={{ marginBottom: 0, maxWidth: 160 }}>
                        <label htmlFor={`headcount-${site.id}`}>Required headcount</label>
                        <input
                          id={`headcount-${site.id}`}
                          name="requiredHeadcount"
                          type="number"
                          min="0"
                          defaultValue={site.requiredHeadcount ?? ""}
                        />
                      </div>
                      <button type="submit" className="btn btn-primary">
                        Save
                      </button>
                    </form>

                    <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid var(--vetro-border)" }} />
                    <p style={{ fontSize: 13, marginBottom: 12, color: "var(--vetro-text-muted)" }}>
                      A shared device at this site books officers on/off with this SIN and their own
                      PIN — no Cognito sign-in needed.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ fontFamily: "var(--vetro-font-mono, monospace)", fontSize: 20, fontWeight: 700, letterSpacing: 3 }}>
                        {site.sin ?? "— — — — — —"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleGenerateSin(site.id)}
                        disabled={isGeneratingSin}
                      >
                        {isGeneratingSin ? "Generating…" : site.sin ? "Regenerate SIN" : "Generate SIN"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
