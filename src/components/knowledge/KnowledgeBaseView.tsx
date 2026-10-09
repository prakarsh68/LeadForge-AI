import React, { useState, useEffect, useRef } from 'react';
import type {
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeAskResult,
  KnowledgeSearchResult,
  KnowledgeConfig,
} from '../../types';
import { api } from '../../services/api';
import {
  UploadCloud,
  FileText,
  Link2,
  CheckCircle2,
  RefreshCw,
  Search,
  Trash2,
  Sparkles,
  Database,
  Layers,
  X,
  AlertCircle,
  Cpu,
  FileCode,
  File,
} from 'lucide-react';

interface KnowledgeBaseViewProps {
  documents?: KnowledgeDocument[];
  onAddDocument?: (doc: KnowledgeDocument) => void;
  onDeleteDocument?: (id: string) => void;
  onUpdateDocument?: (doc: KnowledgeDocument) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents = [],
  onAddDocument,
  onDeleteDocument,
  onUpdateDocument,
}) => {
  const [localDocs, setLocalDocs] = useState<KnowledgeDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Config & Capability state
  const [config, setConfig] = useState<KnowledgeConfig | null>(null);

  // Q&A / RAG state
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askResult, setAskResult] = useState<KnowledgeAskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<KnowledgeDocument['category']>('Product Specs');
  const [uploadSummary, setUploadSummary] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunks Inspection Modal
  const [inspectingDoc, setInspectingDoc] = useState<KnowledgeDocument | null>(null);
  const [inspectingChunks, setInspectingChunks] = useState<KnowledgeChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // Document action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const categories = [
    'All',
    'Product Specs',
    'Battlecards',
    'Case Studies',
    'Pricing',
    'Compliance',
  ];

  const allDocuments = React.useMemo(() => {
    const map = new Map<string, KnowledgeDocument>();
    for (const d of documents) map.set(d.id, d);
    for (const d of localDocs) map.set(d.id, d);
    return Array.from(map.values());
  }, [documents, localDocs]);

  // Load config on mount
  useEffect(() => {
    let isMounted = true;
    api
      .getKnowledgeConfig()
      .then((cfg) => {
        if (isMounted) setConfig(cfg);
      })
      .catch((err) => {
        console.warn('Failed to load knowledge config:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const refreshConfig = async () => {
    try {
      const cfg = await api.getKnowledgeConfig();
      setConfig(cfg);
    } catch (err) {
      console.warn('Failed to refresh config:', err);
    }
  };

  // Live search handler
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchKnowledge(trimmed, {
          category: selectedCategory !== 'All' ? selectedCategory : undefined,
          limit: 6,
        });
        setSearchResults(results);
      } catch (err) {
        console.warn('Knowledge search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  // Handle RAG Ask
  const handleAsk = async (e?: React.FormEvent, customQuestion?: string) => {
    if (e) e.preventDefault();
    const q = customQuestion || question;
    if (!q.trim()) return;

    setIsAsking(true);
    setAskError(null);
    setAskResult(null);

    try {
      const result = await api.askKnowledge(q.trim(), {
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
      });
      setAskResult(result);
    } catch (err: any) {
      setAskError(err.message || 'Failed to process question');
    } finally {
      setIsAsking(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) {
        // Remove extension for default title
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
      setUploadError(null);
    }
  };

  // Handle File Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!uploadTitle) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
      setUploadError(null);
      setShowUploadModal(true);
    }
  };

  // Handle Upload Submission
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      if (uploadTitle) formData.append('title', uploadTitle);
      formData.append('category', uploadCategory);
      if (uploadSummary) formData.append('summary', uploadSummary);

      const created = await api.uploadKnowledgeDoc(formData);
      setLocalDocs((prev) => [created, ...prev.filter((d) => d.id !== created.id)]);
      onAddDocument?.(created);

      // Reset form and close
      setSelectedFile(null);
      setUploadTitle('');
      setUploadSummary('');
      setShowUploadModal(false);
      refreshConfig();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Re-index
  const handleReindex = async (doc: KnowledgeDocument) => {
    setActionLoadingId(doc.id);
    try {
      const updated = await api.reindexKnowledgeDoc(doc.id);
      setLocalDocs((prev) => [updated, ...prev.filter((d) => d.id !== updated.id)]);
      onUpdateDocument?.(updated);
      refreshConfig();
    } catch (err: any) {
      console.error('Re-index error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Retry
  const handleRetry = async (doc: KnowledgeDocument) => {
    setActionLoadingId(doc.id);
    try {
      const updated = await api.retryKnowledgeDoc(doc.id);
      setLocalDocs((prev) => [updated, ...prev.filter((d) => d.id !== updated.id)]);
      onUpdateDocument?.(updated);
      refreshConfig();
    } catch (err: any) {
      console.error('Retry error:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    try {
      await api.deleteKnowledgeDoc(id);
      setLocalDocs((prev) => prev.filter((d) => d.id !== id));
      onDeleteDocument?.(id);
      refreshConfig();
    } catch (err: any) {
      console.error('Delete error:', err);
    }
  };

  // Inspect Chunks
  const handleInspectChunks = async (doc: KnowledgeDocument) => {
    setInspectingDoc(doc);
    setIsLoadingChunks(true);
    setInspectingChunks([]);

    try {
      const chunks = await api.getKnowledgeChunks(doc.id);
      setInspectingChunks(chunks);
    } catch (err) {
      console.error('Failed to load chunks:', err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  // Filtered documents for UI
  const filteredDocs = allDocuments.filter((doc) => {
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    if (searchResults !== null) {
      // If active search results exist, show matching documents
      const matchingDocIds = new Set(searchResults.map((r) => r.documentId));
      return matchesCategory && matchingDocIds.has(doc.id);
    }
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'notion':
        return <Layers className="h-4 w-4 text-purple-400" />;
      case 'url':
        return <Link2 className="h-4 w-4 text-sky-400" />;
      case 'pdf':
        return <FileText className="h-4 w-4 text-rose-400" />;
      case 'md':
        return <FileCode className="h-4 w-4 text-amber-400" />;
      default:
        return <File className="h-4 w-4 text-indigo-400" />;
    }
  };

  const totalTokens = allDocuments.reduce((acc, doc) => {
    const match = doc.sizeOrTokens.match(/([\d,]+)\s+tokens/);
    if (match) {
      return acc + parseInt(match[1].replace(/,/g, ''), 10);
    }
    return acc + (doc.chunkCount ? doc.chunkCount * 120 : 0);
  }, 0);

  const totalChunksCount = config?.totalChunks || allDocuments.reduce((acc, d) => acc + (d.chunkCount || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Vector Context Depth
            </span>
            <Database className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {totalTokens > 0 ? totalTokens.toLocaleString() : '24,600'}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalChunksCount} chunks indexed across {allDocuments.length} collateral assets
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Retrieval Intelligence
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl font-black text-white font-mono">
              {config?.aiConfigured ? 'Semantic RAG' : 'Keyword Fallback'}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                config?.aiConfigured
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {config?.aiConfigured ? 'Active' : 'Deterministic'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {config?.aiConfigured
              ? `Model: ${config.chatModel} (${config.embeddingModel})`
              : 'AI API key unconfigured; keyword search active'}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-slate-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Supported Collateral
            </span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            PDF • Word • MD • TXT
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Page-aware PDF parsing & section chunking with overlap
          </p>
        </div>
      </div>

      {/* Grounded Knowledge Assistant (RAG Section) */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-indigo-950/40 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400">
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Knowledge Intelligence Assistant
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                  Grounded RAG
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Ask questions against sales decks, competitor battlecards, and enterprise specs
              </p>
            </div>
          </div>
        </div>

        {/* Quick Suggestion Pills */}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {[
            'What are the enterprise subscription pricing tiers?',
            'What compliance standards does LeadForge adhere to?',
            'What are our key differentiators against competitors?',
            'What are the ICP qualification criteria?',
          ].map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => {
                setQuestion(promptText);
                handleAsk(undefined, promptText);
              }}
              className="rounded-lg border border-slate-800 bg-slate-800/60 hover:bg-indigo-950/60 hover:border-indigo-500/40 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white transition-colors text-left"
            >
              "{promptText}"
            </button>
          ))}
        </div>

        {/* Question Form */}
        <form onSubmit={handleAsk} className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Ask a question about your knowledge base (e.g. pricing discounts, SOC2, or objection scripts)..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAsking ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Ask Agent</span>
              </>
            )}
          </button>
        </form>

        {/* Error State */}
        {askError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{askError}</span>
          </div>
        )}

        {/* Result & Citations Display */}
        {askResult && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                    askResult.searchMode === 'semantic'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {askResult.searchMode === 'semantic' ? 'Semantic RAG' : 'Keyword Evidence'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Confidence: {Math.round(askResult.confidence * 100)}%
                </span>
              </div>
              {askResult.model && (
                <span className="text-[10px] font-mono text-slate-500">
                  Model: {askResult.model}
                </span>
              )}
            </div>

            {/* Answer Text */}
            <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
              {askResult.answer}
            </div>

            {/* Verified Citations List */}
            {askResult.citations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  Verified Evidence Citations ({askResult.citations.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {askResult.citations.map((cite) => (
                    <div
                      key={cite.chunkId}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-xs hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                        <span className="truncate max-w-[200px]">{cite.documentTitle}</span>
                        {cite.pageNumber && (
                          <span className="text-[10px] text-slate-400">Page {cite.pageNumber}</span>
                        )}
                      </div>
                      {cite.sectionTitle && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Section: {cite.sectionTitle}
                        </div>
                      )}
                      <p className="mt-1 text-[11px] text-slate-300 line-clamp-2 italic">
                        "{cite.excerpt}"
                      </p>
                      <div className="mt-1.5 text-[9px] font-mono text-slate-500">
                        ID: {cite.chunkId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real Drag-and-Drop / File Upload Dropzone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => {
          fileInputRef.current?.click();
        }}
        className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/40 hover:bg-slate-900/80 p-8 text-center transition-all shadow-md"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md,.markdown"
          onChange={(e) => {
            handleFileChange(e);
            setShowUploadModal(true);
          }}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-white">
            Upload Sales Collateral or Drag & Drop Documents
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md">
            Ingest PDF pitch decks, DOCX sales battlecards, TXT product specs, or Markdown guidelines.
            Files are parsed, chunked, and embedded into vector storage.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow group-hover:bg-indigo-500">
              Browse Files (.pdf, .docx, .txt, .md)
            </span>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-sm">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search documents or query chunks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-8 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          {isSearching && (
            <RefreshCw className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-indigo-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Search Results Preview (if query active) */}
      {searchResults !== null && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>
              Search Results ({searchResults.length} matching chunks) for "{searchQuery}"
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                searchResults[0]?.searchMode === 'semantic'
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {searchResults[0]?.searchMode === 'semantic' ? 'Semantic Matches' : 'Keyword Matches'}
            </span>
          </div>
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">No matching chunks found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {searchResults.map((res) => (
                <div
                  key={res.chunkId}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] font-bold text-white">
                    <span className="truncate max-w-[220px]">{res.documentTitle}</span>
                    <span className="text-[10px] text-emerald-400">
                      Score: {Math.round(res.similarityScore * 100)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Category: {res.category} {res.pageNumber ? `• Page ${res.pageNumber}` : ''}
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed mt-1">
                    {res.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-slate-800 p-12 text-center text-xs text-slate-500">
            No documents found matching "{searchQuery}".
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isLoading = actionLoadingId === doc.id;
            const isFailed = doc.processingStatus === 'failed';
            const isProcessing =
              doc.processingStatus &&
              ['uploaded', 'extracting', 'chunking', 'indexing'].includes(doc.processingStatus);

            return (
              <div
                key={doc.id}
                className="group rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-800">
                        {getTypeIcon(doc.type)}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                          {doc.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300 font-medium">
                            {doc.category}
                          </span>
                          <span>•</span>
                          <span>{doc.sizeOrTokens}</span>
                          {doc.chunkCount !== undefined && doc.chunkCount > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-400 font-mono text-[10px]">
                                {doc.chunkCount} chunks
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        isFailed
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                          : isProcessing
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse'
                          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                      }`}
                    >
                      {isFailed
                        ? 'Failed'
                        : isProcessing
                        ? doc.processingStatus || 'Syncing'
                        : 'Indexed'}
                    </span>
                  </div>

                  {/* Summary / Snippet */}
                  <p className="mt-3 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {doc.summary || 'Collateral parsed and indexed into vector memory.'}
                  </p>

                  {/* Error Message if failed */}
                  {isFailed && doc.errorMessage && (
                    <div className="mt-2 rounded-lg bg-rose-950/30 border border-rose-500/30 p-2 text-[10px] text-rose-300">
                      Error: {doc.errorMessage}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">{doc.uploadedAt}</span>

                  <div className="flex items-center gap-1.5">
                    {/* Inspect Chunks Button */}
                    <button
                      onClick={() => handleInspectChunks(doc)}
                      title="Inspect extracted chunks and embeddings"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <Layers className="h-3 w-3 text-indigo-400" />
                      <span>Chunks</span>
                    </button>

                    {/* Retry Button if failed */}
                    {isFailed && (
                      <button
                        onClick={() => handleRetry(doc)}
                        disabled={isLoading}
                        title="Retry document processing"
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-700/50 bg-rose-900/30 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 transition-colors"
                      >
                        <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Retry</span>
                      </button>
                    )}

                    {/* Re-index Button */}
                    <button
                      onClick={() => handleReindex(doc)}
                      disabled={isLoading}
                      title="Re-chunk and re-embed document"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <RefreshCw
                        className={`h-3 w-3 text-indigo-400 ${isLoading ? 'animate-spin' : ''}`}
                      />
                      <span>{isLoading ? 'Syncing...' : 'Re-index'}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      title="Delete document"
                      className="rounded-lg p-1 text-slate-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Upload & Ingest File */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-indigo-400" />
                Upload & Ingest Collateral
              </h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                  setUploadError(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Selected File Box */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Source File *</label>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span className="text-xs text-white truncate">
                      {selectedFile ? selectedFile.name : 'No file selected'}
                    </span>
                    {selectedFile && (
                      <span className="text-[10px] text-slate-500 shrink-0">
                        ({Math.round(selectedFile.size / 1024)} KB)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold shrink-0 ml-2"
                  >
                    Change
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Document Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Competitor Battlecard vs ZoomInfo"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) =>
                    setUploadCategory(e.target.value as KnowledgeDocument['category'])
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Product Specs">Product Specs</option>
                  <option value="Battlecards">Battlecards</option>
                  <option value="Case Studies">Case Studies</option>
                  <option value="Pricing">Pricing</option>
                  <option value="Compliance">Compliance</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Summary / Key Takeaways (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Auto-extracted from document text if left blank..."
                  value={uploadSummary}
                  onChange={(e) => setUploadSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {uploadError && (
                <div className="rounded-lg bg-rose-950/40 border border-rose-500/40 p-2.5 text-[11px] text-rose-300">
                  {uploadError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                    setUploadError(null);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Ingesting & Chunking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Extract & Embed</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Inspect Chunks */}
      {inspectingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  Chunks Inspector: {inspectingDoc.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Category: {inspectingDoc.category} • Total Chunks: {inspectingChunks.length}
                </p>
              </div>
              <button
                onClick={() => setInspectingDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
              {isLoadingChunks ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-indigo-400" />
                  <span>Loading document chunks...</span>
                </div>
              ) : inspectingChunks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No chunks generated yet for this asset. Try clicking "Re-index".
                </div>
              ) : (
                inspectingChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-400">
                          #{chunk.chunkIndex}
                        </span>
                        {chunk.sectionTitle && (
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 font-medium">
                            {chunk.sectionTitle}
                          </span>
                        )}
                        {chunk.pageNumber && (
                          <span className="text-slate-400 text-[10px]">Page {chunk.pageNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{chunk.charCount} chars</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            chunk.hasEmbedding
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {chunk.hasEmbedding ? 'Embedded' : 'Keyword Only'}
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans text-xs whitespace-pre-wrap">
                      {chunk.content}
                    </p>
                    <div className="text-[9px] font-mono text-slate-600 pt-1 border-t border-slate-850">
                      ID: {chunk.id}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setInspectingDoc(null)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs font-semibold text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
