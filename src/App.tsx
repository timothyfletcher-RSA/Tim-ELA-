/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  Settings, 
  History, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Copy, 
  Download, 
  Printer, 
  Trash2, 
  ChevronRight,
  Info,
  User,
  ShieldCheck,
  Zap,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---

type GradeLevel = 'Grade 7' | 'Grade 8' | 'Grade 9';
type ResponseType = 'PEEL paragraph' | 'CEA paragraph' | 'Analytical paragraph';
type Strictness = 'Supportive / lenient' | 'Standard' | 'More rigorous';
type FeedbackLength = 'Very concise' | 'Standard' | 'Detailed';

interface TeacherSettings {
  prioritizeStructure: boolean;
  prioritizeDepth: boolean;
  prioritizeAccuracy: boolean;
  lenientGrammar: boolean;
  strictTone: boolean;
  rewardEffort: boolean;
  pushHighAttainers: boolean;
  mentionDevices: boolean;
  focusOnQuestion: boolean;
}

interface AnalysisResult {
  overallJudgment: string;
  scores: {
    ideas: number;
    structure: number;
    language: number;
    total: number;
    percentage: number;
    descriptor: string;
  };
  peelDiagnosis: {
    point: 'Secure' | 'Partial' | 'Missing';
    evidence: 'Secure' | 'Partial' | 'Missing';
    explanation: 'Secure' | 'Partial' | 'Missing';
    link: 'Secure' | 'Partial' | 'Missing';
  };
  strengths: string[];
  gaps: string[];
  nextSteps: string[];
  www: string;
  ebi: string;
  grammarNotes: string;
  teacherNotes: string;
  studentFeedback: string;
  aiCaution?: string;
  sentenceStarters?: string[];
}

interface HistoryItem {
  id: string;
  timestamp: number;
  question: string;
  studentResponse: string;
  result: AnalysisResult;
}

// --- Constants & Demo Data ---

const DEMO_EXAMPLES = [
  {
    name: "Strong (Grade 9)",
    question: "How does the writer use imagery to develop the theme of isolation in the opening chapter?",
    response: "The writer uses cold, stark imagery to emphasize the protagonist's profound isolation. When the narrator describes the landscape as an 'endless, unblemished sheet of white that swallowed all sound,' it creates a sense of being trapped in a void. The word 'swallowed' suggests a predatory silence that isolates the character from the world. This imagery develops the theme by showing that isolation isn't just being alone, but being consumed by a environment that refuses to acknowledge your existence.",
    grade: "Grade 9" as GradeLevel,
    type: "PEEL paragraph" as ResponseType
  },
  {
    name: "Developing (Grade 8)",
    question: "How does the author present the character of Scrooge in the first stave?",
    response: "Scrooge is presented as a very cold and mean person. The author says he was 'hard and sharp as flint' which shows he is tough and doesn't have any feelings for others. Flint is a rock that can start fires but it is also very hard. This shows Scrooge is a hard man. He doesn't like Christmas and he is mean to his clerk. This makes the reader think he is the villain of the story.",
    grade: "Grade 8" as GradeLevel,
    type: "PEEL paragraph" as ResponseType
  },
  {
    name: "Limited (Grade 7)",
    question: "What is the main message of the poem?",
    response: "The main message is that nature is beautiful and we should look after it. The poet says the trees are green and the sun is shining. I think this is a good message because I like nature too. People should stop littering because it hurts the animals.",
    grade: "Grade 7" as GradeLevel,
    type: "Analytical paragraph" as ResponseType
  }
];

// --- Main Component ---

