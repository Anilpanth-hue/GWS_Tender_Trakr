// ─── Core Tender Types ────────────────────────────────────────────────────────

export type TenderStatus = 'pending' | 'qualified' | 'rejected';
export type BidStatus = 'assigned' | 'rejected' | 'bid_evaluated' | 'bid_dropped' | 'bid_participated' | 'tender_awarded' | 'not_awarded';
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
  /** EMD value visible on the listing card — available immediately, no detail-page scrape needed */
  listingEmdValue?: string;
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
  reverseAuction: string;
  performanceBankGuarantee: string;
  hardCopySubmission: string;
  eligibilityCriteria: string;
  pqcSummary: string;
  fullSummaryText: string;
  /** Every raw label→value pair scraped from T247's AI Generated Summary section */
  aiSummaryFields: Record<string, string>;
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
  l1ScopeOfWork: string | null;
  l1AnalysisSource: 'documents' | 'metadata_only';

  // Level 1 human decision
  l1Decision: ScreeningDecision;
  l1DecisionReason: string | null;
  l1DecisionBy: string | null;
  l1DecisionAt: string | null;

  // Level 2 analysis
  l2Analyzed: boolean;
  l2Analysis: TenderL2Analysis | null;

  // Ownership assignment
  ownerEmail: string | null;
  ownerAssignedAt: string | null;
  assignedByEmail: string | null;
  assignedByName: string | null;

  // Bid tracking workflow
  bidStatus: BidStatus | null;
  bidStatusUpdatedAt: string | null;
  bidStatusUpdatedBy: string | null;
  rejectedReason: string | null;
  bidEvaluatedRemark: string | null;
  bidDroppedReason: string | null;
  bidParticipatedRemark: string | null;
  awardRemark: string | null;
  l1Bidder: string | null;
  l1Price: string | null;
  l2Bidder: string | null;
  l2Price: string | null;
  l3Bidder: string | null;
  l3Price: string | null;

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
  reverseAuction: string;
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
  gwsRelevanceScore: number;
  gwsRelevanceReason: string;
  relevantBusinessLines: string[];
  winProbabilityAssessment: string;
  keyRisks: string[];
  recommendedAction: string;
  competitiveInsights: string;
  estimatedRevenuePotential: string;

  bestCaseScenario: string;
  worstCaseScenario: string;
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
  docType: string;
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