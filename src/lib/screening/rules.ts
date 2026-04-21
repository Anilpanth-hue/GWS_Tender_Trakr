import type { RawTender, ScreeningConfig } from '@/types';

export interface ScreeningResult {
  status: 'qualified' | 'rejected';
  qualificationReasons: string[];
  exclusionReason: string | null;
}

// Default config (used if DB config unavailable)
export const DEFAULT_CONFIG: ScreeningConfig = {
  qualifyKeywords: [
    'Multimodal', 'Intermodal', 'Container', 'RCR', 'Rail Cum Road', 'GPWIS',
    'LSFTO', 'Freight Forwarding', 'Ocean Freight', 'CHA', 'Barge', 'Vessel',
    'Rakes', 'Rake Management', 'Terminal Management', 'MMLP',
    'GatiShakti Cargo Terminal', 'Port', 'Berth', 'Charter Vessel',
  ],
  keyAuthorities: [
    'NTPC', 'IOCL', 'HPCL', 'BPCL', 'Railways', 'NMDC', 'SAIL', 'Jindal',
    'Tata', 'Maruti', 'Indian Army', 'Balmer and Lawrie', 'Balmer Lawrie',
    'RINL', 'IIT', 'NFL', 'IFFCO', 'APGENCO', 'Port Authorities',
    'Shipping Corporation', 'Goa Shipyard',
  ],
  keyCommodities: [
    'Limestone', 'Calcium Carbonate', 'Bitumen', 'Steel Products',
    'Hot Rolled Coils', 'Cold Rolled Coils', 'Grains', 'Bauxite',
    'Manganese Ore', 'Rock Phosphate', 'Rake Handling', 'Wood',
    'Tyres', 'Edible Oil',
  ],
  excludeOrganizations: ['Food Corporation of India', 'FCI', 'State Civil Supplies'],
  excludeCategories: ['Solid Waste', 'Waste Management', 'EPC', 'Supply Fabrication', 'Tank Truck'],
  minValueLakhs: 50,
  highValueThresholdCrores: 5,
};

const HIGH_VALUE_EXCEPTION_KEYWORDS = [
  'Container', 'Inter Modal', 'Intermodal', 'Multimodal', 'Vessel',
];

const STATE_GOVT_EXCEPTION_KEYWORDS = [
  'Port', 'Berth Development', 'ICD Development', 'Grain SILO', 'Tank Farms',
];

const OIL_COMPANIES = ['IOCL', 'HPCL', 'BPCL', 'Indian Oil', 'Hindustan Petroleum', 'Bharat Petroleum'];

function containsAny(text: string, keywords: string[]): string[] {
  const textLower = text.toLowerCase();
  return keywords.filter(kw => textLower.includes(kw.toLowerCase()));
}

function isStateGovtOrganization(issuedBy: string): boolean {
  const stateGovtPatterns = [
    /state\s+govt/i,
    /state\s+government/i,
    /\bGOVT\.\s+OF\b/i,
    /\bGOVERNMENT\s+OF\b/i,
    /\bMUNICIPAL\b/i,
    /\bPANCHAYAT\b/i,
    /\bNAGAR\s+NIGAM\b/i,
    /\bNAGAR\s+PALIKA\b/i,
    /\bNAGAR\s+PANCHAYAT\b/i,
    /\bGRAM\s+PANCHAYAT\b/i,
    /\bSMC\b/,
    /\bAMC\b/,
    /\bBMC\b/,
    /\bPMC\b/,
  ];
  return stateGovtPatterns.some(p => p.test(issuedBy));
}

