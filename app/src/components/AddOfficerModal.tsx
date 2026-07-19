import { FormEvent, useState } from "react";
import { EmploymentType, OfficerHrInput, PayRateType } from "../lib/api.js";

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CASUAL: "Casual",
  ZERO_HOURS: "Zero-hours",
};

const PAY_RATE_TYPE_LABELS: Record<PayRateType, string> = {
  HOURLY: "Per hour",
  DAILY: "Per day",
  SALARY: "Per year (salary)",
};

// Captures the full HR record at the point an officer's added, not just the
// name/email/phone needed to invite them — a security contractor running
// this as their staff system needs the same starter paperwork any employer
// does (DOB, NI number, address, emergency contact, employment terms), even
// though every field past name stays optional since not all of it always
// arrives on day one.
export function AddOfficerModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: { firstName: string; lastName: string } & OfficerHrInput) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [nationalInsuranceNumber, setNationalInsuranceNumber] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [employmentType, setEmploymentType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [payRate, setPayRate] = useState("");
  const [payRateType, setPayRateType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await onSubmit({
        firstName,
        lastName,
        email: email || undefined,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        nationalInsuranceNumber: nationalInsuranceNumber || undefined,
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        postcode: postcode || undefined,
        emergencyContactName: emergencyContactName || undefined,
        emergencyContactPhone: emergencyContactPhone || undefined,
        emergencyContactRelationship: emergencyContactRelationship || undefined,
        employeeNumber: employeeNumber || undefined,
        jobTitle: jobTitle || undefined,
        employmentType: (employmentType || undefined) as EmploymentType | undefined,
        startDate: startDate || undefined,
        payRate: payRate ? Number(payRate) : undefined,
        payRateType: (payRateType || undefined) as PayRateType | undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add officer");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="card modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, maxHeight: "85vh", overflowY: "auto" }}
      >
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Add officer</h2>
        <form onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}

          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "0 0 8px" }}>
            Personal details
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="firstName">First name</label>
              <input id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="officerEmail">Email</label>
              <input id="officerEmail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="officerPhone">Phone</label>
              <input id="officerPhone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="officerDob">Date of birth</label>
              <input id="officerDob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="officerNi">National Insurance number</label>
              <input id="officerNi" value={nationalInsuranceNumber} onChange={(e) => setNationalInsuranceNumber(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="officerAddress1">Address line 1</label>
            <input id="officerAddress1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="officerAddress2">Address line 2</label>
            <input id="officerAddress2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 2 }}>
              <label htmlFor="officerCity">City</label>
              <input id="officerCity" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="officerPostcode">Postcode</label>
              <input id="officerPostcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </div>
          </div>

          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "16px 0 8px" }}>
            Emergency contact
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="emergencyName">Name</label>
              <input id="emergencyName" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="emergencyPhone">Phone</label>
              <input id="emergencyPhone" type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="emergencyRelationship">Relationship</label>
              <input
                id="emergencyRelationship"
                value={emergencyContactRelationship}
                onChange={(e) => setEmergencyContactRelationship(e.target.value)}
              />
            </div>
          </div>

          <h3 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--vetro-text-muted)", margin: "16px 0 8px" }}>
            Employment
          </h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="employeeNumber">Employee number</label>
              <input id="employeeNumber" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="jobTitle">Job title</label>
              <input id="jobTitle" placeholder="e.g. Door Supervisor" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="employmentType">Employment type</label>
              <select id="employmentType" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
                <option value="">—</option>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="startDate">Start date</label>
              <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="payRate">Pay rate (£)</label>
              <input id="payRate" type="number" min="0" step="0.01" value={payRate} onChange={(e) => setPayRate(e.target.value)} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label htmlFor="payRateType">Pay basis</label>
              <select id="payRateType" value={payRateType} onChange={(e) => setPayRateType(e.target.value)}>
                <option value="">—</option>
                {Object.entries(PAY_RATE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add officer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
