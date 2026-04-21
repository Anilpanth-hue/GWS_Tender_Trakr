// ─── Core Tender Types ────────────────────────────────────────────────────────

export type TenderStatus = 'pending' | 'qualified' | 'rejected';
export type ScreeningDecision = 'accepted' | 'rejected' | 'pending';
export type ScrapeSession = 'morning' | 'afternoon' | 'live' | 'manual';

export interface RawTender {
  title: string;
  tenderNo: string;
  issuedBy: string;
  estimatedValue: number | null;
  estimatedValueRaw: string;
  dueDate: string | null;
  publishedDate: string | null;
  location: string;
  category: string;
  detailUrl: string;
  sourceSession: ScrapeSession;
}

/** Structured overview data extracted from the Tender247 detail page */
export interface TenderOverview {
  t247Id: string;
  orgTenderId: string;
  estimatedCost: string;
  emdValue: string;
  documentFees: string;
  completionPeriod: string;
  siteLocation: string;
  contactPerson: string;
  contactAddress: string;
  quantity: string;
  msmeExemption: string;
  startupExemption: string;
  jvConsortium: string;
  performanceBankGuarantee: string;
  hardCopySubmission: string;
  eligibilityCriteria: string;
  pqcSummary: string;
  fullSummaryText: string;   // raw AI-summary section from T247 detail page
  fetchedAt: string;
}

export interface Tender {
  id: number;
  title: string;
  tenderNo: string;
  issuedBy: string;
  estimatedValue: number | null;
  estimatedValueRaw: string;
  dueDate: string | null;
  publishedDate: string | null;
  location: string;
  category: string;
  detailUrl: string;
  tenderOverview: TenderOverview | null;
  sourceSession: ScrapeSession;
  scrapeRunId: number;

  // Level 1 screening
  l1Status: TenderStatus;
  l1QualificationReasons: string[];
  l1ExclusionReason: string | null;

  // Level 1 human decision
  l1Decision: ScreeningDecision;
  l1DecisionReason: string | null;
  l1DecisionBy: string | null;
  l1DecisionAt: string | null;

  // Level 2 analysis
  l2Analyzed: boolean;
  l2Analysis: TenderL2Analysis | null;

  createdAt: string;
  updatedAt: string;
}

export interface TenderL2Analysis {
  // Core tender details
  scopeOfWork: string;
  pqcRequirements: {
    turnoverCriteria: string;
    experienceCriteria: string;
    technicalCriteria: string;
    otherCriteria: string;
  };
  emdAmount: string;
  performanceBankGuarantee: string;
  contractDuration: string;
  consortiumJv: string;
  mseExemptions: string;
  startupExemptions: string;
  bidEvaluationProcess: string;
  tenderSchedule: {
    preBidMeetings: string;
    bidDate: string;
    openingDate: string;
  };
  keyTermsAndConditions: string[];

  // GWS-specific intelligence
  gwsRelevanceScore: number;           // 1–10
  gwsRelevanceReason: string;          // why this tender is/isn't relevant to GWS
  relevantBusinessLines: string[];     // e.g. ["Freight Forwarding", "Port Handling"]
  winProbabilityAssessment: string;    // High / Medium / Low + reasoning
  keyRisks: string[];                  // risks GWS should be aware of
  recommendedAction: string;           // Bid / No-Bid / Evaluate Further / Consortium
  competitiveInsights: string;         // market context, typical competitors
  estimatedRevenuePotential: string;   // rough revenue / margin estimate if GWS wins

  otherNotableTakeaways: string[];
  contactDetails?: {
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
  };
  analyzedAt: string;
}

export interface TenderDocument {
  id: number;
  tenderId: number;
  fileName: string;
  filePath: string | null;
  downloadUrl: string | null;
  docType: 'summary_pdf' | 'full_docs_zip' | 'other';
  fileSize: number | null;
  createdAt: string;
}

export interface ScrapeRun {
  id: number;
  session: ScrapeSession;
  status: 'running' | 'completed' | 'failed';
  totalFound: number;
  totalQualified: number;
  totalRejected: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

// ─── Screening Config (DB-driven) ─────────────────────────────────────────────

export interface ScreeningConfig {
  qualifyKeywords: string[];
  keyAuthorities: string[];
  keyCommodities: string[];
  excludeOrganizations: string[];
  excludeCategories: string[];
  minValueLakhs: number;
  highValueThresholdCrores: number;
}

// ─── API Response Shape ────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'viewer';
  createdAt: string;
}