export function screenTender(tender: RawTender, config: ScreeningConfig = DEFAULT_CONFIG): ScreeningResult {
  const fullText = `${tender.title} ${tender.issuedBy} ${tender.category} ${tender.location}`;
  const valueLakhs = tender.estimatedValue ? tender.estimatedValue / 100000 : null;
  const valueCrores = valueLakhs ? valueLakhs / 100 : null;
  const isHighValue = valueCrores !== null && valueCrores >= config.highValueThresholdCrores;

  // ── EXCLUSION RULES ──────────────────────────────────────────────────────────

  // Rule 1: Exclude FCI / State Civil Supplies (unless Container/Multimodal/Vessel or >5Cr)
  const matchedExcludeOrgs = containsAny(fullText, config.excludeOrganizations);
  if (matchedExcludeOrgs.length > 0) {
    const highValueExceptionMatch = containsAny(fullText, HIGH_VALUE_EXCEPTION_KEYWORDS);
    if (highValueExceptionMatch.length === 0 && !isHighValue) {
      return {
        status: 'rejected',
        qualificationReasons: [],
        exclusionReason: `Excluded: FCI/State Civil Supplies tender (${matchedExcludeOrgs.join(', ')}) with no Container/Multimodal/Vessel mention and value < 5 Cr`,
      };
    }
  }

  // Rule 2: Exclude Solid Waste / Waste Management
  const wasteKeywords = ['Solid Waste', 'Waste Management', 'Garbage', 'Sewage Treatment', 'STP'];
  const wasteMatch = containsAny(fullText, wasteKeywords);
  if (wasteMatch.length > 0) {
    return {
      status: 'rejected',
      qualificationReasons: [],
      exclusionReason: `Excluded: Waste/Solid Waste tender (${wasteMatch.join(', ')})`,
    };
  }

  // Rule 3: Exclude EPC / Supply Fabrication
  const epcKeywords = ['EPC', 'Supply Fabrication', 'Fabrication and Supply', 'Engineering Procurement Construction'];
  const epcMatch = containsAny(fullText, epcKeywords);
  if (epcMatch.length > 0) {
    return {
      status: 'rejected',
      qualificationReasons: [],
      exclusionReason: `Excluded: EPC/Supply Fabrication tender (${epcMatch.join(', ')})`,
    };
  }

  // Rule 4: Exclude Oil Company Tank Truck tenders
  const oilCompanyMatch = containsAny(tender.issuedBy, OIL_COMPANIES);
  const tankTruckMatch = containsAny(fullText, ['Tank Truck', 'TT ', ' TT', 'Tanker Truck', 'Tank Lorry']);
  if (oilCompanyMatch.length > 0 && tankTruckMatch.length > 0) {
    return {
      status: 'rejected',
      qualificationReasons: [],
      exclusionReason: `Excluded: Oil company Tank Truck tender (${oilCompanyMatch.join(', ')})`,
    };
  }

  // Rule 5: Exclude State Govt tenders (unless Port/Berth/ICD/SILO/Tank Farms)
  if (isStateGovtOrganization(tender.issuedBy)) {
    const stateException = containsAny(fullText, STATE_GOVT_EXCEPTION_KEYWORDS);
    if (stateException.length === 0) {
      return {
        status: 'rejected',
        qualificationReasons: [],
        exclusionReason: `Excluded: State Govt tender without Port/Berth/ICD/SILO/Tank Farms scope`,
      };
    }
  }

  // Rule 6: Exclude < 50 Lakh
  if (valueLakhs !== null && valueLakhs < config.minValueLakhs) {
    return {
      status: 'rejected',
      qualificationReasons: [],
      exclusionReason: `Excluded: Tender value (₹${valueLakhs.toFixed(2)} L) below minimum threshold of ₹50 L`,
    };
  }

  // ── QUALIFICATION RULES ───────────────────────────────────────────────────────

  const qualificationReasons: string[] = [];

  // Match qualification keywords
  const kwMatch = containsAny(fullText, config.qualifyKeywords);
  if (kwMatch.length > 0) {
    qualificationReasons.push(`Keywords matched: ${kwMatch.join(', ')}`);
  }

  // Match key authorities
  const authMatch = containsAny(fullText, config.keyAuthorities);
  if (authMatch.length > 0) {
    qualificationReasons.push(`Key authority: ${authMatch.join(', ')}`);
  }

  // Match key commodities
  const commodityMatch = containsAny(fullText, config.keyCommodities);
  if (commodityMatch.length > 0) {
    qualificationReasons.push(`Key commodity: ${commodityMatch.join(', ')}`);
  }

  if (qualificationReasons.length > 0) {
    return { status: 'qualified', qualificationReasons, exclusionReason: null };
  }

  // No qualification — reject with reason
  return {
    status: 'rejected',
    qualificationReasons: [],
    exclusionReason: 'No matching qualification keywords, authorities, or commodities found',
  };
}