export default function App() {
  // Input State
  const [question, setQuestion] = useState('');
  const [studentResponse, setStudentResponse] = useState('');
  const [sourceExcerpt, setSourceExcerpt] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>('Grade 8');
  const [responseType, setResponseType] = useState<ResponseType>('PEEL paragraph');
  const [strictness, setStrictness] = useState<Strictness>('Standard');
  const [feedbackLength, setFeedbackLength] = useState<FeedbackLength>('Standard');
  
  // Checkboxes
  const [options, setOptions] = useState({
    checkPEEL: true,
    checkTone: true,
    checkEvidence: true,
    checkTopicSentence: true,
    checkAnalysisDepth: true,
    checkGrammar: true,
    flagAI: false,
    includeSentenceStarters: true,
    includeModelHints: true,
  });

  // Teacher Settings
  const [teacherSettings, setTeacherSettings] = useState<TeacherSettings>({
    prioritizeStructure: true,
    prioritizeDepth: true,
    prioritizeAccuracy: false,
    lenientGrammar: false,
    strictTone: true,
    rewardEffort: true,
    pushHighAttainers: true,
    mentionDevices: true,
    focusOnQuestion: true,
  });

  // App State
  const [activeTab, setActiveTab] = useState<'input' | 'results' | 'history' | 'settings'>('input');
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>('teacher');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load History from LocalStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('peel_grader_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save History to LocalStorage
  useEffect(() => {
    localStorage.setItem('peel_grader_history', JSON.stringify(history));
  }, [history]);

  // --- Logic ---

  const handleAnalyze = async () => {
    if (!question.trim() || !studentResponse.trim()) {
      setError("Please provide both a question and a student response.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        You are an experienced ELA teacher grading one student analytical paragraph.
        
        CONTEXT:
        - Grade Level: ${gradeLevel}
        - Response Type: ${responseType}
        - Teacher Strictness: ${strictness}
        - Feedback Length: ${feedbackLength}
        - Source Excerpt (if provided): ${sourceExcerpt || "None provided"}
        
        TEACHER PREFERENCES:
        ${Object.entries(teacherSettings).filter(([_, v]) => v).map(([k]) => `- ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join('\n')}
        
        CHECKLIST:
        ${Object.entries(options).filter(([_, v]) => v).map(([k]) => `- ${k.replace(/([A-Z])/g, ' $1').toLowerCase()}`).join('\n')}
        
        STUDENT WORK:
        Question: "${question}"
        Response: "${studentResponse}"
        
        GRADING RUBRIC (Total 12 points):
        1. Ideas / 4: Interpretation quality, relevance, depth, accuracy.
        2. Structure / 4: PEEL organization, flow, coherence.
        3. Use of Language / 4: Tone, clarity, grammar, punctuation.
        
        Scoring: 4=Strong, 3=Mostly effective, 2=Developing, 1=Limited, 0=Not demonstrated.
        
        REQUIREMENTS:
        - Be constructive, accurate, and classroom-practical.
        - Focus on helping students improve without fully rewriting their work.
        - Identify PEEL elements as Secure, Partial, or Missing.
        - Provide concise, actionable next steps.
        - Distinguish summary from analysis.
        - Use "you" when addressing students.
        - Output MUST be valid JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallJudgment: { type: Type.STRING },
              scores: {
                type: Type.OBJECT,
                properties: {
                  ideas: { type: Type.NUMBER },
                  structure: { type: Type.NUMBER },
                  language: { type: Type.NUMBER },
                  total: { type: Type.NUMBER },
                  percentage: { type: Type.NUMBER },
                  descriptor: { type: Type.STRING }
                },
                required: ["ideas", "structure", "language", "total", "percentage", "descriptor"]
              },
              peelDiagnosis: {
                type: Type.OBJECT,
                properties: {
                  point: { type: Type.STRING, enum: ["Secure", "Partial", "Missing"] },
                  evidence: { type: Type.STRING, enum: ["Secure", "Partial", "Missing"] },
                  explanation: { type: Type.STRING, enum: ["Secure", "Partial", "Missing"] },
                  link: { type: Type.STRING, enum: ["Secure", "Partial", "Missing"] }
                },
                required: ["point", "evidence", "explanation", "link"]
              },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gaps: { type: Type.ARRAY, items: { type: Type.STRING } },
              nextSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
              www: { type: Type.STRING },
              ebi: { type: Type.STRING },
              grammarNotes: { type: Type.STRING },
              teacherNotes: { type: Type.STRING },
              studentFeedback: { type: Type.STRING },
              aiCaution: { type: Type.STRING },
              sentenceStarters: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["overallJudgment", "scores", "peelDiagnosis", "strengths", "gaps", "nextSteps", "www", "ebi", "grammarNotes", "teacherNotes", "studentFeedback"]
          }
        }
      });

      const parsedResult = JSON.parse(response.text) as AnalysisResult;
      setResult(parsedResult);
      
      // Add to history
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        question,
        studentResponse,
        result: parsedResult
      };
      setHistory(prev => [newHistoryItem, ...prev].slice(0, 50));
      
      setActiveTab('results');
    } catch (err) {
      console.error(err);
      setError("An error occurred during analysis. Please check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadDemo = (demo: typeof DEMO_EXAMPLES[0]) => {
    setQuestion(demo.question);
    setStudentResponse(demo.response);
    setGradeLevel(demo.grade);
    setResponseType(demo.type);
    setActiveTab('input');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Simple feedback could be added here
  };

  const handlePrint = () => {
    window.print();
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
    }
  };

  // --- Render Helpers ---

  const ScoreBadge = ({ score, max = 4 }: { score: number, max?: number }) => {
    return (
      <div className="text-center border border-border p-2 min-w-[60px]">
        <span className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Score</span>
        <span className="text-xl font-black block leading-none">{score}/{max}</span>
      </div>
    );
  };

  const DiagnosisBadge = ({ label, status }: { label: string, status: 'Secure' | 'Partial' | 'Missing' }) => {
    const styles = {
      Secure: 'bg-[#E6FFFA] text-secure border-secure',
      Partial: 'bg-[#FFFAF0] text-partial border-partial',
      Missing: 'bg-[#FFF5F5] text-missing border-missing',
    };
    return (
      <div className={`px-2 py-2 text-center text-[10px] font-black uppercase tracking-widest border rounded-sm ${styles[status]}`}>
        {label}: {status}
      </div>
    );
  };

  // --- Main UI ---

  return (
    <div className="h-screen flex flex-col bg-[#F5F5F5] text-ink font-sans overflow-hidden">
      {/* Navigation Header */}
      <header className="bg-paper border-b-2 border-ink px-8 py-4 flex items-center justify-between shrink-0 print:hidden">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-black tracking-tighter uppercase font-serif">PEEL <span className="text-blue-800">Analysis Dashboard</span></h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
            SESSION: {gradeLevel.toUpperCase()} ENGLISH | {responseType.toUpperCase()}
          </div>
          <nav className="flex items-center bg-border p-[1px] border border-ink">
            <button 
              onClick={() => setActiveTab('input')}
              className={`px-4 py-2 text-[11px] font-bold uppercase transition-all ${activeTab === 'input' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50'}`}
            >
              Input
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              disabled={!result}
              className={`px-4 py-2 text-[11px] font-bold uppercase transition-all ${activeTab === 'results' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50 disabled:opacity-40'}`}
            >
              Results
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-[11px] font-bold uppercase transition-all ${activeTab === 'history' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50'}`}
            >
              History
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 text-[11px] font-bold uppercase transition-all ${activeTab === 'settings' ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-gray-50'}`}
            >
              Settings
            </button>
          </nav>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANE: INPUTS (Always visible on large screens if needed, but following tab logic for now) */}
        <aside className={`w-[400px] bg-paper border-r border-border flex flex-col overflow-hidden transition-all ${activeTab === 'input' || activeTab === 'settings' ? 'translate-x-0' : '-translate-x-full absolute lg:relative'}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'input' && (
              <>
                <div className="flex items-center justify-between border-b border-ink pb-2 mb-4">
                  <h2 className="text-xs font-black uppercase tracking-widest">Teacher Inputs</h2>
                  <div className="flex gap-1">
                    {DEMO_EXAMPLES.map((demo, i) => (
                      <button 
                        key={i}
                        onClick={() => loadDemo(demo)}
                        className="text-[9px] font-bold border border-border px-1.5 py-0.5 hover:bg-ink hover:text-white transition-colors uppercase"
                      >
                        Ex {i+1}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] uppercase font-bold tracking-wider mb-1 block text-gray-500">Writing Prompt / Question</label>
                    <textarea 
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-border focus:border-ink outline-none font-serif text-sm resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[11px] uppercase font-bold tracking-wider mb-1 block text-gray-500">Student Paragraph Response</label>
                    <textarea 
                      value={studentResponse}
                      onChange={(e) => setStudentResponse(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 border border-border focus:border-ink outline-none font-serif text-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] uppercase font-bold tracking-wider mb-1 block text-gray-500">Grade Level</label>
                      <select 
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value as GradeLevel)}
                        className="w-full px-2 py-1.5 border border-border text-xs font-bold uppercase outline-none focus:border-ink"
                      >
                        <option>Grade 7</option>
                        <option>Grade 8</option>
                        <option>Grade 9</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase font-bold tracking-wider mb-1 block text-gray-500">Strictness</label>
                      <select 
                        value={strictness}
                        onChange={(e) => setStrictness(e.target.value as Strictness)}
                        className="w-full px-2 py-1.5 border border-border text-xs font-bold uppercase outline-none focus:border-ink"
                      >
                        <option>Supportive / lenient</option>
                        <option>Standard</option>
                        <option>More rigorous</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] uppercase font-bold tracking-wider mb-1 block text-gray-500">Analysis Parameters</label>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 bg-gray-50 p-3 border border-border">
                      {Object.entries(options).map(([key, value]) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={value}
                            onChange={() => setOptions(prev => ({ ...prev, [key]: !prev[key as keyof typeof options] }))}
                            className="w-3 h-3 border-border text-ink focus:ring-ink"
                          />
                          <span className="text-[10px] font-bold uppercase text-gray-500 group-hover:text-ink transition-colors">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^check/, '').trim()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h2 className="text-xs font-black uppercase tracking-widest border-b border-ink pb-2">Teacher Preferences</h2>
                <div className="space-y-2">
                  {Object.entries(teacherSettings).map(([key, value]) => (
                    <label key={key} className="flex items-center justify-between p-3 border border-border hover:border-ink transition-colors cursor-pointer bg-white">
                      <span className="text-[10px] font-bold uppercase text-gray-600">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={value}
                        onChange={() => setTeacherSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof teacherSettings] }))}
                        className="w-4 h-4 text-ink focus:ring-ink"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-border bg-gray-50">
            <button 
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full bg-ink text-white font-bold py-4 uppercase tracking-widest text-xs hover:bg-gray-800 transition-all disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing..." : "Analyze & Grade Response"}
            </button>
            {error && <p className="mt-2 text-[10px] text-missing font-bold uppercase">{error}</p>}
          </div>
        </aside>

        {/* RIGHT PANE: OUTPUTS */}
        <main className="flex-1 bg-[#F9F9F9] overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {activeTab === 'results' && result ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                {/* Result Header */}
                <div className="bg-white border border-border p-8 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-ink"></div>
                  
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b-2 border-ink pb-6 mb-8">
                    <div>
                      <div className="text-6xl font-black font-serif leading-none mb-2">{result.scores.total}<span className="text-xl opacity-30">/12</span></div>
                      <div className="text-xs font-black uppercase tracking-[0.2em] text-secure">{result.scores.descriptor} ({result.scores.percentage}%)</div>
                    </div>
                    <div className="md:text-right max-w-md">
                      <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Overall Judgment</label>
                      <p className="text-lg font-bold font-serif italic leading-tight">"{result.overallJudgment}"</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      {/* View Toggle */}
                      <div className="flex border border-ink w-fit bg-border p-[1px] print:hidden">
                        <button 
                          onClick={() => setViewMode('teacher')}
                          className={`px-4 py-1.5 text-[10px] font-bold uppercase transition-all ${viewMode === 'teacher' ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                        >
                          Teacher Diagnostic
                        </button>
                        <button 
                          onClick={() => setViewMode('student')}
                          className={`px-4 py-1.5 text-[10px] font-bold uppercase transition-all ${viewMode === 'student' ? 'bg-ink text-white' : 'bg-white text-ink'}`}
                        >
                          Student View
                        </button>
                      </div>

                      {viewMode === 'teacher' ? (
                        <div className="space-y-8">
                          <div className="grid grid-cols-4 gap-2">
                            <DiagnosisBadge label="P" status={result.peelDiagnosis.point} />
                            <DiagnosisBadge label="E" status={result.peelDiagnosis.evidence} />
                            <DiagnosisBadge label="E" status={result.peelDiagnosis.explanation} />
                            <DiagnosisBadge label="L" status={result.peelDiagnosis.link} />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <ScoreBadge score={result.scores.ideas} />
                            <ScoreBadge score={result.scores.structure} />
                            <ScoreBadge score={result.scores.language} />
                          </div>

                          <div className="space-y-4">
                            <h3 className="text-[11px] font-black uppercase border-l-4 border-ink pl-3">Teacher Diagnostic Notes</h3>
                            <div className="font-serif text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                              {result.teacherNotes}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <h3 className="text-[11px] font-black uppercase border-l-4 border-ink pl-3">What Went Well</h3>
                              <p className="font-serif text-[15px] leading-relaxed text-gray-700">{result.www}</p>
                            </div>
                            <div className="space-y-4">
                              <h3 className="text-[11px] font-black uppercase border-l-4 border-ink pl-3">Even Better If</h3>
                              <p className="font-serif text-[15px] leading-relaxed text-gray-700">{result.ebi}</p>
                            </div>
                          </div>

                          <div className="space-y-4 bg-gray-50 p-6 border border-border">
                            <h3 className="text-[11px] font-black uppercase border-l-4 border-ink pl-3">Next Steps & Actions</h3>
                            <ul className="space-y-3">
                              {result.nextSteps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-sm font-serif">
                                  <span className="font-bold text-ink shrink-0">{i + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-6 border-l border-border pl-8 hidden lg:block">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3">Strengths</h4>
                        <ul className="space-y-2">
                          {result.strengths.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-[12px] font-bold leading-tight flex gap-2">
                              <span className="text-secure">●</span> {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-gray-400 mb-3">Gaps</h4>
                        <ul className="space-y-2">
                          {result.gaps.slice(0, 3).map((g, i) => (
                            <li key={i} className="text-[12px] font-bold leading-tight flex gap-2">
                              <span className="text-missing">●</span> {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="pt-6 border-t border-border mt-auto">
                        <div className="flex flex-col gap-2">
                          <button onClick={() => copyToClipboard(viewMode === 'student' ? result.studentFeedback : result.teacherNotes)} className="w-full border border-ink py-2 text-[10px] font-bold uppercase hover:bg-gray-50">Copy Feedback</button>
                          <button onClick={handlePrint} className="w-full border border-ink py-2 text-[10px] font-bold uppercase hover:bg-gray-50">Print Report</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'history' ? (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-4">
                <div className="flex items-center justify-between border-b-2 border-ink pb-2 mb-6">
                  <h2 className="text-xl font-black uppercase font-serif">Session History</h2>
                  <button onClick={clearHistory} className="text-[10px] font-bold uppercase hover:text-missing">Clear All</button>
                </div>
                {history.map(item => (
                  <div 
                    key={item.id} 
                    onClick={() => { setResult(item.result); setActiveTab('results'); }}
                    className="bg-white border border-border p-4 hover:border-ink cursor-pointer transition-all flex justify-between items-center group"
                  >
                    <div>
                      <h3 className="text-sm font-bold uppercase line-clamp-1 group-hover:text-blue-800">{item.question}</h3>
                      <p className="text-[10px] text-gray-400 uppercase font-bold">{new Date(item.timestamp).toLocaleDateString()}</p>
                    </div>
                    <div className="text-2xl font-black font-serif opacity-20 group-hover:opacity-100">{item.result.scores.total}/12</div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-300">
                <BookOpen size={64} className="mb-4 opacity-10" />
                <p className="text-xs font-bold uppercase tracking-widest">Awaiting Analysis</p>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer Branding */}
      <footer className="bg-paper border-t border-border px-8 py-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-gray-400 shrink-0 print:hidden">
        <p>© 2026 PEEL Paragraph Grader • Editorial Aesthetic v1.0</p>
        <div className="flex items-center gap-4">
          <span>Secure Analysis</span>
          <span className="text-ink">Gemini 3.1 Pro</span>
        </div>
      </footer>

      {/* PRINT ONLY REPORT TEMPLATE */}
      <div className="hidden print:block p-10 bg-white text-black font-serif">
        <div className="border-b-2 border-black pb-4 mb-8 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">PEEL Analysis Report</h1>
            <p className="text-sm text-gray-600">Generated on {new Date().toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-black">{result?.scores.total}/12</p>
            <p className="text-xs font-bold uppercase tracking-widest">{result?.scores.descriptor}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-8">
          <div className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest border-b border-gray-300 pb-1">Student Work</h2>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Question</p>
              <p className="text-sm italic leading-relaxed">{question}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Response</p>
              <p className="text-sm leading-relaxed">{studentResponse}</p>
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xs font-black uppercase tracking-widest border-b border-gray-300 pb-1">Diagnostic Breakdown</h2>
            <div className="grid grid-cols-2 gap-2">
              {result && Object.entries(result.peelDiagnosis).map(([k, v]) => (
                <div key={k} className="border border-gray-200 p-3">
                  <p className="text-[9px] font-black uppercase text-gray-400 mb-1">{k}</p>
                  <p className="text-xs font-bold uppercase tracking-wider">{v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-4 border-t border-gray-100">
              <div className="flex justify-between text-xs font-bold"><span>Ideas & Interpretation</span> <span>{result?.scores.ideas}/4</span></div>
              <div className="flex justify-between text-xs font-bold"><span>Structure & Coherence</span> <span>{result?.scores.structure}/4</span></div>
              <div className="flex justify-between text-xs font-bold"><span>Use of Language</span> <span>{result?.scores.language}/4</span></div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest border-b border-gray-300 pb-1 mb-4">Teacher Feedback</h2>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{result?.teacherNotes}</p>
          </section>
          
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest border-b border-gray-300 pb-1 mb-4">Student Action Plan</h2>
            <div className="bg-gray-50 p-6 border border-gray-200">
              <p className="text-xs font-black uppercase text-gray-400 mb-2">What Went Well</p>
              <p className="text-sm mb-6">{result?.www}</p>
              <p className="text-xs font-black uppercase text-gray-400 mb-2">Even Better If</p>
              <p className="text-sm mb-6">{result?.ebi}</p>
              <p className="text-xs font-black uppercase text-gray-400 mb-2">Next Steps</p>
              <ul className="list-decimal list-inside text-sm space-y-2">
                {result?.nextSteps.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
