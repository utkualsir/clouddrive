import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, X, Plus, Loader2, Eye, Edit3 } from 'lucide-react';
import { forumApi } from '@/api/forum';
import { useAuth } from '@/contexts/AuthContext';
import { renderMarkdown, TagPill } from './forumUtils';
import toast from 'react-hot-toast';

export default function ForumNewThreadPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const editId = params.get('edit');
  const presetCatId = params.get('cat') ?? '';

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState(presetCatId);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // Categories
  const { data: catData } = useQuery({
    queryKey: ['forum-categories'],
    queryFn: () => forumApi.getCategories(),
  });
  const categories = catData?.data ?? [];

  // Tag suggestions
  const { data: allTagsData } = useQuery({
    queryKey: ['forum-tags'],
    queryFn: () => forumApi.getTags(),
  });
  const allTags: string[] = allTagsData?.data ?? [];
  const tagSuggestions = allTags.filter(t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()));

  // If editing, load existing thread
  const { data: editData } = useQuery({
    queryKey: ['forum-thread', editId],
    queryFn: () => forumApi.getThread(editId!),
    enabled: !!editId,
  });

  useEffect(() => {
    if (editData?.data) {
      const t = editData.data;
      setTitle(t.title);
      setContent(t.content);
      setCategoryId(t.categoryId);
      setTags(t.tags);
    }
  }, [editData]);

  const createMutation = useMutation({
    mutationFn: () => forumApi.createThread({ title: title.trim(), content: content.trim(), categoryId, tags }),
    onSuccess: data => {
      toast.success('Thread created!');
      navigate(`/forum/thread/${data.data!.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to create thread');
    },
  });

  const editMutation = useMutation({
    mutationFn: () => forumApi.updateThread(editId!, { title: title.trim(), content: content.trim(), categoryId, tags }),
    onSuccess: () => {
      toast.success('Thread updated!');
      navigate(`/forum/thread/${editId}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(msg ?? 'Failed to update thread');
    },
  });

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (!t || tags.includes(t) || tags.length >= 5) return;
    setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (i: number) => setTags(prev => prev.filter((_, idx) => idx !== i));

  const canSubmit =
    title.trim().length >= 10 &&
    title.trim().length <= 200 &&
    content.trim().length >= 20 &&
    content.trim().length <= 10000 &&
    !!categoryId;

  const isPending = createMutation.isPending || editMutation.isPending;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A] flex flex-col items-center justify-center gap-3">
        <p className="text-[#6B7280] dark:text-[#888888]">Please sign in to create a thread</p>
        <Link to="/login" className="text-sm text-[#4F46E5] hover:underline font-medium">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] dark:bg-[#0A0A0A]">
      {/* Top bar */}
      <div className="bg-white dark:bg-[#0A0A0A] border-b border-[#E5E5E5] dark:border-[#2A2A2A] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg text-[#6B7280] dark:text-[#555555] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <nav className="flex items-center gap-1 text-sm text-[#6B7280] dark:text-[#555555]">
            <Link to="/forum" className="hover:text-[#4F46E5] transition-colors">Forum</Link>
            <span className="mx-1">›</span>
            <span className="text-[#0A0A0A] dark:text-[#F5F5F5] font-medium">{editId ? 'Edit Thread' : 'New Thread'}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="space-y-5">
            <h1 className="text-xl font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{editId ? 'Edit Thread' : 'Create a New Thread'}</h1>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] focus:outline-none focus:border-[#4F46E5] transition-colors"
              >
                <option value="">Select a category…</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">Title</label>
                <span className={`text-xs ${title.length > 190 ? 'text-red-500' : 'text-[#9CA3AF] dark:text-[#555555]'}`}>
                  {title.length}/200
                </span>
              </div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What's your thread about?"
                maxLength={200}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors"
              />
              {title.length > 0 && title.length < 10 && (
                <p className="text-xs text-red-500">Title must be at least 10 characters</p>
              )}
            </div>

            {/* Content */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">Content</label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${content.length > 9800 ? 'text-red-500' : 'text-[#9CA3AF] dark:text-[#555555]'}`}>
                    {content.length}/10000
                  </span>
                  <button
                    onClick={() => setPreviewMode(v => !v)}
                    className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#555555] hover:text-[#4F46E5] transition-colors"
                  >
                    {previewMode ? <><Edit3 className="w-3 h-3" /> Edit</> : <><Eye className="w-3 h-3" /> Preview</>}
                  </button>
                </div>
              </div>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Write your post… Markdown is supported"
                rows={10}
                maxLength={10000}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] resize-none focus:outline-none focus:border-[#4F46E5] transition-colors font-mono"
              />
              {content.length > 0 && content.length < 20 && (
                <p className="text-xs text-red-500">Content must be at least 20 characters</p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">
                Tags <span className="text-[#9CA3AF] dark:text-[#444444] font-normal">(max 5)</span>
              </label>
              <div className="relative">
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput); }
                    }}
                    placeholder={tags.length >= 5 ? 'Max 5 tags' : 'Add a tag…'}
                    disabled={tags.length >= 5}
                    className="flex-1 px-3 py-2 rounded-xl border border-[#E5E5E5] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-sm text-[#0A0A0A] dark:text-[#F5F5F5] placeholder-[#9CA3AF] dark:placeholder-[#444444] focus:outline-none focus:border-[#4F46E5] transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={() => addTag(tagInput)}
                    disabled={!tagInput.trim() || tags.length >= 5}
                    className="px-3 py-2 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
                {tagInput && tagSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-10 mt-1 bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                    {tagSuggestions.slice(0, 6).map(t => (
                      <button
                        key={t}
                        onClick={() => addTag(t)}
                        className="w-full text-left px-3 py-2 text-sm text-[#374151] dark:text-[#CCCCCC] hover:bg-[#F3F4F6] dark:hover:bg-[#1E1E1E] transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F3F4F6] dark:bg-[#1E1E1E] text-[#6B7280] dark:text-[#888888]">
                      {tag}
                      <button onClick={() => removeTag(i)} className="hover:text-red-500 transition-colors ml-0.5">
                        <X className="w-3 h-3" strokeWidth={2} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={() => editId ? editMutation.mutate() : createMutation.mutate()}
              disabled={!canSubmit || isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editId ? 'Save Changes' : 'Post Thread'}
            </button>
          </div>

          {/* Preview panel */}
          <div className="hidden lg:block">
            <div className="sticky top-24 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">Preview</p>
              <div className="bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5 space-y-3">
                {title ? (
                  <h2 className="text-lg font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{title}</h2>
                ) : (
                  <p className="text-sm text-[#9CA3AF] dark:text-[#444444] italic">Thread title will appear here…</p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {tags.map(t => <TagPill key={t} tag={t} />)}
                  </div>
                )}
                {content ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-[#374151] dark:text-[#CCCCCC] [&_pre]:bg-[#F3F4F6] dark:[&_pre]:bg-[#1E1E1E] [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-[#EF4444] [&_code]:bg-[#FEF2F2] dark:[&_code]:bg-[#2A1515] dark:[&_code]:text-[#FC8181] [&_code]:px-1 [&_code]:rounded [&_pre_code]:bg-transparent dark:[&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:px-0 [&_a]:text-[#4F46E5] [&_blockquote]:border-l-4 [&_blockquote]:border-[#E5E7EB] dark:[&_blockquote]:border-[#2A2A2A] [&_blockquote]:pl-3"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                  />
                ) : (
                  <p className="text-sm text-[#9CA3AF] dark:text-[#444444] italic">Your content will appear here…</p>
                )}
              </div>
            </div>
          </div>

          {/* Mobile preview */}
          {previewMode && (
            <div className="lg:hidden bg-white dark:bg-[#141414] border border-[#E5E5E5] dark:border-[#2A2A2A] rounded-xl p-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#555555]">Preview</p>
              {title && <h2 className="text-lg font-bold text-[#0A0A0A] dark:text-[#F5F5F5]">{title}</h2>}
              {tags.length > 0 && <div className="flex flex-wrap gap-1">{tags.map(t => <TagPill key={t} tag={t} />)}</div>}
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(content || '*Nothing yet…*') }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
