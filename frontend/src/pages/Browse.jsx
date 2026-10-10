import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import Pagination from '../components/Common/Pagination';
import Breadcrumbs from '../components/Common/Breadcrumbs';
import { SkeletonCard, SkeletonBlogCard } from '../components/Common/Skeleton';
import PublicationCard from '../components/Common/PublicationCard';
import Icon from '../components/Common/Icon';

const SORT_OPTIONS = { newest: 'Newest first', oldest: 'Oldest first', most_viewed: 'Most viewed', most_downloaded: 'Most downloaded' };

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const type = searchParams.get('type') === 'blogs' ? 'blogs' : 'papers';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const search = searchParams.get('search') || '';
  const [searchDraft, setSearchDraft] = useState(search);
  const view = searchParams.get('view') === 'list' ? 'list' : 'grid';
  const categoryId = searchParams.get('category_id') || '';
  const requestedSort = searchParams.get('sort') || 'newest';
  const sort = Object.hasOwn(SORT_OPTIONS, requestedSort) ? requestedSort : 'newest';

  useEffect(() => { setSearchDraft(search); }, [search]);

  useEffect(() => {
    if (searchDraft === search) return;
    const timeout = setTimeout(() => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        if (searchDraft.trim()) next.set('search', searchDraft.trim());
        else next.delete('search');
        next.delete('page');
        return next;
      }, { replace: true });
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchDraft, search, setSearchParams]);

  useEffect(() => {
    const controller = new AbortController();
    api.get('/papers/categories', { signal: controller.signal }).then((response) => setCategories(response.data.categories || [])).catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(false);
      try {
        const params = { page, per_page: 12 };
        if (search) params.search = search;
        if (type === 'papers') {
          params.sort = sort;
          if (categoryId) params.category_id = categoryId;
        }
        const response = await api.get(`/${type}`, { params, signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(response.data[type] || []);
        setTotal(response.data.total ?? 0);
        setPages(response.data.pages ?? 1);
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setItems([]);
          setTotal(0);
          setPages(1);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [type, page, search, categoryId, sort, attempt]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    setSearchParams(next);
  };
  const filters = { type, search: searchDraft, setSearchDraft, categoryId, sort, categories, updateParams };
  const hasFilters = Boolean(search || (type === 'papers' && (categoryId || sort !== 'newest')));
  const clearFilters = () => { setSearchDraft(''); updateParams({ search: '', category_id: '', sort: '', page: '' }); };
  const selectedCategory = categories.find((category) => String(category.id) === categoryId);
  const Skeleton = type === 'blogs' ? SkeletonBlogCard : SkeletonCard;

  return (
    <div className="page-container browse-page">
      <Breadcrumbs items={[{ label: type === 'blogs' ? 'Blogs' : 'Papers' }]} />
      <div className="browse-heading">
        <div>
          <h1>{type === 'blogs' ? 'Find your next perspective.' : 'Explore the research library.'}</h1>
          <p>{search ? `Results for “${search}”` : type === 'blogs'
            ? 'Ideas, observations, and conversations from the research community.'
            : 'Follow your curiosity across disciplines, authors, and ideas.'}
          </p>
        </div>
        <span className="browse-count" role="status">
          {loading ? 'Loading the library…' : error ? 'Library unavailable'
            : `${total} ${type === 'blogs' ? 'post' : 'paper'}${total === 1 ? '' : 's'}`}
        </span>
      </div>
      <FilterFields {...filters} mobile />
      <div className="browse-layout">
        <aside aria-label="Filter the library"><FilterFields {...filters} /></aside>
        <div className="browse-results" aria-busy={loading}>
          <div className="library-toolbar">
            <div className="filter-chips" aria-label="Active filters">
              {search && <button className="filter-chip" onClick={() => { setSearchDraft(''); updateParams({ search: '', page: '' }); }} aria-label={`Remove search ${search}`}><span>“{search}”</span><Icon name="close" /></button>}
              {type === 'papers' && categoryId && <button className="filter-chip" onClick={() => updateParams({ category_id: '', page: '' })} aria-label="Remove discipline filter"><span>{selectedCategory?.name || 'Discipline'}</span><Icon name="close" /></button>}
              {type === 'papers' && sort !== 'newest' && <button className="filter-chip" onClick={() => updateParams({ sort: '', page: '' })} aria-label="Reset sort order"><span>{SORT_OPTIONS[sort]}</span><Icon name="close" /></button>}
              {hasFilters ? <button className="clear-filters" onClick={clearFilters}>Clear all</button> : <span className="library-toolbar__hint">A little curiosity goes a long way.</span>}
            </div>
            <div className="view-switch" role="group" aria-label="Result layout">
              <button onClick={() => updateParams({ view: '' })} aria-label="Grid view" aria-pressed={view === 'grid'}><Icon name="grid" /></button>
              <button onClick={() => updateParams({ view: 'list' })} aria-label="List view" aria-pressed={view === 'list'}><Icon name="list" /></button>
            </div>
          </div>
          {loading ? (
            <div className="publication-grid">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} />)}
            </div>
          ) : error ? (
            <div className="content-empty" role="alert">
              <Icon name="book" />
              <h2>The library couldn’t load</h2>
              <p>Check your connection and try again. Your search and filters are saved.</p>
              <button onClick={() => setAttempt((value) => value + 1)} className="button button--secondary">Try again</button>
            </div>
          ) : items.length ? (
            <>
              <div className={view === 'list' ? 'publication-list' : 'publication-grid'}>
                {items.map((item) => <PublicationCard key={item.id} {...(type === 'blogs' ? { blog: item } : { paper: item })} />)}
              </div>
              <Pagination page={page} pages={pages} onPageChange={(nextPage) => updateParams({ page: String(nextPage) })} />
            </>
          ) : (
            <div className="content-empty">
              <Icon name={type === 'blogs' ? 'pen' : 'book'} />
              <h2>{hasFilters ? 'No matches just yet' : type === 'blogs' ? 'The conversation is just beginning' : 'The library is growing'}</h2>
              <p>{hasFilters
                ? 'Try a different keyword or clear your filters to explore the rest of the library.'
                : `Published ${type === 'blogs' ? 'blog posts' : 'research papers'} will appear here as authors share their work.`}
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="button button--secondary">Clear filters</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterFields({ mobile = false, type, search, setSearchDraft, categoryId, sort, categories, updateParams }) {
  const suffix = mobile ? 'mobile' : 'desktop';
  return (
    <div className={mobile ? 'mobile-filters' : 'browse-filters'}>
      <div className={mobile ? 'mobile-filter-search' : ''}>
        <label htmlFor={`library-search-${suffix}`} className="filter-label">Search the library</label>
        <input
          id={`library-search-${suffix}`}
          type="search"
          value={search}
          onChange={(event) => setSearchDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') updateParams({ search: search.trim(), page: '' }); }}
          maxLength={200}
          placeholder={type === 'blogs' ? 'Title or keyword' : 'Title, author, or keyword'}
          className="filter-input"
        />
      </div>
      {mobile ? (
        <div>
          <label htmlFor="library-type-mobile" className="filter-label">Content</label>
          <select id="library-type-mobile" value={type} onChange={(event) => updateParams({ type: event.target.value, category_id: '', page: '1' })} className="filter-input">
            <option value="papers">Research papers</option>
            <option value="blogs">Blog posts</option>
          </select>
        </div>
      ) : (
        <fieldset>
          <legend className="filter-label">Content</legend>
          <button onClick={() => updateParams({ type: 'papers', page: '1' })} className={`filter-choice ${type === 'papers' ? 'filter-choice--active' : ''}`} aria-pressed={type === 'papers'}>Research papers</button>
          <button onClick={() => updateParams({ type: 'blogs', category_id: '', page: '1' })} className={`filter-choice ${type === 'blogs' ? 'filter-choice--active' : ''}`} aria-pressed={type === 'blogs'}>Blog posts</button>
        </fieldset>
      )}
      {type === 'papers' && (mobile ? (
        <div>
          <label htmlFor="library-category-mobile" className="filter-label">Discipline</label>
          <select id="library-category-mobile" value={categoryId} onChange={(event) => updateParams({ category_id: event.target.value, page: '1' })} className="filter-input">
            <option value="">All disciplines</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
      ) : (
        <fieldset>
          <legend className="filter-label">Discipline</legend>
          <div className="filter-categories">
            <button onClick={() => updateParams({ category_id: '', page: '1' })} className={`filter-choice ${!categoryId ? 'filter-choice--active' : ''}`} aria-pressed={!categoryId}>All disciplines</button>
            {categories.map((category) => (
              <button key={category.id} onClick={() => updateParams({ category_id: String(category.id), page: '1' })} className={`filter-choice ${categoryId === String(category.id) ? 'filter-choice--active' : ''}`} aria-pressed={categoryId === String(category.id)}>
                {category.name}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      {type === 'papers' && (
        <div className={mobile ? 'mobile-filter-sort' : ''}>
          <label htmlFor={`library-sort-${suffix}`} className="filter-label">Sort by</label>
          <select id={`library-sort-${suffix}`} value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: '1' })} className="filter-input">
            {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
