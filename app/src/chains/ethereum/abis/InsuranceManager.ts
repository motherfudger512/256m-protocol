export const insuranceManagerAbi = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "AI_ORACLE_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DEFAULT_ADMIN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "GUARDIAN_ROLE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "activePolicies",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "aiReviewClaim",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "decision",
        "type": "uint8",
        "internalType": "enum InsuranceManager.AIDecision"
      },
      {
        "name": "confidence",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "cancelPolicy",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "claims",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "claimType",
        "type": "uint8",
        "internalType": "enum InsuranceManager.ClaimType"
      },
      {
        "name": "claimAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "documentsHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "submittedAt",
        "type": "int64",
        "internalType": "int64"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum InsuranceManager.ClaimStatus"
      },
      {
        "name": "aiDecision",
        "type": "uint8",
        "internalType": "enum InsuranceManager.AIDecision"
      },
      {
        "name": "aiConfidence",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "manualReviewer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "reviewedAt",
        "type": "int64",
        "internalType": "int64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "createPolicy",
    "inputs": [
      {
        "name": "watchDetailsHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "insuredValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "premium",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deductibleBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "coverageType",
        "type": "uint8",
        "internalType": "enum InsuranceManager.CoverageType"
      },
      {
        "name": "paymentFrequency",
        "type": "uint8",
        "internalType": "enum InsuranceManager.PaymentFrequency"
      },
      {
        "name": "durationDays",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "outputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "customerPolicies",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "customers",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "kycHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "kycVerified",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "kycVerifiedAt",
        "type": "int64",
        "internalType": "int64"
      },
      {
        "name": "totalClaims",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "fraudFlags",
        "type": "uint8",
        "internalType": "uint8"
      },
      {
        "name": "createdAt",
        "type": "int64",
        "internalType": "int64"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dailyAutoPaid",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dailyAutoPayoutLimit",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "executeClaimPayout",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "flagCustomerFraud",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getClaim",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct InsuranceManager.Claim",
        "components": [
          {
            "name": "claimId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "policyId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "customer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "claimType",
            "type": "uint8",
            "internalType": "enum InsuranceManager.ClaimType"
          },
          {
            "name": "claimAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "documentsHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "submittedAt",
            "type": "int64",
            "internalType": "int64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum InsuranceManager.ClaimStatus"
          },
          {
            "name": "aiDecision",
            "type": "uint8",
            "internalType": "enum InsuranceManager.AIDecision"
          },
          {
            "name": "aiConfidence",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "manualReviewer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "reviewedAt",
            "type": "int64",
            "internalType": "int64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCustomer",
    "inputs": [
      {
        "name": "owner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct InsuranceManager.Customer",
        "components": [
          {
            "name": "owner",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "kycHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "kycVerified",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "kycVerifiedAt",
            "type": "int64",
            "internalType": "int64"
          },
          {
            "name": "totalClaims",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "fraudFlags",
            "type": "uint8",
            "internalType": "uint8"
          },
          {
            "name": "createdAt",
            "type": "int64",
            "internalType": "int64"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getCustomerPolicies",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPolicy",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct InsuranceManager.Policy",
        "components": [
          {
            "name": "policyId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "customer",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "coverageType",
            "type": "uint8",
            "internalType": "enum InsuranceManager.CoverageType"
          },
          {
            "name": "watchDetailsHash",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "insuredValue",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "premium",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "deductibleBps",
            "type": "uint16",
            "internalType": "uint16"
          },
          {
            "name": "paymentFrequency",
            "type": "uint8",
            "internalType": "enum InsuranceManager.PaymentFrequency"
          },
          {
            "name": "startDate",
            "type": "int64",
            "internalType": "int64"
          },
          {
            "name": "expiryDate",
            "type": "int64",
            "internalType": "int64"
          },
          {
            "name": "status",
            "type": "uint8",
            "internalType": "enum InsuranceManager.PolicyStatus"
          },
          {
            "name": "totalPaid",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "nextPaymentDue",
            "type": "int64",
            "internalType": "int64"
          },
          {
            "name": "claimCount",
            "type": "uint8",
            "internalType": "uint8"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRoleAdmin",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "grantRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "hasRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_stablecoin",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_liquidityPool",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_platformFeeBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "_maxPolicies",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxInsuredValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxAutoPayoutAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_dailyAutoPayoutLimit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "initialized",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "lastResetDay",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "liquidityPool",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract LiquidityPool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "manualReviewClaim",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "approve",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "maxAutoPayoutAmount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxInsuredValue",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "maxPolicies",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "paidClaims",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "pause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "paused",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "payPremium",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "platformFeeBps",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint16",
        "internalType": "uint16"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "policies",
    "inputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "coverageType",
        "type": "uint8",
        "internalType": "enum InsuranceManager.CoverageType"
      },
      {
        "name": "watchDetailsHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "insuredValue",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "premium",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "deductibleBps",
        "type": "uint16",
        "internalType": "uint16"
      },
      {
        "name": "paymentFrequency",
        "type": "uint8",
        "internalType": "enum InsuranceManager.PaymentFrequency"
      },
      {
        "name": "startDate",
        "type": "int64",
        "internalType": "int64"
      },
      {
        "name": "expiryDate",
        "type": "int64",
        "internalType": "int64"
      },
      {
        "name": "status",
        "type": "uint8",
        "internalType": "enum InsuranceManager.PolicyStatus"
      },
      {
        "name": "totalPaid",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "nextPaymentDue",
        "type": "int64",
        "internalType": "int64"
      },
      {
        "name": "claimCount",
        "type": "uint8",
        "internalType": "uint8"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerCustomer",
    "inputs": [
      {
        "name": "kycHash",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rejectClaim",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "reason",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rejectedClaims",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "renounceRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "callerConfirmation",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeRole",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "stablecoin",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "submitClaim",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "claimType",
        "type": "uint8",
        "internalType": "enum InsuranceManager.ClaimType"
      },
      {
        "name": "documentsHash",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "claimedAmount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "supportsInterface",
    "inputs": [
      {
        "name": "interfaceId",
        "type": "bytes4",
        "internalType": "bytes4"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalClaims",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPaidOut",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPolicies",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalPremiumsCollected",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "unpause",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updatePayoutLimits",
    "inputs": [
      {
        "name": "_maxAutoPayoutAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_dailyAutoPayoutLimit",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updatePolicyStatus",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "newStatus",
        "type": "uint8",
        "internalType": "enum InsuranceManager.PolicyStatus"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "verifyCustomer",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "AIReviewCompleted",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "decision",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum InsuranceManager.AIDecision"
      },
      {
        "name": "confidence",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClaimPaid",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClaimRejected",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "reviewer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "reason",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ClaimSubmitted",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "claimType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum InsuranceManager.ClaimType"
      },
      {
        "name": "claimAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CustomerFraudFlagged",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "fraudFlags",
        "type": "uint8",
        "indexed": false,
        "internalType": "uint8"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CustomerRegistered",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "kycHash",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "CustomerVerified",
    "inputs": [
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ManualReviewCompleted",
    "inputs": [
      {
        "name": "claimId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "reviewer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "approved",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Paused",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PayoutLimitsUpdated",
    "inputs": [
      {
        "name": "maxAutoPayoutAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "dailyAutoPayoutLimit",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyCancelled",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyCreated",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "insuredValue",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "premium",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "coverageType",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum InsuranceManager.CoverageType"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyStatusUpdated",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "oldStatus",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum InsuranceManager.PolicyStatus"
      },
      {
        "name": "newStatus",
        "type": "uint8",
        "indexed": false,
        "internalType": "enum InsuranceManager.PolicyStatus"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PremiumPaid",
    "inputs": [
      {
        "name": "policyId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "customer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "platformFee",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "poolAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "ProtocolInitialized",
    "inputs": [
      {
        "name": "admin",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "platformFeeBps",
        "type": "uint16",
        "indexed": false,
        "internalType": "uint16"
      },
      {
        "name": "maxPolicies",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleAdminChanged",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "previousAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "newAdminRole",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleGranted",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RoleRevoked",
    "inputs": [
      {
        "name": "role",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Unpaused",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AccessControlBadConfirmation",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AccessControlUnauthorizedAccount",
    "inputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "neededRole",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ]
  },
  {
    "type": "error",
    "name": "AlreadyInitialized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CannotCancelWithClaims",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ClaimNotApproved",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ClaimNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ClaimTypeNotCovered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CustomerAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "CustomerNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DailyPayoutLimitReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EnforcedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExceedsMaxAutoPayout",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExceedsRegulationLimit",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ExpectedPause",
    "inputs": []
  },
  {
    "type": "error",
    "name": "FeeTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsufficientPayment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InsuredValueTooHigh",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidClaimStatus",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidConfidence",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDeductible",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDuration",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPolicyTransition",
    "inputs": []
  },
  {
    "type": "error",
    "name": "KYCNotVerified",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MaxPoliciesReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoPremiumPaid",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotInitialized",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PayoutExceedsInsuredValue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyAlreadyClaimed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyNotActive",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PolicyNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ReentrancyGuardReentrantCall",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SafeERC20FailedOperation",
    "inputs": [
      {
        "name": "token",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "Unauthorized",
    "inputs": []
  }
] as const;
