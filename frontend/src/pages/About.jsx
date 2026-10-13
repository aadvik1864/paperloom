import { Link } from 'react-router-dom';
import Icon from '../components/Common/Icon';

const features = [
  {
    title: 'Research Papers',
    description: 'Share a PDF with its abstract, authors, keywords, and discipline. Readers can preview it in the browser or download a copy.',
    icon: 'file',
  },
  {
    title: 'Blog Posts',
    description: 'Write research notes and perspectives in Markdown, save drafts, and discuss published posts through comments.',
    icon: 'pen',
  },
  {
    title: 'Search and Filters',
    description: 'Find papers by title, author, or keyword. Filter by discipline and sort by publication date, views, or downloads.',
    icon: 'search',
  },
  {
    title: 'Author Dashboard',
    description: 'Edit your papers and blog posts, update your profile, and see publication views and download counts.',
    icon: 'chart',
  },
  {
    title: 'Citation Generator',
    description: 'Copy a citation in APA, MLA, or BibTeX format from a paper’s details page.',
    icon: 'copy',
  },
  {
    title: 'Admin Controls',
    description: 'Create reader and author profiles, manage access, and remove or restore publications.',
    icon: 'check',
  },
];

const steps = [
  { step: '01', title: 'Sign In', description: 'Use the profile name and password provided by your administrator.' },
  { step: '02', title: 'Publish', description: 'Upload a PDF or write a blog post from your author dashboard.' },
  { step: '03', title: 'Share', description: 'Readers can find your published work, save papers, and join discussions on blog posts.' },
];

export default function About() {
  return (
    <div>
      <section className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            About Paperloom
          </h1>
          <p className="text-lg md:text-xl text-navy-200 max-w-3xl mx-auto leading-relaxed">
            A research library for sharing papers, reading blog posts, and following the authors behind them.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white mb-6">Why Paperloom?</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
            Papers and research notes belong together. Paperloom gives authors a place to publish both,
            and gives readers a simple way to search, read, and keep track of work that interests them.
          </p>
        </div>
      </section>

      <section className="bg-gray-50 dark:bg-gray-900 border-y border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white text-center mb-12">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 bg-accent-light rounded-lg flex items-center justify-center text-accent mb-4">
                  <Icon name={feature.icon} className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-navy-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-navy-900 dark:text-white text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step) => (
            <div key={step.step} className="text-center">
              <div className="w-14 h-14 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-lg">{step.step}</span>
              </div>
              <h3 className="font-semibold text-navy-900 dark:text-white mb-2">{step.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Share your work</h2>
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
