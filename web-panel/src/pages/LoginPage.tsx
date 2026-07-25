import { useState, type FormEvent } from "react";
import { requestOtp, verifyOtp, updateMe, signUpload, uploadToSignedUrl, type InstitutionType, type KycStatus } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui";

type Step = "phone" | "otp" | "profile" | "documents";

export function LoginPage() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
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
    setError(null);
    setIsSubmitting(true);
    try {
      await requestOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const { token, user } = await verifyOtp(phone, code, name || undefined);
      
      // If the user hasn't submitted KYC, direct them to KYC steps first
      if (!user.kycStatus || user.kycStatus === "NOT_SUBMITTED") {
        setTempToken(token);
        setStep("profile");
      } else {
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
            <label>
              Phone number
              <input
                type="tel"
                placeholder="+919876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </label>
            <label>
              Institution contact name
              <input
                type="text"
                placeholder="First time only"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {error && <p className="error">{error}</p>}
            <Button type="submit" label="Send OTP" disabled={!phone} loading={isSubmitting} />
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <p className="hint">Enter the code sent to {phone}</p>
            <label>
              OTP code
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            {import.meta.env.DEV && <p className="dev-hint">Dev build: the OTP is always 123456 (D-015).</p>}
            {error && <p className="error">{error}</p>}
            <Button type="submit" label="Verify & continue" disabled={!code} loading={isSubmitting} />
            <button type="button" className="link" onClick={() => setStep("phone")}>
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
