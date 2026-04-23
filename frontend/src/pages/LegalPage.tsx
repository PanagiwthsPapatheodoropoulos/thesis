/**
 * @file LegalPage.tsx
 * @description Public legal center for Terms of Service and Privacy Policy.
 */
import React from 'react';
import { ArrowLeft, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import LegalDocumentContent from '../components/LegalDocumentContent';
import { LEGAL_DOC_ORDER, LEGAL_DOCUMENTS, normalizeLegalDoc, type LegalDocumentType } from '../utils/legalContent';

const LegalPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { darkMode } = useTheme();

  const activeDoc = normalizeLegalDoc(searchParams.get('doc'));

  const setActiveDocument = (doc: LegalDocumentType) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('doc', doc);
    setSearchParams(nextParams, { replace: true });
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/');
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-slate-50 text-slate-900'} py-10 px-4`}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className={`rounded-2xl border p-6 ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Legal Center
              </h1>
              <p className={`mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Review the Terms of Service and Privacy Policy for Smart Resource Planner.
              </p>
            </div>

            <button
              onClick={handleBack}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
                darkMode
                  ? 'border-gray-700 text-gray-200 hover:bg-gray-800'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEGAL_DOC_ORDER.map((docKey) => {
              const isActive = activeDoc === docKey;
              const isTerms = docKey === 'terms';
              const Icon = isTerms ? FileText : ShieldCheck;

              return (
                <button
                  key={docKey}
                  onClick={() => setActiveDocument(docKey)}
                  className={`text-left rounded-xl border p-4 transition ${
                    isActive
                      ? (darkMode ? 'border-indigo-500 bg-indigo-900/20' : 'border-indigo-400 bg-indigo-50')
                      : (darkMode ? 'border-gray-700 hover:border-gray-600 bg-gray-900/40' : 'border-gray-200 hover:border-gray-300 bg-white')
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${isTerms ? 'text-indigo-500' : 'text-emerald-500'}`} />
                    <p className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                      {LEGAL_DOCUMENTS[docKey].label}
                    </p>
                  </div>
                  <p className={`mt-2 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {LEGAL_DOCUMENTS[docKey].summary}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <LegalDocumentContent documentType={activeDoc} darkMode={darkMode} />

        <div className={`rounded-xl border p-4 flex items-center justify-between ${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            Need help with data requests or account deletion policy? Contact your company administrator.
          </p>
          <button
            onClick={() => navigate('/settings')}
            className={`inline-flex items-center gap-2 text-sm font-medium ${darkMode ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:text-indigo-700'}`}
          >
            Open Settings
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
