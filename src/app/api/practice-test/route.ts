export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AIProvider, type PracticeQuestion, type PracticeTest } from '@/lib/ai-provider';
import { getProviderConfig, getProviderConfigForRole } from '@/lib/providers-store';
import { extractTextFromDocx, extractTextFromPdf } from '@/lib/parser';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

function cleanObjective(line: string): string {
  return line
    .replace(/^\s*[-*•]\s*/, '')
    .replace(/^\s*\d+[.)]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractObjectives(text: string): string[] {
  const lineObjectives = text
    .split(/\r?\n/)
    .map(cleanObjective)
    .filter(line => line.length >= 12 && line.length <= 260);

  if (lineObjectives.length >= 3) {
    return Array.from(new Set(lineObjectives)).slice(0, 12);
  }

  return Array.from(new Set(
    text
      .split(/(?<=[.!?])\s+/)
      .map(cleanObjective)
      .filter(sentence => sentence.length >= 18 && sentence.length <= 260)
  )).slice(0, 12);
}

function fallbackPracticeTest(rawText: string, moduleNumber: string, topic: string): PracticeTest {
  const objectives = extractObjectives(rawText);
  const baseObjectives = objectives.length > 0 ? objectives : ['Die wichtigsten Begriffe erklären', 'Das Thema an einem Beispiel anwenden', 'Typische Fehler erkennen'];

  const questions: PracticeQuestion[] = baseObjectives.slice(0, 8).map((objective, index) => {
    const id = `q${index + 1}`;
    if (index % 3 === 2) {
      return {
        id,
        type: 'short_answer',
        question: `Erkläre kurz, wie du folgendes Lernziel in einer Prüfung zeigen würdest: "${objective}"`,
        correctAnswer: `Eine gute Antwort erklärt das Lernziel mit eigenen Worten und nennt ein konkretes Beispiel oder Vorgehen.`,
        acceptableAnswers: objective.split(/\s+/).filter(w => w.length > 4).slice(0, 5),
        explanation: 'Vergleiche deine Antwort mit dem Lernziel und prüfe, ob du ein konkretes Beispiel genannt hast.',
        objective,
      };
    }

    const correct = /^ich kann\b/i.test(objective)
      ? objective
      : `Ich kann ${objective.charAt(0).toLowerCase()}${objective.slice(1)}`;
    return {
      id,
      type: 'single_choice',
      question: `Welche Aussage passt am besten zum Lernziel "${objective}"?`,
      options: [
        correct,
        'Ich lerne nur einzelne Wörter auswendig, ohne sie anzuwenden.',
        'Ich überspringe das Thema, sobald ich die Überschrift erkenne.',
        'Ich kann das Thema nur mit der Musterlösung neben mir lösen.',
      ],
      correctAnswer: correct,
      acceptableAnswers: [],
      explanation: 'Ein Lernziel ist erreicht, wenn du es erklären und anwenden kannst, nicht nur wiedererkennst.',
      objective,
    };
  });

  return {
    title: `Übungstest${moduleNumber ? ` Modul ${moduleNumber}` : ''}${topic ? ` - ${topic}` : ''}`,
    module_number: moduleNumber,
    topic,
    objectives: baseObjectives,
    questions,
    generatedBy: 'fallback',
  };
}

async function extractFileText(file: File): Promise<string> {
  const ext = path.extname(file.name).toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === '.txt' || ext === '.md' || file.type.startsWith('text/')) {
    return buffer.toString('utf8');
  }

  const tmpPath = path.join(os.tmpdir(), `lernziele-${Date.now()}-${Math.random().toString(36).slice(2)}${ext || '.bin'}`);
  await fs.writeFile(tmpPath, buffer);
  try {
    if (ext === '.pdf' || file.type === 'application/pdf') {
      return (await extractTextFromPdf(tmpPath)).join('\n\n');
    }
    if (ext === '.docx' || ext === '.doc' || file.type.includes('word')) {
      return (await extractTextFromDocx(tmpPath)).join('\n\n');
    }
  } finally {
    try { await fs.unlink(tmpPath); } catch {}
  }

  throw new Error('Unsupported file type. Upload PDF, Word, TXT, or paste the Lernziele.');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = String(formData.get('text') || '');
    const moduleNumber = String(formData.get('module_number') || '').trim();
    const topic = String(formData.get('topic') || '').trim();
    const providerModelParam = String(formData.get('providerModel') || '');

    let rawText = text.trim();
    if (file && file.size > 0) {
      rawText = `${rawText}\n\n${await extractFileText(file)}`.trim();
    }

    if (!rawText) {
      return NextResponse.json({ error: 'Keine Lernziele gefunden. Lade eine Datei hoch oder füge Text ein.' }, { status: 400 });
    }

    try {
      let providerConfig;
      if (providerModelParam) {
        const [providerId, modelOverride] = providerModelParam.includes(':')
          ? providerModelParam.split(':')
          : [providerModelParam, undefined];
        providerConfig = getProviderConfig(providerId);
        if (modelOverride) providerConfig.model = modelOverride;
      } else {
        providerConfig = getProviderConfigForRole('lightweight');
      }

      if (!providerConfig.apiKey && providerConfig.provider !== 'ollama' && providerConfig.provider !== 'openai-compatible') {
        throw new Error('No API key configured for selected provider');
      }

      const ai = new AIProvider(providerConfig);
      const test = await ai.generatePracticeTestFromObjectives(rawText, moduleNumber, topic);
      return NextResponse.json({ test });
    } catch (error) {
      console.warn('Practice test AI generation failed, using fallback:', error);
      return NextResponse.json({
        test: fallbackPracticeTest(rawText, moduleNumber, topic),
        warning: 'KI-Generierung nicht verfügbar. Es wurde ein einfacher Lernziel-Test erzeugt.',
      });
    }
  } catch (error) {
    console.error('Practice test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Practice test generation failed' },
      { status: 500 }
    );
  }
}
