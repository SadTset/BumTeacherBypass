'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import CategorySelector from '@/components/CategorySelector';
import { PROVIDER_DEFAULTS } from '@/lib/ai-provider-constants';

type ProviderType = 'openai' | 'anthropic' | 'ollama' | 'ollama-cloud' | 'openai-compatible';

interface ProviderOption {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  custom_models: string;
}

function getProviderModels(provider: ProviderOption): string[] {
  const defaults = PROVIDER_DEFAULTS[provider.type]?.models || [];
  const custom = provider.custom_models ? provider.custom_models.split(',').map(m => m.trim()).filter(m => m && !defaults.includes(m)) : [];
  return [...defaults, ...custom];
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  ollama: 'Ollama',
  'ollama-cloud': 'Ollama Cloud',
  'openai-compatible': 'OpenAI-kompatibel',
};

interface RecentDoc {
  id: string;
  filename: string;
  status: string;
  year: string;
  semester: string;
  module_number: string;
  topic: string;
  created_at: string;
}

interface PracticeQuestion {
  id: string;
  type: 'single_choice' | 'short_answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  acceptableAnswers?: string[];
  explanation: string;
  objective: string;
}

interface PracticeTest {
  title: string;
  module_number: string;
  topic: string;
  objectives: string[];
  questions: PracticeQuestion[];
  generatedBy: 'ai' | 'fallback';
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  processed: { label: 'Bereit', cls: 'bg-[var(--success-bg)] text-[var(--success)] border border-[rgba(56,248,167,0.28)]' },
  processing: { label: 'In Arbeit', cls: 'bg-[var(--accent-light)] text-[var(--accent-dark)] border border-[rgba(34,211,238,0.28)] animate-pulse' },
  uploaded: { label: 'Wartet', cls: 'bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]' },
  error: { label: 'Fehler', cls: 'bg-[var(--error-bg)] text-[var(--error)] border border-[rgba(255,107,154,0.28)]' },
};

function formatDate(iso: string): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

function cleanFilename(name: string): string {
  return name.replace(/\.(pdf|docx?|PDF|DOCX?)+$/g, '').replace(/[_-]+/g, ' ');
}

