import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SkeletonPaperDetail } from '../components/Common/Skeleton';
import Breadcrumbs from '../components/Common/Breadcrumbs';
import Icon from '../components/Common/Icon';

export default function PaperDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [citationStyle, setCitationStyle] = useState('APA');
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPaper(null);
    setBookmarked(false);
    setFeedback(null);
    setCopied(false);
    const fetchPaper = async () => {
      try {
        const response = await api.get(`/papers/${id}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setPaper(response.data.paper);
        if (user) {
          const bookmark = await api.get(`/papers/${id}/bookmark`, { signal: controller.signal }).catch(() => null);
          if (!controller.signal.aborted) setBookmarked(Boolean(bookmark?.data.bookmarked));
        }
      } catch {
        if (!controller.signal.aborted) setPaper(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchPaper();
    return () => controller.abort();
  }, [id, user, attempt]);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setFeedback(null);
    try {
      const response = await api.get(`/papers/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${paper.title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'paper'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFeedback({ text: 'PDF downloaded.' });
    } catch {
      setFeedback({ error: true, text: 'Download failed. Check your connection and try again.' });
    } finally {
      setDownloading(false);
    }
  };

  const handleBookmark = async () => {
    if (!user || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await api.post(`/papers/${id}/bookmark`);
      setBookmarked(response.data.bookmarked);
      setFeedback({ text: response.data.bookmarked ? 'Saved to your bookmarks.' : 'Removed from your bookmarks.' });
    } catch {
      setFeedback({ error: true, text: 'Your bookmark could not be saved. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(paper.citations[citationStyle]);
      setCopied(true);
      setFeedback({ text: `${citationStyle} citation copied.` });
    } catch {
      setFeedback({ error: true, text: 'Clipboard access is unavailable. Select and copy the citation below.' });
    }
  };

  if (loading) return <div className="page-container py-8"><SkeletonPaperDetail /></div>;
  if (!paper) return (
    <div className="page-container py-16">
      <div className="content-empty" role="alert">
        <Icon name="file" /><h1 className="text-3xl">This paper couldn’t load</h1>
        <p>It may no longer be published, or your connection may be unavailable.</p>
        <button onClick={() => setAttempt((value) => value + 1)} className="button button--secondary">Try again</button>
        <Link to="/browse" className="button button--secondary ml-3">Browse papers</Link>
      </div>
    </div>
  );

  return (
    <div className="page-container py-8">
      <Breadcrumbs items={[{ href: '/browse', label: 'Papers' }, { label: paper.title }]} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
            <Link to={`/browse?category_id=${paper.category_id}`} className="category-tag">{paper.category_name || 'Research paper'}</Link>
            <h1 className="text-3xl text-navy-900 dark:text-white leading-tight">{paper.title}</h1>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
              <p className="font-semibold">{paper.authors}</p>
              {paper.primary_author_id && <Link to={`/profile/${paper.primary_author_id}`} className="text-link">View author profile <Icon name="arrow" /></Link>}
              {paper.institution && <p>{paper.institution}</p>}
              {paper.department && <p>{paper.department}</p>}
              <p>Published {paper.published_at?.slice(0, 10)}</p>
            </div>
            {paper.keywords && <div className="filter-chips">{paper.keywords.split(',').filter((keyword) => keyword.trim()).map((keyword, index) => <Link key={index} to={`/browse?search=${encodeURIComponent(keyword.trim())}`} className="filter-chip">{keyword.trim()}</Link>)}</div>}
            <div className="flex gap-5 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-2"><Icon name="eye" /> {paper.view_count} views</span>
              <span className="flex items-center gap-2"><Icon name="download" /> {paper.download_count} downloads</span>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={handleDownload} disabled={downloading} className="button button--primary"><Icon name="download" />{downloading ? 'Downloading…' : 'Download PDF'}</button>
              {user ? <button onClick={handleBookmark} disabled={saving} aria-pressed={bookmarked} className="button button--secondary"><Icon name={bookmarked ? 'check' : 'bookmark'} />{saving ? 'Saving…' : bookmarked ? 'Saved to bookmarks' : 'Save paper'}</button>
                : <Link to="/login" className="button button--secondary"><Icon name="bookmark" />Sign in to save</Link>}
            </div>
            {feedback && <p className={`action-feedback ${feedback.error ? 'action-feedback--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
            <section className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <h2 className="text-xl mb-3">Abstract</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{paper.abstract}</p>
            </section>
            {paper.citations && <section className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <h2 className="text-xl mb-3">Cite this paper</h2>
              <div className="citation-tabs" role="group" aria-label="Citation style">
                {Object.keys(paper.citations).map((style) => <button key={style} aria-pressed={citationStyle === style} onClick={() => { setCitationStyle(style); setCopied(false); }}>{style}</button>)}
              </div>
              <p className="citation-text">{paper.citations[citationStyle]}</p>
              <button onClick={copyCitation} className="text-link mt-3"><Icon name={copied ? 'check' : 'copy'} />{copied ? 'Citation copied' : 'Copy citation'}</button>
            </section>}
          </div>
        </aside>
        <section className="lg:col-span-2 min-w-0" aria-label="Paper reader">
          <PdfViewer key={id} id={id} />
        </section>
      </div>
    </div>
  );
}

function PdfViewer({ id }) {
  const [pdf, setPdf] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState('fit');
  const [error, setError] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const canvasRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let documentTask;
    setPdf(null);
    setError(false);
    setPageNumber(1);
    const load = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const response = await api.get(`/papers/${id}/pdf`, { responseType: 'arraybuffer', signal: controller.signal });
        if (controller.signal.aborted) return;
        documentTask = pdfjs.getDocument({ data: new Uint8Array(response.data), isEvalSupported: false, maxImageSize: 25000000 });
        const document = await documentTask.promise;
        if (!controller.signal.aborted) setPdf(document);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    };
    load();
    return () => { controller.abort(); documentTask?.destroy().catch(() => {}); };
  }, [id, attempt]);

  useEffect(() => {
    if (!pdf) return;
    let canceled = false;
    let task;
    setRendering(true);
    const render = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (canceled) return;
        const scale = zoom === 'fit' ? 1.5 : Number(zoom);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * ratio });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / ratio}px`;
        canvas.style.maxWidth = zoom === 'fit' ? '100%' : 'none';
        task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
        await task.promise;
      } catch (failure) {
        if (!canceled && failure.name !== 'RenderingCancelledException') setError(true);
      } finally {
        if (!canceled) setRendering(false);
      }
    };
    render();
    return () => { canceled = true; task?.cancel(); };
  }, [pdf, pageNumber, zoom]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="pdf-controls">
        <div className="pdf-controls__pages">
          <button disabled={!pdf || pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}>Previous</button>
          <span aria-live="polite">{pdf ? `Page ${pageNumber} of ${pdf.numPages}` : 'Paper preview'}</span>
          <button disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((page) => page + 1)}>Next</button>
        </div>
        <label>Zoom <select aria-label="PDF zoom" value={zoom} onChange={(event) => setZoom(event.target.value)}><option value="fit">Fit width</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label>
      </div>
      <div className="pdf-surface" aria-busy={!error && (!pdf || rendering)}>
        {error ? <div className="pdf-status" role="alert"><Icon name="file" /><p>PDF preview unavailable. Try again or use Download PDF.</p><button className="button button--secondary" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button></div>
          : !pdf && <div className="pdf-status" role="status">Loading the paper…</div>}
        <canvas ref={canvasRef} hidden={!pdf || error} role="img" aria-label={`PDF preview, page ${pageNumber}. Download the PDF for accessible text.`} />
      </div>
      <p className="pdf-caption">Use Download PDF to read, search, or select text in your preferred PDF reader.</p>
    </div>
  );
}
