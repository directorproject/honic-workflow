const YEAR = new Date().getFullYear();

export function ShareSiteFooter() {
  return (
    <footer className="border-dash-border text-dash-muted-foreground mx-auto mt-3 max-w-7xl border-t px-4 pb-28 pt-4 text-center text-xs leading-relaxed sm:mt-4 sm:px-6 sm:pb-12 sm:pt-5 sm:text-sm lg:px-8">
      <p className="text-dash-foreground text-sm font-semibold sm:text-base">Honic Company Limited</p>
      <p className="mt-1">© {YEAR} All rights reserved.</p>

      <div className="mt-6 space-y-2">
        <p className="text-dash-foreground text-xs font-semibold uppercase tracking-wide">Support</p>
        <p>
          POC Eng. Hamid —{" "}
          <a href="tel:+255628882871" className="text-dash-accent font-medium underline-offset-2 hover:underline">
            +255 628 882 871
          </a>
        </p>
        <p>
          POC Eng. John —{" "}
          <a href="tel:+255620518724" className="text-dash-accent font-medium underline-offset-2 hover:underline">
            +255 620 518 724
          </a>
        </p>
      </div>
    </footer>
  );
}