export default function HomePage() {
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [moduleNumber, setModuleNumber] = useState('');
  const [topic, setTopic] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ id: string; filename: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedStructureModel, setSelectedStructureModel] = useState('');
  const [selectedEnrichmentModel, setSelectedEnrichmentModel] = useState('');
  const [selectedReviewerModel, setSelectedReviewerModel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const practiceFileInputRef = useRef<HTMLInputElement>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [practiceFile, setPracticeFile] = useState<File | null>(null);
  const [practiceText, setPracticeText] = useState('');
  const [practiceModuleNumber, setPracticeModuleNumber] = useState('');
  const [practiceTopic, setPracticeTopic] = useState('');
  const [selectedPracticeModel, setSelectedPracticeModel] = useState('');
  const [generatingPractice, setGeneratingPractice] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [practiceWarning, setPracticeWarning] = useState<string | null>(null);
  const [practiceTest, setPracticeTest] = useState<PracticeTest | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [practiceChecked, setPracticeChecked] = useState(false);
  const [practiceDragOver, setPracticeDragOver] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upload') === '1') setShowUpload(true);
  }, []);

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.json())
      .then(data => {
        const docs: RecentDoc[] = Array.isArray(data?.documents) ? data.documents : [];
        docs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setRecentDocs(docs.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/providers').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([providersData, settingsData]) => {
      const opts: ProviderOption[] = (providersData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        model: p.model,
        custom_models: p.custom_models || '',
      }));
      setProviders(opts);
      const defaultId = settingsData.defaultProviderId || (opts.length > 0 ? opts[0].id : '');
      const defaultProvider = opts.find(p => p.id === defaultId);
      if (defaultProvider) {
        const models = getProviderModels(defaultProvider);
        const defaultModel = `${defaultId}:${defaultProvider.model || models[0] || ''}`;
        setSelectedStructureModel(defaultModel);
        setSelectedEnrichmentModel(defaultModel);
        setSelectedReviewerModel(defaultModel);
        setSelectedPracticeModel(defaultModel);
      }
      if (settingsData.structureProviderId) {
        const sProv = opts.find(p => p.id === settingsData.structureProviderId.split(':')[0]);
        if (sProv) setSelectedStructureModel(settingsData.structureProviderId);
      }
      if (settingsData.enrichmentProviderId) {
        const eProv = opts.find(p => p.id === settingsData.enrichmentProviderId.split(':')[0]);
        if (eProv) setSelectedEnrichmentModel(settingsData.enrichmentProviderId);
      }
      if (settingsData.reviewerProviderId) {
        const rProv = opts.find(p => p.id === settingsData.reviewerProviderId.split(':')[0]);
        if (rProv) setSelectedReviewerModel(settingsData.reviewerProviderId);
      }
      if (settingsData.lightweightProviderId) {
        const pProv = opts.find(p => p.id === settingsData.lightweightProviderId.split(':')[0]);
        if (pProv) setSelectedPracticeModel(settingsData.lightweightProviderId);
      }
    }).catch(() => {});
  }, []);

  const handleFileSelect = async (selectedFile: File | null) => {
    setFile(selectedFile);
    setUploadError(null);
    if (!selectedFile || !autoDetect) return;

    setClassifying(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/classify', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.module_number) setModuleNumber(data.module_number);
      if (data.topic) setTopic(data.topic);
      if (data.year) setYear(data.year);
      if (data.semester) setSemester(data.semester);
    } catch {
      // classification failed silently — user can fill manually
    } finally {
      setClassifying(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedStructureModel) formData.append('providerModel', selectedStructureModel);
      if (selectedEnrichmentModel) formData.append('enrichmentModel', selectedEnrichmentModel);
      if (selectedReviewerModel) formData.append('reviewerModel', selectedReviewerModel);
      if (year) formData.append('year', year);
      if (semester) formData.append('semester', semester);
      if (moduleNumber) formData.append('module_number', moduleNumber);
      if (topic) formData.append('topic', topic);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Hochladen fehlgeschlagen'); return; }
      setUploadResult({ id: data.id, filename: data.filename });
    } catch { setUploadError('Netzwerkfehler'); }
    finally { setUploading(false); }
  };

  const closeUpload = () => {
    setShowUpload(false);
    setFile(null);
    setUploadResult(null);
    setUploadError(null);
    setYear(''); setSemester(''); setModuleNumber(''); setTopic('');
  };

  const handlePracticeFileSelect = (selectedFile: File | null) => {
    setPracticeFile(selectedFile);
    setPracticeError(null);
    setPracticeWarning(null);
    setPracticeChecked(false);
  };

  const closePractice = () => {
    setShowPractice(false);
    setPracticeFile(null);
    setPracticeText('');
    setPracticeModuleNumber('');
    setPracticeTopic('');
    setPracticeError(null);
    setPracticeWarning(null);
    setPracticeTest(null);
    setPracticeAnswers({});
    setPracticeChecked(false);
  };

  const handlePracticeGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!practiceFile && !practiceText.trim()) {
      setPracticeError('Lade Lernziele hoch oder füge sie als Text ein.');
      return;
    }

    setGeneratingPractice(true);
    setPracticeError(null);
    setPracticeWarning(null);
    setPracticeChecked(false);
    try {
      const formData = new FormData();
      if (practiceFile) formData.append('file', practiceFile);
      if (practiceText.trim()) formData.append('text', practiceText.trim());
      if (practiceModuleNumber.trim()) formData.append('module_number', practiceModuleNumber.trim());
      if (practiceTopic.trim()) formData.append('topic', practiceTopic.trim());
      if (selectedPracticeModel) formData.append('providerModel', selectedPracticeModel);

      const res = await fetch('/api/practice-test', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setPracticeError(data.error || 'Test konnte nicht erstellt werden');
        return;
      }
      setPracticeTest(data.test || null);
      setPracticeWarning(data.warning || null);
      setPracticeAnswers({});
    } catch {
      setPracticeError('Netzwerkfehler beim Erstellen des Tests');
    } finally {
      setGeneratingPractice(false);
    }
  };

  const normalizePracticeAnswer = (value: string) =>
    value.toLowerCase().trim().replace(/\s+/g, ' ');

  const isPracticeAnswerCorrect = (question: PracticeQuestion, answer: string): boolean => {
    const normalized = normalizePracticeAnswer(answer);
    if (!normalized) return false;
    if (question.type === 'single_choice') {
      return normalized === normalizePracticeAnswer(question.correctAnswer);
    }
    const accepted = [question.correctAnswer, ...(question.acceptableAnswers || [])]
      .map(normalizePracticeAnswer)
      .filter(Boolean);
    return accepted.some(expected => normalized.includes(expected) || expected.includes(normalized));
  };

  const practiceScore = practiceTest
    ? practiceTest.questions.filter(q => isPracticeAnswerCorrect(q, practiceAnswers[q.id] || '')).length
    : 0;

  const readyCount = recentDocs.filter(doc => doc.status === 'processed').length;
  const processingCount = recentDocs.filter(doc => doc.status === 'processing').length;

  return (
    <div className="cyber-stage min-h-screen overflow-x-hidden px-4 py-5 text-[var(--text)] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex max-w-7xl min-w-0 flex-col gap-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-stretch">
          <div className="cyber-panel overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
            <div className="mb-8 flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1 text-[var(--accent-dark)]">Arbeitsbereich aktiv</span>
              <span className="rounded-full border border-[var(--border)] bg-[var(--input-bg)] px-3 py-1 text-[#ff7be5]">{showPractice ? 'Übungstest' : showUpload ? 'Hochladen' : 'Bereit'}</span>
            </div>
            <div className="max-w-3xl">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">BumTeacherBypass</div>
              <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">Materialzentrale</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#a9c7d8] sm:text-base">
                Dokumente hochladen, Lernziele testen und deine zuletzt verarbeiteten Arbeitsblätter ohne Umwege erreichen.
              </p>
            </div>
          </div>

          <div className="cyber-panel rounded-[1.75rem] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Systemstatus</div>
                <h2 className="mt-1 text-xl font-black text-white">Verarbeitung</h2>
              </div>
              <span className="cyber-hot-dot h-2.5 w-2.5 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="cyber-stat min-w-0 rounded-xl px-3 py-3">
                <div className="text-xl font-extrabold text-[var(--accent-dark)]">{recentDocs.length}</div>
                <div className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#a9c7d8]">Dokumente</div>
              </div>
              <div className="cyber-stat min-w-0 rounded-xl px-3 py-3">
                <div className="text-xl font-extrabold text-[var(--success)]">{readyCount}</div>
                <div className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#a9c7d8]">Fertig</div>
              </div>
              <div className="cyber-stat min-w-0 rounded-xl px-3 py-3">
                <div className="text-xl font-extrabold text-[#ff7be5]">{processingCount}</div>
                <div className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#a9c7d8]">Aktiv</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-3">
              <div className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">KI-Anbieter</div>
              <div className="mt-1 text-sm font-semibold text-[var(--text)]">{providers.length > 0 ? `${providers.length} konfiguriert` : 'Nicht konfiguriert'}</div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) { setShowUpload(true); handleFileSelect(dropped); }
            }}
            className={`cyber-panel group min-h-40 rounded-[1.5rem] p-5 text-left transition-all ${showUpload || dragOver ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'hover:border-[var(--accent)]'}`}
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-[var(--accent-dark)]">Arbeitsblatt</span>
                <span className="mt-2 block text-2xl font-black text-white">Dokument hochladen</span>
                <span className="mt-2 block max-w-md text-sm leading-6 text-[var(--text-muted)]">PDF oder Word auswählen, automatisch einordnen und als interaktives Arbeitsblatt verarbeiten.</span>
              </span>
              <span className="cyber-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white transition-transform group-hover:scale-110">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowPractice(true)}
            onDragOver={e => { e.preventDefault(); setPracticeDragOver(true); }}
            onDragLeave={() => setPracticeDragOver(false)}
            onDrop={e => {
              e.preventDefault();
              setPracticeDragOver(false);
              const dropped = e.dataTransfer.files?.[0];
              if (dropped) {
                setShowPractice(true);
                handlePracticeFileSelect(dropped);
              }
            }}
            className={`cyber-panel group min-h-40 rounded-[1.5rem] p-5 text-left transition-all ${showPractice || practiceDragOver ? 'border-[#ff2bd6] bg-[rgba(255,43,214,0.14)]' : 'hover:border-[#ff2bd6]'}`}
          >
            <span className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#ff7be5]">Lernziele</span>
                <span className="mt-2 block text-2xl font-black text-white">Übungstest erstellen</span>
                <span className="mt-2 block max-w-md text-sm leading-6 text-[var(--text-muted)]">Lernziele hochladen oder einfügen und daraus einen interaktiven Test generieren.</span>
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#ff2bd6] bg-[rgba(255,43,214,0.14)] text-[#ff7be5] transition-transform group-hover:scale-110">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </span>
            </span>
          </button>
        </section>

        <section className="min-w-0 space-y-6">
          <main className="min-w-0 space-y-5">
            <section className="cyber-panel rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">Aktive Ansicht</div>
                  <h2 className="mt-1 text-xl font-black text-white">{showPractice ? 'Lernziel-Test' : showUpload ? 'Dokumente hochladen' : 'Bereit zur Auswahl'}</h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className={`rounded-full border px-3 py-1 ${showUpload ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]' : 'border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>Hochladen</span>
                  <span className={`rounded-full border px-3 py-1 ${showPractice ? 'border-[#ff2bd6] bg-[rgba(255,43,214,0.14)] text-[#ff7be5]' : 'border-[var(--border)] bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>Übungstest</span>
                </div>
              </div>
            </section>
            {!showUpload && !showPractice && (
              <section className="cyber-panel rounded-2xl p-6 sm:p-8">
                <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--accent-dark)] shadow-[0_0_30px_rgba(34,211,238,0.16)]">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.93 4.93 14.14 14.14"/><path d="m19.07 4.93-14.14 14.14"/></svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Wähle einen Arbeitsmodus</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
                      Starte oben mit dem Hochladen eines Dokuments oder generiere direkt einen Übungstest aus Lernzielen.
                    </p>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <button type="button" onClick={() => setShowUpload(true)} className="cyber-primary rounded-xl border-none px-4 py-3 text-sm font-black text-white">
                        Dokument hochladen
                      </button>
                      <button type="button" onClick={() => setShowPractice(true)} className="rounded-xl border border-[#ff2bd6] bg-[rgba(255,43,214,0.14)] px-4 py-3 text-sm font-black text-[#ff7be5]">
                        Übungstest erstellen
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

      {showUpload && (
              <section className="cyber-panel rounded-2xl p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="font-serif text-2xl font-bold leading-none text-white">Dokument hochladen</h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Quelle, Modelle und Kategorie bleiben wie vorher steuerbar.</p>
                  </div>
            <button onClick={closeUpload} className="p-2 rounded-full hover:bg-[var(--surface)] border border-transparent bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {uploadResult ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-bg)] shadow-[0_0_26px_rgba(56,248,167,0.28)]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="font-semibold mb-1">{uploadResult.filename} hochgeladen!</p>
              <p className="text-sm text-[var(--text-muted)] mb-4">Dein Dokument wird von der KI verarbeitet. Das kann einige Minuten dauern.</p>
              <div className="flex gap-3 justify-center flex-wrap">
                <Link href={`/documents/${uploadResult.id}`} className="cyber-primary px-4 py-2 rounded-full no-underline font-medium text-white">Dokument ansehen</Link>
                <button onClick={closeUpload} className="bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] px-4 py-2 rounded-full font-medium cursor-pointer hover:bg-[var(--surface)]">Schließen</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpload}>
              <div
                      className="cyber-upload border-2 border-dashed border-[var(--border)] rounded-2xl p-6 text-center hover:border-[var(--accent)] transition-colors cursor-pointer mb-5"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={e => handleFileSelect(e.target.files?.[0] || null)} className="hidden" />
                {file ? (
                  <div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} KB</p>
                    {classifying && <p className="text-sm text-[var(--accent)] mt-1">Modul & Thema werden erkannt...</p>}
                  </div>
                ) : (
                  <div>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p className="text-[var(--text-muted)]">Klicke hier, um eine PDF- oder Word-Datei auszuwählen</p>
                  </div>
                )}
              </div>

              {providers.length > 0 && (
                    <div className="mb-5 grid gap-4 lg:grid-cols-3">
                      <div className="cyber-card rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3">
                    <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                      Strukturmodell (Durchlauf 1)
                    </label>
                    <select
                      value={selectedStructureModel}
                      onChange={(e) => setSelectedStructureModel(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                    >
                      {providers.map(p => {
                        const models = getProviderModels(p);
                        const groupLabel = `${p.name} (${PROVIDER_LABELS[p.type] || p.type})`;
                        return (
                          <optgroup key={p.id} label={groupLabel}>
                            {models.length > 0 ? models.map(m => (
                              <option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>{m}</option>
                            )) : (
                              <option key={`${p.id}:${p.model || ''}`} value={`${p.id}:${p.model || ''}`}>{p.model || 'Kein Modell'}</option>
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Erstellt die Arbeitsblatt-Struktur.</p>
                  </div>
                      <div className="cyber-card rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3">
                    <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                      Anreicherungsmodell (Durchlauf 2)
                    </label>
                    <select
                      value={selectedEnrichmentModel}
                      onChange={(e) => setSelectedEnrichmentModel(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                    >
                      {providers.map(p => {
                        const models = getProviderModels(p);
                        const groupLabel = `${p.name} (${PROVIDER_LABELS[p.type] || p.type})`;
                        return (
                          <optgroup key={p.id} label={groupLabel}>
                            {models.length > 0 ? models.map(m => (
                              <option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>{m}</option>
                            )) : (
                              <option key={`${p.id}:${p.model || ''}`} value={`${p.id}:${p.model || ''}`}>{p.model || 'Kein Modell'}</option>
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Fügt Lösungen und Interaktionen hinzu.</p>
                  </div>
                      <div className="cyber-card rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3">
                    <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                      Prüfmodell (Durchlauf 3)
                    </label>
                    <select
                      value={selectedReviewerModel}
                      onChange={(e) => setSelectedReviewerModel(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                    >
                      {providers.map(p => {
                        const models = getProviderModels(p);
                        const groupLabel = `${p.name} (${PROVIDER_LABELS[p.type] || p.type})`;
                        return (
                          <optgroup key={p.id} label={groupLabel}>
                            {models.length > 0 ? models.map(m => (
                              <option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>{m}</option>
                            )) : (
                              <option key={`${p.id}:${p.model || ''}`} value={`${p.id}:${p.model || ''}`}>{p.model || 'Kein Modell'}</option>
                            )}
                          </optgroup>
                        );
                      })}
                    </select>
                    <p className="text-xs text-[var(--text-muted)] mt-2">Prüft Vollständigkeit und Fehler.</p>
                  </div>
                </div>
              )}

              <div className="mb-5">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-3 mb-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAutoDetect(!autoDetect)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-none cursor-pointer ${autoDetect ? 'bg-[var(--accent)] shadow-[0_0_18px_rgba(34,211,238,0.35)]' : 'bg-[var(--border)]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoDetect ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-[var(--text)]">Kategorie automatisch erkennen</span>
                  {classifying && <span className="text-xs text-[var(--accent)] ml-2">Wird erkannt...</span>}
                </div>
                {!autoDetect && (
                  <p className="text-xs text-[var(--text-muted)] mb-3">Fülle die Kategorie manuell ein oder aktiviere die automatische Erkennung.</p>
                )}
                {(autoDetect || year || semester || moduleNumber || topic) && (
                  <CategorySelector year={year} semester={semester} moduleNumber={moduleNumber} topic={topic} onYearChange={setYear} onSemesterChange={setSemester} onModuleNumberChange={setModuleNumber} onTopicChange={setTopic} />
                )}
                    </div>
              </div>

              {uploadError && <div className="mb-4 p-3 bg-[var(--error-bg)] text-[var(--error)] rounded-lg text-sm font-medium">{uploadError}</div>}

              <button type="submit" disabled={uploading || !file} className="cyber-primary w-full flex items-center justify-center gap-2 text-white px-5 py-3.5 rounded-xl font-semibold transition-colors disabled:opacity-50 border-none cursor-pointer">
                {uploading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>Wird hochgeladen...</> : 'Hochladen & Verarbeiten'}
              </button>
            </form>
          )}
              </section>
      )}

            {showPractice && (
              <section className="cyber-panel rounded-2xl p-4 sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold leading-none text-white">Lernziel-Test</h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">Aus Modul-Lernzielen wird ein interaktiver Übungstest.</p>
                  </div>
                  <button onClick={closePractice} className="p-2 rounded-full hover:bg-[var(--surface)] border border-transparent bg-transparent cursor-pointer text-[var(--text-muted)] hover:text-[var(--text)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <form onSubmit={handlePracticeGenerate} className="space-y-4">
                  <div
                    className="cyber-upload rounded-2xl border-2 border-dashed border-[var(--border)] p-5 text-center transition-colors hover:border-[#ff2bd6] cursor-pointer"
                    onClick={() => practiceFileInputRef.current?.click()}
                  >
                    <input
                      ref={practiceFileInputRef}
                      type="file"
                      accept=".pdf,.docx,.doc,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={e => handlePracticeFileSelect(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {practiceFile ? (
                      <div>
                        <p className="font-semibold text-[var(--text)]">{practiceFile.name}</p>
                        <p className="text-sm text-[var(--text-muted)]">{(practiceFile.size / 1024).toFixed(1)} KB Lernziele geladen</p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-[var(--text)]">Lernziel-Datei auswählen</p>
                        <p className="text-sm text-[var(--text-muted)]">PDF, Word oder TXT. Du kannst die Lernziele auch unten einfügen.</p>
                      </div>
                    )}
                  </div>

                  <textarea
                    value={practiceText}
                    onChange={e => { setPracticeText(e.target.value); setPracticeError(null); }}
                    placeholder="Oder Lernziele hier einfügen..."
                    rows={5}
                    className="w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--text)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      value={practiceModuleNumber}
                      onChange={e => setPracticeModuleNumber(e.target.value)}
                      placeholder="Modul, z.B. 164"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                    />
                    <input
                      value={practiceTopic}
                      onChange={e => setPracticeTopic(e.target.value)}
                      placeholder="Thema, z.B. SQL Injection"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                    />
                  </div>

                  {providers.length > 0 && (
                    <div className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] p-3">
                      <label className="mb-1.5 block text-sm font-medium text-[var(--text)]">Test-Modell</label>
                      <select
                        value={selectedPracticeModel}
                        onChange={(e) => setSelectedPracticeModel(e.target.value)}
                        className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)] transition-all"
                      >
                        {providers.map(p => {
                          const models = getProviderModels(p);
                          const groupLabel = `${p.name} (${PROVIDER_LABELS[p.type] || p.type})`;
                          return (
                            <optgroup key={p.id} label={groupLabel}>
                              {models.length > 0 ? models.map(m => (
                                <option key={`${p.id}:${m}`} value={`${p.id}:${m}`}>{m}</option>
                              )) : (
                                <option key={`${p.id}:${p.model || ''}`} value={`${p.id}:${p.model || ''}`}>{p.model || 'Kein Modell'}</option>
                              )}
                            </optgroup>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {practiceError && <div className="rounded-xl bg-[var(--error-bg)] p-3 text-sm font-medium text-[var(--error)]">{practiceError}</div>}
                  {practiceWarning && <div className="rounded-xl border border-[var(--border)] bg-[var(--accent-light)] p-3 text-sm text-[var(--accent-dark)]">{practiceWarning}</div>}

                  <button type="submit" disabled={generatingPractice || (!practiceFile && !practiceText.trim())} className="cyber-primary flex w-full items-center justify-center gap-2 rounded-xl border-none px-5 py-3.5 font-semibold text-white transition-colors disabled:opacity-50">
                    {generatingPractice ? <><div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />Test wird erstellt...</> : 'Lernziel-Test generieren'}
                  </button>
                </form>

                {practiceTest && (
                  <div className="mt-6 space-y-4">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-extrabold text-white">{practiceTest.title}</h3>
                          <p className="text-sm text-[var(--text-muted)]">{practiceTest.questions.length} Fragen aus {practiceTest.objectives.length} Lernzielen</p>
                        </div>
                        {practiceChecked && (
                          <div className="rounded-xl bg-[var(--accent-light)] px-3 py-2 text-sm font-bold text-[var(--accent-dark)]">
                            Ergebnis: {practiceScore}/{practiceTest.questions.length}
                          </div>
                        )}
                      </div>
                    </div>

                    {practiceTest.questions.map((question, index) => {
                      const answer = practiceAnswers[question.id] || '';
                      const correct = isPracticeAnswerCorrect(question, answer);
                      return (
                        <div key={question.id} className="rounded-2xl border border-[var(--border)] bg-[var(--input-bg)] p-4">
                          <div className="mb-3 flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-light)] text-xs font-black text-[var(--accent-dark)]">{index + 1}</span>
                            <div>
                              <p className="font-semibold text-[var(--text)]">{question.question}</p>
                              {question.objective && <p className="mt-1 text-xs text-[var(--text-muted)]">Lernziel: {question.objective}</p>}
                            </div>
                          </div>

                          {question.type === 'single_choice' && question.options ? (
                            <div className="grid gap-2">
                              {question.options.map(option => (
                                <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-all ${answer === option ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-dark)]' : 'border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--text)] hover:border-[var(--accent)]'}`}>
                                  <input
                                    type="radio"
                                    name={question.id}
                                    value={option}
                                    checked={answer === option}
                                    onChange={() => { setPracticeAnswers(prev => ({ ...prev, [question.id]: option })); setPracticeChecked(false); }}
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <textarea
                              value={answer}
                              onChange={e => { setPracticeAnswers(prev => ({ ...prev, [question.id]: e.target.value })); setPracticeChecked(false); }}
                              placeholder="Deine Antwort..."
                              rows={3}
                              className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-light)]"
                            />
                          )}

                          {practiceChecked && (
                            <div className={`mt-3 rounded-xl border p-3 text-sm ${correct ? 'border-[rgba(56,248,167,0.28)] bg-[var(--success-bg)] text-[var(--success)]' : 'border-[rgba(255,107,154,0.28)] bg-[var(--error-bg)] text-[var(--error)]'}`}>
                              <div className="font-bold">{correct ? 'Richtig' : 'Noch nicht ganz'}</div>
                              {!correct && <div className="mt-1 text-[var(--text)]">Musterlösung: {question.correctAnswer}</div>}
                              {question.explanation && <div className="mt-1 text-[var(--text-muted)]">{question.explanation}</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex flex-wrap gap-3">
                      <button type="button" onClick={() => setPracticeChecked(true)} className="cyber-primary rounded-xl border-none px-4 py-2 text-sm font-bold text-white">Antworten prüfen</button>
                      <button type="button" onClick={() => { setPracticeAnswers({}); setPracticeChecked(false); }} className="rounded-xl border border-[var(--border)] bg-[var(--input-bg)] px-4 py-2 text-sm font-bold text-[var(--text)] hover:bg-[var(--surface)]">Zurücksetzen</button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </main>

          <aside className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Zuletzt verwendete Dokumente */}
            <section className="cyber-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[rgba(6,12,27,0.72)]">
                <div>
                  <h2 className="font-bold text-base text-white">Zuletzt hinzugefügt</h2>
                  <p className="text-xs text-[var(--text-muted)]">Deine neuesten Dokumente</p>
                </div>
            {recentDocs.length > 0 && <span className="text-xs text-[var(--text-muted)]">{recentDocs.length} Dokumente</span>}
          </div>
          {recentDocs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                  Noch keine Dokumente. Lade hier dein erstes Arbeitsblatt hoch.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentDocs.map(doc => {
                const meta = STATUS_META[doc.status] || STATUS_META.uploaded;
                return (
                      <Link key={doc.id} href={`/documents/${doc.id}`} className="flex items-center gap-3 px-5 py-4 no-underline text-[var(--text)] hover:bg-[var(--input-bg)] transition-all group">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-light)] text-[var(--accent-dark)] transition-transform group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(34,211,238,0.24)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{cleanFilename(doc.filename)}</span>
                      <span className="block text-xs text-[var(--text-muted)] truncate">
                        {doc.module_number ? `Modul ${doc.module_number}` : 'Ohne Modul'}{doc.topic ? ` · ${doc.topic}` : ''} · {formatDate(doc.created_at)}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

            <Link href="/compendium" className="cyber-primary block rounded-2xl p-5 text-white no-underline">
              <div className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/70">Wissensbasis</div>
              <div className="mt-2 text-lg font-black">Kompendium</div>
              <p className="mt-2 text-sm text-white/80">Alle extrahierten Themen und Erklärungen an einem Ort.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                Öffnen
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </span>
            </Link>

          </aside>
        </section>
      </div>
    </div>
  );
}
