import React, { useState } from 'react';
import { mockKnowledgeDocuments } from '../../data/mockData';
import type { KnowledgeDocument } from '../../types';
import {
  BookOpen,
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
} from 'lucide-react';

interface KnowledgeBaseViewProps {
  documents?: KnowledgeDocument[];
  onAddDocument?: (doc: KnowledgeDocument) => void;
  onDeleteDocument?: (id: string) => void;
  onUpdateDocument?: (doc: KnowledgeDocument) => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({
  documents = mockKnowledgeDocuments,
  onAddDocument,
  onDeleteDocument,
  onUpdateDocument,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  // New Doc Form
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<KnowledgeDocument['category']>('Product Specs');
  const [newSummary, setNewSummary] = useState('');

  const categories = [
    'All',
    'Product Specs',
    'Battlecards',
    'Case Studies',
    'Pricing',
    'Compliance',
  ];

  const filteredDocs = documents.filter((doc) => {
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleReindex = (id: string) => {
    setReindexingId(id);
    setTimeout(() => {
      const doc = documents.find((d) => d.id === id);
      if (doc && onUpdateDocument) {
        onUpdateDocument({ ...doc, status: 'Indexed' });
      }
      setReindexingId(null);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    onDeleteDocument?.(id);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDoc: KnowledgeDocument = {
      id: `doc-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      type: 'pdf',
      sizeOrTokens: '1.2 MB • 9,400 tokens',
      status: 'Indexed',
      uploadedAt: 'Just now',
      summary:
        newSummary.trim() ||
        'Uploaded collateral ingested into autonomous agent vector memory.',
    };

    onAddDocument?.(newDoc);
    setNewTitle('');
    setNewSummary('');
    setShowAddModal(false);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'notion':
        return <Layers className="h-4 w-4 text-purple-400" />;
      case 'url':
        return <Link2 className="h-4 w-4 text-sky-400" />;
      default:
        return <FileText className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-slate-900/80 p-5">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Vector Context Depth
            </span>
            <Database className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">114,000</div>
          <p className="text-xs text-slate-400 mt-1">
            Active tokens embedded across {documents.length} collateral assets
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/60 to-slate-900/80 p-5">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Query Accuracy Coverage
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">98.4%</div>
          <p className="text-xs text-slate-400 mt-1">
            Persona objections addressed by existing playbooks
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/60 to-slate-900/80 p-5">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Active Sync Connectors
            </span>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono mt-1">2 Live Sources</div>
          <p className="text-xs text-slate-400 mt-1">
            Notion Workspace & Enterprise PDF File Hub
          </p>
        </div>
      </div>

      {/* Upload Dropzone Mock Area */}
      <div
        onClick={() => setShowAddModal(true)}
        className="group cursor-pointer rounded-2xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/40 hover:bg-slate-900/80 p-8 text-center transition-all"
      >
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 group-hover:scale-110 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-white">
            Upload Sales Collateral or Connect Live Docs
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-md">
            Drag and drop PDF pitch decks, customer case studies, product datasheets, or competitor battlecards.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow group-hover:bg-indigo-500">
              Browse Files or Add Asset
            </span>
          </div>
        </div>
      </div>

      {/* Search and Category Filter Toolbar */}
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
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search knowledge documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Document List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-2 rounded-2xl border border-slate-800 p-12 text-center text-xs text-slate-500">
            No documents found matching "{searchQuery}".
          </div>
        ) : (
          filteredDocs.map((doc) => {
            const isReindexing = reindexingId === doc.id;
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
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        doc.status === 'Indexed'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-400 animate-pulse'
                      }`}
                    >
                      {doc.status}
                    </span>
                  </div>

                  {/* Summary / Snippet */}
                  <p className="mt-3 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {doc.summary}
                  </p>
                </div>

                {/* Footer Actions */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-500">{doc.uploadedAt}</span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReindex(doc.id)}
                      disabled={isReindexing}
                      title="Re-embed document into vector store"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                    >
                      <RefreshCw
                        className={`h-3 w-3 text-indigo-400 ${
                          isReindexing ? 'animate-spin' : ''
                        }`}
                      />
                      <span>{isReindexing ? 'Syncing...' : 'Re-index'}</span>
                    </button>

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

      {/* Modal: Add Document */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-indigo-400" />
                Add Knowledge Base Asset
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddDocument} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Document / Asset Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q4 Competitor Battlecard vs ZoomInfo"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) =>
                    setNewCategory(e.target.value as KnowledgeDocument['category'])
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
                  Summary / Context for Autonomous Agent
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide key takeaways, target objection responses, or product bullet points..."
                  value={newSummary}
                  onChange={(e) => setNewSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-500"
                >
                  Embed & Index
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
