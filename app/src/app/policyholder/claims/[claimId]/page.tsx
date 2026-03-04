"use client";

import { useParams } from "next/navigation";

export default function ClaimDetailPage() {
  const params = useParams();
  const claimId = params.claimId as string;

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold mb-4">Claim #{claimId}</h2>
      <p className="text-gray-400">
        Claim details are fetched by deriving the claim PDA from the policy
        public key and claim ID. To view a specific claim, navigate from the
        claims list with both the policy context and claim ID.
      </p>
    </div>
  );
}
