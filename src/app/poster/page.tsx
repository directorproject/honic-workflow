export default function PosterPage() {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-950 min-h-screen flex items-center justify-center p-4">
      {/* Poster Container */}
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-12 sm:px-12 sm:py-16 text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-3">
            Honic Nexis
          </h1>
          <p className="text-xl sm:text-2xl text-cyan-100 font-semibold">
            Your Complete Project Platform
          </p>
          <p className="text-cyan-50 mt-3 text-lg">
            Manage. Collaborate. Succeed.
          </p>
        </div>

        {/* Main Content */}
        <div className="px-8 py-12 sm:px-12 sm:py-16">
          {/* Features Grid */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
              What You Get
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  icon: "📊",
                  title: "Project Workspace",
                  desc: "Organize files, timeline, and milestones in one place",
                },
                {
                  icon: "📚",
                  title: "Literature Review",
                  desc: "Browse 1000+ real student projects and research papers",
                },
                {
                  icon: "💼",
                  title: "Jobs Board",
                  desc: "Post and apply for peer help and collaboration",
                },
                {
                  icon: "📄",
                  title: "Documents Hub",
                  desc: "Access study guides, templates, and writing packs",
                },
                {
                  icon: "👥",
                  title: "Team Collaboration",
                  desc: "Real-time messaging with supervisors and teammates",
                },
                {
                  icon: "📈",
                  title: "Progress Tracking",
                  desc: "Gantt charts, calendars, and milestone management",
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="border-2 border-cyan-200 rounded-2xl p-6 hover:border-cyan-500 hover:shadow-lg transition"
                >
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Plans Section */}
          <div className="mb-12 bg-slate-50 rounded-2xl p-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
              Simple, Flexible Plans
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { name: "Free", price: "0", color: "slate" },
                { name: "Monthly", price: "3,000 TSH", color: "blue" },
                { name: "Semester", price: "14,000 TSH", color: "cyan", badge: "20% OFF" },
                { name: "Annual", price: "24,000 TSH", color: "indigo", badge: "BEST VALUE" },
              ].map((plan, idx) => (
                <div
                  key={idx}
                  className={`bg-white border-2 border-${plan.color}-300 rounded-xl p-6 text-center relative`}
                >
                  {plan.badge && (
                    <div className={`absolute top-3 right-3 bg-${plan.color}-500 text-white text-xs font-bold px-3 py-1 rounded-full`}>
                      {plan.badge}
                    </div>
                  )}
                  <h3 className={`text-xl font-bold text-${plan.color}-700 mb-2`}>
                    {plan.name}
                  </h3>
                  <p className="text-2xl font-bold text-slate-900 mb-4">
                    {plan.price}
                  </p>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>✓ Full access</p>
                    <p>✓ Title hides</p>
                    <p>✓ Large storage</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Why Choose Us */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-6 text-center">
              Why Choose Honic Nexis?
            </h2>
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-2xl p-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-5xl font-bold text-cyan-600 mb-2">
                    1000+
                  </div>
                  <p className="text-slate-700 font-semibold">Real Projects</p>
                  <p className="text-sm text-slate-600">Learn from completed work</p>
                </div>
                <div>
                  <div className="text-5xl font-bold text-cyan-600 mb-2">
                    30+
                  </div>
                  <p className="text-slate-700 font-semibold">Universities</p>
                  <p className="text-sm text-slate-600">Join 1000+ active students</p>
                </div>
                <div>
                  <div className="text-5xl font-bold text-cyan-600 mb-2">
                    24/7
                  </div>
                  <p className="text-slate-700 font-semibold">Support</p>
                  <p className="text-sm text-slate-600">Help when you need it</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-10 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Level Up Your Project?
            </h2>
            <p className="text-lg mb-6 text-cyan-100">
              Join thousands of students already using Honic Nexis
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="bg-white text-cyan-600 hover:bg-cyan-50 px-8 py-3 rounded-lg font-bold text-lg transition">
                Start Free
              </button>
              <button className="border-2 border-white text-white hover:bg-white/10 px-8 py-3 rounded-lg font-bold text-lg transition">
                Learn More
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-900 text-white px-8 py-6 text-center">
          <p className="text-sm">
            Visit <span className="font-bold text-cyan-400">share.honiccompany.com/portal</span> or scan the QR code
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Honic Nexis • Student & Supervisor Portal • Making project management simple
          </p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .bg-gradient-to-br { background: #f8fafc; }
        }
      `}</style>
    </div>
  );
}
