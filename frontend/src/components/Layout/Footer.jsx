import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-navy-900 text-gray-300 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AQ</span>
              </div>
              <span className="font-semibold text-lg text-white">Al-Qwal Publications</span>
            </div>
            <p className="text-sm text-gray-400">
              A modern research publication platform for researchers and academics worldwide.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <div className="space-y-2 text-sm">
              <Link to="/browse" className="block hover:text-white transition">Browse Papers</Link>
              <Link to="/browse?type=blogs" className="block hover:text-white transition">Read Blogs</Link>
              <Link to="/login" className="block hover:text-white transition">Sign In</Link>
            </div>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <p className="text-sm text-gray-400">
              For inquiries, reach out to our support team.
            </p>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} Al-Qwal Publications. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
