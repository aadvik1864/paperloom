import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { LoadingPage } from '../components/Common/Loading';
import { SkeletonPaperDetail } from '../components/Common/Skeleton';
import Breadcrumbs from '../components/Common/Breadcrumbs';

export default function PaperDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const [paper, setPaper] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const canvasRef = useRef(null);

  useEffect(() => {
    const fetchPaper = async () => {
      try {
        const res = await api.get(`/papers/${id}`);
        setPaper(res.data.paper);

        if (user) {
          try {
            const bm = await api.get(`/papers/${id}/bookmark`);
            setBookmarked(bm.data.bookmarked);
          } catch {}
        }
      } catch (err) {
        console.error('Failed to load paper:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPaper();
  }, [id, user]);

  useEffect(() => {
    if (!paper?.pdf_url) return;

    const loadPdf = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(paper.pdf_url).promise;
        setNumPages(pdf.numPages);

        const renderPage = async (num) => {
          const page = await pdf.getPage(num);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });

          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;
        };

        renderPage(1);

        // Expose for pagination
        window.__pdfDoc = pdf;
        window.__renderPage = renderPage;
      } catch (err) {
        console.error('PDF load error:', err);
      }
    };
    loadPdf();
  }, [paper?.pdf_url]);

  const changePage = async (delta) => {
    const newPage = pageNumber + delta;
    if (newPage < 1 || newPage > numPages) return;
    setPageNumber(newPage);
    if (window.__renderPage) {
      await window.__renderPage(newPage);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/papers/${id}/download`);
      if (res.data.download_url) {
        window.open(res.data.download_url, '_blank');
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleBookmark = async () => {
    if (!user) return;
    try {
      const res = await api.post(`/papers/${id}/bookmark`);
      setBookmarked(res.data.bookmarked);
    } catch (err) {
      console.error('Bookmark error:', err);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><SkeletonPaperDetail /></div>;
  if (!paper) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center text-gray-500 dark:text-gray-400">
      Paper not found.
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs items={[
        { href: '/browse', label: 'Papers' },
        { label: paper.title.length > 60 ? paper.title.substring(0, 60) + '...' : paper.title },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Metadata */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-4 sticky top-20">
            <div>
              <span className="text-xs font-medium text-accent bg-accent-light px-2 py-1 rounded-full">
                {paper.category_name || 'Uncategorized'}
              </span>
            </div>

            <h1 className="text-xl font-bold text-navy-900 dark:text-white leading-snug">{paper.title}</h1>

            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <p><span className="font-medium text-gray-900 dark:text-gray-100">Authors:</span> {paper.authors}</p>
              {paper.institution && (
                <p><span className="font-medium text-gray-900 dark:text-gray-100">Institution:</span> {paper.institution}</p>
              )}
              {paper.department && (
                <p><span className="font-medium text-gray-900 dark:text-gray-100">Department:</span> {paper.department}</p>
              )}
              <p><span className="font-medium text-gray-900 dark:text-gray-100">Published:</span> {paper.published_at?.slice(0, 10)}</p>
              {paper.keywords && (
                <p><span className="font-medium text-gray-900 dark:text-gray-100">Keywords:</span> {paper.keywords}</p>
              )}
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-4">
              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span>{paper.view_count}</span>
              </span>
              <span className="flex items-center space-x-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span>{paper.download_count}</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleDownload}
                className="w-full bg-accent text-white py-2.5 rounded-lg hover:bg-accent-hover transition font-medium text-sm flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span>Download PDF</span>
              </button>
              {user && (
                <button
                  onClick={handleBookmark}
                  className={`w-full py-2.5 rounded-lg transition font-medium text-sm border ${
                    bookmarked
                      ? 'bg-accent-light text-accent border-accent/30'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {bookmarked ? 'Bookmarked' : 'Bookmark Paper'}
                </button>
              )}
            </div>

            {/* Citation */}
            {paper.citations && (
              <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-3">Citations</h3>
                <div className="space-y-3">
                  {Object.entries(paper.citations).map(([style, text]) => (
                    <div key={style} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{style}</p>
                      <p className="text-xs text-gray-700 dark:text-gray-200 font-mono leading-relaxed break-all">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Abstract */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">Abstract</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{paper.abstract}</p>
            </div>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Viewer controls */}
            {numPages && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => changePage(-1)}
                    disabled={pageNumber <= 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Page {pageNumber} of {numPages}
                  </span>
                  <button
                    onClick={() => changePage(1)}
                    disabled={pageNumber >= numPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-center bg-gray-100 dark:bg-gray-900 p-4 min-h-[500px]">
              {paper.pdf_url ? (
                <canvas ref={canvasRef} className="shadow-lg max-w-full" />
              ) : (
                <div className="flex items-center justify-center text-gray-400 dark:text-gray-500">
                  PDF not available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
