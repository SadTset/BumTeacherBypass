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
  'openai-compatible': 'OpenAI-Compatible',
};

const YEAR_LABELS: Record<string, string> = {
  '1': '1. Lehrjahr',
  '2': '2. Lehrjahr',
  '3': '3. Lehrjahr',
  '4': '4. Lehrjahr',
};

const YEAR_ICONS: Record<string, React.ReactNode> = {
  '1': <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  '2': <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  '3': <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  '4': <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
};

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upload') === '1') setShowUpload(true);
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
      if (!res.ok) { setUploadError(data.error || 'Upload fehlgeschlagen'); return; }
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-10">
        <div className="font-mono text-xs tracking-widest uppercase text-[var(--accent)] mb-3">BumTeacherBypass</div>
        <h1 className="font-serif text-4xl font-bold text-[var(--text)] mb-3">Interaktive Arbeitsblätter</h1>
        <p className="text-[var(--text-muted)] text-lg">Wähle ein Lehrjahr, um zu beginnen.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        {[1, 2, 3, 4].map(y => (
          <Link
            key={y}
            href={`/worksheets/year-${y}`}
            className="group flex items-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:border-[var(--accent)] hover:bg-[var(--card-hover)] transition-all no-underline text-[var(--text)]"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent-dark)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
              {YEAR_ICONS[String(y)]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs tracking-wider uppercase text-[var(--accent)]">{YEAR_LABELS[String(y)]}</div>
              <div className="font-serif text-lg font-bold">Semester 1 & 2</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 group-hover:stroke-[var(--accent)] transition-colors">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        ))}
      </div>

      {!showUpload && (
        <div className="mt-8 p-6 bg-gradient-to-br from-[var(--accent-light)] to-[var(--surface)] border border-[var(--border)] rounded-2xl text-center">
          <h2 className="font-serif text-xl font-bold text-[var(--text)] mb-2">Eigene Dokumente hochladen</h2>
          <p className="text-[var(--text-muted)] text-sm mb-4">Lade PDF- oder Word-Dateien hoch und lass sie von der KI in interaktive, bearbeitbare Seiten umwandeln.</p>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white px-5 py-2.5 rounded-xl font-semibold hover:opacity-90 transition-all border-none cursor-pointer shadow-md shadow-[var(--accent-glow)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Dokument hochladen
          </button>
        </div>
      )}

      {showUpload && (
        <div className="mt-8 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-serif text-xl font-bold">Dokument hochladen</h2>
            <button onClick={closeUpload} className="p-1.5 rounded-lg hover:bg-[var(--surface)] border-none bg-transparent cursor-pointer text-[var(--text-muted)] transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {uploadResult ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 bg-[var(--success-bg)] rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="font-semibold mb-1 text-lg">{uploadResult.filename} hochgeladen!</p>
              <p className="text-sm text-[var(--text-muted)] mb-6">Dein Dokument wird von der KI verarbeitet. Das kann einige Minuten dauern.</p>
              <div className="flex gap-3 justify-center">
                <Link href={`/documents/${uploadResult.id}`} className="bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white px-5 py-2.5 rounded-xl no-underline font-semibold hover:opacity-90 shadow-md shadow-[var(--accent-glow)]">Dokument ansehen</Link>
                <button onClick={closeUpload} className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-5 py-2.5 rounded-xl font-semibold cursor-pointer hover:bg-[var(--card-hover)] transition-colors">Schließen</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleUpload}>
              <div
                className="border-2 border-dashed border-[var(--border)] rounded-xl p-8 text-center hover:border-[var(--accent)] transition-colors cursor-pointer mb-6 group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc" onChange={e => handleFileSelect(e.target.files?.[0] || null)} className="hidden" />
                {file ? (
                  <div>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <p className="font-medium text-lg">{file.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">{(file.size / 1024).toFixed(1)} KB</p>
                    {classifying && <p className="text-sm text-[var(--accent)] mt-2">Modul & Thema werden erkannt...</p>}
                  </div>
                ) : (
                  <div>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <p className="text-[var(--text-muted)]">Klicke hier, um eine PDF- oder Word-Datei auszuwählen</p>
                  </div>
                )}
              </div>

              {providers.length > 0 && (
                <div className="mb-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">
                      Struktur-Modell (Pass 1)
                    </label>
                    <select
                      value={selectedStructureModel}
                      onChange={(e) => setSelectedStructureModel(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all text-[var(--text)]"
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
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">Erstellt die Arbeitsblatt-Struktur aus dem Dokument.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">
                      Anreicherungs-Modell (Pass 2)
                    </label>
                    <select
                      value={selectedEnrichmentModel}
                      onChange={(e) => setSelectedEnrichmentModel(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all text-[var(--text)]"
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
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">Fügt Lösungen, interaktive Komponenten und Hinweise hinzu.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text)] mb-2">
                      Review-Modell (Pass 3)
                    </label>
                    <select
                      value={selectedReviewerModel}
                      onChange={(e) => setSelectedReviewerModel(e.target.value)}
                      className="w-full px-3 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--input-bg)] text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all text-[var(--text)]"
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
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">Prüft und korrigiert das Arbeitsblatt auf Vollständigkeit und Fehler.</p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setAutoDetect(!autoDetect)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-none cursor-pointer ${autoDetect ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
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

              {uploadError && <div className="mb-4 p-3 bg-[var(--error-bg)] text-[var(--error)] rounded-xl text-sm font-medium border border-[var(--error)]/20">{uploadError}</div>}

              <button type="submit" disabled={uploading || !file} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[var(--gradient-start)] to-[var(--gradient-end)] text-white px-5 py-3 rounded-xl font-semibold hover:opacity-90 transition-all disabled:opacity-40 border-none cursor-pointer shadow-md shadow-[var(--accent-glow)]">
                {uploading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>Wird hochgeladen...</> : 'Hochladen & Verarbeiten'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}