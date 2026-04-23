export type LegalDocumentType = 'terms' | 'privacy';

export interface LegalSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  key: LegalDocumentType;
  label: string;
  summary: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export const LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  terms: {
    key: 'terms',
    label: 'Terms of Service',
    summary: 'Rules that define acceptable use of the platform and account responsibilities.',
    effectiveDate: 'April 23, 2026',
    sections: [
      {
        title: '1. Acceptance of Terms',
        paragraphs: [
          'By creating an account or using Smart Resource Planner, you agree to these Terms of Service and all applicable policies.',
          'If you do not agree, do not use the platform.'
        ]
      },
      {
        title: '2. Account Responsibilities',
        paragraphs: [
          'You are responsible for keeping your login credentials secure and for all activities under your account.',
          'You must provide accurate profile and company information and keep it reasonably up to date.'
        ],
        bullets: [
          'Do not share credentials with unauthorized users.',
          'Notify your administrator if you suspect unauthorized access.',
          'Use role permissions only for legitimate business purposes.'
        ]
      },
      {
        title: '3. Acceptable Use',
        paragraphs: [
          'You may use the service only for lawful work-management activities and internal collaboration.',
          'You must not attempt to disrupt, reverse engineer, or abuse the application, API, AI services, or infrastructure.'
        ],
        bullets: [
          'No intentional data tampering or unauthorized exports.',
          'No misuse of AI recommendations to create harmful or discriminatory workflows.',
          'No interference with availability, performance, or security controls.'
        ]
      },
      {
        title: '4. AI Features Disclaimer',
        paragraphs: [
          'AI outputs, including assignment suggestions, anomaly detection, and predictions, are advisory and may contain errors.',
          'Final operational decisions remain the responsibility of your organization and authorized users.'
        ]
      },
      {
        title: '5. Data Ownership and Termination',
        paragraphs: [
          'Your organization retains ownership of data entered in the platform, subject to applicable law and contractual terms.',
          'Accounts may be suspended or removed for material violations of these terms or security requirements.'
        ]
      }
    ]
  },
  privacy: {
    key: 'privacy',
    label: 'Privacy Policy',
    summary: 'How personal and operational data is collected, used, shared, and protected.',
    effectiveDate: 'April 23, 2026',
    sections: [
      {
        title: '1. Data We Collect',
        paragraphs: [
          'We collect account details such as username, email, role, and company association, as well as profile information you provide.',
          'We also process task, assignment, skill, and activity metadata needed to run planning and analytics features.'
        ]
      },
      {
        title: '2. How We Use Data',
        paragraphs: [
          'Data is used to authenticate users, manage authorization, power collaboration, and generate operational insights.',
          'AI and analytics modules may process task and workforce signals to provide productivity metrics and recommendations.'
        ]
      },
      {
        title: '3. Sharing and Access',
        paragraphs: [
          'Data is not sold. Access is restricted by tenant isolation and role-based permissions.',
          'Authorized administrators and managers may view company-level information needed for scheduling and oversight.'
        ]
      },
      {
        title: '4. Retention and Security',
        paragraphs: [
          'We apply technical and organizational safeguards designed to protect confidentiality, integrity, and availability of data.',
          'Records are retained only as long as necessary for service operation, legal obligations, and legitimate business needs.'
        ],
        bullets: [
          'Authentication and authorization controls for protected endpoints.',
          'Company scoped data access via tenancy headers and backend checks.',
          'Audit-friendly logs and notification records for critical events.'
        ]
      },
      {
        title: '5. Your Choices',
        paragraphs: [
          'You may request profile corrections through account settings or your administrator.',
          'For deletion or export requests tied to organizational policy, contact your company administrator.'
        ]
      }
    ]
  }
};

export const LEGAL_DOC_ORDER: LegalDocumentType[] = ['terms', 'privacy'];

export const normalizeLegalDoc = (value: string | null | undefined): LegalDocumentType => {
  if (value === 'privacy') {
    return 'privacy';
  }

  return 'terms';
};
