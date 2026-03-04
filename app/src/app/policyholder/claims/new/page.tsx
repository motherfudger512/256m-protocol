"use client";

import { useState, useRef } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { usePolicyholder } from "@/hooks/usePolicyholder";
import { usePolicies } from "@/hooks/usePolicies";
import { TransactionToast } from "@/components/shared/TransactionToast";
import { usdcToBase, getEnumVariant, baseToUsdc } from "@/lib/formatting";

// Generate a deterministic-looking case reference from the current timestamp
function generateCaseNumber(): string {
  const now = Date.now();
  const hex = now.toString(16).toUpperCase().slice(-8);
  return `CLM-${hex}`;
}

export default function NewClaimPage() {
  const wallet = useAnchorWallet();
  const { submitClaim, loading, error, txSignature } = usePolicyholder();
  const { policies, loading: policiesLoading } = usePolicies();

  const [selectedPolicyIdx, setSelectedPolicyIdx] = useState<number>(-1);
  const [claimType, setClaimType] = useState<"theft" | "loss">("theft");
  const [claimedAmount, setClaimedAmount] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [claimSubmitted, setClaimSubmitted] = useState(false);
  const [caseNumber, setCaseNumber] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePolicies = policies.filter(
    (p: any) => getEnumVariant(p.account.status) === "active",
  );

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError("");
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError("Only PDF, PNG, and JPG files are accepted.");
      setFileName("");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File exceeds the 10MB limit (${(file.size / 1024 / 1024).toFixed(1)}MB).`);
      setFileName("");
      e.target.value = "";
      return;
    }

    setFileName(file.name);
  };

  const handleSubmit = async () => {
    if (selectedPolicyIdx < 0 || !claimedAmount || !description.trim()) return;
    const policy = activePolicies[selectedPolicyIdx];

    // Build a document reference hash from the description + filename
    const docRef = `${description.slice(0, 20)}|${fileName || "none"}`;
    const docHash = Array.from(
      Buffer.from(docRef.padEnd(32, "\0").slice(0, 32), "utf-8"),
    );

    try {
      await submitClaim(
        policy.publicKey,
        claimType === "theft" ? { theft: {} } : { loss: {} },
        docHash,
        usdcToBase(parseFloat(claimedAmount)),
      );
      const ref = generateCaseNumber();
      setCaseNumber(ref);
      setClaimSubmitted(true);
    } catch {
      // error handled by hook
    }
  };

  if (policiesLoading) return <div className="text-gray-500">Loading...</div>;

  // ── Claim submitted confirmation ──────────────────────────────────────
  if (claimSubmitted) {
    return (
      <div className="max-w-lg">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-2xl font-bold mb-2">Claim Submitted</h2>
          <p className="text-gray-400 text-sm mb-6">
            Your claim has been submitted successfully.
          </p>
        </div>

        <div className="rounded-lg border border-brand-500/30 bg-brand-950/20 p-5 mb-6">
          <div className="text-center mb-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Your Case Reference</div>
            <div className="text-2xl font-bold font-mono text-brand-400">{caseNumber}</div>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Please keep this reference number for your records. You can use it to track the status of your claim.
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-300">What happens next</h3>
          <p className="text-sm text-gray-400 leading-relaxed">
            We aim to respond to all claims within <span className="text-white font-medium">24 hours</span>, provided
            all supporting documents have been properly submitted. If we require further information, we will reach
            out to you via the email address used during your initial registration.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed">
            Please check your inbox for a confirmation of your claim submission and your case reference number.
          </p>
        </div>

        <a
          href="/policyholder/claims"
          className="block text-center mt-6 bg-brand-600 hover:bg-brand-700 rounded px-6 py-2 text-sm font-medium transition-colors"
        >
          View Your Claims
        </a>

        <TransactionToast loading={loading} error={error} txSignature={txSignature} />
      </div>
    );
  }

  // ── Claim form ────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg">
      <h2 className="text-2xl font-bold mb-1">File a Claim</h2>
      <p className="text-gray-500 text-sm mb-6">
        Submit a claim against one of your active policies. Please provide all required documents to avoid delays.
      </p>

      {activePolicies.length === 0 ? (
        <p className="text-gray-400">
          You have no active policies. Get a quote and create a policy first.
        </p>
      ) : (
        <div className="space-y-5">
          {/* Policy selection */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Select Policy
            </label>
            <select
              value={selectedPolicyIdx}
              onChange={(e) => setSelectedPolicyIdx(parseInt(e.target.value))}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value={-1}>-- Select a policy --</option>
              {activePolicies.map((p: any, i: number) => (
                <option key={i} value={i}>
                  Policy #{p.account.policyId.toNumber()} &mdash; Insured:{" "}
                  {baseToUsdc(p.account.insuredValue)} USDC
                </option>
              ))}
            </select>
          </div>

          {/* Claim type & amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Claim Type
              </label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as any)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="theft">Theft</option>
                <option value="loss">Loss</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Claimed Amount (USDC)
              </label>
              <input
                type="number"
                value={claimedAmount}
                onChange={(e) => setClaimedAmount(e.target.value)}
                placeholder="5000"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Description of Incident
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the circumstances of the theft or loss, including when and where it occurred..."
              rows={4}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Upload Supporting Documents
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gray-900 border border-dashed border-gray-700 rounded px-4 py-5 text-center cursor-pointer hover:border-brand-500 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
              {fileName ? (
                <div>
                  <span className="text-sm text-brand-400 font-medium">{fileName}</span>
                  <p className="text-xs text-gray-500 mt-1">Click to change file</p>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-400">
                    Click to upload a file
                  </div>
                  <p className="text-xs text-gray-600 mt-1">PDF, PNG, or JPG &middot; Max 10MB</p>
                </div>
              )}
            </div>
            {fileError && (
              <p className="text-red-400 text-xs mt-1.5">{fileError}</p>
            )}
          </div>

          {/* Document guidelines */}
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Required Documents
            </h4>
            <ul className="space-y-1.5 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">&#8226;</span>
                <span><span className="text-gray-300 font-medium">Police report</span> &mdash; a copy of the official report filed with local authorities (PDF or image)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">&#8226;</span>
                <span><span className="text-gray-300 font-medium">Incident description</span> &mdash; a written account of what happened, including date, time, and location</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">&#8226;</span>
                <span><span className="text-gray-300 font-medium">Proof of ownership</span> &mdash; receipt, warranty card, or certificate of authenticity (if not already on file)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand-400 mt-0.5">&#8226;</span>
                <span><span className="text-gray-300 font-medium">Photographic evidence</span> &mdash; any relevant photos, e.g. damage to a safe, CCTV stills, etc.</span>
              </li>
            </ul>
            <p className="text-xs text-gray-600 mt-3">
              Incomplete submissions may delay processing. If you are unable to provide any of the above, please explain in the description field.
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || selectedPolicyIdx < 0 || !claimedAmount || !description.trim()}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded px-4 py-2 text-sm font-medium transition-colors"
          >
            {loading ? "Submitting Claim..." : "Submit Claim"}
          </button>
        </div>
      )}

      <TransactionToast loading={loading} error={error} txSignature={txSignature} />
    </div>
  );
}
