import React from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { LEGAL_DOCUMENTS, type LegalDocumentType } from '../utils/legalContent';

interface LegalDocumentContentProps {
  documentType: LegalDocumentType;
  darkMode: boolean;
  compact?: boolean;
}

const LegalDocumentContent: React.FC<LegalDocumentContentProps> = ({
  documentType,
  darkMode,
  compact = false
}) => {
  const document = LEGAL_DOCUMENTS[documentType];
  const isTerms = documentType === 'terms';
  const Icon = isTerms ? FileText : ShieldCheck;

  const iconBoxClass = isTerms
    ? (darkMode ? 'bg-indigo-900/40 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
    : (darkMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-emerald-100 text-emerald-700');

  const sectionClass = darkMode
    ? 'border-gray-700 bg-gray-900/40'
    : 'border-gray-200 bg-white';

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      <div className={`rounded-xl border p-5 ${sectionClass}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${iconBoxClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {document.label}
            </h2>
            <p className={`mt-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {document.summary}
            </p>
            <p className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Effective date: {document.effectiveDate}
            </p>
          </div>
        </div>
      </div>

      {document.sections.map((section) => (
        <section key={section.title} className={`rounded-xl border p-5 ${sectionClass}`}>
          <h3 className={`text-base font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
            {section.title}
          </h3>

          <div className="mt-3 space-y-3">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className={`leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {paragraph}
              </p>
            ))}
          </div>

          {section.bullets && section.bullets.length > 0 && (
            <ul className="mt-3 space-y-2 pl-5 list-disc">
              {section.bullets.map((bullet) => (
                <li key={bullet} className={`${darkMode ? 'text-gray-300 marker:text-gray-500' : 'text-gray-700 marker:text-gray-400'}`}>
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
};

export default LegalDocumentContent;
