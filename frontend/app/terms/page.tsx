export const metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <div className="legal">
      <a href="/" className="back">← Home</a>
      <h1 className="display" style={{ fontSize: 32, margin: '10px 0 6px' }}>Terms of Service</h1>
      <p className="legal-date">Last updated: 27 July 2026</p>

      <h2>What this service does</h2>
      <p>
        This site publishes statistical forecasts for football matches. A machine
        learning model trained on historical results estimates the probability of each
        outcome, along with expected goals, corners and cards.
      </p>

      <h2 className="legal-flag">These are estimates, not predictions of fact</h2>
      <p>
        This is the most important thing on this page. Our model produces
        <strong> probabilities based on past results</strong>. It is frequently wrong.
        We publish our measured accuracy openly on the home page precisely so you can
        judge for yourself how much weight to give it.
      </p>
      <p>
        Nothing here is a guarantee, a tip, or a promise about any match outcome.
        Football is unpredictable — that is what makes it worth watching.
      </p>

      <h2 className="legal-flag">No liability for betting losses</h2>
      <p>
        <strong>
          Neither this website nor the people or organisation behind it accept any
          responsibility or liability for money you lose betting on the basis of
          anything published here.
        </strong>
      </p>
      <p>
        Every forecast on this site is a <strong>prediction, not a certainty</strong>.
        Our model is wrong a substantial share of the time, by its own published
        measurement. A forecast that a team is likely to win is not a statement that
        they will win, and treating it as one is a mistake we cannot protect you from.
      </p>
      <p>
        If you place a bet, that decision is entirely yours and the consequences —
        financial or otherwise — are entirely yours. You accept that risk in full by
        using this service.
      </p>

      <h2>Not betting advice</h2>
      <p>
        We are not a bookmaker, we do not accept wagers, and nothing on this site is
        advice to place a bet. If you choose to gamble, you do so entirely at your own
        risk and are responsible for complying with the law where you live. Never
        gamble money you cannot afford to lose. If gambling is causing you harm, please
        seek support from a qualified organisation in your country.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your password secure and for activity under
        your account. Tell us promptly if you believe someone else has access to it.
        You must be 18 or older to create an account.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Attempt to break, overload or gain unauthorised access to the service</li>
        <li>Scrape or bulk-extract data through automated means</li>
        <li>Resell or redistribute our predictions as your own</li>
        <li>Use the service for anything unlawful</li>
      </ul>

      <h2>Availability</h2>
      <p>
        We offer this service as-is and free of charge. We do not promise it will
        always be available, accurate or uninterrupted, and we may change or withdraw
        features at any time.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        More generally, and to the fullest extent the law allows, we are not liable
        for any loss or damage arising from your use of this service, whether direct,
        indirect, financial or otherwise.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The date at the top shows when they last changed.
        Continuing to use the service means you accept the current version.
      </p>

      <h2>Contact</h2>
      <p><strong>Bekeyzo@proton.me</strong></p>
    </div>
  );
}
