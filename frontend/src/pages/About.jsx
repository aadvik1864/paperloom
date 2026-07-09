import { Link } from 'react-router-dom';

const features = [
  {
    title: 'Research Papers',
    desc: 'Publish and browse peer-reviewed research with embedded PDF viewing, DOI-style citations, and full-text search.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    title: 'Blog Posts',
    desc: 'Share insights, commentary, and academic perspectives with the research community through rich blog posts.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    title: 'Smart Search',
    desc: 'Advanced search across papers, authors, institutions, and keywords with filters by category, date, and popularity.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    title: 'Author Dashboard',
    desc: 'Manage your publications, track views and downloads, and engage with readers through comments and discussions.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
  {
    title: 'Citation Generator',
    desc: 'Automatically generate citations in APA, MLA, and BibTeX formats for every paper on the platform.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.75c0 1.035.84 1.875 1.875 1.875h11.25c1.035 0 1.875-.84 1.875-1.875V9a2.25 2.25 0 00-1.5-2.122m0 0v10.5A2.25 2.25 0 0115.75 19.5H7.5A2.25 2.25 0 015.25 17.25V15" />
      </svg>
    ),
  },
  {
    title: 'Admin Controls',
    desc: 'Full administrative suite for managing users, moderating content, and monitoring platform analytics.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
];

const steps = [
  { step: '01', title: 'Sign In', desc: 'Access your shared profile using the credentials provided by your administrator.' },
  { step: '02', title: 'Upload', desc: 'Submit your research papers or write blog posts using the author dashboard.' },
  { step: '03', title: 'Share', desc: 'Your work is immediately available for the global research community to discover and cite.' },
];

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            About Al-Qwal Publications
          </h1>
          <p className="text-lg md:text-xl text-navy-200 max-w-3xl mx-auto leading-relaxed">
            A modern research publication platform built for academics, researchers, and institutions
            to publish, discover, and share scholarly work.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900 mb-6">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed text-lg">
            We believe that research should be accessible, discoverable, and shareable. Our platform provides
            a streamlined environment for researchers to publish their work, engage with peers, and track
            the impact of their contributions — all without unnecessary barriers or complex workflows.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900 text-center mb-12">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-accent-light rounded-lg flex items-center justify-center text-accent mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-navy-900 text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">{s.step}</span>
              </div>
              <h3 className="font-semibold text-navy-900 mb-2">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-navy-200 mb-8 max-w-lg mx-auto">
            Contact your administrator to set up your profile and begin publishing.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover transition font-medium"
          >
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
