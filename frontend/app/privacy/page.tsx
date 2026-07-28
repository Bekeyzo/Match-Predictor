export const metadata = { title: 'Privacy Policy' };

export default function PrivacyPage() {
  return (
    <div className="legal">
      <a href="/" className="back">← Home</a>
      <h1 className="display" style={{ fontSize: 32, margin: '10px 0 6px' }}>Privacy Policy</h1>
      <p className="legal-date">Last updated: 27 July 2026</p>

      <h2>What this is</h2>
      <p>
        This policy explains what information we collect when you use this site,
        why we collect it, and what we do with it. We have tried to write it in
        plain language rather than legalese.
      </p>

      <h2>What we collect</h2>
      <p>If you create an account with a username and password, we store:</p>
      <ul>
        <li>Your chosen username</li>
        <li>Your password, hashed with bcrypt — we never store or see the original</li>
        <li>The date your account was created</li>
      </ul>
      <p>If you sign in with Google, we receive and store:</p>
      <ul>
        <li>Your email address</li>
        <li>A unique identifier Google assigns to your account</li>
        <li>A username derived from your email address</li>
      </ul>
      <p>
        We do not receive your Google password, and we request only basic profile
        information — nothing from your Gmail, Drive, contacts or any other Google service.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>Payment information — the service is free and we take no payments</li>
        <li>Your location, contacts, photos, or any device data</li>
        <li>Advertising or cross-site tracking identifiers</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Your account exists so we can tell users apart and let you access predictions.
        That is the only purpose. We do not sell your data, share it with advertisers,
        or send you marketing email.
      </p>

      <h2>Third parties</h2>
      <p>
        We use <strong>Google Sign-In</strong> for optional authentication, governed by
        Google&rsquo;s own privacy policy. We fetch football fixtures and historical
        results from public football data sources. These providers receive no
        information about you — we request match data, not user data.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We store an authentication token and your display name in your browser&rsquo;s
        local storage so you stay signed in, plus your light/dark theme preference.
        We use no analytics or advertising cookies.
      </p>

      <h2>Keeping it and deleting it</h2>
      <p>
        We keep your account information for as long as your account exists. To delete
        your account and everything associated with it, contact us at the address below
        and we will remove it.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask what data we hold about you, ask us to correct it, or ask us to
        delete it. Contact us and we will respond.
      </p>

      <h2>Children</h2>
      <p>
        This service is not intended for anyone under 18. We do not knowingly collect
        information from children.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy we will update the date at the top. Material changes
        will be announced on the site.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy or your data: <strong>Bekeyzo@proton.me</strong>
      </p>
    </div>
  );
}
