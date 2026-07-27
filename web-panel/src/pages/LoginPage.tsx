import { useState, type FormEvent } from "react";
import { requestOtp, verifyOtp, updateMe, signUpload, uploadToSignedUrl, type InstitutionType, type KycStatus } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button, Input } from "../components/ui";

type Step = "phone" | "otp" | "profile" | "documents";

// Normalise to 10 digits — strips leading +91/91 prefix if the user pastes a full number.
function normalise(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length > 10) s = s.slice(2);
  return s.replace(/\D/g, "").slice(0, 10);
}


export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [isRegistered, setIsRegistered] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auth tokens saved after OTP verification before KYC is completed
  const [tempToken, setTempToken] = useState<string | null>(null);

  // Step 2: Profile fields
  const [institutionType, setInstitutionType] = useState<InstitutionType>("NGO");
  const [legalName, setLegalName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [darpanId, setDarpanId] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // Step 3: Document fields
  const [docFile, setDocFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);

  async function handleRequestOtp(e: FormEvent) {
    e.preventDefault();
    if (phone.length !== 10) {
      return setError("Enter a valid 10-digit mobile number");
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await requestOtp("+91" + phone);
      setIsRegistered(res.registered);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      return setError("Enter a valid 6-digit code");
    }
    if (!isRegistered && !name.trim()) {
      return setError("Institution contact name is required for registration");
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user } = await verifyOtp("+91" + phone, code, name || undefined);
      
      // Admin and Staff accounts cannot log in to the Institution Partner Panel
      if (user.role === "ADMIN" || user.role === "STAFF") {
        return setError("Access denied: Admin and Staff accounts cannot log in to the Institution Partner Panel. Please use the Admin Console.");
      }

      // Ask for KYC details ONLY for newly registered accounts that haven't submitted KYC yet
      if (!user.kycStatus || user.kycStatus === "NOT_SUBMITTED") {
        setTempToken(token);
        setStep("profile");
      } else {
        // KYC already submitted (PENDING_APPROVAL, APPROVED, or REJECTED) — sign in directly
        signIn(token, user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Incorrect or expired OTP");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (!legalName.trim()) return setError("Legal organization name is required");
    if (!registrationNumber.trim()) return setError("Registration number is required");
    if (institutionType === "NGO" && !darpanId.trim()) return setError("NGOs require a Darpan ID");
    if (!address.trim()) return setError("Address is required");
    if (!bankAccount.trim()) return setError("Bank account is required");

    setError(null);
    setStep("documents");
  }

  async function handleKycSubmit(e: FormEvent) {
    e.preventDefault();
    if (!tempToken) return;
    if (!docFile) return setError("Please select your organization identity certificate (PDF/JPEG/PNG)");

    setError(null);
    setIsSubmitting(true);
    try {
      // 1. Upload main identity document
      const docSigned = await signUpload(tempToken, docFile.type, "kyc-docs");
      await uploadToSignedUrl(docSigned.uploadUrl, docFile);
      const documentUrl = docSigned.publicUrl;

      // 2. Upload photos in sequence (optional)
      const photoUrls: string[] = [];
      if (photoFiles && photoFiles.length > 0) {
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          const photoSigned = await signUpload(tempToken, file.type, "kyc-docs");
          await uploadToSignedUrl(photoSigned.uploadUrl, file);
          photoUrls.push(photoSigned.publicUrl);
        }
      }

      // 3. Patch profile and submit for review
      const { user: updatedUser } = await updateMe(tempToken, {
        name: name || undefined,
        institutionType,
        legalName: legalName.trim(),
        registrationNumber: registrationNumber.trim(),
        darpanId: institutionType === "NGO" ? darpanId.trim() : null,
        address: address.trim(),
        bankAccount: bankAccount.trim(),
        kycDocumentUrl: documentUrl,
        kycPhotos: photoUrls,
        kycStatus: "PENDING_APPROVAL" as KycStatus,
      });

      // 4. Log in!
      signIn(tempToken, updatedUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit KYC registration");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: step === "profile" || step === "documents" ? 540 : 400 }}>
        <h1>DonationPlatform</h1>
        <p className="subtitle">Institution partner panel</p>

        {step === "phone" && (
          <form onSubmit={handleRequestOtp}>
            <Input
              label="Phone number"
              type="tel"
              placeholder="98765 43210"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(normalise(e.target.value))}
              prefix="+91"
              required
            />
            {error && <p className="error" style={{ marginTop: "16px" }}>{error}</p>}
            <Button type="submit" label="Send OTP" disabled={phone.length < 10} loading={isSubmitting} style={{ width: "100%", marginTop: "16px" }} />
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <p className="hint" style={{ marginBottom: "16px" }}>Enter the code sent to +91 {phone}</p>
            <Input
              label="OTP code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              required
            />
            {!isRegistered && (
              <div style={{ marginTop: "16px" }}>
                <Input
                  label="Institution contact name"
                  type="text"
                  placeholder="Your Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}
            {import.meta.env.DEV && <p className="dev-hint" style={{ marginTop: "8px", marginBottom: "16px" }}>Dev build: the OTP is always 123456 (D-015).</p>}
            {error && <p className="error" style={{ marginBottom: "16px" }}>{error}</p>}
            <Button type="submit" label="Verify & continue" disabled={code.length < 6} loading={isSubmitting} style={{ width: "100%", marginTop: "16px" }} />
            <button
              type="button"
              className="link"
              onClick={() => { setStep("phone"); setError(null); }}
              style={{ marginTop: "16px", display: "block", marginLeft: "auto", marginRight: "auto" }}
            >
              Change phone number
            </button>
          </form>
        )}

        {step === "profile" && (
          <form onSubmit={handleProfileSubmit}>
            <h2>Step 2: Organization Profile</h2>
            <p className="hint">Fill in details for your institution to register.</p>

            <label>
              Organization Type
              <select
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  fontSize: "14px",
                  marginBottom: "16px",
                  outline: "none",
                }}
              >
                <option value="NGO">NGO</option>
                <option value="HOSPITAL">Hospital</option>
                <option value="BLOOD_BANK">Blood Bank</option>
                <option value="ORPHANAGE">Orphanage</option>
              </select>
            </label>

            <label>
              Legal Organization Name
              <input
                type="text"
                placeholder="e.g. Hope Foundation"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                required
              />
            </label>

            <label>
              Registration Number
              <input
                type="text"
                placeholder="License or Reg No."
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                required
              />
            </label>

            {institutionType === "NGO" && (
              <label>
                Darpan ID
                <input
                  type="text"
                  placeholder="NGO Darpan ID"
                  value={darpanId}
                  onChange={(e) => setDarpanId(e.target.value)}
                  required
                />
              </label>
            )}

            <label>
              Organization Address
              <textarea
                placeholder="Full physical address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                required
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--color-border)",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  marginBottom: "16px",
                  outline: "none",
                }}
              />
            </label>

            <label>
              Bank Account Details
              <input
                type="text"
                placeholder="Account No, Bank Name, IFSC"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                required
              />
            </label>

            {error && <p className="error">{error}</p>}
            
            <div style={{ display: "flex", gap: "12px" }}>
              <Button type="submit" label="Continue" />
              <button
                type="button"
                className="btn-secondary-outline"
                style={{ flex: 1 }}
                onClick={() => setStep("otp")}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {step === "documents" && (
          <form onSubmit={handleKycSubmit}>
            <h2>Step 3: Document Verification</h2>
            <p className="hint">Upload certificates and images to verify your organization.</p>

            <label style={{ display: "block", marginBottom: "16px" }}>
              Identity Certificate (PDF, JPEG, or PNG)
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                required
                style={{ display: "block", marginTop: "8px" }}
              />
            </label>

            <label style={{ display: "block", marginBottom: "24px" }}>
              Organization Photos (Select multiple)
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={(e) => setPhotoFiles(e.target.files)}
                style={{ display: "block", marginTop: "8px" }}
              />
            </label>

            {error && <p className="error">{error}</p>}
            
            <div style={{ display: "flex", gap: "12px" }}>
              <Button type="submit" label="Submit KYC Registration" loading={isSubmitting} />
              <button
                type="button"
                className="btn-secondary-outline"
                style={{ flex: 1 }}
                onClick={() => setStep("profile")}
                disabled={isSubmitting}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
